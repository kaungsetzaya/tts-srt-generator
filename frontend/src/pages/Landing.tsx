import { useLocation } from "wouter";
import { motion, useScroll, useTransform, useInView, AnimatePresence } from "framer-motion";
import { useRef, useEffect, useState } from "react";

const C = {
  bg: "#EBE6D8", cream: "#E8E3CF", nude: "#ECCEB6", gold: "#F4B34F",
  copper: "#C06F30", brick: "#861C1C", dark: "#2B1D1C",
  glass: "rgba(235,230,216,0.7)", glassB: "rgba(192,111,48,0.15)",
};

function Fade({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const v = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 40 }} animate={v ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }} className={className}>
      {children}
    </motion.div>
  );
}

const features = [
  { icon: "🎙️", title: "Voice Generation", badge: "Multiple Voices",
    desc: "စာသားမှ Studio-Quality အသံဖိုင်များသို့ တစ်ချက်နှိပ်ပြောင်းလဲပေးသည်။ Speed နှင့် Pitch ကို စိတ်ကြိုက်ချိန်ညှိနိုင်သည်။",
    detail: "Male & Female voices · Speed & Pitch control · MP3/WAV" },
  { icon: "📝", title: "Smart Subtitles", badge: "Auto Timing",
    desc: "မည်သည့် Video Format ပဲဖြစ်ဖြစ် အချိန်တိကျသော SRT Subtitle ဖိုင်များကို အလိုအလျောက် ထုတ်ပေးသည်။",
    detail: "Auto SRT · Multi-platform · Accurate timestamps" },
  { icon: "🎬", title: "Video Maker", badge: "One-Click",
    desc: "ဗီဒီယိုကို တင်ပြီး မြန်မာအသံ ထည့်လိုက်ပါ။ ဘာသာပြန်၊ အသံနှင့် စာတန်းထိုး အပါအဝင် အချောသတ် ဗီဒီယိုထုတ်ပေးသည်။",
    detail: "Auto translate · Voice dub · Subtitle burn-in · Export" },
];

const steps = [
  { n: "01", t: "Login", d: "Telegram Bot မှ Code ရယူပါ" },
  { n: "02", t: "ရွေးချယ်", d: "TTS, ဘာသာပြန်, Video Maker" },
  { n: "03", t: "ဖန်တီး", d: "စာသားရိုက် (သို့) ဗီဒီယိုတင်ပါ" },
  { n: "04", t: "ဒေါင်းလုတ်", d: "MP3, SRT, MP4 ချက်ချင်းယူပါ" },
];

export default function Landing() {
  const [, nav] = useLocation();
  const heroRef = useRef<HTMLDivElement>(null);
  const featRef = useRef<HTMLElement>(null);
  const [trans, setTrans] = useState(false);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOp = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  useEffect(() => { document.documentElement.style.scrollBehavior = "smooth"; return () => { document.documentElement.style.scrollBehavior = ""; }; }, []);

  const go = () => { setTrans(true); setTimeout(() => nav("/login"), 500); };

  return (
    <div className="min-h-screen relative overflow-x-hidden" style={{ background: C.bg, color: C.dark, fontFamily: "'Inter', serif" }}>
      <AnimatePresence>{trans && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="fixed inset-0 z-[200]" style={{ background: C.bg }} />}</AnimatePresence>

      {/* Grid */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{ backgroundImage: `linear-gradient(${C.copper}0A 1px, transparent 1px), linear-gradient(90deg, ${C.copper}0A 1px, transparent 1px)`, backgroundSize: "80px 80px" }} />

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4" style={{ background: C.glass, backdropFilter: "blur(20px)", borderBottom: `1px solid ${C.glassB}` }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="text-xl font-black tracking-tight" style={{ color: C.brick }}>LUMIX</span>
          <div className="flex items-center gap-5">
            <button onClick={() => featRef.current?.scrollIntoView({ behavior: 'smooth' })} className="text-[11px] uppercase tracking-[0.2em]" style={{ color: C.copper }}>Features</button>
            <button onClick={go} className="px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[0.15em]" style={{ background: C.dark, color: C.cream }}>Login</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <div ref={heroRef} className="relative z-10 flex flex-col items-center justify-center min-h-screen text-center px-4" style={{ scrollSnapAlign: "start" }}>
        <motion.div style={{ opacity: heroOp }} className="flex flex-col items-center">
          <motion.p initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="mb-6 text-[10px] uppercase tracking-[0.5em] font-semibold" style={{ color: C.copper }}>
            Myanmar AI Content Platform
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
            className="font-black leading-[0.9] mb-2" style={{ fontSize: "clamp(56px, 15vw, 180px)", letterSpacing: "-0.03em", color: C.dark }}>
            LUMIX
          </motion.h1>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.18 }}
            className="font-black leading-[0.9] mb-8" style={{ fontSize: "clamp(56px, 15vw, 180px)", letterSpacing: "-0.03em", color: C.dark }}>
            STUDIO
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
            className="text-sm uppercase tracking-[0.15em] mb-3 font-semibold" style={{ color: C.brick }}>
            Powering Your Content Engine
          </motion.p>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
            className="text-sm max-w-md mb-12" style={{ color: C.copper }}>
            AI Voice · Smart Subtitles · Video-to-Burmese Translation
          </motion.p>
          <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => featRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="px-10 py-3.5 rounded-full text-sm font-black uppercase tracking-[0.15em]" style={{ background: C.dark, color: C.cream }}>
            Ready to Use ↓
          </motion.button>
        </motion.div>
      </div>

      {/* ABOUT */}
      <section ref={featRef} className="relative z-10 px-6 md:px-12 py-24" style={{ scrollSnapAlign: "start" }}>
        <div className="max-w-3xl mx-auto text-center">
          <Fade>
            <p className="text-[10px] uppercase tracking-[0.5em] font-bold mb-3" style={{ color: C.brick }}>About</p>
            <h2 className="font-black uppercase mb-5 text-3xl md:text-5xl" style={{ letterSpacing: "-0.02em", color: C.dark }}>
              Myanmar Content Creation, <span style={{ color: C.brick }}>Simplified.</span>
            </h2>
            <p className="leading-relaxed" style={{ color: C.copper }}>
              Lumix Studio သည် Myanmar Content Creator များအတွက် AI-Powered Platform တစ်ခုဖြစ်သည်။
              AI Voice, Auto Subtitle, Video Translation တို့ကို ဤနေရာတစ်ခုတည်းတွင် ရရှိနိုင်သည်။
            </p>
          </Fade>
        </div>
      </section>

      {/* FEATURES */}
      <section className="relative z-10 px-6 md:px-12 py-20" style={{ scrollSnapAlign: "start", borderTop: `1px solid ${C.glassB}`, borderBottom: `1px solid ${C.glassB}` }}>
        <div className="max-w-6xl mx-auto">
          <Fade className="text-center mb-14">
            <p className="text-[10px] uppercase tracking-[0.5em] font-bold mb-2" style={{ color: C.brick }}>Core Features</p>
            <h2 className="font-black uppercase text-2xl md:text-4xl" style={{ color: C.dark }}>Everything You Need</h2>
          </Fade>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <Fade key={f.title} delay={i * 0.1}>
                <motion.div whileHover={{ y: -6, scale: 1.01 }} transition={{ duration: 0.3 }}
                  className="p-6 sm:p-7 flex flex-col h-full rounded-2xl"
                  style={{ background: C.glass, backdropFilter: "blur(16px)", border: `1px solid ${C.glassB}` }}>
                  <span className="text-3xl mb-4">{f.icon}</span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] px-2.5 py-1 rounded-full mb-3 w-fit" style={{ background: `${C.gold}22`, color: C.copper, border: `1px solid ${C.copper}22` }}>{f.badge}</span>
                  <h4 className="text-base font-black uppercase mb-2" style={{ color: C.dark }}>{f.title}</h4>
                  <p className="text-sm leading-relaxed mb-4 flex-1" style={{ color: C.copper }}>{f.desc}</p>
                  <p className="text-xs font-semibold" style={{ color: C.brick }}>{f.detail}</p>
                </motion.div>
              </Fade>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="relative z-10 px-6 md:px-12 py-24" style={{ scrollSnapAlign: "start" }}>
        <div className="max-w-4xl mx-auto">
          <Fade className="text-center mb-14">
            <p className="text-[10px] uppercase tracking-[0.5em] font-bold mb-2" style={{ color: C.brick }}>How It Works</p>
            <h2 className="font-black uppercase text-2xl md:text-4xl" style={{ color: C.dark }}>4 Steps. That's It.</h2>
          </Fade>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 relative">
            <div className="hidden md:block absolute top-7 left-[12%] right-[12%] h-px" style={{ background: `linear-gradient(90deg, transparent, ${C.copper}44, transparent)` }} />
            {steps.map((s, i) => (
              <Fade key={s.n} delay={i * 0.12} className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-sm font-black mb-4 relative z-10" style={{ background: C.dark, color: C.cream }}>{s.n}</div>
                <h5 className="font-black uppercase text-xs mb-1.5 tracking-wider">{s.t}</h5>
                <p className="text-[11px] leading-relaxed" style={{ color: C.copper }}>{s.d}</p>
              </Fade>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <Fade>
        <section className="relative z-10 px-6 md:px-12 py-20 text-center" style={{ scrollSnapAlign: "start" }}>
          <div className="max-w-2xl mx-auto p-10 md:p-14 rounded-2xl" style={{ background: C.dark, color: C.cream }}>
            <p className="text-[10px] uppercase tracking-[0.5em] font-bold mb-3" style={{ color: C.gold }}>Get Started Now</p>
            <h2 className="font-black uppercase mb-4 text-3xl md:text-5xl" style={{ letterSpacing: "-0.02em" }}>
              Create Better Content, <span style={{ color: C.gold }}>Faster.</span>
            </h2>
            <p className="text-sm mb-8" style={{ color: C.nude }}>Account တစ်ခုဖန်တီးပြီး ယနေ့စတင်အသုံးပြုလိုက်ပါ</p>
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={go}
              className="px-10 py-4 rounded-full text-sm font-black uppercase tracking-[0.15em]" style={{ background: C.gold, color: C.dark }}>
              Login →
            </motion.button>
          </div>
        </section>
      </Fade>

      {/* FOOTER */}
      <footer className="relative z-10 text-center py-8 text-[9px] tracking-[0.5em] uppercase" style={{ borderTop: `1px solid ${C.glassB}`, color: C.copper }}>
        © 2026 LUMIX STUDIO · Myanmar
      </footer>
    </div>
  );
}
