"use client"

import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { LogOut, LayoutDashboard, Menu, DollarSign, FileText, Users } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

export function DashboardHeader() {
  const { profile, signOut } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
  }

  const getDashboardUrl = () => {
    if (!profile) return "/dashboard"
    return `/dashboard/${profile.role.replace("_", "-")}`
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3">
        {/* Logo */}
        <div className="flex items-center">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-200">
            BIR System
          </div>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-4">
          {/* Navigation Items */}
          {(profile?.role === "super_admin" || profile?.role === "admin") && (
            <div className="flex items-center gap-2">
              <Link href={`/dashboard/${profile.role.replace("_", "-")}/sales`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-green-600 hover:text-green-700 hover:bg-green-50 transition-all duration-200"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Sales
                </Button>
              </Link>
              <Link href={`/dashboard/${profile.role.replace("_", "-")}/tin-library`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all duration-200"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  TIN Library
                </Button>
              </Link>
              <Link href={`/dashboard/${profile.role.replace("_", "-")}/users`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 transition-all duration-200"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Users
                </Button>
              </Link>
            </div>
          )}

          {/* Dashboard Button */}
          <Link href={getDashboardUrl()}>
            <Button
              variant="outline"
              size="sm"
              className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </Link>

          {/* User Info */}
          <div className="flex items-center gap-3 px-3 py-2 bg-gray-50/80 backdrop-blur-sm rounded-xl border border-gray-200">
            <Avatar className="h-8 w-8 ring-2 ring-blue-100">
              <AvatarFallback className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-medium">
                {profile?.first_name?.[0] || profile?.full_name?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="hidden lg:block">
              <span className="text-sm font-medium text-gray-900">
                {profile?.full_name || `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "User"}
              </span>
              <div className="text-xs text-gray-500 capitalize">{profile?.role?.replace("_", " ") || "User"}</div>
            </div>
          </div>

          {/* Sign Out Button */}
          <Button
            onClick={handleSignOut}
            variant="outline"
            size="sm"
            className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100 hover:border-red-300 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <LogOut className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Log out</span>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden">
          <Button variant="ghost" size="sm" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-lg animate-in slide-in-from-top-2 duration-200">
          <div className="px-4 py-3 space-y-3">
            {/* User Info */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Avatar className="h-10 w-10 ring-2 ring-blue-100">
                <AvatarFallback className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium">
                  {profile?.first_name?.[0] || profile?.full_name?.[0] || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {profile?.full_name || `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "User"}
                </div>
                <div className="text-xs text-gray-500 capitalize">{profile?.role?.replace("_", " ") || "User"}</div>
              </div>
            </div>

            {/* Navigation Items */}
            {(profile?.role === "super_admin" || profile?.role === "admin") && (
              <>
                <Link href={`/dashboard/${profile.role.replace("_", "-")}/sales`}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Sales
                  </Button>
                </Link>
                <Link href={`/dashboard/${profile.role.replace("_", "-")}/tin-library`}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    TIN Library
                  </Button>
                </Link>
                <Link href={`/dashboard/${profile.role.replace("_", "-")}/users`}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Users
                  </Button>
                </Link>
              </>
            )}

            {/* Dashboard Button */}
            <Link href={getDashboardUrl()}>
              <Button
                variant="outline"
                className="w-full justify-start bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </Link>

            {/* Sign Out Button */}
            <Button
              onClick={() => {
                handleSignOut()
                setIsMobileMenuOpen(false)
              }}
              variant="outline"
              className="w-full justify-start bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Log out
            </Button>
          </div>
        </div>
      )}
    </header>
  )
}
