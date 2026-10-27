import fs from "node:fs";
import path from "node:path";
import { seed, truncateAll } from "./db";
import type { Product } from "@/lib/products/product";

export const TEST_URL = process.env.TEST_DATABASE_URL!;

export const fixture = (): Product[] =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "products.json"), "utf8"));

export function resetAndSeed() {
  return truncateAll(TEST_URL).then(() => seed(TEST_URL));
}

/** Referencyjna kolejność z Lab 06 (adapter JSON): localeCompare("pl") i data malejąco, remis po id. */
export const lab06Order = {
  name: (s: Product[]) =>
    [...s].sort((a, b) => a.name.localeCompare(b.name, "pl") || a.id - b.id),
  date: (s: Product[]) =>
    [...s].sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.id - b.id),
};
