import { describe, expect, it } from "vitest";
import {
  defaultCatalogSettings,
  parseCatalogSearchParams,
  toCatalogCriteria,
  type RawSearchParams,
} from "@/lib/products/catalog-params";

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

describe("parseCatalogSearchParams", () => {
  it("accepts a valid combination", () => {
    expect(
      parseCatalogSearchParams({
        type: "gpu",
        stock: "available",
        sort: "newest",
      }),
    ).toEqual({
      settings: { type: "gpu", stock: "available", sort: "newest" },
      invalid: [],
    });
  });

  it("uses defaults without reporting errors when values are missing", () => {
    expect(parseCatalogSearchParams({})).toEqual({
      settings: defaultCatalogSettings,
      invalid: [],
    });
    expect(parseCatalogSearchParams({ type: undefined }).invalid).toEqual([]);
  });

  it("falls back and reports only the unknown value, keeping valid ones", () => {
    expect(
      parseCatalogSearchParams({ type: "monitor", sort: "newest" }),
    ).toEqual({
      settings: { type: "all", stock: "all", sort: "newest" },
      invalid: ["type"],
    });
  });

  it("treats an empty string as invalid, not as missing", () => {
    expect(parseCatalogSearchParams({ stock: "" })).toEqual({
      settings: defaultCatalogSettings,
      invalid: ["stock"],
    });
  });

  it("treats a repeated key as invalid even when every value is valid", () => {
    expect(parseCatalogSearchParams({ type: ["cpu", "gpu"] })).toEqual({
      settings: defaultCatalogSettings,
      invalid: ["type"],
    });
    expect(parseCatalogSearchParams({ sort: ["name"] }).invalid).toEqual([
      "sort",
    ]);
  });

  it("is case sensitive", () => {
    expect(parseCatalogSearchParams({ type: "CPU" }).invalid).toEqual(["type"]);
  });

  it("reports several invalid parameters in a stable order", () => {
    expect(
      parseCatalogSearchParams({ type: "x", stock: "y", sort: "z" }).invalid,
    ).toEqual(["type", "stock", "sort"]);
  });

  it("does not mutate the input or share state with the defaults", () => {
    const raw: RawSearchParams = deepFreeze({
      type: ["cpu", "gpu"],
      stock: "available",
    });
    const snapshot = structuredClone(raw);

    const { settings } = parseCatalogSearchParams(raw);

    expect(raw).toEqual(snapshot);

    settings.type = "disk";
    expect(defaultCatalogSettings.type).toBe("all");
    expect(parseCatalogSearchParams({}).settings.type).toBe("all");
  });
});

describe("toCatalogCriteria", () => {
  it("maps defaults to name sort without filters", () => {
    expect(toCatalogCriteria(defaultCatalogSettings)).toEqual({ sort: "name" });
  });

  it("maps every setting", () => {
    expect(
      toCatalogCriteria({ type: "ram", stock: "unavailable", sort: "newest" }),
    ).toEqual({ type: "ram", available: false, sort: "date" });
  });
});
