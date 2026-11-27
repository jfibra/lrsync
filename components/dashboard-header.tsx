"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BookText,
  PhilippinePeso,
  Menu,
  User,
  LogOut,
  FileText,
  UserCog,
  BarChart3,
  Bell,
  Receipt,
  ShieldCheck,
  LayoutDashboard,
  ShoppingCart,
  ChevronDown,
  Activity,
  Settings,
  Users,
  Calculator,
  Building2,
  Video,
  Layers,
  FileCheck2,
  FolderOpen,
  Plug,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface NavItemConfig {
  label: string
  shortLabel?: string
  description?: string
  href: (roleSlug: string) => string
  icon: React.ComponentType<{ className?: string }>
  roles: string[]
  exclusiveEmail?: string
  group: "home" | "sales" | "expenses" | "commissions" | "libraries" | "admin" | "account"
  highlight?: boolean
}

interface NavGroupMeta {
  key: "sales" | "expenses" | "commissions" | "libraries" | "admin"
  label: string
  drawerTitle: string
  dropdownHeading: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_GROUPS: NavGroupMeta[] = [
  {
    key: "sales",
    label: "Sales & Cheques",
    drawerTitle: "Sales & Cheques",
    dropdownHeading: "Sales & Collections",
    icon: PhilippinePeso,
  },
  {
    key: "expenses",
    label: "Expenses",
    drawerTitle: "Expenses & Purchases",
    dropdownHeading: "Purchases & Expense Vouchers",
    icon: Receipt,
  },
  {
    key: "commissions",
    label: "Commissions",
    drawerTitle: "Commissions",
    dropdownHeading: "Commission Modules",
    icon: BarChart3,
  },
  {
    key: "libraries",
    label: "Libraries",
    drawerTitle: "Libraries & Resources",
    dropdownHeading: "Directory, Files & Guides",
    icon: FolderOpen,
  },
  {
    key: "admin",
    label: "Management",
    drawerTitle: "Administration",
    dropdownHeading: "System Administration",
    icon: UserCog,
  },
]

export function DashboardHeader() {
  const { user, profile, loading: authLoading } = useAuth()
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  // Fetch recent notifications for the logged-in user
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!profile?.id) return
      setLoadingNotifications(true)
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("id", { ascending: false })
        .limit(20)
      if (!error && data) setNotifications(data)
      setLoadingNotifications(false)
    }
    fetchNotifications()
  }, [profile?.id])

  const roleSlug = React.useMemo(() => {
    if (!profile?.role) return "secretary"
    return profile.role.replace("_", "-")
  }, [profile?.role])

  const getDashboardLink = () => {
    if (profile?.role) {
      return `/dashboard/${profile.role.replace("_", "-")}`
    }
    return "/dashboard"
  }

  const allNavItems: NavItemConfig[] = React.useMemo(
    () => [
      {
        label: "Dashboard",
        shortLabel: "Home",
        href: (slug) => `/dashboard/${slug}`,
        icon: LayoutDashboard,
        roles: ["super_admin", "admin", "secretary"],
        group: "home",
      },
      {
        label: "Sales",
        description: "Sales ledger & BIR records",
        href: (slug) => `/dashboard/${slug}/sales`,
        icon: PhilippinePeso,
        roles: ["super_admin", "admin", "secretary"],
        group: "sales",
      },
      {
        label: "Cheque Verification",
        shortLabel: "Cheques",
        description: "Collector batches, AI upload & cheques",
        href: (slug) => `/dashboard/${slug}/cheque-verification`,
        icon: FileCheck2,
        roles: ["super_admin", "admin", "secretary"],
        group: "sales",
      },
      {
        label: "Purchases",
        description: "Official purchases & receipts",
        href: (slug) => `/dashboard/${slug}/purchases`,
        icon: ShoppingCart,
        roles: ["super_admin", "secretary"],
        group: "expenses",
      },
      {
        label: "Expense Request",
        shortLabel: "Expenses",
        description: "Itemized requests & expense vouchers",
        href: (slug) => `/dashboard/${slug}/expense-request`,
        icon: Receipt,
        roles: ["super_admin", "secretary"],
        group: "expenses",
      },
      {
        label: "Expense Approvals",
        shortLabel: "Approvals",
        description: "Executive signature & approvals",
        href: () => `/dashboard/super-admin/expense-approvals`,
        icon: ShieldCheck,
        roles: ["super_admin"],
        exclusiveEmail: "mindworth@gmail.com",
        group: "expenses",
        highlight: true,
      },
      {
        label: "Commission Generator",
        description: "Compute & generate agent commissions",
        href: (slug) => `/dashboard/${slug}/commission`,
        icon: Calculator,
        roles: ["super_admin", "admin", "secretary"],
        group: "commissions",
      },
      {
        label: "Commission Reports",
        description: "Saved reports & status tracking",
        href: (slug) => `/dashboard/${slug}/commission-reports`,
        icon: FileText,
        roles: ["super_admin", "secretary"],
        group: "commissions",
      },
      {
        label: "Agent Breakdown",
        description: "Per-agent commission summary",
        href: () => `/dashboard/super-admin/commission-agent-breakdown`,
        icon: BarChart3,
        roles: ["super_admin"],
        group: "commissions",
      },
      {
        label: "Vouchers",
        description: "Commission slips, printing & merging",
        href: (slug) => `/dashboard/${slug}/vouchers`,
        icon: Receipt,
        roles: ["super_admin", "secretary"],
        group: "commissions",
      },
      {
        label: "Releases",
        description: "Merged releases & proof of transaction",
        href: (slug) => `/dashboard/${slug}/releases`,
        icon: Layers,
        roles: ["super_admin", "secretary"],
        group: "commissions",
      },
      {
        label: "TIN Library",
        shortLabel: "TIN",
        description: "Taxpayer & developer directory",
        href: (slug) => `/dashboard/${slug}/tin-library`,
        icon: Building2,
        roles: ["super_admin", "admin", "secretary"],
        group: "libraries",
      },
      {
        label: "File Library",
        shortLabel: "Library",
        description: "All uploaded images & PDFs",
        href: (slug) => `/dashboard/${slug}/attachments-library`,
        icon: FolderOpen,
        roles: ["super_admin", "admin"],
        group: "libraries",
      },
      {
        label: "Tutorials",
        shortLabel: "Tutorials",
        description: "Video guides & walkthroughs",
        href: () => `/dashboard/tutorials`,
        icon: Video,
        roles: ["super_admin", "admin", "secretary"],
        group: "libraries",
      },
      {
        label: "User Management",
        shortLabel: "Users",
        description: "Accounts, roles & collector resets",
        href: (slug) => `/dashboard/${slug}/users`,
        icon: Users,
        roles: ["super_admin", "admin"],
        group: "admin",
      },
      {
        label: "Activity Tracker",
        description: "Audit trail & system notifications",
        href: () => `/dashboard/super-admin/activity-tracker`,
        icon: Activity,
        roles: ["super_admin"],
        group: "admin",
      },
      {
        label: "Admin Settings",
        description: "Purchase categories & system config",
        href: () => `/dashboard/super-admin/admin-settings`,
        icon: Settings,
        roles: ["super_admin"],
        group: "admin",
      },
      {
        label: "MCP & API Access",
        description: "Read-only & Admin MCP server keys",
        href: () => `/dashboard/super-admin/mcp-settings`,
        icon: Plug,
        roles: ["super_admin"],
        group: "admin",
      },
      {
        label: "My Profile",
        href: (slug) => `/dashboard/${slug}/profile`,
        icon: User,
        roles: ["super_admin", "admin", "secretary"],
        group: "account",
      },
    ],
    []
  )

  const filteredNavItems = React.useMemo(() => {
    if (!profile?.role) return []
    const currentEmail = (user?.email || profile?.email || "").toLowerCase()
    return allNavItems.filter((item) => {
      if (!item.roles.includes(profile.role)) return false
      if (item.exclusiveEmail && currentEmail !== item.exclusiveEmail.toLowerCase()) {
        return false
      }
      return true
    })
  }, [profile?.role, profile?.email, user?.email, allNavItems])

  const homeNavItem = React.useMemo(
    () => filteredNavItems.find((i) => i.group === "home") || null,
    [filteredNavItems]
  )

  const groupedNavSections = React.useMemo(
    () =>
      NAV_GROUPS.map((meta) => ({
        ...meta,
        items: filteredNavItems.filter((i) => i.group === meta.key),
      })).filter((section) => section.items.length > 0),
    [filteredNavItems]
  )

  // Bottom bar items for quick thumb access on mobile (< lg)
  const mobileBottomItems = React.useMemo(() => {
    const preferredOrder = ["Dashboard", "Sales", "Cheque Verification", "Expense Request"]
    const picked: NavItemConfig[] = []
    for (const label of preferredOrder) {
      const found = filteredNavItems.find((i) => i.label === label)
      if (found) picked.push(found)
    }
    if (picked.length < 4) {
      for (const item of filteredNavItems) {
        if (picked.length >= 4) break
        if (item.group !== "account" && !picked.includes(item)) picked.push(item)
      }
    }
    return picked.slice(0, 4)
  }, [filteredNavItems])

  return (
    <>
      <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-[#1a242f]/95 text-white backdrop-blur-md shadow-md">
        <div className="max-w-[1600px] mx-auto flex h-16 items-center justify-between px-3 sm:px-5 lg:px-6 gap-2">
          {/* Left: Logo */}
          <Link href={getDashboardLink()} className="flex items-center gap-2.5 shrink-0">
            <div className="relative h-8 w-auto">
              <Image
                src="/images/bir-logo.png"
                alt="BIR Logo"
                width={140}
                height={70}
                className="h-8 w-auto object-contain"
              />
            </div>
          </Link>

          {/* Center: Compact Grouped Desktop Navigation (Zero horizontal overflow, scales cleanly) */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-1.5 py-1">
            {homeNavItem && (
              <Link
                href={homeNavItem.href(roleSlug)}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs xl:text-sm font-medium transition-all",
                  pathname === homeNavItem.href(roleSlug)
                    ? "bg-[#0284c7] text-white font-semibold shadow-sm"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                )}
              >
                <homeNavItem.icon className="h-4 w-4 shrink-0" />
                <span>{homeNavItem.label}</span>
              </Link>
            )}

            {groupedNavSections.map((section) => {
              const isSectionActive = section.items.some(
                (item) => pathname === item.href(roleSlug)
              )
              const hasHighlight = section.items.some((item) => item.highlight)

              // Single-item section renders directly as a clean link
              if (section.items.length === 1) {
                const onlyItem = section.items[0]
                const targetHref = onlyItem.href(roleSlug)
                const isActive = pathname === targetHref
                return (
                  <Link
                    key={section.key}
                    href={targetHref}
                    className={cn(
                      "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs xl:text-sm font-medium transition-all",
                      isActive
                        ? "bg-[#0284c7] text-white font-semibold shadow-sm"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <onlyItem.icon className="h-4 w-4 shrink-0" />
                    <span>{onlyItem.shortLabel || onlyItem.label}</span>
                  </Link>
                )
              }

              return (
                <DropdownMenu key={section.key}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs xl:text-sm font-medium transition-all outline-none",
                        isSectionActive
                          ? "bg-[#0284c7] text-white font-semibold shadow-sm"
                          : "text-white/80 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <section.icon className="h-4 w-4 shrink-0" />
                      <span>{section.label}</span>
                      {hasHighlight && (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                      )}
                      <ChevronDown className="h-3.5 w-3.5 opacity-75" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-64 bg-[#1a242f] border-white/15 text-white p-1.5 shadow-xl"
                  >
                    <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-slate-400 px-2.5 py-1">
                      {section.dropdownHeading}
                    </DropdownMenuLabel>
                    {section.items.map((item) => {
                      const targetHref = item.href(roleSlug)
                      const isActive = pathname === targetHref
                      return (
                        <DropdownMenuItem
                          key={item.label}
                          asChild
                          className="focus:bg-white/10 focus:text-white cursor-pointer rounded-md p-0"
                        >
                          <Link
                            href={targetHref}
                            className={cn(
                              "flex items-start gap-2.5 px-2.5 py-2 text-sm w-full rounded-md",
                              item.highlight
                                ? isActive
                                  ? "bg-amber-500 text-slate-950 font-bold"
                                  : "bg-amber-500/15 text-amber-300 border border-amber-400/30 font-semibold"
                                : isActive
                                ? "bg-[#0284c7] text-white font-semibold"
                                : "text-white/85"
                            )}
                          >
                            <item.icon
                              className={cn(
                                "h-4 w-4 shrink-0 mt-0.5",
                                item.highlight
                                  ? isActive
                                    ? "text-slate-950"
                                    : "text-amber-300"
                                  : isActive
                                  ? "text-white"
                                  : "text-sky-400"
                              )}
                            />
                            <div className="min-w-0 flex-1 leading-tight">
                              <div>{item.label}</div>
                              {item.description && (
                                <div
                                  className={cn(
                                    "text-[11px] font-normal mt-0.5 truncate",
                                    isActive ? "text-white/80" : "text-slate-400"
                                  )}
                                >
                                  {item.description}
                                </div>
                              )}
                            </div>
                          </Link>
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            })}
          </nav>

          {/* Right: Notifications, User Menu & Mobile Drawer Trigger */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Notification Bell */}
            {!authLoading && user && profile && (profile.role === "super_admin" || profile.role === "admin") && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative text-white hover:bg-white/10">
                    <Bell className="h-5 w-5" />
                    {notifications.length > 0 && (
                      <span className="absolute top-1.5 right-1.5 inline-block h-2 w-2 rounded-full bg-red-500 ring-2 ring-[#1a242f]" />
                    )}
                    <span className="sr-only">Show notifications</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 bg-white text-slate-900">
                  <DropdownMenuLabel className="font-bold">Recent Notifications</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {loadingNotifications ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">Loading...</div>
                  ) : notifications.filter(
                      (notif) => notif.action !== "user_login" && notif.action !== "dashboard_access"
                    ).length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">No recent activities.</div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto">
                      {notifications
                        .filter((notif) => notif.action !== "user_login" && notif.action !== "dashboard_access")
                        .slice(0, 10)
                        .map((notif) => {
                          let parsedMeta: any = null
                          try {
                            parsedMeta =
                              typeof notif.meta === "string" ? JSON.parse(notif.meta) : notif.meta
                          } catch {
                            parsedMeta = null
                          }
                          const collectionId =
                            parsedMeta?.collection_id || parsedMeta?.collector_transaction_id || null
                          const deepLinkHref = collectionId
                            ? `/dashboard/${roleSlug}/cheque-verification?collection_id=${encodeURIComponent(collectionId)}`
                            : null

                          const itemBody = (
                            <>
                              <span className="font-semibold text-xs text-[#001f3f] flex items-center gap-1.5">
                                {notif.action.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                                {notif.action === "cheque_deposited" && (
                                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">
                                    Review
                                  </span>
                                )}
                              </span>
                              <span className="text-xs text-slate-600 line-clamp-2">{notif.description}</span>
                              <span className="text-[10px] text-slate-400">
                                {notif.user_name} &bull; {new Date(notif.created_at).toLocaleString()}
                              </span>
                            </>
                          )

                          return deepLinkHref ? (
                            <DropdownMenuItem
                              key={notif.id}
                              className="flex flex-col items-start gap-1 cursor-pointer py-2.5"
                              asChild
                            >
                              <Link href={deepLinkHref}>{itemBody}</Link>
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              key={notif.id}
                              className="flex flex-col items-start gap-1 cursor-default py-2.5"
                            >
                              {itemBody}
                            </DropdownMenuItem>
                          )
                        })}
                    </div>
                  )}
                  <DropdownMenuSeparator />
                  {profile.role === "super_admin" && (
                    <DropdownMenuItem className="justify-center text-center font-semibold text-[#0284c7] cursor-pointer" asChild>
                      <Link href="/dashboard/super-admin/activity-tracker">Show all activities</Link>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* User Profile Dropdown */}
            {!authLoading && user && profile && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full lg:rounded-xl border border-white/15 bg-white/10 p-1 lg:px-2.5 lg:py-1.5 text-white transition-colors hover:bg-white/20 outline-none"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0284c7] text-xs font-bold uppercase text-white shadow-sm">
                      {profile.full_name ? profile.full_name.charAt(0) : "U"}
                    </div>
                    <div className="hidden xl:flex flex-col items-start text-left leading-tight">
                      <span className="text-xs font-semibold max-w-[110px] truncate">
                        {profile.first_name || profile.full_name || "User"}
                      </span>
                      <span className="text-[10px] text-sky-300 capitalize">
                        {profile.assigned_area || profile.role.replace(/_/g, " ")}
                      </span>
                    </div>
                    <ChevronDown className="hidden lg:block h-3.5 w-3.5 text-white/70" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60 bg-white text-slate-900 p-1.5">
                  <DropdownMenuLabel className="font-normal px-2.5 py-2">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-bold leading-none text-[#001f3f]">
                        {profile.full_name || "User"}
                      </p>
                      <p className="text-xs leading-none text-slate-500 truncate">{user.email}</p>
                      <div className="flex items-center gap-1.5 pt-1">
                        <span className="inline-block bg-sky-100 text-sky-800 text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                          {profile.role.replace(/_/g, " ")}
                        </span>
                        {profile.assigned_area && (
                          <span className="inline-block bg-slate-100 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded">
                            {profile.assigned_area}
                          </span>
                        )}
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="cursor-pointer rounded-md">
                    <Link href={getDashboardLink()} className="flex items-center gap-2 py-2">
                      <LayoutDashboard className="h-4 w-4 text-slate-500" />
                      <span>Dashboard Home</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer rounded-md">
                    <Link href={`/dashboard/${roleSlug}/profile`} className="flex items-center gap-2 py-2">
                      <User className="h-4 w-4 text-slate-500" />
                      <span>Profile &amp; SMTP Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer rounded-md py-2 font-medium"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Mobile & Tablet Slide-Out Menu Trigger (< lg) */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10 border border-white/15 rounded-lg"
                >
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[300px] sm:w-[340px] bg-[#1a242f] text-white p-0 flex flex-col h-full border-l border-white/10"
              >
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                {/* Drawer Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <Link
                    href={getDashboardLink()}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-2.5"
                  >
                    <Image
                      src="/images/bir-logo.png"
                      alt="BIR Logo"
                      width={130}
                      height={65}
                      className="h-8 w-auto object-contain"
                    />
                  </Link>
                </div>

                {/* User Info Card in Drawer */}
                {user && profile && (
                  <div className="px-4 py-3.5 bg-white/5 border-b border-white/10 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0284c7] text-base font-bold uppercase text-white">
                      {profile.full_name ? profile.full_name.charAt(0) : "U"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-white truncate">
                        {profile.full_name || "User"}
                      </p>
                      <p className="text-xs text-white/60 truncate">{user.email}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] font-bold uppercase bg-sky-500/20 text-sky-300 border border-sky-400/30 px-2 py-0.5 rounded">
                          {profile.role.replace(/_/g, " ")}
                        </span>
                        {profile.assigned_area && (
                          <span className="text-[10px] font-medium bg-white/10 text-white/80 px-2 py-0.5 rounded">
                            {profile.assigned_area}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Scrollable Categorized Navigation Links */}
                <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
                  {homeNavItem && (
                    <div>
                      <nav className="grid gap-1">
                        <Link
                          href={homeNavItem.href(roleSlug)}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                            pathname === homeNavItem.href(roleSlug)
                              ? "bg-[#0284c7] text-white font-semibold shadow-sm"
                              : "text-white/80 hover:bg-white/10 hover:text-white"
                          )}
                        >
                          <homeNavItem.icon className="h-4 w-4 shrink-0" />
                          <span>{homeNavItem.label}</span>
                        </Link>
                      </nav>
                    </div>
                  )}

                  {groupedNavSections.map((section) => (
                    <div key={`mobile-section-${section.key}`}>
                      <div className="px-3 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        {section.drawerTitle}
                      </div>
                      <nav className="grid gap-1">
                        {section.items.map((item) => {
                          const targetHref = item.href(roleSlug)
                          const isActive = pathname === targetHref
                          return (
                            <Link
                              key={`mobile-${item.label}`}
                              href={targetHref}
                              onClick={() => setIsMobileMenuOpen(false)}
                              className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                                item.highlight
                                  ? isActive
                                    ? "bg-amber-500 text-slate-950 font-bold"
                                    : "bg-amber-500/15 text-amber-300 border border-amber-400/30"
                                  : isActive
                                  ? "bg-[#0284c7] text-white font-semibold shadow-sm"
                                  : "text-white/80 hover:bg-white/10 hover:text-white"
                              )}
                            >
                              <item.icon className="h-4 w-4 shrink-0" />
                              <span>{item.label}</span>
                            </Link>
                          )
                        })}
                      </nav>
                    </div>
                  ))}
                </div>

                {/* Sticky Drawer Footer: Profile & Logout */}
                <div className="p-3 border-t border-white/10 bg-[#141c24] space-y-1">
                  <Link
                    href={`/dashboard/${roleSlug}/profile`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      pathname === `/dashboard/${roleSlug}/profile`
                        ? "bg-[#0284c7] text-white"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <User className="h-4 w-4" />
                    <span>My Profile</span>
                  </Link>
                  <Button
                    variant="ghost"
                    className="w-full justify-start px-3 py-2 h-auto text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    onClick={handleSignOut}
                  >
                    <LogOut className="mr-3 h-4 w-4" />
                    Log out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Quick-Access Bar (< lg) */}
      {!authLoading && user && profile && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#1a242f]/95 backdrop-blur-md border-t border-white/15 text-white shadow-[0_-4px_12px_rgba(0,0,0,0.15)]">
          <div className="grid grid-cols-5 h-14 items-center px-1">
            {mobileBottomItems.map((item) => {
              const targetHref = item.href(roleSlug)
              const isActive = pathname === targetHref
              return (
                <Link
                  key={`bottom-${item.label}`}
                  href={targetHref}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 py-1 rounded-lg transition-colors",
                    isActive
                      ? "text-sky-400 font-bold"
                      : "text-white/70 hover:text-white"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="text-[10px] truncate max-w-[64px]">
                    {item.shortLabel || item.label}
                  </span>
                </Link>
              )
            })}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="flex flex-col items-center justify-center gap-0.5 py-1 rounded-lg text-white/75 hover:text-white"
            >
              <Menu className="h-4 w-4" />
              <span className="text-[10px]">More</span>
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default DashboardHeader
