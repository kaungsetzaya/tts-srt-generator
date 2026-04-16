import { randomBytes } from "crypto";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (_db) return _db;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[DB] DATABASE_URL not set");
    return null;
  }

  try {
    const pool = mysql.createPool(connectionString);
    _db = drizzle(pool, { schema, mode: "default" });
    console.log("[DB] Connected to database");
    return _db;
  } catch (err) {
    console.error("[DB] Connection failed:", err);
    return null;
  }
}

export function generateSessionId(): string {
  return randomBytes(18).toString("hex");
}

export function generateUserId(): string {
  return randomBytes(18).toString("hex");
}
