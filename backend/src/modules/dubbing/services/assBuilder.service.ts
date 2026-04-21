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
            srtFontSize?: number;
            srtColor?: string;
            srtMarginV?: number;
            srtBlurBg?: boolean;
            srtBlurOpacity?: number;
            srtBlurSize?: number;
            srtBlurColor?: "black" | "white" | "transparent" | "blue" | "yellow";
            srtBoxPadding?: number;
            srtFullWidth?: boolean;
            srtDropShadow?: boolean;
        }
    ): string {
        const playResX = videoWidth;
        const playResY = videoHeight;
        const fontScaleFactor = videoHeight / 720;
        const fontSize = Math.round((opts?.srtFontSize ?? 24) * fontScaleFactor * 1.5);
        const fontColor = opts?.srtColor ?? "#ffffff";

        // Safe margin - keep text away from edges
        const safeMargin = Math.round(playResX * 0.03);
        
        // Vertical Position with safe margin
        const posPercent = opts?.srtMarginV ?? 10;
        const marginV = Math.round((posPercent / 100) * (videoHeight * 0.9));

        const blurBg = opts?.srtBlurBg ?? true;
        const blurOpacity = opts?.srtBlurOpacity ?? 80;
        const blurSize = opts?.srtBlurSize ?? 8;
        const blurColor = opts?.srtBlurColor ?? "black";
        const boxPadding = opts?.srtBoxPadding ?? 4;
        const fullWidth = opts?.srtFullWidth ?? false;
        const dropShadow = opts?.srtDropShadow ?? true;

        const blurColorMap: Record<string, string> = {
            black: "000000",
            white: "FFFFFF",
            transparent: "000000",
            blue: "0000FF",
            yellow: "FFFF00"
        };
        const bgHex = blurColorMap[blurColor] || "000000";

        const hex = (fontColor.replace("#", "") + "000000").substring(0, 6);
        const r = parseInt(hex.substring(0, 2), 16) || 255;
        const g = parseInt(hex.substring(2, 4), 16) || 255;
        const b = parseInt(hex.substring(4, 6), 16) || 255;
        const assColor = `&H00${this.pad2(b)}${this.pad2(g)}${this.pad2(r)}`;

        const fontBase = fontPath ? path.basename(fontPath).toLowerCase() : "";
        let fontName = "Noto Sans Myanmar";
        if (fontBase === "mmrtext.ttf") fontName = "Myanmar Text";
        else if (fontBase === "myanmar3.ttf") fontName = "Myanmar3";
        else if (fontBase.includes("notosansmyanmar")) fontName = "Noto Sans Myanmar";
        else if (fontPath) fontName = path.basename(fontPath, path.extname(fontPath));

        let backColor = "&HFF000000";
        let borderStyle = 1;
        let outline = 1;
        let shadow = dropShadow ? 1 : 0;

        if (blurBg) {
            const alphaInt = Math.round((1 - (blurOpacity / 100)) * 255);
            const alphaHex = alphaInt.toString(16).padStart(2, "0").toUpperCase();
            backColor = `&H${alphaHex}${bgHex}`;
            borderStyle = 3;
            outline = Math.max(4, blurSize * 2);
            shadow = 0;
        } else if (!dropShadow) {
            shadow = 0;
        }

        const marginL = fullWidth ? safeMargin : Math.round(playResX * 0.04);
        const marginR = fullWidth ? safeMargin : Math.round(playResX * 0.04);
        const wrapStyle = 0;

        const header = `[Script Info]\nScriptType: v4.00+\nWrapStyle: ${wrapStyle}\nPlayResX: ${playResX}\nPlayResY: ${playResY}\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,${fontName},${fontSize},${assColor},&H000000FF,&H00000000,${backColor},-1,0,0,0,100,100,0,0,${borderStyle},${outline},${shadow},2,${marginL},${marginR},${marginV},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;

        const events = segments.map(seg => {
            const cleanText = this.formatTextForAss(seg.text);
            return `Dialogue: 0,${this.msToAssTime(seg.startMs)},${this.msToAssTime(seg.endMs)},Default,,0,0,0,,${cleanText}`;
        }).join("\n");

        return header + events + "\n";
    }

    private formatTextForAss(text: string): string {
        const MAX_LINES = 2;
        let lines = text.split("\n").filter(l => l.trim());
        
        if (lines.length > MAX_LINES) {
            lines = lines.slice(0, MAX_LINES);
        }
        
        const formatted = lines.join("\\N");
        return formatted.replace(/,/g, "，");
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
