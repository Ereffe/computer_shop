import { migrateDeploy, recreateDatabase, seed } from "../tests/integration/db";
import { E2E_DB_URL } from "./env";

// Odtwarza bazę e2e od zera: migracje + seed. db.ts odmawia pracy na czymkolwiek
// innym niż lokalna baza *_test, więc Production nie jest osiągalne z tego skryptu.
// Musi się wykonać przed `next build`, bo build prerenderuje strony z bazy.
await recreateDatabase(E2E_DB_URL);
migrateDeploy(E2E_DB_URL);
seed(E2E_DB_URL);
console.log("Baza e2e gotowa.");
