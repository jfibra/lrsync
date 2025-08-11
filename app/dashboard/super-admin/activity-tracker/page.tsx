"use client"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardHeader } from "@/components/dashboard-header"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  RefreshCw,
  Activity,
  Users,
  TrendingUp,
  BarChart3,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  PieChart,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Pie,
  Legend,
} from "recharts"

interface Notification {
  id: number
  user_uuid: string | null
  user_name: string | null
  user_email: string | null
  action: string
  description: string | null
  ip_address: string | null
  location: any
  user_agent: string | null
  meta: any
  created_at: string
  user_profile?: {
    role: string
    assigned_area: string | null
    full_name: string | null
  }
}

interface StatCard {
  title: string
  value: string | number
  change?: string
  icon: React.ReactNode
  color: string
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D", "#FFC658", "#FF7C7C"]

export default function ActivityTrackerPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [allNotifications, setAllNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [searchTerm, setSearchTerm] = useState("")
  const [actionFilter, setActionFilter] = useState("all")
  const [refreshing, setRefreshing] = useState(false)

  const fetchNotifications = async () => {
    try {
      setLoading(true)

      // Fetch all notifications for statistics
      const { data: allData, error: allError } = await supabase
        .from("notifications")
        .select(`
          *,
          user_profiles!inner(role, assigned_area, full_name)
        `)
        .order("created_at", { ascending: false })

      if (allError) {
        console.error("Error fetching all notifications:", allError)
      } else {
        const processedAllData = (allData || []).map((item) => ({
          ...item,
          user_profile: item.user_profiles,
        }))
        setAllNotifications(processedAllData)
      }

      // Build query for paginated data
      let query = supabase
        .from("notifications")
        .select(
          `
          *,
          user_profiles(role, assigned_area, full_name)
        `,
          { count: "exact" },
        )
        .order("created_at", { ascending: false })

      // Apply filters
      if (searchTerm) {
        query = query.or(
          `user_name.ilike.%${searchTerm}%,user_email.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`,
        )
      }

      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter)
      }

      // Apply pagination
      const from = (currentPage - 1) * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) {
        console.error("Error fetching notifications:", error)
        return
      }

      const processedData = (data || []).map((item) => ({
        ...item,
        user_profile: item.user_profiles,
      }))

      setNotifications(processedData)
      setTotalCount(count || 0)
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchNotifications()
    setRefreshing(false)
  }

  useEffect(() => {
    fetchNotifications()
  }, [currentPage, pageSize, searchTerm, actionFilter])

  // Statistics calculations
  const statistics = useMemo(() => {
    if (!allNotifications.length) return null

    const totalActivities = allNotifications.length
    const uniqueUsers = new Set(allNotifications.filter((n) => n.user_uuid).map((n) => n.user_uuid)).size

    // Action breakdown
    const actionStats = allNotifications.reduce(
      (acc, notification) => {
        acc[notification.action] = (acc[notification.action] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    // Role breakdown
    const roleStats = allNotifications.reduce(
      (acc, notification) => {
        const role = notification.user_profile?.role || "Unknown"
        acc[role] = (acc[role] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    // Area breakdown
    const areaStats = allNotifications.reduce(
      (acc, notification) => {
        const area = notification.user_profile?.assigned_area || "Unassigned"
        acc[area] = (acc[area] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    // Daily activity (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - i)
      return date.toISOString().split("T")[0]
    }).reverse()

    const dailyStats = last7Days.map((date) => {
      const count = allNotifications.filter((n) => n.created_at.startsWith(date)).length
      return {
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        activities: count,
      }
    })

    // Hourly distribution (24 hours)
    const hourlyStats = Array.from({ length: 24 }, (_, hour) => {
      const count = allNotifications.filter((n) => {
        const notificationHour = new Date(n.created_at).getHours()
        return notificationHour === hour
      }).length
      return {
        hour: `${hour.toString().padStart(2, "0")}:00`,
        activities: count,
      }
    })

    // Top users by activity
    const userActivityStats = allNotifications.reduce(
      (acc, notification) => {
        if (notification.user_uuid && notification.user_name) {
          const key = notification.user_uuid
          if (!acc[key]) {
            acc[key] = {
              name: notification.user_name,
              role: notification.user_profile?.role || "Unknown",
              area: notification.user_profile?.assigned_area || "Unassigned",
              count: 0,
            }
          }
          acc[key].count++
        }
        return acc
      },
      {} as Record<string, any>,
    )

    const topUsers = Object.values(userActivityStats)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 5)

    return {
      totalActivities,
      uniqueUsers,
      actionStats,
      roleStats,
      areaStats,
      dailyStats,
      hourlyStats,
      topUsers,
    }
  }, [allNotifications])

  const totalPages = Math.ceil(totalCount / pageSize)
  const startRecord = (currentPage - 1) * pageSize + 1
  const endRecord = Math.min(currentPage * pageSize, totalCount)

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case "user_login":
        return "default"
      case "sales_create":
      case "sales_update":
        return "secondary"
      case "sales_delete":
        return "destructive"
      case "commission_generate":
        return "outline"
      default:
        return "secondary"
    }
  }

  const formatAction = (action: string) => {
    return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  }

  const formatLocation = (location: any) => {
    if (!location) return "Unknown"
    if (typeof location === "string") return location
    if (location.city && location.country) {
      return `${location.city}, ${location.country}`
    }
    return "Unknown"
  }

  const formatRole = (role: string) => {
    return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  }

  // Prepare chart data
  const actionChartData = statistics
    ? Object.entries(statistics.actionStats).map(([action, count]) => ({
        name: formatAction(action),
        value: count,
        percentage: ((count / statistics.totalActivities) * 100).toFixed(1),
      }))
    : []

  const roleChartData = statistics
    ? Object.entries(statistics.roleStats).map(([role, count]) => ({
        name: formatRole(role),
        value: count,
        percentage: ((count / statistics.totalActivities) * 100).toFixed(1),
      }))
    : []

  const areaChartData = statistics
    ? Object.entries(statistics.areaStats).map(([area, count]) => ({
        name: area === "null" ? "Unassigned" : area,
        value: count,
        percentage: ((count / statistics.totalActivities) * 100).toFixed(1),
      }))
    : []

  const statCards: StatCard[] = statistics
    ? [
        {
          title: "Total Activities",
          value: statistics.totalActivities.toLocaleString(),
          icon: <Activity className="h-4 w-4" />,
          color: "text-blue-600",
        },
        {
          title: "Active Users",
          value: statistics.uniqueUsers.toLocaleString(),
          icon: <Users className="h-4 w-4" />,
          color: "text-green-600",
        },
        {
          title: "Most Active Role",
          value: Object.entries(statistics.roleStats).sort(([, a], [, b]) => b - a)[0]?.[0]
            ? formatRole(Object.entries(statistics.roleStats).sort(([, a], [, b]) => b - a)[0][0])
            : "N/A",
          icon: <TrendingUp className="h-4 w-4" />,
          color: "text-purple-600",
        },
        {
          title: "Top Action",
          value: Object.entries(statistics.actionStats).sort(([, a], [, b]) => b - a)[0]?.[0]
            ? formatAction(Object.entries(statistics.actionStats).sort(([, a], [, b]) => b - a)[0][0])
            : "N/A",
          icon: <BarChart3 className="h-4 w-4" />,
          color: "text-orange-600",
        },
      ]
    : []

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-gray-900 font-medium">{`${label}: ${payload[0].value}`}</p>
          {payload[0].payload.percentage && (
            <p className="text-gray-600 text-sm">{`${payload[0].payload.percentage}%`}</p>
          )}
        </div>
      )
    }
    return null
  }

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        fontSize="12"
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <DashboardHeader />
      <div className="min-h-screen bg-gray-50">
        <div className="pt-20 px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 text-gray-900">Activity Tracker</h1>
            <p className="text-gray-600">Monitor all system activities and user actions with comprehensive analytics</p>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {statCards.map((stat, index) => (
              <Card key={index} className="bg-white shadow-sm border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    </div>
                    <div className={cn("p-3 rounded-full bg-gray-100", stat.color)}>{stat.icon}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts Section */}
          {statistics && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Daily Activity Trend - Bar Chart */}
              <Card className="bg-white shadow-sm border-0">
                <CardHeader>
                  <CardTitle className="text-gray-900">Daily Activity Trend</CardTitle>
                  <CardDescription>Activity volume over the last 7 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={statistics.dailyStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" stroke="#666" fontSize={12} />
                      <YAxis stroke="#666" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="activities" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Hourly Distribution */}
              <Card className="bg-white shadow-sm border-0">
                <CardHeader>
                  <CardTitle className="text-gray-900">Hourly Distribution</CardTitle>
                  <CardDescription>Activity patterns throughout the day</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={statistics.hourlyStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="hour" stroke="#666" fontSize={10} />
                      <YAxis stroke="#666" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="activities" fill="#10b981" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Action Breakdown - Pie Chart */}
              <Card className="bg-white shadow-sm border-0">
                <CardHeader>
                  <CardTitle className="text-gray-900">Action Breakdown</CardTitle>
                  <CardDescription>Distribution of different action types</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={actionChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={renderCustomizedLabel}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {actionChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value, entry) => (
                          <span style={{ color: entry.color, fontSize: "12px" }}>{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Role Distribution */}
              <Card className="bg-white shadow-sm border-0">
                <CardHeader>
                  <CardTitle className="text-gray-900">User Role Distribution</CardTitle>
                  <CardDescription>Activity breakdown by user roles</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={roleChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={renderCustomizedLabel}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {roleChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value, entry) => (
                          <span style={{ color: entry.color, fontSize: "12px" }}>{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Top Users and Area Distribution */}
          {statistics && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Top Active Users */}
              <Card className="bg-white shadow-sm border-0">
                <CardHeader>
                  <CardTitle className="text-gray-900">Top Active Users</CardTitle>
                  <CardDescription>Users with the most activity</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {statistics.topUsers.map((user: any, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-600">{index + 1}</span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{user.name}</p>
                            <p className="text-sm text-gray-500">
                              {formatRole(user.role)} • {user.area || "Unassigned"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">{user.count}</p>
                          <p className="text-sm text-gray-500">activities</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Area Distribution - Pie Chart */}
              <Card className="bg-white shadow-sm border-0">
                <CardHeader>
                  <CardTitle className="text-gray-900">Area Distribution</CardTitle>
                  <CardDescription>Activity breakdown by assigned areas</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={areaChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={renderCustomizedLabel}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {areaChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value, entry) => (
                          <span style={{ color: entry.color, fontSize: "12px" }}>{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Activity Table */}
          <Card className="bg-white shadow-sm border-0">
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-gray-900">Recent Activities</CardTitle>
                  <CardDescription>
                    Showing {startRecord} to {endRecord} of {totalCount} activities
                  </CardDescription>
                </div>
                <Button onClick={handleRefresh} disabled={refreshing} variant="outline" size="sm">
                  <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters and Controls */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search by user name, email, or description..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-white border-gray-200 text-gray-900 placeholder:text-gray-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Select value={actionFilter} onValueChange={setActionFilter}>
                    <SelectTrigger className="w-[180px] bg-white border-gray-200 text-gray-900">
                      <Filter className="h-4 w-4 mr-2 text-gray-600" />
                      <SelectValue placeholder="Filter by action" className="text-gray-900" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      <SelectItem value="all" className="text-gray-900 hover:bg-gray-50">
                        All Actions
                      </SelectItem>
                      <SelectItem value="user_login" className="text-gray-900 hover:bg-gray-50">
                        User Login
                      </SelectItem>
                      <SelectItem value="sales_create" className="text-gray-900 hover:bg-gray-50">
                        Sales Create
                      </SelectItem>
                      <SelectItem value="sales_update" className="text-gray-900 hover:bg-gray-50">
                        Sales Update
                      </SelectItem>
                      <SelectItem value="sales_delete" className="text-gray-900 hover:bg-gray-50">
                        Sales Delete
                      </SelectItem>
                      <SelectItem value="commission_generate" className="text-gray-900 hover:bg-gray-50">
                        Commission Generate
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={pageSize.toString()}
                    onValueChange={(value) => {
                      setPageSize(Number.parseInt(value))
                      setCurrentPage(1)
                    }}
                  >
                    <SelectTrigger className="w-[100px] bg-white border-gray-200 text-gray-900">
                      <SelectValue className="text-gray-900" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      <SelectItem value="10" className="text-gray-900 hover:bg-gray-50">
                        10
                      </SelectItem>
                      <SelectItem value="25" className="text-gray-900 hover:bg-gray-50">
                        25
                      </SelectItem>
                      <SelectItem value="50" className="text-gray-900 hover:bg-gray-50">
                        50
                      </SelectItem>
                      <SelectItem value="100" className="text-gray-900 hover:bg-gray-50">
                        100
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Table */}
              <div className="border border-gray-200 rounded-lg bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-gray-700 font-semibold">User</TableHead>
                      <TableHead className="text-gray-700 font-semibold">Role & Area</TableHead>
                      <TableHead className="text-gray-700 font-semibold">Action</TableHead>
                      <TableHead className="text-gray-700 font-semibold">Description</TableHead>
                      <TableHead className="text-gray-700 font-semibold">Location</TableHead>
                      <TableHead className="text-gray-700 font-semibold">Date & Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: pageSize }).map((_, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Skeleton className="h-4 w-32" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-6 w-20" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-48" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-32" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : notifications.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                          No activities found
                        </TableCell>
                      </TableRow>
                    ) : (
                      notifications.map((notification) => (
                        <TableRow key={notification.id} className="hover:bg-gray-50">
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900">
                                {notification.user_name || "Unknown User"}
                              </span>
                              <span className="text-sm text-gray-500">{notification.user_email || "No email"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-900">
                                {notification.user_profile?.role
                                  ? formatRole(notification.user_profile.role)
                                  : "Unknown"}
                              </span>
                              <span className="text-xs text-gray-500">
                                {notification.user_profile?.assigned_area || "Unassigned"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getActionBadgeVariant(notification.action)}>
                              {formatAction(notification.action)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-700">
                              {notification.description || "No description"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm text-gray-700">{formatLocation(notification.location)}</span>
                              <span className="text-xs text-gray-500">{notification.ip_address || "Unknown IP"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-700">
                              {new Date(notification.created_at).toLocaleString()}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-gray-600">
                    Showing {startRecord} to {endRecord} of {totalCount} results
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum
                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (currentPage <= 3) {
                          pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = currentPage - 2 + i
                        }

                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className={cn(
                              "w-8 h-8 p-0",
                              currentPage !== pageNum && "bg-white border-gray-200 text-gray-700 hover:bg-gray-50",
                            )}
                          >
                            {pageNum}
                          </Button>
                        )
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  )
}
