"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { ProtectedRoute } from "@/components/protected-route"
import DashboardHeader from "@/components/dashboard-header"
import { DashboardMenuCards } from "@/components/dashboard-menu-cards"
import { Clock, CheckSquare, TrendingUp, FileText } from "lucide-react"

function getWeekRange(date = new Date()) {
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(date.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { monday, sunday }
}

function getMonthRange(date = new Date()) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
  firstDay.setHours(0, 0, 0, 0)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  lastDay.setHours(23, 59, 59, 999)
  return { firstDay, lastDay }
}

export default function SecretaryDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({
    salesThisWeek: 0,
    salesUpdatedThisMonth: 0,
    commissionReportsThisMonth: 0,
    activitiesThisWeek: 0,
  })

  useEffect(() => {
    async function fetchStats() {
      if (!profile?.id) return
      const { monday, sunday } = getWeekRange(new Date())
      const { firstDay, lastDay } = getMonthRange(new Date())

      // 1. Total Sales Encoded This Week
      const { count: salesThisWeek } = await supabase
        .from("sales")
        .select("*", { count: "exact", head: true })
        .gte("created_at", monday.toISOString())
        .lte("created_at", sunday.toISOString())
        .eq("user_uuid", profile.id)
        .eq("is_deleted", false)

      // 2. Sales Updated This Month (from notifications)
      const { count: salesUpdatedThisMonth } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_uuid", profile.id)
        .eq("action", "sales_updated")
        .gte("created_at", firstDay.toISOString())
        .lte("created_at", lastDay.toISOString())

      // 3. Number of Commission Report Generated This Month (from notifications)
      const { count: commissionReportsThisMonth } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_uuid", profile.id)
        .eq("action", "commission_report_generated")
        .gte("created_at", firstDay.toISOString())
        .lte("created_at", lastDay.toISOString())

      // 4. Total Activities of User This Week
      const { count: activitiesThisWeek } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_uuid", profile.id)
        .gte("created_at", monday.toISOString())
        .lte("created_at", sunday.toISOString())

      setStats({
        salesThisWeek: salesThisWeek || 0,
        salesUpdatedThisMonth: salesUpdatedThisMonth || 0,
        commissionReportsThisMonth: commissionReportsThisMonth || 0,
        activitiesThisWeek: activitiesThisWeek || 0,
      })
    }
    fetchStats()
  }, [profile?.id])

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
            <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>
          <div className={`bg-gradient-to-r ${colorClasses[color]} p-3 rounded-xl text-white shadow-lg`}>{icon}</div>
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute allowedRoles={["secretary"]}>
      <div className="min-h-screen" style={{ background: '#fff' }}>
        <DashboardHeader />
        <div className="pt-20 px-4 sm:px-6 lg:px-8 py-8">
          {/* Welcome Section */}
          <div className="bg-white/80 backdrop-blur-sm border-l-4 border-l-purple-600 p-6 mb-8 rounded-r-xl shadow-xl hover:shadow-2xl transition-shadow duration-300 animate-in fade-in-50 slide-in-from-left-4">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-3 rounded-xl text-white shadow-lg">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                  Welcome back, {profile?.first_name || "Secretary"}!
                </h1>
                <p className="text-gray-600 text-lg">
                  Manage your tasks, documents, and daily administrative activities.
                </p>
              </div>
            </div>
          </div>

          {/* User Profile Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-xl hover:shadow-2xl transition-shadow duration-300 p-6 mb-8 animate-in fade-in-50 slide-in-from-bottom-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 w-20 h-20 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {profile?.first_name?.[0] || "S"}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {profile?.full_name || `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim()}
                </h2>
                <span className="inline-block bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                  Secretary
                </span>
              </div>
            </div>

            {/* Stats Grid - Only Four Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
              <StatCard
                icon={<TrendingUp className="h-6 w-6" />}
                title="Sales Encoded (This Week)"
                value={stats.salesThisWeek}
                subtitle="Total sales encoded this week"
                color="purple"
              />
              <StatCard
                icon={<FileText className="h-6 w-6" />}
                title="Sales Updated (This Month)"
                value={stats.salesUpdatedThisMonth}
                subtitle="Sales updated this month"
                color="blue"
              />
              <StatCard
                icon={<CheckSquare className="h-6 w-6" />}
                title="Commission Reports (This Month)"
                value={stats.commissionReportsThisMonth}
                subtitle="Reports generated this month"
                color="green"
              />
              <StatCard
                icon={<Clock className="h-6 w-6" />}
                title="Your Activities (This Week)"
                value={stats.activitiesThisWeek}
                subtitle="Your activities this week"
                color="orange"
              />
            </div>
          </div>

          {/* Menu Cards */}
          <div className="animate-in fade-in-50 slide-in-from-bottom-4" style={{ animationDelay: "200ms" }}>
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Quick Actions</h2>
            <DashboardMenuCards userRole="secretary" />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
