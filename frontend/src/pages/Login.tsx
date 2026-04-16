import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

const C = {
  bg: "#0f0f0f", glass: "rgba(255,255,255,0.06)", glassB: "rgba(255,255,255,0.12)",
  gold: "#F4B34F", copper: "#C06F30", cream: "#EBE6D8", nude: "#ECCEB6", dark: "#1a1a1a",
};

function GlitchPlaceholder() {
  const [text, setText] = useState("000000");
  const chars = "0123456789#@&!?%";
  const frame = useRef(0);

  useEffect(() => {
    const targets = ["0", "0", "0", "0", "0", "0"];
    let resolved = 0;
    const id = setInterval(() => {
      frame.current++;
      setText(prev => {
        const arr = prev.split("");
        for (let i = resolved; i < 6; i++) {
          if (frame.current > 3 + i * 3) { arr[i] = targets[i]; if (i === resolved) resolved++; }
          else arr[i] = chars[Math.floor(Math.random() * chars.length)];
        }
        return arr.join("");
      });
      if (resolved >= 6 && frame.current > 25) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, []);

  return <span>{text}</span>;
}

export default function Login() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [, navigate] = useLocation();

  const mut = trpc.auth.verify.useMutation({
    onSuccess: (d) => { window.location.href = d?.role === "admin" ? "/admin" : "/lumix"; },
    onError: (e) => { setError(e.message); },
  });

  const go = () => {
    if (code.length !== 6) { setError("6 လုံး ထည့်ပါ"); return; }
    setError("");
    mut.mutate({ code });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: C.bg, color: C.cream, perspective: "1000px" }}>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-[160px]" style={{ background: `${C.copper}12` }} />
      </div>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: `linear-gradient(${C.cream}05 1px, transparent 1px), linear-gradient(90deg, ${C.cream}05 1px, transparent 1px)`, backgroundSize: "60px 60px" }} />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black tracking-tight mb-1" style={{ color: C.gold }}>LUMIX</h1>
          <p className="text-xs uppercase tracking-[0.4em]" style={{ color: C.nude }}>Telegram Code Login</p>
        </div>

        <div className="p-8 rounded-3xl" style={{ background: C.glass, backdropFilter: "blur(24px)", border: `1px solid ${C.glassB}`, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
          <div className="mb-6 p-4 rounded-2xl text-sm leading-relaxed" style={{ background: "rgba(192,111,48,0.06)", border: `1px solid rgba(192,111,48,0.12)`, color: C.nude }}>
            <p className="font-bold mb-2" style={{ color: C.gold }}>📱 Code ရယူပါ</p>
            <p>1. Telegram ဖွင့်ပါ</p>
            <p>2. <a href="https://t.me/lumixmmbot" target="_blank" className="font-bold" style={{ color: C.gold }}>@lumixmmbot</a> ကို message ပို့ပါ</p>
            <p>3. <span className="font-mono" style={{ color: C.gold }}>/start</span> ရိုက်ပါ</p>
            <p>4. 6 လုံး code ကို copy ယူပါ</p>
          </div>

          <label className="block text-xs uppercase tracking-[0.3em] font-bold mb-3" style={{ color: C.gold }}>
            6-Digit Code
          </label>
          <div className="relative">
            <input type="text" maxLength={6} value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && go()}
              className="w-full text-center text-3xl font-mono tracking-[0.5em] py-3 rounded-xl"
              style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.glassB}`, color: C.cream, outline: "none", caretColor: C.gold }}
            />
            {!code && (
              <span className="absolute inset-0 flex items-center justify-center text-3xl font-mono tracking-[0.5em] pointer-events-none" style={{ color: `${C.nude}33` }}>
                <GlitchPlaceholder />
              </span>
            )}
          </div>

          {error && <p className="mt-3 text-sm text-center" style={{ color: C.copper }}>{error}</p>}

          <button onClick={go} disabled={mut.isPending || code.length !== 6}
            className="w-full mt-5 py-3.5 rounded-xl text-sm font-black uppercase tracking-[0.15em] disabled:opacity-40"
            style={{ background: C.gold, color: C.dark }}>
            {mut.isPending ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Check...</span> : "LOGIN"}
          </button>

          <div className="mt-5 text-center">
            <a href="/" className="text-xs uppercase tracking-[0.2em]" style={{ color: C.nude }}>← Home</a>
          </div>
        </div>
      </div>
    </div>
  );
}
