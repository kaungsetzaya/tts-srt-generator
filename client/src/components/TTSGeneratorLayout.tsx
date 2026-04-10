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
import { History, Crown, BookOpen, Settings, PanelLeft, Mic, FileVideo, Wand2, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { CompactUsageDisplay } from "./CompactUsageDisplay";

interface TTSGeneratorLayoutProps {
  children: ReactNode;
  currentSecondaryTab: string | null;
  onTabChange: (tab: "history" | "plan" | "guide" | "settings" | null) => void;
  backgroundStyle?: React.CSSProperties;
  mainTab: "tts" | "video" | "dubbing";
  setMainTab: (tab: "tts" | "video" | "dubbing") => void;
}

export function TTSGeneratorLayout({ children, currentSecondaryTab, onTabChange, backgroundStyle, mainTab, setMainTab }: TTSGeneratorLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full" style={backgroundStyle}>
        <TTSGeneratorSidebar
          currentTab={currentSecondaryTab}
          onTabChange={onTabChange}
        />
        <SidebarInset className="bg-transparent border-none">
          <main className="flex-1 overflow-auto pb-16 md:pb-0">
            {children}
          </main>

          {/* Mobile Bottom Navigation - Premium Design */}
          <div
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-xl"
            style={{
              background: "rgba(9, 7, 28, 0.97)",
              borderColor: "rgba(139, 92, 246, 0.25)",
              boxShadow: "0 -4px 30px rgba(109, 40, 217, 0.15)",
            }}
          >
            <div className="flex items-center justify-around py-1.5 px-2">
              {[
                { id: "tts" as const, icon: Mic, label: "TTS" },
                { id: "video" as const, icon: FileVideo, label: "Video" },
                { id: "dubbing" as const, icon: Wand2, label: "AI Video" },
              ].map(({ id, icon: Icon, label }) => {
                const isActive = mainTab === id && !currentSecondaryTab;
                return (
                  <motion.button
                    key={id}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      setMainTab(id);
                      onTabChange(null);
                    }}
                    className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all min-h-[44px] relative"
                    style={{
                      color: isActive ? "#a78bfa" : "rgba(255,255,255,0.4)",
                    }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="mobileActiveTab"
                        className="absolute inset-0 rounded-xl"
                        style={{ background: "rgba(139, 92, 246, 0.15)" }}
                        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                      />
                    )}
                    <Icon className="w-5 h-5 relative z-10" />
                    <span className="text-[10px] font-bold relative z-10">{label}</span>
                  </motion.button>
                );
              })}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => onTabChange(currentSecondaryTab === "settings" ? null : "settings")}
                className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all min-h-[44px] relative"
                style={{
                  color: currentSecondaryTab === "settings" ? "#a78bfa" : "rgba(255,255,255,0.4)",
                }}
              >
                {currentSecondaryTab === "settings" && (
                  <motion.div
                    layoutId="mobileActiveTab"
                    className="absolute inset-0 rounded-xl"
                    style={{ background: "rgba(139, 92, 246, 0.15)" }}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <Settings className="w-5 h-5 relative z-10" />
                <span className="text-[10px] font-bold relative z-10">ဆက်တင်</span>
              </motion.button>
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

interface TTSGeneratorSidebarProps {
  currentTab: string | null;
  onTabChange: (tab: "history" | "plan" | "guide" | "settings" | null) => void;
}

function TTSGeneratorSidebar({ currentTab, onTabChange }: TTSGeneratorSidebarProps) {
  const { data: me } = trpc.auth.me.useQuery();
  const { data: subStatus } = trpc.subscription.myStatus.useQuery();
  const sidebar = useSidebar();
  const isCollapsed = !sidebar.open;

  const menuItems: { id: "history" | "plan" | "guide" | "settings"; label: string; labelEn: string; icon: React.ElementType }[] = [
    { id: "history", label: "မှတ်တမ်း", labelEn: "History", icon: History },
    { id: "plan", label: "Plan", labelEn: "Plan", icon: Crown },
    { id: "guide", label: "လမ်းညွှန်", labelEn: "Guide", icon: BookOpen },
    { id: "settings", label: "ဆက်တင်", labelEn: "Settings", icon: Settings },
  ];

  return (
    <Sidebar collapsible="icon" className="bg-transparent">
      <SidebarHeader
        className="border-b bg-transparent"
        style={{ borderColor: "rgba(139, 92, 246, 0.2)" }}
      >
        <div className="flex items-center justify-between gap-2 px-2 py-3">
          {!isCollapsed ? (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2 min-w-0"
            >
              {/* Animated Logo Icon */}
              <motion.div
                animate={{
                  boxShadow: [
                    "0 0 8px rgba(139,92,246,0.4)",
                    "0 0 18px rgba(139,92,246,0.7)",
                    "0 0 8px rgba(139,92,246,0.4)",
                  ],
                }}
                transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                }}
              >
                <Zap className="w-3.5 h-3.5 text-white" />
              </motion.div>
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-purple-400 leading-none">
                  LUMIX
                </p>
                {me && (
                  <p className="text-[10px] opacity-50 truncate mt-0.5 leading-none" style={{ color: "#a78bfa" }}>
                    {me.name}
                  </p>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              animate={{
                boxShadow: [
                  "0 0 8px rgba(139,92,246,0.4)",
                  "0 0 18px rgba(139,92,246,0.7)",
                  "0 0 8px rgba(139,92,246,0.4)",
                ],
              }}
              transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
              className="w-7 h-7 rounded-lg flex items-center justify-center mx-auto"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              }}
            >
              <Zap className="w-3.5 h-3.5 text-white" />
            </motion.div>
          )}
          <SidebarTrigger
            className="flex-shrink-0 rounded-lg p-1.5 transition-colors"
            style={{ color: "rgba(167,139,250,0.7)" }}
          >
            <PanelLeft className="h-4 w-4" />
          </SidebarTrigger>
        </div>

        {/* Usage Display */}
        <CompactUsageDisplay subStatus={subStatus} isCollapsed={isCollapsed} />
      </SidebarHeader>

      <SidebarContent className="bg-transparent">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = currentTab === item.id;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => onTabChange(item.id)}
                      isActive={isActive}
                      tooltip={item.labelEn}
                      className="relative overflow-hidden transition-all duration-200"
                      style={
                        isActive
                          ? {
                              background: "linear-gradient(135deg, rgba(124,58,237,0.25), rgba(79,70,229,0.15))",
                              color: "#a78bfa",
                              borderLeft: "2px solid #7c3aed",
                            }
                          : {
                              color: "rgba(255,255,255,0.55)",
                            }
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="font-semibold">{item.label}</span>
                    </SidebarMenuButton>
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
