"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookText, PhilippinePeso, Menu, User, Users, LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

export function DashboardHeader() {
  const { user, profile, loading: authLoading } = useAuth()
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  const navItems = React.useMemo(
    () => [
      {
        label: "Sales",
        href: (role: string) => `/dashboard/${role.replace("_", "-")}/sales`, // Re-added replace
        icon: PhilippinePeso,
        roles: ["super_admin", "admin", "secretary"],
      },
      {
        label: "TIN Library",
        href: (role: string) => `/dashboard/${role.replace("_", "-")}/tin-library`, // Re-added replace
        icon: BookText,
        roles: ["super_admin", "admin", "secretary"],
      },
      {
        label: "Users",
        href: (role: string) => `/dashboard/${role.replace("_", "-")}/users`, // Re-added replace
        icon: Users,
        roles: ["super_admin", "admin"],
      },
      {
        label: "Commission Generator",
        href: (role: string) => `/dashboard/${role.replace("_", "-")}/commission`, // Re-added replace
        icon: Users,
        roles: ["super_admin", "admin", "secretary"],
      },
      {
        label: "My Profile",
        href: (role: string) => `/dashboard/${role.replace("_", "-")}/profile`, // Re-added replace
        icon: User,
        roles: ["super_admin", "admin", "secretary"],
      },
    ],
    [],
  )

  const filteredNavItems = React.useMemo(() => {
    if (!profile?.role) return []
    return navItems.filter((item) => item.roles.includes(profile.role))
  }, [profile?.role, navItems])

  const getDashboardLink = () => {
    if (profile?.role) {
      return `/dashboard/${profile.role.replace("_", "-")}` // Re-added replace
    }
    return "/dashboard" // Fallback
  }

  return (
    <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-[#1a242f] text-white backdrop-blur-sm">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        {/* Logo and System Name */}
        <Link href={getDashboardLink()} className="flex items-center gap-3">
          <div className="relative h-8 w-auto">
            <Image
              src="/images/bir-logo.png"
              alt="BIR Logo"
              width={150}
              height={75}
              className="h-full w-full object-contain"
            />
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-4 md:flex">
          {filteredNavItems.map((item) => (
            <Link
              key={item.label}
              href={item.href(profile?.role || "secretary")} // Default to secretary if role is not yet loaded
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-white/10 hover:text-white",
                pathname.startsWith(item.href(profile?.role || "")) ? "bg-white/10 text-white" : "text-white/80",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User Dropdown and Mobile Menu */}
        <div className="flex items-center gap-4">
          {/* User Dropdown */}
          {!authLoading && user && profile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 overflow-hidden rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
                >
                  <span className="text-lg font-semibold uppercase">
                    {profile.full_name ? profile.full_name.charAt(0) : "U"}
                  </span>
                  <span className="sr-only">Toggle user menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{profile.full_name || "User"}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    <p className="text-xs leading-none text-muted-foreground capitalize">
                      Role: {profile.role.replace(/_/g, " ")}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {filteredNavItems.map((item) => (
                  <DropdownMenuItem key={`dropdown-${item.label}`} asChild>
                    <Link href={item.href(profile.role)} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-500">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Mobile Menu */}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="text-white">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle mobile menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] bg-[#1a242f] text-white">
              <div className="flex flex-col gap-6 p-4">
                <Link href={getDashboardLink()} className="flex items-center gap-3">
                  <div className="relative h-8 w-auto">
                    <Image
                      src="/images/bir-logo.png"
                      alt="BIR Logo"
                      width={150}
                      height={75}
                      className="h-full w-full object-contain"
                    />
                  </div>
                </Link>
                <nav className="grid gap-4">
                  {filteredNavItems.map((item) => (
                    <Link
                      key={`mobile-${item.label}`}
                      href={item.href(profile?.role || "secretary")}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-lg font-medium transition-colors hover:bg-white/10 hover:text-white",
                        pathname.startsWith(item.href(profile?.role || ""))
                          ? "bg-white/10 text-white"
                          : "text-white/80",
                      )}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  ))}
                </nav>
                <div className="mt-auto flex flex-col gap-4 border-t border-white/10 pt-4">
                  {user && profile && (
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 overflow-hidden rounded-full border border-white/20 bg-white/10 text-white">
                        <span className="flex h-full w-full items-center justify-center text-xl font-semibold uppercase">
                          {profile.full_name ? profile.full_name.charAt(0) : "U"}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium">{profile.full_name || "User"}</span>
                        <span className="text-sm text-white/70">{user.email}</span>
                      </div>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-lg text-red-400 hover:bg-white/10 hover:text-red-300"
                    onClick={handleSignOut}
                  >
                    <LogOut className="mr-3 h-5 w-5" />
                    Log out
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

export default DashboardHeader
