import { eq, desc, and, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { users, subscriptions, ttsConversions } from "../drizzle/schema";
import { nanoid } from "nanoid";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// Check if user has active subscription
export async function getUserSubscription(userId: string) {
  const db = await getDb();
  if (!db) return null;
  const now = new Date();
  const result = await db.select().from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        gte(subscriptions.expiresAt, now)
      )
    )
    .orderBy(desc(subscriptions.expiresAt))
    .limit(1);
  return result[0] ?? null;
}

// Get all users with their subscription status
export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
  const now = new Date();
  const allSubs = await db.select().from(subscriptions);

  return allUsers.map(u => {
    const activeSub = allSubs
      .filter(s => s.userId === u.id && s.expiresAt && s.expiresAt > now)
      .sort((a, b) => (b.expiresAt?.getTime() ?? 0) - (a.expiresAt?.getTime() ?? 0))[0];
    return { ...u, subscription: activeSub ?? null };
  });
}

// Create subscription for user
export async function createSubscription(data: {
  userId: string;
  plan: string;
  startsAt: Date;
  expiresAt: Date | null;
  createdByAdmin: string;
  note?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const id = nanoid(36);
  await db.insert(subscriptions).values({
    id,
    userId: data.userId,
    plan: data.plan,
    startsAt: data.startsAt,
    expiresAt: data.expiresAt,
    createdByAdmin: data.createdByAdmin,
    note: data.note ?? null,
  });
  return id;
}

// Get user by telegram code
export async function getUserByCode(code: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users)
    .where(eq(users.telegramCode, code)).limit(1);
  return result[0] ?? null;
}

// Get user by id
export async function getUserById(id: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users)
    .where(eq(users.id, id)).limit(1);
  return result[0] ?? null;
}

// Set user role
export async function setUserRole(userId: string, role: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

// Get user by OpenId (OAuth)
export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users)
    .where(eq(users.openId, openId)).limit(1);
  return result[0] ?? null;
}

// Upsert user (create or update)
export async function upsertUser(data: {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  lastSignedIn?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  
  const existing = await db.select().from(users)
    .where(eq(users.openId, data.openId)).limit(1);
  
  if (existing.length > 0) {
    // Update existing user
    const userId = existing[0].id;
    const updateData: any = {
      lastSignedIn: data.lastSignedIn || new Date(),
      updatedAt: new Date(),
    };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.loginMethod !== undefined) updateData.loginMethod = data.loginMethod;
    
    await db.update(users).set(updateData).where(eq(users.id, userId));
    return await getUserById(userId);
  } else {
    // Insert new user
    const { nanoid } = await import("nanoid");
    const userId = nanoid(36);
    await db.insert(users).values({
      id: userId,
      openId: data.openId,
      name: data.name || null,
      email: data.email || null,
      loginMethod: data.loginMethod || null,
      lastSignedIn: data.lastSignedIn || new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return await getUserById(userId);
  }
}
