import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

export default function Login() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [, navigate] = useLocation();

  const safeError = (msg: string) => {
    if (!msg) return "Login မအောင်မြင်ပါ။ ထပ်မံကြိုးစားပါ။";
    if (msg.includes("/tmp/") || msg.includes("/root/") || msg.includes("Command failed:")) return "Login မအောင်မြင်ပါ။ ထပ်မံကြိုးစားပါ။";
    return msg;
  };

  const loginMutation = trpc.auth.loginWithCode.useMutation({
    onSuccess: (data) => {
      if (data.role === "admin") {
        window.location.href = "/admin";
      } else {
        window.location.href = "/lumix";
      }
    },
    onError: (err) => {
      setError(safeError(err.message));
    },
  });

  const handleLogin = () => {
    if (code.length !== 6) { setError("Please enter 6-digit code"); return; }
    setError("");
    loginMutation.mutate({ code });
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4"
      style={{
        backgroundImage: "linear-gradient(rgba(139,92,246,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.1) 1px, transparent 1px)",
        backgroundSize: "50px 50px"
      }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black uppercase tracking-widest mb-2"
            style={{ color: "oklch(0.65 0.25 310)", textShadow: "0 0 30px oklch(0.65 0.25 310)" }}>
            LUMIX
          </h1>
          <p className="text-gray-500 text-sm uppercase tracking-widest">Login with Telegram Code</p>
        </div>
        <div className="border border-purple-900/50 p-8" style={{ background: "oklch(0.08 0.01 280 / 80%)" }}>
          <div className="mb-6 p-4 border border-purple-900/30 bg-purple-900/10 rounded text-sm text-gray-400 leading-relaxed">
            <p className="font-bold text-purple-400 mb-2">📱 Get your code:</p>
            <p>1. Open Telegram</p>
            <p>2. Message <span className="text-purple-400 font-bold">@lumixmmbot</span></p>
            <p>3. Send <span className="text-purple-400 font-mono">/start</span></p>
            <p>4. Copy your 6-digit code</p>
          </div>
          <label className="block text-xs uppercase tracking-widest text-purple-400 font-bold mb-3">
            Enter 6-Digit Code
          </label>
          <input
            type="text"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="000000"
            className="w-full text-center text-4xl font-mono tracking-[0.5em] py-4 bg-black border-2 border-purple-900/50 text-white focus:outline-none focus:border-purple-500 placeholder-gray-700"
          />
          {error && (
            <p className="mt-3 text-red-400 text-sm text-center">{error}</p>
          )}
          <button
            onClick={handleLogin}
            disabled={loginMutation.isPending || code.length !== 6}
            className="w-full mt-6 py-4 font-black uppercase tracking-widest text-white transition-all disabled:opacity-50"
            style={{ background: "oklch(0.65 0.25 310)", boxShadow: "0 0 20px oklch(0.65 0.25 310 / 40%)" }}>
            {loginMutation.isPending
              ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Verifying...</span>
              : "LOGIN"}
          </button>
          <div className="mt-6 text-center">
            <a href="/" className="text-gray-600 text-xs hover:text-gray-400 transition-colors">← Back to Home</a>
          </div>
        </div>
      </div>
    </div>
  );
}
