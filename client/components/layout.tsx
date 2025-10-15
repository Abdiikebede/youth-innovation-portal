import { useState, createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { OAuthHandler } from "./oauth-handler";

interface LayoutProps {
  children: React.ReactNode;
}

interface SidebarContextType {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a Layout");
  }
  return context;
};

export function Layout({ children }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <div className="min-h-screen bg-background">
        <OAuthHandler />
        <Sidebar />

        {/* Desktop Layout */}
        <div
          className={cn(
            "hidden md:block transition-all duration-300 ease-in-out",
            collapsed ? "ml-16" : "ml-64",
          )}
        >
          <Header />
          <main className="pt-16 min-h-[calc(100vh-4rem)]">{children}</main>
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden">
          <Header />
          <main className="pt-16 pb-20 min-h-[calc(100vh-4rem)]">
            {children}
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
