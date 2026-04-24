/**
 * Gemini Service - Strictly isolates all Google Gemini API logic.
 * Aligned with ARCHITECTURE.md requirements.
 */

import { promises as fs } from 'fs';
import * as path from 'path';

const QUOTA_FILE = path.join(process.cwd(), 'backend/.gemini_quota.json');

const MODELS = [
  {
    id: "models/gemini-3.1-flash-lite-preview",
    name: "Gemini 3.1 Flash Lite",
    rpd: 500,
    rpm: 15,
    primary: true,
  },
  {
    id: "models/gemini-3-flash-preview",
    name: "Gemini 3 Flash",
    rpd: 20,
    rpm: 5,
    primary: false,
  },
  {
    id: "models/gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    rpd: 20,
    rpm: 10,
    primary: false,
  },
  {
    id: "models/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    rpd: 20,
    rpm: 5,
    primary: false,
  },
];

let quotaMap: Map<string, { date: string; count: number }>;

async function loadQuotaFile(): Promise<Record<string, { date: string; count: number }>> {
    try {
        const raw = await fs.readFile(QUOTA_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

async function saveQuotaFile(data: Record<string, { date: string; count: number }>): Promise<void> {
    try {
        await fs.writeFile(QUOTA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch {}
}

async function initQuotaMap(): Promise<void> {
    const raw = await loadQuotaFile();
    quotaMap = new Map(Object.entries(raw));
    saveQuotaFile(raw).catch(() => {});
}

initQuotaMap().catch(() => {});

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
    saveQuotaFile(Object.fromEntries(quotaMap)).catch(() => {});
}

function getAllSystemKeys(): string[] {
    const keysStr = process.env.GEMINI_API_KEY || "";
    return keysStr.split(",").map(k => k.trim()).filter(k => k.length > 0);
}

import { PHONETIC_DICTIONARY } from "./phonetic-dictionary";

interface Segment {
    index: number;
    start: number;
    end: number;
    text: string;
}

interface TranslatedSegment extends Segment {
    translatedText: string;
}

export class GeminiService {
    private getAllKeys(userApiKey?: string): string[] {
        const systemKeys = getAllSystemKeys();
        return userApiKey?.trim() ? [userApiKey.trim(), ...systemKeys] : systemKeys;
    }

    private applyPhonetics(text: string): string {
        let result = text;
        const keys = Object.keys(PHONETIC_DICTIONARY).sort((a, b) => b.length - a.length);
        for (const key of keys) {
            result = result.split(key).join(PHONETIC_DICTIONARY[key]);
        }
        return result;
    }

    private sanitize(text: string): string {
        if (!text || typeof text !== 'string') return "";
        let cleaned = text.trim();

        cleaned = cleaned.replace(/,/g, "၊");
        cleaned = cleaned.replace(/\./g, "။");
        cleaned = cleaned.replace(/၊$/, "။");

        if (cleaned.length > 0 && !cleaned.endsWith("။") && !cleaned.endsWith("၊")) {
            cleaned += "။";
        }

        cleaned = cleaned.replace(/Here is the.*/gi, "");
        cleaned = cleaned.replace(/\*\*.+?\*\*/g, ""); 
        cleaned = cleaned.replace(/[#_*\[\]]/g, ""); 
        cleaned = cleaned.replace(/"/g, "");
        cleaned = cleaned.replace(/'/g, "");

        return cleaned.trim();
    }

    /**
     * Make text shorter to fit time slot
     */
    async makeShorter(text: string, slotMs: number, userApiKey?: string): Promise<string | null> {
        const allKeys = this.getAllKeys(userApiKey);
        const targetSyllables = Math.floor((slotMs / 1000) * 3);
        
        for (const model of MODELS) {
            if (getDailyCount(model.id) >= model.rpd) continue;
            for (const apiKey of allKeys) {
                try {
                    const url = `https://generativelanguage.googleapis.com/v1beta/${model.id}:generateContent?key=${apiKey}`;
                    const body = {
                        contents: [{ parts: [{ text: `Shorten this Myanmar text to fit ${targetSyllables} syllables max (${(slotMs/1000).toFixed(1)}s slot). Keep the key meaning. Return only the shortened Myanmar text, nothing else:\n\n${text}` }] }],
                        systemInstruction: { parts: [{ text: `You are a Myanmar text editor. Shorten Myanmar dubbing text to fit exact time slots. Keep dramatic style. Return ONLY the shortened text.` }] }
                    };
                    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
                    if (!res.ok) continue;
                    const data = await res.json();
                    const result = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
                    if (result) {
                        incrementQuota(model.id);
                        return this.applyPhonetics(this.sanitize(result));
                    }
                } catch {}
            }
        }
        return null;
    }

    /**
     * Translates a full block of text (for Translation Pipeline).
     */
    async translateFullText(text: string, userApiKey?: string): Promise<string> {
        const allKeys = this.getAllKeys(userApiKey);
        if (allKeys.length === 0) throw new Error("No API key available.");

        for (const model of MODELS) {
            if (getDailyCount(model.id) >= model.rpd) continue;
            for (const apiKey of allKeys) {
                try {
                    const result = await this.callApi(text, model.id, apiKey);
                    if (result) {
                        incrementQuota(model.id);
                        return this.applyPhonetics(this.sanitize(result));
                    }
                } catch (err) {}
            }
        }
        throw new Error("All Gemini models and keys exhausted.");
    }

    /**
     * Translates an array of segments (for Dubbing Pipeline).
     */
    async translateSegments(segments: Segment[], userApiKey?: string): Promise<TranslatedSegment[]> {
        const allKeys = this.getAllKeys(userApiKey);
        if (allKeys.length === 0) throw new Error("No API key available.");

        const BATCH_SIZE = 15;
        const chunks: Segment[][] = [];
        for (let i = 0; i < segments.length; i += BATCH_SIZE) {
            chunks.push(segments.slice(i, i + BATCH_SIZE));
        }

        const results: TranslatedSegment[] = [];
        for (const chunk of chunks) {
            let chunkTranslated: string[] | null = null;

            const linesWithDuration = chunk.map(s => ({
                text: s.text,
                duration_seconds: parseFloat((s.end - s.start).toFixed(1))
            }));

            for (const model of MODELS) {
                if (getDailyCount(model.id) >= model.rpd) continue;
                for (const apiKey of allKeys) {
                    chunkTranslated = await this.callBatchApi(linesWithDuration, model.id, apiKey);
                    if (chunkTranslated && chunkTranslated.length === chunk.length) {
                        incrementQuota(model.id);
                        break;
                    }
                }
                if (chunkTranslated) break;
            }

            if (!chunkTranslated) {
                console.warn(`[Gemini] Batch failed, retrying individually...`);
                for (const s of chunk) {
                    try {
                        let singleResult: string[] | null = null;
                        const single = [{ text: s.text, duration_seconds: parseFloat((s.end - s.start).toFixed(1)) }];
                        for (const model of MODELS) {
                            if (getDailyCount(model.id) >= model.rpd) continue;
                            for (const apiKey of allKeys) {
                                singleResult = await this.callBatchApi(single, model.id, apiKey);
                                if (singleResult?.[0]) { incrementQuota(model.id); break; }
                            }
                            if (singleResult?.[0]) break;
                        }
                        results.push({
                            ...s,
                            translatedText: singleResult?.[0]
                                ? this.applyPhonetics(this.sanitize(singleResult[0]))
                                : s.text
                        });
                    } catch {
                        results.push({ ...s, translatedText: s.text });
                    }
                }
            } else {
                results.push(...chunk.map((s, idx) => ({
                    ...s,
                    translatedText: chunkTranslated![idx]
                        ? this.applyPhonetics(this.sanitize(chunkTranslated![idx]))
                        : s.text
                })));
            }
        }
        return results;
    }

    private async callApi(text: string, modelId: string, apiKey: string): Promise<string | null> {
        const url = `https://generativelanguage.googleapis.com/v1beta/${modelId}:generateContent?key=${apiKey}`;
        const systemPrompt = `You are a Professional Movie Recap Narrator. 
TASK: Translate the script into "High-Impact Spoken Burmese" for social media video recaps (TikTok/FB/YouTube).

STRICT STYLE RULES:
1. **NARRATIVE VOICE**: Tell it like a story to a friend. Use descriptive, immersive language.
2. **FAVORITE ENDINGS**: 
   - Frequently use: "တာပေါ့", "တာပဲ", "နေမိတာ", "သွားခဲ့ရတယ်", "လိုက်တာ", "လေ", "သေးတယ်", "နေတာပါ", "ခဲ့တာပါ။"
3. **SPECIFIC VOCABULARY**:
   - Use "ဒါပေမယ့်" (instead of ဒါပေမဲ့)
   - Use "အဲ့ဒီ" (instead of အဲဒီ)
   - Use "အခုမှ စတာပါ" (for transitions)
4. **DRAMATIC PAUSES**: Use "..." for tension (e.g., "...သူ့ရည်းစားနဲ့လေ").
5. **STRICT PUNCTUATION**: Use (၊) for pauses and (။) for sentence ends. NEVER use English (, .).
6. **NO LITERARY BURMESE**: Strictly ban "သည်", "ပါသည်", "သနည်း".

GOAL: The output must sound exactly like a high-quality Myanmar movie recap script.

CRITICAL: You MUST translate ALL text to Myanmar/Burmese language.
Even if the input is already in English, translate it to Myanmar.
NEVER return the original English text unchanged.`;

        const body = {
            contents: [{ parts: [{ text: `Translate to Myanmar:\n\n${text}` }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] }
        };

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (!res.ok) return null;
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }

    private async callBatchApi(
        lines: Array<{ text: string; duration_seconds: number }>,
        modelId: string,
        apiKey: string
    ): Promise<string[] | null> {
        const url = `https://generativelanguage.googleapis.com/v1beta/${modelId}:generateContent?key=${apiKey}`;

        const systemPrompt = `You are a top Myanmar movie recap narrator on TikTok and Facebook.

YOUR JOB: Translate English video segments into punchy, emotional Myanmar narration.

NARRATION RULES (အရေးကြီးဆုံး):
- ရုပ်ရှင် recap channel လို dramatic ဖြစ်ရမယ် — သူငယ်ချင်းကို ဇာတ်လမ်းပြောပြသလို
- ဇာတ်လမ်းရဲ့ feeling ကို ဆောင်ပေးရမယ် — suspense၊ emotion၊ action ပါရမယ်
- တိုတိုနဲ့ impact ရှိရမယ် — မလိုအပ်တဲ့ စကားများများ မထည့်ပါနဲ့

VOCABULARY TO USE:
- "တာပေါ့"၊ "တာပဲ"၊ "လိုက်တာ"၊ "လေ"၊ "သေးတယ်"၊ "နေမိတာ"
- "ဒါပေမယ့်"၊ "အဲ့ဒီ"၊ "ချက်ချင်းပဲ"၊ "ဒါနဲ့..."၊ "အဲ့တော့..."
- "ရုတ်တရက်"၊ "တစ်ချက်တည်း"၊ "မထင်မှတ်ဘဲ"

TIMING GUIDE (soft guideline မှ):
- 2s → ~1 short sentence
- 4s → ~2 short sentences  
- 6s → ~3 short sentences
- Keep each sentence 5-8 Myanmar words max

BANNED:
- "သည်"၊ "ပါသည်"၊ "ဖြစ်သည်"၊ "သနည်း"
- Google Translate style flat sentences
- Extra explanation not in original

MUST: Always translate to Myanmar. Never return English.

Output: JSON array of strings, same order as input.`;

        const body = {
            contents: [{ parts: [{ text: `TRANSLATE THESE SEGMENTS:\n${JSON.stringify(lines, null, 2)}` }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: { type: "ARRAY", items: { type: "STRING" } }
            }
        };

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            console.error(`[Gemini API Error] HTTP ${res.status} for ${modelId}`);
            return null;
        }

        const data = await res.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        
        if (!rawText) {
            console.warn(`[Gemini API] Empty response from ${modelId}`);
            return null;
        }

        try {
            return JSON.parse(rawText);
        } catch {
            const jsonMatch = rawText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                try { return JSON.parse(jsonMatch[0]); } catch {}
            }
            console.error(`[Gemini API] Parse failed:`, rawText.slice(0, 200));
            return null;
        }
    }
}

export const geminiService = new GeminiService();