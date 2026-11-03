import { auth } from "@/lib/auth";
import { addProduct, CartError } from "@/lib/cart/cart-repository";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { cartErrorResponse } from "../_error";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const productId = body?.productId;

  try {
    const cart = await addProduct(session.user.id, productId);
    return NextResponse.json(cart, { status: 201 });
  } catch (e) {
    if (e instanceof CartError) return cartErrorResponse(e);
    throw e;
  }
}
