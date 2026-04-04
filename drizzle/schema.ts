import { mysqlTable, varchar, timestamp, text } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(""),
  telegramId: varchar("telegram_id", { length: 50 }).unique(),
  telegramUsername: varchar("telegram_username", { length: 100 }),
  telegramFirstName: varchar("telegram_first_name", { length: 100 }),
  telegramCode: varchar("telegram_code", { length: 6 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
