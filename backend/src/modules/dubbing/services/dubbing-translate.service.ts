/**
 * Dubbing Translation Service — Gemini-powered translation for video dubbing
 * Separated from shared gemini.service.ts per architecture requirements
 */
import {
    MODELS,
    getDailyCount,
    incrementQuota,
    getAllKeys,
    applyPhonetics,
    sanitizeTranslation,
    type GeminiSegment,
    type GeminiTranslatedSegment,
} from "../../translation/services/gemini-core.service";
import { PHONETIC_DICTIONARY } from "../../translation/services/phonetic-dictionary";

export class DubbingTranslationService {
    /**
     * Make text shorter to fit time slot (used when TTS is too long)
     */
    async makeShorter(text: string, slotMs: number, userApiKey?: string): Promise<string | null> {
        const allKeys = getAllKeys(userApiKey);
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
                        return applyPhonetics(sanitizeTranslation(result), PHONETIC_DICTIONARY);
                    }
                } catch {}
            }
        }
        return null;
    }

    /**
     * Translates an array of segments (for Dubbing Pipeline).
     */
    async translateSegments(segments: GeminiSegment[], userApiKey?: string): Promise<GeminiTranslatedSegment[]> {
        const allKeys = getAllKeys(userApiKey);
        if (allKeys.length === 0) throw new Error("No API key available.");

        const fullText = segments.map(s => s.text).join(' ');
        
        const BATCH_SIZE = 15;
        const chunks: GeminiSegment[][] = [];
        for (let i = 0; i < segments.length; i += BATCH_SIZE) {
            chunks.push(segments.slice(i, i + BATCH_SIZE));
        }

        const results: GeminiTranslatedSegment[] = [];
        for (const chunk of chunks) {
            let chunkTranslated: string[] | null = null;

            const linesWithDuration = chunk.map(s => ({
                text: s.text,
                duration_seconds: parseFloat((s.end - s.start).toFixed(1))
            }));

            for (const model of MODELS) {
                if (getDailyCount(model.id) >= model.rpd) continue;
                for (const apiKey of allKeys) {
                    chunkTranslated = await this.callBatchApi(
                        linesWithDuration,
                        model.id,
                        apiKey,
                        fullText
                    );
                    if (chunkTranslated && chunkTranslated.length === chunk.length) {
                        incrementQuota(model.id);
                        break;
                    }
                }
                if (chunkTranslated) break;
            }

            if (!chunkTranslated) {
                console.warn(`[DubbingTranslate] Batch failed, retrying individually...`);
                for (const s of chunk) {
                    try {
                        let singleResult: string[] | null = null;
                        const single = [{ text: s.text, duration_seconds: parseFloat((s.end - s.start).toFixed(1)) }];
                        for (const model of MODELS) {
                            if (getDailyCount(model.id) >= model.rpd) continue;
                            for (const apiKey of allKeys) {
                                singleResult = await this.callBatchApi(single, model.id, apiKey, fullText);
                                if (singleResult?.[0]) { incrementQuota(model.id); break; }
                            }
                            if (singleResult?.[0]) break;
                        }
                        const translated = singleResult?.[0];
                        const hasBurmese = translated && /[\u1000-\u109F]/.test(translated);
                        results.push({
                            ...s,
                            translatedText: (translated && hasBurmese)
                                ? applyPhonetics(sanitizeTranslation(translated), PHONETIC_DICTIONARY)
                                : s.text
                        });
                    } catch {
                        results.push({ ...s, translatedText: s.text });
                    }
                }
            } else {
                results.push(...chunk.map((s, idx) => {
                    const translatedVal = chunkTranslated![idx];
                    const hasBurmese = translatedVal && /[\u1000-\u109F]/.test(translatedVal);
                    if (!hasBurmese) console.warn(`[DubbingTranslate] Seg ${s.index} no Burmese text`);
                    return {
                        ...s,
                        translatedText: (translatedVal && hasBurmese)
                            ? applyPhonetics(sanitizeTranslation(translatedVal), PHONETIC_DICTIONARY)
                            : s.text
                    };
                }));
            }
        }
        return results;
    }

    private async callBatchApi(
        lines: Array<{ text: string; duration_seconds: number }>,
        modelId: string,
        apiKey: string,
        fullContext?: string
    ): Promise<string[] | null> {
        const url = `https://generativelanguage.googleapis.com/v1beta/${modelId}:generateContent?key=${apiKey}`;

        const contextSection = fullContext
            ? `VIDEO CONTEXT:\n"${fullContext.slice(0, 600)}..."\n\nဒီ context နဲ့ ကိုက်ညီအောင် translate လုပ်ပါ။\n`
            : '';

        const systemPrompt = `You are a top Myanmar movie recap narrator on TikTok and Facebook.

${contextSection}
YOUR JOB: Translate English video segments into punchy, emotional Myanmar narration.
- ဇာတ်လမ်းကို နားလည်ပြီး meaningful translation ဖြစ်ရမယ်
- ရုပ်ရှင် recap narrator လို dramatic ဖြစ်ရမယ်၊ သူငယ်ချင်းကို ဇာတ်လမ်းပြောပြသလို
- "တာပေါ့"၊ "တာပဲ"、"လိုက်တာ"、"လေ"、"ဒါပေမယ့်"、"အဲ့ဒီ"
- BANNED: "သည်"、"ပါသည်"、"ဖြစ်သည်"
- NEVER return English

CRITICAL FOR SUBTITLES:
1. Translate the full meaning naturally - do NOT cut meaning short
2. Insert \\n at a natural pause point (comma or phrase break) so subtitle shows as 2 lines
   Example: "သူ တံတားပေါ်ကနေ\\nခုန်ချလိုက်တာပဲ။"
3. Do NOT use "..." (ellipsis) — it causes TTS to pause unnaturally. Use (၊) or (။) instead.

Output: JSON array of strings only.`;

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
            console.error(`[DubbingTranslate API Error] HTTP ${res.status} for ${modelId}`);
            return null;
        }

        const data = await res.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

        if (!rawText) {
            console.warn(`[DubbingTranslate API] Empty response from ${modelId}`);
            return null;
        }

        try {
            return JSON.parse(rawText);
        } catch {
            const jsonMatch = rawText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                try { return JSON.parse(jsonMatch[0]); } catch {}
            }
            console.error(`[DubbingTranslate API] Parse failed:`, rawText.slice(0, 200));
            return null;
        }
    }
}

export const dubbingTranslationService = new DubbingTranslationService();
