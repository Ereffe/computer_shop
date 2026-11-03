import Link from "next/link";
import { getCurrentSession } from "@/lib/session";
import { listMyOrders } from "@/lib/orders/order-repository";
import { formatPln } from "@/lib/orders/format";
import BasketSignIn from "@/components/Basket/BasketSignIn";

export default async function OrderHistoryPage() {
  const session = await getCurrentSession();

  if (!session) {
    return (
      <div className="home">
        <section className="home-content">
          <h1>Historia zamówień</h1>
          <p>Zaloguj się, aby zobaczyć swoje zamówienia.</p>
          <BasketSignIn />
        </section>
      </div>
    );
  }

  const orders = await listMyOrders(session.user.id);

  return (
    <div className="home">
      <section className="home-content">
        <h1>Historia zamówień</h1>
        {orders.length === 0 ? (
          <p>Nie masz jeszcze żadnych zamówień.</p>
        ) : (
          <ul>
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/order-history/${o.id}`}>{o.number}</Link>
                {" — "}
                {o.createdAt.toLocaleDateString("pl-PL")}
                {" — "}
                {o.status}
                {" — "}
                {formatPln(o.totalCents)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
