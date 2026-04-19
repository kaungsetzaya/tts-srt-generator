import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { sql, ne } from "drizzle-orm";
import { users, ttsConversions, subscriptions, creditTransactions, ttsJobs, errorLogs } from "../drizzle/schema";

async function runReset() {
  console.log("⚠️ STARTING DATABASE RESET FOR PRODUCTION LAUNCH ⚠️");
  
  if (!process.env.DATABASE_URL) {
    console.error("No DATABASE_URL set.");
    process.exit(1);
  }

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection);

  try {
    console.log("1/6 Clearing TTS Conversions...");
    await db.delete(ttsConversions);

    console.log("2/6 Clearing Credit Transactions...");
    await db.delete(creditTransactions);

    console.log("3/6 Clearing Subscriptions...");
    await db.delete(subscriptions);

    console.log("4/6 Clearing TTS Jobs...");
    await db.delete(ttsJobs);

    console.log("5/6 Clearing Error Logs...");
    await db.delete(errorLogs);

    console.log("6/6 Deleting all non-Admin Users...");
    await db.delete(users).where(ne(users.role, "admin"));

    console.log("✅ DATABASE RESET COMPLETE.");
    console.log("Admin accounts were preserved. All test data wiped.");
  } catch (error) {
    console.error("❌ Reset Error:", error);
  } finally {
    await connection.end();
    process.exit(0);
  }
}

runReset();
