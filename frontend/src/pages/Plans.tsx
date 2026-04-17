import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Check, ArrowLeft, Crown, Star, Sparkles, Zap, Shield, Play } from "lucide-react";

const plans = [
  {
    name: "Starter Pack",
    price: "15,000",
    period: "one-time",
    credits: 50,
    desc: "Ideal for beginners and casual creators exploring the basics.",
    badge: "Starter",
    badgeColor: "rgba(255,255,255,0.8)",
    features: [
      "50 Credits",
      "Access to Standard Voices (Thiha & Nilar)",
      "Video Translate (Script/SRT Extraction)",
      "Basic AI Video Dubbing",
      "2.5 min / 25MB per task limit",
    ],
    cta: "Get Starter",
    popular: false,
  },
  {
    name: "Creator Pack",
    price: "35,000",
    period: "one-time",
    credits: 200,
    desc: "Perfect for active social media influencers & regular uploads.",
    badge: "Most Popular",
    badgeColor: "#F4B34F",
    features: [
      "200 Credits",
      "Everything in Starter",
      "Access to Premium Voices",
      "Priority Queue (Faster processing)",
      "Premium AI Video Dubbing",
    ],
    cta: "Get Creator",
    popular: true,
  },
  {
    name: "Pro Pack",
    price: "75,000",
    period: "one-time",
    credits: 500,
    desc: "Built for professional creators, agencies, and heavy usage.",
    badge: "Best Value",
    badgeColor: "#C06F30",
    features: [
      "500 Credits",
      "Everything in Creator",
      "Fastest Rendering Speed",
      "Early access to Beta features",
      "Dedicated priority support",
    ],
    cta: "Get Pro",
    popular: false,
  },
];

const creditCosts = [
  { action: "TTS (Thiha/Nilar)", cost: "1", color: "#4ade80", icon: Play },
  { action: "TTS (Character Voices)", cost: "3", color: "#60a5fa", icon: Zap },
  { action: "Video Translate", cost: "5", color: "#F4B34F", icon: Sparkles },
  { action: "AI Video Dub (Thiha/Nilar)", cost: "10", color: "#C06F30", icon: Play },
  { action: "AI Video Dub (Character)", cost: "15", color: "#f472b6", icon: Crown },
];

export default function Plans() {
  const [, nav] = useLocation();

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ background: "#050505", color: "#EBE6D8", fontFamily: "'Inter', sans-serif" }}
    >
      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#F4B34F] opacity-[0.03] blur-[150px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#C06F30] opacity-[0.04] blur-[150px] rounded-full mix-blend-screen" />
        <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] bg-[#60a5fa] opacity-[0.02] blur-[120px] rounded-full mix-blend-screen" />
      </div>

      {/* Header */}
      <div className="fixed top-6 left-6 z-50">
        <button
          onClick={() => nav("/")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold uppercase tracking-wider transition-all hover:bg-white/10 hover:scale-105 backdrop-blur-md"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#EBE6D8",
          }}
        >
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-32 relative z-10">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-24"
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs uppercase tracking-[0.2em] font-bold mb-8"
            style={{
              background: "rgba(244,179,79,0.1)",
              border: "1px solid rgba(244,179,79,0.2)",
              color: "#F4B34F",
            }}
          >
            <Sparkles className="w-4 h-4" /> Pricing Plans
          </div>
          <h1
            className="font-black text-5xl md:text-7xl mb-6 relative inline-block"
            style={{ letterSpacing: "-0.03em" }}
          >
            Simple, <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F4B34F] to-[#C06F30]">Credit-Based</span>{" "}
            Pricing
          </h1>
          <p className="text-xl opacity-60 max-w-2xl mx-auto leading-relaxed font-light">
            Pay for what you use. Top up your account with credits and access our entire suite of premium AI generation tools without any recurring subscription fees.
          </p>
        </motion.div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: i * 0.15, ease: "easeOut" }}
              className={`relative rounded-[2rem] p-8 md:p-10 transition-transform hover:-translate-y-2 group ${plan.popular ? "md:scale-[1.05] z-10" : ""}`}
              style={{
                background: plan.popular
                  ? "linear-gradient(180deg, rgba(30,30,30,0.8) 0%, rgba(15,15,15,0.95) 100%)"
                  : "linear-gradient(180deg, rgba(20,20,20,0.6) 0%, rgba(10,10,10,0.8) 100%)",
                border: plan.popular
                  ? "1px solid rgba(244,179,79,0.3)"
                  : "1px solid rgba(255,255,255,0.05)",
                boxShadow: plan.popular
                  ? "0 30px 60px rgba(192,111,48,0.15), inset 0 1px 0 rgba(255,255,255,0.1)"
                  : "0 20px 40px rgba(0,0,0,0.4)",
                backdropFilter: "blur(20px)",
              }}
            >
              {plan.popular && (
                <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-[#F4B34F]/20 to-[#C06F30]/0 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
              )}

              {/* Badge */}
              {plan.popular && (
                <div
                  className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.2em] shadow-lg"
                  style={{ background: "linear-gradient(90deg, #F4B34F 0%, #C06F30 100%)", color: "#000" }}
                >
                  {plan.badge}
                </div>
              )}

              {/* Plan Info */}
              <div className="text-center mb-10 relative z-10">
                <h3 className="font-bold text-2xl mb-4" style={{ color: plan.popular ? "#fff" : "rgba(255,255,255,0.9)" }}>
                  {plan.name}
                </h3>
                <div className="flex items-end justify-center gap-1.5 mb-4">
                  <span
                    className="text-5xl font-black tracking-tight"
                    style={{ color: plan.popular ? "#F4B34F" : "#fff" }}
                  >
                    {plan.price}
                  </span>
                  <span className="text-sm opacity-50 font-medium mb-1 tracking-wider uppercase">MMK</span>
                </div>
                <div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
                  style={{
                    background: plan.popular ? "rgba(244,179,79,0.1)" : "rgba(255,255,255,0.03)",
                    border: plan.popular ? "1px solid rgba(244,179,79,0.2)" : "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <Star className="w-4 h-4" style={{ color: plan.popular ? "#F4B34F" : "#EBE6D8" }} />
                  <span className="text-sm font-bold" style={{ color: plan.popular ? "#F4B34F" : "#EBE6D8" }}>
                    {plan.credits} Credits Included
                  </span>
                </div>
                <p className="text-sm opacity-60 leading-relaxed max-w-[250px] mx-auto">
                  {plan.desc}
                </p>
              </div>

              {/* Features */}
              <ul className="space-y-4 mb-10 relative z-10">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-3 text-sm font-medium opacity-80 group-hover:opacity-100 transition-opacity">
                    <div className={`mt-0.5 rounded-full p-0.5 ${plan.popular ? "bg-[#F4B34F]/20" : "bg-white/10"}`}>
                      <Check
                        className="w-3.5 h-3.5 flex-shrink-0"
                        style={{ color: plan.popular ? "#F4B34F" : "#EBE6D8" }}
                      />
                    </div>
                    <span className="leading-tight">{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="relative z-10 w-full py-4 rounded-xl font-bold uppercase tracking-wider text-sm transition-all overflow-hidden"
                style={{
                  background: plan.popular
                    ? "linear-gradient(90deg, #F4B34F 0%, #C06F30 100%)"
                    : "rgba(255,255,255,0.05)",
                  color: plan.popular ? "#000" : "#fff",
                  boxShadow: plan.popular ? "0 10px 20px rgba(192,111,48,0.2)" : "none",
                }}
              >
                {plan.cta}
              </motion.button>
            </motion.div>
          ))}
        </div>

        {/* Credit Usage Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="mt-32 max-w-4xl mx-auto"
        >
          <div className="text-center mb-12">
            <h2 className="font-black text-3xl md:text-4xl mb-4 tracking-tight">
              Honest transparent <span style={{ color: "#F4B34F" }}>Cost per task</span>
            </h2>
            <p className="text-lg opacity-60">See exactly how many credits each generation utilizes.</p>
          </div>
          
          <div
            className="rounded-3xl p-2"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
              border: "1px solid rgba(255,255,255,0.05)",
              backdropFilter: "blur(20px)",
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
              {creditCosts.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.action}
                    className="flex flex-col items-center justify-center p-6 rounded-2xl transition-all hover:bg-white/5 group"
                    style={{ background: "rgba(0,0,0,0.2)" }}
                  >
                    <Icon className="w-6 h-6 mb-4 opacity-50 group-hover:opacity-100 transition-opacity" style={{ color: item.color }} />
                    <span className="text-xs font-semibold uppercase tracking-wider text-center opacity-70 mb-3 h-8 flex items-center justify-center">{item.action}</span>
                    <div className="flex items-baseline gap-1" style={{ color: item.color }}>
                      <span className="font-black text-3xl">{item.cost}</span>
                      <span className="text-xs font-bold uppercase tracking-widest">{Number(item.cost) === 1 ? "CR" : "CRs"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center p-4 mt-2 rounded-xl" style={{ background: "rgba(244,179,79,0.05)" }}>
              <p className="text-sm text-center">
                <span className="opacity-70">Trial users get </span>
                <span className="font-bold px-2 py-1 rounded bg-[#F4B34F]/20 text-[#F4B34F] mx-1">10 free credits</span>
                <span className="opacity-70"> to explore the platform risk-free.</span>
              </p>
            </div>
          </div>
        </motion.div>

        {/* FAQ & Contact */}
        <div className="mt-32 grid md:grid-cols-2 gap-16 md:gap-24 items-start max-w-5xl mx-auto">
          {/* FAQ */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-black text-3xl mb-8 flex items-center gap-3">
              Frequent <span style={{ color: "#F4B34F" }}>Questions</span>
            </h2>
            <div className="space-y-6">
              {[
                {
                  q: "How do I purchase credits?",
                  a: "Simply contact us via Telegram @LumixStudioBot. We support all major local payments including KBZ Pay, Wave Pay, CB Pay, and direct bank transfers.",
                },
                {
                  q: "Do my purchased credits expire?",
                  a: "Your credits are valid for a default of 30 days. You can use them whenever you need up until that period.",
                },
                {
                  q: "Do you offer API access?",
                  a: "Yes, we provide enterprise solutions and API integrations with custom volume pricing for heavy use cases.",
                },
              ].map(faq => (
                <div
                  key={faq.q}
                  className="p-6 rounded-2xl group hover:bg-white/5 transition-colors"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <h4 className="font-bold text-lg mb-3 flex items-start gap-3">
                    <span className="opacity-50 font-black">Q.</span>
                    {faq.q}
                  </h4>
                  <p className="text-sm opacity-60 leading-relaxed font-light ml-8">{faq.a}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Contact / Enterprise */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="sticky top-24 relative p-10 rounded-3xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(30,30,30,0.8) 0%, rgba(15,15,15,0.9) 100%)",
              border: "1px solid rgba(192,111,48,0.3)",
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
              backdropFilter: "blur(20px)",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#F4B34F]/10 to-transparent pointer-events-none" />
            <Shield className="w-10 h-10 mb-6 relative z-10" style={{ color: "#F4B34F" }} />
            <h3 className="font-black text-3xl mb-4 relative z-10">Need an <br/>Enterprise Plan?</h3>
            <p className="text-sm opacity-70 mb-8 leading-relaxed max-w-sm relative z-10">
              For teams, agencies, or custom integration needs requiring massive compute and dedicated infrastructure.
            </p>
            <ul className="space-y-3 mb-10 relative z-10">
              {["Custom volume pricing", "Dedicated API access", "24/7 dedicated support team"].map(item => (
                <li key={item} className="flex items-center gap-3 text-sm opacity-80">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#F4B34F]" />
                  {item}
                </li>
              ))}
            </ul>
            <a 
              href="https://t.me/LumixStudioBot" 
              target="_blank" 
              rel="noreferrer"
              className="inline-flex items-center justify-center w-full py-4 rounded-xl font-bold uppercase tracking-wider text-sm transition-transform hover:scale-[1.02] active:scale-[0.98] relative z-10"
              style={{ background: "#EBE6D8", color: "#000" }}
            >
              Contact Sales Team
            </a>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
