import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/services/api"
import { AuthBypass } from "./auth-bypass"

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
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
      if (requireAdmin) {
        try {
          const token = api.getToken();
          if (token) {
            const res = await fetch('http://localhost:8081/api/auth/profile', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const data = await res.json();
              currentUser = data.user || data;
              setUser(currentUser);
              localStorage.setItem('user', JSON.stringify(currentUser));
            }
          }
        } catch {}
        if (!currentUser || currentUser.role !== 'admin') {
          navigate('/app');
          return;
        }
      } else {
        // For normal users, ensure user is not admin
        if (currentUser && currentUser.role === 'admin') {
          navigate('/admin');
          return;
        }
      }
      setUser(currentUser);
      setLoading(false);
    };
    checkAuth();
  }, [navigate, requireAdmin]);

  if (loading) return null;
  if (!api.isAuthenticated()) return null;
  if (requireAdmin && (!user || user.role !== 'admin')) return null;
  if (!requireAdmin && user && user.role === 'admin') return null;
  return <>{children}</>;
}
