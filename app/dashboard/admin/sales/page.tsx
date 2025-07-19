"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Filter, Download, Eye, Edit, Trash2, FileText, Calendar, MapPin } from "lucide-react"
import { format } from "date-fns"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase/client"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardHeader } from "@/components/dashboard-header"
import { AddSalesModal } from "@/components/add-sales-modal"
import { ViewSalesModal } from "@/components/view-sales-modal"
import { EditSalesModal } from "@/components/edit-sales-modal"
import type { Sales } from "@/types/sales"
import * as XLSX from "xlsx"

export default function AdminSalesPage() {
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
        return "bg-blue-100 text-blue-800"
      case "non-vat":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
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

  // Export to Excel function
  const exportToExcel = () => {
    // Calculate statistics
    const totalSales = sales.length
    const vatSales = sales.filter((s) => s.tax_type === "vat").length
    const nonVatSales = sales.filter((s) => s.tax_type === "non-vat").length
    const totalAmount = sales.reduce((sum, sale) => sum + (sale.gross_taxable || 0), 0)

    // Create workbook
    const wb = XLSX.utils.book_new()

    // Create summary data
    const summaryData = [
      ["SALES MANAGEMENT REPORT"],
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
      ["Total Sales", totalSales, "Total records"],
      ["VAT Sales", vatSales, "VAT registered"],
      ["Non-VAT Sales", nonVatSales, "Non-VAT registered"],
      ["Total Amount", formatCurrency(totalAmount), "Gross taxable"],
      [""],
      ["DETAILED SALES RECORDS"],
      [
        "Tax Month",
        "TIN",
        "Name",
        "Address",
        "Tax Type",
        "Gross Taxable",
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

    // Add sales data
    sales.forEach((sale) => {
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
        sale.gross_taxable || 0,
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
      { width: 15 }, // Gross Taxable
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
    if (ws["A10"]) ws["A10"].s = summaryHeaderStyle

    // Style the data header row
    for (let col = 0; col < 15; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: 10, c: col })
      if (ws[cellRef]) {
        ws[cellRef].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: "E7E6E6" } },
          alignment: { horizontal: "center" },
        }
      }
    }

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Sales Report")

    // Generate filename with current date
    const filename = `Sales_Report_${new Date().toISOString().split("T")[0]}.xlsx`

    // Save file
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    const blob = new Blob([new Uint8Array(wbout)], { type: "application/octet-stream" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="min-h-screen bg-gray-50 pt-20">
        <DashboardHeader />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Sales Management</h1>
                <p className="mt-2 text-gray-600">Manage and track sales records and tax filings</p>
              </div>
              <div className="mt-4 sm:mt-0">
                <AddSalesModal onSalesAdded={fetchSales} />
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{sales.length}</div>
                <p className="text-xs text-muted-foreground">Total records</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">VAT Sales</CardTitle>
                <Badge className="bg-blue-100 text-blue-800">VAT</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{sales.filter((s) => s.tax_type === "vat").length}</div>
                <p className="text-xs text-muted-foreground">VAT registered</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Non-VAT Sales</CardTitle>
                <Badge className="bg-green-100 text-green-800">Non-VAT</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{sales.filter((s) => s.tax_type === "non-vat").length}</div>
                <p className="text-xs text-muted-foreground">Non-VAT registered</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(sales.reduce((sum, sale) => sum + (sale.gross_taxable || 0), 0))}
                </div>
                <p className="text-xs text-muted-foreground">Gross taxable</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by name, TIN, or invoice..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={filterTaxType} onValueChange={setFilterTaxType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by tax type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tax Types</SelectItem>
                    <SelectItem value="vat">VAT</SelectItem>
                    <SelectItem value="non-vat">Non-VAT</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {monthOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterArea} onValueChange={setFilterArea}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by area" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Areas</SelectItem>
                    {availableAreas.map((area) => (
                      <SelectItem key={area} value={area}>
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
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sales Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Sales Records</CardTitle>
                  <CardDescription>{loading ? "Loading..." : `${sales.length} records found`}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={exportToExcel}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tax Month</TableHead>
                      <TableHead>TIN</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Tax Type</TableHead>
                      <TableHead>Gross Taxable</TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Pickup Date</TableHead>
                      <TableHead>Area</TableHead>
                      <TableHead>Files</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8">
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                            <span className="ml-2">Loading sales records...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : sales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                          No sales records found
                        </TableCell>
                      </TableRow>
                    ) : (
                      sales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell>{format(new Date(sale.tax_month), "MMM yyyy")}</TableCell>
                          <TableCell className="font-mono">{formatTin(sale.tin)}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{sale.name}</div>
                              {sale.substreet_street_brgy && (
                                <div className="text-sm text-gray-500">{sale.substreet_street_brgy}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getTaxTypeBadgeColor(sale.tax_type)}>
                              {sale.tax_type?.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(sale.gross_taxable || 0)}</TableCell>
                          <TableCell>{sale.invoice_number || "-"}</TableCell>
                          <TableCell>
                            {sale.pickup_date ? format(new Date(sale.pickup_date), "MMM dd, yyyy") : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <MapPin className="h-3 w-3 text-gray-400 mr-1" />
                              <span className="text-sm">{sale.user_assigned_area || "N/A"}</span>
                            </div>
                          </TableCell>
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
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button variant="ghost" size="sm" onClick={() => handleViewSale(sale)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleEditSale(sale)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSoftDelete(sale)}
                                className="text-red-600 hover:text-red-700"
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
            </CardContent>
          </Card>
        </div>

        {/* Modals */}
        <ViewSalesModal open={viewModalOpen} onOpenChange={setViewModalOpen} sale={selectedSale} />

        <EditSalesModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          sale={selectedSale}
          onSalesUpdated={fetchSales}
        />
      </div>
    </ProtectedRoute>
  )
}
