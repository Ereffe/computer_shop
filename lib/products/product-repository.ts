import "server-only";

import productsData from "@/data/products.json";
import { Product, validateProducts } from "./product";

const products: readonly Product[] = Object.freeze(
  validateProducts(productsData),
);

export type ProductSort = "name" | "date";

export type ProductFilter = {
  sort?: ProductSort;
  available?: boolean;
  type?: Product["type"];
};

export function queryProducts(
  source: readonly Product[],
  filter: ProductFilter = {},
): Product[] {
  let result = [...source];

  if (filter.available !== undefined) {
    result = result.filter((product) =>
      filter.available ? product.amount > 0 : product.amount === 0,
    );
  }

  if (filter.type !== undefined) {
    result = result.filter((product) => product.type === filter.type);
  }

  if (filter.sort === "name") {
    result.sort((a, b) => a.name.localeCompare(b.name, "pl") || a.id - b.id);
  }

  if (filter.sort === "date") {
    result.sort(
      (a, b) => Date.parse(b.date) - Date.parse(a.date) || a.id - b.id,
    );
  }

  return result;
}

export const FEATURED_COUNT = 3;

export function selectFeatured(
  source: readonly Product[],
  count: number = FEATURED_COUNT,
): Product[] {
  return queryProducts(source, { available: true, sort: "date" }).slice(
    0,
    count,
  );
}

export async function getFeaturedProducts(): Promise<Product[]> {
  return selectFeatured(products);
}

export async function getProducts(
  filter: ProductFilter = {},
): Promise<Product[]> {
  return queryProducts(products, filter);
}

export async function getProductById(id: number): Promise<Product | null> {
  return products.find((product) => product.id === id) ?? null;
}
