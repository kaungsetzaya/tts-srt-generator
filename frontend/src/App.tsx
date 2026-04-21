import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import TTSGenerator from "./pages/TTSGenerator";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import VideoTranslator from "./pages/VideoTranslator";
import History from "./pages/History";
import TrialInfo from "./pages/TrialInfo";
import Plans from "./pages/Plans";
import AuthGuard from "./components/AuthGuard";
import MaintenanceOverlay from "./components/MaintenanceOverlay";
import { trpc } from "./lib/trpc";
import { useAuth } from "./hooks/useAuth";

function App() {
  const [location] = useLocation();
  const { data: settings, isLoading } = trpc.settings.get.useQuery();
  const { user } = useAuth();

  const isMaintenance = settings?.maintenance_mode === "true";
  const isAdmin = user?.role === "admin";
  const isSafeRoute = location.startsWith("/admin") || location.startsWith("/login");

  // Prevent flash while checking maintenance status (unless it's a safe route)
  if (isLoading && !isSafeRoute) {
    return <div className="fixed inset-0 bg-background flex items-center justify-center"></div>;
  }

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable={true}>
        <TooltipProvider>
          <Toaster />
          {isMaintenance && !isSafeRoute && !isAdmin ? (
             <MaintenanceOverlay />
          ) : (
             <Router />
          )}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
