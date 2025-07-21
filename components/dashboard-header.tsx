"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Menu, User, Settings, LogOut, Shield, Users, FileText, DollarSign } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export function DashboardHeader() {
  const { user, profile, signOut } = useAuth()
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleSignOut = async () => {
    setIsLoggingOut(true)
    await signOut()
    router.push("/login")
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case "super_admin":
        return "Super Administrator"
      case "admin":
        return "Administrator"
      case "secretary":
        return "Secretary"
      default:
        return "User"
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "super_admin":
        return <Shield className="h-4 w-4 text-red-500" />
      case "admin":
        return <Users className="h-4 w-4 text-blue-500" />
      case "secretary":
        return <FileText className="h-4 w-4 text-green-500" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  // Centralized navigation items configuration
  const navItems = [
    {
      label: "Sales",
      href: (role: string) => `/dashboard/${role.replace("_", "-")}/sales`,
      icon: DollarSign,
      roles: ["super_admin", "admin", "secretary"],
    },
    {
      label: "TIN Library",
      href: (role: string) => `/dashboard/${role.replace("_", "-")}/tin-library`,
      icon: FileText,
      roles: ["super_admin", "admin", "secretary"],
    },
    {
      label: "User Management",
      href: (role: string) => `/dashboard/${role.replace("_", "-")}/users`,
      icon: Users,
      roles: ["super_admin", "admin"], // Only super_admin and admin can manage users
    },
    {
      label: "My Profile",
      href: (role: string) => `/dashboard/${role.replace("_", "-")}/profile`,
      icon: Settings,
      roles: ["super_admin", "admin", "secretary"],
    },
  ]

  const userRole = profile?.role || "user"
  const dashboardBaseUrl = `/dashboard/${userRole.replace("_", "-")}`

  return (
    <header
      className="sticky top-0 z-50 w-full border-b border-gray-700 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      style={{ backgroundColor: "#1a242f" }}
    >
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Left side - Mobile Menu button and Logo */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden text-white hover:bg-white/10 hover:text-white"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <Link href={dashboardBaseUrl} className="flex items-center">
            <Image
              src="/images/bir-logo.png"
              alt="BIR Logo"
              width={150} // Adjust width as needed for better display
              height={75} // Adjust height as needed
              className="h-8 w-auto object-contain" // Ensure responsive height and auto width
            />
          </Link>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-2">
          {navItems.map((item) => {
            if (item.roles.includes(userRole)) {
              const Icon = item.icon
              return (
                <Link key={item.label} href={item.href(userRole)}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/10 hover:text-white transition-all duration-200"
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </Button>
                </Link>
              )
            }
            return null
          })}
        </nav>

        {/* Right side - User Dropdown */}
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-10 w-auto px-3 text-white hover:bg-white/10 hover:text-white transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8 border-2 border-white/20">
                    <AvatarFallback className="bg-white/20 text-white text-sm font-medium">
                      {profile?.full_name ? getInitials(profile.full_name) : "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left">
                    <div className="text-sm font-medium">{profile?.full_name || user?.email || "User"}</div>
                    <div className="flex items-center gap-1 text-xs text-gray-300">
                      {getRoleIcon(userRole)}
                      {getRoleDisplay(userRole)}
                    </div>
                  </div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-64 bg-white/95 backdrop-blur-md border border-gray-200/50 shadow-xl"
              align="end"
            >
              <div className="px-3 py-2 border-b border-gray-200/50">
                <p className="text-sm font-medium text-gray-900">{profile?.full_name || user?.email || "User"}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  {getRoleIcon(userRole)}
                  {getRoleDisplay(userRole)}
                </p>
              </div>

              {/* My Profile link in dropdown */}
              {navItems.find((item) => item.label === "My Profile" && item.roles.includes(userRole)) && (
                <DropdownMenuItem
                  onClick={() => router.push(navItems.find((item) => item.label === "My Profile")!.href(userRole))}
                  className="cursor-pointer hover:bg-gray-100/80 transition-colors"
                >
                  <Settings className="h-4 w-4" />
                  <span className="ml-2">My Profile</span>
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator className="bg-gray-200/50" />
              <DropdownMenuItem
                onClick={handleSignOut}
                disabled={isLoggingOut}
                className="cursor-pointer text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span className="ml-2">{isLoggingOut ? "Signing out..." : "Sign out"}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile Menu Content */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-[#1a242f]/95 backdrop-blur-md animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col h-full p-4">
            <div className="flex justify-between items-center mb-4">
              <Link href={dashboardBaseUrl} onClick={() => setIsMobileMenuOpen(false)}>
                <Image
                  src="/images/bir-logo.png"
                  alt="BIR Logo"
                  width={150}
                  height={75}
                  className="h-8 w-auto object-contain"
                />
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-white hover:bg-white/10"
              >
                <Menu className="h-6 w-6 rotate-90" />
              </Button>
            </div>

            {/* User Info in Mobile Menu */}
            <div className="flex items-center gap-3 p-3 bg-white/10 rounded-lg border border-white/20 mb-4">
              <Avatar className="h-10 w-10 ring-2 ring-white/30">
                <AvatarFallback className="bg-white/20 text-white font-medium">
                  {profile?.full_name ? getInitials(profile.full_name) : "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="text-sm font-medium text-white">{profile?.full_name || user?.email || "User"}</div>
                <div className="text-xs text-gray-300 capitalize flex items-center gap-1">
                  {getRoleIcon(userRole)}
                  {getRoleDisplay(userRole)}
                </div>
              </div>
            </div>

            {/* Mobile Navigation Links */}
            <nav className="flex flex-col gap-2 flex-1">
              {navItems.map((item) => {
                if (item.roles.includes(userRole)) {
                  const Icon = item.icon
                  return (
                    <Link key={item.label} href={item.href(userRole)} onClick={() => setIsMobileMenuOpen(false)}>
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-white hover:bg-white/10 hover:text-white"
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {item.label}
                      </Button>
                    </Link>
                  )
                }
                return null
              })}
            </nav>

            {/* Sign Out Button in Mobile Menu */}
            <Button
              onClick={handleSignOut}
              disabled={isLoggingOut}
              className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors mt-4"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {isLoggingOut ? "Signing out..." : "Sign out"}
            </Button>
          </div>
        </div>
      )}
    </header>
  )
}
