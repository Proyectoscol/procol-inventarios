"use client"

import { useSession } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { 
  Package, 
  Settings, 
  Home,
  Menu,
  X,
  User
} from "lucide-react"
import { useState } from "react"

export function DashboardHeader() {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: Home },
    { name: "Inventario", href: "/dashboard/inventory", icon: Package },
    { name: "Clientes", href: "/dashboard/customers", icon: User },
    { name: "Configuración", href: "/dashboard/settings", icon: Settings },
  ]

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard"
    }
    // Para /dashboard/settings, solo activar si es exactamente /dashboard/settings o subrutas de settings
    // pero NO si es /dashboard/customers (que ya no es subruta de settings)
    if (href === "/dashboard/settings") {
      return pathname === "/dashboard/settings" || 
             (pathname?.startsWith("/dashboard/settings/") && 
              !pathname?.startsWith("/dashboard/customers"))
    }
    // Para otras rutas, usar startsWith
    return pathname?.startsWith(href)
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo y título */}
            <div className="flex items-center">
              <Link href="/dashboard" className="flex items-center space-x-2">
                <Package className="h-6 w-6 text-primary" />
                <span className="text-xl font-bold text-gray-900">InventarIA</span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1">
              {navigation.map((item) => {
                const Icon = item.icon
                return (
                  <Link key={item.name} href={item.href}>
                    <Button
                      variant={isActive(item.href) ? "default" : "ghost"}
                      size="sm"
                      className={`flex items-center space-x-2 ${
                        isActive(item.href) ? "bg-primary text-white" : "hover:bg-gray-100"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-sm">{item.name}</span>
                    </Button>
                  </Link>
                )
              })}
            </nav>

            {/* User menu - Desktop */}
            <div className="hidden md:flex items-center space-x-3">
              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-gray-50">
                <User className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">
                  {session?.user?.name}
                </span>
              </div>
            </div>

            {/* Mobile: User and menu button */}
            <div className="md:hidden flex items-center space-x-3">
              <div className="flex items-center space-x-2 px-2 py-1 rounded-md bg-gray-50">
                <User className="h-4 w-4 text-gray-600" />
                <span className="text-sm text-gray-700 truncate max-w-[100px]">
                  {session?.user?.name}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="relative z-50"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Backdrop overlay para móvil */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Navigation - Slide down from header */}
      <div
        className={`fixed top-16 left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-50 md:hidden transition-all duration-300 ease-out ${
          mobileMenuOpen 
            ? "opacity-100 translate-y-0 pointer-events-auto" 
            : "opacity-0 -translate-y-4 pointer-events-none"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav className="flex flex-col space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Button
                    variant={isActive(item.href) ? "default" : "ghost"}
                    className={`w-full justify-start ${
                      isActive(item.href) ? "bg-primary text-white" : ""
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    <span>{item.name}</span>
                  </Button>
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </>
  )
}

