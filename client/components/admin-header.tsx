import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "./theme-toggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Bell,
  LogOut,
  FileText,
  AlertTriangle,
  Award,
} from "lucide-react"
import { api } from "@/services/api"

function getAdminInfo() {
  const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      return {
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Admin',
        email: user.email || '',
      };
    } catch {}
  }
  return { name: 'Admin', email: '' };
}

import { useAdminSidebar } from "./admin-layout"

export function AdminHeader() {
  const navigate = useNavigate()
  const { collapsed } = useAdminSidebar()
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  // Treat undefined read as unread so badge shows for freshly created items
  const unreadCount = notifications.filter((n) => n.read === false || typeof n.read === 'undefined').length

  // Humanize time
  const timeAgo = (d: Date) => {
    const diffMs = Date.now() - d.getTime();
    const mins = Math.max(0, Math.floor(diffMs / 60000));
    if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  };

  // Fetch notifications from backend (admin-specific)
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      let list: any[] = [];
      try {
        const data = await api.getAdminNotifications();
        list = Array.isArray(data.notifications) ? data.notifications : [];
      } catch (err: any) {
        // Fallback: if admin endpoint is forbidden (not an admin), load personal notifications
        if (err && typeof err.message === 'string' && err.message === 'FORBIDDEN') {
          const data = await api.getNotifications();
          list = Array.isArray(data.notifications) ? data.notifications : [];
        } else {
          throw err;
        }
      }
      // Normalize items to ensure id/read/createdAt/message are present
      if (list && list.length) {
        list = list.map((n: any) => ({
          id: n.id || n._id,
          _id: n._id, // keep if provided
          type: n.type,
          title: n.title,
          message: n.message || n.text || n.title || '',
          username: n.username,
          createdAt: n.createdAt || n.time || n.date || new Date().toISOString(),
          read: typeof n.read === 'boolean' ? n.read : false,
        }));
      }

      // If admin notifications are empty, or missing funding/certificate, synthesize from admin requests and pending applications
      if (!list.length) {
        try {
          const apps = await api.getApplicationsByStatus('pending');
          const appsList = Array.isArray(apps.applications) ? apps.applications : [];
          const derived = appsList.map((a: any) => ({
            id: a._id,
            type: 'application',
            title: 'Verification Application',
            message: `New verification application from ${a.userName || `${a.userFirstName || ''} ${a.userLastName || ''}`.trim()}`,
            createdAt: a.submittedAt || a.createdAt,
            read: false,
          }));
          list = derived;
        } catch {}
      }
      // Try to merge funding/certificate requests as notifications (pending ones)
      try {
        const reqs = await api.getAdminRequests?.();
        const reqArr: any[] = reqs && Array.isArray(reqs.requests) ? reqs.requests : (Array.isArray(reqs) ? reqs : []);
        const mapped = reqArr
          .filter((r: any) => r && (r.type === 'funding' || r.type === 'certificate') && (r.status === 'pending' || !r.status))
          .map((r: any) => ({
            id: r._id,
            type: r.type,
            title: r.type === 'funding' ? 'Funding Request' : 'Certificate Request',
            message: `New request for ${r.type} from ${r.userName || `${r.userFirstName || ''} ${r.userLastName || ''}`.trim() || 'User'}`,
            createdAt: r.createdAt,
            read: false,
          }));
        // De-duplicate by id+type
        const existingKeys = new Set(list.map((n: any) => `${n.id || n._id}|${n.type}`));
        for (const m of mapped) {
          const key = `${m.id}|${m.type}`;
          if (!existingKeys.has(key)) {
            list.push(m);
            existingKeys.add(key);
          }
        }
      } catch {}
      const withTime = list.map((n: any) => ({ ...n, time: n.createdAt ? timeAgo(new Date(n.createdAt)) : '' }));
      // Debug: log what we received to verify funding/certificate presence
      try { console.debug('🔔 Admin notifications fetched:', withTime); } catch {}
      setNotifications(withTime);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch notifications on component mount and set up auto-refresh
  useEffect(() => {
    fetchNotifications();
    
    // Auto-refresh notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "application":
        return <FileText className="h-4 w-4 text-blue-500" />
      case "funding":
        return <FileText className="h-4 w-4 text-emerald-600" />
      case "certificate":
        return <Award className="h-4 w-4 text-indigo-600" />
      case "event":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />
      default:
        return <Bell className="h-4 w-4 text-gray-500" />
    }
  }

  const markAllAsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
  };

  const handleLogout = () => {
    api.logout()
    navigate('/login')
  }

  return (
    <>
      {/* Desktop Header */}
      <header className={cn(
        "fixed top-0 h-16 bg-background/95 backdrop-blur-sm border-b border-border flex items-center justify-between z-30 transition-all duration-300 ease-in-out",
        "hidden md:flex px-6",
        collapsed ? "left-16" : "left-64",
        "right-0"
      )}>
        {/* Empty space for better layout */}
        <div className="flex-1"></div>

        {/* Right side - Notifications and User Menu */}
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="relative bg-transparent hover:bg-transparent active:bg-transparent focus:bg-transparent focus-visible:ring-0 text-foreground hover:text-foreground active:text-foreground focus:text-foreground">
                <Bell className="h-5 w-5 text-foreground" />
                {unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-xs"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="flex items-center justify-between px-2 py-1.5">
                <DropdownMenuLabel>Admin Notifications</DropdownMenuLabel>
                <Button variant="ghost" size="sm" className="h-7 px-2 hover:bg-[#2e9891] active:bg-[#2e9891] hover:text-white" onClick={markAllAsRead} disabled={unreadCount===0}>Mark as read</Button>
              </div>
              <DropdownMenuSeparator />
              {loading ? (
                <div className="flex items-center justify-center p-4">
                  <div className="text-sm text-muted-foreground">Loading notifications...</div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex items-center justify-center p-4">
                  <div className="text-sm text-muted-foreground">No new notifications</div>
                </div>
              ) : (
                notifications.map((notification) => (
                  <DropdownMenuItem 
                    key={notification.id || notification._id} 
                    className="flex flex-col items-start p-3 cursor-pointer hover:bg-white focus:bg-white text-foreground hover:text-foreground focus:text-foreground"
                    onClick={async () => {
                      try {
                        if (!notification.read && (notification._id || notification.id)) {
                          await api.markNotificationRead(notification._id || notification.id);
                          setNotifications((prev) => prev.map((n) => ((n._id || n.id) === (notification._id || notification.id) ? { ...n, read: true } : n)));
                        }
                        // no navigation on notification click
                      } catch {}
                    }}
                  >
                    <div className="flex items-start justify-between w-full">
                      <div className="flex items-start space-x-2">
                        {getNotificationIcon(notification.type)}
                        <p className={`text-sm ${!notification.read ? 'font-medium' : 'text-muted-foreground'}`}>
                          {notification.message}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-destructive rounded-full ml-2 mt-1 flex-shrink-0" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground mt-1 ml-6">{notification.time}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Desktop User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full hover:bg-muted/50">
                <Avatar className="h-8 w-8">
                  <AvatarImage referrerPolicy="no-referrer" src={user?.avatar || user?.profile?.avatar || "/favicon-32x32.png"} alt="Admin" />
                  <AvatarFallback className="bg-destructive text-white text-xs">AD</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{getAdminInfo().name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {getAdminInfo().email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="hover:bg-[#2e9891] focus:bg-[#2e9891] hover:text-white focus:text-white">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-background/95 backdrop-blur-sm border-b border-border flex items-center justify-between px-4 z-30 md:hidden">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-semibold">Admin Dashboard</h1>
        </div>

        <div className="flex items-center space-x-2">
          {/* Mobile Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="relative bg-transparent hover:bg-transparent active:bg-transparent focus:bg-transparent focus-visible:ring-0 text-foreground hover:text-foreground active:text-foreground focus:text-foreground">
                <Bell className="h-5 w-5 text-foreground" />
                {unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-xs"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="flex items-center justify-between px-2 py-1.5">
                <DropdownMenuLabel>Admin Notifications</DropdownMenuLabel>
                <Button variant="ghost" size="sm" className="h-7 px-2 hover:bg-[#2e9891] active:bg-[#2e9891] hover:text-white" onClick={markAllAsRead} disabled={unreadCount===0}>Mark as read</Button>
              </div>
              <DropdownMenuSeparator />
              {loading ? (
                <div className="flex items-center justify-center p-4">
                  <div className="text-sm text-muted-foreground">Loading notifications...</div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex items-center justify-center p-4">
                  <div className="text-sm text-muted-foreground">No new notifications</div>
                </div>
              ) : (
                notifications.map((notification) => (
                  <DropdownMenuItem 
                    key={notification.id || notification._id} 
                    className="flex flex-col items-start p-3 cursor-pointer hover:bg-white focus:bg-white text-foreground hover:text-foreground focus:text-foreground"
                    onClick={async () => {
                      try {
                        if (!notification.read && (notification._id || notification.id)) {
                          const token = localStorage.getItem('auth_token');
                          await fetch(`/api/notifications/${notification._id || notification.id}/read`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
                          setNotifications((prev) => prev.map((n) => (n._id === notification._id ? { ...n, read: true } : n)));
                        }
                        // no navigation on notification click
                      } catch {}
                    }}
                  >
                    <div className="flex items-start justify-between w-full">
                      <div className="flex items-start space-x-2">
                        {getNotificationIcon(notification.type)}
                        <p className={`text-sm ${!notification.read ? 'font-medium' : 'text-muted-foreground'}`}>
                          {notification.message}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-destructive rounded-full ml-2 mt-1 flex-shrink-0" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground mt-1 ml-6">{notification.time}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme Toggle for mobile - between notification and profile */}
          <div className="md:hidden">
            <ThemeToggle />
          </div>

          {/* Mobile User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full hover:bg-muted/50">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/placeholder.svg" alt="Admin" />
                  <AvatarFallback className="bg-destructive text-white text-xs">AD</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{getAdminInfo().name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {getAdminInfo().email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="hover:bg-[#2e9891] focus:bg-[#2e9891] hover:text-white focus:text-white">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </>
  )
}
