"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardHeader } from "@/components/dashboard-header"
import { DashboardMenuCards } from "@/components/dashboard-menu-cards"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase/client"
import { Building2, Users, FileText, TrendingUp } from "lucide-react"

interface DashboardStats {
  areaUsers: number
  departments: number
  areaSales: number
  areaTaxpayers: number
}

export default function AdminDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    areaUsers: 0,
    departments: 0,
    areaSales: 0,
    areaTaxpayers: 0,
  })
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    try {
      setLoading(true)

      // Get users in same assigned area as admin
      const { count: areaUsers } = await supabase
        .from("user_profiles")
        .select("*", { count: "exact", head: true })
        .eq("assigned_area", profile?.assigned_area || "")
        .eq("status", "active")

      // Get unique departments (roles) in the same area
      const { data: departmentData } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("assigned_area", profile?.assigned_area || "")
        .eq("status", "active")

      const uniqueDepartments = new Set(departmentData?.map((item) => item.role) || [])

      // Get sales records for users in the same area
      const { data: areaUserIds } = await supabase
        .from("user_profiles")
        .select("auth_user_id")
        .eq("assigned_area", profile?.assigned_area || "")

      const userIds = areaUserIds?.map((user) => user.auth_user_id) || []

      const { count: areaSales } = await supabase
        .from("sales")
        .select("*", { count: "exact", head: true })
        .in("user_uuid", userIds)
        .eq("is_deleted", false)

      // Get taxpayer listings for users in the same area
      const { count: areaTaxpayers } = await supabase
        .from("taxpayer_listings")
        .select("*", { count: "exact", head: true })
        .in("user_uuid", userIds)

      setStats({
        areaUsers: areaUsers || 0,
        departments: uniqueDepartments.size,
        areaSales: areaSales || 0,
        areaTaxpayers: areaTaxpayers || 0,
      })
    } catch (error) {
      console.error("Error fetching dashboard stats:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (profile) {
      fetchStats()
    }
  }, [profile])

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
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {loading ? <div className="h-8 w-16 bg-gray-200 rounded animate-pulse"></div> : value}
            </p>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>
          <div className={`bg-gradient-to-r ${colorClasses[color]} p-3 rounded-xl text-white shadow-lg`}>{icon}</div>
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50">
        <DashboardHeader />

        <div className="pt-20 px-4 sm:px-6 lg:px-8 py-8">
          {/* Welcome Section */}
          <div className="bg-white/80 backdrop-blur-sm border-l-4 border-l-green-600 p-6 mb-8 rounded-r-xl shadow-xl hover:shadow-2xl transition-shadow duration-300 animate-in fade-in-50 slide-in-from-left-4">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-r from-green-600 to-blue-600 p-3 rounded-xl text-white shadow-lg">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-2">
                  Welcome back, {profile?.first_name || "Admin"}!
                </h1>
                <p className="text-gray-600 text-lg">
                  Manage your assigned area operations and oversee departmental activities.
                </p>
              </div>
            </div>
          </div>

          {/* User Profile Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-xl hover:shadow-2xl transition-shadow duration-300 p-6 mb-8 animate-in fade-in-50 slide-in-from-bottom-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="bg-gradient-to-r from-green-600 to-blue-600 w-20 h-20 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {profile?.first_name?.[0] || "A"}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {profile?.full_name || `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim()}
                </h2>
                <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                  Admin
                </span>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
              <StatCard
                icon={<Users className="h-6 w-6" />}
                title="Area Users"
                value={stats.areaUsers}
                subtitle="In your area"
                color="blue"
              />
              <StatCard
                icon={<Building2 className="h-6 w-6" />}
                title="Departments"
                value={stats.departments}
                subtitle="Active departments"
                color="green"
              />
              <StatCard
                icon={<TrendingUp className="h-6 w-6" />}
                title="Area Sales"
                value={stats.areaSales}
                subtitle="Sales in your area"
                color="purple"
              />
              <StatCard
                icon={<FileText className="h-6 w-6" />}
                title="Area Taxpayers"
                value={stats.areaTaxpayers}
                subtitle="Taxpayers in area"
                color="orange"
              />
            </div>
          </div>

          {/* Menu Cards */}
          <div className="animate-in fade-in-50 slide-in-from-bottom-4" style={{ animationDelay: "200ms" }}>
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Quick Actions</h2>
            <DashboardMenuCards userRole="admin" />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
