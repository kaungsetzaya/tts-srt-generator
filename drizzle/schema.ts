import { mysqlTable, varchar, timestamp, text, int } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(""),
  telegramId: varchar("telegram_id", { length: 50 }).unique(),
  telegramUsername: varchar("telegram_username", { length: 100 }),
  telegramFirstName: varchar("telegram_first_name", { length: 100 }),
  telegramCode: varchar("telegram_code", { length: 6 }),
  role: varchar("role", { length: 20 }).default("user"),
  bannedAt: timestamp("banned_at"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const subscriptions = mysqlTable("subscriptions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  plan: varchar("plan", { length: 50 }).notNull(),
  startsAt: timestamp("starts_at").notNull(),
  expiresAt: timestamp("expires_at"),
  createdByAdmin: varchar("created_by_admin", { length: 36 }),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ttsConversions = mysqlTable("tts_conversions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }),
  voice: varchar("voice", { length: 50 }),
  charCount: int("char_count").default(0),
  durationMs: int("duration_ms").default(0),
  aspectRatio: varchar("aspect_ratio", { length: 10 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const settings = mysqlTable("settings", {
  keyName: varchar("key_name", { length: 100 }).primaryKey(),
  value: varchar("value", { length: 500 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
