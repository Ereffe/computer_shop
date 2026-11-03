import "server-only";
import { prisma } from "@/lib/prisma";

export type OrderItemView = {
  id: number;
  productCode: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: string;
};

export type OrderView = {
  id: number;
  number: string;
  status: string;
  createdAt: Date;
  /** Suma utrwalona w zamówieniu (string, bo BigInt nie przechodzi przez serializację). */
  totalCents: string;
  items: OrderItemView[];
};

// Wszystkie wartości pochodzą ze snapshotu w order/order_items – tabela products nie jest czytana,
// więc zmiana ceny/nazwy, archiwizacja czy usunięcie produktu nie zmieniają historii.
const select = {
  id: true,
  number: true,
  status: true,
  createdAt: true,
  totalCents: true,
  items: {
    orderBy: { id: "asc" as const },
    select: { id: true, productCode: true, productName: true, quantity: true, unitPriceCents: true },
  },
} as const;

type Row = Awaited<ReturnType<typeof listRows>>[number];

const listRows = (userId: string) =>
  prisma.order.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select,
  });

function toView(o: Row): OrderView {
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    createdAt: o.createdAt,
    totalCents: o.totalCents.toString(),
    items: o.items.map((i) => ({
      ...i,
      lineTotalCents: (BigInt(i.quantity) * BigInt(i.unitPriceCents)).toString(),
    })),
  };
}

export async function listMyOrders(userId: string): Promise<OrderView[]> {
  return (await listRows(userId)).map(toView);
}

/**
 * Zamówienie wyłącznie właściciela. Cudze i nieistniejące ID są nieodróżnialne (null),
 * więc podmiana ID na zamówienie innego użytkownika niczego nie ujawnia.
 */
export async function getMyOrder(userId: string, rawId: unknown): Promise<OrderView | null> {
  if (typeof rawId !== "string" || !/^[1-9]\d{0,9}$/.test(rawId)) return null;
  const id = Number(rawId);
  if (id > 2_147_483_647) return null;

  const order = await prisma.order.findFirst({ where: { id, userId }, select });
  return order ? toView(order) : null;
}
