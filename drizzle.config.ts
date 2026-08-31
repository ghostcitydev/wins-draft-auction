import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit only auto-loads a plain `.env` file, not `.env.local` (the
// Next.js/Vercel convention this project's README tells you to use) - load
// it explicitly so `db:push`/`db:generate` see DATABASE_URL.
loadEnv({ path: ".env.local" });
loadEnv();

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Add it to .env.local (see .env.example) before running drizzle-kit."
  );
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
