import { randomBytes } from "crypto";

export async function handleTelegramUpdate(update: any) {
  console.log("[Telegram Bot] Handling update:", update);
}

export async function setWebhook(url: string) {
  console.log("[Telegram Bot] Setting webhook to:", url);
}


export function generateTelegramId(): string {
  return randomBytes(18).toString("hex");
}
