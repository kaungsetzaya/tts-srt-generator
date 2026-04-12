import { ReactNode } from "react";
import React from "react";
import { motion } from "framer-motion";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { History, BookOpen, Settings, PanelLeft, Mic, FileVideo, Wand2 } from "lucide-react";

interface TTSGeneratorLayoutProps {
  children: ReactNode;
  currentSecondaryTab: string | null;
  onTabChange: (tab: "history" | "plan" | "guide" | "settings" | null) => void;
  backgroundStyle?: React.CSSProperties;
  mainTab: "tts" | "video" | "dubbing";
  setMainTab: (tab: "tts" | "video" | "dubbing") => void;
  logoUrl?: string;
  miniLogoUrl?: string;
}

export function TTSGeneratorLayout({
  children,
  currentSecondaryTab,
  onTabChange,
  backgroundStyle,
  mainTab,
  setMainTab,
  logoUrl,
  miniLogoUrl,
}: TTSGeneratorLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full" style={backgroundStyle}>
        <TTSGeneratorSidebar
          currentTab={currentSecondaryTab}
          onTabChange={onTabChange}
          mainTab={mainTab}
          setMainTab={setMainTab}
          logoUrl={logoUrl}
          miniLogoUrl={miniLogoUrl}
        />
        <SidebarInset className="bg-transparent border-none">
          <main className="flex-1 overflow-auto pb-16 md:pb-0">
            {children}
          </main>
          <MobileBottomNavigation
            mainTab={mainTab}
            setMainTab={setMainTab}
            currentSecondaryTab={currentSecondaryTab}
            onTabChange={onTabChange}
          />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

interface TTSGeneratorSidebarProps {
  currentTab: string | null;
  onTabChange: (tab: "history" | "plan" | "guide" | "settings" | null) => void;
  mainTab: "tts" | "video" | "dubbing";
  setMainTab: (tab: "tts" | "video" | "dubbing") => void;
  logoUrl?: string;
  miniLogoUrl?: string;
}

function TTSGeneratorSidebar({
  currentTab,
  onTabChange,
  mainTab,
  setMainTab,
  logoUrl,
  miniLogoUrl,
}: TTSGeneratorSidebarProps) {
  const sidebar = useSidebar();
  const isCollapsed = !sidebar.open;

  const accent = "#C06F30";
  const accentSecondary = "#F4B34F";

  const allMenuItems = [
    { id: "tts",      label: "စာမှအသံ",         labelEn: "Text to Speech",   icon: Mic,      type: "main" as const },
    { id: "video",    label: "ဗီဒီယိုဘာသာပြန်", labelEn: "Video Translation", icon: FileVideo, type: "main" as const },
    { id: "dubbing",  label: "AI Video",          labelEn: "AI Video",          icon: Wand2,     type: "main" as const },
    { id: "history",  label: "မှတ်တမ်း",          labelEn: "History",           icon: History,  type: "secondary" as const },
    { id: "guide",    label: "လမ်းညွှန်",         labelEn: "Guide",             icon: BookOpen, type: "secondary" as const },
    { id: "settings", label: "ဆက်တင်",            labelEn: "Settings",          icon: Settings, type: "secondary" as const },
  ];

  // Fix: only one item can be active at a time
  // If a secondary tab is open, no main tab is highlighted, and vice versa
  const getIsActive = (item: typeof allMenuItems[0]) => {
    if (item.type === "secondary") {
      return currentTab === item.id;
    }
    // main tab is only active when NO secondary tab is open
    return currentTab === null && mainTab === item.id;
  };

  return (
    <Sidebar
      collapsible="icon"
      className="border-r transition-all duration-300 ease-out"
      style={{ borderColor: "rgba(139,92,246,0.15)", background: "rgba(9,7,28,0.98)" }}
    >
      <SidebarHeader
        className="border-b px-3 py-3 transition-all duration-300 ease-out"
        style={{ borderColor: "rgba(139,92,246,0.15)" }}
      >
        <div className="flex items-center justify-between gap-2 w-full">
          {/* Logo - only shown inside sidebar, hidden outside */}
          {isCollapsed ? (
            <motion.div
              key="mini-logo"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0"
              style={{ background: "rgba(192,111,48,0.15)", border: "1px solid rgba(192,111,48,0.3)" }}
            >
              {miniLogoUrl ? (
                <img src={miniLogoUrl} alt="Logo" className="w-5 h-5 object-contain" />
              ) : (
                <span className="text-[10px] font-black" style={{ color: "#C06F30" }}>L</span>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="full-logo"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex-1 min-w-0"
            >
              {logoUrl ? (
                <img src={logoUrl} alt="LUMIX" className="h-7 w-auto object-contain" />
              ) : (
                <span
                  className="text-xl font-black tracking-widest"
                  style={{
                    background: "linear-gradient(135deg, #C06F30, #F4B34F)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    letterSpacing: "0.15em",
                  }}
                >
                  LUMIX
                </span>
              )}
            </motion.div>
          )}

          <SidebarTrigger
            className="flex items-center justify-center rounded-xl transition-all duration-200 hover:scale-110 flex-shrink-0"
            style={{ width: 36, height: 36, background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.25)", color: "#C06F30" }}
          >
            <PanelLeft className="h-4 w-4" />
          </SidebarTrigger>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-transparent px-2 py-3 overflow-y-auto">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1.5">
              {allMenuItems.map((item) => {
                const isActive = getIsActive(item);
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.id}>
                    <motion.div whileHover={{ x: isCollapsed ? 0 : 3 }} whileTap={{ scale: 0.97 }} transition={{ duration: 0.15 }}>
                      <SidebarMenuButton
                        onClick={() => {
                          if (item.type === "main") {
                            setMainTab(item.id as "tts" | "video" | "dubbing");
                            onTabChange(null); // clear secondary tab
                          } else {
                            // toggle secondary: clicking active secondary closes it
                            onTabChange(currentTab === item.id ? null : item.id as any);
                          }
                        }}
                        isActive={isActive}
                        tooltip={item.labelEn}
                        className="w-full relative overflow-hidden rounded-xl h-11 transition-all duration-200"
                        style={
                          isActive
                            ? { background: `linear-gradient(135deg, ${accent}40, ${accentSecondary}30)`, color: "#ECCEB6", borderLeft: `3px solid ${accent}`, boxShadow: `0 0 16px ${accent}33` }
                            : { color: "rgba(167,139,250,0.6)", borderLeft: "3px solid transparent" }
                        }
                      >
                        {isActive && (
                          <motion.div
                            layoutId={"navGlow-" + item.id}
                            className="absolute inset-0 rounded-xl"
                            style={{ background: `linear-gradient(135deg, ${accent}20, ${accentSecondary}15)`, pointerEvents: "none" }}
                            transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                          />
                        )}
                        <Icon className="h-4 w-4 flex-shrink-0 relative z-10" />
                        <span className="font-semibold text-[13px] truncate relative z-10">{item.label}</span>
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
}: {
  mainTab: "tts" | "video" | "dubbing";
  setMainTab: (tab: "tts" | "video" | "dubbing") => void;
  currentSecondaryTab: string | null;
  onTabChange: (tab: any) => void;
}) {
  const mainNavItems = [
    { id: "tts" as const,     icon: Mic,       label: "TTS" },
    { id: "video" as const,   icon: FileVideo,  label: "Video" },
    { id: "dubbing" as const, icon: Wand2,      label: "AI Video" },
  ];
  const secondaryItems = [
    { id: "history",  icon: History,  label: "History" },
    { id: "settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-xl"
      style={{ background: "rgba(9, 7, 28, 0.97)", borderColor: "rgba(139, 92, 246, 0.25)", boxShadow: "0 -4px 30px rgba(109, 40, 217, 0.15)" }}
    >
      <div className="flex items-center justify-around py-2 px-2 gap-1">
        {mainNavItems.map(({ id, icon: Icon, label }) => {
          const isActive = mainTab === id && !currentSecondaryTab;
          return (
            <motion.button
              key={id}
              onClick={() => { setMainTab(id); onTabChange(null); }}
              whileTap={{ scale: 0.9 }}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl min-h-[44px] relative flex-1 transition-all duration-200"
              style={{ color: isActive ? "#C06F30" : "rgba(255,255,255,0.4)" }}
            >
              {isActive && (
                <motion.div layoutId="mobileMainTab" className="absolute inset-0 rounded-xl"
                  style={{ background: "rgba(139, 92, 246, 0.15)" }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
              <Icon className="w-5 h-5 relative z-10" />
              <span className="text-[10px] font-bold relative z-10 truncate">{label}</span>
            </motion.button>
          );
        })}
        {secondaryItems.map(({ id, icon: Icon, label }) => {
          const isActive = currentSecondaryTab === id;
          return (
            <motion.button
              key={id}
              onClick={() => onTabChange(isActive ? null : id)}
              whileTap={{ scale: 0.9 }}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl min-h-[44px] relative flex-1 transition-all duration-200"
              style={{ color: isActive ? "#C06F30" : "rgba(255,255,255,0.4)" }}
            >
              {isActive && (
                <motion.div layoutId={"mobileTab-" + id} className="absolute inset-0 rounded-xl"
                  style={{ background: "rgba(139, 92, 246, 0.15)" }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
              <Icon className="w-5 h-5 relative z-10" />
              <span className="text-[10px] font-bold relative z-10 truncate">{label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
