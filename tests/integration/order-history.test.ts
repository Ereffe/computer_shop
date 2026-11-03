/**
 * Historia zamówień użytkownika (lib/orders/order-repository.ts).
 * Fixture z seeda: fixture-ada (2 zamówienia), fixture-bob (2), demo-user (4).
 */
import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getMyOrder, listMyOrders } from "@/lib/orders/order-repository";
import { formatPln } from "@/lib/orders/format";
import { resetAndSeed, TEST_URL } from "./helpers";

const ADA = "fixture-ada";
const BOB = "fixture-bob";

beforeAll(resetAndSeed);

const idOf = async (number: string) => (await prisma.order.findUniqueOrThrow({ where: { number } })).id;

describe("lista zamówień", () => {
  it("zawiera wyłącznie zamówienia właściciela, od najnowszego", async () => {
    const ada = await listMyOrders(ADA);
    expect(ada.map((o) => o.number)).toEqual(["ORD-ADA-0002", "ORD-ADA-0001"]);
    const bob = await listMyOrders(BOB);
    expect(bob.map((o) => o.number)).toEqual(["ORD-BOB-0002", "ORD-BOB-0001"]);
  });

  it("użytkownik bez zamówień dostaje pustą listę", async () => {
    expect(await listMyOrders("nobody")).toEqual([]);
  });

  it("wartości pochodzą ze snapshotu: suma i wartość pozycji w dokładnych groszach", async () => {
    for (const o of await listMyOrders(ADA)) {
      const sum = o.items.reduce((s, i) => s + BigInt(i.lineTotalCents), 0n);
      expect(o.totalCents).toBe(sum.toString());
      for (const i of o.items) {
        expect(i.lineTotalCents).toBe((BigInt(i.quantity) * BigInt(i.unitPriceCents)).toString());
      }
    }
  });
});

describe("podmiana ID na zamówienie B", () => {
  it("właściciel widzi swoje zamówienie", async () => {
    const id = String(await idOf("ORD-ADA-0001"));
    expect((await getMyOrder(ADA, id))?.number).toBe("ORD-ADA-0001");
  });

  it("Ada nie odczyta zamówienia Boba po podmienionym ID – wynik taki sam jak dla nieistniejącego", async () => {
    const bobsId = String(await idOf("ORD-BOB-0001"));
    expect(await getMyOrder(ADA, bobsId)).toBeNull();
    expect(await getMyOrder(ADA, "999999")).toBeNull();
  });

  it("symetrycznie: Bob nie odczyta zamówienia Ady", async () => {
    expect(await getMyOrder(BOB, String(await idOf("ORD-ADA-0002")))).toBeNull();
  });

  it.each(["0", "-1", "1.5", "1e3", "abc", "", " 1", "01", "2147483648", "99999999999", "1; drop table orders"])(
    "odrzuca nieprawidłowe ID %j",
    async (raw) => {
      expect(await getMyOrder(ADA, raw)).toBeNull();
    },
  );

  it.each([1, null, undefined, {}, ["1"]])("odrzuca ID niebędące stringiem: %j", async (raw) => {
    expect(await getMyOrder(ADA, raw)).toBeNull();
  });
});

describe("niezmienność historii", () => {
  it("zmiana ceny i nazwy produktu nie zmienia zamówienia", async () => {
    const before = await listMyOrders(ADA);
    const productIds = (
      await prisma.orderItem.findMany({ where: { order: { userId: ADA } }, select: { productId: true } })
    ).map((i) => i.productId!);

    await prisma.product.updateMany({ where: { id: { in: productIds } }, data: { price: { increment: 12_345 } } });
    await prisma.product.update({ where: { id: productIds[0] }, data: { name: "Całkiem inna nazwa" } });

    expect(await listMyOrders(ADA)).toEqual(before);
  });

  it("usunięcie produktu (SetNull) zeruje productId, ale historia pozostaje identyczna", async () => {
    const before = await listMyOrders(BOB);
    const item = await prisma.orderItem.findFirstOrThrow({ where: { order: { userId: BOB } } });
    const productId = item.productId!;

    await prisma.product.delete({ where: { id: productId } });

    const raw = await prisma.orderItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(raw.productId).toBeNull();
    expect([raw.productCode, raw.productName, raw.quantity, raw.unitPriceCents]).toEqual([
      item.productCode,
      item.productName,
      item.quantity,
      item.unitPriceCents,
    ]);
    expect(await listMyOrders(BOB)).toEqual(before);
    expect((await getMyOrder(BOB, String(before[0].id)))?.items).toEqual(before[0].items);
  });

  it("usunięcie konta z zamówieniami jest zablokowane (Restrict)", async () => {
    await expect(prisma.user.delete({ where: { id: ADA } })).rejects.toThrow();
  });
});

describe("formatowanie kwot", () => {
  it.each([
    ["0", "0,00\u00a0zł"],
    ["5", "0,05\u00a0zł"],
    ["123456", "1\u00a0234,56\u00a0zł"],
    ["198000000000", "1\u00a0980\u00a0000\u00a0000,00\u00a0zł"],
    ["9007199254740993", "90\u00a0071\u00a0992\u00a0547\u00a0409,93\u00a0zł"], // powyżej 2^53 – bez utraty groszy
  ])("%s gr", (cents, expected) => {
    expect(formatPln(cents)).toBe(expected);
  });
});

describe("skrypt powiązania fixture z kontami auth", () => {
  const run = (...args: string[]) =>
    execFileSync("npx", ["--no-install", "tsx", "scripts/link-fixture-orders.ts", ...args], {
      env: { ...process.env, DATABASE_URL: TEST_URL },
      encoding: "utf8",
      stdio: "pipe",
    });

  const runFails = (...args: string[]) => {
    try {
      run(...args);
    } catch (e) {
      return String((e as { stderr?: string }).stderr);
    }
    throw new Error("skrypt powinien się nie powieść");
  };

  it("przepina zamówienia A i B na konta auth, odrzuca fixture'y i nieistniejące konta, a --reset przywraca stan", async () => {
    // Konta „auth” = użytkownik + wiersz w account (tak tworzy je Better Auth)
    for (const [id, email] of [["auth-1", "one@example.test"], ["auth-2", "two@example.test"]]) {
      await prisma.user.create({
        data: {
          id,
          name: id,
          email,
          emailVerified: true,
          accounts: { create: { id: `acc-${id}`, accountId: id, providerId: "github" } },
        },
      });
    }

    expect(runFails("--a", "nikt@example.test", "--b", "two@example.test")).toMatch(/Brak użytkownika/);
    expect(runFails("--a", "ada.fixture@example.test", "--b", "two@example.test")).toMatch(/konto fixture/);
    expect(runFails("--a", "one@example.test", "--b", "one@example.test")).toMatch(/różne/);
    expect(await prisma.order.count({ where: { userId: "auth-1" } })).toBe(0); // nic nie przepięto

    run("--a", "one@example.test", "--b", "two@example.test");
    expect((await listMyOrders("auth-1")).map((o) => o.number)).toEqual(["ORD-ADA-0002", "ORD-ADA-0001"]);
    expect((await listMyOrders("auth-2")).map((o) => o.number)).toEqual(["ORD-BOB-0002", "ORD-BOB-0001"]);
    // po przepięciu auth-1 nie widzi zamówień auth-2 po podmienionym ID
    expect(await getMyOrder("auth-1", String(await idOf("ORD-BOB-0001")))).toBeNull();

    run("--reset");
    expect((await listMyOrders(ADA)).length).toBe(2);
    expect(await listMyOrders("auth-1")).toEqual([]);
  });
});
