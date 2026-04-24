import { randomBytes, randomUUID } from "crypto";
import { getDb } from "./db";
import { eq } from "drizzle-orm";
import { users, settings, subscriptions, creditTransactions } from "../shared/drizzle/schema";

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

      const loginCode = Math.floor(100000 + Math.random() * 900000).toString();
      const newExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

      if (user?.id) {
        await db.update(users).set({
          telegramCode: loginCode,
          telegramCodeExpiresAt: newExpiresAt,
        }).where(eq(users.id, user.id));
      } else {
        let isTrialActive = false;
        let trialCredits = 0;
        let trialDays = 7;
        
        try {
          const settingsRows = await db.select().from(settings);
          const settingsObj: Record<string, string> = {};
          for (const r of settingsRows) settingsObj[r.keyName] = r.value;
          
          const autoTrialEnabled = settingsObj.autoTrialEnabled === 'true';
          const enforceDate = settingsObj.trialEnabled === 'true';
          const isDateValid = !enforceDate || !settingsObj.trialStartDate || !settingsObj.trialEndDate || 
                              (new Date() >= new Date(settingsObj.trialStartDate) && new Date() <= new Date(settingsObj.trialEndDate));
                              
          if (autoTrialEnabled && isDateValid) {
            isTrialActive = true;
            trialCredits = parseInt(settingsObj.trialCredits) || 15;
            trialDays = 3650;
          }
        } catch {
        }

        const newUserId = randomBytes(16).toString("hex");

        await db.insert(users).values({
          id: newUserId,
          telegramId,
          telegramUsername: from.username || null,
          telegramFirstName: firstName,
          telegramCode: loginCode,
          telegramCodeExpiresAt: newExpiresAt,
          credits: trialCredits,
        });

        if (isTrialActive && trialCredits > 0) {
          await db.insert(subscriptions).values({
            id: randomUUID(),
            userId: newUserId,
            plan: "trial",
            startsAt: new Date(),
            expiresAt: new Date(Date.now() + trialDays * 86400000),
            note: "Auto Telegram Trial",
            paymentMethod: "free",
          });

          await db.insert(creditTransactions).values({
            id: randomUUID(),
            userId: newUserId,
            amount: trialCredits,
            type: "subscription",
            description: "Started free trial from Telegram bot",
          });
        }
      }

      const formattedMessage = `👋 မင်္ဂလာပါ ${firstName}!\n\nLUMIX Studio မှ ကြိုဆိုပါတယ်။ အကောင့်ဝင်ရန်အတွက် အောက်ပါ Verification Code ကို အသုံးပြုပေးပါ-\n\n🔢 Code: *${loginCode}*\n\n⏳ အချိန်ကန့်သတ်ချက်: ၁၀ မိနစ်အတွင်း အသုံးပြုရန်။\n\nကုဒ်အဆင်မပြေပါက သို့မဟုတ် သက်တမ်းကုန်သွားပါက /code ဟု ရိုက်နှိပ်ပြီး ကုဒ်အသစ် ထပ်မံရယူနိုင်ပါတယ်။`;
      await sendMessage(chatId, formattedMessage);

    } catch (error) {
      console.error("[Telegram Login Code Error]", error);
      await sendMessage(chatId, "⚠️ စနစ်တွင် အမှားအယွင်းရှိနေပါသည်။ ကျေးဇူးပြု၍ ခဏလောက်စောင့်ပြီးမှ ထပ်မံကြိုးစားကြည့်ပေးပါ။");
    }
  } else {
    await sendMessage(chatId, "Login code ရယူလိုပါက /code ဟု ရိုက်နှိပ်ပေးပါ။");
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
