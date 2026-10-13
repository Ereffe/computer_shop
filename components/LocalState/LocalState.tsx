"use client";

import { useState } from "react";

export function LocalState() {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount((c) => c + 1)}>Kliknięcia: {count}</button>
  );
}
