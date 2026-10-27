import { vi } from "vitest";

vi.mock("server-only", () => ({}));

// connection() działa tylko w żądaniu Next.js; w testach jednostkowych jest no-op.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));
