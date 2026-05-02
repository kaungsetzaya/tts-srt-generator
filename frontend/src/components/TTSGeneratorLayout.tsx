import { ReactNode } from "react";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  History,
  BookOpen,
  Settings,
  Mic,
  FileVideo,
  Wand2,
  FolderOpen,
  Star,
} from "lucide-react";

interface TTSGeneratorLayoutProps {
  children: ReactNode;
  currentSecondaryTab: string | null;
  onTabChange: (tab: "history" | "plan" | "guide" | "settings" | "files" | null) => void;
  backgroundStyle?: React.CSSProperties;
  mainTab: "tts" | "video" | "dubbing";
  setMainTab: (tab: "tts" | "video" | "dubbing") => void;
  logoUrl?: string;
  isDark?: boolean;
  showLogo?: boolean;
  lang?: "mm" | "en";
  setLang?: (lang: "mm" | "en") => void;
  headerBar?: ReactNode;
}

export function TTSGeneratorLayout({
  children,
  currentSecondaryTab,
  onTabChange,
  backgroundStyle,
  mainTab,
  setMainTab,
  logoUrl,
  isDark,
  lang,
  setLang,
  headerBar,
  showLogo = true,
}: TTSGeneratorLayoutProps) {
  const accent = "#C06F30";
  const accentSecondary = "#F4B34F";

  return (
    <SidebarProvider defaultOpen className="h-[100dvh] overflow-hidden">
      {/* ── Full Width Header Bar ── */}
      <header
        className="fixed top-0 left-0 right-0 z-[200] h-14 w-full border-b backdrop-blur-xl flex items-center px-3 gap-3"
        style={{
          backgroundColor: isDark
            ? "rgba(15, 15, 15, 0.95)"
            : "rgba(255, 255, 255, 0.95)",
          borderColor: isDark
            ? "rgba(255,255,255,0.08)"
            : "rgba(192,111,48,0.1)",
        }}
      >
        {/* Sidebar Trigger */}
        <SidebarTrigger className="hidden md:flex shrink-0 scale-110 active:scale-95 transition-transform" />

        {/* Logo */}
        {showLogo && (
          <div className="flex items-center shrink-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="LUMIX"
                className="h-7 w-auto object-contain"
              />
            ) : (
              <span
                className="text-xl font-black tracking-widest"
                style={{
                  background: "linear-gradient(135deg, #C06F30, #F4B34F)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  letterSpacing: "0.15em",
                  filter: `drop-shadow(0 0 8px ${accent}40)`,
                }}
              >
                LUMIX
              </span>
            )}
          </div>
        )}

        {/* Header Bar Content */}
        {headerBar && (
          <div className="flex-1 overflow-hidden">{headerBar}</div>
        )}
      </header>

      {/* ── Sidebar + Content below header ── */}
      <div className="flex pt-14 h-full w-full">
        <TTSGeneratorSidebar
          currentTab={currentSecondaryTab}
          onTabChange={onTabChange}
          mainTab={mainTab}
          setMainTab={setMainTab}
          isDark={isDark}
          lang={lang}
          setLang={setLang}
        />
        <SidebarRail className="hidden md:block" />
        <SidebarInset className="flex-1 min-h-0 overflow-hidden">
          {/* ── Main Content ── */}
          <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative">
            {children}
          </main>

          {/* ── Mobile Bottom Nav ── */}
          <MobileBottomNavigation
            mainTab={mainTab}
            setMainTab={setMainTab}
            currentSecondaryTab={currentSecondaryTab}
            onTabChange={onTabChange}
            isDark={isDark}
          />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

interface TTSGeneratorSidebarProps {
  currentTab: string | null;
  onTabChange: (tab: "history" | "plan" | "guide" | "settings" | "files" | null) => void;
  mainTab: "tts" | "video" | "dubbing";
  setMainTab: (tab: "tts" | "video" | "dubbing") => void;
  isDark?: boolean;
  lang?: "mm" | "en";
  setLang?: (lang: "mm" | "en") => void;
}

function TTSGeneratorSidebar({
  currentTab,
  onTabChange,
  mainTab,
  setMainTab,
  isDark = true,
  lang = "mm",
  setLang,
}: TTSGeneratorSidebarProps) {
  const sidebar = useSidebar();
  const isCollapsed = !sidebar.open;

  const accent = "#C06F30";
  const accentSecondary = "#F4B34F";

  const allMenuItems = [
    {
      id: "dubbing",
      label: "Auto Creator",
      labelEn: "Auto Creator",
      icon: Wand2,
      type: "main" as const,
    },
    {
      id: "video",
      label: "ဗီဒီယိုဘာသာပြန်",
      labelEn: "Video Translation",
      icon: FileVideo,
      type: "main" as const,
    },
    {
      id: "tts",
      label: "စာမှအသံ",
      labelEn: "Text to Speech",
      icon: Mic,
      type: "main" as const,
    },
    {
      id: "history",
      label: "မှတ်တမ်း",
      labelEn: "History",
      icon: History,
      type: "secondary" as const,
    },
    {
      id: "plan",
      label: "Plan",
      labelEn: "Plan",
      icon: Star,
      type: "secondary" as const,
    },
    {
      id: "files",
      label: "လိုင်ဘရီ",
      labelEn: "Library",
      icon: FolderOpen,
      type: "secondary" as const,
    },
    {
      id: "guide",
      label: "လမ်းညွှန်",
      labelEn: "Guide",
      icon: BookOpen,
      type: "secondary" as const,
    },
    {
      id: "settings",
      label: "ဆက်တင်",
      labelEn: "Settings",
      icon: Settings,
      type: "secondary" as const,
    },
  ];

  const getIsActive = (item: (typeof allMenuItems)[0]) => {
    if (item.type === "secondary") {
      return currentTab === item.id;
    }
    return currentTab === null && mainTab === item.id;
  };

  return (
    <Sidebar
      collapsible="icon"
      className={`hidden md:!flex !relative !h-full glass-sidebar z-50 ${isDark ? "dark" : "light"}`}
      style={
        {
          backgroundColor: isDark
            ? "rgba(15, 15, 15, 0.95)"
            : "rgba(255, 255, 255, 0.95)",
          borderRight: isDark
            ? "1px solid rgba(255,255,255,0.08)"
            : "1px solid rgba(192,111,48,0.1)",
          "--sidebar-width-icon": "4rem",
          "--sidebar-top": "56px",
        } as React.CSSProperties
      }
    >
      <SidebarContent className="bg-transparent px-2 py-4 overflow-y-auto">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1.5">
              {allMenuItems.map(item => {
                const isActive = getIsActive(item);
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.id}>
                    <motion.div
                      whileHover={{
                        x: isCollapsed ? 0 : 4,
                        scale: isCollapsed ? 1.08 : 1,
                      }}
                      whileTap={{ scale: 0.97 }}
                      transition={{
                        duration: 0.2,
                        ease: [0.34, 1.56, 0.64, 1],
                      }}
                    >
                      <SidebarMenuButton
                        onClick={() => {
                          if (item.type === "main") {
                            setMainTab(item.id as "tts" | "video" | "dubbing");
                            onTabChange(null);
                          } else {
                            onTabChange(
                              currentTab === item.id ? null : (item.id as any)
                            );
                          }
                        }}
                        isActive={isActive}
                        tooltip={item.labelEn}
                        className={`w-full relative overflow-hidden rounded-xl h-11 transition-all duration-200 ${isCollapsed ? "justify-center px-0" : ""}`}
                        style={
                          isActive
                            ? {
                                background: `linear-gradient(135deg, ${accent}40, ${accentSecondary}30)`,
                                color: isDark ? "#ECCEB6" : "#2B1D1C",
                                borderLeft: `3px solid ${accent}`,
                                boxShadow: `0 0 20px ${accent}40, inset 0 1px 0 rgba(255,255,255,0.1)`,
                              }
                            : {
                                color: isDark
                                  ? "rgba(236,206,182,0.6)"
                                  : "rgba(43,29,28,0.6)",
                                borderLeft: "3px solid transparent",
                              }
                        }
                      >
                        {isActive && (
                          <motion.div
                            layoutId={"navGlow-" + item.id}
                            className="absolute inset-0 rounded-xl"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            style={{
                              background: `linear-gradient(135deg, ${accent}25, ${accentSecondary}20)`,
                              pointerEvents: "none",
                            }}
                            transition={{
                              type: "spring",
                              bounce: 0.2,
                              duration: 0.5,
                            }}
                          />
                        )}
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          transition={{
                            duration: 0.2,
                            ease: [0.34, 1.56, 0.64, 1],
                          }}
                        >
                          <Icon
                            className={`h-5 w-5 flex-shrink-0 relative z-10 ${isCollapsed ? "" : "mr-2"}`}
                          />
                        </motion.div>
                        {!isCollapsed && (
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="font-semibold text-[13px] truncate relative z-10"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </SidebarMenuButton>
                    </motion.div>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

function MobileBottomNavigation({
  mainTab,
  setMainTab,
  currentSecondaryTab,
  onTabChange,
  isDark = true,
}: {
  mainTab: "tts" | "video" | "dubbing";
  setMainTab: (tab: "tts" | "video" | "dubbing") => void;
  currentSecondaryTab: string | null;
  onTabChange: (tab: any) => void;
  isDark?: boolean;
}) {
  const [moreOpen, setMoreOpen] = React.useState(false);

  const mainNavItems = [
    { id: "dubbing" as const, icon: Wand2, label: "Auto" },
    { id: "video" as const, icon: FileVideo, label: "Video" },
    { id: "tts" as const, icon: Mic, label: "TTS" },
  ];
  const secondaryItems = [
    { id: "history", icon: History, label: "History" },
    { id: "plan", icon: Star, label: "Plan" },
    { id: "files", icon: FolderOpen, label: "Library" },
    { id: "guide", icon: BookOpen, label: "Guide" },
    { id: "settings", icon: Settings, label: "Settings" },
  ];

  const isSecondaryActive = secondaryItems.some(s => s.id === currentSecondaryTab);

  return (
    <>
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-[60] border-t backdrop-blur-2xl"
        style={{
          background: isDark ? "rgba(15,15,15,0.85)" : "rgba(255,255,255,0.85)",
          borderColor: isDark ? "rgba(192,111,48,0.2)" : "rgba(192,111,48,0.1)",
          boxShadow: isDark
            ? "0 -10px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)"
            : "0 -10px 40px rgba(192,111,48,0.1), inset 0 1px 0 rgba(255,255,255,0.5)",
        }}
      >
        <div className="flex items-center justify-around py-3 px-4 gap-2">
          {mainNavItems.map(({ id, icon: Icon, label }) => {
            const isActive = mainTab === id && !currentSecondaryTab;
            return (
              <motion.button
                key={id}
                onClick={() => {
                  setMainTab(id);
                  onTabChange(null);
                  setMoreOpen(false);
                }}
                whileTap={{ scale: 0.9 }}
                className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl min-h-[44px] relative flex-1 transition-all duration-200"
                style={{
                  color: isActive
                    ? "#C06F30"
                    : isDark
                      ? "rgba(255,255,255,0.4)"
                      : "rgba(0,0,0,0.4)",
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobileMainTab"
                    className="absolute inset-0 rounded-xl"
                    style={{
                      background: "linear-gradient(135deg, rgba(192,111,48,0.15), rgba(244,179,79,0.1))",
                      boxShadow: "0 0 15px #C06F3020"
                    }}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <Icon className="w-5 h-5 relative z-10" />
                <span className="text-[10px] font-bold relative z-10">{label}</span>
              </motion.button>
            );
          })}
          {/* More menu button */}
          <motion.button
            onClick={() => setMoreOpen(!moreOpen)}
            whileTap={{ scale: 0.9 }}
            className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl min-h-[44px] relative flex-1 transition-all duration-200"
            style={{
              color: isSecondaryActive || moreOpen
                ? "#C06F30"
                : isDark
                  ? "rgba(255,255,255,0.4)"
                  : "rgba(0,0,0,0.4)",
            }}
          >
            {(isSecondaryActive || moreOpen) && (
              <motion.div
                layoutId="mobileMoreTab"
                className="absolute inset-0 rounded-xl"
                style={{ background: "rgba(192,111,48,0.15)" }}
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
            <svg className="w-5 h-5 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              {moreOpen ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
            <span className="text-[10px] font-bold relative z-10">{moreOpen ? "Close" : "More"}</span>
          </motion.button>
        </div>
      </div>

      {/* More menu sheet */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="md:hidden fixed bottom-[72px] left-2 right-2 z-[55] rounded-2xl border p-3 shadow-2xl"
            style={{
              background: isDark ? "rgba(25,25,25,0.95)" : "rgba(255,255,255,0.95)",
              borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(192,111,48,0.1)",
            }}
          >
            <div className="grid grid-cols-3 gap-2">
              {secondaryItems.map(({ id, icon: Icon, label }) => {
                const isActive = currentSecondaryTab === id;
                return (
                  <motion.button
                    key={id}
                    onClick={() => {
                      onTabChange(isActive ? null : id);
                      setMoreOpen(false);
                    }}
                    whileTap={{ scale: 0.95 }}
                    className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all"
                    style={{
                      background: isActive ? "rgba(192,111,48,0.15)" : "transparent",
                      color: isActive ? "#C06F30" : isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)",
                    }}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[11px] font-semibold">{label}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
