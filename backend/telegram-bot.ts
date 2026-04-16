import https from "https";
import { getDb } from "./db";
import { users, subscriptions, settings } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

// 🔐 Dynamic OTP: Generate new 6-digit code every time with 10-minute expiry
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getCodeExpiry(): Date {
  return new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
}

async function telegramPost(method: string, body: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(`${API_BASE}/${method}`);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    }, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => resolve(JSON.parse(body)));
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function sendMessage(chatId: number, text: string) {
  return telegramPost("sendMessage", { chat_id: chatId, text, parse_mode: "HTML" });
}

export async function handleTelegramUpdate(update: any) {
  const message = update.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const telegramId = message.from.id.toString();
  const firstName = message.from.first_name ?? "User";
  const username = message.from.username ?? "";
  const text = message.text.trim();

  const db = await getDb();
  if (!db) {
    console.error("[Telegram] Database not available");
    return;
  }

  if (text === "/start" || text === "/code") {
    const existing = await db.select().from(users)
      .where(eq(users.telegramId, telegramId)).limit(1);

    // 🔐 Always generate a NEW code with 10-minute expiry
    const code = generateCode();
    const codeExpiresAt = getCodeExpiry();

    if (existing.length > 0) {
      const existingUserId = existing[0].id;

      // Update with new code + expiry
      await db.update(users).set({
        telegramCode: code,
        telegramCodeExpiresAt: codeExpiresAt,
        telegramUsername: username,
        telegramFirstName: firstName,
      }).where(eq(users.id, existingUserId));

      // Auto trial for existing users who don't have any subscription
      const now = new Date();
      import { randomBytes } from "crypto";
      const existingSubs = await db.select().from(subscriptions)
        .where(eq(subscriptions.userId, existingUserId)).limit(1);
      if (existingSubs.length === 0) {
        // No subscription at all — check if auto trial is enabled
        const autoEnabledRow = await db.select().from(settings).where(eq(settings.keyName, "auto_trial_enabled")).limit(1);
        const autoEnabled = autoEnabledRow[0]?.value === "true";
        if (autoEnabled) {
          // 🆕 Check trial date range
          const trialEnabledRow = await db.select().from(settings).where(eq(settings.keyName, "trial_enabled")).limit(1);
          const trialEnabled = trialEnabledRow[0]?.value === "true";
          if (trialEnabled) {
            const startDateRow = await db.select().from(settings).where(eq(settings.keyName, "trial_start_date")).limit(1);
            const endDateRow = await db.select().from(settings).where(eq(settings.keyName, "trial_end_date")).limit(1);
            const startDate = startDateRow[0]?.value;
            const endDate = endDateRow[0]?.value;
            const today = new Date().toISOString().split('T')[0];

            // Only give trial if today is within the trial period
            if (startDate && endDate && today >= startDate && today <= endDate) {
              const trialDaysRow = await db.select().from(settings).where(eq(settings.keyName, "auto_trial_days")).limit(1);
              const trialDays = parseInt(trialDaysRow[0]?.value ?? "7");
              const subId = randomBytes(Math.ceil(36/2)).toString("hex").slice(0, 36);
              const trialExpiry = new Date(endDate); // Trial ends on period end date
              await db.insert(subscriptions).values({
                id: subId,
                userId: existingUserId,
                plan: "trial",
                startsAt: now,
                expiresAt: trialExpiry,
                createdByAdmin: "system",
                note: "Auto trial " + trialDays + " days (existing user, trial period)",
              });
              await sendMessage(chatId,
                `👋 <b>မင်္ဂလာပါ, ${firstName}!</b>\n\n` +
                `🎁 <b>Trial ${trialDays} ရက် ရရှိပါပြီ!</b> (${startDate} မှ ${endDate} ထိ)\n\n` +
                `🔑 သင့် login code:\n\n` +
                `<code>${code}</code>\n\n` +
                `⏰ Code သက်တမ်း: <b>၁၀ မိနစ်</b>\n` +
                `ဒီ code ကို https://lumix-studio.vercel.app မှာ login ဝင်ဖို့ သုံးပါ။\n\n` +
                `⚠️ Code သက်တမ်းကုန်ရင် /code ကို ထပ်နှိပ်ပါ!`
              );
              return;
            }
          }

          // Fallback to original logic if no date range set
          const trialDaysRow = await db.select().from(settings).where(eq(settings.keyName, "auto_trial_days")).limit(1);
          const trialDays = parseInt(trialDaysRow[0]?.value ?? "7");
          const subId = randomBytes(Math.ceil(36/2)).toString("hex").slice(0, 36);
          const trialExpiry = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
          await db.insert(subscriptions).values({
            id: subId,
            userId: existingUserId,
            plan: "trial",
            startsAt: now,
            expiresAt: trialExpiry,
            createdByAdmin: "system",
            note: "Auto trial " + trialDays + " days (existing user)",
          });
          await sendMessage(chatId,
            `👋 <b>မင်္ဂလာပါ, ${firstName}!</b>\n\n` +
            `🎁 <b>Trial ${trialDays} ရက် ရရှိပါပြီ!</b>\n\n` +
            `🔑 သင့် login code:\n\n` +
            `<code>${code}</code>\n\n` +
            `⏰ Code သက်တမ်း: <b>၁၀ မိနစ်</b>\n` +
            `ဒီ code ကို https://lumix-studio.vercel.app မှာ login ဝင်ဖို့ သုံးပါ။\n\n` +
            `⚠️ Code သက်တမ်းကုန်ရင် /code ကို ထပ်နှိပ်ပါ!`
          );
          return;
        }
      }
      await sendMessage(chatId,
        `👋 <b>မင်္ဂလာပါ, ${firstName}!</b>\n\n` +
        `🔑 သင့် login code:\n\n` +
        `<code>${code}</code>\n\n` +
        `⏰ Code သက်တမ်း: <b>၁၀ မိနစ်</b>\n` +
        `ဒီ code ကို https://lumix-studio.vercel.app မှာ login ဝင်ဖို့ သုံးပါ။\n\n` +
        `⚠️ Code သက်တမ်းကုန်ရင် /code ကို ထပ်နှိပ်ပါ!`
      );
    } else {
      const newUserId = Math.random().toString(36).slice(2);
      await db.insert(users).values({
        id: newUserId,
        telegramId,
        telegramUsername: username,
        telegramFirstName: firstName,
        telegramCode: code,
        telegramCodeExpiresAt: codeExpiresAt,
      });
      // Auto trial — check settings
      import { randomBytes } from "crypto";
      const autoEnabledRow = await db.select().from(settings).where(eq(settings.keyName, "auto_trial_enabled")).limit(1);
      const autoEnabled = autoEnabledRow[0]?.value === "true";
      if (autoEnabled) {
        // 🆕 Check trial date range
        const trialEnabledRow = await db.select().from(settings).where(eq(settings.keyName, "trial_enabled")).limit(1);
        const trialEnabled = trialEnabledRow[0]?.value === "true";
        if (trialEnabled) {
          const startDateRow = await db.select().from(settings).where(eq(settings.keyName, "trial_start_date")).limit(1);
          const endDateRow = await db.select().from(settings).where(eq(settings.keyName, "trial_end_date")).limit(1);
          const startDate = startDateRow[0]?.value;
          const endDate = endDateRow[0]?.value;
          const today = new Date().toISOString().split('T')[0];

          // Only give trial if today is within the trial period
          if (startDate && endDate && today >= startDate && today <= endDate) {
            const trialDaysRow = await db.select().from(settings).where(eq(settings.keyName, "auto_trial_days")).limit(1);
            const trialDays = parseInt(trialDaysRow[0]?.value ?? "7");
            const subId = randomBytes(Math.ceil(36/2)).toString("hex").slice(0, 36);
            const trialExpiry = new Date(endDate); // Trial ends on period end date
            await db.insert(subscriptions).values({
              id: subId,
              userId: newUserId,
              plan: "trial",
              startsAt: new Date(),
              expiresAt: trialExpiry,
              createdByAdmin: "system",
              note: "Auto trial " + trialDays + " days (trial period)",
            });
          }
        } else {
          // Original logic (no date range set)
          const trialDaysRow = await db.select().from(settings).where(eq(settings.keyName, "auto_trial_days")).limit(1);
          const trialDays = parseInt(trialDaysRow[0]?.value ?? "7");
          const subId = randomBytes(Math.ceil(36/2)).toString("hex").slice(0, 36);
          const trialExpiry = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
          await db.insert(subscriptions).values({
            id: subId,
            userId: newUserId,
            plan: "trial",
            startsAt: new Date(),
            expiresAt: trialExpiry,
            createdByAdmin: "system",
            note: "Auto trial " + trialDays + " days",
          });
        }
      }
      await sendMessage(chatId,
        `🎉 <b>LUMIX へ ကြိုဆိုပါတယ်, ${firstName}!</b>\n\n` +
        `✅ သင့် account ကို ဖန်တီးပြီးပါပြီ!\n\n` +
        `🔑 သင့် login code:\n\n` +
        `<code>${code}</code>\n\n` +
        `⏰ Code သက်တမ်း: <b>၁၀ မိနစ်</b>\n` +
        `ဒီ code ကို https://lumix-studio.vercel.app မှာ login ဝင်ဖို့ သုံးပါ။\n\n` +
        `⚠️ Code သက်တမ်းကုန်ရင် /code ကို ထပ်နှိပ်ပါ!`
      );
    }
  } else if (text === "/help") {
    await sendMessage(chatId,
      `<b>🤖 LUMIX Bot အကူအညီ</b>\n\n` +
      `/start - Login code ရယူပါ\n` +
      `/code - Code အသစ်ရယူပါ\n` +
      `/help - အကူအညီ\n\n` +
      `⏰ Code သက်တမ်း: ၁၀ မိနစ်\n` +
      `🌐 Website: https://lumix-studio.vercel.app`
    );
  } else {
    await sendMessage(chatId,
      `Login code ရယူဖို့ /start ပို့ပါ! 🔑`
    );
  }
}

export async function setWebhook(webhookUrl: string) {
  const result = await telegramPost("setWebhook", { url: webhookUrl });
  console.log("[Telegram] Webhook set:", JSON.stringify(result));
  return result;
}
