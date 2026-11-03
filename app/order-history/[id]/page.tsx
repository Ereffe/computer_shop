import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { getMyOrder } from "@/lib/orders/order-repository";
import { formatPln } from "@/lib/orders/format";
import BasketSignIn from "@/components/Basket/BasketSignIn";

type Props = { params: Promise<{ id: string }> };

export default async function OrderDetailsPage({ params }: Props) {
  const session = await getCurrentSession();
  if (!session) {
    return (
      <div className="home">
        <section className="home-content">
          <h1>Zamówienie</h1>
          <p>Zaloguj się, aby zobaczyć zamówienie.</p>
          <BasketSignIn />
        </section>
      </div>
    );
  }

  const { id } = await params;
  // Cudze zamówienie daje ten sam 404 co nieistniejące.
  const order = await getMyOrder(session.user.id, id);
  if (!order) notFound();

  return (
    <div className="home">
      <section className="home-content">
        <h1>Zamówienie {order.number}</h1>
        <p>
          {order.createdAt.toLocaleString("pl-PL")} — {order.status}
        </p>
        <table>
          <thead>
            <tr>
              <th>Kod</th>
              <th>Nazwa</th>
              <th>Ilość</th>
              <th>Cena jedn.</th>
              <th>Wartość</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.id}>
                <td>{i.productCode}</td>
                <td>{i.productName}</td>
                <td>{i.quantity}</td>
                <td>{formatPln(i.unitPriceCents)}</td>
                <td>{formatPln(i.lineTotalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>Razem: {formatPln(order.totalCents)}</p>
        <Link href="/order-history">← Wróć do historii</Link>
      </section>
    </div>
  );
}
