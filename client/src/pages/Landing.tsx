import { useLocation } from "wouter";

export default function Landing() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Grid background */}
      <div className="fixed inset-0 opacity-10" style={{
        backgroundImage: "linear-gradient(rgba(139,92,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.3) 1px, transparent 1px)",
        backgroundSize: "50px 50px"
      }} />

      {/* Navbar */}
      <nav className="relative z-10 flex justify-between items-center px-8 py-5 border-b border-purple-900/50">
        <div className="text-2xl font-black tracking-widest" style={{ color: "oklch(0.65 0.25 310)" }}>
          LUMIX
        </div>
        <button onClick={() => navigate("/login")}
          className="px-6 py-2 border-2 border-purple-500 text-purple-400 font-bold uppercase tracking-wider hover:bg-purple-500/20 transition-all">
          LOGIN
        </button>
      </nav>

      {/* Hero */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[85vh] text-center px-4">
        <div className="mb-4 text-purple-400 text-sm uppercase tracking-[0.3em] font-bold">
          Myanmar AI Voice Technology
        </div>
        <h1 className="text-6xl md:text-8xl font-black uppercase mb-4 leading-none"
          style={{ textShadow: "0 0 40px oklch(0.65 0.25 310)", color: "oklch(0.75 0.25 310)" }}>
          TEXT TO<br />SPEECH
        </h1>
        <h2 className="text-3xl md:text-5xl font-black uppercase mb-8"
          style={{ color: "oklch(0.6 0.28 280)", textShadow: "0 0 20px oklch(0.6 0.28 280)" }}>
          MEETS SRT MAGIC
        </h2>
        <p className="text-lg text-gray-400 max-w-2xl mb-12 leading-relaxed">
          Generate professional Myanmar audio and subtitle files with advanced voice control.
          Choose your voice, adjust tone and speed, and download everything instantly.
        </p>
        <button onClick={() => navigate("/login")}
          className="px-12 py-5 text-xl font-black uppercase tracking-widest transition-all duration-300 hover:scale-105"
          style={{
            background: "oklch(0.65 0.25 310)",
            color: "white",
            boxShadow: "0 0 40px oklch(0.65 0.25 310 / 50%)"
          }}>
          LOGIN TO START
        </button>
      </div>

      {/* Features */}
      <div className="relative z-10 px-8 py-20 border-t border-purple-900/30">
        <h3 className="text-center text-3xl font-black uppercase tracking-widest mb-16"
          style={{ color: "oklch(0.6 0.28 280)" }}>
          POWERFUL FEATURES
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {[
            { icon: "🎙️", title: "MULTIPLE VOICES", desc: "Choose between Thiha (Male) and Nilar (Female) Myanmar voices with full tone and speed control." },
            { icon: "⚡", title: "INSTANT GENERATE", desc: "Generate professional MP3 audio and SRT subtitle files in seconds with real timing." },
            { icon: "📐", title: "DUAL SRT FORMAT", desc: "Download SRT files optimized for both 9:16 vertical and 16:9 horizontal video formats." },
          ].map((f) => (
            <div key={f.title} className="border border-purple-900/50 p-8 hover:border-purple-500/50 transition-all"
              style={{ background: "oklch(0.08 0.01 280 / 50%)" }}>
              <div className="text-4xl mb-4">{f.icon}</div>
              <h4 className="font-black uppercase tracking-wider mb-3" style={{ color: "oklch(0.65 0.25 310)" }}>{f.title}</h4>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="relative z-10 px-8 py-20 border-t border-purple-900/30">
        <h3 className="text-center text-3xl font-black uppercase tracking-widest mb-16"
          style={{ color: "oklch(0.6 0.28 280)" }}>
          HOW IT WORKS
        </h3>
        <div className="max-w-2xl mx-auto space-y-8">
          {[
            { n: "1", title: "GET YOUR CODE", desc: "Message @lumixmmbot on Telegram with /start to receive your unique 6-digit login code." },
            { n: "2", title: "LOGIN", desc: "Enter your 6-digit Telegram code on the login page to access the generator." },
            { n: "3", title: "GENERATE", desc: "Enter your text, select voice, adjust tone and speed, then generate audio and SRT files." },
            { n: "4", title: "DOWNLOAD", desc: "Download your MP3 audio and SRT subtitle files ready for video production." },
          ].map((s) => (
            <div key={s.n} className="flex gap-6 items-start">
              <div className="w-12 h-12 rounded-full border-2 flex items-center justify-center font-black text-lg flex-shrink-0"
                style={{ borderColor: "oklch(0.65 0.25 310)", color: "oklch(0.65 0.25 310)" }}>
                {s.n}
              </div>
              <div>
                <h4 className="font-black uppercase tracking-wider mb-1" style={{ color: "oklch(0.65 0.25 310)" }}>{s.title}</h4>
                <p className="text-gray-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 text-center py-8 border-t border-purple-900/30 text-gray-600 text-sm">
        © 2026 LUMIX Generator · Myanmar AI Voice Technology · @lumixmmbot
      </footer>
    </div>
  );
}
