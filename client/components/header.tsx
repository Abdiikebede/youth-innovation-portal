import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "./theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Bell,
  User,
  Settings,
  LogOut,
  Award,
  MessageSquare,
  Edit3,
  Lightbulb,
} from "lucide-react";
import { api } from "@/services/api";
import { useSidebar } from "./layout";

export function Header() {
  const navigate = useNavigate();
  const { collapsed } = useSidebar();
  // Fetch notifications from backend
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Fetch notifications on mount with exponential backoff and visibility awareness
  React.useEffect(() => {
    function timeAgo(d: Date) {
      const diffMs = Date.now() - d.getTime();
      const mins = Math.max(0, Math.floor(diffMs / 60000));
      if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
      const days = Math.floor(hrs / 24);
      return `${days} day${days === 1 ? '' : 's'} ago`;
    }

    let cancelled = false;
    let backoffMs = 10000; // start at 10s
    const minMs = 10000, maxMs = 60000; // cap at 60s for faster refresh

    async function fetchNotifications() {
      setLoadingNotifications(true);
      try {
        const data = await api.getNotifications();
        let list = Array.isArray(data.notifications) ? data.notifications : [];
        // Normalize fields and default read to false if missing
        list = list.map((n: any) => ({
          id: n.id || n._id,
          _id: n._id,
          type: n.type,
          title: n.title,
          message: n.message || n.text || n.title || '',
          createdAt: n.createdAt || n.time || n.date || new Date().toISOString(),
          read: typeof n.read === 'boolean' ? n.read : false,
        }));
        const withTime = list.map((n: any) => ({
          ...n,
          time: n.createdAt ? timeAgo(new Date(n.createdAt)) : ''
        }));
        setNotifications(withTime);
        backoffMs = minMs; // reset on success
      } catch (err) {
        // Silence UI errors; keep list empty; increase backoff to avoid proxy spam
        setNotifications([]);
        backoffMs = Math.min(Math.max(Math.floor(backoffMs * 2), minMs), maxMs);
      } finally {
        setLoadingNotifications(false);
      }
    }

    const handler = () => fetchNotifications();
    window.addEventListener('notifications:refresh', handler);

    // Visibility-aware scheduler using setTimeout for dynamic backoff
    const tick = async () => {
      if (cancelled) return;
      if (document.visibilityState === 'visible') {
        await fetchNotifications();
      }
      if (cancelled) return;
      timeout = window.setTimeout(tick, backoffMs);
    };

    // Perform an immediate fetch, then schedule
    let timeout = window.setTimeout(tick, 0);

    const onVisibility = () => {
      // When tab becomes visible, reset backoff and refresh immediately
      if (document.visibilityState === 'visible') {
        backoffMs = minMs;
        fetchNotifications();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      window.removeEventListener('notifications:refresh', handler);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearTimeout(timeout);
    };
  }, []);
  const markAllAsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      // Optimistically update UI to zero unread badge
      setNotifications(prev => prev.map((n: any) => ({ ...n, read: true })));
    } catch (e) {
      // no-op
    }
  };
  const [user, setUser] = React.useState<any>(() => {
    // Initialize from OAuth redirect payload if present for faster avatar display
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  React.useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) return;
        const res = await fetch("http://localhost:8081/api/auth/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user || data);
          // Keep local copy in sync to help other components
          try { localStorage.setItem("user", JSON.stringify(data.user || data)); } catch {}
        }
      } catch (e) {}
    };
    fetchProfile();
  }, []);
  const handleLogout = () => {
    api.logout();
    navigate("/login");
  };
  return (
    <>
      {/* Desktop Header */}
      <header
        className={cn(
          "fixed top-0 h-16 bg-background/95 backdrop-blur-sm border-b border-border flex items-center justify-between z-30 transition-all duration-300 ease-in-out",
          "hidden md:flex px-6",
          collapsed ? "left-16" : "left-64",
          "right-0",
        )}
      >
        {/* Desktop Left - empty (sidebar shows title) */}
        <div className="flex-1"></div>
        {/* Desktop Right side - Notifications and User Menu */}
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="relative bg-[#2e9891] hover:bg-[#2e9891] active:bg-[#2e9891] text-white focus-visible:ring-0">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="flex items-center justify-between px-2 py-1.5">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <Button variant="ghost" size="sm" className="h-7 px-2 hover:bg-[#2e9891] active:bg-[#2e9891] hover:text-white" onClick={markAllAsRead} disabled={unreadCount===0}>
                  Mark as read
                </Button>
              </div>
              <DropdownMenuSeparator />
              {notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification._id || notification.id}
                  className="flex flex-col items-start p-3 cursor-pointer hover:bg-white focus:bg-white text-foreground hover:text-foreground focus:text-foreground"
                  onClick={async () => {
                    if (!notification.read) {
                      // Mark as read in backend
                      await api.markNotificationRead(notification._id || notification.id);
                      // Update UI (match by either _id or id)
                      setNotifications((prev) => prev.map((n: any) => {
                        const nid = n._id || n.id;
                        const cid = notification._id || notification.id;
                        return nid === cid ? { ...n, read: true } : n;
                      }));
                    }
                  }}
                >
                  <div className="flex items-start justify-between w-full">
                    <p className={`text-sm ${!notification.read ? "font-medium" : "text-muted-foreground"}`}>{notification.message}</p>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-[#2e9891] rounded-full ml-2 mt-1 flex-shrink-0" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground mt-1">{notification.time}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="relative h-8 w-8 rounded-full hover:bg-muted/50">
                <Avatar className="h-8 w-8">
                  <AvatarImage referrerPolicy="no-referrer" src={user?.avatar || user?.profile?.avatar || "/favicon-32x32.png"} alt="User" />
                  <AvatarFallback className="bg-[#2e9891] text-white">{user?.firstName?.[0] || "U"}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/profile")} className="hover:bg-[#2e9891] focus:bg-[#2e9891] hover:text-white focus:text-white"> <User className="mr-2 h-4 w-4" /> <span>Profile</span> </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="hover:bg-[#2e9891] focus:bg-[#2e9891] hover:text-white focus:text-white"> <LogOut className="mr-2 h-4 w-4" /> <span>Log out</span> </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-background/95 backdrop-blur-sm border-b border-border px-4 flex items-center justify-between z-30">
        {/* Mobile Left - Clickable Logo (no title) */}
        <div className="flex items-center">
          <Link to="/app" className="flex items-center">
            <div className="flex items-center justify-center w-8 h-8 bg-[#2e9891] rounded-lg">
              <Lightbulb className="h-5 w-5 text-white" />
            </div>
          </Link>
        </div>
        {/* Mobile Right - Theme Toggle, Notifications, Profile */}
        <div className="flex items-center space-x-2">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="relative bg-[#2e9891] hover:bg-[#2e9891] active:bg-[#2e9891] text-white focus-visible:ring-0">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-xs">{unreadCount}</Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="flex items-center justify-between px-2 py-1.5">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <Button variant="ghost" size="sm" className="h-7 px-2 hover:bg-[#2e9891] active:bg-[#2e9891] hover:text-white" onClick={markAllAsRead} disabled={unreadCount===0}>
                  Mark as read
                </Button>
              </div>
              <DropdownMenuSeparator />
              {notifications.map((notification) => (
                <DropdownMenuItem key={notification.id || notification._id} className="flex flex-col items-start p-3 hover:bg-white focus:bg-white text-foreground hover:text-foreground focus:text-foreground">
                  <div className="flex items-start justify-between w-full">
                    <p className={`text-sm ${!notification.read ? "font-medium" : "text-muted-foreground"}`}>{notification.message}</p>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-innovation-500 rounded-full ml-2 mt-1 flex-shrink-0" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground mt-1">{notification.time}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="relative h-8 w-8 rounded-full hover:bg-muted/50">
                <Avatar className="h-8 w-8">
                  <AvatarImage referrerPolicy="no-referrer" src={user?.avatar || user?.profile?.avatar || "/favicon-32x32.png"} alt="User" />
                  <AvatarFallback className="bg-[#2e9891] text-white text-xs">{user?.firstName?.[0] || "U"}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/profile")} className="hover:bg-[#2e9891] focus:bg-[#2e9891] hover:text-white focus:text-white"> <User className="mr-2 h-4 w-4" /> <span>Profile</span> </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="hover:bg-[#2e9891] focus:bg-[#2e9891] hover:text-white focus:text-white"> <LogOut className="mr-2 h-4 w-4" /> <span>Log out</span> </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </>
  );
}
