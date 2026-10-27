import "server-only";

import { prisma } from "@/lib/prisma";
import type { Product, productTypes } from "./product";
import { MAX_PRODUCT_ID } from "./product-id";

export type ProductSort = "name" | "date";

type ProductFindManyArgs = NonNullable<Parameters<typeof prisma.product.findMany>[0]>;


export type ProductFilter = {
  sort?: ProductSort;
  available?: boolean;
  type?: (typeof productTypes)[number];
};

export const FEATURED_COUNT = 3;

function toDomainProduct(dbRecord: {
  id: number;
  code: string;
  name: string;
  description: string;
  image: string;
  price: number;
  amount: number;
  date: Date;
  category: { code: string };
}): Product {
  return {
    id: dbRecord.id,
    code: dbRecord.code,
    name: dbRecord.name,
    type: dbRecord.category.code as Product["type"],
    price: dbRecord.price,
    amount: dbRecord.amount,
    description: dbRecord.description,
    date: dbRecord.date.toISOString(),
    image: dbRecord.image,
  };
}


export async function getProducts(
  filter: ProductFilter = {},
): Promise<Product[]> {
  const where: ProductFindManyArgs["where"] = {};

  if (filter.type !== undefined) {
    where.category = { code: filter.type };
  }

  if (filter.available !== undefined) {
    where.amount = filter.available ? { gt: 0 } : { equals: 0 };
  }

  const orderBy: ProductFindManyArgs["orderBy"] =
  filter.sort === "date"
    ? [{ date: "desc" }, { id: "asc" }]
    : [{ nameSortKey: "asc" }, { id: "asc" }];

  const records = await prisma.product.findMany({
    where,
    orderBy,
    include: {
      category: {
        select: { code: true },
      },
    },
  });

  return records.map(toDomainProduct);
}


export async function getFeaturedProducts(): Promise<Product[]> {
  return getProducts({ available: true, sort: "date" }).then((products) =>
    products.slice(0, FEATURED_COUNT),
  );
}


export async function getProductById(id: number): Promise<Product | null> {
  if (!Number.isSafeInteger(id) || id < 1 || id > MAX_PRODUCT_ID) {
    return null;
  }

  const record = await prisma.product.findUnique({
    where: { id },
    include: {
      category: {
        select: { code: true },
      },
    },
  });

  if (!record) {
    return null;
  }

  return toDomainProduct(record);
}