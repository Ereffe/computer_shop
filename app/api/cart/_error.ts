import { CartError } from "@/lib/cart/cart-repository";
import { NextResponse } from "next/server";

const STATUS: Record<CartError["code"], number> = {
  INVALID_ITEM_ID: 400,
  INVALID_PRODUCT_ID: 400,
  INVALID_QUANTITY: 400,
  PRODUCT_NOT_FOUND: 404,
  PRODUCT_UNAVAILABLE: 409,
  ITEM_NOT_FOUND: 404,
  QUANTITY_EXCEEDS_STOCK: 409,
  QUANTITY_LIMIT: 409,
};

export function cartErrorResponse(e: CartError) {
  return NextResponse.json({ error: e.code }, { status: STATUS[e.code] });
}
