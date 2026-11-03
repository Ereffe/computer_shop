import "server-only";
import { prisma } from "@/lib/prisma";

// ── Constants ─────────────────────────────────────────────────────

const QUANTITY_MIN = 1;
const QUANTITY_MAX = 99;
const MAX_PRODUCT_ID = 2_147_483_647; // INT4 range

// ── Public types ──────────────────────────────────────────────────

export type CartLine = {
  itemId: number;
  productId: number;
  name: string;
  image: string;
  unitPriceCents: number;
  quantity: number;
  totalCents: number;
  /** true when quantity > product.amount (stock dropped after item was added) */
  exceedsStock: boolean;
};

export type CartView = {
  items: CartLine[];
  grandTotalCents: number;
};

export type CartErrorCode =
  | "INVALID_ITEM_ID"
  | "INVALID_PRODUCT_ID"
  | "INVALID_QUANTITY"
  | "PRODUCT_NOT_FOUND"
  | "PRODUCT_UNAVAILABLE"
  | "ITEM_NOT_FOUND"
  | "QUANTITY_EXCEEDS_STOCK"
  | "QUANTITY_LIMIT";

export class CartError extends Error {
  constructor(public readonly code: CartErrorCode) {
    super(code);
    this.name = "CartError";
  }
}

// ── Internal helpers ──────────────────────────────────────────────

function validateItemId(raw: unknown): number {
  if (!Number.isSafeInteger(raw) || (raw as number) < 1) {
    throw new CartError("INVALID_ITEM_ID");
  }
  return raw as number;
}

function validateQuantity(raw: unknown): number {
  if (
    !Number.isSafeInteger(raw) ||
    (raw as number) < QUANTITY_MIN ||
    (raw as number) > QUANTITY_MAX
  ) {
    throw new CartError("INVALID_QUANTITY");
  }
  return raw as number;
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function lockCart(tx: Tx, userId: string): Promise<number | null> {
  const rows = await tx.$queryRaw<{ id: number }[]>`
    SELECT id FROM carts WHERE "userId" = ${userId} FOR UPDATE`;
  return rows[0]?.id ?? null;
}

/** Lazy, race-free cart creation (two first-ever calls cannot violate carts_userId_key). */
async function lockOrCreateCart(tx: Tx, userId: string): Promise<number> {
  await tx.$executeRaw`
    INSERT INTO carts ("userId") VALUES (${userId}) ON CONFLICT ("userId") DO NOTHING`;
  const id = await lockCart(tx, userId);
  if (id === null) throw new Error("cart vanished after creation"); // unreachable: FK + no deletes here
  return id;
}

async function buildCartView(tx: Tx, cartId: number): Promise<CartView> {
  const rows = await tx.cartItem.findMany({
    where: { cartId },
    include: { product: true },
  });
  const items: CartLine[] = rows.map((row) => ({
    itemId: row.id,
    productId: row.productId,
    name: row.product.name,
    image: row.product.image,
    unitPriceCents: row.product.price,
    quantity: row.quantity,
    totalCents: row.quantity * row.product.price,
    exceedsStock: row.quantity > row.product.amount,
  }));
  return {
    items,
    grandTotalCents: items.reduce((s, l) => s + l.totalCents, 0),
  };
}

// ── getMyCart ─────────────────────────────────────────────────────

export async function getMyCart(userId: string): Promise<CartView> {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: { items: { include: { product: true } } },
  });
  if (!cart) return { items: [], grandTotalCents: 0 };

  const items: CartLine[] = cart.items.map((row) => ({
    itemId: row.id,
    productId: row.productId,
    name: row.product.name,
    image: row.product.image,
    unitPriceCents: row.product.price,
    quantity: row.quantity,
    totalCents: row.quantity * row.product.price,
    exceedsStock: row.quantity > row.product.amount,
  }));
  return {
    items,
    grandTotalCents: items.reduce((s, l) => s + l.totalCents, 0),
  };
}

// ── addProduct ────────────────────────────────────────────────────
// Atomic upsert inside a transaction. Two concurrent calls for the same
// (userId, productId) increment by 2 if stock allows; if only 1 unit
// remains one succeeds and the other gets QUANTITY_EXCEEDS_STOCK.

export async function addProduct(
  userId: string,
  productId: unknown,
): Promise<CartView> {
  if (
    !Number.isSafeInteger(productId) ||
    (productId as number) < 1 ||
    (productId as number) > MAX_PRODUCT_ID
  ) {
    throw new CartError("INVALID_PRODUCT_ID");
  }
  const pid = productId as number;

  return prisma.$transaction(async (tx) => {
    const cartId = await lockOrCreateCart(tx, userId);

    const product = await tx.product.findUnique({ where: { id: pid } });
    if (!product) throw new CartError("PRODUCT_NOT_FOUND");
    if (product.amount < 1) throw new CartError("PRODUCT_UNAVAILABLE");

    const existing = await tx.cartItem.findUnique({
      where: { cartId_productId: { cartId, productId: pid } },
    });
    const newQty = (existing?.quantity ?? 0) + 1;

    if (newQty > QUANTITY_MAX) throw new CartError("QUANTITY_LIMIT");
    if (newQty > product.amount) throw new CartError("QUANTITY_EXCEEDS_STOCK");

    await tx.cartItem.upsert({
      where: { cartId_productId: { cartId, productId: pid } },
      create: { cartId, productId: pid, quantity: 1 },
      update: { quantity: { increment: 1 } },
    });

    return buildCartView(tx, cartId);
  });
}

// ── setQuantity ───────────────────────────────────────────────────

export async function setQuantity(
  userId: string,
  itemId: unknown,
  quantity: unknown,
): Promise<CartView> {
  const id = validateItemId(itemId);
  const qty = validateQuantity(quantity);

  return prisma.$transaction(async (tx) => {
    const cartId = await lockCart(tx, userId);
    if (cartId === null) throw new CartError("ITEM_NOT_FOUND");

    // Read after the lock: an item removed by a concurrent request is gone here.
    const item = await tx.cartItem.findUnique({
      where: { id },
      include: { product: true },
    });
    if (!item || item.cartId !== cartId) throw new CartError("ITEM_NOT_FOUND");

    // Allow reducing below current stock; block increasing beyond it
    if (qty > item.product.amount && qty > item.quantity) {
      throw new CartError("QUANTITY_EXCEEDS_STOCK");
    }

    await tx.cartItem.update({ where: { id }, data: { quantity: qty } });
    return buildCartView(tx, cartId);
  });
}

// ── removeItem ────────────────────────────────────────────────────

export async function removeItem(
  userId: string,
  itemId: unknown,
): Promise<CartView> {
  const id = validateItemId(itemId);

  return prisma.$transaction(async (tx) => {
    const cartId = await lockCart(tx, userId);
    if (cartId === null) throw new CartError("ITEM_NOT_FOUND");

    const item = await tx.cartItem.findUnique({ where: { id } });
    if (!item || item.cartId !== cartId) throw new CartError("ITEM_NOT_FOUND");

    await tx.cartItem.delete({ where: { id } });
    return buildCartView(tx, cartId);
  });
}
