import { mysqlTable, varchar, timestamp, text, int, boolean } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(""),
  telegramId: varchar("telegram_id", { length: 50 }).unique(),
  telegramUsername: varchar("telegram_username", { length: 100 }),
  telegramFirstName: varchar("telegram_first_name", { length: 100 }),
  telegramCode: varchar("telegram_code", { length: 6 }),
  // 🔐 Dynamic OTP — code expiry (10 minutes)
  telegramCodeExpiresAt: timestamp("telegram_code_expires_at"),
  role: varchar("role", { length: 20 }).default("user"),
  bannedAt: timestamp("banned_at"),
  // 🔐 One-Device Session — login တိုင်း token အသစ်ထုတ်ပြီး JWT ထဲ ထည့်သည်
  sessionToken: varchar("session_token", { length: 36 }),
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
  paymentMethod: varchar("payment_method", { length: 30 }),
  paymentSlip: text("payment_slip"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ttsConversions = mysqlTable("tts_conversions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }),
  // Feature type: "tts" | "video_upload" | "video_link"
  feature: varchar("feature", { length: 30 }).default("tts"),
  voice: varchar("voice", { length: 50 }),
  // For character voices (ryan, michelle, etc.)
  character: varchar("character", { length: 50 }),
  charCount: int("char_count").default(0),
  durationMs: int("duration_ms").default(0),
  // Video duration in seconds (for video feature)
  videoDurationSec: int("video_duration_sec").default(0),
  aspectRatio: varchar("aspect_ratio", { length: 10 }),
  // success | fail
  status: varchar("status", { length: 10 }).default("success"),
  errorMsg: varchar("error_msg", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const errorLogs = mysqlTable("error_logs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }),
  feature: varchar("feature", { length: 30 }),
  errorCode: varchar("error_code", { length: 50 }),
  errorMessage: text("error_message"),
  stackTrace: text("stack_trace"),
  severity: varchar("severity", { length: 10 }).default("error"),
  resolved: boolean("resolved").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const settings = mysqlTable("settings", {
  keyName: varchar("key_name", { length: 100 }).primaryKey(),
  value: varchar("value", { length: 500 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
