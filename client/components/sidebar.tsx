import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "./theme-toggle"
import { useSidebar } from "./layout"
import {
  Home,
  User,
  Users,
  FolderOpen,
  MessageSquare,
  Settings,
  Award,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Flag,
  Bell,
  Search,
} from "lucide-react"

const navigation = [
  { name: "Home", href: "/app", icon: Home },
  { name: "Projects", href: "/projects", icon: FolderOpen },
  { name: "Requests", href: "/requests", icon: Users },
  { name: "Events", href: "/events", icon: Award },
]

// Mobile navigation (same as desktop for consistency)
const mobileNavigation = navigation

export function Sidebar() {
  const { collapsed, setCollapsed } = useSidebar()
  const location = useLocation()

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={cn(
          "hidden md:block fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Desktop Header */}
        <div className={cn(
          "flex h-16 items-center border-b border-sidebar-border transition-all duration-300",
          collapsed ? "justify-center px-2" : "justify-between px-4"
        )}>
          {/* Logo (clickable) */}
          <div className={cn(
            "flex items-center transition-all duration-300",
            collapsed ? "justify-center" : "justify-start"
          )}>
            <Link to="/app" className="flex items-center">
              <div className="flex items-center justify-center w-8 h-8 bg-[#2e9891] rounded-lg flex-shrink-0">
                <Lightbulb className="h-5 w-5 text-white" />
              </div>
            </Link>
            {/* Heading next to logo (only when expanded) */}
            <div
              className={cn(
                "transition-all duration-300 overflow-hidden",
                collapsed ? "w-0 opacity-0" : "w-auto opacity-100 ml-3"
              )}
            >
              <span className="text-sm font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[#2e9891] to-[#5fd1ca] tracking-wide whitespace-nowrap">
                MinT Innovation
              </span>
            </div>
          </div>

          {/* Toggle Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "h-8 w-8 px-0 hover:bg-sidebar-accent transition-all duration-200",
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
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.href
            
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "group relative flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
                  isActive
                    ? "bg-innovation-500/10 text-black border border-innovation-500/20"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  collapsed ? "justify-center" : "justify-start"
                )}
              >
                <Icon className={cn(
                  "h-5 w-5 flex-shrink-0 transition-all duration-200",
                  collapsed ? "mr-0" : "mr-3",
                  isActive && "text-black"
                )} />
                
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
                    "absolute left-full ml-2 px-2 py-1 bg-sidebar text-sidebar-foreground text-xs rounded-md",
                    "opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200",
                    "border border-sidebar-border shadow-lg z-50"
                  )}>
                    {item.name}
                  </div>
                )}

                {/* Active indicator */}
                {isActive && (
                  <div className="absolute right-2 w-1.5 h-1.5 bg-[#2e9891] rounded-full" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Desktop Footer */}
        <div className="p-4 border-t border-sidebar-border">
          <div className={cn(
            "flex items-center transition-all duration-300",
            collapsed ? "justify-center" : "justify-between"
          )}>
            {/* Project label next to Theme toggle */}
            <div className={cn(
              "flex items-center space-x-2 transition-all duration-300 overflow-hidden",
              collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
            )}>
              <Flag className="h-4 w-4 text-ethiopia-500 flex-shrink-0" />
              <span className="text-xs font-semibold whitespace-nowrap text-[#2e9891] tracking-wide">
                MinT Innovator
              </span>
            </div>
            
            {/* Theme Toggle */}
            <div className="flex-shrink-0">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border">
        <nav className="flex items-center justify-around px-2 py-2">
          {mobileNavigation.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.href
            
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 min-w-0 flex-1",
                  isActive
                    ? "text-black bg-innovation-500/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Icon className={cn(
                  "h-5 w-5 mb-1",
                  isActive && "text-black"
                )} />
                <span className={cn(
                  "text-xs font-medium truncate",
                  isActive && "text-black"
                )}>
                  {item.name}
                </span>
                
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-[#2e9891] rounded-full" />
                )}
              </Link>
            )
          })}
        </nav>
      </div>
    </>
  )
}
