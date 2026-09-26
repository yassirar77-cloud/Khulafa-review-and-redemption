import "./env";
import { readFileSync } from "fs";
import { join } from "path";
import { db } from "../src/lib/db";

async function main() {
  const sql = db();
  await sql.unsafe(readFileSync(join(__dirname, "..", "db", "schema.sql"), "utf8"));
  console.log("Database schema is up to date.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
