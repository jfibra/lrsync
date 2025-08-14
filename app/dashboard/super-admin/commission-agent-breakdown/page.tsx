"use client"

import type React from "react"
import { useState, useEffect } from "react"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  RefreshCw,
  Edit,
  Trash2,
  Eye,
  Users,
  TrendingUp,
  DollarSign,
  FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"

import { MultiSelect } from "@/components/ui/multi-select"

interface CommissionAgentBreakdown {
  uuid: string
  commission_report_uuid: string
  commission_report_number: number
  agent_uuid: string
  agent_name: string
  developer: string | null
  client: string | null
  reservation_date: string | null
  comm: number | null
  comm_type: string | null
  bdo_account: string | null
  net_of_vat: number | null
  status: string | null
  calculation_type: string | null
  agents_rate: number | null
  developers_rate: number | null
  agent_amount: number | null
  agent_vat: number | null
  agent_ewt: number | null
  agent_ewt_rate: number | null
  agent_net_comm: number | null
  um_name: string | null
  um_calculation_type: string | null
  um_rate: number | null
  um_developers_rate: number | null
  um_amount: number | null
  um_vat: number | null
  um_ewt: number | null
  um_ewt_rate: number | null
  um_net_comm: number | null
  tl_name: string | null
  tl_calculation_type: string | null
  tl_rate: number | null
  tl_developers_rate: number | null
  tl_amount: number | null
  tl_vat: number | null
  tl_ewt: number | null
  tl_ewt_rate: number | null
  tl_net_comm: number | null
  memberid: string | null
  commission_report?: {
    uuid: string
    report_number: number
    sales_uuids: string[]
    created_by: string | null
    created_at: string | null
    updated_at: string | null
    deleted_at: string | null
    remarks: string | null
    status: string | null
    history: any
    secretary_pot: any
    accounting_pot: any
  }
}

interface StatCard {
  title: string
  value: string | number
  icon: React.ReactNode
  color: string
}

export default function CommissionAgentBreakdownPage() {
  const { toast } = useToast()
  const [records, setRecords] = useState<CommissionAgentBreakdown[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [reportNumbers, setReportNumbers] = useState<number[]>([])
  const [selectedReportNumbers, setSelectedReportNumbers] = useState<number[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<CommissionAgentBreakdown | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [formData, setFormData] = useState<Partial<CommissionAgentBreakdown>>({})
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalPagesState, setTotalPages] = useState(1)

  const fetchReportNumbers = async () => {
    try {
      const { data, error } = await supabase
        .from("commission_agent_breakdown")
        .select("commission_report_number")
        .is("deleted_at", null)
        .order("commission_report_number", { ascending: false })

      if (error) {
        console.error("Error fetching report numbers:", error)
        return
      }

      const uniqueReportNumbers = [...new Set(data?.map((item) => item.commission_report_number) || [])]
      setReportNumbers(uniqueReportNumbers)

      // Set default to most recent report number
      if (uniqueReportNumbers.length > 0 && selectedReportNumbers.length === 0) {
        setSelectedReportNumbers([uniqueReportNumbers[0]])
      }
    } catch (error) {
      console.error("Error:", error)
    }
  }

  const fetchRecords = async () => {
    try {
      setLoading(true)

      let query = supabase
        .from("commission_agent_breakdown")
        .select("*", { count: "exact" })
        .is("deleted_at", null)
        .order("created_at", { ascending: false })

      if (selectedReportNumbers.length > 0) {
        query = query.in("commission_report_number", selectedReportNumbers)
      }

      // Apply filters
      if (searchTerm) {
        query = query.or(
          `agent_name.ilike.%${searchTerm}%,developer.ilike.%${searchTerm}%,client.ilike.%${searchTerm}%,commission_report_number.eq.${searchTerm}`,
        )
      }

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter)
      }

      // Apply pagination
      const from = (currentPage - 1) * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) {
        console.error("Error fetching records:", error)
        toast({
          title: "Error",
          description: "Failed to fetch commission agent breakdown records",
          variant: "destructive",
        })
        return
      }

      setRecords(data || [])
      setTotalRecords(count || 0)
      setTotalPages(Math.ceil((count || 0) / pageSize))
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchRecords()
    setRefreshing(false)
  }

  const handleCreate = async () => {
    try {
      const { error } = await supabase.from("commission_agent_breakdown").insert([formData])

      if (error) {
        console.error("Error creating record:", error)
        toast({
          title: "Error",
          description: "Failed to create record",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Success",
        description: "Record created successfully",
      })

      setIsCreateDialogOpen(false)
      setFormData({})
      await fetchRecords()
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    }
  }

  const handleUpdate = async () => {
    if (!selectedRecord) return

    try {
      const { error } = await supabase
        .from("commission_agent_breakdown")
        .update({ ...formData, updated_at: new Date().toISOString() })
        .eq("uuid", selectedRecord.uuid)

      if (error) {
        console.error("Error updating record:", error)
        toast({
          title: "Error",
          description: "Failed to update record",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Success",
        description: "Record updated successfully",
      })

      setIsEditDialogOpen(false)
      setSelectedRecord(null)
      setFormData({})
      await fetchRecords()
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async () => {
    if (!selectedRecord) return

    try {
      const { error } = await supabase
        .from("commission_agent_breakdown")
        .update({ deleted_at: new Date().toISOString() })
        .eq("uuid", selectedRecord.uuid)

      if (error) {
        console.error("Error deleting record:", error)
        toast({
          title: "Error",
          description: "Failed to delete record",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Success",
        description: "Record deleted successfully",
      })

      setIsDeleteDialogOpen(false)
      setSelectedRecord(null)
      await fetchRecords()
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    }
  }

  const openEditDialog = (record: CommissionAgentBreakdown) => {
    setSelectedRecord(record)
    setFormData(record)
    setIsEditDialogOpen(true)
  }

  const openViewDialog = (record: CommissionAgentBreakdown) => {
    setSelectedRecord(record)
    setIsViewDialogOpen(true)
  }

  const openDeleteDialog = (record: CommissionAgentBreakdown) => {
    setSelectedRecord(record)
    setIsDeleteDialogOpen(true)
  }

  useEffect(() => {
    fetchReportNumbers()
  }, [])

  useEffect(() => {
    fetchRecords()
  }, [currentPage, pageSize, searchTerm, statusFilter, selectedReportNumbers])

  const totalPages = Math.ceil(totalCount / pageSize)
  const startRecord = (currentPage - 1) * pageSize + 1
  const endRecord = Math.min(currentPage * pageSize, totalCount)

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "₱0.00"
    return `₱${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatPercentage = (rate: number | null) => {
    if (rate === null || rate === undefined) return "0%"
    return `${rate}%`
  }

  const statCards: StatCard[] = [
    {
      title: "Total Records",
      value: totalCount.toLocaleString(),
      icon: <FileText className="h-4 w-4" />,
      color: "text-[#001f3f]", // Updated to use specified dark blue color
    },
    {
      title: "Active Records",
      value: records.filter((r) => r.status === "active").length.toLocaleString(),
      icon: <Users className="h-4 w-4" />,
      color: "text-[#3c8dbc]", // Updated to use specified light blue color
    },
    {
      title: "Total Commission",
      value: formatCurrency(records.reduce((sum, r) => sum + (r.agent_net_comm || 0), 0)),
      icon: <DollarSign className="h-4 w-4" />,
      color: "text-[#ffc107]", // Updated to use specified yellow color
    },
    {
      title: "Unique Agents",
      value: new Set(records.map((r) => r.agent_uuid)).size.toLocaleString(),
      icon: <TrendingUp className="h-4 w-4" />,
      color: "text-[#dc3545]", // Updated to use specified red color
    },
  ]

  const handleView = async (record: CommissionAgentBreakdown) => {
    try {
      // Fetch commission report data
      const { data: commissionReport, error: reportError } = await supabase
        .from("commission_report")
        .select("*")
        .eq("uuid", record.commission_report_uuid)
        .single()

      if (reportError) {
        console.error("Error fetching commission report:", reportError)
      }

      // Set the selected record with commission report data
      setSelectedRecord({
        ...record,
        commission_report: commissionReport || undefined,
      })
      setIsViewDialogOpen(true)
    } catch (error) {
      console.error("Error in handleView:", error)
      setSelectedRecord(record)
      setIsViewDialogOpen(true)
    }
  }

  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <DashboardHeader />
      <div className="min-h-screen bg-white">
        <div className="pt-20 px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 text-[#001f3f]">Commission Agent Breakdown</h1>
            <p className="text-gray-700">
              Manage all commission agent breakdown records with comprehensive CRUD controls
            </p>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {statCards.map((stat, index) => (
              <Card key={index} className="bg-white shadow-lg border border-gray-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{stat.title}</p>
                      <p className="text-2xl font-bold text-[#001f3f]">{stat.value}</p>
                    </div>
                    <div className={cn("p-3 rounded-full bg-gray-50", stat.color)}>{stat.icon}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Main Table */}
          <Card className="bg-white shadow-lg border border-gray-200">
            <CardHeader className="bg-gray-50 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-[#001f3f]">Commission Agent Breakdown Records</CardTitle>
                  <CardDescription className="text-gray-700">
                    Showing {startRecord} to {endRecord} of {totalCount} records
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    variant="outline"
                    size="sm"
                    className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-transparent"
                  >
                    <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {/* Report Number Filter */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-[#001f3f] mb-2">Filter by Report Number(s)</label>
                <MultiSelect
                  options={reportNumbers.map((reportNum) => ({
                    label: `Report #${reportNum}`,
                    value: reportNum.toString(),
                  }))}
                  onValueChange={(values) => {
                    setSelectedReportNumbers(values.map(Number))
                    setCurrentPage(1)
                  }}
                  defaultValue={selectedReportNumbers.map(String)}
                  placeholder="Select report numbers..."
                  variant="inverted"
                  animation={2}
                  maxCount={3}
                  className="bg-white border-gray-300"
                />
                {selectedReportNumbers.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm text-gray-600">Selected: {selectedReportNumbers.length} report(s)</span>
                    <button
                      onClick={() => {
                        setSelectedReportNumbers([])
                        setCurrentPage(1)
                      }}
                      className="text-sm text-[#dc3545] hover:underline"
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>

              {/* Filters and Controls */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 h-4 w-4" />
                    <Input
                      placeholder="Search by agent name, developer, client, or report number..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-white border-gray-300 text-gray-900 placeholder:text-gray-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px] bg-white border-gray-300 text-gray-900">
                      <Filter className="h-4 w-4 mr-2 text-gray-600" />
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={pageSize.toString()}
                    onValueChange={(value) => {
                      setPageSize(Number.parseInt(value))
                      setCurrentPage(1)
                    }}
                  >
                    <SelectTrigger className="w-[100px] bg-white border-gray-300 text-gray-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Table */}
              <div className="border border-gray-300 rounded-lg bg-white overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#001f3f]">
                      <TableHead className="text-white font-semibold">Report #</TableHead>
                      <TableHead className="text-white font-semibold">Agent</TableHead>
                      <TableHead className="text-white font-semibold">Developer</TableHead>
                      <TableHead className="text-white font-semibold">Client</TableHead>
                      <TableHead className="text-white font-semibold">Commission</TableHead>
                      <TableHead className="text-white font-semibold">Agent Rate</TableHead>
                      <TableHead className="text-white font-semibold">Net Commission</TableHead>
                      <TableHead className="text-white font-semibold">Status</TableHead>
                      <TableHead className="text-white font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: pageSize }).map((_, index) => (
                        <TableRow key={index} className="hover:bg-gray-50">
                          <TableCell>
                            <Skeleton className="h-4 w-16" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-32" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-20" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-16" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-20" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-6 w-16" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-8 w-24" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : records.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-gray-600">
                          No records found
                        </TableCell>
                      </TableRow>
                    ) : (
                      records.map((record) => (
                        <TableRow key={record.uuid} className="hover:bg-gray-50 border-b border-gray-200">
                          <TableCell className="font-medium text-gray-900">{record.commission_report_number}</TableCell>
                          <TableCell className="text-gray-900">{record.agent_name}</TableCell>
                          <TableCell className="text-gray-900">{record.developer || "N/A"}</TableCell>
                          <TableCell className="text-gray-900">{record.client || "N/A"}</TableCell>
                          <TableCell className="text-gray-900">{formatCurrency(record.comm)}</TableCell>
                          <TableCell className="text-gray-900">{formatPercentage(record.agents_rate)}</TableCell>
                          <TableCell className="text-gray-900">{formatCurrency(record.agent_net_comm)}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                record.status === "active"
                                  ? "default"
                                  : record.status === "pending"
                                    ? "secondary"
                                    : "outline"
                              }
                              className={
                                record.status === "active"
                                  ? "bg-[#3c8dbc] text-white"
                                  : record.status === "pending"
                                    ? "bg-[#ffc107] text-[#001f3f]"
                                    : "border-[#dc3545] text-[#dc3545]"
                              }
                            >
                              {record.status || "N/A"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleView(record)}
                                className="h-8 w-8 p-0 text-[#3c8dbc] hover:bg-gray-100"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(record)}
                                className="h-8 w-8 p-0 text-[#ffc107] hover:bg-gray-100"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDeleteDialog(record)}
                                className="h-8 w-8 p-0 text-[#dc3545] hover:bg-gray-100"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-700 font-medium">
                  Showing {startRecord} to {endRecord} of {totalCount} results
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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
                            "w-8 h-8 p-0 font-medium",
                            currentPage === pageNum
                              ? "bg-[#001f3f] text-white hover:bg-[#001f3f]/90 border-[#001f3f]"
                              : "border-gray-300 text-gray-700 hover:bg-gray-50",
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
                    className="border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* View Dialog */}
          <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: "#ffffff" }}>
              <DialogHeader style={{ borderBottom: "2px solid #001f3f", paddingBottom: "1rem" }}>
                <DialogTitle style={{ color: "#001f3f", fontSize: "1.5rem", fontWeight: "bold" }}>
                  View Commission Agent Breakdown
                </DialogTitle>
              </DialogHeader>

              {selectedRecord && (
                <div className="space-y-6">
                  {/* Commission Report Information */}
                  <div style={{ backgroundColor: "#001f3f", padding: "1rem", borderRadius: "8px" }}>
                    <h3 style={{ color: "#ffffff", fontSize: "1.2rem", fontWeight: "bold", marginBottom: "1rem" }}>
                      Commission Report Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>
                          Report Number
                        </label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.commission_report_number}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>Report UUID</label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.commission_report_uuid}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>
                          Report Status
                        </label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.commission_report?.status || "N/A"}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>
                          Created Date
                        </label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.commission_report?.created_at
                            ? new Date(selectedRecord.commission_report.created_at).toLocaleDateString()
                            : "N/A"}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>
                          Updated Date
                        </label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.commission_report?.updated_at
                            ? new Date(selectedRecord.commission_report.updated_at).toLocaleDateString()
                            : "N/A"}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>Sales Count</label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.commission_report?.sales_uuids?.length || 0}
                        </p>
                      </div>
                    </div>
                    {selectedRecord.commission_report?.remarks && (
                      <div className="mt-4">
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>
                          Report Remarks
                        </label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.commission_report.remarks}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Agent Information */}
                  <div style={{ backgroundColor: "#3c8dbc", padding: "1rem", borderRadius: "8px" }}>
                    <h3 style={{ color: "#ffffff", fontSize: "1.2rem", fontWeight: "bold", marginBottom: "1rem" }}>
                      Agent Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>Agent Name</label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.agent_name || "N/A"}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>Member ID</label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.memberid || "N/A"}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>Developer</label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.developer || "N/A"}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>Client</label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.client || "N/A"}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>BDO Account</label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.bdo_account || "N/A"}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>
                          Reservation Date
                        </label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.reservation_date
                            ? new Date(selectedRecord.reservation_date).toLocaleDateString()
                            : "N/A"}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>Commission</label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          ₱{selectedRecord.comm?.toLocaleString() || "0"}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>
                          Commission Type
                        </label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.comm_type || "N/A"}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>Net of VAT</label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          ₱{selectedRecord.net_of_vat?.toLocaleString() || "0"}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>Status</label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.status || "N/A"}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>
                          Calculation Type
                        </label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.calculation_type || "N/A"}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>
                          Agent Rate (%)
                        </label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.agents_rate || "0"}%
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>
                          Developer Rate (%)
                        </label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.developers_rate || "0"}%
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>
                          Agent Amount
                        </label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          ₱{selectedRecord.agent_amount?.toLocaleString() || "0"}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>Agent VAT</label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          ₱{selectedRecord.agent_vat?.toLocaleString() || "0"}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>Agent EWT</label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          ₱{selectedRecord.agent_ewt?.toLocaleString() || "0"}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>
                          Agent EWT Rate (%)
                        </label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.agent_ewt_rate || "0"}%
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>
                          Agent Net Commission
                        </label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          ₱{selectedRecord.agent_net_comm?.toLocaleString() || "0"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Unit Manager Information */}
                  <div style={{ backgroundColor: "#ffc107", padding: "1rem", borderRadius: "8px" }}>
                    <h3 style={{ color: "#001f3f", fontSize: "1.2rem", fontWeight: "bold", marginBottom: "1rem" }}>
                      Unit Manager Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label style={{ color: "#001f3f", fontSize: "0.875rem", fontWeight: "500" }}>UM Name</label>
                        <p style={{ color: "#001f3f", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.um_name || "N/A"}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#001f3f", fontSize: "0.875rem", fontWeight: "500" }}>
                          UM Calculation Type
                        </label>
                        <p style={{ color: "#001f3f", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.um_calculation_type || "N/A"}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#001f3f", fontSize: "0.875rem", fontWeight: "500" }}>UM Rate (%)</label>
                        <p style={{ color: "#001f3f", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.um_rate || "0"}%
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#001f3f", fontSize: "0.875rem", fontWeight: "500" }}>
                          UM Developer Rate (%)
                        </label>
                        <p style={{ color: "#001f3f", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.um_developers_rate || "0"}%
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#001f3f", fontSize: "0.875rem", fontWeight: "500" }}>UM Amount</label>
                        <p style={{ color: "#001f3f", fontSize: "1rem", marginTop: "0.25rem" }}>
                          ₱{selectedRecord.um_amount?.toLocaleString() || "0"}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#001f3f", fontSize: "0.875rem", fontWeight: "500" }}>UM VAT</label>
                        <p style={{ color: "#001f3f", fontSize: "1rem", marginTop: "0.25rem" }}>
                          ₱{selectedRecord.um_vat?.toLocaleString() || "0"}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#001f3f", fontSize: "0.875rem", fontWeight: "500" }}>UM EWT</label>
                        <p style={{ color: "#001f3f", fontSize: "1rem", marginTop: "0.25rem" }}>
                          ₱{selectedRecord.um_ewt?.toLocaleString() || "0"}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#001f3f", fontSize: "0.875rem", fontWeight: "500" }}>
                          UM EWT Rate (%)
                        </label>
                        <p style={{ color: "#001f3f", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.um_ewt_rate || "0"}%
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#001f3f", fontSize: "0.875rem", fontWeight: "500" }}>
                          UM Net Commission
                        </label>
                        <p style={{ color: "#001f3f", fontSize: "1rem", marginTop: "0.25rem" }}>
                          ₱{selectedRecord.um_net_comm?.toLocaleString() || "0"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Team Leader Information */}
                  <div style={{ backgroundColor: "#dc3545", padding: "1rem", borderRadius: "8px" }}>
                    <h3 style={{ color: "#ffffff", fontSize: "1.2rem", fontWeight: "bold", marginBottom: "1rem" }}>
                      Team Leader Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>TL Name</label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.tl_name || "N/A"}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>
                          TL Calculation Type
                        </label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.tl_calculation_type || "N/A"}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>TL Rate (%)</label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.tl_rate || "0"}%
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>
                          TL Developer Rate (%)
                        </label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.tl_developers_rate || "0"}%
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>TL Amount</label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          ₱{selectedRecord.tl_amount?.toLocaleString() || "0"}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>TL VAT</label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          ₱{selectedRecord.tl_vat?.toLocaleString() || "0"}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>TL EWT</label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          ₱{selectedRecord.tl_ewt?.toLocaleString() || "0"}
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>
                          TL EWT Rate (%)
                        </label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          {selectedRecord.tl_ewt_rate || "0"}%
                        </p>
                      </div>
                      <div>
                        <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>
                          TL Net Commission
                        </label>
                        <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                          ₱{selectedRecord.tl_net_comm?.toLocaleString() || "0"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}

          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: "#ffffff" }}>
              <DialogHeader style={{ borderBottom: "2px solid #001f3f", paddingBottom: "1rem" }}>
                <DialogTitle style={{ color: "#001f3f", fontSize: "1.5rem", fontWeight: "bold" }}>
                  Edit Commission Agent Breakdown
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {/* Commission Report Information (Read-only) */}
                <div style={{ backgroundColor: "#001f3f", padding: "1rem", borderRadius: "8px" }}>
                  <h3 style={{ color: "#ffffff", fontSize: "1.2rem", fontWeight: "bold", marginBottom: "1rem" }}>
                    Commission Report Information (Read-only)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>Report Number</label>
                      <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                        {selectedRecord?.commission_report_number}
                      </p>
                    </div>
                    <div>
                      <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>Report Status</label>
                      <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                        {selectedRecord?.commission_report?.status || "N/A"}
                      </p>
                    </div>
                    <div>
                      <label style={{ color: "#ffffff", fontSize: "0.875rem", fontWeight: "500" }}>
                        Report Created
                      </label>
                      <p style={{ color: "#ffffff", fontSize: "1rem", marginTop: "0.25rem" }}>
                        {selectedRecord?.commission_report?.created_at
                          ? new Date(selectedRecord.commission_report.created_at).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Agent Information Section */}
                <div className="bg-[#3c8dbc] bg-opacity-10 p-4 rounded-lg border border-[#3c8dbc]">
                  <h3 className="text-[#001f3f] font-semibold mb-3 text-lg">Agent Information</h3>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="edit_agent_name" className="text-[#001f3f] font-medium text-sm">
                        Agent Name
                      </Label>
                      <Input
                        id="edit_agent_name"
                        className="bg-[#ffffff] border-[#3c8dbc] text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.agent_name || ""}
                        onChange={(e) => setFormData({ ...formData, agent_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_memberid" className="text-[#001f3f] font-medium text-sm">
                        Member ID
                      </Label>
                      <Input
                        id="edit_memberid"
                        className="bg-[#ffffff] border-[#3c8dbc] text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.memberid || ""}
                        onChange={(e) => setFormData({ ...formData, memberid: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_bdo_account" className="text-[#001f3f] font-medium text-sm">
                        BDO Account
                      </Label>
                      <Input
                        id="edit_bdo_account"
                        className="bg-[#ffffff] border-[#3c8dbc] text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.bdo_account || ""}
                        onChange={(e) => setFormData({ ...formData, bdo_account: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_agents_rate" className="text-[#001f3f] font-medium text-sm">
                        Agent Rate (%)
                      </Label>
                      <Input
                        id="edit_agents_rate"
                        type="number"
                        step="0.01"
                        className="bg-[#ffffff] border-[#3c8dbc] text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.agents_rate || ""}
                        onChange={(e) => setFormData({ ...formData, agents_rate: Number.parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_agent_amount" className="text-[#001f3f] font-medium text-sm">
                        Agent Amount
                      </Label>
                      <Input
                        id="edit_agent_amount"
                        type="number"
                        step="0.01"
                        className="bg-[#ffffff] border-[#3c8dbc] text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.agent_amount || ""}
                        onChange={(e) => setFormData({ ...formData, agent_amount: Number.parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_agent_vat" className="text-[#001f3f] font-medium text-sm">
                        Agent VAT
                      </Label>
                      <Input
                        id="edit_agent_vat"
                        type="number"
                        step="0.01"
                        className="bg-[#ffffff] border-[#3c8dbc] text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.agent_vat || ""}
                        onChange={(e) => setFormData({ ...formData, agent_vat: Number.parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_agent_ewt" className="text-[#001f3f] font-medium text-sm">
                        Agent EWT
                      </Label>
                      <Input
                        id="edit_agent_ewt"
                        type="number"
                        step="0.01"
                        className="bg-[#ffffff] border-[#3c8dbc] text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.agent_ewt || ""}
                        onChange={(e) => setFormData({ ...formData, agent_ewt: Number.parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_agent_ewt_rate" className="text-[#001f3f] font-medium text-sm">
                        Agent EWT Rate (%)
                      </Label>
                      <Input
                        id="edit_agent_ewt_rate"
                        type="number"
                        step="0.01"
                        className="bg-[#ffffff] border-[#3c8dbc] text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.agent_ewt_rate || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, agent_ewt_rate: Number.parseFloat(e.target.value) })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_agent_net_comm" className="text-[#001f3f] font-medium text-sm">
                        Agent Net Commission
                      </Label>
                      <Input
                        id="edit_agent_net_comm"
                        type="number"
                        step="0.01"
                        className="bg-[#ffffff] border-[#3c8dbc] text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.agent_net_comm || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, agent_net_comm: Number.parseFloat(e.target.value) })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* UM Information Section */}
                <div className="bg-[#ffc107] bg-opacity-10 p-4 rounded-lg border border-[#ffc107]">
                  <h3 className="text-[#001f3f] font-semibold mb-3 text-lg">Unit Manager Information</h3>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="edit_um_name" className="text-[#001f3f] font-medium text-sm">
                        UM Name
                      </Label>
                      <Input
                        id="edit_um_name"
                        className="bg-[#ffffff] border-[#ffc107] text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.um_name || ""}
                        onChange={(e) => setFormData({ ...formData, um_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_um_bdo_account" className="text-[#001f3f] font-medium text-sm">
                        UM BDO Account
                      </Label>
                      <Input
                        id="edit_um_bdo_account"
                        className="bg-[#ffffff] border-[#ffc107] text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.um_bdo_account || ""}
                        onChange={(e) => setFormData({ ...formData, um_bdo_account: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_um_calculation_type" className="text-[#001f3f] font-medium text-sm">
                        UM Calculation Type
                      </Label>
                      <Select
                        value={formData.um_calculation_type || ""}
                        onValueChange={(value) => setFormData({ ...formData, um_calculation_type: value })}
                      >
                        <SelectTrigger className="bg-[#ffffff] border-[#ffc107] text-[#001f3f] focus:border-[#001f3f] focus:ring-[#001f3f]">
                          <SelectValue placeholder="Select calculation type" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#ffffff]">
                          <SelectItem value="percentage">Percentage</SelectItem>
                          <SelectItem value="fixed">Fixed Amount</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="edit_um_rate" className="text-[#001f3f] font-medium text-sm">
                        UM Rate (%)
                      </Label>
                      <Input
                        id="edit_um_rate"
                        type="number"
                        step="0.01"
                        className="bg-[#ffffff] border-[#ffc107] text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.um_rate || ""}
                        onChange={(e) => setFormData({ ...formData, um_rate: Number.parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_um_developers_rate" className="text-[#001f3f] font-medium text-sm">
                        UM Developer Rate (%)
                      </Label>
                      <Input
                        id="edit_um_developers_rate"
                        type="number"
                        step="0.01"
                        className="bg-[#ffffff] border-[#ffc107] text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.um_developers_rate || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, um_developers_rate: Number.parseFloat(e.target.value) })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_um_amount" className="text-[#001f3f] font-medium text-sm">
                        UM Amount
                      </Label>
                      <Input
                        id="edit_um_amount"
                        type="number"
                        step="0.01"
                        className="bg-[#ffffff] border-[#ffc107] text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.um_amount || ""}
                        onChange={(e) => setFormData({ ...formData, um_amount: Number.parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_um_vat" className="text-[#001f3f] font-medium text-sm">
                        UM VAT
                      </Label>
                      <Input
                        id="edit_um_vat"
                        type="number"
                        step="0.01"
                        className="bg-[#ffffff] border-[#ffc107] text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.um_vat || ""}
                        onChange={(e) => setFormData({ ...formData, um_vat: Number.parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_um_ewt" className="text-[#001f3f] font-medium text-sm">
                        UM EWT
                      </Label>
                      <Input
                        id="edit_um_ewt"
                        type="number"
                        step="0.01"
                        className="bg-[#ffffff] border-[#ffc107] text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.um_ewt || ""}
                        onChange={(e) => setFormData({ ...formData, um_ewt: Number.parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_um_ewt_rate" className="text-[#001f3f] font-medium text-sm">
                        UM EWT Rate (%)
                      </Label>
                      <Input
                        id="edit_um_ewt_rate"
                        type="number"
                        step="0.01"
                        className="bg-[#ffffff] border-[#ffc107] text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.um_ewt_rate || ""}
                        onChange={(e) => setFormData({ ...formData, um_ewt_rate: Number.parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_um_net_comm" className="text-[#001f3f] font-medium text-sm">
                        UM Net Commission
                      </Label>
                      <Input
                        id="edit_um_net_comm"
                        type="number"
                        step="0.01"
                        className="bg-[#ffffff] border-[#ffc107] text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.um_net_comm || ""}
                        onChange={(e) => setFormData({ ...formData, um_net_comm: Number.parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                {/* TL Information Section */}
                <div className="bg-[#dc3545] bg-opacity-10 p-4 rounded-lg border border-[#dc3545]">
                  <h3 className="text-[#001f3f] font-semibold mb-3 text-lg">Team Leader Information</h3>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="edit_tl_name" className="text-[#001f3f] font-medium text-sm">
                        TL Name
                      </Label>
                      <Input
                        id="edit_tl_name"
                        className="bg-[#ffffff] border-[#dc3545] text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.tl_name || ""}
                        onChange={(e) => setFormData({ ...formData, tl_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_tl_bdo_account" className="text-[#001f3f] font-medium text-sm">
                        TL BDO Account
                      </Label>
                      <Input
                        id="edit_tl_bdo_account"
                        className="bg-[#ffffff] border-[#dc3545] text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.tl_bdo_account || ""}
                        onChange={(e) => setFormData({ ...formData, tl_bdo_account: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_tl_calculation_type" className="text-[#001f3f] font-medium text-sm">
                        TL Calculation Type
                      </Label>
                      <Select
                        value={formData.tl_calculation_type || ""}
                        onValueChange={(value) => setFormData({ ...formData, tl_calculation_type: value })}
                      >
                        <SelectTrigger className="bg-[#ffffff] border-[#dc3545] text-[#001f3f] focus:border-[#001f3f] focus:ring-[#001f3f]">
                          <SelectValue placeholder="Select calculation type" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#ffffff]">
                          <SelectItem value="percentage">Percentage</SelectItem>
                          <SelectItem value="fixed">Fixed Amount</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="edit_tl_rate" className="text-[#001f3f] font-medium text-sm">
                        TL Rate (%)
                      </Label>
                      <Input
                        id="edit_tl_rate"
                        type="number"
                        step="0.01"
                        className="bg-[#ffffff] border-[#dc3545] text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.tl_rate || ""}
                        onChange={(e) => setFormData({ ...formData, tl_rate: Number.parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_tl_developers_rate" className="text-[#001f3f] font-medium text-sm">
                        TL Developer Rate (%)
                      </Label>
                      <Input
                        id="edit_tl_developers_rate"
                        type="number"
                        step="0.01"
                        className="bg-[#ffffff] border-[#dc3545] text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.tl_developers_rate || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, tl_developers_rate: Number.parseFloat(e.target.value) })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_tl_amount" className="text-[#001f3f] font-medium text-sm">
                        TL Amount
                      </Label>
                      <Input
                        id="edit_tl_amount"
                        type="number"
                        step="0.01"
                        className="bg-[#ffffff] border-[#dc3545] text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.tl_amount || ""}
                        onChange={(e) => setFormData({ ...formData, tl_amount: Number.parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_tl_vat" className="text-[#001f3f] font-medium text-sm">
                        TL VAT
                      </Label>
                      <Input
                        id="edit_tl_vat"
                        type="number"
                        step="0.01"
                        className="bg-[#ffffff] border-[#dc3545] text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.tl_vat || ""}
                        onChange={(e) => setFormData({ ...formData, tl_vat: Number.parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_tl_ewt" className="text-[#001f3f] font-medium text-sm">
                        TL EWT
                      </Label>
                      <Input
                        id="edit_tl_ewt"
                        type="number"
                        step="0.01"
                        className="bg-[#ffffff] border-[#dc3545] text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.tl_ewt || ""}
                        onChange={(e) => setFormData({ ...formData, tl_ewt: Number.parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_tl_ewt_rate" className="text-[#001f3f] font-medium text-sm">
                        TL EWT Rate (%)
                      </Label>
                      <Input
                        id="edit_tl_ewt_rate"
                        type="number"
                        step="0.01"
                        className="bg-[#ffffff] border-[#dc3545] text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.tl_ewt_rate || ""}
                        onChange={(e) => setFormData({ ...formData, tl_ewt_rate: Number.parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_tl_net_comm" className="text-[#001f3f] font-medium text-sm">
                        TL Net Commission
                      </Label>
                      <Input
                        id="edit_tl_net_comm"
                        type="number"
                        step="0.01"
                        className="bg-[#ffffff] border-[#dc3545] text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.tl_net_comm || ""}
                        onChange={(e) => setFormData({ ...formData, tl_net_comm: Number.parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                {/* General Information Section */}
                <div className="col-span-full bg-gray-50 p-4 rounded-lg border border-gray-300">
                  <h3 className="text-[#001f3f] font-semibold mb-3 text-lg">General Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="edit_commission_report_number" className="text-[#001f3f] font-medium text-sm">
                        Commission Report Number
                      </Label>
                      <Input
                        id="edit_commission_report_number"
                        type="number"
                        className="bg-[#ffffff] border-gray-300 text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.commission_report_number || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, commission_report_number: Number.parseInt(e.target.value) })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_developer" className="text-[#001f3f] font-medium text-sm">
                        Developer
                      </Label>
                      <Input
                        id="edit_developer"
                        className="bg-[#ffffff] border-gray-300 text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.developer || ""}
                        onChange={(e) => setFormData({ ...formData, developer: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_client" className="text-[#001f3f] font-medium text-sm">
                        Client
                      </Label>
                      <Input
                        id="edit_client"
                        className="bg-[#ffffff] border-gray-300 text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.client || ""}
                        onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_reservation_date" className="text-[#001f3f] font-medium text-sm">
                        Reservation Date
                      </Label>
                      <Input
                        id="edit_reservation_date"
                        type="date"
                        className="bg-[#ffffff] border-gray-300 text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.reservation_date ? formData.reservation_date.split("T")[0] : ""}
                        onChange={(e) => setFormData({ ...formData, reservation_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_comm" className="text-[#001f3f] font-medium text-sm">
                        Commission
                      </Label>
                      <Input
                        id="edit_comm"
                        type="number"
                        step="0.01"
                        className="bg-[#ffffff] border-gray-300 text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.comm || ""}
                        onChange={(e) => setFormData({ ...formData, comm: Number.parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_comm_type" className="text-[#001f3f] font-medium text-sm">
                        Commission Type
                      </Label>
                      <Input
                        id="edit_comm_type"
                        className="bg-[#ffffff] border-gray-300 text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.comm_type || ""}
                        onChange={(e) => setFormData({ ...formData, comm_type: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_net_of_vat" className="text-[#001f3f] font-medium text-sm">
                        Net of VAT
                      </Label>
                      <Input
                        id="edit_net_of_vat"
                        type="number"
                        step="0.01"
                        className="bg-[#ffffff] border-gray-300 text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.net_of_vat || ""}
                        onChange={(e) => setFormData({ ...formData, net_of_vat: Number.parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_status" className="text-[#001f3f] font-medium text-sm">
                        Status
                      </Label>
                      <Select
                        value={formData.status || ""}
                        onValueChange={(value) => setFormData({ ...formData, status: value })}
                      >
                        <SelectTrigger className="bg-[#ffffff] border-gray-300 text-[#001f3f] focus:border-[#001f3f] focus:ring-[#001f3f]">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#ffffff]">
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="edit_calculation_type" className="text-[#001f3f] font-medium text-sm">
                        Calculation Type
                      </Label>
                      <Select
                        value={formData.calculation_type || ""}
                        onValueChange={(value) => setFormData({ ...formData, calculation_type: value })}
                      >
                        <SelectTrigger className="bg-[#ffffff] border-gray-300 text-[#001f3f] focus:border-[#001f3f] focus:ring-[#001f3f]">
                          <SelectValue placeholder="Select calculation type" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#ffffff]">
                          <SelectItem value="percentage">Percentage</SelectItem>
                          <SelectItem value="fixed">Fixed Amount</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="edit_developers_rate" className="text-[#001f3f] font-medium text-sm">
                        Developer Rate (%)
                      </Label>
                      <Input
                        id="edit_developers_rate"
                        type="number"
                        step="0.01"
                        className="bg-[#ffffff] border-gray-300 text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.developers_rate || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, developers_rate: Number.parseFloat(e.target.value) })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_lrsalesid" className="text-[#001f3f] font-medium text-sm">
                        LR Sales ID
                      </Label>
                      <Input
                        id="edit_lrsalesid"
                        className="bg-[#ffffff] border-gray-300 text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.lrsalesid || ""}
                        onChange={(e) => setFormData({ ...formData, lrsalesid: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <Label htmlFor="edit_secretary_remarks" className="text-[#001f3f] font-medium text-sm">
                        Secretary Remarks
                      </Label>
                      <Input
                        id="edit_secretary_remarks"
                        className="bg-[#ffffff] border-gray-300 text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.secretary_remarks || ""}
                        onChange={(e) => setFormData({ ...formData, secretary_remarks: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_accounting_remarks" className="text-[#001f3f] font-medium text-sm">
                        Accounting Remarks
                      </Label>
                      <Input
                        id="edit_accounting_remarks"
                        className="bg-[#ffffff] border-gray-300 text-[#001f3f] placeholder:text-gray-500 focus:border-[#001f3f] focus:ring-[#001f3f]"
                        value={formData.accounting_remarks || ""}
                        onChange={(e) => setFormData({ ...formData, accounting_remarks: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="bg-gray-50 p-4 -m-6 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  className="border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </Button>
                <Button onClick={handleUpdate} className="bg-[#3c8dbc] hover:bg-[#2c7aa8] text-white">
                  Update Record
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Dialog */}
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent className="bg-white">
              <DialogHeader>
                <DialogTitle className="text-[#001f3f]">Delete Record</DialogTitle>
                <DialogDescription className="text-gray-700">
                  Are you sure you want to delete this commission agent breakdown record? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteDialogOpen(false)}
                  className="border-gray-300 text-gray-700"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  className="bg-[#dc3545] hover:bg-[#c82333] text-white"
                >
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </ProtectedRoute>
  )
}
