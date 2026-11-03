"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/session";
import { checkout, CheckoutError, type CheckoutResult } from "@/lib/orders/checkout";

export type CheckoutActionResult =
  | { ok: true; order: CheckoutResult }
  | { ok: false; error: string };

const MESSAGES: Record<CheckoutError["code"], string> = {
  INVALID_REQUEST_KEY: "Nieprawidłowy klucz żądania.",
  EMPTY_CART: "Koszyk jest pusty.",
  INSUFFICIENT_STOCK: "Któryś z produktów nie jest już dostępny w żądanej ilości.",
  PRICE_CHANGED: "Ceny w koszyku uległy zmianie — odśwież stronę i sprawdź sumę.",
};

export async function checkoutAction(
  requestKey: string,
  expectedTotalCents: number,
): Promise<CheckoutActionResult> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "Nie jesteś zalogowany." };

  try {
    const order = await checkout(session.user.id, requestKey, expectedTotalCents);
    revalidatePath("/basket");
    return { ok: true, order };
  } catch (e) {
    if (e instanceof CheckoutError) return { ok: false, error: MESSAGES[e.code] };
    throw e;
  }
}
