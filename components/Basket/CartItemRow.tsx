"use client";

import { useTransition, useState } from "react";
import Image from "next/image";
import { setQuantityAction, removeItemAction } from "@/lib/cart/cart-actions";

type Props = {
  itemId: number;
  name: string;
  image: string;
  unitPriceCents: number;
  quantity: number;
  totalCents: number;
  exceedsStock: boolean;
};

export default function CartItemRow({
  itemId,
  name,
  image,
  unitPriceCents,
  quantity,
  totalCents,
  exceedsStock,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleQty(e: React.ChangeEvent<HTMLInputElement>) {
    const qty = Number(e.target.value);
    setError(null);
    startTransition(async () => {
      const result = await setQuantityAction(itemId, qty);
      if (!result.ok) setError(result.error);
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeItemAction(itemId);
      if (!result.ok) setError(result.error);
    });
  }

  const fmt = (cents: number) =>
    (cents / 100).toLocaleString("pl-PL", { style: "currency", currency: "PLN" });

  return (
    <li style={{ opacity: pending ? 0.5 : 1, display: "flex", gap: "1rem", padding: "0.75rem 0" }}>
      <Image src={image} alt={name} width={80} height={60} style={{ objectFit: "contain" }} />

      <div style={{ flex: 1 }}>
        <strong>{name}</strong>

        <div>Cena jedn.: {fmt(unitPriceCents)}</div>

        <label>
          Ilość:{" "}
          <input
            type="number"
            min={1}
            max={99}
            defaultValue={quantity}
            disabled={pending}
            onChange={handleQty}
            style={{ width: "4rem" }}
            aria-describedby={error ? `err-${itemId}` : undefined}
          />
        </label>

        <div>Wartość: {fmt(totalCents)}</div>

        {exceedsStock && (
          <p style={{ color: "orange", margin: "0.25rem 0" }}>
            ⚠ Ilość przekracza stan magazynowy — zmniejsz lub usuń pozycję.
          </p>
        )}

        {error && (
          <p
            id={`err-${itemId}`}
            role="alert"
            style={{ color: "red", margin: "0.25rem 0" }}
          >
            {error}
          </p>
        )}

        <button onClick={handleRemove} disabled={pending} style={{ marginTop: "0.5rem" }}>
          {pending ? "…" : "Usuń"}
        </button>
      </div>
    </li>
  );
}
