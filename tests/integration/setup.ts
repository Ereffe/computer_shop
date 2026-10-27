import { assertTestDatabaseUrl } from "./db";

// lib/prisma.ts czyta DATABASE_URL: w testach zawsze wskazuje bazę testową.
process.env.DATABASE_URL = assertTestDatabaseUrl(process.env.TEST_DATABASE_URL);
