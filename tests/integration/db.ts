import "dotenv/config";
import { execFileSync } from "node:child_process";
import { Client } from "pg";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]"];

/** Odmawia pracy na czymkolwiek innym niż lokalna baza o nazwie *_test. */
export function assertTestDatabaseUrl(url: string | undefined): string {
  if (!url) {
    throw new Error(
      "Brak TEST_DATABASE_URL (zob. .env.example). Testy integracyjne wymagają osobnej bazy *_test.",
    );
  }
  const u = new URL(url);
  const name = decodeURIComponent(u.pathname.slice(1));
  if (!LOCAL_HOSTS.includes(u.hostname)) {
    throw new Error(`TEST_DATABASE_URL musi wskazywać lokalny host, jest: ${u.hostname}`);
  }
  if (!/^[a-z0-9_]+_test$/.test(name)) {
    throw new Error(`Nazwa bazy testowej musi pasować do [a-z0-9_]+_test, jest: "${name}"`);
  }
  return url;
}

export const dbName = (url: string) => decodeURIComponent(new URL(url).pathname.slice(1));

/** Ten sam serwer, inna baza (np. "postgres" do CREATE/DROP DATABASE). */
export function withDb(url: string, name: string): string {
  const u = new URL(url);
  u.pathname = `/${name}`;
  return u.toString();
}

/** Baza pomocnicza dla testu migracji: shop_test -> shop_migrate_test. */
export const scratchUrl = (url: string) =>
  assertTestDatabaseUrl(withDb(url, `${dbName(url).slice(0, -"_test".length)}_migrate_test`));

export async function currentDatabase(url: string): Promise<string> {
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    return (await c.query("select current_database() as db")).rows[0].db;
  } finally {
    await c.end();
  }
}

export async function recreateDatabase(url: string): Promise<void> {
  assertTestDatabaseUrl(url);
  const name = dbName(url);
  const admin = new Client({ connectionString: withDb(url, "postgres") });
  await admin.connect();
  try {
    // nazwa zwalidowana regexem powyżej
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }
  const actual = await currentDatabase(url);
  if (actual !== name) throw new Error(`Połączono z "${actual}", oczekiwano "${name}"`);
}

function run(cmd: string[], url: string): string {
  return execFileSync("npx", ["--no-install", ...cmd], {
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
    stdio: "pipe",
  });
}

export const migrateDeploy = (url: string) =>
  run(["prisma", "migrate", "deploy"], assertTestDatabaseUrl(url));

export const seed = (url: string) => run(["tsx", "prisma/seed.ts"], assertTestDatabaseUrl(url));

/** Rzuca, jeśli schemat.prisma różni się od stanu bazy po migracjach. */
export const migrateDiff = (url: string) =>
  run(
    ["prisma", "migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--exit-code"],
    assertTestDatabaseUrl(url),
  );

/** Czyszczenie tylko po potwierdzeniu, że połączenie jest z bazą testową. */
export async function truncateAll(url: string): Promise<void> {
  assertTestDatabaseUrl(url);
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    const db = (await c.query("select current_database() as db")).rows[0].db;
    if (db !== dbName(url) || !db.endsWith("_test")) {
      throw new Error(`Odmowa czyszczenia bazy "${db}"`);
    }
    await c.query('TRUNCATE order_items, orders, cart_items, carts, "user", products, categories RESTART IDENTITY CASCADE');
  } finally {
    await c.end();
  }
}
