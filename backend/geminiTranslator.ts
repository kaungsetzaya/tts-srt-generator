import fs from "fs";
import path from "path";

// ✅ Models with correct IDs and limits
const MODELS = [
  { id: "models/gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash Lite", rpd: 500, rpm: 15 },
  { id: "models/gemini-3-flash-preview", name: "Gemini 3 Flash", rpd: 20, rpm: 5 },
  { id: "models/gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", rpd: 20, rpm: 10 },
  { id: "models/gemini-2.5-flash", name: "Gemini 2.5 Flash", rpd: 20, rpm: 5 }
];

// Fast in-memory quota tracking
const quotaMap = new Map<string, { date: string; count: number }>();

function getDailyCount(modelId: string): number {
  const today = new Date().toISOString().split("T")[0];
  const entry = quotaMap.get(modelId);
  if (!entry || entry.date !== today) return 0;
  return entry.count;
}

function incrementQuota(modelId: string): void {
  const today = new Date().toISOString().split("T")[0];
  const current = quotaMap.get(modelId);
  if (!current || current.date !== today) {
    quotaMap.set(modelId, { date: today, count: 1 });
  } else {
    current.count++;
  }
}

function getAllSystemKeys(): string[] {
  const keysStr = process.env.GEMINI_API_KEY || "";
  return keysStr.split(",").map(k => k.trim()).filter(k => k.length > 0);
}

// Phonetic Dictionary
export const phoneticDictionary: Record<string, string> = {
  "CEO": "စီအီးအို",
  "FBI": "အက်ဖ်ဘီအိုင်",
  "Uric acid": "ယူရစ် အက်ဆစ်",
  "Recap": "ရီကပ်ပ်",
  "Zombies": "ဇွန်ဘီး",
  "Zombie": "ဇွန်ဘီး",
  "မေတ္တာ": "မြစ်တာ",
  "ဓားပြ": "ဓမြ",
  "ကောင်မလေး": "ကောင်မ လေး",
  "မကြီး": "မ ကြီး",
  "သူတောင်းစား": "သဒေါင်းဇား",
  "သူဌေး": "သဌေး",
  "ပါးစပ်": "ပဇပ်",
  "ပန်းချီ": "ဘဂျီ",
  "ပန်းကန်": "ဘဂန်",
  "ကုတင်": "ဂဒင်",
  "ပုဆိုး": "ပဆိုး",
  "ပုလင်း": "ပလင်း",
  "ဧကရာဇ်": "အေကရစ်",
  "အဘိုး": "အဖိုး",
  "အဘွား": "အဖွား",
  "မုဆိုး": "မုတ်ဆိုး",
  "ပုလ္လင်": "ပလင်",
  "ပုဂံ": "ဘဂံ",
  "အံ့ဩ": "အံ့အော",
  "ဇနီးသည်": "ဇနီးသယ်",
  "ဘီလူး": "ဘလူး",
  "စတေး": "ဇဒေး",
  "ချောက်ကမ်းပါး": "ဂျောက်ကမ်းပါး",
  "ကလေးမလေး": "ခလေးမ လေး",
  "ကုဋေကြွယ်": "ဂဒေကြွယ်",
  "ဩဇာ": "အောဇာ",
  "မြေးမလေး": "မြေးမ လေး",
};

function applyBurmesePhonetics(text: string): string {
  let result = text;
  const keys = Object.keys(phoneticDictionary).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    result = result.split(key).join(phoneticDictionary[key]);
  }
  return result;
}

function buildTranslatePrompt(fontSize?: number): string {
  return `You are a professional Myanmar Voiceover Artist. Translate to engaging Myanmar narration. 
RULES: No "ဗျ","ဗျာ","ရှင်","ရှင့်","လေ","နော်","ကွ". Use "ပါပဲ","တော့တယ်","ပါတယ်","ခဲ့တယ်","ဖြစ်ပါတယ်","သွားပါတယ်". 
ZERO English letters. Short subtitle lines (~22 graphemes).`;
}

export async function geminiTranslate(
  text: string, 
  userApiKey?: string, 
  fontSize?: number
): Promise<{ myanmar: string; modelUsed: string }> {
  const systemKeys = getAllSystemKeys();
  const allKeys = (userApiKey?.trim()) ? [userApiKey.trim(), ...systemKeys] : systemKeys;

  if (allKeys.length === 0) {
    throw new Error("No API key available.");
  }

  // Try models and keys in parallel-style (user key first)
  for (const model of MODELS) {
    if (getDailyCount(model.id) >= model.rpd) continue;

    for (const apiKey of allKeys) {
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

        if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
          const translated = data.candidates[0].content.parts[0].text;
          const myanmar = applyBurmesePhonetics(translated.trim());
          incrementQuota(model.id);
          
          const keyType = apiKey === userApiKey?.trim() ? "User" : "System";
          console.log(`[Gemini] ✅ ${model.name} (${keyType})`);
          
          return { myanmar, modelUsed: model.name };
        }
      } catch (err) {
        // Fast continue on error
      }
    }
  }

  throw new Error("All Gemini models and keys exhausted.");
}

export async function getQuotaStatus(): Promise<any> {
  return MODELS.map(m => ({
    model: m.name,
    used: getDailyCount(m.id),
    limit: m.rpd,
    available: m.rpd - getDailyCount(m.id)
  }));
}
