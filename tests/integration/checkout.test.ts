/**
 * Checkout transakcyjny (lib/orders/checkout.ts) – testy na prawdziwym Postgresie.
 * Użytkownicy "co-*" nie kolidują z fixture'ami innych plików (alice-test, bob-test, "u*").
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { addProduct } from "@/lib/cart/cart-repository";
import { checkout, CheckoutError } from "@/lib/orders/checkout";
import { resetAndSeed } from "./helpers";

const A = "co-alice";
const B = "co-bob";
const mkUser = (id: string) => ({ id, name: id, email: `${id}@example.test`, emailVerified: false });

let seq = 0;
async function makeProduct(amount: number, price = 50_00, name = "Checkout Product") {
  const cat = await prisma.category.findUniqueOrThrow({ where: { code: "cpu" } });
  return prisma.product.create({
    data: {
      code: `CO${String(Date.now()).slice(-5)}${seq++ % 10}`,
      name,
      nameSortKey: name.toLowerCase(),
      description: "checkout tests",
      image: "/images/products/cpu.webp",
      price,
      amount,
      date: new Date("2026-01-01T00:00:00Z"),
      categoryId: cat.id,
    },
  });
}

const stock = async (id: number) => (await prisma.product.findUniqueOrThrow({ where: { id } })).amount;
const cartCount = (userId: string) => prisma.cartItem.count({ where: { cart: { userId } } });
const orderCount = (userId: string) => prisma.order.count({ where: { userId } });

async function putInCart(userId: string, productId: number, qty: number) {
  for (let i = 0; i < qty; i++) await addProduct(userId, productId);
}

beforeAll(async () => {
  await resetAndSeed();
  for (const id of [A, B]) await prisma.user.upsert({ where: { id }, create: mkUser(id), update: {} });
});

beforeEach(async () => {
  // Zamówienia mają FK Restrict do użytkownika, więc czyścimy je jawnie (pozycje: Cascade).
  await prisma.order.deleteMany({ where: { userId: { startsWith: "co-" } } });
  await prisma.cart.deleteMany({ where: { userId: { in: [A, B] } } });
});

describe("checkout – podstawy", () => {
  it("tworzy zamówienie ze snapshotem, sumą w groszach, zmniejsza stan i czyści koszyk", async () => {
    const p1 = await makeProduct(10, 1999, "Alfa");
    const p2 = await makeProduct(5, 250_00, "Beta");
    await putInCart(A, p1.id, 3);
    await putInCart(A, p2.id, 2);

    const r = await checkout(A, "key-1", 3 * 1999 + 2 * 250_00);
    expect(r.replayed).toBe(false);
    expect(r.totalCents).toBe(String(3 * 1999 + 2 * 250_00));

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: r.orderId },
      include: { items: { orderBy: { productId: "asc" } } },
    });
    expect(order.userId).toBe(A);
    expect(order.requestKey).toBe("key-1");
    expect(order.items.map((i) => [i.productCode, i.productName, i.quantity, i.unitPriceCents])).toEqual([
      [p1.code, "Alfa", 3, 1999],
      [p2.code, "Beta", 2, 250_00],
    ]);
    expect(await stock(p1.id)).toBe(7);
    expect(await stock(p2.id)).toBe(3);
    expect(await cartCount(A)).toBe(0);
  });

  it("snapshot nie zmienia się po zmianie ceny i nazwy produktu", async () => {
    const p = await makeProduct(5, 1000, "Stara nazwa");
    await putInCart(A, p.id, 1);
    const r = await checkout(A, "key-snap");
    await prisma.product.update({ where: { id: p.id }, data: { price: 9999, name: "Nowa nazwa" } });
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: r.orderId } });
    expect([item.productName, item.unitPriceCents]).toEqual(["Stara nazwa", 1000]);
  });

  it("suma przekraczająca Int32 jest dokładna (BigInt)", async () => {
    const p = await makeProduct(99, 2_000_000_000, "Drogi");
    await putInCart(A, p.id, 99);
    const r = await checkout(A, "key-big");
    expect(r.totalCents).toBe((99n * 2_000_000_000n).toString());
    expect((await prisma.order.findUniqueOrThrow({ where: { id: r.orderId } })).totalCents).toBe(
      99n * 2_000_000_000n,
    );
  });

  it("pusty koszyk → EMPTY_CART, nie powstaje zamówienie", async () => {
    await expect(checkout(A, "key-empty")).rejects.toMatchObject({ code: "EMPTY_CART" });
    expect(await orderCount(A)).toBe(0);
  });

  it.each([undefined, null, "", 5, "x".repeat(65)])("odrzuca klucz żądania %s", async (k) => {
    await expect(checkout(A, k)).rejects.toMatchObject({ code: "INVALID_REQUEST_KEY" });
  });

  it("niezgodna oczekiwana suma → PRICE_CHANGED i pełny rollback", async () => {
    const p = await makeProduct(5, 1000);
    await putInCart(A, p.id, 2);
    await prisma.product.update({ where: { id: p.id }, data: { price: 1500 } });
    await expect(checkout(A, "key-price", 2000)).rejects.toMatchObject({ code: "PRICE_CHANGED" });
    expect(await stock(p.id)).toBe(5);
    expect(await cartCount(A)).toBe(1);
    expect(await orderCount(A)).toBe(0);
  });

  it("zawsze rozlicza po aktualnej cenie z bazy, nie z koszyka", async () => {
    const p = await makeProduct(5, 1000);
    await putInCart(A, p.id, 2);
    await prisma.product.update({ where: { id: p.id }, data: { price: 1500 } });
    const r = await checkout(A, "key-newprice");
    expect(r.totalCents).toBe("3000");
  });
});

describe("checkout – właściciel i stan", () => {
  it("realizuje wyłącznie koszyk właściciela; cudzy zostaje nietknięty", async () => {
    const p = await makeProduct(10);
    await putInCart(A, p.id, 2);
    await putInCart(B, p.id, 3);
    await checkout(A, "key-owner");
    expect(await cartCount(B)).toBe(1);
    expect(await orderCount(B)).toBe(0);
    expect(await stock(p.id)).toBe(8);
  });

  it("brak stanu po dodaniu do koszyka → INSUFFICIENT_STOCK, rollback wszystkich pozycji", async () => {
    const ok = await makeProduct(10);
    const low = await makeProduct(3);
    await putInCart(A, ok.id, 2);
    await putInCart(A, low.id, 3);
    await prisma.product.update({ where: { id: low.id }, data: { amount: 2 } }); // stan spadł
    await expect(checkout(A, "key-low")).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect(await stock(ok.id)).toBe(10); // zmniejszenie pierwszej pozycji wycofane
    expect(await stock(low.id)).toBe(2);
    expect(await cartCount(A)).toBe(2);
    expect(await orderCount(A)).toBe(0);
  });

  it("dwóch użytkowników kupuje ostatnią sztukę – wygrywa dokładnie jeden", async () => {
    const p = await makeProduct(1);
    await putInCart(A, p.id, 1);
    await putInCart(B, p.id, 1);
    const res = await Promise.allSettled([checkout(A, "race-a"), checkout(B, "race-b")]);
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rej = res.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rej.reason).toBeInstanceOf(CheckoutError);
    expect(rej.reason.code).toBe("INSUFFICIENT_STOCK");
    expect(await stock(p.id)).toBe(0);
    expect((await orderCount(A)) + (await orderCount(B))).toBe(1);
    // przegrany zachowuje koszyk
    expect((await cartCount(A)) + (await cartCount(B))).toBe(1);
  });

  it("stan nigdy nie schodzi poniżej zera przy wielu równoległych zakupach", async () => {
    const p = await makeProduct(3);
    const users = ["co-u1", "co-u2", "co-u3", "co-u4", "co-u5"];
    for (const id of users) {
      await prisma.user.upsert({ where: { id }, create: mkUser(id), update: {} });
      await prisma.cart.deleteMany({ where: { userId: id } });
      await putInCart(id, p.id, 1);
    }
    const res = await Promise.allSettled(users.map((id) => checkout(id, `k-${id}`)));
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect(await stock(p.id)).toBe(0);
  });
});

describe("checkout – idempotencja", () => {
  it("ponowienie tego samego żądania zwraca to samo zamówienie i nie zmniejsza stanu drugi raz", async () => {
    const p = await makeProduct(5);
    await putInCart(A, p.id, 2);
    const first = await checkout(A, "same-key");
    const second = await checkout(A, "same-key");
    expect(second).toEqual({ ...first, replayed: true });
    expect(await orderCount(A)).toBe(1);
    expect(await stock(p.id)).toBe(3);
  });

  it("ponowienie po tym, jak użytkownik zapełnił koszyk na nowo, nadal nie tworzy zamówienia", async () => {
    const p = await makeProduct(5);
    await putInCart(A, p.id, 1);
    const first = await checkout(A, "same-key-2");
    await putInCart(A, p.id, 1);
    const again = await checkout(A, "same-key-2");
    expect(again.orderId).toBe(first.orderId);
    expect(await orderCount(A)).toBe(1);
    expect(await stock(p.id)).toBe(4);
    expect(await cartCount(A)).toBe(1); // nowy koszyk nietknięty
  });

  it("równoległe dwa żądania z tym samym kluczem → jedno zamówienie, jeden zjazd stanu", async () => {
    const p = await makeProduct(5);
    await putInCart(A, p.id, 2);
    const [r1, r2] = await Promise.all([checkout(A, "par-key"), checkout(A, "par-key")]);
    expect(r1.orderId).toBe(r2.orderId);
    expect([r1.replayed, r2.replayed].filter(Boolean)).toHaveLength(1);
    expect(await orderCount(A)).toBe(1);
    expect(await stock(p.id)).toBe(3);
  });

  it("ten sam klucz u innego użytkownika to inne żądanie", async () => {
    const p = await makeProduct(5);
    await putInCart(A, p.id, 1);
    await putInCart(B, p.id, 1);
    const a = await checkout(A, "shared");
    const b = await checkout(B, "shared");
    expect(a.orderId).not.toBe(b.orderId);
  });

  it("baza odrzuca duplikat (userId, requestKey) w surowym SQL, a wiele NULL jest dozwolonych", async () => {
    await prisma.order.create({ data: { number: "RAW-1", userId: A, requestKey: "dup", totalCents: 0n } });
    await expect(
      prisma.order.create({ data: { number: "RAW-2", userId: A, requestKey: "dup", totalCents: 0n } }),
    ).rejects.toThrow();
    await prisma.order.create({ data: { number: "RAW-3", userId: A, totalCents: 0n } });
    await prisma.order.create({ data: { number: "RAW-4", userId: A, totalCents: 0n } });
    await expect(
      prisma.$executeRawUnsafe(`update orders set "requestKey" = '' where number = 'RAW-3'`),
    ).rejects.toThrow(/order_request_key_not_empty/);
  });
});

describe("checkout – współbieżność z koszykiem", () => {
  it("checkout i równoległe usunięcie pozycji: zamówienie zgodne z końcowym stanem koszyka", async () => {
    const p = await makeProduct(5);
    await putInCart(A, p.id, 2);
    const item = await prisma.cartItem.findFirstOrThrow({ where: { cart: { userId: A } } });
    const { removeItem } = await import("@/lib/cart/cart-repository");
    const res = await Promise.allSettled([checkout(A, "cr-1"), removeItem(A, item.id)]);
    const ordered = (await orderCount(A)) === 1;
    // albo kupione (i stan zmniejszony), albo usunięte przed zakupem (EMPTY_CART, stan nietknięty)
    expect(await stock(p.id)).toBe(ordered ? 3 : 5);
    expect(await cartCount(A)).toBe(0);
    if (!ordered) {
      expect((res[0] as PromiseRejectedResult).reason.code).toBe("EMPTY_CART");
    }
  });
});
