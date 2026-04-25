import { mysqlTable, varchar, timestamp, text, int, boolean, datetime, check } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(""),
  telegramId: varchar("telegram_id", { length: 50 }).unique(),
  telegramUsername: varchar("telegram_username", { length: 100 }),
  telegramFirstName: varchar("telegram_first_name", { length: 100 }),
  telegramCode: varchar("telegram_code", { length: 6 }),
  // 🔐 Dynamic OTP — code expiry (10 minutes)
  telegramCodeExpiresAt: datetime("telegram_code_expires_at"),
  role: varchar("role", { length: 20 }).default("user"),
  bannedAt: datetime("banned_at"),
  credits: int("credits").default(0),
  // 🔐 One-Device Session — login token ကွဲ JWT ထဲ ထည့်ထား
  sessionToken: varchar("session_token", { length: 36 }),
  lastLoginAt: datetime("last_login_at"),
  // OAuth fields
  openId: varchar("open_id", { length: 255 }).unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  loginMethod: varchar("login_method", { length: 50 }),
  lastSignedIn: datetime("last_signed_in"),
  // 🔐 Trial grant gate — prevents double-grant across bot + auth paths
  trialGrantedAt: datetime("trial_granted_at"),
  createdAt: datetime("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: datetime("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
}, (table) => ({
  creditsNonNegative: check("credits_non_negative", sql`${table.credits} >= 0`),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const subscriptions = mysqlTable("subscriptions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  plan: varchar("plan", { length: 50 }).notNull(),
  startsAt: datetime("starts_at").notNull(),
  expiresAt: datetime("expires_at"),
  createdByAdmin: varchar("created_by_admin", { length: 36 }),
  paymentMethod: varchar("payment_method", { length: 30 }),
  paymentSlip: text("payment_slip"),
  note: text("note"),
  createdAt: datetime("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

export const ttsConversions = mysqlTable("tts_conversions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }),
  // Feature type: "tts" | "video_upload" | "video_link"
  feature: varchar("feature", { length: 30 }).default("tts"),
  voice: varchar("voice", { length: 50 }),
  // For character voices (ryan, michelle, etc.)
  character: varchar("character", { length: 50 }),
  text: text("text"),
  inputText: text("input_text"),
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
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const settings = mysqlTable("settings", {
  keyName: varchar("key_name", { length: 100 }).primaryKey(),
  value: varchar("value", { length: 500 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Credits tracking
export const creditTransactions = mysqlTable("credit_transactions", {
  id: varchar("id", { length: 36 }).primaryKey().default(""),
  userId: varchar("user_id", { length: 36 }).notNull(),
  amount: int("amount").notNull(), // positive = add, negative = deduct
  type: varchar("type", { length: 50 }).notNull(), // 'trial', 'purchase', 'tts', 'video_translate', 'video_dub'
  description: varchar("description", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Immutable audit log for admin actions
export const auditLogs = mysqlTable("audit_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(""),
  action: varchar("action", { length: 100 }).notNull(),
  adminId: varchar("admin_id", { length: 36 }).notNull(),
  targetUserId: varchar("target_user_id", { length: 36 }).notNull(),
  details: text("details"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Persistent job storage (survives server restarts)
export const ttsJobs = mysqlTable("tts_jobs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  type: varchar("type", { length: 30 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  progress: int("progress").notNull().default(0),
  message: varchar("message", { length: 500 }).default(""),
  inputJson: text("input_json"),
  resultJson: text("result_json"),
  error: varchar("error", { length: 1000 }),
  userId: varchar("user_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
