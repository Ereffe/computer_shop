"use client";

import { useEffect } from "react";

export default function Error({
  error,
  retry
}: Readonly<{
  error: Error & { digest?: string };
  retry: () => void;
}>) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="error-page">
      <div className="error-content">
        <span className="error-code">500</span>

        <h1>Coś poszło nie tak</h1>

        <p>
          Wystąpił nieoczekiwany problem podczas ładowania strony.
          Spróbuj ponownie.
        </p>

        <button
          type="button"
          className="error-button"
          onClick={() => retry()}
        >
          Spróbuj ponownie
        </button>
      </div>
    </div>
  );
}
