import { ReactNode } from "react";
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
import { History, Crown, BookOpen, Settings, PanelLeft, Mic, FileVideo, Wand2 } from "lucide-react";
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

          {/* Mobile Bottom Navigation - Main Tabs */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-lg" style={{ background: "rgba(15, 12, 41, 0.95)", borderColor: "rgba(139, 92, 246, 0.2)" }}>
            <div className="flex items-center justify-around py-2">
              <button
                onClick={() => {
                  setMainTab("tts");
                  onTabChange(null); // Clear secondary tab
                }}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all min-h-[44px] ${mainTab === "tts" && !currentSecondaryTab ? "text-purple-400" : "opacity-60"}`}
              >
                <Mic className="w-5 h-5" />
                <span className="text-[10px] font-bold">TTS</span>
              </button>
              <button
                onClick={() => {
                  setMainTab("video");
                  onTabChange(null); // Clear secondary tab
                }}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all min-h-[44px] ${mainTab === "video" && !currentSecondaryTab ? "text-purple-400" : "opacity-60"}`}
              >
                <FileVideo className="w-5 h-5" />
                <span className="text-[10px] font-bold">Video</span>
              </button>
              <button
                onClick={() => {
                  setMainTab("dubbing");
                  onTabChange(null); // Clear secondary tab
                }}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all min-h-[44px] ${mainTab === "dubbing" && !currentSecondaryTab ? "text-purple-400" : "opacity-60"}`}
              >
                <Wand2 className="w-5 h-5" />
                <span className="text-[10px] font-bold">AI Video</span>
              </button>
              <button
                onClick={() => onTabChange(currentSecondaryTab === "settings" ? null : "settings")}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all min-h-[44px] ${currentSecondaryTab === "settings" ? "text-purple-400" : "opacity-60"}`}
              >
                <Settings className="w-5 h-5" />
                <span className="text-[10px] font-bold">ဆက်တင်</span>
              </button>
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

interface TTSGeneratorSidebarProps {
  currentTab: string | null;
  onTabChange: (tab: string | null) => void;
}

function TTSGeneratorSidebar({ currentTab, onTabChange }: TTSGeneratorSidebarProps) {
  const { data: me } = trpc.auth.me.useQuery();
  const { data: subStatus } = trpc.subscription.myStatus.useQuery();
  const sidebar = useSidebar();
  const isCollapsed = !sidebar.open;

  const menuItems = [
    { id: "history", label: "မှတ်တမ်း", labelEn: "History", icon: History },
    { id: "plan", label: "Plan", labelEn: "Plan", icon: Crown },
    { id: "guide", label: "လမ်းညွှန်", labelEn: "Guide", icon: BookOpen },
    { id: "settings", label: "ဆက်တင်", labelEn: "Settings", icon: Settings },
  ];

  return (
    <Sidebar collapsible="icon" className="bg-transparent">
      <SidebarHeader className="border-b border-purple-500/20 bg-transparent">
        <div className="flex items-center justify-between gap-2 px-2 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black uppercase tracking-wider text-purple-400">LUMIX</h2>
            {me && !isCollapsed && (
              <p className="text-xs opacity-60">{me.name}</p>
            )}
          </div>
          <SidebarTrigger className="flex-shrink-0 hover:bg-purple-500/10 rounded p-1">
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
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => onTabChange(item.id)}
                    isActive={currentTab === item.id}
                    tooltip={item.labelEn}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
