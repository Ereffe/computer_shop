import { assertTestDatabaseUrl, withDb } from "../tests/integration/db";

// Osobna baza (lokalny host, nazwa *_test), niezależna od testów integracyjnych.
export const E2E_DB_URL = withDb(
  assertTestDatabaseUrl(process.env.TEST_DATABASE_URL),
  "shop_e2e_test",
);
export const E2E_PORT = 3100;
export const E2E_ORIGIN = `http://localhost:${E2E_PORT}`;
// Sekret wyłącznie testowy; ten sam podpisuje cookie w testach i weryfikuje je serwer.
export const E2E_AUTH_SECRET = "e2e-only-secret-not-used-anywhere-else-0123456789";
