import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import TTSGenerator from "./pages/TTSGenerator";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import VideoTranslator from "./pages/VideoTranslator";
import AuthGuard from "./components/AuthGuard";

function Router() {
  return (
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
      <Route path={"/video"}>
        {() => { window.location.href = '/lumix'; return null; }}
      </Route>
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
