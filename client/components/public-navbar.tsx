import { useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu } from "lucide-react"

export function PublicNavbar() {
  const [isOpen, setIsOpen] = useState(false)

  const navigation = [
    { name: "Home", href: "/" },
    { name: "About", href: "#about" },
    { name: "Programs", href: "#programs" },
    { name: "Innovators", href: "#innovators" },
    { name: "Contact", href: "#contact" },
  ]

  return (
    <nav className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <img
              src="http://www.mint.gov.et/o/adaptive-media/image/260066/Preview-1000x0/logo24+%282%29.png?t=1743885360726"
              alt="Logo"
              className="h-8 w-auto md:h-9"
            />
          </div>



          {/* Right side */}
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-3">
             
              <Link to="/login">
                <Button variant="ghost" size="sm" className="hover:bg-[#2e9891] hover:text-white">
                  Sign In
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm" className="bg-[#2e9891] hover:bg-[#277f79]">
                  Get Started
                </Button>
              </Link>
            </div>

            {/* Mobile menu */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="sm">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <div className="mt-6 pt-6">
               <object data="" type=""></object> 
                  <Link to="/login" className="block">
                    <Button variant="outline" className="w-full border-[#2e9891] hover:bg-[#2e9891] hover:text-white hover:border-[#2e9891]">
                      Sign In
                    </Button>
                  </Link>
                  <Link to="/register" className="block mt-3">
                    <Button className="w-full bg-[#2e9891] hover:bg-[#277f79]">
                      Get Started
                    </Button>
                  </Link>
                </div>
                <div className="flex flex-col mt-6">
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  )
}
