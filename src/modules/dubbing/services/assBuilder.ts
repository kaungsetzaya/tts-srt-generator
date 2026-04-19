import type { Segment, TranslatedSegment } from "../../../shared/types/segment";

export function buildAssSubtitle(segments: TranslatedSegment[]): string {
  const lines: string[] = [
    "[Script Info]",
    "Title: Myanmar Subtitles",
    "ScriptType: v4.00+",
    "PlayResX: 1920",
    "PlayResY: 1080",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    "Style: Default,Teko,50,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1",
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  for (const seg of segments) {
    const start = formatAssTime(seg.start * 1000);
    const end = formatAssTime(seg.end * 1000);
    const text = seg.translatedText.replace(/\n/g, "\\N");
    lines.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`);
  }

  return lines.join("\n");
}

function formatAssTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${h}:${pad(m)}:${pad(s)}.${pad(cs, 2)}`;
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}