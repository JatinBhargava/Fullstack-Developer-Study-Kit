// Applies db/schema.sql to the database in DATABASE_URL.
//   vercel env pull .env.local && npm run db:migrate
import { readFileSync, existsSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

for (const f of [".env.local", ".env"]) {
  if (existsSync(f)) process.loadEnvFile(f);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Run `vercel env pull .env.local` first.");
  process.exit(1);
}

const sql = neon(url);
const statements = readFileSync(new URL("./schema.sql", import.meta.url), "utf8")
  .replace(/--.*$/gm, "")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

for (const s of statements) await sql.query(s);
console.log(`Applied ${statements.length} statements.`);
