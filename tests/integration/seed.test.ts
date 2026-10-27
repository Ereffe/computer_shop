import { beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { seed, truncateAll } from "./db";
import { fixture, TEST_URL } from "./helpers";

async function snapshot() {
  const c = new Client({ connectionString: TEST_URL });
  await c.connect();
  try {
    const cats = (await c.query("select id, code, name from categories order by id")).rows;
    const prods = (
      await c.query(
        `select id, code, name, "nameSortKey", description, image, price, amount,
                to_char(date at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') date, "categoryId"
         from products order by id`,
      )
    ).rows;
    return { cats, prods };
  } finally {
    await c.end();
  }
}

describe("dwukrotny seed", () => {
  let first: Awaited<ReturnType<typeof snapshot>>;
  let second: Awaited<ReturnType<typeof snapshot>>;

  beforeAll(async () => {
    await truncateAll(TEST_URL);
    seed(TEST_URL);
    first = await snapshot();
    seed(TEST_URL);
    second = await snapshot();
  });

  it("daje cztery kategorie i 100 produktów", () => {
    expect(second.cats.map((r) => r.code).sort()).toEqual(["cpu", "disk", "gpu", "ram"]);
    expect(second.prods).toHaveLength(100);
  });

  it("nie tworzy duplikatów", () => {
    expect(new Set(second.prods.map((p) => p.code)).size).toBe(100);
    expect(new Set(second.prods.map((p) => p.id)).size).toBe(100);
  });

  it("zachowuje ID i wartości między uruchomieniami", () => {
    expect(second).toEqual(first);
  });

  it("ID i wartości odpowiadają data/products.json", () => {
    const codeById = Object.fromEntries(second.cats.map((c) => [c.id, c.code]));
    const rows = second.prods.map((p) => ({
      id: p.id, code: p.code, name: p.name, type: codeById[p.categoryId], price: p.price,
      amount: p.amount, description: p.description, date: p.date, image: p.image,
    }));
    expect(rows).toEqual(fixture());
  });
});
