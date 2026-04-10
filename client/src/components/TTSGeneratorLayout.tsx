import { ReactNode, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { History, Crown, BookOpen, Settings, LogOut, Menu } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { CompactUsageDisplay } from "./CompactUsageDisplay";

interface TTSGeneratorLayoutProps {
  children: ReactNode;
  currentSecondaryTab: string;
  onTabChange: (tab: string) => void;
}

export function TTSGeneratorLayout({ children, currentSecondaryTab, onTabChange }: TTSGeneratorLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <SidebarProvider>
      <TTSGeneratorSidebar
        currentTab={currentSecondaryTab}
        onTabChange={onTabChange}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />
      <div className="flex min-h-screen w-full">
        <Sidebar className="border-r border-purple-500/20" />
        <main className="flex-1 overflow-auto">
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger className="md:hidden">
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
          </div>
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}

interface TTSGeneratorSidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
}

function TTSGeneratorSidebar({ currentTab, onTabChange }: TTSGeneratorSidebarProps) {
  const queryClient = useQueryClient();
  const { data: me } = trpc.auth.me.useQuery();
  const { data: subStatus } = trpc.subscription.myStatus.useQuery();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const handleLogout = async () => {
    await queryClient.invalidateQueries(["auth.me"]);
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
              <p className="text-xs opacity-60 mt-0.5">{me.telegramFirstName}</p>
            )}
          </div>
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
