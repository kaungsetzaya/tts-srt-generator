/**
 * ASS Builder Service - Handles generation of ASS subtitle content.
 * Aligned with ARCHITECTURE.md (Dubbing Module Services).
 */

import path from 'path';

export class AssBuilderService {
    /**
     * Build ASS subtitle style — fixed blur, correct full-width, aspect-ratio-aware
     */
    buildAssContent(
        segments: Array<{ startMs: number; endMs: number; text: string }>,
        fontPath: string,
        videoWidth: number,
        videoHeight: number,
        opts?: {
            fontSize?: number;
            fontColor?: string;
            marginV?: number;
            blurBg?: boolean;
            blurSize?: number;
            blurColor?: "black" | "white";
            boxPadding?: number;
            fullWidth?: boolean;
        }
    ): string {
        const playResX = videoWidth;
        const playResY = videoHeight;
        const fontScaleFactor = videoHeight / 490;
        const fontSize = Math.round((opts?.fontSize ?? 12) * fontScaleFactor * 2.0);
        const fontColor = opts?.fontColor ?? "#ffffff";

        const userMarginV = opts?.marginV ?? 30;
        const baseMarginV = 80 + userMarginV * 3;
        const marginV = Math.round(baseMarginV * (videoHeight / 1080));

        const blurBg = opts?.blurBg ?? true;
        const blurSize = opts?.blurSize ?? 8;
        const blurColor = opts?.blurColor ?? "black";
        const boxPadding = opts?.boxPadding ?? 4;
        const fullWidth = opts?.fullWidth ?? false;

        const hex = (fontColor.replace("#", "") + "000000").substring(0, 6);
        const r = parseInt(hex.substring(0, 2), 16) || 255;
        const g = parseInt(hex.substring(2, 4), 16) || 255;
        const b = parseInt(hex.substring(4, 6), 16) || 255;
        const assColor = `&H00${this.pad2(b)}${this.pad2(g)}${this.pad2(r)}`;

        const fontName = fontPath ? require('path').basename(fontPath, require('path').extname(fontPath)) : "Noto Sans Myanmar";

        let backColor = "&HFF000000"; 
        let borderStyle = 1; 
        let outline = 1;
        let shadow = 1;

        if (blurBg) {
            const opacityFraction = Math.min(0.72, (blurSize / 20) * 0.72); 
            const alphaInt = Math.round((1 - opacityFraction) * 255);
            const alphaHex = alphaInt.toString(16).padStart(2, "0").toUpperCase();
            const bgHex = blurColor === "black" ? "000000" : "FFFFFF";
            backColor = `&H${alphaHex}${bgHex}`;
            borderStyle = 3; 
            outline = Math.max(4, boxPadding * 3);
            shadow = 0;
        }

        const marginL = fullWidth ? 0 : Math.round(playResX * 0.04);
        const marginR = fullWidth ? 0 : Math.round(playResX * 0.04);
        const wrapStyle = fullWidth ? 1 : 0;

        const header = `[Script Info]\nScriptType: v4.00+\nWrapStyle: ${wrapStyle}\nPlayResX: ${playResX}\nPlayResY: ${playResY}\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,${fontName},${fontSize},${assColor},&H000000FF,&H00000000,${backColor},-1,0,0,0,100,100,0,0,${borderStyle},${outline},${shadow},2,${marginL},${marginR},${marginV},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;

        const events = segments.map(seg => {
            const cleanText = seg.text.replace(/\n/g, "\\N").replace(/,/g, "，");
            return `Dialogue: 0,${this.msToAssTime(seg.startMs)},${this.msToAssTime(seg.endMs)},Default,,0,0,0,,${cleanText}`;
        }).join("\n");

        return header + events + "\n";
    }

    private msToAssTime(ms: number): string {
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        const cs = Math.floor((ms % 1000) / 10);
        return `${h}:${this.pad(m)}:${this.pad(s)}.${this.pad(cs)}`;
    }

    private pad(n: number, len = 2): string { return String(n).padStart(len, "0"); }
    private pad2(n: number): string { return n.toString(16).padStart(2, "0").toUpperCase(); }
}

export const assBuilderService = new AssBuilderService();
