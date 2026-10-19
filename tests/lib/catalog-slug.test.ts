import { describe, expect, it } from "vitest";
import { parseCatalogSlug } from "@/lib/products/catalog-slug";

describe("parseCatalogSlug", () => {
  it("treats a missing or empty slug as the catalog root", () => {
    expect(parseCatalogSlug(undefined)).toEqual({ kind: "root" });
    expect(parseCatalogSlug([])).toEqual({ kind: "root" });
  });

  it("accepts a known category", () => {
    expect(parseCatalogSlug(["gpu"])).toEqual({ kind: "category", type: "gpu" });
  });

  it("accepts a category with a valid product id", () => {
    expect(parseCatalogSlug(["cpu", "7"])).toEqual({
      kind: "product",
      type: "cpu",
      id: 7,
    });
  });

  it.each([
    [["phones"]],
    [["CPU"]],
    [["cpu", "01"]],
    [["cpu", "abc"]],
    [["7"]],
    [["cpu", "7", "extra"]],
  ])("rejects %j", (slug) => {
    expect(parseCatalogSlug(slug)).toBeNull();
  });
});
