import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { migrateDeploy, migrateDiff, recreateDatabase, scratchUrl } from "./db";

const url = scratchUrl(process.env.TEST_DATABASE_URL!);
let c: Client;

const q = async <T = Record<string, unknown>>(sql: string) => (await c.query(sql)).rows as T[];

describe("migracje na pustej bazie", () => {
  beforeAll(async () => {
    await recreateDatabase(url); // zupełnie pusta baza, bez seeda
    migrateDeploy(url);
    c = new Client({ connectionString: url });
    await c.connect();
  });
  afterAll(async () => {
    await c?.end();
  });

  it("tworzy tabele i zapisuje historię migracji", async () => {
    const tables = (
      await q<{ table_name: string }>(
        "select table_name from information_schema.tables where table_schema='public'",
      )
    ).map((r) => r.table_name);
    expect(tables).toEqual(expect.arrayContaining(["categories", "products", "user", "carts", "cart_items", "orders", "order_items", "_prisma_migrations"]));
    expect((await q<{ n: string }>("select count(*) n from _prisma_migrations where finished_at is not null"))[0].n).not.toBe("0");
  });

  it("odtwarza ograniczenia CHECK, UNIQUE i FK", async () => {
    const cons = (await q<{ conname: string }>("select conname from pg_constraint")).map((r) => r.conname);
    expect(cons).toEqual(
      expect.arrayContaining([
        "product_id_positive",
        "product_price_nonnegative",
        "product_amount_nonnegative",
        "products_categoryId_fkey",
        "cart_item_quantity_range",
        "order_item_quantity_positive",
        "order_item_unit_price_nonnegative",
        "order_total_nonnegative",
      ]),
    );
    const idx = (await q<{ indexname: string }>("select indexname from pg_indexes where schemaname='public'")).map((r) => r.indexname);
    expect(idx).toEqual(
      expect.arrayContaining(["categories_code_key", "products_code_key", "products_date_id_idx", "products_nameSortKey_id_idx", "user_email_key", "carts_userId_key", "cart_items_cartId_productId_key", "orders_number_key", "order_items_orderId_productId_key"]),
    );
  });

  it("odtwarza typ daty z milisekundami i kolację C klucza nazwy", async () => {
    const cols = await q<{ column_name: string; datetime_precision: number | null; collation_name: string | null }>(
      "select column_name, datetime_precision, collation_name from information_schema.columns where table_name='products'",
    );
    const by = Object.fromEntries(cols.map((r) => [r.column_name, r]));
    expect(by.date.datetime_precision).toBe(3);
    expect(by.nameSortKey.collation_name).toBe("C");
  });

  it("schema.prisma zgadza się ze stanem bazy po samych migracjach", () => {
    expect(() => migrateDiff(url)).not.toThrow(); // exit 2 = różnica
  });

  it("ponowne migrate deploy nic nie zmienia", () => {
    expect(migrateDeploy(url)).toMatch(/No pending migrations/i);
  });
});
