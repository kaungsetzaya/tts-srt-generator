import { mysqlTable, varchar, timestamp, text, int } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(""),
  telegramId: varchar("telegram_id", { length: 50 }).unique(),
  telegramUsername: varchar("telegram_username", { length: 100 }),
  telegramFirstName: varchar("telegram_first_name", { length: 100 }),
  telegramCode: varchar("telegram_code", { length: 6 }),
  role: varchar("role", { length: 20 }).default("user"), // admin | user
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const subscriptions = mysqlTable("subscriptions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  plan: varchar("plan", { length: 50 }).notNull(), // trial | 1month | 3month | 6month | lifetime
  startsAt: timestamp("starts_at").notNull(),
  expiresAt: timestamp("expires_at"), // null = lifetime
  createdByAdmin: varchar("created_by_admin", { length: 36 }),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ttsConversions = mysqlTable("tts_conversions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }),
  text: text("text"),
  voice: varchar("voice", { length: 50 }),
  audioUrl: varchar("audio_url", { length: 500 }),
  srtContent: text("srt_content"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const settings = mysqlTable("settings", {
  keyName: varchar("key_name", { length: 100 }).primaryKey(),
  value: varchar("value", { length: 500 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
