import { productTypes, type Product } from "./product";

export const CATALOG_PATH = "/product-list";

export const catalogTypes = ["all", ...productTypes] as const;
export const catalogStocks = ["all", "available", "unavailable"] as const;
export const catalogSorts = ["name", "newest"] as const;

export type CatalogSettings = {
  type: (typeof catalogTypes)[number];
  stock: (typeof catalogStocks)[number];
  sort: (typeof catalogSorts)[number];
};

export type CatalogParam = keyof CatalogSettings;

export const defaultCatalogSettings: CatalogSettings = {
  type: "all",
  stock: "all",
  sort: "name",
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

export type CatalogCriteria = {
  type?: Product["type"];
  available?: boolean;
  sort: "name" | "date";
};

function pick<T extends string>(
  allowed: readonly T[],
  value: string | string[] | undefined,
  fallback: T,
): { value: T; invalid: boolean } {
  if (value === undefined) {
    return { value: fallback, invalid: false };
  }

  if (
    typeof value === "string" &&
    (allowed as readonly string[]).includes(value)
  ) {
    return { value: value as T, invalid: false };
  }

  return { value: fallback, invalid: true };
}

export function parseCatalogSearchParams(raw: RawSearchParams): {
  settings: CatalogSettings;
  invalid: CatalogParam[];
} {
  const type = pick(catalogTypes, raw.type, defaultCatalogSettings.type);
  const stock = pick(catalogStocks, raw.stock, defaultCatalogSettings.stock);
  const sort = pick(catalogSorts, raw.sort, defaultCatalogSettings.sort);

  const invalid: CatalogParam[] = [];
  if (type.invalid) invalid.push("type");
  if (stock.invalid) invalid.push("stock");
  if (sort.invalid) invalid.push("sort");

  return {
    settings: { type: type.value, stock: stock.value, sort: sort.value },
    invalid,
  };
}

export function toCatalogCriteria(settings: CatalogSettings): CatalogCriteria {
  const criteria: CatalogCriteria = {
    sort: settings.sort === "newest" ? "date" : "name",
  };

  if (settings.type !== "all") {
    criteria.type = settings.type;
  }

  if (settings.stock !== "all") {
    criteria.available = settings.stock === "available";
  }

  return criteria;
}
