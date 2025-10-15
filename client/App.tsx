import "./global.css";
import React, { useState, useEffect } from "react";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { Layout } from "@/components/layout";
import { AdminLayout } from "@/components/admin-layout";
import { Chatbot } from "@/components/chatbot";
import { api } from "./services/api";
import Index from "./pages/Index";
import PublicLanding from "./pages/PublicLanding";
import AdminDashboard from "./pages/AdminDashboard";
import ApprovedApplications from "./pages/admin/ApprovedApplications";
import PendingApplications from "./pages/admin/PendingApplications";
import RejectedApplications from "./pages/admin/RejectedApplications";
import Announcements from "./pages/admin/Announcements";
import CreateEvent from "./pages/admin/CreateEvent";
import ViewEvent from "./pages/admin/ViewEvent";
import EditEvent from "./pages/admin/EditEvent";
import AdminRequests from "./pages/admin/AdminRequests";
import SuperAdmin from "./pages/admin/SuperAdmin";
import SuperAdminTest from "./pages/admin/SuperAdminTest";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import Projects from "./pages/Projects";
import Events from "./pages/Events";
import Community from "./pages/Community";
import Requests from "./pages/Requests";

const queryClient = new QueryClient();

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireSuperAdmin?: boolean;
}

function AuthRedirectHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const userStr = params.get('user');
    const verify = params.get('verify');
    if (token && userStr) {
      try {
        localStorage.setItem('auth_token', token);
        // The backend sends user as encodeURIComponent(JSON.stringify(user))
        const decoded = decodeURIComponent(userStr);
        const user = JSON.parse(decoded);
        localStorage.setItem('user', JSON.stringify(user));
        // Persist chat namespace candidates and notify listeners
        try { api.persistChatNamespaceCandidates(user); } catch {}
        try { localStorage.setItem('last_auth_change', String(Date.now())); } catch {}
        try { window.dispatchEvent(new Event('auth:changed')); } catch {}
        const normRole = (role?: string) => String(role || '').toLowerCase().replace(/[^a-z]/g, '');
        // Clean URL (remove token/user params)
        const cleanUrl = location.pathname + (location.hash || '');
        window.history.replaceState({}, '', cleanUrl);
        if (normRole(user?.role) === 'superadmin') {
          navigate('/superadmin', { replace: true });
        } else if (['admin','superadmin'].includes(normRole(user?.role))) {
          navigate('/admin', { replace: true });
        } else {
          navigate('/app', { replace: true });
        }
      } catch {}
    }
    // Handle verification connect flow (e.g., GitHub connect during application)
    else if (verify === 'github_connected') {
      // Refresh profile to pull latest githubStats into localStorage
      (async () => {
        try {
          const profile = await api.getProfile();
          if (profile?.user) {
            localStorage.setItem('user', JSON.stringify(profile.user));
            try { api.persistChatNamespaceCandidates(profile.user); } catch {}
            try { localStorage.setItem('last_auth_change', String(Date.now())); } catch {}
            try { window.dispatchEvent(new Event('auth:changed')); } catch {}
          }
        } catch {}
        // Navigate to /app to ensure state is fresh and show success toast
        toast.success('GitHub connected successfully for verification');
        navigate('/app', { replace: true });
      })();
    }
    else if (verify === 'application_submitted') {
      // Application was created during GitHub OAuth callback
      (async () => {
        try {
          const profile = await api.getProfile();
          if (profile?.user) {
            localStorage.setItem('user', JSON.stringify(profile.user));
            try { api.persistChatNamespaceCandidates(profile.user); } catch {}
            try { localStorage.setItem('last_auth_change', String(Date.now())); } catch {}
            try { window.dispatchEvent(new Event('auth:changed')); } catch {}
          }
        } catch {}
        toast.success('Your application was submitted and is pending admin review');
        navigate('/app', { replace: true });
      })();
    }
  }, [location, navigate]);
  return null;
}

// Render chatbot only on the user's dashboard route
function ChatbotGate() {
  const location = useLocation();
  if (location.pathname === '/app') return <Chatbot />;
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="innovation-portal-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthRedirectHandler />
          {/* Chatbot hidden on landing page for a cleaner, more professional first impression */}
          <ChatbotGate />
          <Routes>
            {/* Public landing page */}
            <Route path="/" element={<PublicLanding />} />

            {/* Test route for super admin (public access for demo) */}
            <Route path="/super-admin-demo" element={<SuperAdminTest />} />

            {/* Super Admin route without AdminLayout (clean standalone) */}
            <Route path="/superadmin" element={
              <ProtectedRoute requireSuperAdmin>
                <SuperAdminTest />
              </ProtectedRoute>
            } />

            {/* Auth routes without layout */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Admin routes */}
            <Route path="/admin" element={
              <ProtectedRoute requireAdmin>
                <AdminLayout>
                  <AdminDashboard />
                </AdminLayout>
              </ProtectedRoute>
            } />
            {/* Removed /admin/super route to prevent superadmin content under admin layout */}
            <Route path="/admin/applications" element={
              <ProtectedRoute requireAdmin>
                <AdminLayout>
                  <ApprovedApplications />
                </AdminLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/rejected" element={
              <ProtectedRoute requireAdmin>
                <AdminLayout>
                  <RejectedApplications />
                </AdminLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/announcements" element={
              <ProtectedRoute requireAdmin>
                <AdminLayout>
                  <Announcements />
                </AdminLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/create-event" element={
              <ProtectedRoute requireAdmin>
                <AdminLayout>
                  <CreateEvent />
                </AdminLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/events/:eventId/view" element={
              <ProtectedRoute requireAdmin>
                <AdminLayout>
                  <ViewEvent />
                </AdminLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/events/:eventId/edit" element={
              <ProtectedRoute requireAdmin>
                <AdminLayout>
                  <EditEvent />
                </AdminLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/pending" element={
              <ProtectedRoute requireAdmin>
                <AdminLayout>
                  <PendingApplications />
                </AdminLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/requests" element={
              <ProtectedRoute requireAdmin>
                <AdminLayout>
                  <AdminRequests />
                </AdminLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/rejected" element={
              <ProtectedRoute requireAdmin>
                <AdminLayout>
                  <RejectedApplications />
                </AdminLayout>
              </ProtectedRoute>
            } />

            {/* Main app routes with layout */}
            <Route path="/app" element={
                <Layout>
                  <Index />
                </Layout>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <Layout>
                  <Profile />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/projects" element={
              <Layout>
                <Projects />
              </Layout>
            } />
            <Route path="/innovators" element={
              <Layout>
                <Community />
              </Layout>
            } />
            <Route path="/requests" element={
              <ProtectedRoute>
                <Layout>
                  <Requests />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/events" element={
              <Layout>
                <Events />
              </Layout>
            } />
            <Route path="/messages" element={
              <Layout>
                <NotFound />
              </Layout>
            } />
            <Route path="/certifications" element={
              <Layout>
                <NotFound />
              </Layout>
            } />
            <Route path="/settings" element={
              <Layout>
                <NotFound />
              </Layout>
            } />

            {/* Catch-all route */}
            <Route path="*" element={
              <Layout>
                <NotFound />
              </Layout>
            } />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

export function ProtectedRoute({ children, requireAdmin = false, requireSuperAdmin = false }: ProtectedRouteProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      if (!api.isAuthenticated()) {
        navigate('/login');
        return;
      }
      let currentUser = api.getCurrentUser();

      if (requireAdmin || requireSuperAdmin) {
        try {
          const token = api.getToken();
          if (token) {
            const res = await fetch('/api/auth/profile', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const data = await res.json();
              currentUser = data.user || data;
              setUser(currentUser);
              localStorage.setItem('user', JSON.stringify(currentUser));
              try { api.persistChatNamespaceCandidates(currentUser); } catch {}
              try { localStorage.setItem('last_auth_change', String(Date.now())); } catch {}
              try { window.dispatchEvent(new Event('auth:changed')); } catch {}
            }
          }
        } catch {}

        if (requireSuperAdmin) {
          if (!currentUser || currentUser.role !== 'superadmin') {
            navigate('/app');
            return;
          }
        } else if (requireAdmin) {
          if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
            navigate('/app');
            return;
          }
        }
      }
      setUser(currentUser);
      setLoading(false);
    };
    checkAuth();
  }, [navigate, requireAdmin, requireSuperAdmin]);

  if (loading) return null;
  if (!api.isAuthenticated()) return null;
  if (requireSuperAdmin && (!user || user.role !== 'superadmin')) return null;
  if (requireAdmin && (!user || (user.role !== 'admin' && user.role !== 'superadmin'))) return null;
  return <>{children}</>;
}
