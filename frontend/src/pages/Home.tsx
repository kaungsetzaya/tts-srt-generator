import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Volume2, Zap, Layers } from "lucide-react";
import { getLoginUrl } from "@/const";

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();

  const handleGetStarted = () => {
    window.location.href = "/lumix";
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden relative">
      {/* Animated background grid */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(0deg, transparent 24%, rgba(37,99,235,0.05) 25%, rgba(37,99,235,0.05) 26%, transparent 27%, transparent 74%, rgba(37,99,235,0.05) 75%, rgba(37,99,235,0.05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(37,99,235,0.05) 25%, rgba(37,99,235,0.05) 26%, transparent 27%, transparent 74%, rgba(37,99,235,0.05) 75%, rgba(37,99,235,0.05) 76%, transparent 77%, transparent)",
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      {/* Header Navigation */}
      <header className="relative z-20 border-b border-border backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div
            className="text-2xl font-black uppercase tracking-widest"
            style={{
              textShadow: "0 0 15px #2563EB",
              color: "#2563EB",
            }}
          >
            TTS Generator
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated && user && (
              <div className="flex items-center gap-4">
                <span className="text-sm opacity-70">
                  {user.name || user.email}
                </span>
                <button
                  onClick={() => logout()}
                  className="text-sm px-4 py-2 border border-accent text-accent hover:bg-accent/10 transition-all"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-4 py-20">
        {/* Hero Section */}
        <div className="max-w-4xl mx-auto mb-20">
          <div className="text-center space-y-8">
            {/* Main Title */}
            <div className="relative">
              <div className="absolute -top-8 -left-8 w-16 h-16 border-2 border-primary opacity-50"></div>
              <div className="absolute -bottom-8 -right-8 w-16 h-16 border-2 border-primary opacity-50"></div>

              <h1
                className="text-6xl md:text-7xl font-black uppercase tracking-widest mb-4"
                style={{
                  textShadow:
                    "0 0 30px #2563EB, 0 0 60px #2563EB, 0 0 90px #2563EB",
                  color: "#2563EB",
                }}
              >
                Text to Speech
              </h1>
              <h2
                className="text-4xl md:text-5xl font-black uppercase tracking-widest"
                style={{
                  textShadow: "0 0 20px #0891B2",
                  color: "#0891B2",
                }}
              >
                Meets SRT Magic
              </h2>
            </div>

            {/* Subtitle */}
            <p className="text-lg md:text-xl opacity-80 max-w-2xl mx-auto leading-relaxed">
              Generate professional audio and subtitle files with advanced voice
              control. Choose your voice, adjust tone and speed, and download
              everything instantly.
            </p>

            {/* CTA Button */}
            <div className="pt-8">
              <button
                onClick={handleGetStarted}
                className="btn-neon text-lg px-12 py-4 inline-block"
              >
                Open Generator
              </button>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="max-w-5xl mx-auto mb-20">
          <h3
            className="text-3xl font-black uppercase tracking-widest mb-12 text-center"
            style={{ color: "#0891B2" }}
          >
            Powerful Features
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="relative border-2 border-border p-8 bg-card backdrop-blur hover:border-primary transition-all duration-300">
              <div className="absolute -top-4 -left-4 w-8 h-8 border-2 border-primary opacity-50"></div>
              <Volume2
                className="w-12 h-12 mb-4"
                style={{ color: "#2563EB" }}
              />
              <h4
                className="text-xl font-bold uppercase tracking-wider mb-3"
                style={{ color: "#2563EB" }}
              >
                Multiple Voices
              </h4>
              <p className="opacity-70 text-sm">
                Choose between Thiha and Nilar voices with full control over
                tone and speed adjustments.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="relative border-2 border-border p-8 bg-card backdrop-blur hover:border-primary transition-all duration-300">
              <div className="absolute -top-4 -left-4 w-8 h-8 border-2 border-primary opacity-50"></div>
              <Zap className="w-12 h-12 mb-4" style={{ color: "#0891B2" }} />
              <h4
                className="text-xl font-bold uppercase tracking-wider mb-3"
                style={{ color: "#0891B2" }}
              >
                Audio Preview
              </h4>
              <p className="opacity-70 text-sm">
                Test your settings with a quick preview before generating the
                full audio file.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="relative border-2 border-border p-8 bg-card backdrop-blur hover:border-primary transition-all duration-300">
              <div className="absolute -top-4 -left-4 w-8 h-8 border-2 border-primary opacity-50"></div>
              <Layers className="w-12 h-12 mb-4" style={{ color: "#2563EB" }} />
              <h4
                className="text-xl font-bold uppercase tracking-wider mb-3"
                style={{ color: "#2563EB" }}
              >
                SRT Generation
              </h4>
              <p className="opacity-70 text-sm">
                Automatically generate SRT subtitle files with proper timing in
                9:16 or 16:9 format.
              </p>
            </div>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="max-w-4xl mx-auto">
          <h3
            className="text-3xl font-black uppercase tracking-widest mb-12 text-center"
            style={{ color: "#0891B2" }}
          >
            How It Works
          </h3>

          <div className="space-y-6">
            {[
              {
                step: 1,
                title: "Enter Your Text",
                desc: "Paste or type the content you want to convert to speech (up to 5000 characters)",
              },
              {
                step: 2,
                title: "Configure Settings",
                desc: "Select your voice, adjust tone and speed, and choose the SRT aspect ratio",
              },
              {
                step: 3,
                title: "Preview & Generate",
                desc: "Test with a quick preview, then generate both audio and SRT files",
              },
              {
                step: 4,
                title: "Download Files",
                desc: "Get your MP3 audio and SRT subtitle files ready for use",
              },
            ].map(item => (
              <div key={item.step} className="flex gap-6 items-start">
                <div
                  className="flex-shrink-0 w-12 h-12 rounded-full border-2 border-primary flex items-center justify-center font-black text-lg"
                  style={{ color: "#2563EB" }}
                >
                  {item.step}
                </div>
                <div className="pt-2">
                  <h4
                    className="text-xl font-bold uppercase tracking-wider mb-2"
                    style={{ color: "#0891B2" }}
                  >
                    {item.title}
                  </h4>
                  <p className="opacity-70">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border mt-20 py-8 backdrop-blur-sm">
        <div className="container mx-auto px-4 text-center opacity-60 text-sm">
          <p>© 2026 LUMIX TTS Generator.</p>
        </div>
      </footer>
    </div>
  );
}
