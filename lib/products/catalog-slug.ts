import { productTypes, type Product } from "./product";
import { parseProductId } from "./product-id";

export type CatalogSlug =
  | { kind: "root" }
  | { kind: "category"; type: Product["type"] }
  | { kind: "product"; type: Product["type"]; id: number };

export function parseCatalogSlug(slug: string[] = []): CatalogSlug | null {
  if (slug.length > 2) {
    return null;
  }

  const [rawType, rawId] = slug;

  if (rawType === undefined) {
    return { kind: "root" };
  }

  if (!(productTypes as readonly string[]).includes(rawType)) {
    return null;
  }

  const type = rawType as Product["type"];

  if (rawId === undefined) {
    return { kind: "category", type };
  }

  const id = parseProductId(rawId);

  return id === null ? null : { kind: "product", type, id };
}
