import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import CycleSetup from "./pages/CycleSetup";
import TrainingLog from "./pages/TrainingLog";
import SorenessLog from "./pages/SorenessLog";
import PlanView from "./pages/PlanView";
import RiskReport from "./pages/RiskReport";
import CoachDashboard from "./pages/CoachDashboard";
import CoachEscalations from "./pages/coach/CoachEscalations";
import CoachAnalytics from "./pages/coach/CoachAnalytics";
import CoachPlans from "./pages/coach/CoachPlans";
import CoachReports from "./pages/coach/CoachReports";
import CoachSettings from "./pages/coach/CoachSettings";
import TrainingHistory from "./pages/TrainingHistory";
import NotFound from "./pages/NotFound";
import { ReactNode } from "react";

const queryClient = new QueryClient();

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AthleteRoute({ children }: { children: ReactNode }) {
  const { user, loading, profile } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/auth?mode=login" replace />;
  if (!profile) return <LoadingSpinner />;
  if (profile.role !== 'athlete') return <Navigate to="/coach" replace />;
  return <>{children}</>;
}

function CoachRoute({ children }: { children: ReactNode }) {
  const { user, loading, profile } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/auth?mode=login" replace />;
  if (!profile) return <LoadingSpinner />;
  if (profile.role !== 'coach') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading, profile } = useAuth();
  if (loading) return null;
  if (user) {
    if (profile?.role === 'coach') return <Navigate to="/coach" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<PublicRoute><Home /></PublicRoute>} />
              <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
              {/* Athlete routes */}
              <Route path="/dashboard" element={<AthleteRoute><Dashboard /></AthleteRoute>} />
              <Route path="/cycle-setup" element={<AthleteRoute><CycleSetup /></AthleteRoute>} />
              <Route path="/training-log" element={<Navigate to="/plan" replace />} />
              <Route path="/training-history" element={<Navigate to="/plan" replace />} />
              <Route path="/soreness-log" element={<Navigate to="/plan" replace />} />
              <Route path="/plan" element={<AthleteRoute><PlanView /></AthleteRoute>} />
              <Route path="/risk-report" element={<AthleteRoute><RiskReport /></AthleteRoute>} />
              {/* Coach routes */}
              <Route path="/coach" element={<CoachRoute><CoachDashboard /></CoachRoute>} />
              <Route path="/coach/escalations" element={<CoachRoute><CoachEscalations /></CoachRoute>} />
              <Route path="/coach/analytics" element={<CoachRoute><CoachAnalytics /></CoachRoute>} />
              <Route path="/coach/plans" element={<CoachRoute><CoachPlans /></CoachRoute>} />
              <Route path="/coach/reports" element={<CoachRoute><CoachReports /></CoachRoute>} />
              <Route path="/coach/settings" element={<CoachRoute><CoachSettings /></CoachRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
