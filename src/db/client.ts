import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Pool reuses database connections — critical for serverless environments like Next.js on Vercel.
// Without pooling, each API request would open and close a new connection (slow and wasteful).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 10, // max 10 concurrent connections in the pool
});

export const db = drizzle({ client: pool });