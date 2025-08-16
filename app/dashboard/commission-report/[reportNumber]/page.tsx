"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, User, Calendar, Hash, FileText, DollarSign, Users, Building2, MapPin } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface CommissionReport {
  uuid: string
  report_number: number
  sales_uuids: string[]
  created_by: string
  created_at: string
  updated_at: string
  remarks: string | null
  status: string
  history: any[]
  secretary_pot: any
  accounting_pot: any
  user_profiles: {
    full_name: string
    assigned_area: string
  }
}

interface AgentBreakdown {
  uuid: string
  commission_report_number: number
  agent_name: string
  developer: string
  client: string
  comm: number
  agents_rate: number
  agent_net_comm: number
  status: string
}

interface SalesData {
  id: string
  tin: string
  name: string
  tax_month: string
  type: string
  substreet_street_brgy: string
  district_city_zip: string
  gross_taxable: number
  invoice_number: string
  tax_type: string
  pickup_date: string
  total_actual_amount: number
  sale_type: string
  is_complete: boolean
  remarks: string
  user_full_name: string
  created_at: string
}

export default function CommissionReportViewer() {
  const params = useParams()
  const router = useRouter()
  const reportNumber = params.reportNumber as string

  const [report, setReport] = useState<CommissionReport | null>(null)
  const [agentBreakdown, setAgentBreakdown] = useState<AgentBreakdown[]>([])
  const [salesData, setSalesData] = useState<SalesData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    if (reportNumber) {
      fetchReportData()
    }
  }, [reportNumber])

  const fetchReportData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch commission report
      const { data: reportData, error: reportError } = await supabase
        .from("commission_report")
        .select(`
          *,
          user_profiles (
            full_name,
            assigned_area
          )
        `)
        .eq("report_number", reportNumber)
        .single()

      if (reportError) throw reportError
      setReport(reportData)

      // Fetch agent breakdown
      const { data: agentData, error: agentError } = await supabase
        .from("commission_agent_breakdown")
        .select("*")
        .eq("commission_report_number", reportNumber)

      if (agentError) throw agentError
      setAgentBreakdown(agentData || [])

      // Fetch sales data
      if (reportData?.sales_uuids && reportData.sales_uuids.length > 0) {
        const { data: salesData, error: salesError } = await supabase
          .from("sales")
          .select(`
            id,
            tin,
            name,
            tax_month,
            type,
            substreet_street_brgy,
            district_city_zip,
            gross_taxable,
            invoice_number,
            tax_type,
            pickup_date,
            total_actual_amount,
            sale_type,
            is_complete,
            remarks,
            user_full_name,
            created_at
          `)
          .in("id", reportData.sales_uuids)
          .order("created_at", { ascending: false })

        if (salesError) throw salesError
        setSalesData(salesData || [])
      }
    } catch (err: any) {
      console.error("Error fetching report data:", err)
      setError(err.message || "Failed to fetch report data")
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return "₱0.00"
    }
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount)
  }

  const formatPercentage = (rate: number) => {
    return `${(rate * 100).toFixed(2)}%`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="container mx-auto p-6 space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-8 w-64" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-white">
        <div className="container mx-auto p-6">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="border-[#3c8dbc] text-[#3c8dbc] hover:bg-[#3c8dbc] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
          <Card className="bg-white border-gray-200">
            <CardContent className="p-6 text-center">
              <p className="text-red-600">{error || "Commission report not found"}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const totalCommission = agentBreakdown.reduce((sum, agent) => sum + agent.comm, 0)
  const totalNetCommission = agentBreakdown.reduce((sum, agent) => sum + agent.agent_net_comm, 0)
  const totalSalesAmount = salesData.reduce((sum, sale) => sum + (sale.total_actual_amount || 0), 0)

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="border-[#3c8dbc] text-[#3c8dbc] hover:bg-[#3c8dbc] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-[#001f3f]">Commission Report #{report.report_number}</h1>
            <p className="text-gray-600">Detailed breakdown and sales information</p>
          </div>
        </div>

        {/* Report Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-white border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#001f3f]">Report Status</CardTitle>
              <FileText className="h-4 w-4 text-[#3c8dbc]" />
            </CardHeader>
            <CardContent>
              <Badge
                className={
                  report.status.toLowerCase() === "active"
                    ? "bg-[#28a745] text-white hover:bg-[#28a745]/90"
                    : report.status.toLowerCase() === "pending"
                      ? "bg-[#ffc107] text-[#001f3f] hover:bg-[#ffc107]/90"
                      : "bg-[#3c8dbc] text-white hover:bg-[#3c8dbc]/90"
                }
              >
                {report.status.toUpperCase()}
              </Badge>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#001f3f]">Total Commission</CardTitle>
              <DollarSign className="h-4 w-4 text-[#28a745]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#28a745]">{formatCurrency(totalCommission)}</div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#001f3f]">Net Commission</CardTitle>
              <DollarSign className="h-4 w-4 text-[#01ff70]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#01ff70]">{formatCurrency(totalNetCommission)}</div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#001f3f]">Total Sales</CardTitle>
              <Hash className="h-4 w-4 text-[#ff851b]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff851b]">{salesData.length}</div>
              <p className="text-xs text-gray-600">{formatCurrency(totalSalesAmount)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Report Details */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#001f3f]">
              <FileText className="h-5 w-5 text-[#3c8dbc]" />
              Report Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-[#3c8dbc]" />
                <span className="font-medium text-[#001f3f]">Created By:</span>
                <span className="text-gray-700">{report.user_profiles?.full_name || "Unknown User"}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#3c8dbc]" />
                <span className="font-medium text-[#001f3f]">Assigned Area:</span>
                <span className="text-gray-700">{report.user_profiles?.assigned_area || "N/A"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#3c8dbc]" />
                <span className="font-medium text-[#001f3f]">Created Date:</span>
                <span className="text-gray-700">{new Date(report.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#3c8dbc]" />
                <span className="font-medium text-[#001f3f]">Last Updated:</span>
                <span className="text-gray-700">{new Date(report.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
            {report.remarks && (
              <div>
                <span className="font-medium text-[#001f3f]">Remarks:</span>
                <p className="mt-1 text-gray-700">{report.remarks}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Agent Breakdown */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#001f3f]">
              <Users className="h-5 w-5 text-[#3c8dbc]" />
              Commission Agent Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200">
                    <TableHead className="text-[#001f3f] font-semibold">Agent</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Developer</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Client</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Commission</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Agent Rate</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Net Commission</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentBreakdown.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                        No agent breakdown data found
                      </TableCell>
                    </TableRow>
                  ) : (
                    agentBreakdown.map((agent) => (
                      <TableRow key={agent.uuid} className="border-gray-100">
                        <TableCell className="font-medium text-gray-900">{agent.agent_name}</TableCell>
                        <TableCell className="text-gray-700">{agent.developer || "N/A"}</TableCell>
                        <TableCell className="text-gray-700">{agent.client || "N/A"}</TableCell>
                        <TableCell className="text-[#28a745] font-medium">{formatCurrency(agent.comm)}</TableCell>
                        <TableCell className="text-gray-700">{formatPercentage(agent.agents_rate)}</TableCell>
                        <TableCell className="text-[#01ff70] font-medium">
                          {formatCurrency(agent.agent_net_comm)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              agent.status.toLowerCase() === "active"
                                ? "bg-[#28a745] text-white hover:bg-[#28a745]/90"
                                : agent.status.toLowerCase() === "pending"
                                  ? "bg-[#ffc107] text-[#001f3f] hover:bg-[#ffc107]/90"
                                  : "bg-[#3c8dbc] text-white hover:bg-[#3c8dbc]/90"
                            }
                          >
                            {agent.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Sales Information */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#001f3f]">
              <Building2 className="h-5 w-5 text-[#3c8dbc]" />
              Sales Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200">
                    <TableHead className="text-[#001f3f] font-semibold">TIN</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Taxpayer Name</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Tax Month</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Type</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Address</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Gross Taxable</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Tax Type</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Invoice Number</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Actual Amount</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Sale Type</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Status</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Agent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-8 text-gray-400">
                        No sales data found
                      </TableCell>
                    </TableRow>
                  ) : (
                    salesData.map((sale) => (
                      <TableRow key={sale.id} className="border-gray-100">
                        <TableCell className="font-mono text-gray-900">{sale.tin || "N/A"}</TableCell>
                        <TableCell className="font-medium text-gray-900">{sale.name || "N/A"}</TableCell>
                        <TableCell className="text-gray-700">
                          {sale.tax_month ? new Date(sale.tax_month).toLocaleDateString() : "N/A"}
                        </TableCell>
                        <TableCell className="text-gray-700">{sale.type || "N/A"}</TableCell>
                        <TableCell className="text-gray-700 max-w-xs truncate">
                          {`${sale.substreet_street_brgy || ""} ${sale.district_city_zip || ""}`.trim() || "N/A"}
                        </TableCell>
                        <TableCell className="text-[#28a745] font-medium">
                          {formatCurrency(sale.gross_taxable)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              sale.tax_type?.toLowerCase() === "vat"
                                ? "bg-[#3c8dbc] text-white hover:bg-[#3c8dbc]/90"
                                : "bg-[#ffc107] text-[#001f3f] hover:bg-[#ffc107]/90"
                            }
                          >
                            {sale.tax_type?.toUpperCase() || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-gray-700">{sale.invoice_number || "N/A"}</TableCell>
                        <TableCell className="text-[#01ff70] font-medium">
                          {formatCurrency(sale.total_actual_amount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              sale.sale_type?.toLowerCase() === "invoice"
                                ? "bg-[#28a745] text-white hover:bg-[#28a745]/90"
                                : "bg-[#ff851b] text-white hover:bg-[#ff851b]/90"
                            }
                          >
                            {sale.sale_type?.toUpperCase() || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              sale.is_complete
                                ? "bg-[#28a745] text-white hover:bg-[#28a745]/90"
                                : "bg-[#ffc107] text-[#001f3f] hover:bg-[#ffc107]/90"
                            }
                          >
                            {sale.is_complete ? "COMPLETE" : "PENDING"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-700">{sale.user_full_name || "N/A"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
