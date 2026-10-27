import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetAndSeed } from "./helpers";

const NUMBERS = ["ORD-2026-0001", "ORD-2026-0002", "ORD-2026-0003", "ORD-2026-0004"];

const loadOrders = () =>
  prisma.order.findMany({
    orderBy: { number: "asc" },
    include: { items: { orderBy: { productId: "asc" } } },
  });

const sum = (o: Awaited<ReturnType<typeof loadOrders>>[number]) =>
  o.items.reduce((s, i) => s + BigInt(i.quantity) * BigInt(i.unitPriceCents), 0n);

describe("historia zamówień", () => {
  beforeAll(resetAndSeed);

  it("seed tworzy cztery deterministyczne zamówienia, a drugi seed ich nie dubluje", async () => {
    const first = await loadOrders();
    expect(first.map((o) => o.number)).toEqual(NUMBERS);
    expect(first.map((o) => o.status)).toEqual(["PAID", "PENDING", "SHIPPED", "CANCELLED"]);
    expect(first.map((o) => o.items.length)).toEqual([2, 1, 3, 2]);
    expect(first[2].createdAt.toISOString()).toBe("2026-10-03T12:15:00.500Z");

    const { seed } = await import("./db");
    seed(process.env.TEST_DATABASE_URL!);
    expect(await loadOrders()).toEqual(first);
  });

  it("suma zamówienia = Σ ilość × cena jednostkowa (w groszach)", async () => {
    for (const o of await loadOrders()) expect(o.totalCents).toBe(sum(o));
  });

  it("pozycja ma kopię nazwy, kodu i ceny produktu", async () => {
    const o = (await loadOrders())[0];
    for (const i of o.items) {
      const p = await prisma.product.findUniqueOrThrow({ where: { id: i.productId } });
      expect([i.productCode, i.productName, i.unitPriceCents]).toEqual([p.code, p.name, p.price]);
    }
  });

  it("zmiana aktualnej ceny, nazwy i kodu produktu nie zmienia zamówień", async () => {
    const before = await loadOrders();
    const ids = [...new Set(before.flatMap((o) => o.items.map((i) => i.productId)))];

    await prisma.product.updateMany({ where: { id: { in: ids } }, data: { price: { increment: 99_999 } } });
    await prisma.product.update({ where: { id: 1 }, data: { name: "Zmieniona nazwa", code: "ZMIENIONY1" } });

    const after = await loadOrders();
    expect(after).toEqual(before);
    expect(after.map((o) => o.totalCents)).toEqual(before.map((o) => o.totalCents));
    expect((await prisma.product.findUniqueOrThrow({ where: { id: 2 } })).price).not.toBe(
      before[0].items.find((i) => i.productId === 2)!.unitPriceCents,
    );
  });

  it("usunięcie produktu z historią jest zablokowane (Restrict), historia zostaje", async () => {
    await expect(prisma.product.delete({ where: { id: 3 } })).rejects.toThrow();
    expect(await prisma.orderItem.count({ where: { productId: 3 } })).toBe(1);
    // produkt bez zamówień można usunąć
    await expect(prisma.product.delete({ where: { id: 100 } })).resolves.toBeDefined();
  });

  it("usunięcie użytkownika z zamówieniami jest zablokowane", async () => {
    await expect(prisma.user.delete({ where: { id: "demo-user" } })).rejects.toThrow();
    expect(await prisma.order.count()).toBe(4);
  });

  it("numer zamówienia jest unikalny", async () => {
    await expect(
      prisma.order.create({ data: { number: NUMBERS[0], userId: "demo-user", totalCents: 0n } }),
    ).rejects.toThrow();
  });

  it("status spoza listy jest odrzucany przez bazę", async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `insert into orders (number, "userId", status, "totalCents") values ('X-1','demo-user','LOST',0)`,
      ),
    ).rejects.toThrow(/OrderStatus|invalid input value/);
  });

  describe("CHECK na pozycji i sumie (także w surowym SQL)", () => {
    const ins = (q: number, p: number) =>
      prisma.$executeRawUnsafe(
        `insert into order_items ("orderId","productId","productCode","productName",quantity,"unitPriceCents")
         values (1, 50, 'C', 'N', ${q}, ${p})`,
      );
    it.each([0, -1])("ilość %i", async (q) => {
      await expect(ins(q, 100)).rejects.toThrow(/order_item_quantity_positive/);
    });
    it("ujemna cena jednostkowa", async () => {
      await expect(ins(1, -1)).rejects.toThrow(/order_item_unit_price_nonnegative/);
    });
    it("ujemna suma", async () => {
      await expect(
        prisma.$executeRawUnsafe(`update orders set "totalCents" = -1 where id = 1`),
      ).rejects.toThrow(/order_total_nonnegative/);
    });
    it("zero jako cena jest dozwolone", async () => {
      await expect(ins(1, 0)).resolves.toBe(1);
    });
  });

  it("suma przekraczająca zakres Int32 mieści się w BigInt", async () => {
    const big = 99n * 2_000_000_000n; // 99 szt. × 20 mln zł
    const o = await prisma.order.create({
      data: {
        number: "ORD-BIG",
        userId: "demo-user",
        totalCents: big,
        items: {
          create: {
            productId: 60,
            productCode: "C",
            productName: "N",
            quantity: 99,
            unitPriceCents: 2_000_000_000,
          },
        },
      },
      include: { items: true },
    });
    expect(o.totalCents).toBe(big);
    expect(big > 2n ** 31n).toBe(true);
    expect(o.items[0].unitPriceCents).toBe(2_000_000_000);
    // cena jednostkowa powyżej Int32 jest odrzucana
    await expect(
      prisma.orderItem.create({
        data: { orderId: o.id, productId: 61, productCode: "C", productName: "N", quantity: 1, unitPriceCents: 2_147_483_648 },
      }),
    ).rejects.toThrow();
  });
});
