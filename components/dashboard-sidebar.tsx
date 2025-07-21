"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, Users, LogOut, Menu, X, UserCheck, Building2, User, DollarSign, BookText } from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarProps {
  userRole: "super_admin" | "admin" | "secretary"
}

export function DashboardSidebar({ userRole }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const { signOut, profile } = useAuth()

  const getNavigationItems = () => {
    const baseItems = [
      {
        name: "Dashboard",
        href: `/dashboard/${userRole.replace("_", "-")}`,
        icon: LayoutDashboard,
      },
      {
        name: "Sales",
        href: `/dashboard/${userRole.replace("_", "-")}/sales`,
        icon: DollarSign, // Assuming DollarSign icon from lucide-react
      },
      {
        name: "TIN Library",
        href: `/dashboard/${userRole.replace("_", "-")}/tin-library`,
        icon: BookText, // Assuming BookText icon from lucide-react
      },
    ]

    if (userRole === "super_admin") {
      baseItems.push({
        name: "User Management",
        href: `/dashboard/${userRole.replace("_", "-")}/users`,
        icon: Users,
      })
    } else if (userRole === "admin") {
      baseItems.push(
        {
          name: "Regional Management",
          href: `/dashboard/${userRole}/regions`,
          icon: Building2,
        },
        {
          name: "User Oversight",
          href: `/dashboard/${userRole}/oversight`,
          icon: UserCheck,
        },
      )
    }

    // My Profile should be available for all roles
    baseItems.push({
      name: "My Profile",
      href: `/dashboard/${userRole.replace("_", "-")}/profile`,
      icon: User,
    })

    return baseItems
  }

  const navigationItems = getNavigationItems()

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button variant="outline" size="sm" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-center h-16 px-4 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">Leuterio Relief</h1>
          </div>

          {/* User info */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white font-medium">{profile?.first_name?.[0] || "U"}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{profile?.full_name || "User"}</p>
                <p className="text-xs text-gray-500 capitalize">{userRole.replace("_", " ")}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-2">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    isActive ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* Sign out */}
          <div className="p-4 border-t border-gray-200">
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-600 hover:text-gray-900"
              onClick={handleSignOut}
            >
              <LogOut className="mr-3 h-5 w-5" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div className="fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden" onClick={() => setIsOpen(false)} />
      )}
    </>
  )
}
