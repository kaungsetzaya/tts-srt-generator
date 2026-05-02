/**
 * Video Translate Service — Gemini-powered translation for video translation
 * Separated from shared gemini.service.ts per architecture requirements
 */
import {
    MODELS,
    getDailyCount,
    incrementQuota,
    getAllKeys,
    applyPhonetics,
    sanitizeTranslation,
} from "../../translation/services/gemini-core.service";
import { PHONETIC_DICTIONARY } from "../../translation/services/phonetic-dictionary";

export class VideoTranslateService {
    /**
     * Translates a full block of text (for Video Translation Pipeline).
     */
    async translateFullText(text: string, userApiKey?: string): Promise<string> {
        const allKeys = getAllKeys(userApiKey);
        if (allKeys.length === 0) throw new Error("No API key available.");

        for (const model of MODELS) {
            if (getDailyCount(model.id) >= model.rpd) continue;
            for (const apiKey of allKeys) {
                try {
                    const result = await this.callApi(text, model.id, apiKey);
                    if (result) {
                        incrementQuota(model.id);
                        return applyPhonetics(sanitizeTranslation(result), PHONETIC_DICTIONARY);
                    }
                } catch (err) {}
            }
        }
        throw new Error("All Gemini models and keys exhausted.");
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
}

export const videoTranslateService = new VideoTranslateService();
