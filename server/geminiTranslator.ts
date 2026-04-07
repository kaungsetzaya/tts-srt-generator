import fs from "fs/promises";
import path from "path";

const QUOTA_FILE = path.join(process.cwd(), "tmp_video", "gemini_quota.json");

// 🌟 Only Free Tier Available Gemini Models
const MODELS = [
  { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite", rpd: 500 },
  { id: "gemini-3-flash", name: "Gemini 3 Flash", rpd: 20 },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", rpd: 20 },
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", rpd: 20 }
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

// 🔄 Multiple API Keys Round-robin System
let currentGeminiKeyIndex = 0;
function getSystemGeminiKey(): string | null {
  const keysStr = process.env.GEMINI_API_KEY || "";
  const keys = keysStr.split(",").map(k => k.trim()).filter(k => k.length > 0);
  
  if (keys.length === 0) return null;
  
  const key = keys[currentGeminiKeyIndex % keys.length];
  currentGeminiKeyIndex++;
  return key;
}

const TRANSLATE_PROMPT = `You are a professional Myanmar YouTube movie recap narrator.

Translate the following text (any language) into Myanmar movie recap narration style.

STRICT rules:
- NO "..." anywhere
- NO quotation marks
- Foreign names: Myanmar phonetic ONLY, no English in brackets
- Sentence endings: ခဲ့ပါတယ်၊ လိုက်ပါတယ်၊ သွားပါတယ်၊ မှာပဲဖြစ်ပါတယ်၊ ပါတော့တယ်
- Long flowing sentences connected with တဲ့အခါမှာတော့၊ ရင်းနဲ့၊ ပြီးတော့
- Cinematic and engaging tone
- Return ONLY Myanmar narration, nothing else

Text:`;

export async function geminiTranslate(text: string, userApiKey?: string): Promise<{ myanmar: string; modelUsed: string }> {
  // ✅ User Key ပါလာရင် User Key သုံးမည်၊ မပါလာရင် System Key (.env) ကို အလှည့်ကျသုံးမည်
  const apiKey = (userApiKey && userApiKey.trim() !== "") ? userApiKey.trim() : getSystemGeminiKey();
  
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in .env and no user key was provided.");

  const model = await getAvailableModel();
  if (!model) throw new Error("All Gemini quotas exhausted for today. Try again tomorrow.");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent?key=${apiKey}`;

  const body = JSON.stringify({
    contents: [{ parts: [{ text: `${TRANSLATE_PROMPT}\n${text}` }] }]
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  const data = await res.json() as any;

  // If rate limited, mark as full and try next
  if (!res.ok || !data.candidates?.[0]?.content?.parts?.[0]?.text) {
    console.log(`[Gemini] ${model.name} failed (${res.status}), trying next model...`);
    // Mark as exhausted for today
    const quota = await loadQuota();
    const today = new Date().toISOString().split("T")[0];
    quota[model.id] = { date: today, count: model.rpd };
    await saveQuota(quota);
    // Retry with next model (will still use the correct API key)
    return geminiTranslate(text, userApiKey);
  }

  await incrementQuota(model.id);
  const myanmar = data.candidates[0].content.parts[0].text;
  
  // Log which key type was used for debugging
  const keyType = (userApiKey && userApiKey.trim() !== "") ? "User Key" : "System Key";
  console.log(`[Gemini] Used ${model.name} with ${keyType} ending in ...${apiKey.slice(-4)} (${(await loadQuota())[model.id]?.count ?? 1}/${model.rpd} today)`);

  return { myanmar, modelUsed: model.name };
}

export async function getQuotaStatus(): Promise<Array<{ model: string; used: number; limit: number; available: number }>> {
  const quota = await loadQuota();
  const today = new Date().toISOString().split("T")[0];

  return MODELS.map(m => {
    const used = (!quota[m.id] || quota[m.id].date !== today) ? 0 : quota[m.id].count;
    return { model: m.name, used, limit: m.rpd, available: m.rpd - used };
  });
}
