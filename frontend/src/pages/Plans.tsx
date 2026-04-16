import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Check, ArrowLeft, Crown, Zap, Shield } from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "0",
    period: "forever",
    desc: "Trial access for new users",
    badge: "Free",
    badgeColor: "#6b7280",
    features: [
      "5 TTS generations",
      "Basic voices",
      "720p video export",
      "Community support",
    ],
    cta: "Start Free",
    popular: false,
  },
  {
    name: "Monthly",
    price: "9,900",
    period: "/month",
    desc: "Full access, billed monthly",
    badge: "Popular",
    badgeColor: "#F4B34F",
    features: [
      "Unlimited TTS generations",
      "All 10+ premium voices",
      "4K video export",
      "Video dubbing & translation",
      "Priority support",
      "SRT subtitle generation",
    ],
    cta: "Get Monthly",
    popular: true,
  },
  {
    name: "Yearly",
    price: "89,000",
    period: "/year",
    desc: "Best value, save 25%",
    badge: "Best Value",
    badgeColor: "#C06F30",
    features: [
      "Everything in Monthly",
      "2 months free",
      "Early access to new features",
      "Dedicated support",
      "Custom voice cloning (soon)",
    ],
    cta: "Get Yearly",
    popular: false,
  },
];

export default function Plans() {
  const [, nav] = useLocation();

  return (
    <div className="min-h-screen" style={{ background: "#0f0f0f", color: "#EBE6D8" }}>
      {/* Header */}
      <div className="fixed top-4 left-4 z-50">
        <button
          onClick={() => nav("/")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider transition-all hover:opacity-80"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#F4B34F" }}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-24">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-block px-4 py-1.5 rounded-full text-xs uppercase tracking-[0.3em] font-semibold mb-4"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#F4B34F" }}>
            Pricing
          </div>
          <h1 className="font-black text-4xl md:text-6xl mb-4" style={{ letterSpacing: "-0.02em" }}>
            Simple, <span style={{ color: "#F4B34F" }}>Transparent</span> Pricing
          </h1>
          <p className="text-lg opacity-60 max-w-xl mx-auto">
            Choose the plan that fits your content creation needs. Upgrade or downgrade anytime.
          </p>
        </motion.div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`relative rounded-3xl p-8 ${plan.popular ? "scale-105" : ""}`}
              style={{
                background: plan.popular
                  ? "linear-gradient(135deg, rgba(192,111,48,0.15) 0%, rgba(244,179,79,0.08) 100%)"
                  : "rgba(255,255,255,0.03)",
                border: plan.popular
                  ? "2px solid #C06F30"
                  : "1px solid rgba(255,255,255,0.08)",
                boxShadow: plan.popular ? "0 20px 60px rgba(192,111,48,0.2)" : "none",
              }}
            >
              {/* Badge */}
              <div
                className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                style={{ background: plan.badgeColor, color: "#0f0f0f" }}
              >
                {plan.badge}
              </div>

              {/* Plan Info */}
              <div className="text-center mb-8">
                <h3 className="font-black text-xl uppercase tracking-wider mb-2">{plan.name}</h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-black" style={{ color: plan.popular ? "#F4B34F" : "#EBE6D8" }}>
                    {plan.price}
                  </span>
                  <span className="text-sm opacity-50">{plan.period}</span>
                </div>
                <p className="text-sm mt-2 opacity-60">{plan.desc}</p>
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#F4B34F" }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3 rounded-xl font-bold uppercase tracking-wider text-sm transition-all"
                style={{
                  background: plan.popular ? "#F4B34F" : "rgba(255,255,255,0.06)",
                  color: plan.popular ? "#0f0f0f" : "#EBE6D8",
                  border: plan.popular ? "none" : "1px solid rgba(255,255,255,0.12)",
                }}
              >
                {plan.cta}
              </motion.button>
            </motion.div>
          ))}
        </div>

        {/* FAQ */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-20 text-center"
        >
          <h2 className="font-black text-2xl mb-8 uppercase tracking-wider">
            Frequently Asked Questions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto text-left">
            {[
              {
                q: "How do I subscribe?",
                a: "Go to Telegram bot @LumixStudioBot and use /subscribe command. Scan QR code or use payment link.",
              },
              {
                q: "Can I cancel anytime?",
                a: "Yes, you can cancel your subscription anytime. Your access continues until the billing period ends.",
              },
              {
                q: "What payment methods?",
                a: "We accept KBZ Pay, Wave Pay, and major credit/debit cards via payment gateway.",
              },
              {
                q: "Need help?",
                a: "Contact us via Telegram @LumixSupportBot or email support@lumix.studio",
              },
            ].map((faq) => (
              <div
                key={faq.q}
                className="p-6 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <h4 className="font-bold mb-2">{faq.q}</h4>
                <p className="text-sm opacity-60">{faq.a}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Contact */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-16 text-center py-12 rounded-3xl"
          style={{ background: "linear-gradient(135deg, rgba(192,111,48,0.12) 0%, rgba(244,179,79,0.06) 100%)", border: "1px solid rgba(192,111,48,0.2)" }}
        >
          <Crown className="w-8 h-8 mx-auto mb-4" style={{ color: "#F4B34F" }} />
          <h3 className="font-black text-xl mb-2">Enterprise Solutions</h3>
          <p className="text-sm opacity-60 mb-4">Need custom volume pricing or API access?</p>
          <button className="px-6 py-2 rounded-xl text-sm font-bold uppercase tracking-wider" style={{ background: "#F4B34F", color: "#0f0f0f" }}>
            Contact Sales
          </button>
        </motion.div>
      </div>
    </div>
  );
}
