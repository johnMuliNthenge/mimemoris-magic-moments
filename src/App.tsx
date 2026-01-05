import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Memories from "./pages/Memories";
import MemoriesList from "./pages/MemoriesList";
import CollaborationsList from "./pages/CollaborationsList";
import CreateMemory from "./pages/CreateMemory";
import Collaborate from "./pages/Collaborate";
import Subscription from "./pages/Subscription";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import Social from "./pages/Social";
import UserProfile from "./pages/UserProfile";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/memories" element={<ProtectedRoute><Memories /></ProtectedRoute>} />
            <Route path="/memories/list" element={<ProtectedRoute><MemoriesList /></ProtectedRoute>} />
            <Route path="/memories/new" element={<ProtectedRoute><CreateMemory /></ProtectedRoute>} />
            <Route path="/collaborate" element={<ProtectedRoute><Collaborate /></ProtectedRoute>} />
            <Route path="/collaborations" element={<ProtectedRoute><CollaborationsList /></ProtectedRoute>} />
            <Route path="/social" element={<ProtectedRoute><Social /></ProtectedRoute>} />
            <Route path="/profile/:userId" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
            <Route path="/subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
