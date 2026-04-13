import fs from "fs/promises";
import path from "path";

const QUOTA_FILE = path.join(process.cwd(), "tmp_video", "gemini_quota.json");

// ✅ Verified working models (tested April 2026) - ordered by priority
// Primary: 3.1 Flash Lite (fastest, cheapest)
// Fallbacks: 3 Flash, 2.5 Flash Lite
const MODELS = [
  { id: "gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash Lite", rpd: 500, rpm: 15, tpm: 1000000 },
  { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", rpd: 20, rpm: 15, tpm: 1000000 },
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", rpd: 20, rpm: 15, tpm: 1000000 },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", rpd: 20, rpm: 10, tpm: 1000000 },
];

interface QuotaData {
  [modelId: string]: {
    date: string;
    count: number;
  };
}

async function loadQuota(): Promise<QuotaData> {
  try {
    const data = await fs.readFile(QUOTA_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function saveQuota(quota: QuotaData): Promise<void> {
  await fs.mkdir(path.dirname(QUOTA_FILE), { recursive: true });
  await fs.writeFile(QUOTA_FILE, JSON.stringify(quota, null, 2));
}

async function incrementQuota(modelId: string): Promise<void> {
  const quota = await loadQuota();
  const today = new Date().toISOString().split("T")[0];
  if (!quota[modelId] || quota[modelId].date !== today) {
    quota[modelId] = { date: today, count: 1 };
  } else {
    quota[modelId].count++;
  }
  await saveQuota(quota);
}

async function getAvailableModel(): Promise<typeof MODELS[0] | null> {
  const quota = await loadQuota();
  const today = new Date().toISOString().split("T")[0];
  for (const model of MODELS) {
    const usage = quota[model.id];
    const todayCount = (!usage || usage.date !== today) ? 0 : usage.count;
    if (todayCount < model.rpd) {
      return model;
    }
  }
  return null;
}

// 🔄 Multiple API Keys Round-robin — tries ALL keys for each model
let currentGeminiKeyIndex = 0;
function getAllSystemKeys(): string[] {
  const keysStr = process.env.GEMINI_API_KEY || "";
  return keysStr.split(",").map(k => k.trim()).filter(k => k.length > 0);
}

function getSystemGeminiKey(): string | null {
  const keys = getAllSystemKeys();
  if (keys.length === 0) return null;
  const key = keys[currentGeminiKeyIndex % keys.length];
  currentGeminiKeyIndex++;
  return key;
}

function buildTranslatePrompt(fontSize?: number): string {
  const charsPerLine = fontSize ? Math.max(12, Math.round(60 - (fontSize - 12) * 1.2)) : 22;
  return `You are a professional Myanmar YouTube movie recap narrator.

Translate the following text (any language) into Myanmar movie recap narration style.

ABSOLUTE STRICT RULES — VIOLATION IS UNACCEPTABLE:
1. ZERO English words allowed. Not a single English letter (a-z) in the output.
2. ALL person names MUST be phonetically transliterated into Myanmar script:
   * "John" → "ဂျွန်"
   * "Mary" → "မေရီ"
   * "Michael" → "မိုက်ကယ်"
   * "David" → "ဒေးဗစ်"
   * "Sarah" → "ဆာရာ"
   * "James" → "ဂျိမ်းစ်"
   * "Robert" → "ရောဘတ်"
   * "Lisa" → "လီဆာ"
   * "Tom" → "တွမ်"
   * "Jack" → "ဂျက်"
   * "Emma" → "အဲမ်မာ"
3. ALL technical/English terms MUST be Myanmar:
   * "Phone" → "ဖုန်း"
   * "OK" → "ကောင်းပြီ"
   * "Sorry" → "စိတ်မကောင်းပါဘူး"
   * "Email" → "အီးမေးလ်"
   * "Computer" → "ကွန်ပျူတာ"
   * "Delivery boy" → "ပို့ဆောင်ရေးဝန်ထမ်း"
   * "Police" → "ရဲ"
   * "Hospital" → "ဆေးရုံ"
   * "Doctor" → "ဆရာဝန်"
4. NO "..." anywhere in the text
5. NO quotation marks
6. Sentence endings: ခဲ့ပါတယ်၊ လိုက်ပါတယ်၊ သွားပါတယ်၊ မှာပဲဖြစ်ပါတယ်၊ ပါတော့တယ်
7. Use connectors: တဲ့အခါမှာတော့၊ ရင်းနဲ့၊ ပြီးတော့
8. Cinematic, engaging narration tone
9. Keep translation concise for video timing
10. Target ~${charsPerLine} Myanmar graphemes per subtitle line
11. Return ONLY pure Myanmar narration text — no labels, no "Translation:", no markdown

Text:`;
}

// 🔄 Try all keys for a given model before giving up
async function tryTranslateWithAllKeys(
  text: string,
  modelId: string,
  modelName: string,
  userApiKey?: string,
  fontSize?: number
): Promise<string | null> {
  const systemKeys = getAllSystemKeys();
  const keysToTry = (userApiKey && userApiKey.trim())
    ? [userApiKey.trim(), ...systemKeys]
    : systemKeys;

  for (const key of keysToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`;
    const body = JSON.stringify({
      contents: [{ parts: [{ text: `${buildTranslatePrompt(fontSize)}\n${text}` }] }]
    });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const data = await res.json() as any;

      if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
        const myanmar = data.candidates[0].content.parts[0].text;
        const keyType = (userApiKey && userApiKey.trim() === key) ? "User Key" : "System Key";
        console.log(`[Gemini] ✅ Used ${modelName} with ${keyType} ending in ...${key.slice(-4)}`);
        return myanmar;
      } else {
        console.log(`[Gemini] ${modelName} key ...${key.slice(-4)} failed (${res.status})`);
      }
    } catch (e: any) {
      console.log(`[Gemini] ${modelName} key ...${key.slice(-4)} error: ${e.message}`);
    }
  }
  return null;
}

export async function geminiTranslate(
  text: string,
  userApiKey?: string,
  fontSize?: number
): Promise<{ myanmar: string; modelUsed: string }> {
  const systemKeys = getAllSystemKeys();
  if (systemKeys.length === 0 && !userApiKey) {
    throw new Error("GEMINI_API_KEY is not set in .env and no user key was provided.");
  }

  // Try each model with ALL keys before moving to next model
  for (const model of MODELS) {
    const result = await tryTranslateWithAllKeys(text, model.id, model.name, userApiKey, fontSize);
    if (result) {
      await incrementQuota(model.id);
      return { myanmar: result, modelUsed: model.name };
    }
    console.log(`[Gemini] All keys exhausted for ${model.name}, trying next model...`);
  }

  throw new Error("All Gemini models and keys exhausted. Add more API keys or try again tomorrow.");
}

export async function getQuotaStatus(): Promise<Array<{ model: string; used: number; limit: number; available: number }>> {
  const quota = await loadQuota();
  const today = new Date().toISOString().split("T")[0];
  return MODELS.map(m => {
    const used = (!quota[m.id] || quota[m.id].date !== today) ? 0 : quota[m.id].count;
    return { model: m.name, used, limit: m.rpd, available: m.rpd - used };
  });
}
