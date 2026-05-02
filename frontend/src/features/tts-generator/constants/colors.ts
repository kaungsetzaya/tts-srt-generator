// Premium UI Colors — Black & White Theme System
import { ACCENT, ACCENT_SECONDARY } from "@shared/const";

export const accent = ACCENT;
export const accentSecondary = ACCENT_SECONDARY;
export const deepRed = "#861C1C";
export const peach = "#ECCEB6";
export const cream = "#EBE6D8";
export const darkBrown = "#2B1D1C";

// ─── Premium B&W Light Theme ───
// Pure white, deep blacks, minimal color for maximum impact
export const lightBg = "#FFFFFF";
export const lightCardBg = "#FFFFFF";
export const lightCardBorder = "rgba(0,0,0,0.08)";
export const lightText = "#0A0A0A";
export const lightSubtext = "#666666";

// Helper: hex color + opacity → 8-digit hex
export function withOpacity(color: string, opacity: number): string {
  if (color.startsWith("#") && color.length === 7) {
    const hex = color.slice(1);
    const alpha = Math.round(opacity * 255)
      .toString(16)
      .padStart(2, "0");
    return `#${hex}${alpha}`;
  }
  return color;
}

export const accent15 = withOpacity(ACCENT, 0.15);
export const accent30 = withOpacity(ACCENT, 0.3);
export const accent40 = withOpacity(ACCENT, 0.4);
export const accent80 = withOpacity(ACCENT, 0.8);
