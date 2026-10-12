import { describe, expect, it } from "vitest";
import {
  getProductById,
  getProducts,
  queryProducts,
} from "@/lib/products/product-repository";
import type { Product } from "@/lib/products/product";

const make = (id: number, name: string, amount: number, date: string): Product => ({
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

    const sorted = queryProducts(sample, { sort: "name" }); // frozen → sort w miejscu rzuciłby TypeError

    expect(sorted.map((p) => p.id)).toEqual([1, 2, 3]); // remis "Beta" → rosnące id
    expect(sample.map((p) => p.id)).toEqual(before);
  });

  it("sorts by date descending with id as tie-breaker", () => {
    expect(queryProducts(sample, { sort: "date" }).map((p) => p.id)).toEqual([1, 2, 3]);
  });

  it("filters available and unavailable products", () => {
    expect(queryProducts(sample, { available: true }).map((p) => p.id)).toEqual([3, 2]);
    expect(queryProducts(sample, { available: false }).map((p) => p.id)).toEqual([1]);
  });

  it("filters by category", () => {
    expect(queryProducts(sample, { type: "gpu" }).every((p) => p.type === "gpu")).toBe(true);
  });

  it("returns an empty array when nothing matches", () => {
    expect(queryProducts(sample, { type: "gpu", available: false })).toEqual([]);
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
});
