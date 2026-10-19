import { cache } from "react";
import { notFound } from "next/navigation";
import { getProductById } from "./product-repository";
import { parseProductId } from "./product-id";

export const loadProduct = cache(async (rawId: string) => {
  const id = parseProductId(rawId);

  if (id === null) {
    notFound();
  }
  const product = await getProductById(id);

  if (product === null) {
    notFound();
  }

  return product;
});
