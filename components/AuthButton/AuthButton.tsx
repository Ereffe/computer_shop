"use client";

import { authClient } from "@/lib/auth-client";

export default function AuthButton() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return null;

  if (session) {
    return (
      <div className="auth-button">
        <span className="auth-user">{session.user.name}</span>
        <button
          onClick={() => authClient.signOut()}
          className="auth-sign-out"
        >
          Wyloguj
        </button>
        <button
          onClick={async () => {
            // Kasuje wszystkie sesje użytkownika (każde urządzenie); bieżąca też przestaje działać.
            await authClient.revokeSessions();
            window.location.reload();
          }}
          className="auth-sign-out"
        >
          Wyloguj wszędzie
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => authClient.signIn.social({ provider: "github" })}
      className="auth-sign-in"
    >
      Zaloguj przez GitHub
    </button>
  );
}
