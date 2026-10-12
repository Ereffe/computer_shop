import { describe, expect, it } from "vitest";
import { validateProducts } from "@/lib/products/product";

const validProduct = {
  id: 1,
  code: "ABC1234567",
  name: "Test CPU",
  type: "cpu",
  price: 19999,
  amount: 10,
  description: "Testowy procesor.",
  date: "2026-10-01T10:00:00Z",
  image: "/images/products/cpu.webp",
};

describe("product validation", () => {
  it("accepts valid product data", () => {
    const result = validateProducts([validProduct]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(validProduct);
  });

  it("rejects negative price", () => {
    expect(() =>
      validateProducts([
        {
          ...validProduct,
          price: -100,
        },
      ])
    ).toThrow();
  });

  it("rejects duplicate ids", () => {
    expect(() =>
      validateProducts([
        validProduct,
        {
          ...validProduct,
          code: "XYZ9876543",
        },
      ])
    ).toThrow("Duplicate product id");
  });

  it("rejects duplicate codes", () => {
    expect(() =>
      validateProducts([
        validProduct,
        {
          ...validProduct,
          id: 2,
        },
      ])
    ).toThrow("Duplicate product code");
  });

  it("rejects invalid product code", () => {
    expect(() =>
      validateProducts([
        {
          ...validProduct,
          code: "abc",
        },
      ])
    ).toThrow();
  });
});
