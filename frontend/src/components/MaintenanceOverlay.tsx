import { motion } from "framer-motion";
import { Settings, Wrench, AlertTriangle } from "lucide-react";

export default function MaintenanceOverlay() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-black text-white selection:bg-orange-500/30">
      {/* Dynamic Background Noise/Glow */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 left-1/4 w-[40vw] h-[40vw] rounded-full bg-orange-600/10 blur-[120px] mix-blend-screen animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[50vw] h-[50vw] rounded-full bg-amber-600/10 blur-[150px] mix-blend-screen animate-pulse delay-1000" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="z-10 flex flex-col items-center max-w-2xl text-center px-4"
      >
        {/* Animated Icons */}
        <div className="relative mb-12">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -top-10 -left-12 opacity-20 text-orange-400"
          >
            <Settings size={120} strokeWidth={1} />
          </motion.div>
          <motion.div 
            animate={{ rotate: -360 }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute top-4 -right-16 opacity-30 text-amber-500"
          >
            <Settings size={80} strokeWidth={1.5} />
          </motion.div>
          <div className="relative bg-gradient-to-tr from-orange-500/20 to-amber-500/10 p-6 rounded-3xl border border-orange-500/20 backdrop-blur-md shadow-[0_0_50px_rgba(249,115,22,0.15)]">
            <Wrench className="w-16 h-16 text-orange-400" strokeWidth={1.5} />
          </div>
        </div>

        {/* Text Headers */}
        <motion.div
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           transition={{ delay: 0.3, duration: 0.5 }}
           className="space-y-4"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-orange-400 bg-orange-500/10 rounded-full border border-orange-500/20">
            <AlertTriangle className="w-3 h-3" /> System maintenance
          </span>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-orange-100 to-amber-200 drop-shadow-sm">
            We are upgrading LUMIX
          </h1>
          <p className="text-sm md:text-base text-gray-400 max-w-lg mx-auto leading-relaxed mt-4">
            Our systems are currently undergoing scheduled maintenance to bring you new features and immense performance upgrades. We'll be back online shortly.
          </p>
        </motion.div>

        {/* Status Bar */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 1 }}
          className="mt-12 flex items-center gap-4 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md"
        >
          
        </motion.div>
      </motion.div>
    </div>
  );
}
