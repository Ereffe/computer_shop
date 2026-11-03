"use client";

import { useTransition, useState } from "react";
import { addProductAction } from "@/lib/cart/cart-actions";

export default function AddToCartButton({ productId }: Readonly<{ productId: number }>) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const result = await addProductAction(productId);
      setMessage(
        result.ok
          ? { ok: true, text: "Dodano do koszyka." }
          : { ok: false, text: result.error },
      );
    });
  }

  return (
    <div>
      <button onClick={handleClick} disabled={pending}>
        {pending ? "Dodawanie…" : "Dodaj do koszyka"}
      </button>
      {message && (
        <output style={{ display: "block", color: message.ok ? "green" : "red" }}>
          {message.text}
        </output>
      )}
    </div>
  );
}
