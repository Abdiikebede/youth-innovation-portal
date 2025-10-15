import { useState, createContext, useContext } from "react"
import { cn } from "@/lib/utils"
import { AdminSidebar } from "./admin-sidebar"
import { AdminHeader } from "./admin-header"

interface AdminLayoutProps {
  children: React.ReactNode
}

interface AdminSidebarContextType {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
  refreshStats: () => Promise<void>
  setRefreshStats: (refreshStats: () => Promise<void>) => void
}

const AdminSidebarContext = createContext<AdminSidebarContextType | undefined>(undefined)

export const useAdminSidebar = () => {
  const context = useContext(AdminSidebarContext)
  if (!context) {
    throw new Error('useAdminSidebar must be used within an AdminLayout')
  }
  return context
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [refreshStats, setRefreshStatsState] = useState<() => Promise<void>>(() => Promise.resolve())
  
  const setRefreshStats = (refreshFn: () => Promise<void>) => {
    setRefreshStatsState(() => refreshFn)
  }

  return (
    <AdminSidebarContext.Provider value={{ collapsed, setCollapsed, refreshStats, setRefreshStats }}>
      <div className="min-h-screen bg-background">
        <AdminSidebar />

        {/* Desktop Layout */}
        <div className={cn(
          "hidden md:block transition-all duration-300 ease-in-out",
          collapsed ? "ml-16" : "ml-64"
        )}>
          <AdminHeader />
          <main className="pt-16 min-h-[calc(100vh-4rem)] p-6">
            {children}
          </main>
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden">
          <AdminHeader />
          <main className="pt-16 pb-20 min-h-[calc(100vh-4rem)] p-4">
            {children}
          </main>
        </div>
      </div>
    </AdminSidebarContext.Provider>
  )
}
