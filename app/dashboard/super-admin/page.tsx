"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardHeader } from "@/components/dashboard-header"
import { DashboardMenuCards } from "@/components/dashboard-menu-cards"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase/client"
import { Users, UserCheck, Building2, TrendingUp, FileText } from "lucide-react"
import { logNotification } from "@/utils/logNotification";

interface DashboardStats {
  totalUsers: number
  activeUsers: number
  assignedAreas: number
  totalSales: number
  totalTaxpayers: number
}

export default function SuperAdminDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    assignedAreas: 0,
    totalSales: 0,
    totalTaxpayers: 0,
  })
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    try {
      setLoading(true)

      // Get total users
      const { count: totalUsers } = await supabase.from("user_profiles").select("*", { count: "exact", head: true })

      // Get active users
      const { count: activeUsers } = await supabase
        .from("user_profiles")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")

      // Get unique assigned areas
      const { data: areaData } = await supabase
        .from("user_profiles")
        .select("assigned_area")
        .not("assigned_area", "is", null)

      const uniqueAreas = new Set(areaData?.map((item) => item.assigned_area) || [])

      // Get total sales records (non-deleted)
      const { count: totalSales } = await supabase
        .from("sales")
        .select("*", { count: "exact", head: true })
        .eq("is_deleted", false)

      // Get total taxpayer listings
      const { count: totalTaxpayers } = await supabase
        .from("taxpayer_listings")
        .select("*", { count: "exact", head: true })

      setStats({
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        assignedAreas: uniqueAreas.size,
        totalSales: totalSales || 0,
        totalTaxpayers: totalTaxpayers || 0,
      })
    } catch (error) {
      console.error("Error fetching dashboard stats:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    // Log notification/audit entry for dashboard access (all roles)
    if (profile?.id) {
      (async () => {
        try {
          await logNotification(supabase, {
            action: "dashboard_access",
            description: `Super Admin dashboard accessed by ${profile.full_name || profile.first_name || profile.id}`,
            user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
            meta: JSON.stringify({
              user_id: profile.id,
              role: profile.role || "unknown",
              dashboard: "super_admin",
            }),
          })
        } catch (logError) {
          console.error("Error logging notification:", logError)
          // Do not block user on logging failure
        }
      })()
    }
  }, [])

  const StatCard = ({
    icon,
    title,
    value,
    subtitle,
    color,
  }: {
    icon: React.ReactNode
    title: string
    value: string | number
    subtitle: string
    color: "blue" | "green" | "purple" | "orange"
  }) => {
    const colorClasses = {
      blue: "from-blue-500 to-blue-600",
      green: "from-green-500 to-green-600",
      purple: "from-purple-500 to-purple-600",
      orange: "from-orange-500 to-orange-600",
    }

    const bgColorClasses = {
      blue: "bg-blue-50/80 border-blue-200",
      green: "bg-green-50/80 border-green-200",
      purple: "bg-purple-50/80 border-purple-200",
      orange: "bg-orange-50/80 border-orange-200",
    }

    return (
      <div
        className={`${bgColorClasses[color]} border-2 backdrop-blur-sm rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 animate-in fade-in-50 slide-in-from-bottom-4`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            {loading ? (
              <span className="inline-block h-8 w-16 bg-gray-200 rounded animate-pulse mb-1"></span>
            ) : (
              <span className="text-3xl font-bold text-gray-900 mb-1 block">{value}</span>
            )}
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>
          <div className={`bg-gradient-to-r ${colorClasses[color]} p-3 rounded-xl text-white shadow-lg`}>{icon}</div>
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <DashboardHeader />

        <div className="pt-20 px-4 sm:px-6 lg:px-8 py-8">
          {/* Welcome Section */}
          <div className="bg-white/80 backdrop-blur-sm border-l-4 border-l-blue-600 p-6 mb-8 rounded-r-xl shadow-xl hover:shadow-2xl transition-shadow duration-300 animate-in fade-in-50 slide-in-from-left-4">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-xl text-white shadow-lg">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                  Welcome back, {profile?.first_name || "Super Admin"}!
                </h1>
                <p className="text-gray-600 text-lg">You have full system access and administrative privileges.</p>
              </div>
            </div>
          </div>

          {/* User Profile Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-xl hover:shadow-2xl transition-shadow duration-300 p-6 mb-8 animate-in fade-in-50 slide-in-from-bottom-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 w-20 h-20 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {profile?.first_name?.[0] || "S"}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {profile?.full_name || `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim()}
                </h2>
                <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  Super Admin
                </span>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mt-8">
              <StatCard
                icon={<Users className="h-6 w-6" />}
                title="Total Users"
                value={stats.totalUsers}
                subtitle="All system users"
                color="blue"
              />
              <StatCard
                icon={<UserCheck className="h-6 w-6" />}
                title="Active Users"
                value={stats.activeUsers}
                subtitle="Currently active"
                color="green"
              />
              <StatCard
                icon={<Building2 className="h-6 w-6" />}
                title="Assigned Areas"
                value={stats.assignedAreas}
                subtitle="Coverage areas"
                color="purple"
              />
              <StatCard
                icon={<TrendingUp className="h-6 w-6" />}
                title="Sales Records"
                value={stats.totalSales}
                subtitle="Total sales entries"
                color="orange"
              />
              <StatCard
                icon={<FileText className="h-6 w-6" />}
                title="Taxpayers"
                value={stats.totalTaxpayers}
                subtitle="Registered taxpayers"
                color="blue"
              />
            </div>
          </div>

          {/* Menu Cards */}
          <div className="animate-in fade-in-50 slide-in-from-bottom-4" style={{ animationDelay: "200ms" }}>
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Quick Actions</h2>
            <DashboardMenuCards userRole="super_admin" />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
