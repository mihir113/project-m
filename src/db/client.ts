import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// This tells TypeScript how to handle the global object to prevent 
// multiple pool instances during hot-reloads in development.
const globalForDb = global as unknown as {
  pool: Pool | undefined;
};

// Use the existing pool or create a new one
export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL!,
    max: 10,
    // Add SSL for production (usually required by Neon/Vercel/Supabase)
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool);