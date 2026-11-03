import { defineConfig } from "@playwright/test";
import { E2E_AUTH_SECRET, E2E_DB_URL, E2E_ORIGIN, E2E_PORT } from "./e2e/env";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: E2E_ORIGIN, trace: "retain-on-failure" },
  webServer: {
    // Baza jest przygotowywana przed buildem (prerendering czyta katalog z bazy).
    command: `npx tsx e2e/prepare-db.ts && npm run build && npm run start -- -p ${E2E_PORT}`,
    url: E2E_ORIGIN,
    timeout: 300_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: E2E_DB_URL,
      BETTER_AUTH_URL: E2E_ORIGIN,
      BETTER_AUTH_SECRET: E2E_AUTH_SECRET,
      GITHUB_CLIENT_ID: "e2e",
      GITHUB_CLIENT_SECRET: "e2e",
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
    },
  },
});
