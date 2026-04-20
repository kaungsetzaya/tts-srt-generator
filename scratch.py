import re

with open("frontend/src/pages/TTSGenerator.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update Preview CSS
preview_target = r"""                                      padding: computeSrtPreviewStyle\.padding,
                                      borderRadius: srtFullWidth
                                        \? "0"
                                        : srtBorderRadius === "rounded"
                                          \? "12px"
                                          : "4px",
                                      fontSize: computeSrtPreviewStyle\.fontSize,
                                      color: srtColor,
                                      textShadow: computeSrtPreviewStyle\.textShadow,
                                      background: computeSrtPreviewStyle\.background,
                                      backdropFilter: srtBlurBg
                                        \? `blur\(\$\{srtBlurSize\}px\)`
                                        : "none",
                                      textAlign: "center",
                                      width: srtFullWidth \? "100%" : "auto",
                                      maxWidth: srtFullWidth \? "100%" : "90%",
                                      fontFamily:
                                        "'Noto Sans Myanmar', 'Pyidaungsu', sans-serif",
                                      transition: "all 0\.2s ease-out","""
preview_replacement = """                                      padding: `${srtBoxPadding * 2}px ${srtBoxPadding * 4}px`,
                                      borderRadius: srtFullWidth
                                        ? "0"
                                        : srtBorderRadius === "rounded"
                                          ? "12px"
                                          : "4px",
                                      fontSize: `${Math.round(srtFontSize * 0.8)}px`,
                                      color: srtColor,
                                      textShadow: srtDropShadow ? "2px 2px 4px rgba(0,0,0,0.8)" : "none",
                                      background: srtBlurBg 
                                        ? srtBlurColor === "black" 
                                          ? `rgba(0,0,0,${Math.min(1, srtBlurSize / 100)})` 
                                          : `rgba(255,255,255,${Math.min(1, srtBlurSize / 100)})`
                                        : "transparent",
                                      textAlign: "center",
                                      width: srtFullWidth ? "100%" : "auto",
                                      maxWidth: srtFullWidth ? "100%" : "90%",
                                      fontFamily:
                                        "'Noto Sans Myanmar', 'Pyidaungsu', sans-serif",
                                      transition: "all 0.2s ease-out","""
content = re.sub(preview_target, preview_replacement, content)

# Update Preview Top
top_target = r"""                                    top: computeSrtPreviewStyle\.wrapperTop,"""
top_replacement = """                                    top: `${100 - srtMarginV}%`,
                                    transform: "translateY(-50%)","""
content = re.sub(top_target, top_replacement, content)

# 2. Update Font Size
font_target = r"""                            \{\/\* Font Size \*\/\}
                            <div className="mb-4">
                              <div className="flex justify-between items-center mb-2\.5">
                                <span className="text-xs font-semibold" style=\{\{ color: subtextColor \}\}>
                                  \{lang === "mm" \? "စာလုံးအရွယ်" : "Text Size"\}
                                </span>
                                <span
                                  className="text-xs font-bold px-2\.5 py-1 rounded-lg"
                                  style=\{\{
                                    background: isDark \? "rgba\(192,111,48,0\.2\)" : "linear-gradient\(135deg, rgba\(192,111,48,0\.08\), rgba\(244,179,79,0\.08\)\)",
                                    color: accent,
                                    border: `1px solid \$\{isDark \? "rgba\(192,111,48,0\.3\)" : "rgba\(192,111,48,0\.15\)"\}`\,
                                  \}\}
                                >
                                  \{srtFontSize\}px
                                </span>
                              </div>
                              <input
                                type="range"
                                min="12"
                                max="56"
                                value=\{srtFontSize\}
                                onChange=\{e => setSrtFontSize\(Number\(e\.target\.value\)\)\}
                                className="premium-slider w-full"
                              />
                            </div>"""

font_replacement = """                            {/* Font Size */}
                            <div className="mb-4">
                              <div className="flex items-center justify-between mb-2.5">
                                <span className="text-xs font-semibold" style={{ color: subtextColor }}>
                                  {lang === "mm" ? "စာလုံးအရွယ်" : "Text Size"}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                {[
                                  { label: lang === "mm" ? "သေးငယ်သော" : "Small", val: 18 },
                                  { label: lang === "mm" ? "အလတ်စား" : "Medium", val: 24 },
                                  { label: lang === "mm" ? "ကြီးမားသော" : "Large", val: 32 }
                                ].map(size => (
                                  <button
                                    key={size.val}
                                    onClick={() => setSrtFontSize(size.val)}
                                    className="py-2 rounded-xl text-xs font-bold transition-all"
                                    style={{
                                      background: srtFontSize === size.val
                                        ? "linear-gradient(135deg, #C06F30, #F4B34F)"
                                        : isDark ? "rgba(255,255,255,0.05)" : "#F0EBE3",
                                      color: srtFontSize === size.val ? "#fff" : subtextColor,
                                      boxShadow: srtFontSize === size.val ? "0 2px 8px rgba(192,111,48,0.25)" : "none",
                                      border: `1px solid ${srtFontSize === size.val ? "transparent" : isDark ? "rgba(255,255,255,0.05)" : "rgba(192,111,48,0.08)"}`
                                    }}
                                  >
                                    {size.label}
                                  </button>
                                ))}
                              </div>
                            </div>"""
content = re.sub(font_target, font_replacement, content)

# 3. Update Position
pos_target = r"""                                  <span className="text-xs font-bold" style=\{\{ color: accent \}\}>
                                    \{srtMarginV\}%
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min="5"
                                  max="80"
                                  value=\{srtMarginV\}
                                  onChange=\{e => setSrtMarginV\(Number\(e\.target\.value\)\)\}
                                  className="premium-slider w-full"
                                />"""
pos_replacement = """                                  <span className="text-[10px] font-semibold" style={{ color: subtextColor, opacity: 0.8 }}>
                                    {lang === "mm" ? "အောက် > အပေါ်" : "Bottom > Top"} ({srtMarginV}%)
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={srtMarginV}
                                  onChange={e => setSrtMarginV(Number(e.target.value))}
                                  className="premium-slider w-full"
                                />"""
content = re.sub(pos_target, pos_replacement, content)

# 4. Update Opacity/Blur
blur_target = r"""                                  <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-semibold" style=\{\{ color: subtextColor \}\}>
                                      \{lang === "mm" \? "Blur အား" : "Blur Intensity"\}
                                    </span>
                                    <span className="text-xs font-bold" style=\{\{ color: accent \}\}>
                                      \{srtBlurSize\}
                                    </span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="20"
                                    value=\{srtBlurSize\}
                                    onChange=\{e => setSrtBlurSize\(Number\(e\.target\.value\)\)\}
                                    className="premium-slider w-full"
                                  />"""
blur_replacement = """                                  <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-semibold" style={{ color: subtextColor }}>
                                      {lang === "mm" ? "အလင်းပိတ်မှု" : "Background Opacity"}
                                    </span>
                                    <span className="text-xs font-bold" style={{ color: accent }}>
                                      {srtBlurSize}%
                                    </span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={srtBlurSize}
                                    onChange={e => setSrtBlurSize(Number(e.target.value))}
                                    className="premium-slider w-full"
                                  />"""
content = re.sub(blur_target, blur_replacement, content)

with open("frontend/src/pages/TTSGenerator.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
