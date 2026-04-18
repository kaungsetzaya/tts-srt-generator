import { randomBytes } from "crypto";
import { getDb } from "./db";
import { eq } from "drizzle-orm";
import { users, settings } from "../drizzle/schema";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const APP_URL = process.env.APP_URL || "https://lumix-studio.vercel.app";

async function sendMessage(chatId: number, text: string) {
  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error(`[Telegram Send Error] ${data.description}`);
    }
    return data;
  } catch (err) {
    console.error(`[Telegram Send Error]`, err);
  }
}

export async function handleTelegramUpdate(update: any) {
  const message = update?.message;
  if (!message) return;

  const chatId = message.chat.id;
  const text = (message.text || "").trim();
  const from = message.from;

  if (text === "/start" || text === "/code") {
    try {
      const db = await getDb();
      if (!db) {
        await sendMessage(chatId, "⚠️ Database unavailable.");
        return;
      }

      const telegramId = from.id.toString();
      const firstName = from.first_name || "User";

      let user = await db.query.users.findFirst({
        where: (u: any, { eq }: any) => eq(u.telegramId, telegramId),
        columns: {
          id: true,
          telegramCode: true,
          telegramCodeExpiresAt: true,
        },
      });

      // ALWAYS generate a new code for every request to ensure it works
      const loginCode = Math.floor(100000 + Math.random() * 900000).toString();
      const newExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

      if (user?.id) {
        await db.update(users).set({
          telegramCode: loginCode,
          telegramCodeExpiresAt: newExpiresAt,
        }).where(eq(users.id, user.id));
      } else {
        // Check trial settings - give trial credits to new users if enabled
        let trialCredits = 0;
        try {
          const settingsRows = await db.select().from(settings);
          const settingsObj: Record<string, string> = {};
          for (const r of settingsRows) settingsObj[r.keyName] = r.value;
          
          const autoTrialEnabled = settingsObj.autoTrialEnabled === 'true';
          if (autoTrialEnabled) {
            trialCredits = parseInt(settingsObj.trialCredits) || 15;
          }
        } catch {
          trialCredits = 0; // default to 0 if settings failed
        }

        await db.insert(users).values({
          id: randomBytes(16).toString("hex"),
          telegramId,
          telegramUsername: from.username || null,
          telegramFirstName: firstName,
          telegramCode: loginCode,
          telegramCodeExpiresAt: newExpiresAt,
          credits: trialCredits,
        });
      }

      const formattedMessage = `👋 မင်္ဂလာပါ, ${firstName}!\n\n🔑 *သင့် login code:*\n\n\`${loginCode}\`\n\n⏰ Code သက်တမ်း: *၁၀ မိနစ်*\nဒီ code ကို ${APP_URL} မှာ login ဝင်ဖို့ သုံးပါ။\n\n⚠️ Code သက်တမ်းကုန်ရင် /code ကို ထပ်နှိပ်ပါ!`;
      await sendMessage(chatId, formattedMessage);

    } catch (error) {
      console.error("[Telegram Login Code Error]", error);
      await sendMessage(chatId, "❌ အမှားတစ်ခုခုဖြစ်သွားပါတယ်။ ခဏနေမှ ထပ်ကြိုးစားကြည့်ပေးပါ။");
    }
  } else {
    await sendMessage(chatId, "login code ရယူဖို့ /code ကို ရိုက်ပေးပါ။");
  }
}

export async function setWebhook(url: string) {
  try {
    const res = await fetch(`${TELEGRAM_API}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    console.log("[Telegram Bot] Webhook set:", data);
  } catch (err) {
    console.error("[Telegram Bot] Error setting webhook:", err);
  }
}

export function generateTelegramId(): string {
  return randomBytes(18).toString("hex");
}
