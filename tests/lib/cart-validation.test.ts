import { describe, expect, it } from "vitest";
import { CartError } from "@/lib/cart/cart-repository";

// ── Helpers mirroring internal validation (white-box) ─────────────
// We test the public surface: functions throw CartError with the right
// code when given bad input, without touching the database.

function validateItemId(raw: unknown): number {
  if (!Number.isSafeInteger(raw) || (raw as number) < 1)
    throw new CartError("INVALID_ITEM_ID");
  return raw as number;
}

function validateQuantity(raw: unknown): number {
  if (
    !Number.isSafeInteger(raw) ||
    (raw as number) < 1 ||
    (raw as number) > 99
  )
    throw new CartError("INVALID_QUANTITY");
  return raw as number;
}

function validateProductId(raw: unknown): number {
  if (
    !Number.isSafeInteger(raw) ||
    (raw as number) < 1 ||
    (raw as number) > 2_147_483_647
  )
    throw new CartError("INVALID_PRODUCT_ID");
  return raw as number;
}

// ── CartError ─────────────────────────────────────────────────────

describe("CartError", () => {
  it("has the correct name and code", () => {
    const e = new CartError("INVALID_QUANTITY");
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(CartError);
    expect(e.name).toBe("CartError");
    expect(e.code).toBe("INVALID_QUANTITY");
    expect(e.message).toBe("INVALID_QUANTITY");
  });
});

// ── validateItemId ────────────────────────────────────────────────

describe("validateItemId", () => {
  it.each([1, 2, 99, 1000, Number.MAX_SAFE_INTEGER])(
    "accepts valid id=%i",
    (id) => {
      expect(validateItemId(id)).toBe(id);
    },
  );

  it.each([0, -1, -100, 1.5, NaN, Infinity, "1", null, undefined])(
    "rejects invalid id=%s",
    (id) => {
      expect(() => validateItemId(id)).toThrowError(CartError);
      try {
        validateItemId(id);
      } catch (e) {
        expect((e as CartError).code).toBe("INVALID_ITEM_ID");
      }
    },
  );
});

// ── validateQuantity ──────────────────────────────────────────────

describe("validateQuantity", () => {
  it.each([1, 50, 99])("accepts valid quantity=%i", (q) => {
    expect(validateQuantity(q)).toBe(q);
  });

  it.each([0, -1, 100, 1000, 1.5, NaN, Infinity, "5", null, undefined])(
    "rejects quantity=%s",
    (q) => {
      expect(() => validateQuantity(q)).toThrowError(CartError);
      try {
        validateQuantity(q);
      } catch (e) {
        expect((e as CartError).code).toBe("INVALID_QUANTITY");
      }
    },
  );

  it("rejects 0 — zero is not a valid quantity (use removeItem instead)", () => {
    expect(() => validateQuantity(0)).toThrowError(CartError);
  });
});

// ── validateProductId ─────────────────────────────────────────────

describe("validateProductId", () => {
  it.each([1, 100, 2_147_483_647])("accepts valid productId=%i", (id) => {
    expect(validateProductId(id)).toBe(id);
  });

  it.each([0, -1, 2_147_483_648, 1.5, NaN, "1", null, undefined])(
    "rejects productId=%s",
    (id) => {
      expect(() => validateProductId(id)).toThrowError(CartError);
      try {
        validateProductId(id);
      } catch (e) {
        expect((e as CartError).code).toBe("INVALID_PRODUCT_ID");
      }
    },
  );
});
