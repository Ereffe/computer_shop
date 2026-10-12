import { z } from "zod";

export const productTypes = ["cpu", "gpu", "ram", "disk"] as const;

export const productSchema = z.object({
  id: z.number().int().positive(),

  code: z
    .string()
    .regex(/^[A-Z0-9]{10}$/, "Code must contain exactly 10 uppercase letters or digits"),

  name: z.string().trim().min(1),

  type: z.enum(productTypes),

  price: z.number().int().nonnegative(),

  amount: z.number().int().nonnegative(),

  description: z.string().trim().min(1),

  date: z.string().datetime({
    offset: false,
  }),

  image: z
    .string()
    .regex(
      /^\/images\/products\/.+$/,
      "Image must be a local product image URL"
    ),
});

export type Product = z.infer<typeof productSchema>;

const productsSchema = z.array(productSchema);

export function validateProducts(data: unknown): Product[] {
  const products = productsSchema.parse(data);

  const ids = new Set<number>();
  const codes = new Set<string>();

  for (const product of products) {
    if (ids.has(product.id)) {
      throw new Error(`Duplicate product id: ${product.id}`);
    }

    if (codes.has(product.code)) {
      throw new Error(`Duplicate product code: ${product.code}`);
    }

    ids.add(product.id);
    codes.add(product.code);
  }

  return products;
}
