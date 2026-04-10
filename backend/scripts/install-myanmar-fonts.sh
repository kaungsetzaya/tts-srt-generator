#!/bin/bash
# ═══════════════════════════════════════════════════
# LUMIX — Install Myanmar Unicode Fonts for FFmpeg
# Run this script on the VPS to fix Myanmar subtitle rendering
# ═══════════════════════════════════════════════════

echo "🔤 Installing Myanmar Unicode fonts..."

# Option 1: Noto Sans Myanmar (Google's universal font — RECOMMENDED)
apt-get update -qq
apt-get install -y fonts-noto-core fonts-noto-extra 2>/dev/null || {
  echo "  → Trying manual Noto Sans Myanmar download..."
  mkdir -p /usr/share/fonts/truetype/noto
  curl -sL "https://github.com/googlefonts/noto-fonts/raw/main/unhinted/ttf/NotoSansMyanmar/NotoSansMyanmar-Regular.ttf" \
    -o /usr/share/fonts/truetype/noto/NotoSansMyanmar-Regular.ttf
  curl -sL "https://github.com/googlefonts/noto-fonts/raw/main/unhinted/ttf/NotoSansMyanmar/NotoSansMyanmar-Bold.ttf" \
    -o /usr/share/fonts/truetype/noto/NotoSansMyanmar-Bold.ttf
}

# Option 2: Padauk (dedicated Myanmar font — backup)
apt-get install -y fonts-padauk 2>/dev/null || {
  echo "  → Trying manual Padauk download..."
  mkdir -p /usr/share/fonts/truetype/padauk
  curl -sL "https://github.com/nicedoc/padauk/raw/master/Padauk-Regular.ttf" \
    -o /usr/share/fonts/truetype/padauk/Padauk-Regular.ttf 2>/dev/null
}

# Option 3: Pyidaungsu (Myanmar government font)
apt-get install -y fonts-myanmar 2>/dev/null || true

# Rebuild font cache
fc-cache -fv

echo ""
echo "✅ Myanmar fonts installed! Verifying..."
echo ""

# Verify Myanmar fonts are available
fc-list | grep -i "myanmar\|padauk\|pyidaungsu\|NotoSansMyanmar" || {
  echo "⚠️  No Myanmar fonts found in fc-list!"
  echo "   You may need to manually install a Myanmar TTF font to /usr/share/fonts/"
  exit 1
}

echo ""
echo "🎉 Done! Myanmar subtitles should now render correctly in FFmpeg."
echo "   Font priority in LUMIX: Noto Sans Myanmar → Padauk → Myanmar Text"
