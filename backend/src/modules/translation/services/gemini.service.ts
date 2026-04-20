/**
 * Gemini Service - Strictly isolates all Google Gemini API logic.
 * Aligned with ARCHITECTURE.md requirements.
 */

import { promises as fs } from 'fs';
import * as path from 'path';

const QUOTA_FILE = path.join(process.cwd(), 'backend/.gemini_quota.json');

const MODELS = [
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", rpd: 500, rpm: 15, primary: true },
    { id: "gemini-2.5-flash-lite-preview-06-17", name: "Gemini 2.5 Flash Lite", rpd: 20, rpm: 10, primary: false },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", rpd: 20, rpm: 5, primary: false },
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

const PHONETIC_DICTIONARY: Record<string, string> = {
    CEO: "စီအီးအို",
    FBI: "အက်ဖ်ဘီအိုင်",
    Zombies: "ဇွန်ဘီး",
    Zombie: "ဇွန်ဘီး",
};

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
        let cleaned = text.replace(/ဤသည်မှာ သင်ပေးပို့.*?(ဖြေ|ပါသည်|ပြန်ဆိုထားပါသည်။)/g, ""); 
        cleaned = cleaned.replace(/မြန်မာဘာသာဖြင့် အောက်ပါအတိုင်း.*?ပါသည်/g, "");
        cleaned = cleaned.replace(/Here is the.*/gi, "");
        cleaned = cleaned.replace(/\*\*ဇာတ်ညွှန်း[^\*]*\*\*/g, ""); 
        cleaned = cleaned.replace(/\*\*.+?\*\*/g, ""); 
        cleaned = cleaned.replace(/[#_*\[\]]/g, ""); 
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
                results.push(...chunk.map((s, idx) => ({
                    ...s,
                    translatedText: this.applyPhonetics(this.sanitize(chunkTranslated![idx]))
                })));
            }
        }
        return results;
    }

    private async callApi(text: string, modelId: string, apiKey: string): Promise<string | null> {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
        const body = {
            contents: [{ parts: [{ text: `Translate to Myanmar (standard script):\n\n${text}` }] }],
            systemInstruction: { parts: [{ text: "Output ONLY the raw Myanmar translation. NO markdown. NO filler." }] }
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
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
        const body = {
            contents: [{ parts: [{ text: `TEXT TO TRANSLATE (JSON Array):\n${JSON.stringify(lines)}` }] }],
            systemInstruction: { parts: [{ text: "Professional script translator. Return JSON array ONLY. Exact same line count." }] },
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

        if (!res.ok) return null;
        const data = await res.json();
        try {
            return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text);
        } catch {
            return null;
        }
    }
}

export const geminiService = new GeminiService();
