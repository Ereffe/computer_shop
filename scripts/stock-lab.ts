import "dotenv/config";
import assert from "node:assert/strict";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { assertTestDatabaseUrl, migrateDeploy, recreateDatabase, withDb } from "../tests/integration/db";

const ROWS = 200_000;
const url = withDb(assertTestDatabaseUrl(process.env.TEST_DATABASE_URL), "shop_lab_test");

// ---------- 2. Atomowa rezerwacja: jeden UPDATE z warunkiem w WHERE ----------
// Wiersz jest blokowany przez pierwszy UPDATE; drugi czeka, po COMMIT ponownie ocenia
// WHERE na nowej wartości i trafia w 0 wierszy. Wystarcza READ COMMITTED, więc nie ma
// konfliktu serializacji ani ponawiania. CHECK amount >= 0 zostaje jako druga zapora.
async function reserve(prisma: PrismaClient, productId: number, quantity: number): Promise<boolean> {
  const { count } = await prisma.product.updateMany({
    where: { id: productId, amount: { gte: quantity } },
    data: { amount: { decrement: quantity } },
  });
  return count === 1;
}

async function seedData(db: Client) {
  await db.query(`INSERT INTO categories(code, name) VALUES ('cpu','CPU'),('gpu','GPU'),('ram','RAM'),('disk','Disk')`);
  await db.query(
    `INSERT INTO products (code, name, "nameSortKey", description, image, price, amount, date, "categoryId")
     SELECT 'P' || g, 'Product ' || md5(g::text), 'product ' || md5(g::text), 'd', 'i.png',
            (random() * 100000)::int,
            CASE WHEN random() < 0.3 THEN 0 ELSE 1 + (random() * 50)::int END,
            now() - random() * interval '1000 days',
            1 + g % 4
     FROM generate_series(1, $1) g`,
    [ROWS],
  );
  await db.query("ANALYZE products");
}

// ---------- 1. Indeksy: EXPLAIN (ANALYZE, BUFFERS) przed i po ----------
// Zapytanie jak getProducts({ type, available: true, sort: "name" }).
const QUERY = (limit: string) => `
  SELECT p.* FROM products p JOIN categories c ON c.id = p."categoryId"
  WHERE c.code = 'cpu' AND p.amount > 0
  ORDER BY p."nameSortKey" ASC, p.id ASC ${limit}`;

async function explain(db: Client, label: string, sql: string): Promise<number> {
  let lines: string[] = [];
  for (let i = 0; i < 3; i++) {
    const r = await db.query(`EXPLAIN (ANALYZE, BUFFERS) ${sql}`);
    lines = r.rows.map((x) => x["QUERY PLAN"]);
  }
  console.log(`\n--- ${label} ---\n${lines.join("\n")}`);
  return Number(lines.find((l) => l.startsWith("Execution Time"))?.match(/[\d.]+/)?.[0]);
}

// Wariant z już rozwiązanym id kategorii (tak planner może użyć indeksu po "categoryId").
const QUERY_ID = (limit: string) => `
  SELECT * FROM products WHERE "categoryId" = 1 AND amount > 0
  ORDER BY "nameSortKey" ASC, id ASC ${limit}`;

// Koszt zapisu: 50k wierszy do pustej kopii tabeli z aktualnym zestawem indeksów
// (kopia, żeby nie zostawiać martwych krotek w products i nie zafałszować odczytów).
async function insertCostMs(db: Client): Promise<number> {
  let best = Infinity;
  for (let i = 0; i < 3; i++) {
    await db.query("DROP TABLE IF EXISTS products_w");
    await db.query("CREATE TABLE products_w (LIKE products INCLUDING INDEXES INCLUDING DEFAULTS)");
    const t = performance.now();
    await db.query(
      `INSERT INTO products_w (code, name, "nameSortKey", description, image, price, amount, date, "categoryId")
       SELECT 'X' || g, 'n' || md5(g::text), 'n' || md5(g::text), 'd', 'i.png', 1, 1 + g % 50, now(), 1 + g % 4
       FROM generate_series(1, 50000) g`,
    );
    best = Math.min(best, performance.now() - t);
  }
  await db.query("DROP TABLE products_w");
  return best;
}

async function indexExperiment(db: Client) {
  const size = async () =>
    (await db.query(`SELECT pg_size_pretty(pg_total_relation_size('products')) AS s`)).rows[0].s;

  console.log(`\n===== INDEKSY (${ROWS} produktów, tabela+indeksy: ${await size()}) =====`);
  await db.query("VACUUM ANALYZE products");
  const before = [
    await explain(db, "PRZED: JOIN po code, cała kategoria", QUERY("")),
    await explain(db, "PRZED: JOIN po code, LIMIT 24", QUERY("LIMIT 24")),
    await explain(db, "PRZED: categoryId=1, cała kategoria", QUERY_ID("")),
    await explain(db, "PRZED: categoryId=1, LIMIT 24", QUERY_ID("LIMIT 24")),
  ];
  const writeBefore = await insertCostMs(db);

  // Częściowy indeks pod filtr "dostępne": kategoria + kolejność sortowania, tylko amount > 0.
  await db.query(
    `CREATE INDEX products_cat_name_avail_idx ON products ("categoryId", "nameSortKey", id) WHERE amount > 0`,
  );
  await db.query("VACUUM ANALYZE products");
  const idxSize = (await db.query(`SELECT pg_size_pretty(pg_relation_size('products_cat_name_avail_idx')) AS s`)).rows[0].s;

  const after = [
    await explain(db, "PO: JOIN po code, cała kategoria", QUERY("")),
    await explain(db, "PO: JOIN po code, LIMIT 24", QUERY("LIMIT 24")),
    await explain(db, "PO: categoryId=1, cała kategoria", QUERY_ID("")),
    await explain(db, "PO: categoryId=1, LIMIT 24", QUERY_ID("LIMIT 24")),
  ];
  const writeAfter = await insertCostMs(db);

  console.log(`\nRozmiar nowego indeksu: ${idxSize}`);
  console.log(`INSERT 50k wierszy: ${writeBefore.toFixed(0)} ms bez indeksu, ${writeAfter.toFixed(0)} ms z indeksem`);
  return { before, after, writeBefore, writeAfter, idxSize };
}

// ---------- 2. Test współbieżności ----------
async function concurrencyExperiment(db: Client) {
  let naiveWins = 0;
  console.log("\n===== REZERWACJA OSTATNIEJ SZTUKI =====");
  const { rows } = await db.query(`SELECT id FROM products ORDER BY id LIMIT 1`);
  const id: number = rows[0].id;
  const setAmount = (n: number) => db.query(`UPDATE products SET amount = $1 WHERE id = $2`, [n, id]);
  const amount = async () => (await db.query(`SELECT amount FROM products WHERE id = $1`, [id])).rows[0].amount;

  const a = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const b = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    // Kontrast: odczyt, potem bezwarunkowy zapis. Obie próby widzą 1 i obie "wygrywają".
    await setAmount(1);
    const seen = await Promise.all([a, b].map((p) => p.product.findUniqueOrThrow({ where: { id }, select: { amount: true } })));
    const naive = await Promise.all(
      [a, b].map(async (p, i) => {
        if (seen[i].amount < 1) return false;
        await p.product.update({ where: { id }, data: { amount: seen[i].amount - 1 } });
        return true;
      }),
    );
    naiveWins = naive.filter(Boolean).length;
    console.log(`Naiwnie (odczyt + zapis): wygrało ${naiveWins} z 2, stan=${await amount()} (sprzedano 2 szt. z 1)`);

    // Atomowo: 100 rund, w każdej dokładnie jeden zwycięzca.
    for (let round = 0; round < 100; round++) {
      await setAmount(1);
      const wins = (await Promise.all([reserve(a, id, 1), reserve(b, id, 1)])).filter(Boolean).length;
      assert.equal(wins, 1, `runda ${round}: wygrało ${wins}`);
      assert.equal(await amount(), 0);
    }
    // Za duża ilość: nie rezerwuje nic.
    await setAmount(1);
    assert.equal(await reserve(a, id, 2), false);
    assert.equal(await amount(), 1);
    console.log("Atomowo: 100 rund po 2 równoległe próby, zawsze dokładnie 1 sukces; ilość > stan odrzucona. OK");
  } finally {
    await Promise.all([a.$disconnect(), b.$disconnect()]);
  }
  return { naiveWins };
}

function printSummary(
  idx: Awaited<ReturnType<typeof indexExperiment>>,
  conc: Awaited<ReturnType<typeof concurrencyExperiment>>,
) {
  const names = ["JOIN po code, cała kategoria", "JOIN po code, LIMIT 24", "categoryId=1, cała kategoria", "categoryId=1, LIMIT 24"];
  const ms = (n: number) => `${n.toFixed(3)} ms`.padStart(11);
  const writePct = ((idx.writeAfter / idx.writeBefore - 1) * 100).toFixed(0);

  // Liczy się tylko zapytanie, w którym planner wybiera nowy indeks; iloraz czasów
  // rzędu 0,01-0,1 ms jest szumem, więc decyduje zysk bezwzględny.
  const gainMs = idx.before[3] - idx.after[3];
  const verdict =
    gainMs >= 1
      ? `zysk do ${gainMs.toFixed(1)} ms na zapytanie, rozważyć indeks wobec kosztu zapisu`
      : `największy zysk to ${gainMs.toFixed(3)} ms na zapytanie (poniżej 1 ms), indeksu NIE dodawać do schematu`;

  console.log("\n===== PODSUMOWANIE: INDEKSY I ZAPYTANIA =====");
  console.log("Wyniki (czas wykonania, EXPLAIN ANALYZE):");
  names.forEach((n, i) =>
    console.log(`  ${n.padEnd(30)} przed ${ms(idx.before[i])}   po ${ms(idx.after[i])}   x${(idx.before[i] / idx.after[i]).toFixed(2)}`),
  );
  console.log(`  Koszt zapisu 50k wierszy: ${idx.writeBefore.toFixed(0)} -> ${idx.writeAfter.toFixed(0)} ms (+${writePct}%), indeks ${idx.idxSize}`);
  console.log("Wnioski:");
  console.log(`  Indeks: ${verdict}.`);
  console.log("    - bez LIMIT dominuje odczyt ok. 35 tys. wierszy i sortowanie, indeks nic nie zmienia;");
  console.log("    - z LIMIT 24 planner i bez nowego indeksu idzie po products_nameSortKey_id_idx (ułamki ms);");
  console.log("    - JOIN po categories.code ignoruje indeks, bo planner nie zna categoryId.");
  console.log(`  Koszt: +${writePct}% czasu zapisu i ${idx.idxSize} miejsca; płacony przy każdym INSERT i zmianie amount przez próg 0.`);
  console.log("  Przy 100 rekordach tabela mieści się w kilku stronach: skan sekwencyjny jest tańszy i planner słusznie go wybiera.");

  console.log("\n===== PODSUMOWANIE: ZAPIS WSPÓŁBIEŻNY =====");
  console.log("Wyniki (2 równoległe próby pobrania ostatniej sztuki):");
  console.log(`  odczyt + zapis: wygrało ${conc.naiveWins} z 2 (błąd, nadsprzedaż)`);
  console.log("  atomowy UPDATE ... WHERE amount >= n: 100/100 rund dokładnie 1 sukces (assert)");
  console.log("Wnioski:");
  console.log("  Warunek w WHERE tego samego UPDATE wystarcza na READ COMMITTED;");
  console.log("    drugi UPDATE czeka na blokadę wiersza, po COMMIT ponownie sprawdza warunek i zwraca count=0.");
  console.log("  Brak błędów serializacji, więc brak ponawiania (przy SERIALIZABLE trzeba by łapać 40001 i ponawiać).");
  console.log("  CHECK amount >= 0 zostaje drugą zaporą.");
  console.log("  Checkout: po użyciu rezerwacji w zamówieniu przetestować od nowa całą transakcję zamówienia");
  console.log("    (kilka pozycji w jednej transakcji, wycofanie wszystkich, gdy którejś zabraknie).");
}

async function main() {
  await recreateDatabase(url);
  migrateDeploy(url);
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    await seedData(db);
    const idx = await indexExperiment(db);
    const conc = await concurrencyExperiment(db);
    printSummary(idx, conc);
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
