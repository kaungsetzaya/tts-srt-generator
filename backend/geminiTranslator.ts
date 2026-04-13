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

// Phonetic Dictionary for better Myanmar translation
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

Translate the provided text into an engaging, natural Myanmar narration style suitable for YouTube shorts, fascinating facts (like Zack D. Films), and movie recaps.

ABSOLUTE STRICT RULES:
1. NARRATION STYLE: Use engaging storytelling and explainer Burmese. It should sound like a fascinating documentary or engaging recap. STRICTLY AVOID overly formal literary style (စာစကား).
2. PRONOUNS: You MAY use "ကျွန်တော်" or "ကျွန်မ" ONLY IF the original script specifically contains first-person perspective.
3. PROHIBITED PARTICLES (CRITICAL): NEVER use casual conversational or gendered ending particles. "ဗျ", "ဗျာ", "ရှင်", "ရှင့်", "လေ", "နော်", and "ကွ" are STRICTLY PROHIBITED.
4. ALLOWED NARRATIVE PARTICLES: End sentences naturally using engaging narration particles like "ပါပဲ", "တော့တယ်", "ပါတယ်", "ခဲ့တယ်", "ခဲ့ပါတယ်", "ဖြစ်ပါတယ်", "သွားပါတယ်".
5. TRANSLITERATION FOR SPECIFIC TERMS: Keep pop-culture, scientific, or specific English terms in Myanmar script pronunciation. Example: "Zombies" → "ဇွန်ဘီး". ZERO English letters (a-z) allowed in final output.
6. FORMAT: Break translation into short, readable subtitle lines suitable for fast-paced videos. Target ~${charsPerLine} Myanmar graphemes per subtitle line.`;
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
            // Apply phonetic corrections
            const myanmarText = applyBurmesePhonetics(translatedText.trim());
            incrementQuotaSync(model.id);
            return { myanmar: myanmarText, modelUsed: model.name };
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
