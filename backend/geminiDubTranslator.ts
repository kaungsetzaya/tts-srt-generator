import fs from "fs";

// ✅ Models - verified with API (same as geminiTranslator)
const MODELS = [
  { id: "models/gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash Lite", rpd: 500, rpm: 15, primary: true },
  { id: "models/gemini-3-flash-preview", name: "Gemini 3 Flash", rpd: 20, rpm: 5, primary: false },
  { id: "models/gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", rpd: 20, rpm: 10, primary: false },
  { id: "models/gemini-2.5-flash", name: "Gemini 2.5 Flash", rpd: 20, rpm: 5, primary: false }
];

// In-memory quota tracking
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
const phoneticDictionary: Record<string, string> = {
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

// Translate video narration exactly for TTS
const DUB_SYSTEM_PROMPT = `You are a TTS narrator. Translate this video script EXACTLY word-for-word to Myanmar.
Keep exact meaning.
Output must be speakable.
No intro or outro.
Return exact same number of lines as input.`;

// Batch translation for dubbing
const BATCH_SIZE = 15;

async function translateBatchDub(lines: string[], apiKey: string, modelId: string): Promise<string[] | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/${modelId}:generateContent?key=${apiKey}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: DUB_SYSTEM_PROMPT }]
        },
        contents: [{ 
          parts: [{ text: `Translate this JSON array:\n${JSON.stringify(lines)}` }] 
        }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: { type: "STRING" }
          }
        }
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.log(`[DubGemini] HTTP ${res.status}: ${errorText.substring(0, 80)}`);
      return null;
    }

    const data = await res.json();
    
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      const text = data.candidates[0].content.parts[0].text;
      try {
        const parsedArray = JSON.parse(text);
        if (Array.isArray(parsedArray) && parsedArray.length === lines.length) {
          return parsedArray;
        }
        console.log(`[DubGemini] Length mismatch. Expected ${lines.length}, got ${parsedArray?.length || 0}`);
        return null;
      } catch {
        console.log(`[DubGemini] JSON parse failed`);
        return null;
      }
    }
    return null;
  } catch (err: any) {
    console.log(`[DubGemini] Error: ${err.message}`);
    return null;
  }
}

// Main export for dubbing
export async function geminiTranslateForDub(
  segments: { index: number; start: number; end: number; text: string }[],
  userApiKey?: string
): Promise<{ translated: { index: number; start: number; end: number; text: string }[] }> {
  const systemKeys = getAllSystemKeys();
  const allKeys = (userApiKey?.trim()) ? [userApiKey.trim(), ...systemKeys] : systemKeys;

  if (allKeys.length === 0) {
    throw new Error("No API key available.");
  }

  const texts = segments.map(s => s.text);
  
  // Chunk into batches
  const chunks: string[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    chunks.push(texts.slice(i, i + BATCH_SIZE));
  }

  console.log(`[DubGemini] Translating ${texts.length} segments in ${chunks.length} batches...`);

  const translatedTexts: string[] = [];
  let failedBatches = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    console.log(`[DubGemini] Batch ${i + 1}/${chunks.length} (${chunk.length} lines)...`);
    
    let success = false;
    
    for (const model of MODELS) {
      if (getDailyCount(model.id) >= model.rpd) continue;
      
      for (const apiKey of allKeys) {
        const result = await translateBatchDub(chunk, apiKey, model.id);
        
        if (result && result.length === chunk.length) {
          for (const item of result) {
            translatedTexts.push(applyBurmesePhonetics(item));
          }
          incrementQuota(model.id);
          console.log(`[DubGemini] ✅ ${model.name}`);
          success = true;
          break;
        }
      }
      if (success) break;
    }
    
    if (!success) {
      console.log(`[DubGemini] Batch ${i + 1} failed`);
      failedBatches++;
      for (let j = 0; j < chunk.length; j++) {
        translatedTexts.push(chunk[j]); // Fallback to original
      }
    }
  }

  if (failedBatches > chunks.length / 2) {
    throw new Error("Dub translation failed: too many batches failed.");
  }

  const translated = segments.map((seg, idx) => ({
    ...seg,
    text: translatedTexts[idx] || seg.text
  }));

  console.log(`[DubGemini] ✅ Translation complete!`);
  return { translated };
}
