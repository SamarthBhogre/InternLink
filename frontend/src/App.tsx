import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { StudentDashboard } from "@/components/dashboards/StudentDashboard";
import { CompanyDashboard } from "@/components/dashboards/CompanyDashboard";
import { AdminDashboard } from "@/components/dashboards/AdminDashboard";

const queryClient = new QueryClient();

function RoutesWithAuth() {
  const navigate = useNavigate();

  const getStoredUser = () => {
    try {
      const raw = localStorage.getItem("internlink_user");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  };

  const user = getStoredUser();

  const handleLogout = () => {
    try { localStorage.removeItem("internlink_user"); } catch (e) {}
    navigate("/");
  };

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route
        path="/student-dashboard"
        element={
          user && user.userType === "student" ? (
            <StudentDashboard user={user} onLogout={handleLogout} />
          ) : (
            <Index />
          )
        }
      />
      <Route
        path="/company-dashboard"
        element={
          user && user.userType === "company" ? (
            <CompanyDashboard user={user} onLogout={handleLogout} />
          ) : (
            <Index />
          )
        }
      />
      <Route
        path="/admin-dashboard"
        element={
          user && user.userType === "admin" ? (
            <AdminDashboard user={user} onLogout={handleLogout} />
          ) : (
            <Index />
          )
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RoutesWithAuth />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
