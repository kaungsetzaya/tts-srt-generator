
import { useLocation } from "wouter";

import { motion, useScroll, useTransform, useInView } from "framer-motion";

import { useRef, useEffect } from "react";



/* ─────────────────────────────────────────────

   Reusable animated section wrapper

───────────────────────────────────────────── */

function FadeInSection({

  children,

  delay = 0,

  className = "",

}: {

  children: React.ReactNode;

  delay?: number;

  className?: string;

}) {

  const ref = useRef<HTMLDivElement>(null);

  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (

    <motion.div

      ref={ref}

      initial={{ opacity: 0, y: 50 }}

      animate={isInView ? { opacity: 1, y: 0 } : {}}

      transition={{ duration: 0.7, delay, ease: "easeOut" }}

      className={className}

    >

      {children}

    </motion.div>

  );

}



/* ─────────────────────────────────────────────

   Feature card data

───────────────────────────────────────────── */

const features = [

  {

    icon: "🎙️",

    title: "AI Voice Generation (TTS)",

    badge: "Multiple Voices",

    desc: "စာသားမှ Studio-Quality အသံဖိုင်များသို့ တစ်ချက်နှိပ်ပြောင်းလဲပေးသည်။ အမျိုးသား / အမျိုးသမီး အသံပေါင်း ၁၀ ကျော် ပါဝင်ပြီး သင်္ကေတ Speed နှင့် Pitch ကို စိတ်ကြိုက်ချိန်ညှိနိုင်သည်။",

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

    title: "Video Upload & Translate",

    badge: "Any Language → Burmese",

    desc: "မည်သည့် ဘာသာဖြင့် ပြောသော ဗီဒီယိုများမဆို တင်ပေးလိုက်ပါ။ အသံကို မြန်မာဘာသာဖြင့် တိကျစွာ ဘာသာပြန်ပေး၍ Script အနေဖြင့် ရရှိမည်ဖြစ်သည်။",

    detail: "English · Chinese · Korean · Japanese · + more → Burmese text",

  },

  {

    icon: "🌍",

    title: "Any Language Recognition",

    badge: "Global Support",

    desc: "ကမ္ဘာ့ဘာသာစကား ၅၀ ကျော်ကို မှတ်မိနိုင်သည်။ ဗီဒီယိုတွင် ရောနှောပြောဆိုသော ဘာသာများကိုပင် ခွဲခြားစစ်ဆေး၍ တိကျသော Output ပေးနိုင်သည်။",

    detail: "50+ languages · Mixed-language support · High accuracy",

  },

  {

    icon: "🧠",

    title: "Smart Burmese Translation",

    badge: "Strict Burmese Output",

    desc: "Video မှ မည်သည့်ဘာသာစကားကိုမဆို မြန်မာဘာသာသို့ ချောမွေ့စွာ ဘာသာပြန်ပေးပြီး တိကျသော Script ကိုထုတ်ပေးနိုင်သည်။ Subtitle ဖတ်ရလွယ်စေရန် စာကြောင်းအရှည်ကိုလည်း ပြင်ဆင်ပေးသည်။",

    detail: "Any language to Burmese · Clean wording · Script-ready output",

  },

  {

    icon: "🎯",

    title: "All-in-One One-Click Workflow",

    badge: "Analysis → Export",

    desc: "Analysis, Smart Translation, AI Voice Sync, FFmpeg Render နှင့် Export ကို တစ်ဆက်တည်း လုပ်ဆောင်ပေးသည်။ Preview ပြပြီးနောက် MP4 Download ခလုတ်ဖြင့် ချက်ချင်းယူနိုင်သည်။",

    detail: "Whisper + Gemini + TTS + FFmpeg · Final MP4 + Download",

  },

];



/* ─────────────────────────────────────────────

   Steps / How it works

───────────────────────────────────────────── */

const steps = [

  { num: "01", title: "Analysis & Extract", desc: "Video ကိုလက်ခံပြီး Audio ခွဲထုတ်ကာ Whisper ဖြင့် စာသားနှင့် Timestamp များကို ထုတ်ယူသည်။" },

  { num: "02", title: "Smart Translation", desc: "Gemini AI ဖြင့် Strict Burmese ဘာသာပြန်ပြီး Subtitle ဖတ်ရလွယ်အောင် စာကြောင်းဖော်မတ်လုပ်သည်။" },

  { num: "03", title: "AI Voice & Sync", desc: "ရွေးထားသော Speed ဖြင့် TTS အသံသွင်းပြီး အသံကြာချိန်နှင့်လိုက်ဖက်အောင် Video timing ကိုညှိသည်။" },

  { num: "04", title: "Final Render", desc: "မူရင်းအသံကိုဖယ်ရှားပြီး AI Voice ကိုတင်ကာ SRT ကို Video ပေါ် Burn-in လုပ်သည်။" },

  { num: "05", title: "Export", desc: "Preview ပြသပြီး Download ခလုတ်ဖြင့် အချောသတ် MP4 ကိုချက်ချင်း ရယူနိုင်သည်။" },

];



/* ─────────────────────────────────────────────

   Landing Page

───────────────────────────────────────────── */

export default function Landing() {

  const [, navigate] = useLocation();

  const heroRef = useRef<HTMLDivElement>(null);



  // Parallax for hero glow

  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });

  const glowY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);

  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);



  // Scroll snap on document

  useEffect(() => {

    const html = document.documentElement;

    html.style.scrollSnapType = "y proximity";

    html.style.scrollBehavior = "smooth";

    return () => {

      html.style.scrollSnapType = "";

      html.style.scrollBehavior = "";

    };

  }, []);



  return (

    <div

      className="min-h-screen text-white relative font-sans overflow-x-hidden"

      style={{

        background:

          "radial-gradient(ellipse 120% 80% at 50% -10%, oklch(0.18 0.08 290) 0%, #000 60%)",

        fontFamily: "'Inter', 'Segoe UI', sans-serif",

      }}

    >

      {/* ─── FULL PAGE GRID ─── */}

      <div

        className="fixed inset-0 pointer-events-none z-0"

        style={{

          backgroundImage:

            "linear-gradient(rgba(139,92,246,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.08) 1px, transparent 1px)",

          backgroundSize: "60px 60px",

        }}

      />

      {/* Extra vertical gradient overlay to make grid fade at bottom */}

      <div

        className="fixed inset-0 pointer-events-none z-0"

        style={{

          background:

            "linear-gradient(to bottom, transparent 60%, oklch(0.06 0.02 290) 100%)",

        }}

      />



      {/* ═══════════════════════════════════════════

          HERO SECTION

      ═══════════════════════════════════════════ */}

      <div

        ref={heroRef}

        className="relative z-10 flex flex-col items-center justify-center min-h-screen text-center px-4"

        style={{ scrollSnapAlign: "start" }}

      >

        {/* BIG glow blob */}

        <motion.div

          style={{ y: glowY }}

          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"

        >

          <div

            className="rounded-full blur-[160px]"

            style={{

              width: "min(900px, 90vw)",

              height: "min(550px, 60vw)",

              background:

                "radial-gradient(circle, oklch(0.55 0.28 310 / 40%) 0%, oklch(0.45 0.22 270 / 20%) 60%, transparent 100%)",

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

            className="mb-8 px-5 py-2 rounded-full border text-xs font-bold uppercase tracking-[0.4em]"

            style={{

              borderColor: "oklch(0.65 0.25 310 / 40%)",

              background: "oklch(0.65 0.25 310 / 10%)",

              color: "oklch(0.8 0.18 310)",

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

              fontSize: "clamp(56px, 14vw, 170px)",

              color: "oklch(0.72 0.22 310)",

              textShadow:

                "0 0 60px oklch(0.65 0.25 310 / 70%), 0 0 120px oklch(0.55 0.28 310 / 30%)",

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

              fontSize: "clamp(56px, 14vw, 170px)",

              color: "oklch(0.72 0.22 310)",

              textShadow:

                "0 0 60px oklch(0.65 0.25 310 / 70%), 0 0 120px oklch(0.55 0.28 310 / 30%)",

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

              color: "oklch(0.6 0.28 280)",

              textShadow: "0 0 30px oklch(0.6 0.28 280 / 50%)",

              letterSpacing: "0.12em",

            }}

          >

            Powering Your Content Engine

          </motion.p>



          <motion.p

            initial={{ opacity: 0, y: 20 }}

            animate={{ opacity: 1, y: 0 }}

            transition={{ duration: 0.7, delay: 0.45 }}

            className="text-gray-400 mb-14 max-w-xl text-sm leading-relaxed"

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

              boxShadow: "0 0 80px oklch(0.65 0.25 310 / 80%)",

            }}

            whileTap={{ scale: 0.95 }}

            onClick={() => navigate("/login")}

            className="relative px-10 md:px-14 py-4 md:py-5 mb-24 text-base md:text-lg font-black uppercase tracking-wide md:tracking-wider text-white overflow-hidden rounded-sm group"

            style={{

              background:

                "linear-gradient(135deg, oklch(0.65 0.28 310), oklch(0.55 0.28 270))",

              boxShadow: "0 0 60px oklch(0.65 0.25 310 / 55%)",

            }}

          >

            {/* shimmer sweep */}

            <span

              className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"

              style={{

                background:

                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)",

              }}

            />

            <span className="relative z-10">🚀 Start Now — Login</span>

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

            style={{ color: "oklch(0.65 0.18 310)" }}

          >

            Scroll

          </span>

          <motion.div

            animate={{ y: [0, 10, 0] }}

            transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}

            className="w-[1px] h-14"

            style={{

              background:

                "linear-gradient(to bottom, oklch(0.65 0.25 310), transparent)",

            }}

          />

          <motion.div

            animate={{ opacity: [0.4, 1, 0.4] }}

            transition={{ repeat: Infinity, duration: 1.6 }}

            style={{ color: "oklch(0.65 0.25 310)" }}

          >

            ↓

          </motion.div>

        </motion.div>

      </div>



      {/* ═══════════════════════════════════════════

          WHAT IS THIS PLATFORM? (Intro)

      ═══════════════════════════════════════════ */}

      <section className="relative z-10 px-6 md:px-12 py-28" style={{ scrollSnapAlign: "start" }}>

        <div className="max-w-4xl mx-auto text-center">

          <FadeInSection>

            <p

              className="text-xs uppercase tracking-[0.5em] font-bold mb-4"

              style={{ color: "oklch(0.65 0.25 310)" }}

            >

              About This Platform

            </p>

            <h2

              className="font-black uppercase mb-6"

              style={{ fontSize: "clamp(28px, 5vw, 52px)", letterSpacing: "-0.02em" }}

            >

              Myanmar Content Creation,{" "}

              <span style={{ color: "oklch(0.72 0.22 310)" }}>Simplified.</span>

            </h2>

            <p className="text-gray-400 text-base leading-loose max-w-2xl mx-auto">

              Lumix Studio သည် Myanmar Content Creator များအတွက် အထူးဒီဇိုင်းထုတ်ထားသော AI-Powered Platform တစ်ခုဖြစ်သည်။ 

              သင်သည် YouTube, TikTok, Facebook Video များ ထုတ်လုပ်ရာတွင် လိုအပ်သော — AI Voice, Auto Subtitle, 

              နှင့် Video Translation — တို့ကို ဤနေရာတစ်ခုတည်းတွင် ရရှိနိုင်သည်။

              

            </p>

          </FadeInSection>

        </div>

      </section>



      {/* ═══════════════════════════════════════════

          FEATURES GRID

      ═══════════════════════════════════════════ */}

      <section

        className="relative z-10 px-6 md:px-12 py-24"

        style={{

          scrollSnapAlign: "start",

          borderTop: "1px solid oklch(0.65 0.25 310 / 12%)",

          borderBottom: "1px solid oklch(0.65 0.25 310 / 12%)",

        }}

      >

        <div className="max-w-7xl mx-auto">

          <FadeInSection className="text-center mb-16">

            <p

              className="text-xs uppercase tracking-[0.5em] font-bold mb-3"

              style={{ color: "oklch(0.65 0.25 310)" }}

            >

              Core Features

            </p>

            <h2

              className="font-black uppercase"

              style={{ fontSize: "clamp(24px, 4vw, 44px)", letterSpacing: "-0.02em" }}

            >

              Everything You Need

            </h2>

          </FadeInSection>



          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {features.map((f, i) => (

              <FadeInSection key={f.title} delay={i * 0.08}>

                <motion.div

                  whileHover={{ y: -6, borderColor: "oklch(0.65 0.25 310 / 50%)" }}

                  transition={{ duration: 0.3 }}

                  className="p-8 flex flex-col items-start text-left h-full relative overflow-hidden"

                  style={{

                    border: "1px solid oklch(0.65 0.25 310 / 18%)",

                    background:

                      "linear-gradient(135deg, oklch(0.08 0.03 290 / 80%) 0%, oklch(0.05 0.01 290 / 80%) 100%)",

                    backdropFilter: "blur(12px)",

                  }}

                >

                  {/* Top glow corner */}

                  <div

                    className="absolute top-0 right-0 w-28 h-28 pointer-events-none"

                    style={{

                      background:

                        "radial-gradient(circle at top right, oklch(0.65 0.25 310 / 12%), transparent 70%)",

                    }}

                  />



                  <span className="text-4xl mb-5 block">{f.icon}</span>



                  {/* Badge */}

                  <span

                    className="text-[10px] font-black uppercase tracking-[0.35em] px-3 py-1 rounded-full mb-4"

                    style={{

                      background: "oklch(0.65 0.25 310 / 15%)",

                      color: "oklch(0.78 0.2 310)",

                      border: "1px solid oklch(0.65 0.25 310 / 25%)",

                    }}

                  >

                    {f.badge}

                  </span>



                  <h4

                    className="text-lg font-black uppercase mb-3"

                    style={{ color: "oklch(0.78 0.18 310)" }}

                  >

                    {f.title}

                  </h4>

                  <p className="text-gray-400 text-sm leading-relaxed mb-5">{f.desc}</p>

                  <p

                    className="text-xs mt-auto font-semibold"

                    style={{ color: "oklch(0.65 0.2 310 / 70%)" }}

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

      <section className="relative z-10 px-6 md:px-12 py-28" style={{ scrollSnapAlign: "start" }}>

        <div className="max-w-5xl mx-auto">

          <FadeInSection className="text-center mb-16">

            <p

              className="text-xs uppercase tracking-[0.5em] font-bold mb-3"

              style={{ color: "oklch(0.65 0.25 310)" }}

            >

              How It Works

            </p>

            <h2

              className="font-black uppercase"

              style={{ fontSize: "clamp(24px, 4vw, 44px)", letterSpacing: "-0.02em" }}

            >

              All-in-One One-Click Workflow

            </h2>

          </FadeInSection>



          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-2 relative">

            {/* Connector line */}

            <div

              className="hidden md:block absolute top-[52px] left-[12.5%] right-[12.5%] h-[1px]"

              style={{

                background:

                  "linear-gradient(90deg, transparent, oklch(0.65 0.25 310 / 40%), transparent)",

              }}

            />



            {steps.map((s, i) => (

              <FadeInSection key={s.num} delay={i * 0.12} className="flex flex-col items-center text-center px-3 md:px-2">

                <motion.div

                  whileHover={{ scale: 1.1 }}

                  className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-xl font-black mb-6 relative z-10"

                  style={{

                    background:

                      "linear-gradient(135deg, oklch(0.65 0.28 310), oklch(0.55 0.28 270))",

                    boxShadow: "0 0 30px oklch(0.65 0.25 310 / 50%)",

                  }}

                >

                  {s.num}

                </motion.div>

                <h5 className="font-black uppercase text-sm mb-2 tracking-wider leading-snug min-h-10 flex items-center text-center">

                  {s.title}

                </h5>

                <p className="text-gray-400 text-xs leading-relaxed max-w-[210px] mx-auto">{s.desc}</p>

              </FadeInSection>

            ))}

          </div>

        </div>

      </section>



      {/* ═══════════════════════════════════════════

          CTA BANNER

      ═══════════════════════════════════════════ */}

      <FadeInSection>

        <section className="relative z-10 px-6 md:px-12 py-24 text-center overflow-hidden" style={{ scrollSnapAlign: "start" }}>

          {/* glow behind CTA */}

          <div

            className="absolute inset-0 pointer-events-none"

            style={{

              background:

                "radial-gradient(ellipse 80% 60% at 50% 50%, oklch(0.55 0.28 310 / 15%), transparent 70%)",

            }}

          />

          <p

            className="text-xs uppercase tracking-[0.5em] font-bold mb-4"

            style={{ color: "oklch(0.65 0.25 310)" }}

          >

            Get Started Now

          </p>

          <h2

            className="font-black uppercase mb-6"

            style={{

              fontSize: "clamp(28px, 6vw, 64px)",

              letterSpacing: "-0.03em",

              textShadow: "0 0 40px oklch(0.65 0.25 310 / 40%)",

            }}

          >

            Create Better Content,{" "}

            <span style={{ color: "oklch(0.72 0.22 310)" }}>Faster.</span>

          </h2>

          <p className="text-gray-400 mb-10 max-w-lg mx-auto text-sm leading-relaxed">

            Account တစ်ခုဖန်တီးပြီး ယနေ့စတင်အသုံးပြုလိုက်ပါ။

          </p>



          <motion.button

            whileHover={{

              scale: 1.06,

              boxShadow: "0 0 80px oklch(0.65 0.25 310 / 80%)",

            }}

            whileTap={{ scale: 0.95 }}

            onClick={() => navigate("/login")}

            className="inline-block px-10 md:px-14 py-4 md:py-5 text-base md:text-lg font-black uppercase tracking-wide md:tracking-wider text-white rounded-sm relative overflow-hidden group"

            style={{

              background:

                "linear-gradient(135deg, oklch(0.65 0.28 310), oklch(0.55 0.28 270))",

              boxShadow: "0 0 60px oklch(0.65 0.25 310 / 55%)",

            }}

          >

            <span

              className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"

              style={{

                background:

                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)",

              }}

            />

            <span className="relative z-10">🚀 Start Now — Login</span>

          </motion.button>

        </section>

      </FadeInSection>



      {/* ─── FOOTER ─── */}

      <footer

        className="relative z-10 text-center py-10 text-[10px] tracking-[0.5em] uppercase"

        style={{

          borderTop: "1px solid oklch(0.65 0.25 310 / 10%)",

          color: "oklch(0.4 0.05 310)",

        }}

      >

        © 2026 LUMIX STUDIO · Professional Content Tools · Myanmar

      </footer>

    </div>

  );

}
