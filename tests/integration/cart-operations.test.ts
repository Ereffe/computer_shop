/**
 * Integration tests for the cart repository (lib/cart/cart-repository.ts).
 *
 * Two fixture users:
 *   ALICE ("alice-test") — primary actor
 *   BOB   ("bob-test")   — second account for ownership/isolation checks
 *
 * These IDs start with a letter that is NOT "u" so they don't collide with
 * the model-level tests in cart.test.ts which clean up { startsWith: "u" }.
 *
 * The catalogue (products 1-100) must not be mutated.  All tests that need
 * a specific product.amount value operate on a dedicated test product
 * (TESTCART01) that is created/deleted around each describe block.
 */

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";
import {
  getMyCart,
  addProduct,
  setQuantity,
  removeItem,
  CartError,
} from "@/lib/cart/cart-repository";
import { resetAndSeed, TEST_URL } from "./helpers";

// ── Fixture identities ────────────────────────────────────────────

const ALICE = "alice-test";
const BOB   = "bob-test";

const mkUser = (id: string) => ({
  id,
  name: id,
  email: `${id}@example.test`,
  emailVerified: false,
});

// ── Setup ─────────────────────────────────────────────────────────

beforeAll(async () => {
  await resetAndSeed();
  // Create both fixture users once; seed never creates them.
  await prisma.user.upsert({
    where: { id: ALICE },
    create: mkUser(ALICE),
    update: {},
  });
  await prisma.user.upsert({
    where: { id: BOB },
    create: mkUser(BOB),
    update: {},
  });
});

// Clean cart state before every test so tests are independent.
beforeEach(async () => {
  await prisma.cart.deleteMany({ where: { userId: { in: [ALICE, BOB] } } });
});

// ── Helper ────────────────────────────────────────────────────────

/** Category ID for test products (reuse existing "cpu"). */
async function cpuCategoryId() {
  return (await prisma.category.findUniqueOrThrow({ where: { code: "cpu" } })).id;
}

/** Create a disposable product with a given stock amount. */
async function makeTestProduct(amount: number) {
  const categoryId = await cpuCategoryId();
  // code is VARCHAR(10) — use last 6 digits of timestamp to stay within limit
  const suffix = String(Date.now()).slice(-6);
  return prisma.product.create({
    data: {
      code: `TC${suffix}`,
      name: "Test Cart Product",
      nameSortKey: "test cart product",
      description: "for cart tests",
      image: "/images/products/cpu.webp",
      price: 50_00, // 50 PLN in grosz
      amount,
      date: new Date("2026-01-01T00:00:00Z"),
      categoryId,
    },
  });
}

/**
 * Clean up a test product. Must remove any referencing cart items first
 * (cart_items_productId_fkey is RESTRICT).
 */
async function deleteTestProduct(productId: number) {
  await prisma.cartItem.deleteMany({ where: { productId } });
  await prisma.product.delete({ where: { id: productId } });
}

// ── getMyCart ─────────────────────────────────────────────────────

describe("getMyCart", () => {
  it("returns empty cart when no cart row exists", async () => {
    const view = await getMyCart(ALICE);
    expect(view.items).toHaveLength(0);
    expect(view.grandTotalCents).toBe(0);
  });

  it("returns items with correct fields after adding", async () => {
    const product = await makeTestProduct(10);
    try {
      await addProduct(ALICE, product.id);
      const view = await getMyCart(ALICE);
      expect(view.items).toHaveLength(1);
      const line = view.items[0];
      expect(line.productId).toBe(product.id);
      expect(line.name).toBe(product.name);
      expect(line.image).toBe(product.image);
      expect(line.unitPriceCents).toBe(product.price);
      expect(line.quantity).toBe(1);
      expect(line.totalCents).toBe(product.price);
      expect(line.exceedsStock).toBe(false);
      expect(view.grandTotalCents).toBe(product.price);
    } finally {
      await deleteTestProduct(product.id);
    }
  });

  it("price is taken from DB, not from any caller input", async () => {
    const product = await makeTestProduct(5);
    try {
      await addProduct(ALICE, product.id);
      // Change the price after adding — grandTotal must use the NEW price
      await prisma.product.update({
        where: { id: product.id },
        data: { price: 99_99 },
      });
      const view = await getMyCart(ALICE);
      expect(view.items[0].unitPriceCents).toBe(99_99);
      expect(view.grandTotalCents).toBe(99_99);
    } finally {
      await deleteTestProduct(product.id);
    }
  });

  it("sets exceedsStock=true when quantity > product.amount", async () => {
    const product = await makeTestProduct(3);
    try {
      // Add 2 then lower stock to 1
      await addProduct(ALICE, product.id);
      await addProduct(ALICE, product.id);
      await prisma.product.update({
        where: { id: product.id },
        data: { amount: 1 },
      });
      const view = await getMyCart(ALICE);
      expect(view.items[0].exceedsStock).toBe(true);
    } finally {
      await deleteTestProduct(product.id);
    }
  });
});

// ── addProduct ────────────────────────────────────────────────────

describe("addProduct", () => {
  it("creates cart lazily on first add", async () => {
    expect(await prisma.cart.count({ where: { userId: ALICE } })).toBe(0);
    const product = await makeTestProduct(5);
    try {
      await addProduct(ALICE, product.id);
      expect(await prisma.cart.count({ where: { userId: ALICE } })).toBe(1);
    } finally {
      await deleteTestProduct(product.id);
    }
  });

  it("increments quantity when product already in cart (no duplicate)", async () => {
    const product = await makeTestProduct(10);
    try {
      await addProduct(ALICE, product.id);
      await addProduct(ALICE, product.id);
      const view = await getMyCart(ALICE);
      expect(view.items).toHaveLength(1);
      expect(view.items[0].quantity).toBe(2);
    } finally {
      await deleteTestProduct(product.id);
    }
  });

  it("throws PRODUCT_NOT_FOUND for nonexistent product", async () => {
    await expect(addProduct(ALICE, 999_999_999)).rejects.toMatchObject({
      code: "PRODUCT_NOT_FOUND",
    });
  });

  it("throws PRODUCT_UNAVAILABLE when amount=0", async () => {
    const product = await makeTestProduct(0);
    try {
      await expect(addProduct(ALICE, product.id)).rejects.toMatchObject({
        code: "PRODUCT_UNAVAILABLE",
      });
    } finally {
      await deleteTestProduct(product.id);
    }
  });

  it("throws QUANTITY_EXCEEDS_STOCK when newQty > product.amount", async () => {
    const product = await makeTestProduct(1);
    try {
      await addProduct(ALICE, product.id); // quantity=1 == amount=1, ok
      await expect(addProduct(ALICE, product.id)).rejects.toMatchObject({
        code: "QUANTITY_EXCEEDS_STOCK",
      });
    } finally {
      await deleteTestProduct(product.id);
    }
  });

  it("throws INVALID_PRODUCT_ID for bad inputs", async () => {
    for (const bad of [0, -1, 1.5, "1", null, undefined]) {
      await expect(addProduct(ALICE, bad)).rejects.toMatchObject({
        code: "INVALID_PRODUCT_ID",
      });
    }
  });

  // ── concurrent addProduct ──────────────────────────────────────

  it("two concurrent adds to same product give quantity=2 when stock allows", async () => {
    const product = await makeTestProduct(10);
    try {
      await Promise.all([
        addProduct(ALICE, product.id),
        addProduct(ALICE, product.id),
      ]);
      const view = await getMyCart(ALICE);
      expect(view.items).toHaveLength(1);
      expect(view.items[0].quantity).toBe(2);
    } finally {
      await deleteTestProduct(product.id);
    }
  });

  it("concurrent adds with stock=1: exactly one succeeds, no duplicate", async () => {
    const product = await makeTestProduct(1);
    try {
      const results = await Promise.allSettled([
        addProduct(ALICE, product.id),
        addProduct(ALICE, product.id),
      ]);
      const ok = results.filter((r) => r.status === "fulfilled");
      const fail = results.filter((r) => r.status === "rejected");
      // Exactly one must succeed
      expect(ok).toHaveLength(1);
      expect(fail).toHaveLength(1);
      // The loser is either our CartError or a Postgres serialization error
      // from the transaction — both are acceptable; what matters is no duplicate.
      const reason = (fail[0] as PromiseRejectedResult).reason;
      const isExpectedFailure =
        (reason instanceof CartError &&
          (reason.code === "QUANTITY_EXCEEDS_STOCK" || reason.code === "QUANTITY_LIMIT")) ||
        // Prisma wraps serialization/deadlock failures
        (reason?.constructor?.name === "PrismaClientKnownRequestError");
      expect(isExpectedFailure).toBe(true);
      // Only one cart item in DB, quantity=1
      const view = await getMyCart(ALICE);
      expect(view.items).toHaveLength(1);
      expect(view.items[0].quantity).toBe(1);
    } finally {
      await deleteTestProduct(product.id);
    }
  });
});

// ── setQuantity ───────────────────────────────────────────────────

describe("setQuantity", () => {
  it("updates quantity within valid range", async () => {
    const product = await makeTestProduct(10);
    try {
      await addProduct(ALICE, product.id);
      const before = await getMyCart(ALICE);
      const itemId = before.items[0].itemId;
      await setQuantity(ALICE, itemId, 5);
      const after = await getMyCart(ALICE);
      expect(after.items[0].quantity).toBe(5);
      expect(after.grandTotalCents).toBe(5 * product.price);
    } finally {
      await deleteTestProduct(product.id);
    }
  });

  it("throws INVALID_QUANTITY for 0", async () => {
    const product = await makeTestProduct(5);
    try {
      await addProduct(ALICE, product.id);
      const { items } = await getMyCart(ALICE);
      await expect(
        setQuantity(ALICE, items[0].itemId, 0),
      ).rejects.toMatchObject({ code: "INVALID_QUANTITY" });
    } finally {
      await deleteTestProduct(product.id);
    }
  });

  it("throws INVALID_QUANTITY for 100", async () => {
    const product = await makeTestProduct(200);
    try {
      await addProduct(ALICE, product.id);
      const { items } = await getMyCart(ALICE);
      await expect(
        setQuantity(ALICE, items[0].itemId, 100),
      ).rejects.toMatchObject({ code: "INVALID_QUANTITY" });
    } finally {
      await deleteTestProduct(product.id);
    }
  });

  it("throws QUANTITY_EXCEEDS_STOCK when increasing beyond stock", async () => {
    const product = await makeTestProduct(3);
    try {
      await addProduct(ALICE, product.id);
      const { items } = await getMyCart(ALICE);
      await expect(
        setQuantity(ALICE, items[0].itemId, 4),
      ).rejects.toMatchObject({ code: "QUANTITY_EXCEEDS_STOCK" });
    } finally {
      await deleteTestProduct(product.id);
    }
  });

  it("allows reducing below current stock (stock fell after add)", async () => {
    const product = await makeTestProduct(5);
    try {
      await addProduct(ALICE, product.id);
      await addProduct(ALICE, product.id);
      await addProduct(ALICE, product.id);
      // Drop stock below current quantity=3
      await prisma.product.update({
        where: { id: product.id },
        data: { amount: 1 },
      });
      const { items } = await getMyCart(ALICE);
      // quantity=3 > amount=1, but we're REDUCING to 1 — must succeed
      await expect(
        setQuantity(ALICE, items[0].itemId, 1),
      ).resolves.toBeDefined();
    } finally {
      await deleteTestProduct(product.id);
    }
  });

  // ── Owner isolation ────────────────────────────────────────────

  it("ALICE cannot setQuantity on BOB's item", async () => {
    const product = await makeTestProduct(10);
    try {
      await addProduct(BOB, product.id);
      const bobCart = await getMyCart(BOB);
      const bobItemId = bobCart.items[0].itemId;
      // ALICE tries to mutate BOB's item — same error as nonexistent
      await expect(
        setQuantity(ALICE, bobItemId, 2),
      ).rejects.toMatchObject({ code: "ITEM_NOT_FOUND" });
      // BOB's cart is unchanged
      const bobCartAfter = await getMyCart(BOB);
      expect(bobCartAfter.items[0].quantity).toBe(1);
    } finally {
      await deleteTestProduct(product.id);
    }
  });

  it("nonexistent itemId gives ITEM_NOT_FOUND (same response as foreign item)", async () => {
    await expect(
      setQuantity(ALICE, 999_999_999, 1),
    ).rejects.toMatchObject({ code: "ITEM_NOT_FOUND" });
  });
});

// ── removeItem ────────────────────────────────────────────────────

describe("removeItem", () => {
  it("removes own item and returns updated cart", async () => {
    const product = await makeTestProduct(5);
    try {
      await addProduct(ALICE, product.id);
      const { items } = await getMyCart(ALICE);
      const result = await removeItem(ALICE, items[0].itemId);
      expect(result.items).toHaveLength(0);
      expect(result.grandTotalCents).toBe(0);
    } finally {
      await deleteTestProduct(product.id);
    }
  });

  it("ALICE cannot remove BOB's item", async () => {
    const product = await makeTestProduct(5);
    try {
      await addProduct(BOB, product.id);
      const bobCart = await getMyCart(BOB);
      const bobItemId = bobCart.items[0].itemId;
      await expect(
        removeItem(ALICE, bobItemId),
      ).rejects.toMatchObject({ code: "ITEM_NOT_FOUND" });
      // BOB's item still there
      expect((await getMyCart(BOB)).items).toHaveLength(1);
    } finally {
      await deleteTestProduct(product.id);
    }
  });

  it("nonexistent itemId gives ITEM_NOT_FOUND", async () => {
    await expect(
      removeItem(ALICE, 999_999_999),
    ).rejects.toMatchObject({ code: "ITEM_NOT_FOUND" });
  });

  it("throws INVALID_ITEM_ID for bad inputs", async () => {
    for (const bad of [0, -1, 1.5, "2", null, undefined]) {
      await expect(removeItem(ALICE, bad)).rejects.toMatchObject({
        code: "INVALID_ITEM_ID",
      });
    }
  });
});

// ── SQL CHECK constraints bypassing application validation ─────────

describe("SQL CHECK — bypass application layer via raw SQL", () => {
  let c: Client;

  beforeAll(async () => {
    c = new Client({ connectionString: TEST_URL });
    await c.connect();
    return () => c.end();
  });

  async function rawInsertItem(cartId: number, productId: number, quantity: number) {
    return c.query(
      `INSERT INTO cart_items ("cartId", "productId", quantity) VALUES ($1, $2, $3)`,
      [cartId, productId, quantity],
    );
  }

  it("DB rejects quantity=0 directly (bypassing app validator)", async () => {
    const product = await makeTestProduct(5);
    const cart = await prisma.cart.upsert({
      where: { userId: ALICE },
      create: { userId: ALICE },
      update: {},
    });
    try {
      await expect(
        rawInsertItem(cart.id, product.id, 0),
      ).rejects.toThrow(/cart_item_quantity_range/);
    } finally {
      await deleteTestProduct(product.id);
    }
  });

  it("DB rejects quantity=100 directly (bypassing app validator)", async () => {
    const product = await makeTestProduct(200);
    const cart = await prisma.cart.upsert({
      where: { userId: ALICE },
      create: { userId: ALICE },
      update: {},
    });
    try {
      await expect(
        rawInsertItem(cart.id, product.id, 100),
      ).rejects.toThrow(/cart_item_quantity_range/);
    } finally {
      await deleteTestProduct(product.id);
    }
  });

  it("DB accepts boundary values 1 and 99", async () => {
    const product = await makeTestProduct(200);
    const cart = await prisma.cart.upsert({
      where: { userId: ALICE },
      create: { userId: ALICE },
      update: {},
    });
    try {
      await expect(rawInsertItem(cart.id, product.id, 1)).resolves.toBeDefined();
      // Update to 99 directly
      await c.query(
        `UPDATE cart_items SET quantity=99 WHERE "cartId"=$1 AND "productId"=$2`,
        [cart.id, product.id],
      );
      const row = await c.query(
        `SELECT quantity FROM cart_items WHERE "cartId"=$1 AND "productId"=$2`,
        [cart.id, product.id],
      );
      expect(row.rows[0].quantity).toBe(99);
    } finally {
      await deleteTestProduct(product.id);
    }
  });
});

// ── Cart persistence across session lifecycle ─────────────────────

describe("cart persistence", () => {
  it("cart data survives after session is deleted (sign-out)", async () => {
    const product = await makeTestProduct(5);
    try {
      await addProduct(ALICE, product.id);

      // Simulate sign-out: delete all sessions for ALICE
      await prisma.session.deleteMany({ where: { userId: ALICE } });

      // Cart row must still be there
      const cart = await prisma.cart.findUnique({ where: { userId: ALICE } });
      expect(cart).not.toBeNull();

      // And getMyCart still returns the item when called with ALICE's userId
      const view = await getMyCart(ALICE);
      expect(view.items).toHaveLength(1);
    } finally {
      await deleteTestProduct(product.id);
    }
  });

  it("re-authenticating the same userId restores the cart", async () => {
    const product = await makeTestProduct(5);
    try {
      await addProduct(ALICE, product.id);
      // Wipe all sessions then "re-login" = just verify getMyCart returns cart
      await prisma.session.deleteMany({ where: { userId: ALICE } });
      const view = await getMyCart(ALICE);
      expect(view.items[0].productId).toBe(product.id);
    } finally {
      await deleteTestProduct(product.id);
    }
  });
});
