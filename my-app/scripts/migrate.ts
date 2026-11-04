process.loadEnvFile(".env");
import { readFileSync } from "fs";
import { join } from "path";
import { getPool } from "../lib/db";

async function migrate() {
  const schema = readFileSync(join(process.cwd(), "lib/schema.sql"), "utf8");

  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const pool = getPool();

  try {
    for (const statement of statements) {
      await pool.query(statement);
    }
    console.log(`✅ Applied ${statements.length} statements from lib/schema.sql`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
