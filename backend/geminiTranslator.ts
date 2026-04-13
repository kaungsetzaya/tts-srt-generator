import fs from "fs";
import path from "path";

const QUOTA_FILE = path.join(process.cwd(), "tmp_video", "gemini_quota.json");

// ✅ Models with correct IDs and limits
const MODELS = [
  { id: "models/gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash Lite", rpd: 500, rpm: 15 },
  { id: "models/gemini-3-flash-preview", name: "Gemini 3 Flash", rpd: 20, rpm: 5 },
  { id: "models/gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", rpd: 20, rpm: 10 },
  { id: "models/gemini-2.5-flash", name: "Gemini 2.5 Flash", rpd: 20, rpm: 5 }
];

interface QuotaData {
  [modelId: string]: {
    date: string;
    count: number;
  };
}

// RPM tracking per key
const rpmMap = new Map<string, { timestamp: number; count: number }>();
const RPM_WINDOW = 60000; // 1 minute
const MIN_DELAY = 200; // 200ms between requests

function getQuota(): QuotaData {
  try {
    if (fs.existsSync(QUOTA_FILE)) {
      return JSON.parse(fs.readFileSync(QUOTA_FILE, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveQuota(quota: QuotaData): void {
  try {
    fs.mkdirSync(path.dirname(QUOTA_FILE), { recursive: true });
    fs.writeFileSync(QUOTA_FILE, JSON.stringify(quota, null, 2));
  } catch (e) {}
}

function getDailyCount(modelId: string): number {
  const today = new Date().toISOString().split("T")[0];
  const quota = getQuota();
  const entry = quota[modelId];
  return (entry && entry.date === today) ? entry.count : 0;
}

function incrementDaily(modelId: string): void {
  const today = new Date().toISOString().split("T")[0];
  const quota = getQuota();
  if (!quota[modelId] || quota[modelId].date !== today) {
    quota[modelId] = { date: today, count: 1 };
  } else {
    quota[modelId].count++;
  }
  saveQuota(quota);
}

// RPM tracking
function checkRPM(key: string, limit: number): boolean {
  const now = Date.now();
  const entry = rpmMap.get(key);
  
  if (!entry || now - entry.timestamp > RPM_WINDOW) {
    rpmMap.set(key, { timestamp: now, count: 1 });
    return true;
  }
  
  if (entry.count >= limit) {
    return false;
  }
  
  entry.count++;
  return true;
}

function waitRPM(key: string, limit: number): Promise<void> {
  return new Promise((resolve) => {
    const entry = rpmMap.get(key);
    if (entry && entry.count >= limit) {
      const waitTime = RPM_WINDOW - (Date.now() - entry.timestamp);
      setTimeout(resolve, waitTime + 50);
    } else {
      resolve();
    }
  });
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
  const charsPerLine = fontSize ? Math.max(12, Math.round(60 - (fontSize - 12) * 1.2)) : 22;
  return `You are a professional Myanmar Voiceover Artist and Video Translator.

Translate the provided text into an engaging, natural Myanmar narration style suitable for YouTube shorts, fascinating facts, and movie recaps.

ABSOLUTE STRICT RULES:
1. NARRATION STYLE: Use engaging storytelling. AVOID overly formal literary style.
2. PRONOUNS: Use "ကျွန်တော်" or "ကျွန်မ" ONLY IF first-person.
3. PROHIBITED PARTICLES: Never use "ဗျ", "ဗျာ", "ရှင်", "ရှင့်", "လေ", "နော်", "ကွ".
4. ALLOWED PARTICLES: "ပါပဲ", "တော့တယ်", "ပါတယ်", "ခဲ့တယ်", "ခဲ့ပါတယ်", "ဖြစ်ပါတယ်", "သွားပါတယ်".
5. ZERO English letters (a-z) in output.
6. Format: Short subtitle lines (~${charsPerLine} Myanmar graphemes).`;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function geminiTranslate(
  text: string, 
  userApiKey?: string, 
  fontSize?: number
): Promise<{ myanmar: string; modelUsed: string }> {
  const systemKeys = getAllSystemKeys();
  
  // Build key priority: user key first, then system keys
  const allKeys = (userApiKey?.trim()) 
    ? [userApiKey.trim(), ...systemKeys] 
    : systemKeys;

  if (allKeys.length === 0) {
    throw new Error("GEMINI_API_KEY not set and no user key provided.");
  }

  for (const model of MODELS) {
    const dailyCount = getDailyCount(model.id);
    if (dailyCount >= model.rpd) {
      console.log(`[Gemini] ${model.name} daily limit (${dailyCount}/${model.rpd}). Skip.`);
      continue;
    }

    for (const apiKey of allKeys) {
      // Check RPM
      if (!checkRPM(apiKey, model.rpm)) {
        await waitRPM(apiKey, model.rpm);
        if (!checkRPM(apiKey, model.rpm)) {
          continue;
        }
      }

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
          incrementDaily(model.id);
          
          const keyType = apiKey === userApiKey?.trim() ? "User" : "System";
          console.log(`[Gemini] ✅ ${model.name} (${keyType})`);
          
          return { myanmar, modelUsed: model.name };
        } else {
          const errMsg = data.error?.message || `HTTP ${res.status}`;
          console.log(`[Gemini] ❌ ${model.name} key ...${apiKey.slice(-4)}: ${errMsg}`);
        }
      } catch (err: any) {
        console.log(`[Gemini] ❌ ${model.name} key ...${apiKey.slice(-4)}: ${err.message}`);
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
