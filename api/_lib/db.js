import { neon } from "@neondatabase/serverless";

let client;

// Neon's HTTP driver: one round trip per query, no pool to manage.
export function db() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    client = neon(url);
  }
  return client;
}
