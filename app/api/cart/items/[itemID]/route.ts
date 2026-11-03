import { auth } from "@/lib/auth";
import { setQuantity, removeItem, CartError } from "@/lib/cart/cart-repository";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { cartErrorResponse } from "../../_error";

type Params = { params: Promise<{ itemID: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemID } = await params;
  const itemId = Number(itemID);
  const body = await request.json().catch(() => null);

  try {
    const cart = await setQuantity(session.user.id, itemId, body?.quantity);
    return NextResponse.json(cart);
  } catch (e) {
    if (e instanceof CartError) return cartErrorResponse(e);
    throw e;
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemID } = await params;
  const itemId = Number(itemID);

  try {
    const cart = await removeItem(session.user.id, itemId);
    return NextResponse.json(cart);
  } catch (e) {
    if (e instanceof CartError) return cartErrorResponse(e);
    throw e;
  }
}
