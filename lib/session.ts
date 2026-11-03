import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * Read and verify the session from the headers of the current request.
 * Call during request handling — never at module initialisation.
 */
export async function getCurrentSession() {
  return auth.api.getSession({ headers: await headers() });
}
