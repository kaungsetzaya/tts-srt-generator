import { useLocation } from "wouter";
import { motion } from "framer-motion";

export default function Landing() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-black text-white relative font-sans overflow-x-hidden">
      
      {/* 🌌 FULL PAGE GRID - MATCHING YOUR ORIGINAL COLOR */}
      <div className="absolute inset-0 pointer-events-none opacity-20 z-0" style={{
        backgroundImage: "linear-gradient(rgba(139,92,246,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.15) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        height: "100%"
      }} />

      {/* Hero Section */}
      <div className="relative z-10 flex flex-col items-center justify-center h-screen text-center px-4">
        {/* THE ORIGINAL MASSIVE PURPLE GLOW */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[900px] h-[300px] md:h-[600px] rounded-full opacity-35 blur-[130px] pointer-events-none"
          style={{ background: "radial-gradient(circle, oklch(0.65 0.25 310), transparent)" }} />

        <div className="relative z-10">
          <p className="text-[10px] md:text-xs uppercase tracking-[0.5em] text-purple-400 font-bold mb-6 opacity-80">
            Advanced Myanmar Content Creation
          </p>

          {/* LUMIX STUDIO - ORIGINAL COLOR & GLOW */}
          <h1 className="font-black uppercase leading-[0.85] mb-4"
            style={{
              fontSize: "clamp(60px, 15vw, 180px)",
              color: "oklch(0.72 0.22 310)",
              textShadow: "0 0 80px oklch(0.65 0.25 310 / 80%)",
              letterSpacing: "-0.04em",
            }}>
            LUMIX STUDIO
          </h1>

          {/* POWERING YOUR CONTENT ENGINE - ORIGINAL BLUE GLOW */}
          <h2 className="font-black uppercase mb-12"
            style={{
              fontSize: "clamp(20px, 4vw, 50px)",
              color: "oklch(0.6 0.28 280)",
              textShadow: "0 0 30px oklch(0.6 0.28 280 / 60%)",
              letterSpacing: "0.15em",
            }}>
            POWERING YOUR CONTENT ENGINE
          </h2>

          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/login")}
            className="px-20 py-6 text-xl font-black uppercase tracking-widest text-white transition-all duration-300 rounded-sm"
            style={{
              background: "oklch(0.65 0.25 310)",
              boxShadow: "0 0 60px oklch(0.65 0.25 310 / 60%)",
            }}>
            LOGIN TO START
          </motion.button>
        </div>

        {/* BRIGHT SCROLL INDICATOR */}
        <div className="absolute bottom-10 flex flex-col items-center gap-3 opacity-60">
          <span className="text-xs uppercase tracking-[0.4em] font-bold text-purple-300">Scroll</span>
          <div className="w-[1px] h-14 bg-gradient-to-b from-purple-500 to-transparent"></div>
        </div>
      </div>

      {/* Info Boxes Section with Black Background and Grid */}
      <div className="relative z-10 px-6 md:px-12 py-32 border-t border-purple-900/20 bg-black/60">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          
          <div className="p-10 border border-purple-900/30 bg-black flex flex-col items-start text-left min-h-[300px]">
            <span className="text-5xl block mb-8">🎙️</span>
            <h4 className="text-xl font-black uppercase mb-6 text-purple-400">AI Voice (TTS)</h4>
            <p className="text-gray-400 text-sm leading-relaxed max-w-[300px]">
              စာသားမှ Studio Quality အသံဖိုင်များသို့ ပြောင်းလဲပေးသည်။ စိတ်ကြိုက်အသံနှင့် Speed ကို ချိန်ညှိနိုင်သည်။
            </p>
          </div>

          <div className="p-10 border border-purple-900/30 bg-black flex flex-col items-start text-left min-h-[300px]">
            <span className="text-5xl block mb-8">📝</span>
            <h4 className="text-xl font-black uppercase mb-6 text-purple-400">Smart Subtitles</h4>
            <p className="text-gray-400 text-sm leading-relaxed max-w-[300px]">
              Video Format မျိုးစုံအတွက် အချိန်ကိုက် SRT ဖိုင်များကို အလိုအလျောက် ထုတ်ပေးသည်။
            </p>
          </div>

          <div className="p-10 border border-purple-900/30 bg-black flex flex-col items-start text-left min-h-[300px]">
            <span className="text-5xl block mb-8">🌍</span>
            <h4 className="text-xl font-black uppercase mb-6 text-purple-400">Video Translate</h4>
            <p className="text-gray-400 text-sm leading-relaxed max-w-[300px]">
              ဗီဒီယိုများမှ အသံကို စာသားအဖြစ်သို့ တိကျစွာ ဘာသာပြန်ပေးသည်။ (စာသားသီးသန့် ထုတ်ပေးပါမည်)
            </p>
          </div>

        </div>
      </div>

      <footer className="relative z-10 text-center py-10 border-t border-purple-900/10 text-gray-800 text-[10px] tracking-[0.5em] uppercase">
        © 2026 LUMIX · PROFESSIONAL CONTENT TOOLS
      </footer>
    </div>
  );
}
