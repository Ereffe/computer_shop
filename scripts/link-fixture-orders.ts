/**
 * Lokalna demonstracja historii: przepina zamówienia fikcyjnych użytkowników fixture
 * na prawdziwe konta auth (utworzone przez zalogowanie się przez GitHub).
 *
 *   npx tsx scripts/link-fixture-orders.ts --a <email konta 1> --b <email konta 2>
 *   npx tsx scripts/link-fixture-orders.ts --reset      # przywraca fixture-ada / fixture-bob
 *
 * Zabezpieczenia: tylko lokalny host bazy, konta muszą istnieć i mieć wiersz w "account"
 * (czyli być prawdziwymi kontami auth), docelowe konto nie może być fixture'em.
 * Zamówienia rozpoznawane są po numerze (ORD-ADA-*, ORD-BOB-*), więc skrypt jest idempotentny.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Brak DATABASE_URL.");
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(url).hostname)) {
  throw new Error("Skrypt działa wyłącznie na lokalnej bazie.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const FIXTURES = [
  { prefix: "ORD-ADA-", fixtureId: "fixture-ada" },
  { prefix: "ORD-BOB-", fixtureId: "fixture-bob" },
] as const;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function authUserId(email: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { email }, include: { accounts: { select: { id: true } } } });
  if (!user) throw new Error(`Brak użytkownika ${email} – najpierw zaloguj się przez GitHub.`);
  if (user.id.startsWith("fixture-") || user.id === "demo-user") {
    throw new Error(`${email} to konto fixture, nie konto auth.`);
  }
  if (user.accounts.length === 0) throw new Error(`${email} nie ma konta auth (tabela account).`);
  return user.id;
}

async function main() {
  const targets = process.argv.includes("--reset")
    ? [FIXTURES[0].fixtureId, FIXTURES[1].fixtureId]
    : await (async () => {
        const a = arg("--a");
        const b = arg("--b");
        if (!a || !b) throw new Error("Podaj --a <email> --b <email> albo --reset.");
        if (a === b) throw new Error("Konta A i B muszą być różne.");
        return [await authUserId(a), await authUserId(b)];
      })();

  for (const [idx, f] of FIXTURES.entries()) {
    const { count } = await prisma.order.updateMany({
      where: { number: { startsWith: f.prefix } },
      data: { userId: targets[idx] },
    });
    console.log(`${f.prefix}* -> ${targets[idx]} (${count} zamówień)`);
  }
}

main()
  .catch((e) => {
    console.error((e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
