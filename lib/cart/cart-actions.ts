"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/session";
import {
  addProduct,
  setQuantity,
  removeItem,
  CartError,
  type CartView,
} from "@/lib/cart/cart-repository";

// Closed result type — never leaks raw ORM errors or secrets
export type CartActionResult =
  | { ok: true; cart: CartView }
  | { ok: false; error: string };

const MESSAGES: Record<CartError["code"], string> = {
  INVALID_ITEM_ID:         "Nieprawidłowy identyfikator pozycji.",
  INVALID_PRODUCT_ID:      "Nieprawidłowy identyfikator produktu.",
  INVALID_QUANTITY:        "Ilość musi wynosić od 1 do 99.",
  PRODUCT_NOT_FOUND:       "Produkt nie istnieje.",
  PRODUCT_UNAVAILABLE:     "Produkt jest niedostępny.",
  ITEM_NOT_FOUND:          "Pozycja nie istnieje.",
  QUANTITY_EXCEEDS_STOCK:  "Żądana ilość przekracza stan magazynowy.",
  QUANTITY_LIMIT:          "Można mieć maksymalnie 99 sztuk jednego produktu.",
};

export async function addProductAction(
  productId: number,
): Promise<CartActionResult> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "Nie jesteś zalogowany." };

  try {
    const cart = await addProduct(session.user.id, productId);
    revalidatePath("/basket");
    return { ok: true, cart };
  } catch (e) {
    if (e instanceof CartError) return { ok: false, error: MESSAGES[e.code] };
    throw e; // unexpected — propagate to Next.js error boundary
  }
}

export async function setQuantityAction(
  itemId: number,
  quantity: number,
): Promise<CartActionResult> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "Nie jesteś zalogowany." };

  try {
    const cart = await setQuantity(session.user.id, itemId, quantity);
    revalidatePath("/basket");
    return { ok: true, cart };
  } catch (e) {
    if (e instanceof CartError) return { ok: false, error: MESSAGES[e.code] };
    throw e;
  }
}

export async function removeItemAction(
  itemId: number,
): Promise<CartActionResult> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "Nie jesteś zalogowany." };

  try {
    const cart = await removeItem(session.user.id, itemId);
    revalidatePath("/basket");
    return { ok: true, cart };
  } catch (e) {
    if (e instanceof CartError) return { ok: false, error: MESSAGES[e.code] };
    throw e;
  }
}
