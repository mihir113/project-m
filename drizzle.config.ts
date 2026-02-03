import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

export default {
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // We use "push" mode — it syncs your schema directly to Supabase
  // without needing migration files on disk. Simple and clean.
} satisfies Config;
