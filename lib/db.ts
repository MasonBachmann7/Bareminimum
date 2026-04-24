import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// `neon(...)` returns a tagged-template function that runs each statement
// over HTTP — perfect for edge / serverless routes. For multi-statement
// transactions use `neon` with `.transaction()` or switch to the pooled pg.
export const sql = neon(connectionString);
