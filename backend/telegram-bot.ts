import { randomBytes } from "crypto";

// Simple mock telegram bot for notifications
// Replace with a real telegram bot (e.g., telegraf) for production
export const telegramBot = {
  sendMessage: async (chatId: string, text: string) => {
    console.log(`[Telegram Bot] Sending message to ${chatId}: ${text}`);
  },
};

export function generateTelegramId(): string {
  return randomBytes(18).toString("hex");
}
