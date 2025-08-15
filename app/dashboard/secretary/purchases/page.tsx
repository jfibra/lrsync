"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  BarChart3,
  Calendar,
  Edit,
  Eye,
  MapPin,
  MessageSquarePlus,
  Plus,
  Search,
  Trash2,
  Download,
  FileSpreadsheet,
} from "lucide-react"
import { format } from "date-fns"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase/client"
import { logNotification } from "@/utils/logNotification"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardHeader } from "@/components/dashboard-header"
import { PurchasesExportModal } from "@/components/purchases-export-modal"
import { ColumnVisibilityControl } from "@/components/column-visibility-control"
import * as XLSX from "xlsx"

// Import modals
import { AddPurchasesModal } from "@/components/add-purchases-modal"
import { ViewPurchasesModal } from "@/components/view-purchases-modal"
import { EditPurchasesModal } from "@/components/edit-purchases-modal"
import { AddPurchasesRemarkModal } from "@/components/add-purchases-remark-modal"

interface Purchase {
  id: string
  tax_month: string
  tin_id: string | null
  tin: string
  name: string
  substreet_street_brgy: string | null
  district_city_zip: string | null
  gross_taxable: number
  invoice_number: string | null
  tax_type: string
  official_receipt: string | null
  date_added: string | null
  user_uuid: string | null
  user_full_name: string | null
  remarks: string | null
  is_deleted: boolean
  deleted_at: string | null
  updated_at: string
  created_at: string
  user_assigned_area?: string | null
}

export default function SecretaryPurchasesPage() {
  const { profile } = useAuth()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterTaxType, setFilterTaxType] = useState("all")
  const [filterMonth, setFilterMonth] = useState("all")

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [remarkModalOpen, setRemarkModalOpen] = useState(false)
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null)

  const [sortField, setSortField] = useState<string>("created_at")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

  // Statistics
  const totalPurchases = purchases.length
  const totalGrossTaxable = purchases.reduce((sum, purchase) => sum + (purchase.gross_taxable || 0), 0)
  const vatPurchases = purchases.filter((p) => p.tax_type === "vat").length
  const nonVatPurchases = purchases.filter((p) => p.tax_type === "non-vat").length

  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [columnVisibility, setColumnVisibility] = useState({
    tax_month: true,
    tin: true,
    name: true,
    tax_type: true,
    gross_taxable: true,
    invoice_number: true,
    official_receipt: true,
    remark: true,
    actions: true,
  })

  const getMostRecentRemark = (remarksJson: string | null) => {
    if (!remarksJson) return null
    try {
      const remarks = JSON.parse(remarksJson)
      if (Array.isArray(remarks) && remarks.length > 0) {
        return remarks[remarks.length - 1]
      }
    } catch {
      return null
    }
    return null
  }

  const fetchPurchases = async () => {
    try {
      setLoading(true)

      if (!profile?.assigned_area) {
        console.log("No assigned area found for secretary")
        setPurchases([])
        return
      }

      let purchasesQuery = supabase
        .from("purchases")
        .select("*")
        .eq("is_deleted", false)
        .order(sortField, { ascending: sortDirection === "asc" })

      // Apply filters
      if (searchTerm) {
        purchasesQuery = purchasesQuery.or(
          `name.ilike.%${searchTerm}%,tin.ilike.%${searchTerm}%,invoice_number.ilike.%${searchTerm}%`,
        )
      }

      if (filterTaxType !== "all") {
        purchasesQuery = purchasesQuery.eq("tax_type", filterTaxType)
      }

      if (filterMonth !== "all") {
        const [year, month] = filterMonth.split("-")
        const startDate = `${year}-${month}-01`
        const nextMonth = Number.parseInt(month) === 12 ? 1 : Number.parseInt(month) + 1
        const nextYear = Number.parseInt(month) === 12 ? Number.parseInt(year) + 1 : Number.parseInt(year)
        const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
        purchasesQuery = purchasesQuery.gte("tax_month", startDate).lt("tax_month", endDate)
      }

      const { data: purchasesData, error: purchasesError } = await purchasesQuery

      if (purchasesError) throw purchasesError

      // Get user profiles for the users who created these purchases
      const userUuids = [...new Set(purchasesData?.map((purchase) => purchase.user_uuid).filter(Boolean))]

      let userProfiles = []
      if (userUuids.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("user_profiles")
          .select("auth_user_id, assigned_area, full_name")
          .in("auth_user_id", userUuids)

        if (profilesError) throw profilesError
        userProfiles = profilesData || []
      }

      // Combine purchases data with user profiles
      const purchasesWithProfiles =
        purchasesData?.map((purchase) => {
          const userProfile = userProfiles.find((profile) => profile.auth_user_id === purchase.user_uuid)
          return {
            ...purchase,
            user_assigned_area: userProfile?.assigned_area || null,
          }
        }) || []

      const filteredData = purchasesWithProfiles.filter(
        (purchase) => purchase.user_assigned_area === profile.assigned_area,
      )

      setPurchases(filteredData)
    } catch (error) {
      console.error("Error fetching purchases:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterTaxType, filterMonth])

  useEffect(() => {
    if (profile?.assigned_area) {
      fetchPurchases()
    }
  }, [searchTerm, filterTaxType, filterMonth, sortField, sortDirection, profile?.assigned_area])

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount)
  }

  // Format TIN display
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

  // Generate tax month options for filter
  const generateTaxMonthOptions = () => {
    const options = []
    const currentDate = new Date()

    for (let i = 0; i < 24; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const monthName = date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      const value = `${year}-${String(month).padStart(2, "0")}`

      options.push({
        label: monthName,
        value: value,
      })
    }

    return options
  }

  const taxMonthOptions = generateTaxMonthOptions()

  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  // Handle modal actions
  const handleViewPurchase = (purchase: Purchase) => {
    setSelectedPurchase(purchase)
    setViewModalOpen(true)
  }

  const handleEditPurchase = (purchase: Purchase) => {
    setSelectedPurchase(purchase)
    setEditModalOpen(true)
  }

  const handleAddRemark = (purchase: Purchase) => {
    setSelectedPurchase(purchase)
    setRemarkModalOpen(true)
  }

  const handleSoftDelete = async (purchase: Purchase) => {
    if (!confirm(`Are you sure you want to delete the purchase record for ${purchase.name}?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from("purchases")
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        })
        .eq("id", purchase.id)

      if (error) throw error

      // Log notification
      if (profile?.id) {
        await logNotification(supabase, {
          action: "purchase_deleted",
          description: `Purchase record deleted for ${purchase.name} (TIN: ${purchase.tin})`,
          ip_address: null,
          location: null,
          meta: JSON.stringify({
            purchaseId: purchase.id,
            deletedBy: profile?.full_name || "",
            role: profile?.role || "",
            area: profile?.assigned_area,
          }),
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
          user_email: profile.email,
          user_name: profile.full_name || profile.first_name || profile.id,
          user_uuid: profile.id,
        })
      }

      fetchPurchases()
    } catch (error) {
      console.error("Error deleting purchase:", error)
      alert("Error deleting purchase record. Please try again.")
    }
  }

  // Pagination
  const totalPages = Math.ceil(purchases.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedPurchases = purchases.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handlePageSizeChange = (newPageSize: string) => {
    setPageSize(Number.parseInt(newPageSize))
    setCurrentPage(1)
  }

  const handleStandardExport = async () => {
    try {
      const exportData = purchases.map((purchase) => ({
        "Tax Month": format(new Date(purchase.tax_month), "MMMM yyyy"),
        TIN: formatTin(purchase.tin),
        Name: purchase.name,
        "Address (Street/Brgy)": purchase.substreet_street_brgy || "",
        "Address (City/District)": purchase.district_city_zip || "",
        "Tax Type": purchase.tax_type?.toUpperCase() || "",
        "Gross Taxable Amount": purchase.gross_taxable || 0,
        "Invoice Number": purchase.invoice_number || "",
        "Date Created": format(new Date(purchase.created_at), "MMM dd, yyyy HH:mm"),
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(exportData)

      const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
        wch: Math.max(key.length, 15),
      }))
      ws["!cols"] = colWidths

      XLSX.utils.book_append_sheet(wb, ws, "Purchases")

      const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm")
      const filename = `purchases_${profile?.assigned_area}_${timestamp}.xlsx`
      XLSX.writeFile(wb, filename)

      if (profile?.id) {
        await logNotification(supabase, {
          action: "purchases_exported",
          description: `Purchases data exported to Excel (${purchases.length} records) for ${profile?.assigned_area}`,
          ip_address: null,
          location: null,
          meta: JSON.stringify({
            recordCount: purchases.length,
            filename,
            role: "secretary",
            area: profile?.assigned_area,
            exportedBy: profile?.full_name || "",
          }),
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
          user_email: profile.email,
          user_name: profile.full_name || profile.first_name || profile.id,
          user_uuid: profile.id,
        })
      }
    } catch (error) {
      console.error("Error exporting purchases:", error)
      alert("Error exporting data. Please try again.")
    }
  }

  return (
    <ProtectedRoute allowedRoles={["secretary"]}>
      <div style={{ background: "#fff" }} className="min-h-screen">
        <DashboardHeader />

        <div className="pt-20 px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                  <BarChart3 className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-gray-900">Purchases Management</h1>
                  <p className="text-gray-600 mt-1">
                    Purchase tracking for {profile?.assigned_area || "your assigned area"}
                  </p>
                </div>
              </div>
              <div className="mt-4 sm:mt-0">
                <Button onClick={() => setAddModalOpen(true)} className="bg-[#001f3f] hover:bg-[#001f3f]/90 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Purchase Record
                </Button>
              </div>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="bg-gradient-to-r from-indigo-500 to-indigo-600 border-0 shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-indigo-100">Total Purchases</CardTitle>
                <BarChart3 className="h-8 w-8 text-indigo-200" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{totalPurchases}</div>
                <p className="text-xs text-indigo-100">Total records</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-blue-500 to-blue-600 border-0 shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-100">VAT Purchases</CardTitle>
                <Calendar className="h-8 w-8 text-blue-200" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{vatPurchases}</div>
                <p className="text-xs text-blue-100">VAT registered</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-green-500 to-green-600 border-0 shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-green-100">Non-VAT Purchases</CardTitle>
                <MapPin className="h-8 w-8 text-green-200" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{nonVatPurchases}</div>
                <p className="text-xs text-green-100">Non-VAT registered</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-purple-500 to-purple-600 border-0 shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-purple-100">Total Amount</CardTitle>
                <BarChart3 className="h-8 w-8 text-purple-200" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{formatCurrency(totalGrossTaxable)}</div>
                <p className="text-xs text-purple-100">Gross taxable</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6 shadow-lg border border-gray-200 bg-white">
            <CardHeader className="bg-gray-50 border-b border-gray-200">
              <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Search className="h-5 w-5 text-indigo-600" />
                Filters - {profile?.assigned_area || "Your Area"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                    {taxMonthOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="text-gray-900 hover:bg-gray-100">
                        {option.label}
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
                  }}
                  style={{ background: "#fff", color: "#001f3f", border: "1px solid #001f3f" }}
                  className="w-full font-semibold shadow-md hover:text-[#ee3433] transition-all duration-150 flex items-center justify-center gap-2"
                >
                  <Search className="h-4 w-4 mr-1" style={{ color: "#001f3f" }} />
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Purchases Table */}
          <Card style={{ background: "#f9f9f9", border: "1px solid #e0e0e0" }} className="shadow-lg">
            <CardHeader style={{ background: "#fff", borderBottom: "1px solid #e0e0e0" }}>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold flex items-center gap-2" style={{ color: "#001f3f" }}>
                    <BarChart3 className="h-6 w-6" style={{ color: "#001f3f" }} />
                    Purchase Records
                  </CardTitle>
                  <CardDescription style={{ color: "#555" }} className="mt-1">
                    {loading
                      ? "Loading..."
                      : `${purchases.length} records found in ${profile?.assigned_area || "your area"}`}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <ColumnVisibilityControl
                    columns={[
                      { key: "tax_month", label: "Tax Month" },
                      { key: "tin", label: "TIN" },
                      { key: "name", label: "Name" },
                      { key: "tax_type", label: "Tax Type" },
                      { key: "gross_taxable", label: "Gross Taxable" },
                      { key: "invoice_number", label: "Invoice #" },
                      { key: "official_receipt", label: "Official Receipt" },
                      { key: "remark", label: "Remark" },
                      { key: "actions", label: "Actions" },
                    ]}
                    visibility={columnVisibility}
                    onVisibilityChange={setColumnVisibility}
                    role="secretary"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStandardExport}
                    className="bg-white border-indigo-300 text-indigo-600 hover:bg-indigo-50"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExportModalOpen(true)}
                    className="bg-white border-indigo-300 text-indigo-600 hover:bg-indigo-50"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Custom Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow style={{ background: "#fff", borderBottom: "1px solid #e0e0e0" }}>
                      {columnVisibility.tax_month && (
                        <TableHead
                          className="min-w-[120px] font-semibold cursor-pointer select-none"
                          style={{ color: "#001f3f" }}
                          onClick={() => handleSort("tax_month")}
                        >
                          Tax Month
                          {sortField === "tax_month" && (
                            <span className="ml-1">{sortDirection === "asc" ? "▲" : "▼"}</span>
                          )}
                        </TableHead>
                      )}
                      {columnVisibility.tin && (
                        <TableHead
                          className="min-w-[120px] font-semibold cursor-pointer select-none"
                          style={{ color: "#001f3f" }}
                          onClick={() => handleSort("tin")}
                        >
                          TIN
                          {sortField === "tin" && <span className="ml-1">{sortDirection === "asc" ? "▲" : "▼"}</span>}
                        </TableHead>
                      )}
                      {columnVisibility.name && (
                        <TableHead className="min-w-[180px] font-semibold" style={{ color: "#001f3f" }}>
                          Name
                        </TableHead>
                      )}
                      {columnVisibility.tax_type && (
                        <TableHead className="min-w-[100px] font-semibold" style={{ color: "#001f3f" }}>
                          Tax Type
                        </TableHead>
                      )}
                      {columnVisibility.gross_taxable && (
                        <TableHead
                          className="min-w-[120px] font-semibold cursor-pointer select-none"
                          style={{ color: "#001f3f" }}
                          onClick={() => handleSort("gross_taxable")}
                        >
                          Gross Taxable
                          {sortField === "gross_taxable" && (
                            <span className="ml-1">{sortDirection === "asc" ? "▲" : "▼"}</span>
                          )}
                        </TableHead>
                      )}
                      {columnVisibility.invoice_number && (
                        <TableHead className="min-w-[120px] font-semibold" style={{ color: "#001f3f" }}>
                          Invoice #
                        </TableHead>
                      )}
                      {columnVisibility.official_receipt && (
                        <TableHead className="min-w-[120px] font-semibold" style={{ color: "#001f3f" }}>
                          Official Receipt
                        </TableHead>
                      )}
                      {columnVisibility.remark && (
                        <TableHead className="min-w-[200px] font-semibold" style={{ color: "#001f3f" }}>
                          Remark
                        </TableHead>
                      )}
                      {columnVisibility.actions && (
                        <TableHead className="min-w-[150px] font-semibold" style={{ color: "#001f3f" }}>
                          Actions
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12">
                          <div className="flex flex-col items-center justify-center">
                            <div
                              className="animate-spin rounded-full h-12 w-12"
                              style={{ borderBottom: "2px solid #001f3f" }}
                            ></div>
                            <span className="text-[#001f3f] font-medium mt-4">Loading purchase records...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : purchases.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12">
                          <BarChart3 className="h-16 w-16 text-[#001f3f]/30 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-[#001f3f] mb-2">No purchase records found</h3>
                          <p className="text-[#001f3f]/70">
                            {profile?.assigned_area
                              ? `No purchase records found for ${profile.assigned_area}`
                              : "No purchase records found"}
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedPurchases.map((purchase) => {
                        const recentRemark = getMostRecentRemark(purchase.remarks)

                        return (
                          <TableRow
                            key={purchase.id}
                            className="hover:bg-[#001f3f]/5 transition-colors border-b border-[#001f3f]/10"
                          >
                            {columnVisibility.tax_month && (
                              <TableCell className="text-[#001f3f] font-medium">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-[#3c8dbc]" />
                                  {format(new Date(purchase.tax_month), "MMM yyyy")}
                                </div>
                              </TableCell>
                            )}
                            {columnVisibility.tin && (
                              <TableCell className="font-mono text-[#001f3f]">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-[#3c8dbc] rounded-full"></div>
                                  {formatTin(purchase.tin)}
                                </div>
                              </TableCell>
                            )}
                            {columnVisibility.name && (
                              <TableCell className="text-[#001f3f]">
                                <div>
                                  <div className="font-medium">{purchase.name}</div>
                                  {purchase.substreet_street_brgy && (
                                    <div className="text-sm text-[#001f3f]/70 flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {purchase.substreet_street_brgy}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            )}
                            {columnVisibility.tax_type && (
                              <TableCell>
                                <Badge className={getTaxTypeBadgeColor(purchase.tax_type)}>
                                  {purchase.tax_type?.toUpperCase()}
                                </Badge>
                              </TableCell>
                            )}
                            {columnVisibility.gross_taxable && (
                              <TableCell className="text-[#001f3f] font-semibold">
                                {formatCurrency(purchase.gross_taxable || 0)}
                              </TableCell>
                            )}
                            {columnVisibility.invoice_number && (
                              <TableCell className="text-[#001f3f]/70">{purchase.invoice_number || "-"}</TableCell>
                            )}
                            {columnVisibility.official_receipt && (
                              <TableCell className="text-[#001f3f]/70">
                                {(() => {
                                  let files: string[] = []
                                  try {
                                    if (purchase.official_receipt) {
                                      const parsed = JSON.parse(purchase.official_receipt)
                                      files = Array.isArray(parsed) ? parsed : []
                                    }
                                  } catch {
                                    if (
                                      typeof purchase.official_receipt === "string" &&
                                      purchase.official_receipt.startsWith("http")
                                    ) {
                                      files = [purchase.official_receipt]
                                    }
                                  }
                                  if (!files.length) return <span>-</span>
                                  return (
                                    <div className="flex flex-col gap-1">
                                      {files.map((url, idx) => {
                                        const fixedUrl = url
                                          .split("/")
                                          .map((part, i, arr) =>
                                            i === arr.length - 1 ? encodeURIComponent(part).replace(/%20/g, "+") : part,
                                          )
                                          .join("/")
                                        const fileName = decodeURIComponent(
                                          url.split("/").pop() || `Receipt ${idx + 1}`,
                                        )
                                        return (
                                          <Button
                                            key={url}
                                            variant="outline"
                                            size="sm"
                                            className="w-full justify-start bg-white text-[#3c8dbc] border-[#3c8dbc] hover:bg-[#3c8dbc]/10 hover:text-[#001f3f] px-2 py-1 text-xs font-medium"
                                            onClick={() => window.open(fixedUrl, "_blank", "noopener,noreferrer")}
                                            title={fileName}
                                          >
                                            {fileName}
                                          </Button>
                                        )
                                      })}
                                    </div>
                                  )
                                })()}
                              </TableCell>
                            )}
                            {columnVisibility.remark && (
                              <TableCell className="text-[#001f3f]/70">
                                {recentRemark ? (
                                  <div className="max-w-[200px]">
                                    <div className="text-sm bg-[#001f3f]/10 p-2 rounded border-l-4 border-[#3c8dbc]">
                                      <div className="font-medium text-[#001f3f] truncate" title={recentRemark.remark}>
                                        {recentRemark.remark}
                                      </div>
                                      <div className="text-xs text-[#001f3f]/60 mt-1">
                                        by {recentRemark.name} • {format(new Date(recentRemark.date), "MMM dd, yyyy")}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[#001f3f]/40 italic">No remarks</span>
                                )}
                              </TableCell>
                            )}
                            {columnVisibility.actions && (
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleViewPurchase(purchase)}
                                    className="h-8 w-8 p-0 hover:bg-[#3c8dbc]/20"
                                  >
                                    <Eye className="h-4 w-4 text-[#3c8dbc]" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditPurchase(purchase)}
                                    className="h-8 w-8 p-0 hover:bg-[#ffc107]/20"
                                  >
                                    <Edit className="h-4 w-4 text-[#ffc107]" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleAddRemark(purchase)}
                                    className="h-8 w-8 p-0 hover:bg-[#3c8dbc]/20"
                                    title="Add Remark"
                                  >
                                    <MessageSquarePlus className="h-4 w-4 text-[#3c8dbc]" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSoftDelete(purchase)}
                                    className="h-8 w-8 p-0 hover:bg-[#dc3545]/20"
                                  >
                                    <Trash2 className="h-4 w-4 text-[#dc3545]" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
          <Card className="border-[#001f3f]/20 shadow-lg bg-white">
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#001f3f]">Show</span>
                    <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                      <SelectTrigger className="bg-white w-20 border-[#001f3f]/30 text-[#001f3f]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="200">200</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-[#001f3f]">records per page</span>
                  </div>
                  <div className="text-sm text-[#001f3f]">
                    Showing {startIndex + 1} to {Math.min(endIndex, purchases.length)} of {purchases.length} results
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="bg-[#001f3f] text-white hover:bg-[#001f3f]/90"
                  >
                    Previous
                  </Button>

                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNumber = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
                    if (pageNumber > totalPages) return null

                    return (
                      <Button
                        key={pageNumber}
                        variant={currentPage === pageNumber ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNumber)}
                        className={
                          currentPage === pageNumber
                            ? "bg-white text-[#001f3f] border-[#001f3f] hover:bg-[#001f3f]/10"
                            : "bg-[#001f3f] text-white hover:bg-[#001f3f]/90"
                        }
                      >
                        {pageNumber}
                      </Button>
                    )
                  })}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="bg-[#001f3f] text-white hover:bg-[#001f3f]/90"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Modals */}
          <AddPurchasesModal open={addModalOpen} onOpenChange={setAddModalOpen} onPurchaseAdded={fetchPurchases} />

          <ViewPurchasesModal open={viewModalOpen} onOpenChange={setViewModalOpen} purchase={selectedPurchase} />

          <EditPurchasesModal
            open={editModalOpen}
            onOpenChange={setEditModalOpen}
            purchase={selectedPurchase}
            onPurchaseUpdated={fetchPurchases}
          />

          <AddPurchasesRemarkModal
            open={remarkModalOpen}
            onOpenChange={setRemarkModalOpen}
            purchaseId={selectedPurchase?.id || ""}
            onRemarkAdded={fetchPurchases}
          />

          <PurchasesExportModal
            open={exportModalOpen}
            onOpenChange={setExportModalOpen}
            purchases={purchases}
            role="secretary"
          />
        </div>
      </div>
    </ProtectedRoute>
  )
}
