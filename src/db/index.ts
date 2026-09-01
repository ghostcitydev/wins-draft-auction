import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  var __dbClient: ReturnType<typeof postgres> | undefined;
  var __drizzleDb: Db | undefined;
}

/**
 * Lazily creates the client/drizzle instance on first real use, instead of
 * at module-import time. This matters because ESM hoists `import` statements
 * ahead of any other code in the importing file - so a script that does
 * `import "dotenv/config"` followed by `import { db } from "./db"` actually
 * runs the db import *first*, before its own env-loading code, and would
 * always see DATABASE_URL as unset if this module read it eagerly. Reading
 * it lazily (here, on the first `db.<method>()` call) sidesteps that
 * entirely, regardless of which tool loaded the env vars or when.
 */
function getDb(): Db {
  if (global.__drizzleDb) return global.__drizzleDb;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local (dev) or your Vercel project's environment variables (production) before making any DB calls."
    );
  }

  const client =
    global.__dbClient ??
    postgres(connectionString, {
      max: process.env.NODE_ENV === "production" ? 5 : 1,
      connect_timeout: 10,
    });

  // Always cache on `global`, in prod too. Vercel reuses warm serverless
  // containers across invocations, so *not* caching here meant every single
  // db.<method>() call (the Proxy below calls getDb() on every property
  // access) spun up a brand-new postgres connection pool that was never
  // closed - a real connection leak that grows with traffic until Neon's
  // connection limit is hit and every query starts failing, which is almost
  // certainly what's been causing the recurring "Couldn't load standings"
  // errors (not the sync logic those errors were originally blamed on).
  global.__dbClient = client;

  const instance = drizzle(client, { schema });
  global.__drizzleDb = instance;
  return instance;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    // Methods on the drizzle instance rely on their own internal `this`
    // (query builders, session state, etc.) - binding to the real instance
    // (not this Proxy) keeps that working correctly.
    return typeof value === "function" ? value.bind(real) : value;
  },
});
