import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

// Checkout w jednej transakcji (Read Committed):
//  1. blokada pozycji koszyka właściciela (FOR UPDATE) – równoległy setQuantity/removeItem czeka,
//  2. warunkowe zmniejszenie stanu: UPDATE ... WHERE amount >= qty (blokada wiersza produktu),
//  3. odczyt ceny/nazwy/kodu PO zablokowaniu produktu → snapshot jest spójny z cenami rozliczonymi,
//  4. zapis Order + OrderItem i usunięcie kupionych pozycji koszyka.
// Błąd na dowolnym kroku wycofuje całość (stan nie „ucieka”, koszyk zostaje).

export type CheckoutErrorCode =
  | "INVALID_REQUEST_KEY"
  | "EMPTY_CART"
  | "INSUFFICIENT_STOCK"
  | "PRICE_CHANGED";

export class CheckoutError extends Error {
  constructor(public readonly code: CheckoutErrorCode) {
    super(code);
    this.name = "CheckoutError";
  }
}

export type CheckoutResult = {
  orderId: number;
  number: string;
  /** Dokładna suma w groszach jako string (BigInt nie przechodzi przez JSON). */
  totalCents: string;
  /** true, gdy to ponowienie żądania i zwrócono istniejące zamówienie. */
  replayed: boolean;
};

const REQUEST_KEY_MAX = 64;

type CartRow = { id: number; productId: number; quantity: number };

const newOrderNumber = () =>
  `ORD-${randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase()}`;

const isUniqueViolation = (e: unknown) =>
  typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";

async function findByKey(userId: string, requestKey: string): Promise<CheckoutResult | null> {
  const order = await prisma.order.findUnique({
    where: { userId_requestKey: { userId, requestKey } },
  });
  return order
    ? { orderId: order.id, number: order.number, totalCents: order.totalCents.toString(), replayed: true }
    : null;
}

/**
 * @param expectedTotalCents opcjonalnie suma widziana przez klienta; niezgodność → PRICE_CHANGED
 *   (użytkownik nie zapłaci innej kwoty niż zobaczył).
 */
export async function checkout(
  userId: string,
  requestKey: unknown,
  expectedTotalCents?: number,
): Promise<CheckoutResult> {
  if (
    typeof requestKey !== "string" ||
    requestKey.length < 1 ||
    requestKey.length > REQUEST_KEY_MAX
  ) {
    throw new CheckoutError("INVALID_REQUEST_KEY");
  }

  // Szybka ścieżka idempotencji: to żądanie było już zrealizowane.
  const previous = await findByKey(userId, requestKey);
  if (previous) return previous;

  try {
    return await prisma.$transaction(async (tx) => {
      // Właściciel wynika z userId (sesji), nie z danych klienta. Sortowanie po productId
      // daje stały porządek blokad → brak deadlocków między równoległymi checkoutami.
      const lines = await tx.$queryRaw<CartRow[]>`
        SELECT ci.id, ci."productId", ci.quantity
        FROM cart_items ci
        JOIN carts c ON c.id = ci."cartId"
        WHERE c."userId" = ${userId}
        ORDER BY ci."productId"
        FOR UPDATE OF ci`;
      if (lines.length === 0) throw new CheckoutError("EMPTY_CART");

      for (const l of lines) {
        const { count } = await tx.product.updateMany({
          where: { id: l.productId, amount: { gte: l.quantity } },
          data: { amount: { decrement: l.quantity } },
        });
        if (count !== 1) throw new CheckoutError("INSUFFICIENT_STOCK");
      }

      // Produkty są już zablokowane przez UPDATE – ceny nie zmienią się do końca transakcji.
      const products = await tx.product.findMany({
        where: { id: { in: lines.map((l) => l.productId) } },
      });
      const byId = new Map(products.map((p) => [p.id, p]));

      const items = lines.map((l) => {
        const p = byId.get(l.productId)!;
        return {
          productId: p.id,
          productCode: p.code,
          productName: p.name,
          quantity: l.quantity,
          unitPriceCents: p.price,
        };
      });
      // BigInt: 99 szt. × ~2·10^9 gr × wiele pozycji przekracza Int32 i 2^53 nie grozi.
      const totalCents = items.reduce(
        (s, i) => s + BigInt(i.quantity) * BigInt(i.unitPriceCents),
        0n,
      );

      if (expectedTotalCents !== undefined && BigInt(expectedTotalCents) !== totalCents) {
        throw new CheckoutError("PRICE_CHANGED");
      }

      const order = await tx.order.create({
        data: { number: newOrderNumber(), userId, requestKey, totalCents, items: { create: items } },
      });
      await tx.cartItem.deleteMany({ where: { id: { in: lines.map((l) => l.id) } } });

      return {
        orderId: order.id,
        number: order.number,
        totalCents: totalCents.toString(),
        replayed: false,
      };
    });
  } catch (e) {
    // Równoległe ponowienie tego samego żądania: przegrany dostaje zamówienie zwycięzcy
    // (unikalność (userId, requestKey) lub pusty koszyk po commicie zwycięzcy).
    if (isUniqueViolation(e) || (e instanceof CheckoutError && e.code === "EMPTY_CART")) {
      const existing = await findByKey(userId, requestKey);
      if (existing) return existing;
    }
    throw e;
  }
}
