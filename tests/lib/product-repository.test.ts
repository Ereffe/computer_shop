import { describe, expect, it } from "vitest";
import {
  FEATURED_COUNT,
  getFeaturedProducts,
  getProductById,
  getProducts,
  queryProducts,
  selectFeatured,
} from "@/lib/products/product-repository";
import type { Product } from "@/lib/products/product";

const make = (
  id: number,
  name: string,
  amount: number,
  date: string,
): Product => ({
  id,
  code: `CODE${String(id).padStart(6, "0")}`,
  name,
  type: id % 2 ? "cpu" : "gpu",
  price: 1000,
  amount,
  description: "Opis",
  date,
  image: "/images/products/cpu.webp",
});

const sample = Object.freeze([
  make(3, "Beta", 5, "2026-03-01T00:00:00Z"),
  make(1, "Alfa", 0, "2026-05-01T00:00:00Z"),
  make(2, "Beta", 2, "2026-05-01T00:00:00Z"),
]);

describe("product repository", () => {
  it("sorts by name A→Z without mutating the input", () => {
    const before = sample.map((p) => p.id);

    const sorted = queryProducts(sample, { sort: "name" });
    expect(sorted.map((p) => p.id)).toEqual([1, 2, 3]); 
  });

  it("sorts by date descending with id as tie-breaker", () => {
    expect(queryProducts(sample, { sort: "date" }).map((p) => p.id)).toEqual([
      1, 2, 3,
    ]);
  });

  it("filters available and unavailable products", () => {
    expect(queryProducts(sample, { available: true }).map((p) => p.id)).toEqual(
      [3, 2],
    );
    expect(
      queryProducts(sample, { available: false }).map((p) => p.id),
    ).toEqual([1]);
  });

  it("filters by category", () => {
    expect(
      queryProducts(sample, { type: "gpu" }).every((p) => p.type === "gpu"),
    ).toBe(true);
  });

  it("returns an empty array when nothing matches", () => {
    expect(queryProducts(sample, { type: "gpu", available: false })).toEqual(
      [],
    );
    expect(queryProducts([], { sort: "name" })).toEqual([]);
  });

  it("does not change real catalog between calls", async () => {
    const before = (await getProducts()).map((p) => p.id);
    await getProducts({ sort: "name" });
    expect((await getProducts()).map((p) => p.id)).toEqual(before);
  });

  it("returns null for a missing product", async () => {
    expect(await getProductById(999999999)).toBeNull();
  });

  const deepFreeze = <T>(value: T): T => {
    if (value && typeof value === "object") {
      Object.values(value).forEach(deepFreeze);
      Object.freeze(value);
    }
    return value;
  };

  describe("product repository: no input mutation", () => {
    it("leaves a deeply frozen source and filter untouched", () => {
      const source = deepFreeze(structuredClone([...sample]));
      const filter = deepFreeze({
        type: "gpu",
        available: true,
        sort: "date",
      } as const);
      const snapshot = structuredClone(source);

      expect(() => queryProducts(source, filter)).not.toThrow();
      expect(source).toEqual(snapshot);
    });

    it("returns a new array even without a filter", () => {
      const result = queryProducts(sample);

      expect(result).not.toBe(sample);
      expect(result).toEqual([...sample]);
    });

    it("does not let callers change the catalog by mutating a result", async () => {
      const first = await getProducts();
      const count = first.length;

      first.pop();
      first.reverse();

      expect(await getProducts()).toHaveLength(count);
    });

    it("finds existing ids and returns null for the first missing one", async () => {
      expect((await getProductById(1))?.id).toBe(1);
      expect((await getProductById(100))?.id).toBe(100);
      expect(await getProductById(101)).toBeNull();
    });
  });

  describe("featured products", () => {
    it("picks available products, newest first, id as tie-breaker", () => {
      const source = Object.freeze([
        make(5, "E", 1, "2026-01-01T00:00:00Z"),
        make(4, "D", 0, "2026-09-01T00:00:00Z"),
        make(3, "C", 3, "2026-06-01T00:00:00Z"),
        make(2, "B", 2, "2026-06-01T00:00:00Z"),
        make(1, "A", 7, "2026-02-01T00:00:00Z"),
      ]);

      expect(selectFeatured(source).map((p) => p.id)).toEqual([2, 3, 1]);
      expect(source.map((p) => p.id)).toEqual([5, 4, 3, 2, 1]);
    });

    it("returns fewer products when not enough are available", () => {
      expect(selectFeatured(sample, 5).map((p) => p.id)).toEqual([2, 3]);
      expect(selectFeatured([])).toEqual([]);
    });

    it("returns the same products from the real catalog on every call", async () => {
      const first = (await getFeaturedProducts()).map((p) => p.id);

      expect(first).toHaveLength(FEATURED_COUNT);
      expect((await getFeaturedProducts()).map((p) => p.id)).toEqual(first);
      expect(
        (await getFeaturedProducts()).every((p) => p.amount > 0),
      ).toBe(true);
    });
  });
});
