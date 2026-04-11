import { useLocation } from "wouter";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";

const C = {
  bg: "#0f0f0f", dark: "#1a1a1a", brick: "#861C1C", copper: "#C06F30",
  gold: "#F4B34F", cream: "#EBE6D8", nude: "#ECCEB6",
  glass: "rgba(255,255,255,0.06)", glassB: "rgba(255,255,255,0.12)", glassH: "rgba(255,255,255,0.18)",
};

function F({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const r = useRef<HTMLDivElement>(null);
  const v = useInView(r, { once: true, margin: "-60px" });
  return <motion.div ref={r} initial={{ opacity: 0, y: 50, rotateX: 8 }} animate={v ? { opacity: 1, y: 0, rotateX: 0 } : {}} transition={{ duration: 0.8, delay, ease: [0.25, 0.46, 0.45, 0.94] }} className={className}>{children}</motion.div>;
}

const features = [
  { icon: "🎙️", title: "Voice Generation", badge: "Multi Voice", desc: "စာသားမှ Studio-Quality အသံဖိုင်များသို့ ပြောင်းလဲပေးသည်။ Speed, Pitch စိတ်ကြိုက်ချိန်ညှိနိုင်သည်။", detail: "Male & Female · Speed · Pitch · MP3/WAV" },
  { icon: "📝", title: "Smart Subtitles", badge: "Auto Timing", desc: "Video Format မည်သည့်အမျိုးအစားဖြစ်ဖြစ် SRT Subtitle ဖိုင်များကို အလိုအလျောက် ထုတ်ပေးသည်။", detail: "Auto SRT · Multi-platform · Timestamps" },
  { icon: "🎬", title: "Video Maker", badge: "One-Click", desc: "ဗီဒီယိုတင်ပြီး မြန်မာအသံထည့်လိုက်ပါ။ ဘာသာပြန်၊ အသံ၊ စာတန်းထိုး အကုန်အချောသတ်ပေးသည်။", detail: "Translate · Dub · Subtitle · Export" },
];
const steps = [
  { n: "01", t: "Login", d: "Telegram Bot မှ Code ရယူပါ" },
  { n: "02", t: "ရွေးချယ်", d: "TTS · ဘာသာပြန် · Video" },
  { n: "03", t: "ဖန်တီး", d: "စာသား (သို့) ဗီဒီယိုတင်ပါ" },
  { n: "04", t: "ဒေါင်းလုတ်", d: "MP3 · SRT · MP4 ယူပါ" },
];

export default function Landing() {
  const [, nav] = useLocation();
  const heroRef = useRef<HTMLDivElement>(null);
  const featRef = useRef<HTMLElement>(null);
  const [trans, setTrans] = useState(false);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOp = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.7], [1, 0.92]);
  const heroRotate = useTransform(scrollYProgress, [0, 0.7], [0, 2]);
  const go = () => { setTrans(true); setTimeout(() => nav("/login"), 500); };

  useEffect(() => { document.documentElement.style.scrollBehavior = "smooth"; return () => { document.documentElement.style.scrollBehavior = ""; }; }, []);

  return (
    <div className="min-h-screen relative overflow-x-hidden" style={{ background: C.bg, color: C.cream, fontFamily: "'Inter', serif", perspective: "1200px" }}>

      {/* Ambient glow blobs */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[20%] left-[30%] w-[500px] h-[500px] rounded-full blur-[150px]" style={{ background: `${C.copper}15` }} />
        <div className="absolute bottom-[20%] right-[20%] w-[400px] h-[400px] rounded-full blur-[120px]" style={{ background: `${C.gold}10` }} />
      </div>

      {/* Grid */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{ backgroundImage: `linear-gradient(${C.cream}06 1px, transparent 1px), linear-gradient(90deg, ${C.cream}06 1px, transparent 1px)`, backgroundSize: "80px 80px" }} />

      {/* NAV */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl" style={{ background: C.glass, backdropFilter: "blur(24px)", border: `1px solid ${C.glassB}`, boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
        <div className="flex items-center gap-8">
          <span className="text-2xl font-black tracking-tight" style={{ color: C.gold }}>LUMIX</span>
          <button onClick={() => featRef.current?.scrollIntoView({ behavior: 'smooth' })} className="text-xs uppercase tracking-[0.2em]" style={{ color: C.nude }}>Features</button>
          <button onClick={go} className="px-6 py-2 rounded-full text-xs font-bold uppercase tracking-[0.15em]" style={{ background: C.gold, color: C.dark }}>Login</button>
        </div>
      </nav>

      {/* HERO - 3D floating */}
      <div ref={heroRef} className="relative z-10 flex items-center justify-center min-h-screen px-4 pt-24" style={{ scrollSnapAlign: "start" }}>
        <motion.div style={{ opacity: heroOp, scale: heroScale, rotateX: heroRotate }} className="text-center">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="mb-12 inline-block px-4 py-1.5 rounded-full text-sm uppercase tracking-[0.4em] font-semibold"
            style={{ background: C.glass, backdropFilter: "blur(12px)", border: `1px solid ${C.glassB}`, color: C.gold }}>
            Myanmar AI Content Platform
          </motion.div>
          <div>
            <motion.h1 initial={{ opacity: 0, y: 40, rotateX: 15 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ duration: 0.8, delay: 0.1 }}
              className="font-black leading-[0.9] mb-2" style={{ fontSize: "clamp(52px, 14vw, 170px)", letterSpacing: "-0.03em", color: C.cream }}>
              LUMIX
            </motion.h1>
            <motion.h1 initial={{ opacity: 0, y: 40, rotateX: 15 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
              className="font-black leading-[0.9] mb-8" style={{ fontSize: "clamp(52px, 14vw, 170px)", letterSpacing: "-0.03em", color: C.cream }}>
              STUDIO
            </motion.h1>
          </div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
            className="text-xs uppercase tracking-[0.2em] mb-3 font-semibold" style={{ color: C.gold }}>
            Powering Your Content Engine
          </motion.p>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
            className="text-sm max-w-md mx-auto mb-10" style={{ color: C.nude }}>
            AI Voice · Smart Subtitles · Video-to-Burmese Translation
          </motion.p>
          <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
            whileHover={{ scale: 1.05, y: -3 }} whileTap={{ scale: 0.96 }} onClick={() => featRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="px-10 py-4 rounded-2xl text-sm font-black uppercase tracking-[0.15em]"
            style={{ background: C.gold, color: C.dark, boxShadow: "0 8px 24px rgba(244,179,79,0.2)" }}>
            Ready to Use ↓
          </motion.button>
        </motion.div>
      </div>

      {/* ABOUT - 3D card */}
      <section ref={featRef} className="relative z-10 px-6 md:px-12 py-24" style={{ scrollSnapAlign: "start" }}>
        <div className="max-w-3xl mx-auto">
          <F>
            <div className="p-10 rounded-3xl text-center" style={{ background: C.glass, backdropFilter: "blur(20px)", border: `1px solid ${C.glassB}`, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", transform: "translateZ(40px)" }}>
              <p className="text-sm uppercase tracking-[0.5em] font-bold mb-3" style={{ color: C.gold }}>About</p>
              <h2 className="font-black uppercase mb-5 text-2xl md:text-4xl" style={{ letterSpacing: "-0.02em" }}>
                Myanmar Content, <span style={{ color: C.gold }}>Simplified.</span>
              </h2>
              <p className="leading-relaxed text-sm" style={{ color: C.nude }}>
                Lumix Studio သည် Myanmar Content Creator များအတွက် AI-Powered Platform တစ်ခုဖြစ်သည်။
                AI Voice, Auto Subtitle, Video Translation တို့ကို နေရာတစ်ခုတည်းတွင် ရရှိနိုင်သည်။
              </p>
            </div>
          </F>
        </div>
      </section>

      {/* FEATURES - 3D floating cards */}
      <section className="relative z-10 px-6 md:px-12 py-20" style={{ scrollSnapAlign: "start" }}>
        <div className="max-w-6xl mx-auto">
          <F className="text-center mb-14">
            <p className="text-sm uppercase tracking-[0.5em] font-bold mb-2" style={{ color: C.gold }}>Core Features</p>
            <h2 className="font-black uppercase text-2xl md:text-4xl">Everything You Need</h2>
          </F>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{ transformStyle: "preserve-3d" }}>
            {features.map((f, i) => (
              <F key={f.title} delay={i * 0.1}>
                <motion.div whileHover={{ y: -12, rotateX: 4, rotateY: -2, scale: 1.02 }} transition={{ duration: 0.4 }}
                  className="p-7 flex flex-col h-full rounded-3xl cursor-default"
                  style={{ background: C.glass, backdropFilter: "blur(20px)", border: `1px solid ${C.glassB}`, boxShadow: "0 16px 48px rgba(0,0,0,0.25)", transform: `translateZ(${30 - i * 10}px)` }}>
                  <span className="text-3xl mb-4">{f.icon}</span>
                  <span className="text-xs font-bold uppercase tracking-[0.3em] px-2.5 py-1 rounded-full mb-3 w-fit" style={{ background: `${C.gold}15`, color: C.gold, border: `1px solid ${C.gold}22` }}>{f.badge}</span>
                  <h4 className="text-base font-black uppercase mb-2">{f.title}</h4>
                  <p className="text-sm leading-relaxed mb-4 flex-1" style={{ color: C.nude }}>{f.desc}</p>
                  <p className="text-xs font-semibold" style={{ color: C.copper }}>{f.detail}</p>
                </motion.div>
              </F>
            ))}
          </div>
        </div>
      </section>

      {/* STEPS */}
      <section className="relative z-10 px-6 md:px-12 py-24" style={{ scrollSnapAlign: "start" }}>
        <div className="max-w-4xl mx-auto">
          <F className="text-center mb-14">
            <p className="text-sm uppercase tracking-[0.5em] font-bold mb-2" style={{ color: C.gold }}>How It Works</p>
            <h2 className="font-black uppercase text-2xl md:text-4xl">4 Steps. That's It.</h2>
          </F>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 relative">
            <div className="hidden md:block absolute top-7 left-[12%] right-[12%] h-px" style={{ background: `linear-gradient(90deg, transparent, ${C.copper}44, transparent)` }} />
            {steps.map((s, i) => (
              <F key={s.n} delay={i * 0.1} className="flex flex-col items-center text-center">
                <motion.div whileHover={{ scale: 1.1, rotateY: 10 }} className="w-14 h-14 rounded-2xl flex items-center justify-center text-sm font-black mb-4 relative z-10"
                  style={{ background: C.glass, backdropFilter: "blur(12px)", border: `1px solid ${C.glassB}`, color: C.gold, boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }}>
                  {s.n}
                </motion.div>
                <h5 className="font-black uppercase text-xs mb-1.5 tracking-wider">{s.t}</h5>
                <p className="text-sm leading-relaxed" style={{ color: C.nude }}>{s.d}</p>
              </F>
            ))}
          </div>
        </div>
      </section>

      {/* CTA - 3D elevated */}
      <F>
        <section className="relative z-10 px-6 md:px-12 py-20 text-center" style={{ scrollSnapAlign: "start" }}>
          <motion.div whileHover={{ y: -6, rotateX: 2 }} transition={{ duration: 0.4 }}
            className="max-w-2xl mx-auto p-10 md:p-14 rounded-3xl"
            style={{ background: "rgba(26,26,26,0.8)", backdropFilter: "blur(24px)", border: `1px solid ${C.glassB}`, boxShadow: "0 24px 64px rgba(0,0,0,0.4)", color: C.cream }}>
            <p className="text-sm uppercase tracking-[0.5em] font-bold mb-3" style={{ color: C.gold }}>Get Started</p>
            <h2 className="font-black uppercase mb-4 text-2xl md:text-4xl">
              Create Better, <span style={{ color: C.gold }}>Faster.</span>
            </h2>
            <p className="text-sm mb-8" style={{ color: C.nude }}>Account တစ်ခုဖန်တီးပြီး ယနေ့စတင်အသုံးပြုလိုက်ပါ</p>
            <motion.button whileHover={{ scale: 1.05, y: -3 }} whileTap={{ scale: 0.96 }} onClick={go}
              className="px-10 py-4 rounded-2xl text-sm font-black uppercase tracking-[0.15em]"
              style={{ background: C.gold, color: C.dark, boxShadow: "0 8px 24px rgba(244,179,79,0.25)" }}>
              Login →
            </motion.button>
          </motion.div>
        </section>
      </F>

      <footer className="relative z-10 text-center py-8 text-xs tracking-[0.4em] uppercase" style={{ borderTop: `1px solid ${C.glassB}`, color: `${C.nude}66` }}>
        © 2026 LUMIX STUDIO · Myanmar
      </footer>
    </div>
  );
}
