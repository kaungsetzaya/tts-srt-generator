import fs from "fs";
import path from "path";

const QUOTA_FILE = path.join(process.cwd(), "tmp_video", "gemini_quota.json");

// ✅ Models with correct IDs and limits
const MODELS = [
  { id: "models/gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash Lite", rpd: 500, rpm: 15, tpm: 250000 },
  { id: "models/gemini-3-flash-preview", name: "Gemini 3 Flash", rpd: 20, rpm: 5, tpm: 250000 },
  { id: "models/gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", rpd: 20, rpm: 10, tpm: 250000 },
  { id: "models/gemini-2.5-flash", name: "Gemini 2.5 Flash", rpd: 20, rpm: 5, tpm: 250000 }
];

interface QuotaData {
  [modelId: string]: {
    date: string;
    count: number;
  };
}

function getQuotaFile(): QuotaData {
  try {
    if (fs.existsSync(QUOTA_FILE)) {
      const data = fs.readFileSync(QUOTA_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {}
  return {};
}

function saveQuotaFile(quota: QuotaData): void {
  try {
    fs.mkdirSync(path.dirname(QUOTA_FILE), { recursive: true });
    fs.writeFileSync(QUOTA_FILE, JSON.stringify(quota, null, 2));
  } catch (e) {}
}

function getDailyCount(modelId: string): number {
  const today = new Date().toISOString().split("T")[0];
  const quota = getQuotaFile();
  const usage = quota[modelId];
  return (usage && usage.date === today) ? usage.count : 0;
}

function incrementQuotaSync(modelId: string): void {
  const today = new Date().toISOString().split("T")[0];
  const quota = getQuotaFile();
  
  if (!quota[modelId] || quota[modelId].date !== today) {
    quota[modelId] = { date: today, count: 1 };
  } else {
    quota[modelId].count++;
  }
  saveQuotaFile(quota);
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
  let processedText = text;
  const sortedKeys = Object.keys(phoneticDictionary).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedKey, 'g');
    processedText = processedText.replace(regex, phoneticDictionary[key]);
  }
  return processedText;
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
      console.log(`[Gemini] ${model.name} daily limit reached (${dailyCount}/${model.rpd}). Skip.`);
      continue;
    }

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
          const translatedText = data.candidates[0].content.parts[0].text;
          const myanmarText = applyBurmesePhonetics(translatedText.trim());
          incrementQuotaSync(model.id);
          
          const keyType = apiKey === userApiKey?.trim() ? "User Key" : "System Key";
          console.log(`[Gemini] ✅ ${model.name} (${keyType} ...${apiKey.slice(-4)})`);
          
          return { myanmar: myanmarText, modelUsed: model.name };
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
  return MODELS.map(m => {
    const used = getDailyCount(m.id);
    return { model: m.name, used, limit: m.rpd, rpm: m.rpm, available: m.rpd - used };
  });
}
