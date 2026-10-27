import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";
import { getProductById, getProducts } from "@/lib/products/product-repository";
import { resetAndSeed, TEST_URL } from "./helpers";

const base = {
  code: "TESTCODE01",
  name: "Test",
  nameSortKey: "test",
  description: "d",
  image: "/images/products/cpu.webp",
  price: 100,
  amount: 1,
  date: new Date("2026-01-01T00:00:00.123Z"),
};

describe("zapis i ograniczenia", () => {
  let categoryId: number;
  beforeAll(async () => {
    await resetAndSeed();
    categoryId = (await prisma.category.findUniqueOrThrow({ where: { code: "cpu" } })).id;
  });
  beforeEach(async () => {
    await prisma.product.deleteMany({ where: { code: { startsWith: "TESTCODE" } } });
  });

  it("poprawna zmiana jest trwała", async () => {
    const before = (await getProductById(1))!;
    await prisma.product.update({ where: { id: 1 }, data: { amount: before.amount + 7, price: 4242 } });
    expect(await getProductById(1)).toEqual({ ...before, amount: before.amount + 7, price: 4242 });
    expect((await getProducts()).find((p) => p.id === 1)?.price).toBe(4242);
  });

  describe("baza odrzuca naruszenia także przy pominięciu walidatora (Prisma bez zod)", () => {
    it("ujemna ilość", async () => {
      await expect(prisma.product.update({ where: { id: 2 }, data: { amount: -1 } })).rejects.toThrow();
      await expect(prisma.product.create({ data: { ...base, amount: -1, categoryId } })).rejects.toThrow();
    });
    it("ujemna cena", async () => {
      await expect(prisma.product.update({ where: { id: 2 }, data: { price: -1 } })).rejects.toThrow();
    });
    it("duplikat kodu", async () => {
      const existing = await prisma.product.findUniqueOrThrow({ where: { id: 3 } });
      await expect(
        prisma.product.create({ data: { ...base, code: existing.code, categoryId } }),
      ).rejects.toThrow();
    });
    it("nieistniejąca kategoria", async () => {
      await expect(prisma.product.create({ data: { ...base, categoryId: 999999 } })).rejects.toThrow();
    });
  });

  describe("baza odrzuca naruszenia w surowym SQL", () => {
    let c: Client;
    beforeAll(async () => {
      c = new Client({ connectionString: TEST_URL });
      await c.connect();
      return () => c.end();
    });
    const insert = (over: Record<string, unknown>) => {
      const v = { ...base, categoryId, ...over } as typeof base & { categoryId: number; id?: number };
      return c.query(
        `insert into products (id, code, name, "nameSortKey", description, image, price, amount, date, "categoryId")
         values (coalesce($1, nextval(pg_get_serial_sequence('products','id'))), $2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [v.id ?? null, v.code, v.name, v.nameSortKey, v.description, v.image, v.price, v.amount, v.date, v.categoryId],
      );
    };
    it.each([
      ["amount", { amount: -1 }, /product_amount_nonnegative/],
      ["price", { price: -1 }, /product_price_nonnegative/],
      ["id", { id: 0 }, /product_id_positive/],
      ["kategoria", { categoryId: 999999 }, /products_categoryId_fkey/],
    ])("ujemne/nieprawidłowe: %s", async (_n, over, re) => {
      await expect(insert({ code: "TESTCODE02", ...over })).rejects.toThrow(re);
    });
    it("duplikat kodu", async () => {
      const { code } = (await c.query("select code from products where id=4")).rows[0];
      await expect(insert({ code })).rejects.toThrow(/products_code_key/);
    });
    it("UPDATE do ujemnej wartości", async () => {
      await expect(c.query("update products set amount=-5 where id=5")).rejects.toThrow(/product_amount_nonnegative/);
    });
  });
});
