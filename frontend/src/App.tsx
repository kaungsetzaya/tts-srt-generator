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

function Router() {
  const [location] = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location}
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
      >
      <Switch>
        <Route path={"/"} component={Landing} />
        <Route path={"/login"} component={Login} />
      <Route path={"/lumix"}>
        <AuthGuard>
          <TTSGenerator />
        </AuthGuard>
      </Route>
      <Route path={"/admin"}>
        <AuthGuard>
          <AdminDashboard />
        </AuthGuard>
      </Route>
      <Route path={"/history"}>
        <AuthGuard>
          <History />
        </AuthGuard>
      </Route>
      <Route path={"/trial-info"}>
        <AuthGuard>
          <TrialInfo />
        </AuthGuard>
      </Route>
      <Route path={"/plans"} component={Plans} />
      <Route path={"/video"}>
        <AuthGuard>
          <VideoTranslator />
        </AuthGuard>
      </Route>
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
    </motion.div>
    </AnimatePresence>
  );
}

function App() {
  const [location] = useLocation();
  const { data: settings, isLoading } = trpc.settings.get.useQuery();

  const isMaintenance = settings?.maintenanceModeEnabled === "true";
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
          {isMaintenance && !isSafeRoute ? (
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
