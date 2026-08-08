import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

export async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not defined");
  }
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: "drizzle" });
  await sql.end();
}
