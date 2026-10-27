import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

if (!process.env.DATABASE_URL) {
  throw new Error("Brak zmiennej środowiskowej DATABASE_URL w pliku .env!");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function updateAmount(productId: number, newAmount: number) {
  console.log(`\nPróba aktualizacji produktu ID=${productId} -> amount=${newAmount}...`);

  if (!Number.isSafeInteger(productId) || productId < 1 || productId > 2147483647) {
    throw new Error(`Niepoprawne ID produktu: ${productId}`);
  }

  try {
    const updated = await prisma.product.update({
      where: { id: productId },
      data: { amount: newAmount },
      select: { id: true, code: true, name: true, amount: true },
    });

    console.log(`Zaktualizowano pomyślnie produkt:`, updated);
  } catch (error) {
    console.error(`Aktualizacja nie powiodła się:`, (error as Error).message);
    throw error;
  }
}

async function main() {
  const targetId = 1;

  await updateAmount(targetId, 25);

  console.log("\n Test ograniczenia CHECK (próba zapisu ujemnego stanu):");
  let checkBlocked = false;
  try {
    await updateAmount(targetId, -5);
    console.error(" BŁĄD: Baza pozwoliła na zapis wartości ujemnej!");
  } catch {
    checkBlocked = true;
    console.log(" Prawidłowo: Silnik PostgreSQL zablokował zapis wartości ujemnej (naruszenie CHECK).");
  }

  console.log("\n===== PODSUMOWANIE =====");
  console.log(`  Aktualizacja ID=${targetId} -> 25: OK`);
  console.log(`  Zapis wartości ujemnej: ${checkBlocked ? "odrzucony przez CHECK (OK)" : "PRZESZEDŁ (BŁĄD)"}`);
  if (!checkBlocked) process.exitCode = 1;
}

main()
  .catch(() => process.exit(1))
  .finally(async () => {
    await prisma.$disconnect();
  });