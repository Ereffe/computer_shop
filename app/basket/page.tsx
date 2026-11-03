import { getCurrentSession } from "@/lib/session";
import { getMyCart } from "@/lib/cart/cart-repository";
import BasketSignIn from "@/components/Basket/BasketSignIn";
import CartItemRow from "@/components/Basket/CartItemRow";
import CheckoutButton from "@/components/Basket/CheckoutButton";

export default async function BasketPage() {
  const session = await getCurrentSession();

  if (!session) {
    return (
      <div className="home">
        <section className="home-content">
          <h1>Koszyk</h1>
          <p>Zaloguj się, aby zobaczyć swój koszyk.</p>
          <BasketSignIn />
        </section>
      </div>
    );
  }

  const cart = await getMyCart(session.user.id);

  return (
    <div className="home">
      <section className="home-content">
        <h1>Koszyk</h1>
        {cart.items.length === 0 ? (
          <p>Koszyk jest pusty.</p>
        ) : (
          <>
            <ul>
              {cart.items.map((item) => (
                <CartItemRow
                  key={item.itemId}
                  itemId={item.itemId}
                  name={item.name}
                  image={item.image}
                  unitPriceCents={item.unitPriceCents}
                  quantity={item.quantity}
                  totalCents={item.totalCents}
                  exceedsStock={item.exceedsStock}
                />
              ))}
            </ul>
            <p>
              Razem:{" "}
              {(cart.grandTotalCents / 100).toLocaleString("pl-PL", {
                style: "currency",
                currency: "PLN",
              })}
            </p>
            <CheckoutButton totalCents={cart.grandTotalCents} />
          </>
        )}
      </section>
    </div>
  );
}
