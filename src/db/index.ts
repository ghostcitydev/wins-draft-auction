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

  if (process.env.NODE_ENV !== "production") global.__dbClient = client;

  const instance = drizzle(client, { schema });
  if (process.env.NODE_ENV !== "production") global.__drizzleDb = instance;
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
