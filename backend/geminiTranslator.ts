import fs from "fs";
import path from "path";

const QUOTA_FILE = path.join(process.cwd(), "tmp_video", "gemini_quota.json");

// ✅ Models with correct IDs and RPD limits
const MODELS = [
  { id: "models/gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash Lite", rpd: 500 },
  { id: "models/gemini-3-flash-preview", name: "Gemini 3 Flash", rpd: 20 },
  { id: "models/gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", rpd: 20 },
  { id: "models/gemini-2.5-flash", name: "Gemini 2.5 Flash", rpd: 20 }
];

interface QuotaData {
  [modelId: string]: {
    date: string;
    count: number;
  };
}

// ✅ Use Sync operations for Quota to avoid race conditions
function incrementQuotaSync(modelId: string): void {
  const today = new Date().toISOString().split("T")[0];
  let quota: QuotaData = {};

  try {
    if (fs.existsSync(QUOTA_FILE)) {
      const data = fs.readFileSync(QUOTA_FILE, "utf8");
      quota = JSON.parse(data);
    }
  } catch (e) {
    quota = {};
  }

  if (!quota[modelId] || quota[modelId].date !== today) {
    quota[modelId] = { date: today, count: 1 };
  } else {
    quota[modelId].count++;
  }

  try {
    fs.mkdirSync(path.dirname(QUOTA_FILE), { recursive: true });
    fs.writeFileSync(QUOTA_FILE, JSON.stringify(quota, null, 2));
  } catch (e) {
    console.error("[Gemini] Failed to save quota:", e);
  }
}

function getQuotaCount(modelId: string): number {
  const today = new Date().toISOString().split("T")[0];
  try {
    if (fs.existsSync(QUOTA_FILE)) {
      const data = fs.readFileSync(QUOTA_FILE, "utf8");
      const quota: QuotaData = JSON.parse(data);
      const usage = quota[modelId];
      return (usage && usage.date === today) ? usage.count : 0;
    }
  } catch (e) {}
  return 0;
}

function getAllSystemKeys(): string[] {
  const keysStr = process.env.GEMINI_API_KEY || "";
  return keysStr.split(",").map(k => k.trim()).filter(k => k.length > 0);
}

function buildTranslatePrompt(fontSize?: number): string {
  const charsPerLine = fontSize ? Math.max(12, Math.round(60 - (fontSize - 12) * 1.2)) : 22;
  return `You are a professional Myanmar YouTube movie recap narrator.

Translate the following text (any language) into Myanmar movie recap narration style.

ABSOLUTE STRICT RULES - VIOLATION IS UNACCEPTABLE:
1. ZERO English words allowed. Not a single English letter (a-z) in the output.
2. ALL person names MUST be phonetically transliterated into Myanmar script.
3. ALL technical/English terms MUST be Myanmar.
4. NO "..." anywhere in the text
5. NO quotation marks
6. Sentence endings: ခဲ့ပါတယ်၊ လိုက်ပါတယ်၊ သွားပါတယ်၊ မှာပဲဖြစ်ပါတယ်၊ ပါတော့တယ်
7. Use connectors: တဲ့အခါမှာတော့၊ ရင်းနဲ့၊ ပြီးတော့
8. Cinematic, engaging narration tone
9. Keep translation concise for video timing
10. Target ~${charsPerLine} Myanmar graphemes per subtitle line
11. Return ONLY pure Myanmar narration text - no labels, no "Translation:", no markdown

Text:`;
}

export async function geminiTranslate(text: string, userApiKey?: string, fontSize?: number): Promise<{ myanmar: string; modelUsed: string }> {
  const systemKeys = getAllSystemKeys();
  const keysToTry = (userApiKey && userApiKey.trim() !== "") 
    ? [userApiKey.trim(), ...systemKeys] 
    : systemKeys;

  if (keysToTry.length === 0) {
    throw new Error("GEMINI_API_KEY is not set in .env and no user key was provided.");
  }

  for (const model of MODELS) {
    const todayCount = getQuotaCount(model.id);

    if (todayCount >= model.rpd) {
      console.log(`[Gemini] Model ${model.name} quota exhausted (${todayCount}/${model.rpd}). Skipping...`);
      continue;
    }

    for (const apiKey of keysToTry) {
      // ✅ FIXED: Removed double /models/ from the URL
      const url = `https://generativelanguage.googleapis.com/v1beta/${model.id}:generateContent?key=${apiKey}`;
      
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${buildTranslatePrompt(fontSize)}\n${text}` }] }]
          })
        });
        const data = await res.json();

        if (res.ok) {
          const translatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (translatedText) {
            incrementQuotaSync(model.id);
            return { myanmar: translatedText.trim(), modelUsed: model.name };
          }
        } else {
          const errMsg = data.error?.message || "Unknown error";
          console.error(`[Gemini] ${model.name} failed with ${res.status}: ${errMsg}`);
        }
      } catch (err) {
        console.error(`[Gemini] Network error for ${model.name}:`, err);
      }
    }
  }

  throw new Error("All Gemini models and keys exhausted. Add more API keys or try again tomorrow.");
}

export async function getQuotaStatus(): Promise<any> {
  return MODELS.map(m => {
    const used = getQuotaCount(m.id);
    return { model: m.name, used, limit: m.rpd, available: m.rpd - used };
  });
}
