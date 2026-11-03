"use client";

import { authClient } from "@/lib/auth-client";

export default function BasketSignIn() {
  return (
    <button
      onClick={() =>
        authClient.signIn.social({ provider: "github", callbackURL: "/basket" })
      }
    >
      Zaloguj przez GitHub
    </button>
  );
}
