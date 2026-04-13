import fs from "fs/promises";
import path from "path";

const QUOTA_FILE = path.join(process.cwd(), "tmp_video", "gemini_quota.json");

// ✅ Models ordered by HIGHEST QUOTA (RPD) FIRST
// 1. Gemini 3.1 Flash Lite (500 RPD) - Primary
// 2. Fallbacks (20 RPD each)
const MODELS = [
  { id: "models/gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash Lite", rpd: 500, rpm: 15, tpm: 1000000 },
  { id: "models/gemini-3-flash-preview", name: "Gemini 3 Flash", rpd: 20, rpm: 15, tpm: 1000000 },
  { id: "models/gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", rpd: 20, rpm: 15, tpm: 1000000 },
  { id: "models/gemini-2.5-flash", name: "Gemini 2.5 Flash", rpd: 20, rpm: 15, tpm: 1000000 },
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

// 🔄 Multiple API Keys Round-robin
function getAllSystemKeys(): string[] {
  const keysStr = process.env.GEMINI_API_KEY || "";
  return keysStr.split(",").map(k => k.trim()).filter(k => k.length > 0);
}

function buildTranslatePrompt(fontSize?: number): string {
  const charsPerLine = fontSize ? Math.max(12, Math.round(60 - (fontSize - 12) * 1.2)) : 22;
  return `You are a professional Myanmar YouTube movie recap narrator.

Translate the following text into Myanmar movie recap narration style.

ABSOLUTE STRICT RULES:
1. ZERO English words allowed.
2. ALL names must be transliterated into Myanmar script.
3. Cinematic, engaging narration tone.
4. Target ~${charsPerLine} Myanmar graphemes per line.
5. Return ONLY pure Myanmar narration text.

Text:`;
}

async function tryTranslateWithAllKeys(
  text: string,
  modelId: string,
  modelName: string,
  userApiKey?: string,
  fontSize?: number
): Promise<string | null> {
  const systemKeys = getAllSystemKeys();
  // Logic: Use User Key FIRST if provided, then Fallback to System Keys
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
        return data.candidates[0].content.parts[0].text;
      } else {
        const errorMsg = data.error?.message || "Unknown error";
        console.log(`[Gemini] ${modelName} key ...${key.slice(-4)} failed: ${errorMsg}`);
      }
    } catch (e: any) {
      console.log(`[Gemini] ${modelName} error: ${e.message}`);
    }
  }
  return null;
}

export async function geminiTranslate(
  text: string,
  userApiKey?: string,
  fontSize?: number
): Promise<{ myanmar: string; modelUsed: string }> {
  // Try each model in the order defined in MODELS (Highest RPD first)
  for (const model of MODELS) {
    const result = await tryTranslateWithAllKeys(text, model.id, model.name, userApiKey, fontSize);
    if (result) {
      await incrementQuota(model.id);
      return { myanmar: result, modelUsed: model.name };
    }
  }

  throw new Error("All Gemini models and keys exhausted. Add more API keys or try again tomorrow.");
}

export async function getQuotaStatus(): Promise<any> {
  const quota = await loadQuota();
  const today = new Date().toISOString().split("T")[0];
  return MODELS.map(m => {
    const used = (!quota[m.id] || quota[m.id].date !== today) ? 0 : quota[m.id].count;
    return { model: m.name, used, limit: m.rpd, available: m.rpd - used };
  });
}
