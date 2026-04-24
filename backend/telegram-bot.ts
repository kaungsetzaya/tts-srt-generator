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
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.normalize("NFC"),
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
        await sendMessage(chatId, "\u26A0\uFE0F Database unavailable.");
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

      // Unicode escaped Burmese and Emojis
      const formattedMessage = "\uD83D\uDC4B \u1019\u1004\u1039\u1038\u101c\u102c\u1015\u102b " + firstName + "!\n\nLUMIX Studio \u1019\u103E \u1000\u103C\u102D\u102F\u1005\u102D\u102F\u1015\u102B\u1010\u101A\u103A\u104B \u1021\u1000\u1031\u102C\u1004\u1037\u103A\u101D\u1004\u103A\u101B\u102C\u1014\u103A \u1021\u1010\u103D\u1000\u103A\u1015\u102B \u1021\u1031\u102C\u1000\u103A\u1015\u102B Verification Code \u1000\u102D\u102F \u1021\u101E\u1030\u1038\u1015\u1031\u1038\u1015\u102B-\n\n\uD83D\uDD22 Code: " + loginCode + "\n\n\u23F3 \u1021\u1001\u102D\u1014\u103A\u1000\u1014\u103A\u1037\u101E\u1010\u103A\u1001\u1031\u1000\u103A: \u1041\u1040 \u1019\u102D\u1014\u1005\u103A\u1021\u1010\u103D\u1004\u103A\u1038 \u1021\u101E\u1030\u1038\u101B\u102C\u1014\u103A\u104B\n\n\u1000\u1030\u1012\u103A\u1021\u1006\u1004\u103A\u1019\u1015\u103C\u1031\u1015\u102B\u1000 \u101E\u102D\u102F\u1037\u1019\u101F\u102F\u1010\u103A \u101E\u1000\u103A\u1010\u1019\u103A\u1038\u1000\u102F\u1014\u103A\u101E\u103D\u102C\u1038\u1015\u102B\u1000 /code \u101F\u102F \u101B\u102D\u102F\u1000\u103A\u1014\u103A\u1037\u1015\u102B\u1038 \u1000\u1030\u1012\u103A\u1021\u101E\u1005\u103A \u1011\u1015\u103A\u1019\u1036\u1038 \u101B\u101A\u1030\u1014\u102D\u102F\u1004\u103A\u1015\u102B\u1010\u101A\u103A\u104B";
      await sendMessage(chatId, formattedMessage);

    } catch (error) {
      console.error("[Telegram Login Code Error]", error);
      await sendMessage(chatId, "\u26A0\uFE0F \u1005\u1014\u1005\u103A\u1000\u103D\u1004\u103A \u1021\u1019\u103E\u102C\u1021\u101A\u103D\u1004\u103A\u1038\u101B\u103E\u102D\u1014\u1031\u1015\u102B\u101E\u100A\u103A\u104B \u1000\u103B\u1031\u1038\u1007\u1030\u1038\u1015\u103C\u102F\u1037 \u1001\u1014\u102C\u101c\u1031\u102C\u1000\u103A\u1005\u1031\u102C\u1004\u1037\u103A\u1015\u103C\u102E\u1038\u1019\u103E \u1011\u1015\u103A\u1019\u1036\u1038\u1000\u103C\u102F\u1038\u1005\u102C\u1038\u1000\u103C\u100A\u1037\u103A\u1015\u1031\u1038\u1015\u102B\u104B");
    }
  } else {
    await sendMessage(chatId, "Login code \u101B\u101A\u1030\u101c\u102D\u102F\u1015\u102B\u1000 /code \u101F\u102F \u101B\u102D\u102F\u1000\u103A\u1014\u103A\u1037\u1015\u102B\u1038\u104B");
  }
}

export async function setWebhook(url: string) {
  try {
    const res = await fetch(`${TELEGRAM_API}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
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
