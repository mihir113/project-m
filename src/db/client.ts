import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// This tells TypeScript how to handle the global object to prevent 
// multiple pool instances during hot-reloads in development.
const globalForDb = global as unknown as {
  pool: Pool | undefined;
};

// Ensure the connection string has ?pgbouncer=true for optimal pooling
function ensurePgBouncerParam(url: string): string {
  if (!url) return url;
  const hasParam = url.includes("?pgbouncer=true") || url.includes("&pgbouncer=true");
  if (hasParam) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}pgbouncer=true`;
}

// Use the existing pool or create a new one
export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: ensurePgBouncerParam(process.env.DATABASE_URL!),
    max: 10,
    // Add SSL for production (usually required by Neon/Vercel/Supabase)
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool);