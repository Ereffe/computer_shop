import { z } from "zod";
import { productTypes } from "./product";

export const productSorts = ["name", "date"] as const;

export const productQuerySchema = z.object({
  type: z.enum(productTypes).optional(),
  sort: z.enum(productSorts).optional(),
});

export function parseProductQuery(searchParams: URLSearchParams) {
  return productQuerySchema.safeParse({
    type: searchParams.get("type") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
  });
}
