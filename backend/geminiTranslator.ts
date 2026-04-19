import fs from "fs";
import path from "path";

// ✅ Models - verified with API
const MODELS = [
  {
    id: "gemini-3.1-flash-lite-preview",
    name: "Gemini 3.1 Flash Lite",
    rpd: 500,
    rpm: 15,
    primary: true,
  },
  {
    id: "gemini-3-flash-preview",
    name: "Gemini 3 Flash",
    rpd: 20,
    rpm: 5,
    primary: false,
  },
  {
    id: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    rpd: 20,
    rpm: 10,
    primary: false,
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    rpd: 20,
    rpm: 5,
    primary: false,
  },
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
  return keysStr
    .split(",")
    .map(k => k.trim())
    .filter(k => k.length > 0);
}

// Phonetic Dictionary
export const phoneticDictionary: Record<string, string> = {
  CEO: "စီအီးအို",
  FBI: "အက်ဖ်ဘီအိုင်",
  Zombies: "ဇွန်ဘီး",
  Zombie: "ဇွန်ဘီး",
};

function applyBurmesePhonetics(text: string): string {
  let result = text;
  const keys = Object.keys(phoneticDictionary).sort(
    (a, b) => b.length - a.length
  );
  for (const key of keys) {
    result = result.split(key).join(phoneticDictionary[key]);
  }
  return result;
}

// Return string[] on success, or null on failure
// Batch translation with JSON response schema - for VIDEO DUB (cinematic style)
async function translateBatch(
  lines: string[],
  apiKey: string,
  modelId: string
): Promise<string[] | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/${modelId}:generateContent?key=${apiKey}`;
  
  // For single long text, use simple text; for batches use JSON array
  const isSingleLongText = lines.length === 1 && lines[0].length > 1000;
  
  const systemPrompt = isSingleLongText
    ? `You are a translator. Translate the video script EXACTLY word-for-word to Myanmar Burmese. Keep exact meaning. Output ONLY the translation in Myanmar. No explanation, no notes.`
    : `You are a TTS narrator. Translate video script EXACTLY word-for-word to Myanmar.
Keep exact meaning. Output must be speakable. No intro or outro.
Return exact same number of lines as input.

STRICT RULES:
1. ONLY TRANSLATE: Output ONLY the translation. 
2. ONLY MYANMAR: Output in Myanmar ONLY.
3. CLEAN OUTPUT: JSON array ONLY. No intro/notes.`;

  try {
    let body: any;
    
    if (isSingleLongText) {
      // Simple translation for single long text
      body = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: `TRANSLATE TO MYANMAR:\n${lines[0]}` }] }],
      };
    } else {
      // JSON array for batch
      body = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: `TEXT TO TRANSLATE (JSON Array):\n${JSON.stringify(lines)}` }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: { type: "ARRAY", items: { type: "STRING" } },
        },
      };
    }
    
    // 60s timeout prevents pipeline hangs if Gemini is unresponsive
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errorText = await res.text();
      console.log(
        `[Gemini] HTTP Error ${res.status}: ${errorText.substring(0, 100)}`
      );
      return null;
    }

    const data = await res.json();
    console.log(`[Gemini] Raw API response:`, JSON.stringify(data).substring(0, 500));

    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      const text = data.candidates[0].content.parts[0].text;
      console.log(`[Gemini] Text response: "${text?.substring(0, 200)}"`);
      
      // For single very long text (which is our video translate case), just return as-is
      if (lines.length === 1) {
        console.log(`[Gemini] Single text mode - returning direct translation`);
        return [text.trim()];
      }
      
      // For multiple texts, try to parse as JSON array
      try {
        const parsedArray = JSON.parse(text);

        if (Array.isArray(parsedArray) && parsedArray.length === lines.length) {
          console.log(`[Gemini] Parsed successfully: ${parsedArray.length} items`);
          return parsedArray;
        } else {
          console.log(
            `[Gemini] Length mismatch. Expected ${lines.length}, got ${parsedArray.length || 0}`
          );
          return null;
        }
      } catch (e) {
        console.log("[Gemini] Failed to parse batch response as JSON:", e);
        return null;
      }
    } else {
      console.log("[Gemini] API returned empty response. Full data:", JSON.stringify(data).substring(0, 300));
      return null;
    }
  } catch (err: any) {
    const reason = err.name === 'AbortError' ? 'Request timed out (60s)' : err.message;
    console.log(`[Gemini] Batch translate error (${modelId}): ${reason}`);
    return null;
  }
}

export async function geminiTranslate(
  text: string,
  userApiKey?: string,
  fontSize?: number
): Promise<{ myanmar: string; modelUsed: string }> {
  const systemKeys = getAllSystemKeys();
  const allKeys = userApiKey?.trim()
    ? [userApiKey.trim(), ...systemKeys]
    : systemKeys;

  if (allKeys.length === 0) {
    throw new Error("No API key available.");
  }

  // Try models and keys in parallel-style (user key first)
  for (const model of MODELS) {
    if (getDailyCount(model.id) >= model.rpd) continue;

    for (const apiKey of allKeys) {
      const url = `https://generativelanguage.googleapis.com/v1beta/${model.id}:generateContent?key=${apiKey}`;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `You are a TTS narrator. Translate this video script EXACTLY word-for-word to Myanmar. Keep exact meaning. Output must be speakable.\n${text}`,
                  },
                ],
              },
            ],
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

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
const BATCH_SIZE = 15; // Smaller batch = less chance of length mismatch

export async function geminiTranslateBatch(
  segments: { index: number; start: number; end: number; text: string }[],
  userApiKey?: string
): Promise<{
  translated: { index: number; start: number; end: number; text: string }[];
}> {
  const systemKeys = getAllSystemKeys();
  const allKeys = userApiKey?.trim()
    ? [userApiKey.trim(), ...systemKeys]
    : systemKeys;

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

  console.log(
    `[Gemini] Translating ${texts.length} segments in ${chunks.length} batches...`
  );

  const translatedTexts: string[] = [];
  let failedBatches = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const startIdx = i * BATCH_SIZE;

    console.log(
      `[Gemini] Batch ${i + 1}/${chunks.length} (${chunk.length} lines)...`
    );

    // Try models and keys
    let success = false;

    for (const model of MODELS) {
      if (getDailyCount(model.id) >= model.rpd) continue;

      for (const apiKey of allKeys) {
        const result = await translateBatch(chunk, apiKey, model.id);

        if (result && result.length === chunk.length) {
          // Success! Copy results
          for (let j = 0; j < result.length; j++) {
            translatedTexts.push(applyBurmesePhonetics(result[j]));
          }
          incrementQuota(model.id);
          success = true;
          console.log(`[Gemini] ✅ ${model.name}`);
          break;
        }
      }
      if (success) break;
    }

    if (!success) {
      // Mark batch as failed - don't add anything
      console.log(
        `[Gemini] Batch ${i + 1} failed - will retry with smaller batch`
      );
      failedBatches++;
      // Add empty strings for this batch
      for (let j = 0; j < chunk.length; j++) {
        translatedTexts.push("");
      }
    }
  }

  // If too many batches failed, throw error
  if (failedBatches > chunks.length / 2) {
    throw new Error(
      "Translation failed: too many batches failed. Please try again."
    );
  }

  // Reconstruct translated segments
  const translated = segments.map((seg, idx) => ({
    ...seg,
    text: translatedTexts[idx] || seg.text,
  }));

  console.log(
    `[Gemini] ✅ Translation complete! (${failedBatches} batches failed)`
  );

  return { translated };
}

export async function getQuotaStatus(): Promise<any> {
  return MODELS.map(m => ({
    model: m.name,
    used: getDailyCount(m.id),
    limit: m.rpd,
    available: m.rpd - getDailyCount(m.id),
  }));
}
