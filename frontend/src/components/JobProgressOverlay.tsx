import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Wand2 } from "lucide-react";

interface JobProgressOverlayProps {
  isVisible: boolean;
  progress: number;
  message: string;
  isDark: boolean;
  accent: string;
  title?: string;
  lang?: "en" | "mm";
}

export function JobProgressOverlay({
  isVisible,
  progress,
  message,
  isDark,
  accent,
  title = "Processing...",
  lang = "mm"
}: JobProgressOverlayProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-md"
          style={{
            background: isDark ? "rgba(0, 0, 0, 0.7)" : "rgba(255, 255, 255, 0.4)",
          }}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="w-full max-w-sm rounded-[2rem] p-6 shadow-2xl overflow-hidden relative"
            style={{
              background: isDark ? "rgba(30, 25, 24, 0.95)" : "rgba(255, 255, 255, 0.9)",
              border: `1px solid ${isDark ? "rgba(192,111,48,0.2)" : "rgba(192,111,48,0.15)"}`,
              boxShadow: `0 20px 40px -10px ${isDark ? 'rgba(0,0,0,0.5)' : 'rgba(192,111,48,0.15)'}, inset 0 1px 0 ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)'}`,
            }}
          >
            {/* Background Glow */}
            <div 
              className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-[50px] opacity-20 pointer-events-none"
              style={{ background: accent }}
            />
            <div 
              className="absolute -bottom-20 -left-20 w-40 h-40 rounded-full blur-[50px] opacity-20 pointer-events-none"
              style={{ background: accent }}
            />

            <div className="relative z-10 flex flex-col items-center text-center">
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 relative"
                style={{ 
                  background: isDark ? "rgba(192,111,48,0.15)" : "rgba(192,111,48,0.1)",
                  border: `1px solid ${isDark ? "rgba(192,111,48,0.3)" : "rgba(192,111,48,0.2)"}`
                }}
              >
                <div className="absolute inset-0 rounded-2xl animate-spin" style={{ borderTop: `2px solid ${accent}`, borderRadius: "1rem" }} />
                <Wand2 className="w-8 h-8" style={{ color: accent }} />
              </div>

              <h3 
                className="text-lg uppercase tracking-widest font-black mb-1"
                style={{ color: isDark ? "#ebe6d8" : "#2B1D1C" }}
              >
                {title}
              </h3>
              
              <p 
                className="text-xs font-semibold uppercase tracking-wider mb-6 min-h-[1.5rem]"
                style={{ color: isDark ? "#ecceb6" : "#8B7355" }}
              >
                {message || (lang === "mm" ? "အနည်းငယ်စောင့်ဆိုင်းပါ..." : "Please wait...")}
              </p>

              <div className="w-full relative">
                <div 
                  className="h-2.5 w-full rounded-full overflow-hidden"
                  style={{ background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" }}
                >
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: "easeOut", duration: 0.5 }}
                    className="h-full rounded-full relative overflow-hidden"
                    style={{ background: `linear-gradient(90deg, ${accent}, #F4B34F)` }}
                  >
                    <div className="absolute inset-0 animate-shimmer" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)" }} />
                  </motion.div>
                </div>
                
                <div 
                  className="absolute -top-6 right-0 text-2xl font-black italic tracking-tighter"
                  style={{ 
                    color: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                    lineHeight: 1
                  }}
                >
                  {Math.round(progress)}%
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
