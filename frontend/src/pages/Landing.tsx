import { useLocation } from "wouter";
import { motion, useScroll, useTransform, useInView, AnimatePresence } from "framer-motion";
import { useRef, useEffect, useState } from "react";

/* ─────────────────────────────────────────────
   Teal/Cyan Color Tokens (from reference image)
───────────────────────────────────────────── */
const C = {
  bg: "#0a1628",
  teal: "#1A73E8",
  cyan: "#4a9af5",
  aqua: "#7BA8F2",
  glow: "#1A73E8",
  textPrimary: "#ffffff",
  textMuted: "rgba(255,255,255,0.65)",
  glass: "rgba(26,115,232,0.08)",
  glassBorder: "rgba(26,115,232,0.2)",
  glassBorderHover: "rgba(26,115,232,0.45)",
};

/* ─────────────────────────────────────────────
   Reusable animated section wrapper
───────────────────────────────────────────── */
function FadeInSection({
  children,
  delay = 0,
  className = "",
  direction = "up",
  zoom = false,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  direction?: "up" | "down" | "left" | "right";
  zoom?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: false, margin: "-60px" });

  const offsets = { up: { y: 60 }, down: { y: -60 }, left: { x: 80 }, right: { x: -80 } };
  const initial = { opacity: 0, ...offsets[direction], ...(zoom ? { scale: 0.9 } : {}) };
  const animate = isInView ? { opacity: 1, x: 0, y: 0, scale: 1 } : {};

  return (
    <motion.div
      ref={ref}
      initial={initial}
      animate={animate}
      transition={{ duration: 0.8, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   Glass Card Component
───────────────────────────────────────────── */
function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={className}
      style={{
        background: "rgba(26,115,232,0.06)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: `1px solid ${C.glassBorder}`,
        borderRadius: "20px",
      }}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Feature card data
───────────────────────────────────────────── */
const features = [
  {
    icon: "🎙️",
    title: "Voice Generation (TTS)",
    badge: "Multiple Voices",
    desc: "စာသားမှ Studio-Quality အသံဖိုင်များသို့ တစ်ချက်နှိပ်ပြောင်းလဲပေးသည်။ အမျိုးသား / အမျိုးသမီး အသံပေါင်း ၁၀ ကျော် ပါဝင်ပြီး Speed နှင့် Pitch ကို စိတ်ကြိုက်ချိန်ညှိနိုင်သည်။",
    detail: "Male & Female voices · Speed & Pitch control · Download MP3/WAV",
  },
  {
    icon: "📝",
    title: "Smart Subtitle Generator",
    badge: "Auto Timing",
    desc: "မည်သည့် Video Format ပဲဖြစ်ဖြစ် အချိန်တိကျသော SRT Subtitle ဖိုင်များကို အလိုအလျောက် ထုတ်ပေးသည်။ YouTube, TikTok, Facebook နှင့် ကိုက်ညီသော Format များ ပံ့ပိုးသည်။",
    detail: "Auto SRT · Multi-platform format · Accurate timestamps",
  },
  {
    icon: "🎬",
    title: "All-in-One Video Maker",
    badge: "One-Click Export",
    desc: "ဗီဒီယိုကို တင်ပြီး မြန်မာအသံ ထည့်လိုက်ပါ။ အင်္ဂလိပ်ဗီဒီယိုကို မြန်မာဘာသာပြန်ပြီး အသံနှင့် စာတန်းထိုးအပါအဝင် အချောသတ် ဗီဒီယိုအဖြစ် ထုတ်ပေးသည်။",
    detail: "Auto translate · Voice dubbing · Subtitle burn-in · One-click export",
  },
];

/* ─────────────────────────────────────────────
   Steps / How it works
───────────────────────────────────────────── */
const steps = [
  { num: "01", title: "Login", desc: "Telegram Bot မှ Login Code ရယူပြီး Website တွင် ဝင်ရောက်ပါ။" },
  { num: "02", title: "ရွေးချယ်ပါ", desc: "TTS (စာမှအသံ), ဗီဒီယိုဘာသာပြန်, All-in-One Video Maker မှ ရွေးပါ။" },
  { num: "03", title: "ဖန်တီးပါ", desc: "စာသားရိုက်ထည့်ပါ (သို့) ဗီဒီယိုတင်ပြီး အသံ/စာတန်းထိုး ဆက်တင် ရွေးပါ။" },
  { num: "04", title: "ဒေါင်းလုတ်", desc: "ပြီးဆုံးသော MP3, SRT, MP4 ဖိုင်ကို ချက်ချင်း ဒေါင်းလုတ် ယူပါ။" },
];

/* ─────────────────────────────────────────────
   Landing Page
───────────────────────────────────────────── */
export default function Landing() {
  const [, navigate] = useLocation();
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLElement>(null);
  const [transitioning, setTransitioning] = useState(false);

  // Parallax for hero glow
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const glowY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  // Smooth scroll behavior
  useEffect(() => {
    const html = document.documentElement;
    html.style.scrollBehavior = "smooth";
    return () => {
      html.style.scrollBehavior = "";
    };
  }, []);

  return (
    <div
      className="min-h-screen text-white relative font-sans overflow-x-hidden"
      style={{
        background: `radial-gradient(ellipse 120% 80% at 50% -10%, ${C.teal}33 0%, ${C.bg} 60%)`,
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
      {/* ─── FULL PAGE GRID ─── */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage:
            `linear-gradient(${C.teal}15 1px, transparent 1px), linear-gradient(90deg, ${C.teal}15 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Vertical gradient overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: `linear-gradient(to bottom, transparent 60%, ${C.bg}ee 100%)`,
        }}
      />

      {/* ═══════════════════════════════════════════
          NAV BAR (Glass)
      ═══════════════════════════════════════════ */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 px-6 py-4"
        style={{
          background: "rgba(10,22,40,0.7)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: `1px solid ${C.glassBorder}`,
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="text-2xl font-black tracking-tight text-white"
            >
              LUMIX
            </span>
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={() => featuresRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="text-xs uppercase tracking-[0.2em] hover:opacity-100 transition-opacity"
              style={{ color: C.textMuted }}
            >
              Features
            </button>
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: `0 0 0px transparent` }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setTransitioning(true);
                setTimeout(() => navigate("/login"), 600);
              }}
              className="px-5 py-2 rounded-full text-xs font-bold uppercase tracking-[0.2em]"
              style={{
                background: `linear-gradient(135deg, ${C.teal}, ${C.cyan})`,
                color: C.bg,
              }}
            >
              Login
            </motion.button>
          </div>
        </div>
      </nav>

      {/* Blur transition overlay */}
      <AnimatePresence>
        {transitioning && (
          <motion.div
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: 1, scale: 1.2, filter: "blur(20px)" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="fixed inset-0 z-[200]"
            style={{ background: C.bg }}
          />
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════
          HERO SECTION
      ═══════════════════════════════════════════ */}
      <div
        ref={heroRef}
        className="relative z-10 flex flex-col items-center justify-center min-h-screen text-center px-4"
      >
        {/* BIG glow blob */}
        <motion.div
          style={{ y: glowY }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        >
          <div
            className="rounded-full blur-[180px]"
            style={{
              width: "min(900px, 90vw)",
              height: "min(550px, 60vw)",
              background: `radial-gradient(circle, ${C.cyan}55 0%, ${C.teal}33 50%, transparent 100%)`,
            }}
          />
        </motion.div>

        <motion.div
          style={{ opacity: heroOpacity }}
          className="relative z-10 flex flex-col items-center"
        >
          {/* Pill badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8 px-5 py-2 rounded-full text-xs font-bold uppercase tracking-[0.4em]"
            style={{
              border: `1px solid ${C.glassBorder}`,
              background: C.glass,
              backdropFilter: "blur(12px)",
              color: C.cyan,
            }}
          >
            Myanmar AI Content Platform
          </motion.div>

          {/* Main headline */}
          <motion.h1
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="font-black uppercase leading-[0.85] mb-3"
            style={{
              fontSize: "clamp(64px, 16vw, 200px)",
              color: "#ffffff",
              letterSpacing: "-0.04em",
            }}
          >
            LUMIX
          </motion.h1>

          <motion.h1
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="font-black uppercase leading-[0.85] mb-8"
            style={{
              fontSize: "clamp(64px, 16vw, 200px)",
              color: "#ffffff",
              letterSpacing: "-0.04em",
            }}
          >
            STUDIO
          </motion.h1>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="font-semibold uppercase mb-4 max-w-3xl"
            style={{
              fontSize: "clamp(14px, 2.5vw, 22px)",
              color: C.cyan,
              textShadow: `0 0 0px transparent`,
              letterSpacing: "0.12em",
            }}
          >
            Powering Your Content Engine
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="mb-14 max-w-xl text-sm leading-relaxed px-4"
            style={{ color: C.textMuted }}
          >
            AI Voice · Smart Subtitles · Video-to-Burmese Translation — one platform, endlessly powerful
          </motion.p>

          {/* CTA Button */}
          <motion.button
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.55 }}
            whileHover={{
              scale: 1.06,
              boxShadow: `0 0 0px transparent`,
            }}
            whileTap={{ scale: 0.95 }}
            onClick={() => featuresRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="relative px-10 sm:px-16 md:px-24 py-4 md:py-6 mb-32 text-base sm:text-lg md:text-xl font-black uppercase tracking-widest text-white overflow-hidden rounded-full group"
            style={{
              background: `linear-gradient(135deg, ${C.teal}, ${C.cyan})`,
              boxShadow: `0 0 0px transparent`,
            }}
          >
            <span
              className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)",
              }}
            />
            <span className="relative z-10" style={{ color: C.bg }}>Ready to Use ↓</span>
          </motion.button>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-10 flex flex-col items-center gap-3"
        >
          <span
            className="text-[10px] uppercase tracking-[0.45em] font-bold"
            style={{ color: C.cyan }}
          >
            Scroll
          </span>
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
            className="w-[1px] h-14"
            style={{
              background: `linear-gradient(to bottom, ${C.cyan}, transparent)`,
            }}
          />
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 1.6 }}
            style={{ color: C.cyan }}
          >
            ↓
          </motion.div>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════
          WHAT IS THIS PLATFORM? (Intro)
      ═══════════════════════════════════════════ */}
      <section ref={featuresRef} className="relative z-10 px-6 md:px-12 py-28">
        <div className="max-w-4xl mx-auto text-center">
          <FadeInSection>
            <p
              className="text-xs uppercase tracking-[0.5em] font-bold mb-4"
              style={{ color: C.cyan }}
            >
              About This Platform
            </p>
            <h2
              className="font-black uppercase mb-6 text-white"
              style={{ fontSize: "clamp(28px, 5vw, 52px)", letterSpacing: "-0.02em" }}
            >
              Myanmar Content Creation,{" "}
              <span style={{ color: C.aqua }}>Simplified.</span>
            </h2>
            <p className="text-base leading-loose max-w-2xl mx-auto px-2" style={{ color: C.textMuted }}>
              Lumix Studio သည် Myanmar Content Creator များအတွက် အထူးဒီဇိုင်းထုတ်ထားသော AI-Powered Platform တစ်ခုဖြစ်သည်။ 
              သင်သည် YouTube, TikTok, Facebook Video များ ထုတ်လုပ်ရာတွင် လိုအပ်သော — AI Voice, Auto Subtitle, 
              နှင့် Video Translation — တို့ကို ဤနေရာတစ်ခုတည်းတွင် ရရှိနိုင်သည်။
              ရလဒ်ကိုသာ အာရုံစိုက်ပြီး လွယ်ကူစွာ အသုံးပြုနိုင်ပါသည်။
            </p>
          </FadeInSection>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          FEATURES GRID (Glass Cards)
      ═══════════════════════════════════════════ */}
      <section
        className="relative z-10 px-6 md:px-12 py-24"
        style={{
          borderTop: `1px solid ${C.glassBorder}`,
          borderBottom: `1px solid ${C.glassBorder}`,
        }}
      >
        <div className="max-w-7xl mx-auto">
          <FadeInSection className="text-center mb-16">
            <p
              className="text-xs uppercase tracking-[0.5em] font-bold mb-3"
              style={{ color: C.cyan }}
            >
              Core Features
            </p>
            <h2
              className="font-black uppercase text-white"
              style={{ fontSize: "clamp(24px, 4vw, 44px)", letterSpacing: "-0.02em" }}
            >
              Everything You Need
            </h2>
          </FadeInSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <FadeInSection key={f.title} delay={i * 0.12} direction={i === 0 ? "left" : i === 2 ? "right" : "up"} zoom>
                <motion.div
                  whileHover={{
                    y: -8,
                    borderColor: C.glassBorderHover,
                    scale: 1.02,
                    boxShadow: `0 0 0px transparent`,
                  }}
                  transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="p-6 sm:p-8 flex flex-col items-start text-left h-full relative overflow-hidden"
                  style={{
                    background: "rgba(26,115,232,0.06)",
                    backdropFilter: "blur(24px)",
                    WebkitBackdropFilter: "blur(24px)",
                    border: `1px solid ${C.glassBorder}`,
                    borderRadius: "20px",
                  }}
                >
                  {/* Top glow corner */}
                  <div
                    className="absolute top-0 right-0 w-28 h-28 pointer-events-none"
                    style={{
                      background: `radial-gradient(circle at top right, ${C.cyan}22, transparent 70%)`,
                    }}
                  />

                  <span className="text-4xl mb-5 block">{f.icon}</span>

                  {/* Badge */}
                  <span
                    className="text-[10px] font-black uppercase tracking-[0.35em] px-3 py-1 rounded-full mb-4"
                    style={{
                      background: `${C.teal}22`,
                      color: C.cyan,
                      border: `1px solid ${C.glassBorder}`,
                    }}
                  >
                    {f.badge}
                  </span>

                  <h4
                    className="text-lg font-black uppercase mb-3"
                    style={{ color: C.aqua }}
                  >
                    {f.title}
                  </h4>
                  <p className="text-sm leading-relaxed mb-5" style={{ color: C.textMuted }}>{f.desc}</p>
                  <p
                    className="text-xs mt-auto font-semibold"
                    style={{ color: `${C.cyan}aa` }}
                  >
                    {f.detail}
                  </p>
                </motion.div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          HOW IT WORKS
      ═══════════════════════════════════════════ */}
      <section className="relative z-10 px-6 md:px-12 py-28">
        <div className="max-w-5xl mx-auto">
          <FadeInSection className="text-center mb-16">
            <p
              className="text-xs uppercase tracking-[0.5em] font-bold mb-3"
              style={{ color: C.cyan }}
            >
              How It Works
            </p>
            <h2
              className="font-black uppercase text-white"
              style={{ fontSize: "clamp(24px, 4vw, 44px)", letterSpacing: "-0.02em" }}
            >
              4 Steps. That's It.
            </h2>
          </FadeInSection>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-4 relative">
            {/* Connector line */}
            <div
              className="hidden md:block absolute top-[52px] left-[12.5%] right-[12.5%] h-[1px]"
              style={{
                background: `linear-gradient(90deg, transparent, ${C.cyan}66, transparent)`,
              }}
            />

            {steps.map((s, i) => (
              <FadeInSection key={s.num} delay={i * 0.15} direction="up" zoom className="flex flex-col items-center text-center px-2">
                <motion.div
                  whileHover={{ scale: 1.15, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  className="w-14 h-14 md:w-[72px] md:h-[72px] rounded-full flex items-center justify-center text-lg md:text-xl font-black mb-4 md:mb-6 relative z-10"
                  style={{
                    background: `linear-gradient(135deg, ${C.teal}, ${C.cyan})`,
                    boxShadow: `0 0 0px transparent`,
                    color: C.bg,
                  }}
                >
                  {s.num}
                </motion.div>
                <h5 className="font-black uppercase text-xs md:text-sm mb-2 tracking-wider text-white">
                  {s.title}
                </h5>
                <p className="text-[11px] md:text-xs leading-relaxed" style={{ color: C.textMuted }}>{s.desc}</p>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          CTA BANNER (Glass)
      ═══════════════════════════════════════════ */}
      <FadeInSection>
        <section className="relative z-10 px-6 md:px-12 py-24 text-center overflow-hidden">
          {/* glow behind CTA */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${C.cyan}22, transparent 70%)`,
            }}
          />

          <GlassCard className="max-w-3xl mx-auto p-12 md:p-16">
            <p
              className="text-xs uppercase tracking-[0.5em] font-bold mb-4"
              style={{ color: C.cyan }}
            >
              Get Started Now
            </p>
            <h2
              className="font-black uppercase mb-6 text-white"
              style={{
                fontSize: "clamp(28px, 6vw, 64px)",
                letterSpacing: "-0.03em",
                
              }}
            >
              Create Better Content,{" "}
              <span style={{ color: C.aqua }}>Faster.</span>
            </h2>
            <p className="mb-10 max-w-lg mx-auto text-sm leading-relaxed px-4" style={{ color: C.textMuted }}>
              Account တစ်ခုဖန်တီးပြီး ယနေ့စတင်အသုံးပြုလိုက်ပါ
            </p>

            <motion.button
              whileHover={{
                scale: 1.06,
                boxShadow: `0 0 0px transparent`,
              }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setTransitioning(true);
                setTimeout(() => navigate("/login"), 600);
              }}
              className="inline-block px-12 sm:px-20 py-5 md:py-6 text-base sm:text-xl font-black uppercase tracking-widest rounded-full relative overflow-hidden group"
              style={{
                background: `linear-gradient(135deg, ${C.teal}, ${C.cyan})`,
                boxShadow: `0 0 0px transparent`,
                color: C.bg,
              }}
            >
              <span
                className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"
                style={{
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)",
                }}
              />
              <span className="relative z-10">Login →</span>
            </motion.button>
          </GlassCard>
        </section>
      </FadeInSection>

      {/* ─── FOOTER ─── */}
      <footer
        className="relative z-10 text-center py-10 text-[10px] tracking-[0.5em] uppercase"
        style={{
          borderTop: `1px solid ${C.glassBorder}`,
          color: `${C.cyan}44`,
        }}
      >
        © 2026 LUMIX STUDIO · Professional Content Tools · Myanmar
      </footer>
    </div>
  );
}
