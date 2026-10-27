import { defineConfig } from "vitest/config";
import path from "path";

const alias = { "@": path.resolve(import.meta.dirname, ".") };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          globals: true,
          setupFiles: ["./tests/setup.ts"],
          include: ["tests/app/**/*.test.ts", "tests/lib/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          globals: true,
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["./tests/integration/global-setup.ts"],
          setupFiles: ["./tests/setup.ts", "./tests/integration/setup.ts"],
          // jedna wspólna baza testowa: pliki muszą iść po kolei
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
