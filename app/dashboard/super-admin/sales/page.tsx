"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  FileText,
  Calendar,
  MapPin,
  TrendingUp,
  DollarSign,
  BarChart3,
} from "lucide-react"
import { format } from "date-fns"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase/client"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardHeader } from "@/components/dashboard-header"
import { AddSalesModal } from "@/components/add-sales-modal"
import { ViewSalesModal } from "@/components/view-sales-modal"
import { EditSalesModal } from "@/components/edit-sales-modal"
import { CustomExportModal } from "@/components/custom-export-modal"
import { ColumnVisibilityControl } from "@/components/column-visibility-control"
import type { Sales } from "@/types/sales"
import * as XLSX from "xlsx"

export default function SuperAdminSalesPage() {
  const { profile } = useAuth()
  const [sales, setSales] = useState<Sales[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterTaxType, setFilterTaxType] = useState("all")
  const [filterMonth, setFilterMonth] = useState("all")
  const [filterArea, setFilterArea] = useState("all")
  const [availableAreas, setAvailableAreas] = useState<string[]>([])

  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedSale, setSelectedSale] = useState<Sales | null>(null)

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState([
    { key: "tax_month", label: "Tax Month", visible: true },
    { key: "tin", label: "TIN", visible: true },
    { key: "name", label: "Name", visible: true },
    { key: "tax_type", label: "Tax Type", visible: true },
    { key: "sale_type", label: "Sale Type", visible: true },
    { key: "gross_taxable", label: "Gross Taxable", visible: true },
    { key: "total_actual_amount", label: "Total Actual Amount", visible: false },
    { key: "invoice_number", label: "Invoice #", visible: true },
    { key: "pickup_date", label: "Pickup Date", visible: true },
    { key: "area", label: "Area", visible: true },
    { key: "files", label: "Files", visible: true },
    { key: "actions", label: "Actions", visible: true },
  ])

  // Toggle column visibility
  const toggleColumnVisibility = (key: string) => {
    setColumnVisibility((prev) => prev.map((col) => (col.key === key ? { ...col, visible: !col.visible } : col)))
  }

  // Fetch available areas for filter dropdown
  const fetchAvailableAreas = async () => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("assigned_area")
        .not("assigned_area", "is", null)
        .order("assigned_area")

      if (error) throw error

      const uniqueAreas = [...new Set(data.map((item) => item.assigned_area).filter(Boolean))]
      setAvailableAreas(uniqueAreas)
    } catch (error) {
      console.error("Error fetching available areas:", error)
    }
  }

  // Fetch sales data
  const fetchSales = async () => {
    try {
      setLoading(true)

      // First get sales data
      let salesQuery = supabase
        .from("sales")
        .select(`
          *,
          taxpayer_listings (
            registered_name,
            substreet_street_brgy,
            district_city_zip
          )
        `)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })

      // Apply filters
      if (searchTerm) {
        salesQuery = salesQuery.or(
          `name.ilike.%${searchTerm}%,tin.ilike.%${searchTerm}%,invoice_number.ilike.%${searchTerm}%`,
        )
      }

      if (filterTaxType !== "all") {
        salesQuery = salesQuery.eq("tax_type", filterTaxType)
      }

      if (filterMonth !== "all") {
        const [year, month] = filterMonth.split("-")
        const startDate = `${year}-${month}-01`
        const nextMonth = Number.parseInt(month) === 12 ? 1 : Number.parseInt(month) + 1
        const nextYear = Number.parseInt(month) === 12 ? Number.parseInt(year) + 1 : Number.parseInt(year)
        const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
        salesQuery = salesQuery.gte("tax_month", startDate).lt("tax_month", endDate)
      }

      const { data: salesData, error: salesError } = await salesQuery

      if (salesError) throw salesError

      // Get user profiles for the users who created these sales
      const userUuids = [...new Set(salesData?.map((sale) => sale.user_uuid).filter(Boolean))]

      let userProfiles = []
      if (userUuids.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("user_profiles")
          .select("auth_user_id, assigned_area, full_name")
          .in("auth_user_id", userUuids)

        if (profilesError) throw profilesError
        userProfiles = profilesData || []
      }

      // Combine sales data with user profiles
      const salesWithProfiles =
        salesData?.map((sale) => {
          const userProfile = userProfiles.find((profile) => profile.auth_user_id === sale.user_uuid)
          return {
            ...sale,
            user_assigned_area: userProfile?.assigned_area || null,
          }
        }) || []

      // Filter by area if selected
      let filteredData = salesWithProfiles
      if (filterArea !== "all") {
        filteredData = filteredData.filter((sale) => sale.user_assigned_area === filterArea)
      }

      setSales(filteredData)
    } catch (error) {
      console.error("Error fetching sales:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAvailableAreas()
  }, [])

  useEffect(() => {
    fetchSales()
  }, [searchTerm, filterTaxType, filterMonth, filterArea])

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount)
  }

  // Format TIN display - add dash after every 3 digits
  const formatTin = (tin: string) => {
    const digits = tin.replace(/\D/g, "")
    return digits.replace(/(\d{3})(?=\d)/g, "$1-")
  }

  // Get tax type badge color
  const getTaxTypeBadgeColor = (taxType: string) => {
    switch (taxType) {
      case "vat":
        return "bg-blue-100 text-blue-800 border border-blue-200"
      case "non-vat":
        return "bg-green-100 text-green-800 border border-green-200"
      default:
        return "bg-gray-100 text-gray-800 border border-gray-200"
    }
  }

  // Generate month options for filter
  const generateMonthOptions = () => {
    const options = []
    const currentDate = new Date()

    for (let i = 0; i < 24; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, "0")
      const monthName = date.toLocaleDateString("en-US", { month: "long", year: "numeric" })

      options.push({
        value: `${year}-${month}`,
        label: monthName,
      })
    }

    return options
  }

  const monthOptions = generateMonthOptions()

  // Handle view sale
  const handleViewSale = (sale: Sales) => {
    setSelectedSale(sale)
    setViewModalOpen(true)
  }

  // Handle edit sale
  const handleEditSale = (sale: Sales) => {
    setSelectedSale(sale)
    setEditModalOpen(true)
  }

  // Handle soft delete
  const handleSoftDelete = async (sale: Sales) => {
    if (!confirm(`Are you sure you want to delete the sales record for ${sale.name}?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from("sales")
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        })
        .eq("id", sale.id)

      if (error) throw error

      // Refresh the data
      fetchSales()
    } catch (error) {
      console.error("Error deleting sales record:", error)
      alert("Error deleting sales record. Please try again.")
    }
  }

  // Export to Excel function - exclude non-invoice sales
  const exportToExcel = () => {
    // Filter out non-invoice sales for export
    const invoiceSales = sales.filter((sale) => sale.sale_type === "invoice")

    // Calculate statistics for invoice sales only
    const totalSales = invoiceSales.length
    const vatSales = invoiceSales.filter((s) => s.tax_type === "vat").length
    const nonVatSales = invoiceSales.filter((s) => s.tax_type === "non-vat").length
    const totalAmount = invoiceSales.reduce((sum, sale) => sum + (sale.gross_taxable || 0), 0)
    const totalActualAmount = invoiceSales.reduce((sum, sale) => sum + (sale.total_actual_amount || 0), 0)

    // Create workbook
    const wb = XLSX.utils.book_new()

    // Create summary data
    const summaryData = [
      ["SALES MANAGEMENT REPORT (Invoice Sales Only)"],
      [
        "Generated on:",
        new Date().toLocaleDateString("en-PH", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      ],
      [""],
      ["SUMMARY STATISTICS"],
      ["Total Invoice Sales", totalSales, "Total invoice records"],
      ["VAT Sales", vatSales, "VAT registered"],
      ["Non-VAT Sales", nonVatSales, "Non-VAT registered"],
      ["Total Gross Taxable", formatCurrency(totalAmount), "Gross taxable amount"],
      ["Total Actual Amount", formatCurrency(totalActualAmount), "Total actual amount"],
      [""],
      ["DETAILED SALES RECORDS"],
      [
        "Tax Month",
        "TIN",
        "Name",
        "Address",
        "Tax Type",
        "Sale Type",
        "Gross Taxable",
        "Total Actual Amount",
        "Invoice #",
        "Pickup Date",
        "Area",
        "Files Count",
        "Cheque Files",
        "Voucher Files",
        "Invoice Files",
        "2307 Files",
        "Deposit Files",
      ],
    ]

    // Add invoice sales data only
    invoiceSales.forEach((sale) => {
      const filesCount = [
        ...(sale.cheque || []),
        ...(sale.voucher || []),
        ...(sale.invoice || []),
        ...(sale.doc_2307 || []),
        ...(sale.deposit_slip || []),
      ].length

      summaryData.push([
        format(new Date(sale.tax_month), "MMM yyyy"),
        formatTin(sale.tin),
        sale.name,
        sale.substreet_street_brgy || "",
        sale.tax_type?.toUpperCase(),
        sale.sale_type?.toUpperCase() || "INVOICE",
        sale.gross_taxable || 0,
        sale.total_actual_amount || 0,
        sale.invoice_number || "",
        sale.pickup_date ? format(new Date(sale.pickup_date), "MMM dd, yyyy") : "",
        sale.user_assigned_area || "N/A",
        filesCount,
        sale.cheque?.join(", ") || "",
        sale.voucher?.join(", ") || "",
        sale.invoice?.join(", ") || "",
        sale.doc_2307?.join(", ") || "",
        sale.deposit_slip?.join(", ") || "",
      ])
    })

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(summaryData)

    // Set column widths
    ws["!cols"] = [
      { width: 15 }, // Tax Month
      { width: 15 }, // TIN
      { width: 30 }, // Name
      { width: 25 }, // Address
      { width: 12 }, // Tax Type
      { width: 12 }, // Sale Type
      { width: 15 }, // Gross Taxable
      { width: 15 }, // Total Actual Amount
      { width: 15 }, // Invoice #
      { width: 15 }, // Pickup Date
      { width: 15 }, // Area
      { width: 12 }, // Files Count
      { width: 30 }, // Cheque Files
      { width: 30 }, // Voucher Files
      { width: 30 }, // Invoice Files
      { width: 30 }, // 2307 Files
      { width: 30 }, // Deposit Files
    ]

    // Style the header rows
    const headerStyle = {
      font: { bold: true, size: 14 },
      fill: { fgColor: { rgb: "366092" } },
      alignment: { horizontal: "center" },
    }

    const summaryHeaderStyle = {
      font: { bold: true, size: 12 },
      fill: { fgColor: { rgb: "D9E2F3" } },
    }

    // Apply styles to specific cells
    if (ws["A1"]) ws["A1"].s = { font: { bold: true, size: 16 }, alignment: { horizontal: "center" } }
    if (ws["A4"]) ws["A4"].s = summaryHeaderStyle
    if (ws["A11"]) ws["A11"].s = summaryHeaderStyle

    // Style the data header row
    for (let col = 0; col < 17; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: 11, c: col })
      if (ws[cellRef]) {
        ws[cellRef].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: "E7E6E6" } },
          alignment: { horizontal: "center" },
        }
      }
    }

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Invoice Sales Report")

    // Generate filename with current date
    const filename = `Invoice_Sales_Report_${new Date().toISOString().split("T")[0]}.xlsx`

    /* ---- browser-safe download ---- */
    const wbArray = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    const blob = new Blob([wbArray], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Calculate stats
  const totalSales = sales.length
  const vatSales = sales.filter((s) => s.tax_type === "vat").length
  const nonVatSales = sales.filter((s) => s.tax_type === "non-vat").length
  const totalAmount = sales.reduce((sum, sale) => sum + (sale.gross_taxable || 0), 0)
  const totalActualAmount = sales.reduce((sum, sale) => sum + (sale.total_actual_amount || 0), 0)

  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />

        <div className="pt-20 px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                  <BarChart3 className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-gray-900">Sales Management</h1>
                  <p className="text-gray-600 mt-1">Comprehensive sales tracking and tax filing management</p>
                </div>
              </div>
              <div className="mt-4 sm:mt-0">
                <AddSalesModal onSalesAdded={fetchSales} />
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="bg-gradient-to-r from-indigo-500 to-indigo-600 border-0 shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-indigo-100">Total Sales</CardTitle>
                <FileText className="h-8 w-8 text-indigo-200" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{totalSales}</div>
                <p className="text-xs text-indigo-100">Total records</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-blue-500 to-blue-600 border-0 shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-100">VAT Sales</CardTitle>
                <TrendingUp className="h-8 w-8 text-blue-200" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{vatSales}</div>
                <p className="text-xs text-blue-100">VAT registered</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-green-500 to-green-600 border-0 shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-green-100">Non-VAT Sales</CardTitle>
                <BarChart3 className="h-8 w-8 text-green-200" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{nonVatSales}</div>
                <p className="text-xs text-green-100">Non-VAT registered</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-purple-500 to-purple-600 border-0 shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-purple-100">Total Amount</CardTitle>
                <DollarSign className="h-8 w-8 text-purple-200" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{formatCurrency(totalAmount)}</div>
                <p className="text-xs text-purple-100">Gross taxable</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6 shadow-lg border border-gray-200 bg-white">
            <CardHeader className="bg-gray-50 border-b border-gray-200">
              <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Filter className="h-5 w-5 text-indigo-600" />
                Advanced Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="relative col-span-full sm:col-span-1 lg:col-span-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by name, TIN, or invoice..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900"
                  />
                </div>
                <Select value={filterTaxType} onValueChange={setFilterTaxType}>
                  <SelectTrigger className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900">
                    <SelectValue placeholder="Filter by tax type" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200">
                    <SelectItem value="all" className="text-gray-900 hover:bg-gray-100">
                      All Tax Types
                    </SelectItem>
                    <SelectItem value="vat" className="text-gray-900 hover:bg-gray-100">
                      VAT
                    </SelectItem>
                    <SelectItem value="non-vat" className="text-gray-900 hover:bg-gray-100">
                      Non-VAT
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900">
                    <SelectValue placeholder="Filter by month" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200">
                    <SelectItem value="all" className="text-gray-900 hover:bg-gray-100">
                      All Months
                    </SelectItem>
                    {monthOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="text-gray-900 hover:bg-gray-100">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterArea} onValueChange={setFilterArea}>
                  <SelectTrigger className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900">
                    <SelectValue placeholder="Filter by area" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200">
                    <SelectItem value="all" className="text-gray-900 hover:bg-gray-100">
                      All Areas
                    </SelectItem>
                    {availableAreas.map((area) => (
                      <SelectItem key={area} value={area} className="text-gray-900 hover:bg-gray-100">
                        {area}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm("")
                    setFilterTaxType("all")
                    setFilterMonth("all")
                    setFilterArea("all")
                  }}
                  className="w-full border-gray-300 hover:bg-gray-50 text-gray-700"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sales Table */}
          <Card className="shadow-lg border border-gray-200 bg-white">
            <CardHeader className="bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <BarChart3 className="h-6 w-6 text-indigo-600" />
                    Sales Records
                  </CardTitle>
                  <CardDescription className="text-gray-600 mt-1">
                    {loading ? "Loading..." : `${sales.length} records found`}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <ColumnVisibilityControl columns={columnVisibility} onColumnToggle={toggleColumnVisibility} />
                  <CustomExportModal sales={sales} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToExcel}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white border-0 shadow-lg"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export (Invoice Only)
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 border-b border-gray-200">
                      {columnVisibility.find((col) => col.key === "tax_month")?.visible && (
                        <TableHead className="min-w-[120px] font-semibold text-gray-900">Tax Month</TableHead>
                      )}
                      {columnVisibility.find((col) => col.key === "tin")?.visible && (
                        <TableHead className="min-w-[120px] font-semibold text-gray-900">TIN</TableHead>
                      )}
                      {columnVisibility.find((col) => col.key === "name")?.visible && (
                        <TableHead className="min-w-[180px] font-semibold text-gray-900">Name</TableHead>
                      )}
                      {columnVisibility.find((col) => col.key === "tax_type")?.visible && (
                        <TableHead className="min-w-[100px] font-semibold text-gray-900">Tax Type</TableHead>
                      )}
                      {columnVisibility.find((col) => col.key === "sale_type")?.visible && (
                        <TableHead className="min-w-[100px] font-semibold text-gray-900">Sale Type</TableHead>
                      )}
                      {columnVisibility.find((col) => col.key === "gross_taxable")?.visible && (
                        <TableHead className="min-w-[120px] font-semibold text-gray-900">Gross Taxable</TableHead>
                      )}
                      {columnVisibility.find((col) => col.key === "total_actual_amount")?.visible && (
                        <TableHead className="min-w-[140px] font-semibold text-gray-900">Total Actual Amount</TableHead>
                      )}
                      {columnVisibility.find((col) => col.key === "invoice_number")?.visible && (
                        <TableHead className="min-w-[120px] font-semibold text-gray-900">Invoice #</TableHead>
                      )}
                      {columnVisibility.find((col) => col.key === "pickup_date")?.visible && (
                        <TableHead className="min-w-[120px] font-semibold text-gray-900">Pickup Date</TableHead>
                      )}
                      {columnVisibility.find((col) => col.key === "area")?.visible && (
                        <TableHead className="min-w-[100px] font-semibold text-gray-900">Area</TableHead>
                      )}
                      {columnVisibility.find((col) => col.key === "files")?.visible && (
                        <TableHead className="min-w-[150px] font-semibold text-gray-900">Files</TableHead>
                      )}
                      {columnVisibility.find((col) => col.key === "actions")?.visible && (
                        <TableHead className="min-w-[120px] font-semibold text-gray-900">Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center py-12">
                          <div className="flex flex-col items-center justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                            <span className="text-gray-600 font-medium">Loading sales records...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : sales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center py-12">
                          <BarChart3 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">No sales records found</h3>
                          <p className="text-gray-500">Create your first sales record to get started!</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      sales.map((sale) => (
                        <TableRow key={sale.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                          {columnVisibility.find((col) => col.key === "tax_month")?.visible && (
                            <TableCell className="text-gray-900 font-medium">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-indigo-500" />
                                {format(new Date(sale.tax_month), "MMM yyyy")}
                              </div>
                            </TableCell>
                          )}
                          {columnVisibility.find((col) => col.key === "tin")?.visible && (
                            <TableCell className="font-mono text-gray-900">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                                {formatTin(sale.tin)}
                              </div>
                            </TableCell>
                          )}
                          {columnVisibility.find((col) => col.key === "name")?.visible && (
                            <TableCell className="text-gray-900">
                              <div>
                                <div className="font-medium">{sale.name}</div>
                                {sale.substreet_street_brgy && (
                                  <div className="text-sm text-gray-500 flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {sale.substreet_street_brgy}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          )}
                          {columnVisibility.find((col) => col.key === "tax_type")?.visible && (
                            <TableCell>
                              <Badge className={getTaxTypeBadgeColor(sale.tax_type)}>
                                {sale.tax_type?.toUpperCase()}
                              </Badge>
                            </TableCell>
                          )}
                          {columnVisibility.find((col) => col.key === "sale_type")?.visible && (
                            <TableCell>
                              <Badge
                                className={
                                  sale.sale_type === "invoice"
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                    : "bg-orange-100 text-orange-800 border border-orange-200"
                                }
                              >
                                {sale.sale_type?.toUpperCase() || "INVOICE"}
                              </Badge>
                            </TableCell>
                          )}
                          {columnVisibility.find((col) => col.key === "gross_taxable")?.visible && (
                            <TableCell className="text-gray-900 font-semibold">
                              {formatCurrency(sale.gross_taxable || 0)}
                            </TableCell>
                          )}
                          {columnVisibility.find((col) => col.key === "total_actual_amount")?.visible && (
                            <TableCell className="text-gray-900 font-semibold">
                              {formatCurrency(sale.total_actual_amount || 0)}
                            </TableCell>
                          )}
                          {columnVisibility.find((col) => col.key === "invoice_number")?.visible && (
                            <TableCell className="text-gray-600">{sale.invoice_number || "-"}</TableCell>
                          )}
                          {columnVisibility.find((col) => col.key === "pickup_date")?.visible && (
                            <TableCell className="text-gray-600">
                              {sale.pickup_date ? format(new Date(sale.pickup_date), "MMM dd, yyyy") : "-"}
                            </TableCell>
                          )}
                          {columnVisibility.find((col) => col.key === "area")?.visible && (
                            <TableCell className="text-gray-600">
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-gray-400" />
                                <span className="text-sm bg-gray-100 px-2 py-1 rounded">
                                  {sale.user_assigned_area || "N/A"}
                                </span>
                              </div>
                            </TableCell>
                          )}
                          {columnVisibility.find((col) => col.key === "files")?.visible && (
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {sale.cheque && sale.cheque.length > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    Cheque ({sale.cheque.length})
                                  </Badge>
                                )}
                                {sale.voucher && sale.voucher.length > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    Voucher ({sale.voucher.length})
                                  </Badge>
                                )}
                                {sale.invoice && sale.invoice.length > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    Invoice ({sale.invoice.length})
                                  </Badge>
                                )}
                                {sale.doc_2307 && sale.doc_2307.length > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    2307 ({sale.doc_2307.length})
                                  </Badge>
                                )}
                                {sale.deposit_slip && sale.deposit_slip.length > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    Deposit ({sale.deposit_slip.length})
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                          )}
                          {columnVisibility.find((col) => col.key === "actions")?.visible && (
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewSale(sale)}
                                  className="h-8 w-8 p-0 hover:bg-blue-100"
                                >
                                  <Eye className="h-4 w-4 text-blue-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditSale(sale)}
                                  className="h-8 w-8 p-0 hover:bg-green-100"
                                >
                                  <Edit className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSoftDelete(sale)}
                                  className="h-8 w-8 p-0 hover:bg-red-100"
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Modals */}
        {selectedSale && (
          <>
            <ViewSalesModal sale={selectedSale} open={viewModalOpen} onOpenChange={setViewModalOpen} />
            <EditSalesModal
              sale={selectedSale}
              open={editModalOpen}
              onOpenChange={setEditModalOpen}
              onSalesUpdated={fetchSales}
            />
          </>
        )}
      </div>
    </ProtectedRoute>
  )
}
