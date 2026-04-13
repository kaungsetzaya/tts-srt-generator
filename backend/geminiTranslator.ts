import fs from "fs";
import path from "path";

// ✅ Models - use high quota first, fallback only if exhausted
const MODELS = [
  { id: "models/gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash Lite", rpd: 500, rpm: 15, primary: true },
  { id: "models/gemini-3-flash-preview", name: "Gemini 3 Flash", rpd: 20, rpm: 5, primary: false },
  { id: "models/gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", rpd: 20, rpm: 10, primary: false },
  { id: "models/gemini-2.5-flash", name: "Gemini 2.5 Flash", rpd: 20, rpm: 5, primary: false }
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
  "Zombies": "ဇွန်ဘီး",
  "Zombie": "ဇွန်ဘီး",
};

function applyBurmesePhonetics(text: string): string {
  let result = text;
  const keys = Object.keys(phoneticDictionary).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    result = result.split(key).join(phoneticDictionary[key]);
  }
  return result;
}

// Batch translation with JSON response schema
async function translateBatch(lines: string[], apiKey: string): Promise<string[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
  
  const systemPrompt = `You are a professional Myanmar Voiceover Artist. Translate each English string into engaging Myanmar storytelling style.
RULES:
1. Use engaging Burmese. NO formal literary style.
2. End sentences with narrative particles (ပါပဲ, တော့တယ်, ပါတယ်, ခဲ့တယ်). NEVER use (ဗျ, ရှင်, လေ, နော်).
3. Transliterate: Zombies→ဇွန်ဘီး, CEO→စီအီးအို, FBI→အက်ဖ်ဘီအိုင်.
4. Return JSON array of strings with EXACT SAME LENGTH as input.`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\nTranslate this JSON array:\n${JSON.stringify(lines)}` }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "array",
            items: { type: "string" }
          }
        }
      })
    });

    const data = await res.json();
    
    if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
      const text = data.candidates[0].content.parts[0].text;
      // Try to parse as JSON array
      try {
        return JSON.parse(text);
      } catch {
        // If parsing fails, return original
        console.log("[Gemini] Failed to parse batch response as JSON");
        return lines;
      }
    } else {
      const errMsg = data.error?.message || `HTTP ${res.status}`;
      console.log(`[Gemini] Batch translate failed: ${errMsg}`);
      return lines;
    }
  } catch (err: any) {
    console.log(`[Gemini] Batch translate error: ${err.message}`);
    return lines;
  }
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
            contents: [{ parts: [{ text: `You are a professional Myanmar Voiceover Artist. Translate to engaging Myanmar narration. RULES: No "ဗျ","ရှင်","လေ","နော်". Use "ပါပဲ","တော့တယ်","ပါတယ်". Short subtitle lines (~22 graphemes).\n${text}` }] }]
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

// Batch translation for video dubbing
const BATCH_SIZE = 30;

export async function geminiTranslateBatch(
  segments: { index: number; start: number; end: number; text: string }[],
  userApiKey?: string
): Promise<{ translated: { index: number; start: number; end: number; text: string }[] }> {
  const systemKeys = getAllSystemKeys();
  const allKeys = (userApiKey?.trim()) ? [userApiKey.trim(), ...systemKeys] : systemKeys;

  if (allKeys.length === 0) {
    throw new Error("No API key available.");
  }

  // Extract texts for translation
  const texts = segments.map(s => s.text);
  
  // Chunk into batches of 30
  const chunks: string[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    chunks.push(texts.slice(i, i + BATCH_SIZE));
  }

  console.log(`[Gemini] Translating ${texts.length} segments in ${chunks.length} batches...`);

  const translatedTexts: string[] = new Array(texts.length).fill("");

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const startIdx = i * BATCH_SIZE;
    
    console.log(`[Gemini] Batch ${i + 1}/${chunks.length} (${chunk.length} lines)...`);
    
    // Try to translate this batch
    let success = false;
    
    for (const apiKey of allKeys) {
      const result = await translateBatch(chunk, apiKey);
      
      if (result && result.length === chunk.length) {
        // Success! Copy results
        for (let j = 0; j < result.length; j++) {
          translatedTexts[startIdx + j] = applyBurmesePhonetics(result[j]);
        }
        success = true;
        break;
      }
    }
    
    if (!success) {
      // Fallback: use original text
      console.log(`[Gemini] Batch ${i + 1} failed, using original text`);
      for (let j = 0; j < chunk.length; j++) {
        translatedTexts[startIdx + j] = chunk[j];
      }
    }
  }

  // Reconstruct translated segments
  const translated = segments.map((seg, idx) => ({
    ...seg,
    text: translatedTexts[idx] || seg.text
  }));

  console.log(`[Gemini] ✅ Translation complete!`);
  
  return { translated };
}

export async function getQuotaStatus(): Promise<any> {
  return MODELS.map(m => ({
    model: m.name,
    used: getDailyCount(m.id),
    limit: m.rpd,
    available: m.rpd - getDailyCount(m.id)
  }));
}
