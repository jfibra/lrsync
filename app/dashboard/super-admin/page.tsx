"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardHeader } from "@/components/dashboard-header"
import { DashboardMenuCards } from "@/components/dashboard-menu-cards"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase/client"
import { 
  Users, 
  UserCheck, 
  Building2, 
  TrendingUp, 
  FileText, 
  AlertCircle, 
  Activity, 
  Clock, 
  CheckCircle2, 
  ChevronRight,
  DollarSign
} from "lucide-react"

interface DashboardStats {
  totalUsers: number
  activeUsers: number
  assignedAreas: number
  totalSales: number
  totalTaxpayers: number
}

interface PendingReport {
  uuid: string
  report_number: string
  created_at: string
  status: string
}

interface ActivityLog {
  id: number
  action: string
  description: string
  user_name: string
  created_at: string
}

interface AreaSales {
  area: string
  count: number
  total: number
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
  const [totalCommissions, setTotalCommissions] = useState<number>(0)
  const [pendingReports, setPendingReports] = useState<PendingReport[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [areaPerformance, setAreaPerformance] = useState<AreaSales[]>([])
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    try {
      setLoading(true)

      // 1. Get total users
      const { count: totalUsers } = await supabase.from("user_profiles").select("*", { count: "exact", head: true })

      // 2. Get active users
      const { count: activeUsers } = await supabase
        .from("user_profiles")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")

      // 3. Get unique assigned areas
      const { data: areaData } = await supabase
        .from("user_profiles")
        .select("assigned_area")
        .not("assigned_area", "is", null)

      const uniqueAreas = new Set(areaData?.map((item) => item.assigned_area) || [])

      // 4. Get total sales records (non-deleted)
      const { count: totalSales } = await supabase
        .from("sales")
        .select("*", { count: "exact", head: true })
        .eq("is_deleted", false)

      // 5. Get total taxpayer listings
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

      // 6. Get total commissions from agent breakdown
      const { data: commData } = await supabase
        .from("commission_agent_breakdown")
        .select("comm")
      const totalCommSum = commData?.reduce((sum, item) => sum + (Number(item.comm) || 0), 0) || 0
      setTotalCommissions(totalCommSum)

      // 7. Get pending reports list
      const { data: pendingData } = await supabase
        .from("commission_report")
        .select("uuid, report_number, created_at, status")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5)
      setPendingReports(pendingData || [])

      // 8. Get latest 5 activity notifications
      const { data: logsData } = await supabase
        .from("notifications")
        .select("id, action, description, user_name, created_at")
        .order("id", { ascending: false })
        .limit(5)
      setActivityLogs(logsData || [])

      // 9. Fetch sales by area
      const { data: salesList } = await supabase
        .from("sales")
        .select("id, user_uuid, gross_taxable")
        .eq("is_deleted", false)

      const { data: userList } = await supabase
        .from("user_profiles")
        .select("auth_user_id, assigned_area")

      const userAreaMap: Record<string, string> = {}
      userList?.forEach((u) => {
        if (u.auth_user_id) {
          userAreaMap[u.auth_user_id] = u.assigned_area || "Unassigned"
        }
      })

      const areaSalesMap: Record<string, { count: number; total: number }> = {}
      salesList?.forEach((s) => {
        const area = userAreaMap[s.user_uuid] || "Unassigned"
        if (!areaSalesMap[area]) {
          areaSalesMap[area] = { count: 0, total: 0 }
        }
        areaSalesMap[area].count += 1
        areaSalesMap[area].total += Number(s.gross_taxable) || 0
      })

      const formattedPerformance = Object.entries(areaSalesMap).map(([area, data]) => ({
        area,
        count: data.count,
        total: data.total
      })).sort((a, b) => b.total - a.total).slice(0, 5)

      setAreaPerformance(formattedPerformance)

    } catch (error) {
      console.error("Error fetching dashboard stats:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
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
    color: "blue" | "green" | "purple" | "orange" | "rose"
  }) => {
    const colorClasses = {
      blue: "from-blue-500 to-blue-600",
      green: "from-green-500 to-green-600",
      purple: "from-purple-500 to-purple-600",
      orange: "from-orange-500 to-orange-600",
      rose: "from-rose-500 to-rose-600",
    }

    const bgColorClasses = {
      blue: "bg-blue-50/80 border-blue-200",
      green: "bg-green-50/80 border-green-200",
      purple: "bg-purple-50/80 border-purple-200",
      orange: "bg-orange-50/80 border-orange-200",
      rose: "bg-rose-50/80 border-rose-200",
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
              <span className="text-2xl font-bold text-gray-900 mb-1 block">{value}</span>
            )}
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>
          <div className={`bg-gradient-to-r ${colorClasses[color]} p-3 rounded-xl text-white shadow-lg`}>{icon}</div>
        </div>
      </div>
    )
  }

  // Helper to format currency values
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0
    }).format(val)
  }

  // Get max total sales for SVG graph scaling
  const maxSalesTotal = areaPerformance.length > 0 ? Math.max(...areaPerformance.map(a => a.total)) : 1

  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 pb-16">
        <DashboardHeader />

        <div className="pt-20 px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto">
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

          {/* Core Metrics Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              icon={<Users className="h-6 w-6" />}
              title="Total Users"
              value={stats.totalUsers}
              subtitle={`${stats.activeUsers} currently active`}
              color="blue"
            />
            <StatCard
              icon={<TrendingUp className="h-6 w-6" />}
              title="Sales Records"
              value={stats.totalSales}
              subtitle="Total sales entries in database"
              color="orange"
            />
            <StatCard
              icon={<DollarSign className="h-6 w-6" />}
              title="Total Commissions"
              value={formatCurrency(totalCommissions)}
              subtitle="All registered agent commissions"
              color="green"
            />
            <StatCard
              icon={<AlertCircle className="h-6 w-6" />}
              title="Pending Approvals"
              value={pendingReports.length}
              subtitle="Commission reports awaiting approval"
              color="rose"
            />
          </div>

          {/* Two-Column Analytics Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            
            {/* Left Hand Analytics Column (Span 2) */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* 1. SVG Regional Performance Chart */}
              <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Area Performance Breakdown</h3>
                    <p className="text-xs text-gray-500">Top 5 regional areas by gross taxable sales</p>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800 border-none">Real-Time</Badge>
                </div>

                {loading ? (
                  <div className="h-56 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : areaPerformance.length === 0 ? (
                  <div className="h-56 flex items-center justify-center text-gray-500 text-sm">
                    No sales data available.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* SVG Custom Horizontal Bar Graph */}
                    <div className="w-full">
                      <svg viewBox="0 0 500 200" className="w-full h-auto">
                        {areaPerformance.map((item, idx) => {
                          const barWidth = (item.total / maxSalesTotal) * 320
                          const yPos = 15 + idx * 38
                          return (
                            <g key={item.area} className="group cursor-pointer">
                              {/* Label */}
                              <text 
                                x="10" 
                                y={yPos + 15} 
                                className="text-[12px] font-semibold fill-gray-700"
                              >
                                {item.area.substring(0, 15)}
                              </text>
                              {/* Bar Shadow */}
                              <rect 
                                x="120" 
                                y={yPos} 
                                width="340" 
                                height="20" 
                                rx="4" 
                                className="fill-gray-100"
                              />
                              {/* Actual Colored Bar */}
                              <rect 
                                x="120" 
                                y={yPos} 
                                width={isNaN(barWidth) ? 0 : barWidth} 
                                height="20" 
                                rx="4" 
                                className="fill-gradient bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500 hover:fill-blue-600"
                                style={{ fill: '#3b82f6' }}
                              />
                              {/* Value Label */}
                              <text 
                                x="470" 
                                y={yPos + 15} 
                                className="text-[10px] font-bold fill-gray-500 text-right"
                                textAnchor="end"
                              >
                                {formatCurrency(item.total)}
                              </text>
                            </g>
                          )
                        })}
                      </svg>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Pending Commission Approvals Panel */}
              <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Pending Approvals</h3>
                    <p className="text-xs text-gray-500">Reports awaiting your review</p>
                  </div>
                  <Link href="/dashboard/super-admin/commission-reports">
                    <span className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center cursor-pointer">
                      View All Reports <ChevronRight className="h-3 w-3 ml-0.5" />
                    </span>
                  </Link>
                </div>

                {loading ? (
                  <div className="space-y-3">
                    <div className="h-10 bg-gray-100 rounded animate-pulse"></div>
                    <div className="h-10 bg-gray-100 rounded animate-pulse"></div>
                  </div>
                ) : pendingReports.length === 0 ? (
                  <div className="p-6 text-center border-2 border-dashed border-gray-200 rounded-xl text-gray-500 text-sm">
                    <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    All commission reports are approved and up to date!
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {pendingReports.map((report) => (
                      <div key={report.uuid} className="py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-amber-100 p-2 rounded-lg text-amber-700">
                            <Clock className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-bold text-sm text-gray-900">
                              Report #{report.report_number || "Draft"}
                            </p>
                            <p className="text-xs text-gray-500">
                              Created on {new Date(report.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-medium uppercase">
                            Pending
                          </span>
                          <Link href="/dashboard/super-admin/commission-reports">
                            <button className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-1.5 px-3 rounded-lg shadow-sm transition-colors">
                              Review
                            </button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Right Hand Timeline Column (Span 1) */}
            <div className="space-y-8">
              
              {/* Live Activity Timeline */}
              <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-3">
                  <Activity className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-bold text-gray-900">System Activity Logs</h3>
                </div>

                {loading ? (
                  <div className="space-y-4">
                    <div className="h-8 bg-gray-100 rounded animate-pulse"></div>
                    <div className="h-8 bg-gray-100 rounded animate-pulse"></div>
                  </div>
                ) : activityLogs.length === 0 ? (
                  <div className="text-center py-6 text-gray-500 text-sm">
                    No recent activities recorded.
                  </div>
                ) : (
                  <div className="relative border-l border-gray-200 ml-3 space-y-6">
                    {activityLogs.map((log) => {
                      const isDelete = log.action.includes("delete") || log.action.includes("remove")
                      const isCreate = log.action.includes("create") || log.action.includes("add")
                      
                      return (
                        <div key={log.id} className="relative pl-6">
                          {/* Circle Dot Marker */}
                          <span 
                            className={`absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-white shadow-sm ${
                              isDelete ? 'bg-red-500' : isCreate ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                          />
                          <div>
                            <span className="text-[10px] text-gray-400 font-semibold block uppercase">
                              {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <p className="text-sm font-semibold text-gray-800">
                              {log.description}
                            </p>
                            <span className="text-xs text-gray-500">
                              By {log.user_name || "System"}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

            </div>

          </div>

          {/* Quick Actions / Navigation Cards */}
          <div className="mt-12 animate-in fade-in-50 slide-in-from-bottom-4" style={{ animationDelay: "200ms" }}>
            <h2 className="text-2xl font-semibold text-gray-900 mb-6 border-b border-gray-200 pb-3">
              Quick Actions Console
            </h2>
            <DashboardMenuCards userRole="super_admin" />
          </div>

        </div>
      </div>
    </ProtectedRoute>
  )
}
