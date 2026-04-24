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
            srtBlurColor?: 'black' | 'white' | 'transparent';
            srtBoxPadding?: number;
            srtFullWidth?: boolean;
            srtDropShadow?: boolean;
        }
    ): string {
        const playResX = videoWidth;
        const playResY = videoHeight;

        // Font size - 720p base scale
        const scaleFactor = videoHeight / 720;
        const fontSize = Math.round((opts?.srtFontSize ?? 24) * scaleFactor);

        const fontColor   = opts?.srtColor     ?? '#ffffff';
        const marginVPct  = opts?.srtMarginV    ?? 5;
        const blurBg      = opts?.srtBlurBg     ?? true;
        const blurOpacity = opts?.srtBlurOpacity ?? 50;
        const blurColor   = opts?.srtBlurColor   ?? 'black';
        const fullWidth   = opts?.srtFullWidth   ?? false;
        const dropShadow  = opts?.srtDropShadow  ?? true;
        const boxPadding  = opts?.srtBoxPadding  ?? 4;

        // Font name detect
        let fontName = 'Noto Sans Myanmar';
        const fontBase = fontPath ? path.basename(fontPath).toLowerCase() : '';
        if (fontBase === 'mmrtext.ttf')                fontName = 'Myanmar Text';
        else if (fontBase === 'myanmar3.ttf')          fontName = 'Myanmar3';
        else if (fontBase.includes('notosansmyanmar')) fontName = 'Noto Sans Myanmar';
        else if (fontPath)                             fontName = path.basename(fontPath, path.extname(fontPath));

        // Color → ASS BGR format
        const hex = (fontColor.replace('#', '') + '000000').substring(0, 6);
        const r   = parseInt(hex.substring(0, 2), 16) || 255;
        const g   = parseInt(hex.substring(2, 4), 16) || 255;
        const b   = parseInt(hex.substring(4, 6), 16) || 255;
        const assColor    = `&H00${this.pad2(b)}${this.pad2(g)}${this.pad2(r)}`;
        const shadowColor = '&H80000000';

        const outline = 1.5;
        const shadow  = dropShadow ? 2.0 : 0;

        // MarginV = pixels from bottom of screen to bottom of subtitle
        const marginV = Math.round((marginVPct / 100) * playResY);
        const marginL = fullWidth ? 20 : Math.round(playResX * 0.05);
        const marginR = fullWidth ? 20 : Math.round(playResX * 0.05);

        // Box calculation
        // Text alignment = 2 (bottom-center)
        // Text bottom edge = playResY - marginV
        // Box covers 2 lines of text + padding
        const lineH   = Math.round(fontSize * 1.55);
        const padPx   = Math.round(lineH * (boxPadding / 20));
        const boxH    = lineH * 2 + padPx * 2;
        const boxBtm  = playResY - marginV + padPx;
        const boxTop  = boxBtm - boxH;
        const boxLeft = fullWidth ? 0 : Math.round(playResX * 0.03);
        const boxW    = fullWidth ? playResX : Math.round(playResX * 0.94);

        // Background color & alpha
        const alphaInt  = Math.round((1 - blurOpacity / 100) * 255);
        const alphaHex  = alphaInt.toString(16).padStart(2, '0').toUpperCase();
        const finalAlpha = blurColor === 'transparent' ? 'FF' : alphaHex;
        const bgColorMap: Record<string, string> = {
            black: '000000', white: 'FFFFFF', transparent: '000000'
        };
        const bgrHex = bgColorMap[blurColor] ?? '000000';

        // Vector draw background box using \an7 (top-left anchor) + \pos(x,y)
        const drawCmd =
            `{\\an7\\pos(${boxLeft},${boxTop})\\p1\\bord0\\shad0` +
            `\\1c&H${bgrHex}&\\1a&H${finalAlpha}&}` +
            `m 0 0 l ${boxW} 0 l ${boxW} ${boxH} l 0 ${boxH}` +
            `{\\p0}`;

        const header =
            `[Script Info]\n` +
            `ScriptType: v4.00+\n` +
            `WrapStyle: 0\n` +
            `PlayResX: ${playResX}\n` +
            `PlayResY: ${playResY}\n` +
            `ScaledBorderAndShadow: yes\n\n` +
            `[V4+ Styles]\n` +
            `Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n` +
            `Style: Default,${fontName},${fontSize},${assColor},&H000000FF,&H00000000,${shadowColor},-1,0,0,0,100,100,0,0,1,${outline},${shadow},2,${marginL},${marginR},${marginV},1\n\n` +
            `[Events]\n` +
            `Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;

        const events = segments.map(seg => {
            const cleanText = this.formatTextForAss(seg.text);
            const start     = this.msToAssTime(seg.startMs);
            const end       = this.msToAssTime(seg.endMs);

            let out = '';
            if (blurBg && blurColor !== 'transparent') {
                out += `Dialogue: 0,${start},${end},Default,,0,0,0,,${drawCmd}\n`;
            }
            out += `Dialogue: 1,${start},${end},Default,,0,0,0,,${cleanText}`;
            return out;
        }).join('\n');

        return header + events + '\n';
    }

    private formatTextForAss(text: string): string {
        // \\n (literal backslash-n) နဲ့ \n (actual newline) နှစ်မျိုးလုံး handle
        const normalized = text.replace(/\\n/g, '\n');
        const lines = normalized
            .split('\n')
            .map(l => l.trim())
            .filter(l => l);
        if (lines.length === 0) return '';
        // ASS မှာ line break = \N
        return lines.slice(0, 2).join('\\N');
    }

    private msToAssTime(ms: number): string {
        const h  = Math.floor(ms / 3600000);
        const m  = Math.floor((ms % 3600000) / 60000);
        const s  = Math.floor((ms % 60000) / 1000);
        const cs = Math.floor((ms % 1000) / 10);
        return `${h}:${this.pad(m)}:${this.pad(s)}.${this.pad(cs)}`;
    }

    private pad(n: number):  string { return String(n).padStart(2, '0'); }
    private pad2(n: number): string { return n.toString(16).padStart(2, '0').toUpperCase(); }
}

export const assBuilderService = new AssBuilderService();
