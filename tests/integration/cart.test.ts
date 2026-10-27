import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetAndSeed } from "./helpers";

// Fikcyjne konto: komplet wymaganych pól Better Auth, bez hasła.
const user = (id: string) => ({
  id,
  name: "Jan Testowy",
  email: `${id}@example.test`,
  emailVerified: false,
});

describe("model koszyka", () => {
  beforeAll(resetAndSeed);
  beforeEach(async () => {
    await prisma.cart.deleteMany();
    await prisma.user.deleteMany({ where: { id: { startsWith: "u" } } });
  });

  const newCart = async (id = "u1") =>
    prisma.cart.create({ data: { user: { create: user(id) } } });

  it("User: image opcjonalne, createdAt/updatedAt ustawiane automatycznie", async () => {
    const u = await prisma.user.create({ data: user("u1") });
    expect(u.image).toBeNull();
    expect(u.createdAt).toBeInstanceOf(Date);
    expect(u.updatedAt).toBeInstanceOf(Date);
  });

  it("User: email jest unikalny", async () => {
    await prisma.user.create({ data: user("u1") });
    await expect(
      prisma.user.create({ data: { ...user("u2"), email: user("u1").email } }),
    ).rejects.toThrow();
  });

  it("Cart.userId jest unikalne", async () => {
    await newCart("u1");
    await expect(prisma.cart.create({ data: { userId: "u1" } })).rejects.toThrow();
  });

  it("para cartId/productId nie może się powtórzyć", async () => {
    const c = await newCart();
    await prisma.cartItem.create({ data: { cartId: c.id, productId: 1, quantity: 1 } });
    await expect(
      prisma.cartItem.create({ data: { cartId: c.id, productId: 1, quantity: 2 } }),
    ).rejects.toThrow();
    // ten sam produkt w innym koszyku jest dozwolony
    const c2 = await newCart("u2");
    await expect(
      prisma.cartItem.create({ data: { cartId: c2.id, productId: 1, quantity: 1 } }),
    ).resolves.toBeDefined();
  });

  it.each([0, -1, 100, 1000])("CHECK odrzuca quantity=%i", async (quantity) => {
    const c = await newCart();
    await expect(
      prisma.cartItem.create({ data: { cartId: c.id, productId: 2, quantity } }),
    ).rejects.toThrow(/cart_item_quantity_range/);
  });

  it.each([1, 99])("CHECK przyjmuje quantity=%i", async (quantity) => {
    const c = await newCart();
    const i = await prisma.cartItem.create({ data: { cartId: c.id, productId: 2, quantity } });
    expect(i.quantity).toBe(quantity);
  });

  it("CHECK działa też przy UPDATE", async () => {
    const c = await newCart();
    const i = await prisma.cartItem.create({ data: { cartId: c.id, productId: 3, quantity: 5 } });
    await expect(
      prisma.cartItem.update({ where: { id: i.id }, data: { quantity: 100 } }),
    ).rejects.toThrow(/cart_item_quantity_range/);
  });

  it("usunięcie koszyka usuwa pozycje, ale nie produkty ani użytkownika", async () => {
    const c = await newCart();
    await prisma.cartItem.createMany({
      data: [4, 5, 6].map((productId) => ({ cartId: c.id, productId, quantity: 2 })),
    });
    await prisma.cart.delete({ where: { id: c.id } });
    expect(await prisma.cartItem.count()).toBe(0);
    expect(await prisma.product.count()).toBe(100);
    expect(await prisma.user.count({ where: { id: "u1" } })).toBe(1);
  });

  it("usunięcie użytkownika usuwa koszyk i pozycje", async () => {
    const c = await newCart();
    await prisma.cartItem.create({ data: { cartId: c.id, productId: 4, quantity: 1 } });
    await prisma.user.delete({ where: { id: "u1" } });
    expect(await prisma.cart.count()).toBe(0);
    expect(await prisma.cartItem.count()).toBe(0);
  });

  it("pozycja nie może wskazywać nieistniejącego produktu ani koszyka", async () => {
    const c = await newCart();
    await expect(
      prisma.cartItem.create({ data: { cartId: c.id, productId: 999999, quantity: 1 } }),
    ).rejects.toThrow();
    await expect(
      prisma.cartItem.create({ data: { cartId: 999999, productId: 1, quantity: 1 } }),
    ).rejects.toThrow();
  });

  it("produkt w koszyku nie może zostać usunięty (Restrict)", async () => {
    const c = await newCart();
    await prisma.cartItem.create({ data: { cartId: c.id, productId: 7, quantity: 1 } });
    await expect(prisma.product.delete({ where: { id: 7 } })).rejects.toThrow();
  });
});
