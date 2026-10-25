import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // For a hosted database that requires TLS, configure SSL according to its provider.
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error.message);
});
