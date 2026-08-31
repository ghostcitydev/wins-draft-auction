import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __dbClient: ReturnType<typeof postgres> | undefined;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString && process.env.NODE_ENV !== "test") {
  // Don't throw here - this module is imported at build time (Next.js route
  // collection) even when nothing actually queries the DB yet. Only fail
  // when a query is attempted, with a clear message.
  console.warn(
    "[db] DATABASE_URL is not set. Set it in .env.local (dev) or your Vercel project's env vars (production) before making any DB calls."
  );
}

const client =
  global.__dbClient ??
  postgres(connectionString ?? "postgres://placeholder:placeholder@localhost:5432/placeholder", {
    max: process.env.NODE_ENV === "production" ? 5 : 1,
    connect_timeout: 5,
  });

if (process.env.NODE_ENV !== "production") global.__dbClient = client;

export const db = drizzle(client, { schema });
