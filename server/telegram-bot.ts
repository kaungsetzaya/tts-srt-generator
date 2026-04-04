import https from "https";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

    let code: string;

    if (existing.length > 0) {
      code = existing[0].telegramCode!;
      await sendMessage(chatId,
        `👋 <b>မင်္ဂလာပါ, ${firstName}!</b>\n\n` +
        `🔑 သင့် login code:\n\n` +
        `<code>${code}</code>\n\n` +
        `ဒီ code ကို https://choco.de5.net မှာ login ဝင်ဖို့ သုံးပါ။\n\n` +
        `⚠️ Code ကို လျှို့ဝှက်ထားပါ!`
      );
    } else {
      code = generateCode();
      await db.insert(users).values({
        id: Math.random().toString(36).slice(2),
        telegramId,
        telegramUsername: username,
        telegramFirstName: firstName,
        telegramCode: code,
      });
      await sendMessage(chatId,
        `🎉 <b>LUMIX へ ကြိုဆိုပါတယ်, ${firstName}!</b>\n\n` +
        `✅ သင့် account ကို ဖန်တီးပြီးပါပြီ!\n\n` +
        `🔑 သင့် login code:\n\n` +
        `<code>${code}</code>\n\n` +
        `ဒီ code ကို https://choco.de5.net မှာ login ဝင်ဖို့ သုံးပါ။\n\n` +
        `⚠️ Code ဟာ အမြဲတမ်း တူညီနေမည် — လျှို့ဝှက်ထားပါ!`
      );
    }
  } else if (text === "/help") {
    await sendMessage(chatId,
      `<b>🤖 LUMIX Bot အကူအညီ</b>\n\n` +
      `/start - Login code ရယူပါ\n` +
      `/code - Code ကို ထပ်ကြည့်ပါ\n` +
      `/help - အကူအညီ\n\n` +
      `🌐 Website: https://choco.de5.net`
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
