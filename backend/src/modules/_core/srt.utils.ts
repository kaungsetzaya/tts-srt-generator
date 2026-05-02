/**
 * SRT / Subtitle Shared Utilities
 * Deduplicated from tts.service.ts, dubbing-tts.service.ts, dubVideo.pipeline.ts
 */

const segmenter = new Intl.Segmenter("my", { granularity: "grapheme" });
const segmenterWord = new Intl.Segmenter("my", { granularity: "word" });

export function graphemeLen(s: string): number {
    return [...segmenter.segment(s)].length;
}

export function getGraphemes(s: string): string[] {
    return [...segmenter.segment(s)].map(g => g.segment);
}

export function getWords(s: string): string[] {
    return [...segmenterWord.segment(s)].map(w => w.segment);
}

export function srtTimeToMs(time: string): number {
    const [hms, ms] = time.split(",");
    const [h, m, s] = hms.split(":").map(Number);
    return (h * 3600 + m * 60 + s) * 1000 + Number(ms);
}

export function msToSrtTime(ms: number): string {
    ms = Math.max(0, ms);
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const mil = ms % 1000;
    return `${pad(h)}:${pad(m)}:${pad(s)},${pad(mil, 3)}`;
}

export function pad(n: number, len = 2): string {
    return String(n).padStart(len, "0");
}

export function parseLastEndTime(srt: string): number {
    const normalized = srt.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const matches = [...normalized.matchAll(/\d{2}:\d{2}:\d{2},\d{3} --> (\d{2}:\d{2}:\d{2},\d{3})/g)];
    if (matches.length === 0) return 0;
    return srtTimeToMs(matches[matches.length - 1][1]);
}

export interface RawSrtSegment {
    startMs: number;
    endMs: number;
    text: string;
}

export function parseRawSrt(rawSrt: string): RawSrtSegment[] {
    const normalized = rawSrt.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const blocks = normalized.trim().split(/\n\n+/);
    return blocks.map(block => {
        const lines = block.trim().split("\n");
        if (lines.length < 3) return null;
        const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
        if (!timeMatch) return null;
        return { startMs: srtTimeToMs(timeMatch[1]), endMs: srtTimeToMs(timeMatch[2]), text: lines.slice(2).join(" ").trim() };
    }).filter(Boolean) as RawSrtSegment[];
}

export const BURMESE_SRT_CONFIG = { "16:9": { charsPerLine: 18 }, "9:16": { charsPerLine: 12 } } as const;

/**
 * Split text into max 2 lines with Burmese grapheme safety.
 */
export function formatSrtText(text: string, charsPerLine: number): string {
    const graphemes = getGraphemes(text);
    const lines: string[] = [];
    let currentLine: string[] = [];
    let currentLen = 0;

    for (const g of graphemes) {
        if (currentLen + 1 > charsPerLine && currentLine.length > 0) {
            if (lines.length >= 1) {
                if (lines.length >= 2) {
                    lines[1] += g;
                    continue;
                }
                lines.push(currentLine.join(""));
                currentLine = [g];
                currentLen = 1;
            } else {
                lines.push(currentLine.join(""));
                currentLine = [g];
                currentLen = 1;
            }
        } else {
            currentLine.push(g);
            currentLen++;
        }
    }

    if (currentLine.length > 0) {
        if (lines.length === 0) {
            lines.push(currentLine.join(""));
        } else if (lines.length === 1) {
            lines.push(currentLine.join(""));
        } else {
            lines[1] += currentLine.join("");
        }
    }

    return lines.slice(0, 2).join("\n");
}
