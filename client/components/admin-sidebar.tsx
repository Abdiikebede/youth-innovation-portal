import { Link, useLocation } from "react-router-dom"
import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "./theme-toggle"
import { useAdminSidebar } from "./admin-layout"
import { api } from "@/services/api"
import {
  ChevronLeft,
  ChevronRight,
  Shield,
  Flag,
  Clock,
  CheckCircle,
  XCircle,
  Megaphone,
  Inbox,
  Crown,
} from "lucide-react"

// 4 main admin navigation items (pending handled on main dashboard)
const navigation = [
  { name: "Approved Applications", href: "/admin/applications", icon: CheckCircle, color: "text-green-500" },
  { name: "Rejected Applications", href: "/admin/rejected", icon: XCircle, color: "text-red-500" },
  { name: "Announcements", href: "/admin/announcements", icon: Megaphone, color: "text-blue-500" },
  { name: 'Response', href: '/admin/requests', icon: Inbox, color: "text-purple-500" },
]

// Mobile admin navigation (same items with shorter names for mobile)
const mobileAdminNavigation = [
  { name: "Approved", href: "/admin/applications", icon: CheckCircle, color: "text-green-500" },
  { name: "Rejected", href: "/admin/rejected", icon: XCircle, color: "text-red-500" },
  { name: "Events", href: "/admin/announcements", icon: Megaphone, color: "text-blue-500" },
  { name: "Response", href: "/admin/requests", icon: Inbox, color: "text-purple-500" },
]

export function AdminSidebar() {
  const { collapsed, setCollapsed, setRefreshStats } = useAdminSidebar()
  const location = useLocation()
  const [stats, setStats] = useState({
    totalUsers: 0,
    pendingApplications: 0,
    approvedApplications: 0,
    rejectedApplications: 0,
    totalProjects: 0,
    upcomingEvents: 0,
    totalEvents: 0,
    totalRequests: 0,
    totalFundingRequests: 0,
    totalCertificateRequests: 0
  })

  // Only count funding + certificate requests for the Response badge
  const totalResponses = (stats.totalFundingRequests || 0) + (stats.totalCertificateRequests || 0)

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.getDashboardStats()
      const statsData = response.stats || response
      const totalResponsesServer = (statsData.totalFundingRequests || 0) + (statsData.totalCertificateRequests || 0)
      setStats({
        totalUsers: statsData.totalUsers || 0,
        pendingApplications: statsData.pendingApplications || 0,
        approvedApplications: statsData.approvedApplications || 0,
        rejectedApplications: statsData.rejectedApplications || 0,
        totalProjects: statsData.totalProjects || 0,
        upcomingEvents: statsData.upcomingEvents || 0,
        totalEvents: statsData.totalEvents || 0,
        // Force totalRequests to be only funding + certificate (exclude collab)
        totalRequests: totalResponsesServer,
        totalFundingRequests: statsData.totalFundingRequests || 0,
        totalCertificateRequests: statsData.totalCertificateRequests || 0
      })
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [fetchStats])

  // Expose fetchStats function through context
  useEffect(() => {
    setRefreshStats(fetchStats)
  }, [fetchStats, setRefreshStats])

  return (
    <>
      {/* Desktop Admin Sidebar */}
      <div
        className={cn(
          "hidden md:block fixed left-0 top-0 z-40 h-screen bg-background text-foreground border-r border-border transition-all duration-300 ease-in-out",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Desktop Header */}
        <div className={cn(
          "flex h-16 items-center border-b border-border transition-all duration-300",
          collapsed ? "justify-center px-2" : "justify-between px-4"
        )}>
          {/* Logo */}
          <div className={cn(
            "flex items-center transition-all duration-300",
            collapsed ? "justify-center" : "space-x-3"
          )}>
            <div className="flex items-center justify-center w-8 h-8 bg-[#2e9891] rounded-lg flex-shrink-0">
              <Shield className="h-5 w-5 text-white" />
            </div>
            {/* Sidebar Title */}
            <span className={cn(
              "text-sm font-semibold",
              collapsed ? "hidden" : "block"
            )}>
              Admin Dashboard
            </span>

          </div>

          {/* Toggle Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "h-8 w-8 px-0 hover:bg-muted transition-all duration-200",
              collapsed && "ml-0"
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 transition-transform duration-200" />
            ) : (
              <ChevronLeft className="h-4 w-4 transition-transform duration-200" />
            )}
          </Button>
        </div>

        {/* Desktop Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href
            
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "group relative flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200",
                  isActive
                    ? "bg-black/5 text-black border border-black/10 shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  collapsed ? "justify-center" : "justify-start"
                )}
              >
                {/** icons removed per request */}
                
                {/* Text with smooth slide animation */}
                <span className={cn(
                  "transition-all duration-300 overflow-hidden whitespace-nowrap",
                  collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                )}>
                  {item.name}
                </span>

                {/* Tooltip for collapsed state */}
                {collapsed && (
                  <div className={cn(
                    "absolute left-full ml-3 px-3 py-2 bg-background text-foreground text-sm rounded-lg",
                    "opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200",
                    "border border-border shadow-lg z-50 whitespace-nowrap"
                  )}>
                    {item.name}
                  </div>
                )}

                {/* Active indicator */}
                {isActive && (
                  <div className="absolute right-3 w-2 h-2 bg-black rounded-full" />
                )}

                {/* Badge count */}
                {!collapsed && (
                  <div className="ml-auto">
                    {item.name === "Super Admin" && (
                      <Badge className="bg-yellow-100 text-yellow-800">
                        {stats.totalUsers}
                      </Badge>
                    )}
                    {item.name === "Pending Applications" && (
                      <Badge className="bg-orange-100 text-orange-800">
                        {stats.pendingApplications}
                      </Badge>
                    )}
                    {item.name === "Approved Applications" && (
                      <Badge className="bg-green-100 text-green-800">
                        {stats.approvedApplications}
                      </Badge>
                    )}
                    {item.name === "Rejected Applications" && (
                      <Badge className="bg-red-100 text-red-800">
                        {stats.rejectedApplications}
                      </Badge>
                    )}
                    {item.name === "Announcements" && (
                      <Badge className="bg-primary/15 text-primary">
                        {stats.totalEvents}
                      </Badge>
                    )}
                    {item.name === "Response" && (
                      <Badge className="bg-purple-100 text-purple-800">
                        {totalResponses}
                      </Badge>
                    )}
                  </div>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Desktop Footer */}
        <div className="p-4 border-t border-border">
          <div className={cn(
            "flex items-center transition-all duration-300",
            collapsed ? "justify-center" : "justify-between"
          )}>
            {/* Admin Portal text */}
            <div className={cn(
              "flex items-center space-x-2 transition-all duration-300 overflow-hidden",
              collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
            )}>
              <Flag className="h-4 w-4 text-orange-500 flex-shrink-0" />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
              MinT Innovation Portal
              </span>
            </div>
            
            {/* Theme Toggle */}
            <div className="flex-shrink-0 hidden md:block">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Admin Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border">
        <nav className="flex items-center justify-around px-1 py-2">
          {mobileAdminNavigation.map((item) => {
            const isActive = location.pathname === item.href
            
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "relative flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 min-w-0 flex-1 mx-1",
                  isActive
                    ? "text-black bg-black/5"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <div className={cn(
                  "flex flex-col items-center justify-center px-1 py-2 text-xs relative",
                  isActive ? "text-black" : "text-muted-foreground"
                )}>
                  {/* icons removed per request */}
                  <span className="mb-1">{item.name}</span>
                  {/* Badge count for mobile */}
                  {item.name === "Super" && stats.totalUsers > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 bg-yellow-500 text-white flex items-center justify-center text-xs">
                      {stats.totalUsers > 99 ? "99+" : stats.totalUsers}
                    </Badge>
                  )}
                  {item.name === "Pending" && stats.pendingApplications > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 bg-orange-500 text-white flex items-center justify-center text-xs">
                      {stats.pendingApplications > 9 ? "9+" : stats.pendingApplications}
                    </Badge>
                  )}
                  {item.name === "Approved" && stats.approvedApplications > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 bg-green-500 text-white flex items-center justify-center text-xs">
                      {stats.approvedApplications > 9 ? "9+" : stats.approvedApplications}
                    </Badge>
                  )}
                  {item.name === "Rejected" && stats.rejectedApplications > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 bg-red-500 text-white flex items-center justify-center text-xs">
                      {stats.rejectedApplications > 9 ? "9+" : stats.rejectedApplications}
                    </Badge>
                  )}
                  {item.name === "Events" && stats.upcomingEvents > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 bg-blue-500 text-white flex items-center justify-center text-xs">
                      {stats.upcomingEvents > 9 ? "9+" : stats.upcomingEvents}
                    </Badge>
                  )}
                  {item.name === "Response" && totalResponses > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 bg-purple-600 text-white flex items-center justify-center text-xs">
                      {totalResponses > 9 ? "9+" : totalResponses}
                    </Badge>
                  )}
                </div>
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-6 h-1 bg-black rounded-full" />
                )}
              </Link>
            )
          })}
        </nav>
      </div>
    </>
  )
}
