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
        await sendMessage(chatId, "Ã¢Å¡Â Ã¯Â¸Â Database unavailable.");
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
            trialDays = 3650; // Lifetime (10 years) for credit-based system
          }
        } catch {
          // default to no trial
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
          // 1) Add Subscription
          await db.insert(subscriptions).values({
            id: randomUUID(),
            userId: newUserId,
            plan: "trial",
            startsAt: new Date(),
            expiresAt: new Date(Date.now() + trialDays * 86400000),
            note: "Auto Telegram Trial",
            paymentMethod: "free",
          });

          // 2) Log Credit Transaction
          await db.insert(creditTransactions).values({
            id: randomUUID(),
            userId: newUserId,
            amount: trialCredits,
            type: "subscription",
            description: "Started free trial from Telegram bot",
          });
        }
      }

      const formattedMessage = `Ã°Å¸â€˜â€¹ Ã¡â‚¬â„¢Ã¡â‚¬â€žÃ¡â‚¬ÂºÃ¡â‚¬Â¹Ã¡â‚¬â€šÃ¡â‚¬Å“Ã¡â‚¬Â¬Ã¡â‚¬â€¢Ã¡â‚¬Â«, ${firstName}!\n\nÃ°Å¸â€â€˜ *Ã¡â‚¬Å¾Ã¡â‚¬â€žÃ¡â‚¬Â·Ã¡â‚¬Âº login code:*\n\n\`${loginCode}\`\n\nÃ¢ÂÂ° Code Ã¡â‚¬Å¾Ã¡â‚¬â‚¬Ã¡â‚¬ÂºÃ¡â‚¬ÂÃ¡â‚¬â„¢Ã¡â‚¬ÂºÃ¡â‚¬Â¸: *Ã¡ÂÂÃ¡Ââ‚¬ Ã¡â‚¬â„¢Ã¡â‚¬Â­Ã¡â‚¬â€Ã¡â‚¬â€¦Ã¡â‚¬Âº*\nÃ¡â‚¬â€™Ã¡â‚¬Â® code Ã¡â‚¬â‚¬Ã¡â‚¬Â­Ã¡â‚¬Â¯ ${APP_URL} Ã¡â‚¬â„¢Ã¡â‚¬Â¾Ã¡â‚¬Â¬ login Ã¡â‚¬ÂÃ¡â‚¬â€žÃ¡â‚¬ÂºÃ¡â‚¬â€“Ã¡â‚¬Â­Ã¡â‚¬Â¯Ã¡â‚¬Â· Ã¡â‚¬Å¾Ã¡â‚¬Â¯Ã¡â‚¬Â¶Ã¡â‚¬Â¸Ã¡â‚¬â€¢Ã¡â‚¬Â«Ã¡Ââ€¹\n\nÃ¢Å¡Â Ã¯Â¸Â Code Ã¡â‚¬Å¾Ã¡â‚¬â‚¬Ã¡â‚¬ÂºÃ¡â‚¬ÂÃ¡â‚¬â„¢Ã¡â‚¬ÂºÃ¡â‚¬Â¸Ã¡â‚¬â‚¬Ã¡â‚¬Â¯Ã¡â‚¬â€Ã¡â‚¬ÂºÃ¡â‚¬â€ºÃ¡â‚¬â€žÃ¡â‚¬Âº /code Ã¡â‚¬â‚¬Ã¡â‚¬Â­Ã¡â‚¬Â¯ Ã¡â‚¬â€˜Ã¡â‚¬â€¢Ã¡â‚¬ÂºÃ¡â‚¬â€Ã¡â‚¬Â¾Ã¡â‚¬Â­Ã¡â‚¬â€¢Ã¡â‚¬ÂºÃ¡â‚¬â€¢Ã¡â‚¬Â«!`;
      await sendMessage(chatId, formattedMessage);

    } catch (error) {
      console.error("[Telegram Login Code Error]", error);
      await sendMessage(chatId, "Ã¢ÂÅ’ Ã¡â‚¬Â¡Ã¡â‚¬â„¢Ã¡â‚¬Â¾Ã¡â‚¬Â¬Ã¡â‚¬Â¸Ã¡â‚¬ÂÃ¡â‚¬â€¦Ã¡â‚¬ÂºÃ¡â‚¬ÂÃ¡â‚¬Â¯Ã¡â‚¬ÂÃ¡â‚¬Â¯Ã¡â‚¬â€“Ã¡â‚¬Â¼Ã¡â‚¬â€¦Ã¡â‚¬ÂºÃ¡â‚¬Å¾Ã¡â‚¬Â½Ã¡â‚¬Â¬Ã¡â‚¬Â¸Ã¡â‚¬â€¢Ã¡â‚¬Â«Ã¡â‚¬ÂÃ¡â‚¬Å¡Ã¡â‚¬ÂºÃ¡Ââ€¹ Ã¡â‚¬ÂÃ¡â‚¬ÂÃ¡â‚¬â€Ã¡â‚¬Â±Ã¡â‚¬â„¢Ã¡â‚¬Â¾ Ã¡â‚¬â€˜Ã¡â‚¬â€¢Ã¡â‚¬ÂºÃ¡â‚¬â‚¬Ã¡â‚¬Â¼Ã¡â‚¬Â­Ã¡â‚¬Â¯Ã¡â‚¬Â¸Ã¡â‚¬â€¦Ã¡â‚¬Â¬Ã¡â‚¬Â¸Ã¡â‚¬â‚¬Ã¡â‚¬Â¼Ã¡â‚¬Å Ã¡â‚¬Â·Ã¡â‚¬ÂºÃ¡â‚¬â€¢Ã¡â‚¬Â±Ã¡â‚¬Â¸Ã¡â‚¬â€¢Ã¡â‚¬Â«Ã¡Ââ€¹");
    }
  } else {
    await sendMessage(chatId, "login code Ã¡â‚¬â€ºÃ¡â‚¬Å¡Ã¡â‚¬Â°Ã¡â‚¬â€“Ã¡â‚¬Â­Ã¡â‚¬Â¯Ã¡â‚¬Â· /code Ã¡â‚¬â‚¬Ã¡â‚¬Â­Ã¡â‚¬Â¯ Ã¡â‚¬â€ºÃ¡â‚¬Â­Ã¡â‚¬Â¯Ã¡â‚¬â‚¬Ã¡â‚¬ÂºÃ¡â‚¬â€¢Ã¡â‚¬Â±Ã¡â‚¬Â¸Ã¡â‚¬â€¢Ã¡â‚¬Â«Ã¡Ââ€¹");
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
