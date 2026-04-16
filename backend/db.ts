import { randomBytes } from "crypto";

// Simple mock database for session and user management
// Replace with a real database (e.g., SQLite, PostgreSQL) for production
export const db = {
  sessions: new Map<string, any>(),
  users: new Map<string, any>(),
};

export function generateSessionId(): string {
  return randomBytes(18).toString("hex");
}

export function generateUserId(): string {
  return randomBytes(18).toString("hex");
}
