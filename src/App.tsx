import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import NotFound from "./pages/NotFound";
import { ReactNode } from "react";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/auth?mode=login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<PublicRoute><Home /></PublicRoute>} />
            <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/cycle-setup" element={<ProtectedRoute><CycleSetup /></ProtectedRoute>} />
            <Route path="/training-log" element={<ProtectedRoute><TrainingLog /></ProtectedRoute>} />
            <Route path="/soreness-log" element={<ProtectedRoute><SorenessLog /></ProtectedRoute>} />
            <Route path="/plan" element={<ProtectedRoute><PlanView /></ProtectedRoute>} />
            <Route path="/risk-report" element={<ProtectedRoute><RiskReport /></ProtectedRoute>} />
            <Route path="/coach" element={<ProtectedRoute><CoachDashboard /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
