import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let cached: ReturnType<typeof drizzle<typeof schema>> | undefined;

// Created on first use so that builds without DATABASE_URL still succeed.
export function db() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Add it to web/.env.local or the Vercel project.");
  }
  cached = drizzle(neon(url), { schema });
  return cached;
}
