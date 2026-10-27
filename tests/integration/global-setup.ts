import { assertTestDatabaseUrl, migrateDeploy, recreateDatabase } from "./db";

export default async function setup() {
  const url = assertTestDatabaseUrl(process.env.TEST_DATABASE_URL);
  await recreateDatabase(url);
  migrateDeploy(url);
}
