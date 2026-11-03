"use client";

import { useRef, useState, useTransition } from "react";
import { checkoutAction } from "@/lib/orders/checkout-actions";

// Klucz żądania żyje w refie: ponowny klik / retry po błędzie sieci wysyła ten sam klucz,
// więc serwer nie utworzy drugiego zamówienia. Po sukcesie/odmowie biznesowej klucz się odnawia.
export default function CheckoutButton({ totalCents }: { totalCents: number }) {
  const key = useRef<string>(crypto.randomUUID());
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await checkoutAction(key.current, totalCents);
      if (result.ok) {
        setMessage(`Zamówienie ${result.order.number} zostało złożone.`);
      } else {
        setError(result.error);
      }
      key.current = crypto.randomUUID();
    });
  }

  return (
    <div>
      <button onClick={handleClick} disabled={pending}>
        {pending ? "…" : "Złóż zamówienie"}
      </button>
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" style={{ color: "red" }}>
          {error}
        </p>
      )}
    </div>
  );
}
