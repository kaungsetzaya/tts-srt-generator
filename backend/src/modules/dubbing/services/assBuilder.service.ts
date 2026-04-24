import path from 'path';

export class AssBuilderService {
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
            srtBlurSize?: number;
            srtBlurOpacity?: number;
            srtBlurColor?: "black" | "white" | "transparent";
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

        const posPercent = opts?.srtMarginV ?? 10;
        const marginV = Math.round((posPercent / 100) * (videoHeight * 0.9));

        const blurBg = opts?.srtBlurBg ?? true;
        const blurOpacity = opts?.srtBlurOpacity ?? 80;
        const blurColor = opts?.srtBlurColor ?? "black";
        const fullWidth = opts?.srtFullWidth ?? false;
        const dropShadow = opts?.srtDropShadow ?? true;

        let fontName = "Noto Sans Myanmar";
        const fontBase = fontPath ? path.basename(fontPath).toLowerCase() : "";
        if (fontBase === "mmrtext.ttf") fontName = "Myanmar Text";
        else if (fontBase === "myanmar3.ttf") fontName = "Myanmar3";
        else if (fontBase.includes("notosansmyanmar")) fontName = "Noto Sans Myanmar";
        else if (fontPath) fontName = path.basename(fontPath, path.extname(fontPath));

        const hex = (fontColor.replace("#", "") + "000000").substring(0, 6);
        const r = parseInt(hex.substring(0, 2), 16) || 255;
        const g = parseInt(hex.substring(2, 4), 16) || 255;
        const b = parseInt(hex.substring(4, 6), 16) || 255;
        const assColor = `&H00${this.pad2(b)}${this.pad2(g)}${this.pad2(r)}`;

        const borderStyle = 1;
        const outline = 1.5;
        const shadow = dropShadow ? 1.5 : 0;
        const shadowColor = "&H80000000";

        const padY = Math.round(playResY * ((opts?.srtBoxPadding ?? 4) / 100));
        const boxBottom = playResY - marginV + padY;
        const boxTop = boxBottom - Math.round(fontSize * 2.8) - (padY * 2);

        let boxLeft = 0;
        let boxRight = playResX;

        if (!fullWidth) {
            boxLeft = Math.round(playResX * 0.08);
            boxRight = Math.round(playResX * 0.92);
        }

        const alphaInt = Math.round((1 - (blurOpacity / 100)) * 255);
        const alphaHex = alphaInt.toString(16).padStart(2, "0").toUpperCase();

        const boxColorMap: Record<string, string> = {
            black: "000000",
            white: "FFFFFF",
            transparent: "000000"
        };
        const bgrHex = boxColorMap[blurColor] || "000000";

        // Draw background box vector
        const drawCommand = `{\\pos(0,0)\\1c&H${bgrHex}&\\1a&H${alphaHex}&\\p1\\bord0\\shad0}m ${boxLeft} ${boxTop} l ${boxRight} ${boxTop} l ${boxRight} ${boxBottom} l ${boxLeft} ${boxBottom}{\\p0}`;

        const marginL = Math.round(playResX * 0.10);
        const marginR = Math.round(playResX * 0.10);

        const header = `[Script Info]\nScriptType: v4.00+\nWrapStyle: 1\nPlayResX: ${playResX}\nPlayResY: ${playResY}\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,${fontName},${fontSize},${assColor},&H000000FF,&H00000000,${shadowColor},-1,0,0,0,100,100,0,0,${borderStyle},${outline},${shadow},2,${marginL},${marginR},${marginV},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;

        const events = segments.map(seg => {
            const cleanText = this.formatTextForAss(seg.text);
            const start = this.msToAssTime(seg.startMs);
            const end = this.msToAssTime(seg.endMs);

            let eventStr = "";
            if (blurBg && blurColor !== "transparent") {
                eventStr += `Dialogue: 0,${start},${end},Default,,0,0,0,,${drawCommand}\n`;
            }
            eventStr += `Dialogue: 1,${start},${end},Default,,0,0,0,,${cleanText}`;

            return eventStr;
        }).join("\n");

        return header + events + "\n";
    }

    private formatTextForAss(text: string): string {
        let lines = text.split(/[\n\r]+/).filter(l => l.trim());
        if (lines.length === 0) return "";
        if (lines.length > 2) lines = lines.slice(0, 2);
        const formatted = lines.join("\\N");
        return formatted.replace(/,/g, "၊");
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
