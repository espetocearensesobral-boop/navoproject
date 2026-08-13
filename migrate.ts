import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const runMigrate = async () => {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error("❌ DATABASE_URL is not defined in environment variables.");
    console.error("Please set DATABASE_URL with your Supabase connection string.");
    process.exit(1);
  }

  console.log("🚀 Running migrations...");
  
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);

  try {
    await migrate(db, { migrationsFolder: "drizzle" });
    console.log("✅ Migrations complete!");
  } catch (err) {
    console.error("❌ Migration failed!", err);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
};

runMigrate();
