import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../lib/generated/prisma/client";
import { validateProducts, computeNameSortKey } from "../lib/products/product";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({connectionString: process.env.DATABASE_URL})
const prisma = new PrismaClient({adapter});

const CATEGORIES = [
  { code: "cpu", name: "Procesory" },
  { code: "gpu", name: "Karty graficzne" },
  { code: "ram", name: "Pamięci RAM" },
  { code: "disk", name: "Dyski" },
] as const;

// Deterministyczne zamówienia: stałe numery, daty, produkty i ilości.
// Nazwa, kod i cena jednostkowa są kopiowane z produktu w chwili seedowania (snapshot).
const DEMO_USER = {
  id: "demo-user",
  name: "Konto Demo",
  email: "demo@example.test",
  emailVerified: true,
};

const ORDERS = [
  { number: "ORD-2026-0001", status: "PAID", createdAt: "2026-10-01T10:00:00.000Z", lines: [[1, 2], [2, 1]] },
  { number: "ORD-2026-0002", status: "PENDING", createdAt: "2026-10-02T11:30:00.000Z", lines: [[3, 1]] },
  { number: "ORD-2026-0003", status: "SHIPPED", createdAt: "2026-10-03T12:15:00.500Z", lines: [[4, 3], [5, 1], [6, 2]] },
  { number: "ORD-2026-0004", status: "CANCELLED", createdAt: "2026-10-04T09:45:00.000Z", lines: [[7, 1], [8, 1]] },
] as const;

async function main() {
  console.log("Rozpoczynanie seedowania bazy danych...");

  const dataPath = path.join(process.cwd(), "data", "products.json");
  if (!fs.existsSync(dataPath)) {
    throw new Error(`Nie znaleziono pliku źródłowego: ${dataPath}`);
  }

  const rawData = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  const validatedProducts = validateProducts(rawData);

  console.log(`Zwalidowano ${validatedProducts.length} produktów z pliku products.json`);

  await prisma.$transaction(async (tx) => {
    const categoryMap = new Map<string, number>();

    for (const cat of CATEGORIES) {
      const categoryRecord = await tx.category.upsert({
        where: { code: cat.code },
        update: { name: cat.name },
        create: { code: cat.code, name: cat.name },
      });
      categoryMap.set(cat.code, categoryRecord.id);
    }
    console.log(`Zsynchronizowano ${categoryMap.size} kategorie`);

    for (const product of validatedProducts) {
      const categoryId = categoryMap.get(product.type);
      if (!categoryId) {
        throw new Error(`Brak kategorii w bazie dla typu: ${product.type}`);
      }

      const nameSortKey = computeNameSortKey(product.name);

      await tx.product.upsert({
        where: { code: product.code },
        update: {
          name: product.name,
          nameSortKey,
          description: product.description,
          image: product.image,
          price: product.price,
          amount: product.amount,
          date: new Date(product.date),
          categoryId,
        },
        create: {
          id: product.id,
          code: product.code,
          name: product.name,
          nameSortKey,
          description: product.description,
          image: product.image,
          price: product.price,
          amount: product.amount,
          date: new Date(product.date),
          categoryId,
        },
      });
    }
    console.log(`✓ Zsynchronizowano ${validatedProducts.length} produktów`);

    await tx.user.upsert({
      where: { id: DEMO_USER.id },
      update: { name: DEMO_USER.name, email: DEMO_USER.email, emailVerified: DEMO_USER.emailVerified },
      create: DEMO_USER,
    });

    for (const o of ORDERS) {
      const lines = o.lines.map(([productId, quantity]) => {
        const p = validatedProducts.find((x) => x.id === productId);
        if (!p) throw new Error(`Zamówienie ${o.number}: brak produktu ${productId}`);
        return {
          productId,
          productCode: p.code,
          productName: p.name,
          quantity,
          unitPriceCents: p.price,
        };
      });
      const totalCents = lines.reduce((s, l) => s + BigInt(l.quantity) * BigInt(l.unitPriceCents), 0n);

      // Ponowny seed nie nadpisuje snapshotu istniejącego zamówienia.
      const existing = await tx.order.findUnique({ where: { number: o.number } });
      if (existing) continue;

      await tx.order.create({
        data: {
          number: o.number,
          userId: DEMO_USER.id,
          status: o.status,
          totalCents,
          createdAt: new Date(o.createdAt),
          items: { create: lines },
        },
      });
    }
    console.log(`Zsynchronizowano ${ORDERS.length} zamówienia`);

    await tx.$executeRawUnsafe(`
      SELECT setval(
        pg_get_serial_sequence('products', 'id'),
        COALESCE((SELECT MAX(id) FROM "products"), 1)
      );
    `);
    console.log("Zsynchronizowano sekwencję autoincrement ID w tabeli products");
  });

  console.log("Seedowanie zakończone pomyślnie.");
}

main()
  .catch(async (error) => {
    console.error("Błąd podczas seedowania bazy danych:", error);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });