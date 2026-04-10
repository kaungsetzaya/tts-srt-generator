import { ReactNode } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
import { History, Crown, BookOpen, Settings, LogOut, PanelLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { CompactUsageDisplay } from "./CompactUsageDisplay";

interface TTSGeneratorLayoutProps {
  children: ReactNode;
  currentSecondaryTab: string | null;
  onTabChange: (tab: string | null) => void;
  backgroundStyle?: React.CSSProperties;
}

export function TTSGeneratorLayout({ children, currentSecondaryTab, onTabChange, backgroundStyle }: TTSGeneratorLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full" style={backgroundStyle}>
        <TTSGeneratorSidebar
          currentTab={currentSecondaryTab}
          onTabChange={onTabChange}
        />
        <SidebarInset className="bg-transparent border-none">
          <header className="flex h-14 shrink-0 items-center gap-2 px-4 border-b">
            <div className="text-sm font-semibold opacity-60">LUMIX TTS Generator</div>
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
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
  const queryClient = useQueryClient();
  const { data: me } = trpc.auth.me.useQuery();
  const { data: subStatus } = trpc.subscription.myStatus.useQuery();
  const sidebar = useSidebar();
  const isCollapsed = !sidebar.open;

  const handleLogout = async () => {
    await queryClient.invalidateQueries({ queryKey: [] });
    window.location.href = "/login";
  };

  const menuItems = [
    { id: "history", label: "မှတ်တမ်း", labelEn: "History", icon: History },
    { id: "plan", label: "Plan", labelEn: "Plan", icon: Crown },
    { id: "guide", label: "လမ်းညွှန်", labelEn: "Guide", icon: BookOpen },
    { id: "settings", label: "ဆက်တင်", labelEn: "Settings", icon: Settings },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-purple-500/20">
        <div className="flex items-center gap-2 px-2 py-4">
          <div className="flex-1">
            <h2 className="text-lg font-black uppercase tracking-wider text-purple-400">LUMIX</h2>
            {me && !isCollapsed && (
              <p className="text-xs opacity-60 mt-0.5">{me.name}</p>
            )}
          </div>
          {!isCollapsed && (
            <SidebarTrigger className="-mr-1">
              <PanelLeft className="h-4 w-4" />
            </SidebarTrigger>
          )}
        </div>

        {/* Usage Display */}
        <CompactUsageDisplay subStatus={subStatus} isCollapsed={isCollapsed} />
      </SidebarHeader>

      <SidebarContent>
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

      <SidebarFooter className="border-t border-purple-500/20">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
