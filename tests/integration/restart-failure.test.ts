import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { dbName, withDb } from "./db";
import { resetAndSeed, TEST_URL } from "./helpers";

type Globals = { prisma?: { $disconnect(): Promise<void> } };
const g = globalThis as unknown as Globals;

/** "Restart aplikacji": nowy proces = nowy moduł lib/prisma i nowa pula połączeń. */
async function freshApp(url: string) {
  await g.prisma?.$disconnect();
  g.prisma = undefined;
  vi.resetModules();
  process.env.DATABASE_URL = url;
  return import("@/lib/products/product-repository");
}

describe("restart i awaria bazy", () => {
  beforeAll(resetAndSeed);
  afterAll(async () => {
    await g.prisma?.$disconnect();
    g.prisma = undefined;
    process.env.DATABASE_URL = TEST_URL;
  });

  it("zmiana widoczna na liście i szczegółach przetrwa restart", async () => {
    const before = await freshApp(TEST_URL);
    const { prisma } = await import("@/lib/prisma");
    await prisma.product.update({ where: { id: 7 }, data: { amount: 123 } });
    expect((await before.getProductById(7))?.amount).toBe(123);

    const after = await freshApp(TEST_URL); // nowy klient, to samo źródło prawdy
    expect((await after.getProductById(7))?.amount).toBe(123);
    expect((await after.getProducts()).find((p) => p.id === 7)?.amount).toBe(123);
    expect(await after.getProducts()).toHaveLength(100);
  });

  it("niedostępna baza powoduje awarię, nie pusty wynik ani null", async () => {
    // port 1: nic tam nie nasłuchuje; nazwa bazy nadal kończy się na _test
    const dead = withDb(TEST_URL.replace(/:\d+\//, ":1/"), dbName(TEST_URL));
    const repo = await freshApp(dead);

    await expect(repo.getProducts()).rejects.toThrow();
    await expect(repo.getProducts({ type: "cpu" })).rejects.toThrow();
    await expect(repo.getFeaturedProducts()).rejects.toThrow();
    await expect(repo.getProductById(1)).rejects.toThrow(); // nie null = "brak produktu"
  });
});
