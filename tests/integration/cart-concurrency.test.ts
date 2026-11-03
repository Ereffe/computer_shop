/**
 * Zapis współbieżny do koszyka – dwie sesje (dwa „urządzenia”) tego samego użytkownika.
 *
 * POLITYKA KONFLIKTU (wymusza ją blokada wiersza koszyka: SELECT … FOR UPDATE w cart-repository):
 *   add + add          → ilości się sumują (w granicach stanu i limitu 99); nadmiar → QUANTITY_EXCEEDS_STOCK
 *   set + set          → wygrywa ostatni zatwierdzony zapis; obie operacje kończą się sukcesem
 *   set/add + remove   → pozycja zostaje usunięta; set po remove nigdy jej nie odtwarza (ITEM_NOT_FOUND)
 *   add + set          → wynik zależy od kolejności, ale zawsze jeden wiersz, 1..99, ≤ stan
 * Błędem nie jest nic poza CartError – żadnych wyjątków bazy (unikalność, deadlock, serializacja).
 *
 * DLACZEGO BLOKADA PRZYCISKU NIE WYSTARCZA:
 *   `disabled={pending}` działa w pamięci jednej karty jednej przeglądarki. Druga karta, drugie
 *   urządzenie, retry sieciowy, zapytanie wprost do API (curl) albo ponowna wysyłka po utracie
 *   odpowiedzi w ogóle go nie widzą. To ochrona UX (mniej przypadkowych podwójnych kliknięć),
 *   nie gwarancja spójności – tę może dać tylko serwer/baza, bo tylko one widzą wszystkie żądania.
 *   Testy poniżej omijają UI całkowicie i pokazują, że poprawność trzyma się na transakcji + blokadzie.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { serializeSignedCookie } from "better-call";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  addProduct,
  getMyCart,
  removeItem,
  setQuantity,
  CartError,
} from "@/lib/cart/cart-repository";
import { resetAndSeed } from "./helpers";

const ALICE = "conc-alice";
const BOB = "conc-bob";

// ── Sesje: tożsamość zawsze z sesji, jak w server actions ─────────

async function newDevice(userId: string) {
  const ctx = await auth.$context;
  const s = await ctx.internalAdapter.createSession(userId);
  const signed = await serializeSignedCookie(ctx.authCookies.sessionToken.name, s.token, ctx.secret);
  return signed.split(";")[0];
}

async function userIdFromSession(cookie: string): Promise<string> {
  const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
  if (!session) throw new Error("sesja nieprawidłowa");
  return session.user.id;
}

/** Dwa niezależne „urządzenia” tego samego użytkownika. */
async function twoSessions(userId: string) {
  const [c1, c2] = [await newDevice(userId), await newDevice(userId)];
  const [u1, u2] = [await userIdFromSession(c1), await userIdFromSession(c2)];
  expect(u1).toBe(userId);
  expect(u2).toBe(userId);
  return [u1, u2] as const;
}

// ── Fixture ───────────────────────────────────────────────────────

let seq = 0;
async function makeProduct(amount: number) {
  const cat = await prisma.category.findUniqueOrThrow({ where: { code: "cpu" } });
  return prisma.product.create({
    data: {
      code: `CC${String(Date.now()).slice(-6)}${seq++ % 100}`.slice(0, 10),
      name: "Concurrency Product",
      nameSortKey: "concurrency product",
      description: "cart concurrency tests",
      image: "/images/products/cpu.webp",
      price: 100,
      amount,
      date: new Date("2026-01-01T00:00:00Z"),
      categoryId: cat.id,
    },
  });
}

const dbItems = (userId: string) =>
  prisma.cartItem.findMany({ where: { cart: { userId } }, orderBy: { id: "asc" } });

/** Niezmienniki, które muszą zachodzić po KAŻDYM scenariuszu. */
async function assertInvariants(userId: string) {
  expect(await prisma.cart.count({ where: { userId } })).toBeLessThanOrEqual(1);
  const items = await prisma.cartItem.findMany({
    where: { cart: { userId } },
    include: { product: true },
  });
  const keys = items.map((i) => `${i.cartId}:${i.productId}`);
  expect(new Set(keys).size).toBe(keys.length); // unikalność (cartId, productId)
  for (const i of items) {
    expect(i.quantity).toBeGreaterThanOrEqual(1);
    expect(i.quantity).toBeLessThanOrEqual(99);
  }
}

/** Wszystko poza CartError to błąd współbieżności (np. P2002, deadlock) – test ma na nim pasć. */
function expectOnlyCartErrors(results: PromiseSettledResult<unknown>[]) {
  for (const r of results) {
    if (r.status === "rejected") expect(r.reason).toBeInstanceOf(CartError);
  }
}

beforeAll(async () => {
  await resetAndSeed();
  for (const id of [ALICE, BOB]) {
    await prisma.user.create({
      data: { id, name: id, email: `${id}@example.test`, emailVerified: true },
    });
  }
});

beforeEach(async () => {
  await prisma.cart.deleteMany({ where: { userId: { in: [ALICE, BOB] } } });
});

const ROUNDS = 15;

// ── add + add ─────────────────────────────────────────────────────

describe("addProduct ∥ addProduct", () => {
  it("pierwsze w życiu dodania z dwóch sesji naraz: jeden koszyk, jedna pozycja, ilość = liczba żądań", async () => {
    for (let round = 0; round < ROUNDS; round++) {
      await prisma.cart.deleteMany({ where: { userId: ALICE } }); // za każdym razem brak wiersza koszyka
      const p = await makeProduct(50);
      const [s1, s2] = await twoSessions(ALICE);

      const results = await Promise.allSettled([
        addProduct(s1, p.id), addProduct(s2, p.id), addProduct(s1, p.id), addProduct(s2, p.id),
        addProduct(s1, p.id), addProduct(s2, p.id), addProduct(s1, p.id), addProduct(s2, p.id),
      ]);

      expect(results.every((r) => r.status === "fulfilled")).toBe(true);
      const items = await dbItems(ALICE);
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(8);
      expect(await prisma.cart.count({ where: { userId: ALICE } })).toBe(1);
      await assertInvariants(ALICE);

      await prisma.cart.deleteMany({ where: { userId: ALICE } });
      await prisma.product.delete({ where: { id: p.id } });
    }
  });

  it("stan = 3, dwie sesje po 4 dodania: dokładnie 3 sukcesy, reszta QUANTITY_EXCEEDS_STOCK", async () => {
    const p = await makeProduct(3);
    const [s1, s2] = await twoSessions(ALICE);

    const results = await Promise.allSettled([
      ...Array.from({ length: 4 }, () => addProduct(s1, p.id)),
      ...Array.from({ length: 4 }, () => addProduct(s2, p.id)),
    ]);

    expectOnlyCartErrors(results);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    for (const r of results) {
      if (r.status === "rejected") expect((r.reason as CartError).code).toBe("QUANTITY_EXCEEDS_STOCK");
    }
    expect((await dbItems(ALICE))[0].quantity).toBe(3);
    await assertInvariants(ALICE);
  });
});

// ── set + set ─────────────────────────────────────────────────────

describe("setQuantity ∥ setQuantity", () => {
  it("dwie sesje ustawiają różne ilości: obie się udają, wynik = jedna z wartości, jedna pozycja", async () => {
    const p = await makeProduct(50);
    const [s1, s2] = await twoSessions(ALICE);
    await addProduct(s1, p.id);
    const itemId = (await dbItems(ALICE))[0].id;
    const seen = new Set<number>();

    for (let round = 0; round < ROUNDS; round++) {
      const results = await Promise.allSettled([setQuantity(s1, itemId, 3), setQuantity(s2, itemId, 7)]);
      expect(results.every((r) => r.status === "fulfilled")).toBe(true); // brak błędów konfliktu
      const items = await dbItems(ALICE);
      expect(items).toHaveLength(1);
      expect([3, 7]).toContain(items[0].quantity); // „ostatni zapis wygrywa”, żadna wartość pośrednia
      seen.add(items[0].quantity);
      await assertInvariants(ALICE);
    }
    expect(seen.size).toBeGreaterThan(0);
  });

  it("zapis ponad stan przegrywa deterministycznie, nie psuje wyniku drugiego", async () => {
    const p = await makeProduct(5);
    const [s1, s2] = await twoSessions(ALICE);
    await addProduct(s1, p.id);
    const itemId = (await dbItems(ALICE))[0].id;

    const results = await Promise.allSettled([setQuantity(s1, itemId, 99), setQuantity(s2, itemId, 4)]);
    expectOnlyCartErrors(results);
    expect(results[0].status).toBe("rejected");
    expect((results[0] as PromiseRejectedResult).reason.code).toBe("QUANTITY_EXCEEDS_STOCK");
    expect(results[1].status).toBe("fulfilled");
    expect((await dbItems(ALICE))[0].quantity).toBe(4);
  });
});

// ── set + remove ──────────────────────────────────────────────────

describe("setQuantity ∥ removeItem", () => {
  it("zmiana ilości w jednej sesji i usunięcie w drugiej: pozycja znika, set nie odtwarza jej", async () => {
    let setLost = 0;
    let setWon = 0;
    for (let round = 0; round < ROUNDS; round++) {
      await prisma.cart.deleteMany({ where: { userId: ALICE } });
      const p = await makeProduct(50);
      const [s1, s2] = await twoSessions(ALICE);
      await addProduct(s1, p.id);
      await addProduct(s1, p.id);
      const itemId = (await dbItems(ALICE))[0].id;

      const [setRes, rmRes] = await Promise.allSettled([setQuantity(s1, itemId, 9), removeItem(s2, itemId)]);

      expect(rmRes.status).toBe("fulfilled"); // remove zawsze się udaje (pozycja istniała)
      if (setRes.status === "rejected") {
        expect(setRes.reason).toBeInstanceOf(CartError);
        expect(setRes.reason.code).toBe("ITEM_NOT_FOUND"); // set po remove
        setLost++;
      } else {
        setWon++; // set przed remove – zapis zniknął razem z pozycją
      }
      expect(await dbItems(ALICE)).toHaveLength(0); // niezależnie od kolejności
      await assertInvariants(ALICE);
      await prisma.product.delete({ where: { id: p.id } });
    }
    expect(setLost + setWon).toBe(ROUNDS);
  });

  it("set po zatwierdzonym remove daje ITEM_NOT_FOUND i nie tworzy wiersza", async () => {
    const p = await makeProduct(10);
    const [s1, s2] = await twoSessions(ALICE);
    await addProduct(s1, p.id);
    const itemId = (await dbItems(ALICE))[0].id;

    await removeItem(s2, itemId);
    await expect(setQuantity(s1, itemId, 5)).rejects.toMatchObject({ code: "ITEM_NOT_FOUND" });
    expect(await dbItems(ALICE)).toHaveLength(0);
  });

  it("dwa równoległe usunięcia tej samej pozycji: jedno OK, drugie ITEM_NOT_FOUND (bez błędu bazy)", async () => {
    const p = await makeProduct(10);
    const [s1, s2] = await twoSessions(ALICE);
    await addProduct(s1, p.id);
    const itemId = (await dbItems(ALICE))[0].id;

    const results = await Promise.allSettled([removeItem(s1, itemId), removeItem(s2, itemId)]);
    expectOnlyCartErrors(results);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason as CartError).code).toBe(
      "ITEM_NOT_FOUND",
    );
  });
});

// ── add + set / add + remove ──────────────────────────────────────

describe("addProduct ∥ setQuantity / removeItem", () => {
  it("add + set: zawsze jedna pozycja; ilość to 5 (set po add) albo 6 (add po set), nigdy inna", async () => {
    const p = await makeProduct(50);
    const [s1, s2] = await twoSessions(ALICE);
    await addProduct(s1, p.id);
    const itemId = (await dbItems(ALICE))[0].id;

    for (let round = 0; round < ROUNDS; round++) {
      const results = await Promise.allSettled([addProduct(s1, p.id), setQuantity(s2, itemId, 5)]);
      expect(results.every((r) => r.status === "fulfilled")).toBe(true);
      const items = await dbItems(ALICE);
      expect(items).toHaveLength(1);
      expect([5, 6]).toContain(items[0].quantity);
      await assertInvariants(ALICE);
      await setQuantity(s1, itemId, 1); // reset do następnej rundy
    }
  });

  it("add + remove: pozycji nie ma (add przed remove) albo jest z ilością 1 (remove przed add)", async () => {
    const p = await makeProduct(50);
    const [s1, s2] = await twoSessions(ALICE);

    for (let round = 0; round < ROUNDS; round++) {
      await addProduct(s1, p.id);
      const itemId = (await dbItems(ALICE))[0].id;

      const results = await Promise.allSettled([addProduct(s1, p.id), removeItem(s2, itemId)]);
      expect(results.every((r) => r.status === "fulfilled")).toBe(true);
      const items = await dbItems(ALICE);
      expect(items.length).toBeLessThanOrEqual(1); // nigdy duplikatu
      if (items.length === 1) expect(items[0].quantity).toBe(1);
      await assertInvariants(ALICE);
      await prisma.cart.deleteMany({ where: { userId: ALICE } });
    }
  });
});

// ── izolacja użytkowników i test obciążeniowy ─────────────────────

describe("izolacja i obciążenie", () => {
  it("blokada koszyka Alice nie zakleszcza ani nie blokuje koszyka Boba", async () => {
    const p = await makeProduct(100);
    const [a1, a2] = await twoSessions(ALICE);
    const [b1, b2] = await twoSessions(BOB);

    const results = await Promise.allSettled([
      addProduct(a1, p.id), addProduct(a2, p.id), addProduct(b1, p.id), addProduct(b2, p.id),
    ]);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect((await dbItems(ALICE))[0].quantity).toBe(2);
    expect((await dbItems(BOB))[0].quantity).toBe(2);
  });

  it("mieszane operacje z dwóch sesji (add/set/remove): niezmienniki zachowane, wyjątki wyłącznie CartError", async () => {
    const p1 = await makeProduct(20);
    const p2 = await makeProduct(20);
    const [s1, s2] = await twoSessions(ALICE);
    await addProduct(s1, p1.id);
    await addProduct(s1, p2.id);

    for (let round = 0; round < ROUNDS; round++) {
      const items = await dbItems(ALICE);
      const id = (i: number) => items[i % Math.max(items.length, 1)]?.id ?? 1;
      const results = await Promise.allSettled([
        addProduct(s1, p1.id),
        addProduct(s2, p2.id),
        setQuantity(s1, id(0), 4),
        setQuantity(s2, id(1), 8),
        removeItem(s1, id(round)),
        removeItem(s2, id(round + 1)),
        addProduct(s2, p1.id),
      ]);
      expectOnlyCartErrors(results);
      await assertInvariants(ALICE);
      // to samo widzi odczyt przez repozytorium (ten sam widok z obu sesji)
      expect(await getMyCart(s1)).toEqual(await getMyCart(s2));
    }
  });
});
