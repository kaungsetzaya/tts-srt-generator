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
            
            for (const model of MODELS) {
                if (getDailyCount(model.id) >= model.rpd) continue;
                for (const apiKey of allKeys) {
                    chunkTranslated = await this.callBatchApi(chunk.map(s => s.text), model.id, apiKey);
                    if (chunkTranslated && chunkTranslated.length === chunk.length) {
                        incrementQuota(model.id);
                        break;
                    }
                }
                if (chunkTranslated) break;
            }

            if (!chunkTranslated) {
                // Fallback to original text if batch fails
                results.push(...chunk.map(s => ({ ...s, translatedText: s.text })));
            } else {
                results.push(...chunk.map((s, idx) => {
                    const translatedVal = chunkTranslated![idx];
                    return {
                        ...s,
                        translatedText: translatedVal 
                            ? this.applyPhonetics(this.sanitize(translatedVal)) 
                            : s.text // Fallback to original if this specific segment is null/undefined
                    };
                }));
            }
        }
        return results;
    }

private async callApi(text: string, modelId: string, apiKey: string): Promise<string | null> {
        const url = `https://generativelanguage.googleapis.com/v1beta/${modelId}:generateContent?key=${apiKey}`;
        const systemPrompt = `TASK: First, accurately transcribe the exact spoken words from the video audio. Second, translate the transcription into **Natural, Spoken Burmese** (Myanmar Language).

GOAL: Create a highly accurate translation suitable for a professional Myanmar Dubbing Video that perfectly matches the original meaning.

STRICT TRANSLATION GUIDELINES:

1. **EXACT MEANING**: The translation MUST perfectly preserve the original meaning, context, and nuance of the speaker. Do not summarize, guess, or skip details.

2. **SPOKEN STYLE (အပြောစကား)**: Use natural, conversational Burmese.
   - STRICTLY AVOID formal literary style (စာစကား).
   - Example: Use "မသိဘူး" (Conversational) instead of "မသိရှိပါ" (Formal).

3. **EMOTION & PARTICLES**: Capture the speaker's tone using appropriate sentence-ending particles ('ကွ', 'ဗျာ', 'နော်', 'ရှင့်', 'လေ').

4. **IDIOMS**: Translate the *meaning* of idioms, not the literal words, ensuring it makes sense in Burmese culture.

5. **COMPLETENESS**: Transcribe and translate EVERY single spoken sentence. Do not hallucinate text for silence or music.

OUTPUT: JSON array of strings ONLY.`;

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

private async callBatchApi(lines: string[], modelId: string, apiKey: string): Promise<string[] | null> {
        const url = `https://generativelanguage.googleapis.com/v1beta/${modelId}:generateContent?key=${apiKey}`;
        const systemPrompt = `TASK: First, accurately transcribe the exact spoken words from the video audio. Second, translate the transcription into **Natural, Spoken Burmese** (Myanmar Language).

GOAL: Create a highly accurate translation suitable for a professional Myanmar Dubbing Video that perfectly matches the original meaning.

STRICT TRANSLATION GUIDELINES:

1. **EXACT MEANING**: The translation MUST perfectly preserve the original meaning, context, and nuance of the speaker. Do not summarize, guess, or skip details.

2. **SPOKEN STYLE (အပြောစကား)**: Use natural, conversational Burmese.
   - STRICTLY AVOID formal literary style (စာစကား).
   - Example: Use "မသိဘူး" (Conversational) instead of "မသိရှိပါ" (Formal).

3. **EMOTION & PARTICLES**: Capture the speaker's tone using appropriate sentence-ending particles ('ကွ', 'ဗျာ', 'နော်', 'ရှင့်', 'လေ').

4. **IDIOMS**: Translate the *meaning* of idioms, not the literal words, ensuring it makes sense in Burmese culture.

5. **COMPLETENESS**: Transcribe and translate EVERY single spoken sentence. Do not hallucinate text for silence or music.

OUTPUT: JSON array of strings ONLY.`;

        const body = {
            contents: [{ parts: [{ text: `TEXT TO TRANSLATE (JSON Array):\n${JSON.stringify(lines)}` }] }],
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
            // Attempt direct parse first
            return JSON.parse(rawText);
        } catch {
            // Fallback: extract JSON array from markdown or text
            const jsonMatch = rawText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0]);
                } catch {
                    console.error(`[Gemini API] Failed to parse extracted JSON from ${modelId}:`, rawText.slice(0, 200));
                    return null;
                }
            }
            console.error(`[Gemini API] No valid JSON array found in response from ${modelId}:`, rawText.slice(0, 200));
            return null;
        }
    }
}

export const geminiService = new GeminiService();
