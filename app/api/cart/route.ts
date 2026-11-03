import { auth } from "@/lib/auth";
import { getMyCart } from "@/lib/cart/cart-repository";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cart = await getMyCart(session.user.id);
  return NextResponse.json(cart);
}
