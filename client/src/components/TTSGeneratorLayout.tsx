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
import { History, Star, BookOpen, Settings, PanelLeft, Mic, FileVideo, Wand2 } from "lucide-react";
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
    { id: "plan", label: "Plan", labelEn: "Plan", icon: Star },
    { id: "guide", label: "လမ်းညွှန်", labelEn: "Guide", icon: BookOpen },
    { id: "settings", label: "ဆက်တင်", labelEn: "Settings", icon: Settings },
  ];

  return (
    <>
      {/* External Logo - shows when sidebar is collapsed */}
      {isCollapsed && (
        <div
          className="fixed top-4 left-4 z-50 flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300"
          style={{
            background: "linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(79, 70, 229, 0.1))",
            border: "1px solid rgba(139, 92, 246, 0.3)",
            backdropFilter: "blur(10px)",
            animation: "fadeIn 0.3s ease-out"
          }}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(79, 70, 229, 0.2))", border: "1px solid rgba(139, 92, 246, 0.3)" }}>
            <span className="text-lg font-black" style={{ color: "#a78bfa" }}>L</span>
          </div>
          <span className="text-sm font-black uppercase tracking-wider" style={{ color: "#a78bfa" }}>LUMIX</span>
        </div>
      )}

      <Sidebar collapsible="icon" className="bg-transparent">
        <SidebarHeader
          className="border-b bg-transparent"
          style={{ borderColor: "rgba(139, 92, 246, 0.2)" }}
        >
          {/* Logo inside sidebar - shows when expanded */}
          {!isCollapsed && (
            <div className="px-3 py-4 mb-2">
              <div className="flex items-center gap-2 transition-all duration-300" style={{ animation: "slideIn 0.3s ease-out" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(79, 70, 229, 0.2))", border: "1px solid rgba(139, 92, 246, 0.3)" }}>
                  <span className="text-lg font-black" style={{ color: "#a78bfa" }}>L</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-black uppercase tracking-wider" style={{ color: "#a78bfa" }}>LUMIX</span>
                </div>
              </div>
            </div>
          )}

          {/* Toggle button always visible */}
          <div className="flex items-center justify-end px-3 py-2">
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
    </>
  );
}
