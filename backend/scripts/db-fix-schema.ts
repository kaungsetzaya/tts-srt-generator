import "dotenv/config";
import mysql from "mysql2/promise";

async function run() {
  console.log("==========================================");
  console.log("   DATABASE SCHEMA MIGRATION FIX");
  console.log("==========================================\n");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[ERROR] DATABASE_URL not set");
    process.exit(1);
  }

  const connection = await mysql.createConnection(connectionString);
  console.log("[INFO] Connected to MySQL.");

  try {
    // 1. Add resolved_at to error_logs if missing
    console.log("[1/2] Checking error_logs table...");
    const [columns]: any = await connection.query("SHOW COLUMNS FROM error_logs");
    const hasResolvedAt = columns.some((c: any) => c.Field === "resolved_at");
    
    if (!hasResolvedAt) {
      console.log("[Action] Adding 'resolved_at' column to error_logs...");
      await connection.query("ALTER TABLE error_logs ADD COLUMN resolved_at TIMESTAMP NULL DEFAULT NULL AFTER resolved");
      console.log("[Success] Column added.");
    } else {
      console.log("[Skip] 'resolved_at' already exists.");
    }

    // 2. Ensure credit_transactions table is ready
    console.log("[2/2] Checking credit_transactions table...");
    // Just a sanity check to make sure it exists
    try {
      await connection.query("SELECT 1 FROM credit_transactions LIMIT 1");
      console.log("[Skip] 'credit_transactions' exists.");
    } catch {
      console.log("[Action] Creating 'credit_transactions' table...");
      await connection.query(`
        CREATE TABLE IF NOT EXISTS credit_transactions (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          amount INT NOT NULL,
          type VARCHAR(50) NOT NULL,
          description VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("[Success] Table created.");
    }

  } catch (err) {
    console.error("[CRITICAL ERROR]", err);
  } finally {
    await connection.end();
  }

  console.log("\n==========================================");
  console.log("   MIGRATION COMPLETE");
  console.log("==========================================");
  process.exit(0);
}

run();
