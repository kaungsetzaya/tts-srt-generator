import { randomBytes } from "crypto";
import mysql from "mysql2/promise";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import * as schema from "../drizzle/schema";
import * as relations from "../drizzle/relations";

// Merge schema + relations for Drizzle's query API (db.query.*)
const fullSchema = { ...schema, ...relations };

let _db: MySql2Database<typeof schema> | null = null;

export async function getDb() {
  if (_db) return _db;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[DB] DATABASE_URL not set");
    return null;
  }

  try {
    const pool = mysql.createPool(connectionString);
    _db = drizzle(pool, { schema: fullSchema, mode: "default" });
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

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db.select().from(schema.users)
      .where(eq(schema.users.openId, openId)).limit(1);
    return rows[0] || null;
  } catch {
    return null;
  }
}

export async function upsertUser(data: {
  id: string;
  telegramId?: string;
  telegramFirstName?: string;
  telegramUsername?: string;
  name?: string;
  role?: string;
  openId?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db.select().from(schema.users)
    .where(eq(schema.users.id, data.id)).limit(1);
  if (existing.length > 0) {
    const updateData: Record<string, any> = {};
    if (data.telegramFirstName) updateData.telegramFirstName = data.telegramFirstName;
    if (data.telegramUsername) updateData.telegramUsername = data.telegramUsername;
    if (data.openId) updateData.openId = data.openId;
    if (data.name) updateData.name = data.name;
    if (Object.keys(updateData).length > 0) {
      await db.update(schema.users).set(updateData).where(eq(schema.users.id, data.id));
    }
    return existing[0];
  }
  await db.insert(schema.users).values({
    id: data.id,
    telegramId: data.telegramId ?? null,
    telegramFirstName: data.telegramFirstName ?? null,
    telegramUsername: data.telegramUsername ?? null,
    role: data.role ?? "user",
    openId: data.openId ?? null,
    name: data.name ?? null,
  });
  return (await db.select().from(schema.users).where(eq(schema.users.id, data.id)).limit(1))[0];
}