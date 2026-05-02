/**
 * Gemini Core — Shared infrastructure for all Gemini API usage
 * Quota management, key rotation, models, base utilities
 */
import { promises as fs } from 'fs';
import * as path from 'path';

const QUOTA_FILE = path.join(process.cwd(), 'backend/.gemini_quota.json');

export const MODELS = [
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

export function getDailyCount(modelId: string): number {
    const today = new Date().toISOString().split("T")[0];
    const entry = quotaMap.get(modelId);
    if (!entry || entry.date !== today) return 0;
    return entry.count;
}

export function incrementQuota(modelId: string): void {
    const today = new Date().toISOString().split("T")[0];
    const current = quotaMap.get(modelId);
    if (!current || current.date !== today) {
        quotaMap.set(modelId, { date: today, count: 1 });
    } else {
        current.count++;
    }
    saveQuotaFile(Object.fromEntries(quotaMap)).catch(() => {});
}

export function getAllSystemKeys(): string[] {
    const keysStr = process.env.GEMINI_API_KEY || "";
    return keysStr.split(",").map(k => k.trim()).filter(k => k.length > 0);
}

export interface GeminiSegment {
    index: number;
    start: number;
    end: number;
    text: string;
}

export interface GeminiTranslatedSegment extends GeminiSegment {
    translatedText: string;
}

export function getAllKeys(userApiKey?: string): string[] {
    const systemKeys = getAllSystemKeys();
    return userApiKey?.trim() ? [userApiKey.trim(), ...systemKeys] : systemKeys;
}

export function applyPhonetics(text: string, dictionary: Record<string, string>): string {
    let result = text;
    const keys = Object.keys(dictionary).sort((a, b) => b.length - a.length);
    for (const key of keys) {
        result = result.split(key).join(dictionary[key]);
    }
    return result;
}

export function sanitizeTranslation(text: string): string {
    if (!text || typeof text !== 'string') return "";
    let cleaned = text.trim();

    const NL = '§NL§';
    cleaned = cleaned.replace(/\\n/g, NL).replace(/\n/g, NL);

    cleaned = cleaned.replace(/^(Here is|Here's|Translation:|Translated:|မြန်မာဘာသာပြန်:).*/gim, '');
    cleaned = cleaned.replace(/\*\*[^*]+\*\*/g, '');
    cleaned = cleaned.replace(/[#_*\[\]]/g, '');
    cleaned = cleaned.replace(/"/g, '');

    cleaned = cleaned.replace(/(?<!\d)\.(?!\d)/g, '။');
    cleaned = cleaned.replace(/(?<!\d),(?!\d)/g, '၊');
    cleaned = cleaned.replace(/၊\s*$/, '။');

    const checkEnd = cleaned.replace(new RegExp(NL, 'g'), '').trim();
    if (checkEnd.length > 0 && !/[။၊]$/.test(checkEnd)) {
        cleaned += '။';
    }

    cleaned = cleaned.replace(new RegExp(NL, 'g'), '\n');
    cleaned = cleaned.replace(/[ \t]{2,}/g, ' ').trim();

    return cleaned;
}
