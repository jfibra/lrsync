"use client"

import { useState, useEffect, useMemo } from "react"
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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MessageSquarePlus,
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
import { logNotification } from "@/utils/logNotification"
import { AddRemarkModal } from "@/components/add-remark-modal"
import { RemarksModalViewer } from "@/components/remarks-modal-viewer"

export default function SuperAdminSalesPage() {
  const { profile } = useAuth()
  const [sales, setSales] = useState<Sales[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterTaxType, setFilterTaxType] = useState("all")
  const [filterMonth, setFilterMonth] = useState("all")
  const [filterArea, setFilterArea] = useState("all")
  const [availableAreas, setAvailableAreas] = useState<string[]>([])

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedSale, setSelectedSale] = useState<Sales | null>(null)

  const [addRemarkModalOpen, setAddRemarkModalOpen] = useState(false)
  const [selectedSaleForRemark, setSelectedSaleForRemark] = useState<Sales | null>(null)

  const [saleIdToCommission, setSaleIdToCommission] = useState<Record<string, any>>({})
  const [creatorIdToName, setCreatorIdToName] = useState<Record<string, string>>({})

  const [commissionModalOpen, setCommissionModalOpen] = useState(false)
  const [selectedCommission, setSelectedCommission] = useState<any>(null)

  const [sortField, setSortField] = useState<string>("created_at")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState([
    { key: "tax_month", label: "Tax Month", visible: true },
    { key: "tin", label: "TIN", visible: true },
    { key: "name", label: "Name", visible: true },
    { key: "tax_type", label: "Tax Type", visible: true },
    { key: "sale_type", label: "Sale Type", visible: true },
    { key: "gross_taxable", label: "Gross Taxable", visible: true },
    {
      key: "total_actual_amount",
      label: "Total Actual Amount",
      visible: false,
    },
    { key: "invoice_number", label: "Invoice #", visible: true },
    { key: "pickup_date", label: "Pickup Date", visible: true },
    { key: "area", label: "Area", visible: true },
    { key: "recent_remark", label: "Recent Remark", visible: true },
    { key: "files", label: "Files", visible: true },
    { key: "actions", label: "Actions", visible: true },
  ])

  const [showOnlyWithRemarks, setShowOnlyWithRemarks] = useState(false)

  const [remarksModalOpen, setRemarksModalOpen] = useState(false)
  const [selectedSaleForRemarks, setSelectedSaleForRemarks] = useState<any>(null)

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

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  // Fetch sales data
  const fetchSales = async () => {
    try {
      setLoading(true)

      // First get sales data
      let salesQuery = supabase
        .from("sales")
        .select(
          `
            *,
            taxpayer_listings (
              registered_name,
              substreet_street_brgy,
              district_city_zip
            )
          `,
        )
        .eq("is_deleted", false)
        .order(sortField, { ascending: sortDirection === "asc" })
        .limit(1500)

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

      const saleIds = filteredData?.map((sale) => sale.id) || []
      let commissionReports = []
      if (saleIds.length > 0) {
        const { data: reportsData, error: reportsError } = await supabase
          .from("commission_report")
          .select("report_number, sales_uuids, created_by, created_at, status, deleted_at")
          .overlaps("sales_uuids", saleIds)

        if (reportsError) throw reportsError
        commissionReports = reportsData || []
      }

      // Map saleId to commission report info
      const saleIdToCommissionObj: Record<string, any> = {}
      commissionReports.forEach((report) => {
        ;(report.sales_uuids || []).forEach((saleId) => {
          saleIdToCommissionObj[saleId] = {
            report_number: report.report_number,
            created_by: report.created_by,
            created_at: report.created_at,
            status: report.status,
            deleted_at: report.deleted_at,
          }
        })
      })
      setSaleIdToCommission(saleIdToCommissionObj)

      const creatorIds = [...new Set(commissionReports.map((r) => r.created_by).filter(Boolean))]
      let creators = []
      if (creatorIds.length > 0) {
        const { data: creatorProfiles } = await supabase
          .from("user_profiles")
          .select("id, full_name")
          .in("id", creatorIds)
        creators = creatorProfiles || []
      }
      const creatorIdToNameObj = Object.fromEntries(creators.map((c) => [c.id, c.full_name]))
      setCreatorIdToName(creatorIdToNameObj)
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
  }, [searchTerm, filterTaxType, filterMonth, filterArea, sortField, sortDirection])

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
      const monthName = date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })

      options.push({
        value: `${year}-${month}`,
        label: monthName,
      })
    }

    return options
  }

  const monthOptions = generateMonthOptions()

  const getMostRecentRemark = (remarksJson: string | null) => {
    if (!remarksJson) return null

    try {
      const remarks = JSON.parse(remarksJson)
      if (!Array.isArray(remarks) || remarks.length === 0) return null

      // Sort by date descending and get the most recent
      const sortedRemarks = remarks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      return sortedRemarks[0]
    } catch (error) {
      console.error("Error parsing remarks JSON:", error)
      return null
    }
  }

  // Pagination calculations
  const paginatedSales = useMemo(() => {
    let filteredSales = sales
    if (showOnlyWithRemarks) {
      filteredSales = sales.filter((sale) => {
        const recentRemark = getMostRecentRemark(sale.remarks)
        const hasCommission = saleIdToCommission[sale.id] && !saleIdToCommission[sale.id].deleted_at
        return recentRemark || hasCommission
      })
    }

    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredSales.slice(startIndex, endIndex)
  }, [sales, currentPage, pageSize, showOnlyWithRemarks, saleIdToCommission])

  const filteredSalesCount = useMemo(() => {
    if (showOnlyWithRemarks) {
      return sales.filter((sale) => {
        const recentRemark = getMostRecentRemark(sale.remarks)
        const hasCommission = saleIdToCommission[sale.id] && !saleIdToCommission[sale.id].deleted_at
        return recentRemark || hasCommission
      }).length
    }
    return sales.length
  }, [sales, showOnlyWithRemarks, saleIdToCommission])

  const totalPages = Math.ceil(filteredSalesCount / pageSize)
  const startRecord = filteredSalesCount === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endRecord = Math.min(currentPage * pageSize, filteredSalesCount)

  // Reset to page 1 when search term changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterTaxType, filterMonth, filterArea])

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = []
    const maxVisiblePages = 5

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      const startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i)
      }
    }

    return pages
  }

  const pageNumbers = getPageNumbers()

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

  const handleAddRemark = (sale: Sales) => {
    setSelectedSaleForRemark(sale)
    setAddRemarkModalOpen(true)
  }

  const handleRemarkAdded = () => {
    fetchSales()
  }

  const getStatusBadgeClass = (status: string, deleted: boolean) => {
    if (deleted) return "bg-red-100 text-red-700 border border-red-200"
    switch ((status || "").toLowerCase()) {
      case "approved":
      case "completed":
        return "bg-green-100 text-green-700 border border-green-200"
      case "pending":
      case "new":
        return "bg-yellow-100 text-yellow-800 border border-yellow-200"
      case "rejected":
      case "cancelled":
        return "bg-gray-200 text-gray-700 border border-gray-300"
      default:
        return "bg-blue-100 text-blue-800 border border-blue-200"
    }
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

      if (profile?.id) {
        await logNotification(supabase, {
          action: "delete_sale",
          description: `Deleted sales record for ${sale.name} (ID: ${sale.id})`,
          ip_address: null,
          location: null,
          meta: JSON.stringify({
            user_id: profile.id,
            role: profile.role || "unknown",
            dashboard: "super_admin_sales",
            sale_id: sale.id,
            sale_name: sale.name,
          }),
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
          user_email: profile.email,
          user_name: profile.full_name || profile.first_name || profile.id,
          user_uuid: profile.id,
        })
      }
    } catch (error) {
      console.error("Error deleting sales record:", error)
      alert("Error deleting sales record. Please try again.")
    }
  }

  // Add this helper function inside your component
  const fetchAllSales = async () => {
    const { data, error } = await supabase
      .from("sales")
      .select(
        `
        *,
        taxpayer_listings (
          registered_name,
          substreet_street_brgy,
          district_city_zip
        )
      `,
      )
      .eq("is_deleted", false)
      .order(sortField, { ascending: sortDirection === "asc" })
      .limit(10000) // or use .range(0, 9999) for more than 1000 records

    if (error) {
      console.error("Error fetching all sales for export:", error)
      return []
    }
    return data || []
  }

  // Export to Excel function - exclude non-invoice sales
  const exportToExcel = async () => {
    // Determine if any filter or search is active
    const isFiltered = !!searchTerm || filterTaxType !== "all" || filterMonth !== "all" || filterArea !== "all"

    // If no filters/search, export all records (not just the current page)
    // If filtered, export only the filtered records (those in the datatable)
    const exportSales = isFiltered ? sales : await fetchAllSales()

    // Filter out non-invoice sales for export
    const invoiceSales = exportSales.filter((sale) => sale.sale_type === "invoice")

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
        "Recent Remark",
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
        sale.remarks ? JSON.parse(sale.remarks)[0]?.remark || "No remarks" : "No remarks",
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
      { width: 30 }, // Recent Remark
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
    if (ws["A1"])
      ws["A1"].s = {
        font: { bold: true, size: 16 },
        alignment: { horizontal: "center" },
      }
    if (ws["A4"]) ws["A4"].s = summaryHeaderStyle
    if (ws["A11"]) ws["A11"].s = summaryHeaderStyle

    // Style the data header row
    for (let col = 0; col < 18; col++) {
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

    if (profile?.id) {
      await logNotification(supabase, {
        action: "export_invoice_sales",
        description: `Exported invoice sales to Excel (${invoiceSales.length} records)`,
        ip_address: null,
        location: null,
        meta: JSON.stringify({
          user_id: profile.id,
          role: profile.role || "unknown",
          dashboard: "super_admin_sales",
          export_type: "invoice_only",
          record_count: invoiceSales.length,
        }),
        user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
        user_email: profile.email,
        user_name: profile.full_name || profile.first_name || profile.id,
        user_uuid: profile.id,
      })
    }
  }

  // Calculate stats
  const totalSales = sales.length
  const vatSales = sales.filter((s) => s.tax_type === "vat").length
  const nonVatSales = sales.filter((s) => s.tax_type === "non-vat").length
  const totalAmount = sales.reduce((sum, sale) => sum + (sale.gross_taxable || 0), 0)
  const totalActualAmount = sales.reduce((sum, sale) => sum + (sale.total_actual_amount || 0), 0)

  const handleRemarksUpdate = (saleId: string, updatedRemarks: any[]) => {
    setSales((prevSales) =>
      prevSales.map((sale) => (sale.id === saleId ? { ...sale, remarks: JSON.stringify(updatedRemarks) } : sale)),
    )
  }

  const RecentRemarkDisplay = ({
    remark,
    commission,
    onCommissionClick,
    sale,
  }: {
    remark: any
    commission?: { report_number: number; created_by: string; created_at: string; status?: string; deleted_at?: string }
    onCommissionClick?: (commission: any) => void
    sale?: any
  }) => {
    const hasRemarks = sale?.remarks && JSON.parse(sale.remarks || "[]").length > 0

    if (remark) {
      return (
        <div className="space-y-2">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 max-w-xs">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 font-medium mb-1 line-clamp-2">{remark.remark}</p>
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span className="font-medium">{remark.name}</span>
                  <span>{format(new Date(remark.date), "MMM dd, yyyy")}</span>
                </div>
              </div>
            </div>
          </div>
          {hasRemarks && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedSaleForRemarks(sale)
                setRemarksModalOpen(true)
              }}
              className="text-xs text-blue-600 bg-white hover:text-white hover:bg-[#001f3f] border-purple-200 hover:border-purple-300"
            >
              View All Remarks
            </Button>
          )}
        </div>
      )
    }

    if (commission && !commission.deleted_at) {
      return (
        <div className="space-y-2">
          <Badge
            variant="outline"
            className={getStatusBadgeClass(commission.status, false) + " cursor-pointer"}
            onClick={() => onCommissionClick?.(commission)}
            style={{ cursor: "pointer" }}
          >
            Report #{commission.report_number}
          </Badge>
          {hasRemarks && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedSaleForRemarks(sale)
                setRemarksModalOpen(true)
              }}
              className="text-xs text-blue-600 hover:text-blue-800 border-blue-200 hover:border-blue-300"
            >
              View All Remarks
            </Button>
          )}
        </div>
      )
    }

    return (
      <div className="space-y-2">
        <div className="text-gray-400 text-sm italic">No remarks</div>
        {hasRemarks && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedSaleForRemarks(sale)
              setRemarksModalOpen(true)
            }}
            className="text-xs text-blue-600 hover:text-blue-800 border-blue-200 hover:border-blue-300"
          >
            View All Remarks
          </Button>
        )}
      </div>
    )
  }

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
                  }}
                  className="w-full border-0 bg-gradient-to-r from-red-500 to-pink-500 text-white font-semibold shadow-md hover:from-red-600 hover:to-pink-600 transition-all duration-150 flex items-center justify-center gap-2"
                >
                  <Filter className="h-4 w-4 mr-1" />
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sales Table */}
          <Card className="shadow-lg border border-gray-200 bg-white">
            <CardHeader className="bg-gray-50 border-b border-gray-200">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600" />
                    Sales Records
                  </CardTitle>
                  <CardDescription className="text-gray-600 mt-1 text-sm sm:text-base">
                    {loading
                      ? "Loading..."
                      : `${filteredSalesCount} records found${showOnlyWithRemarks ? " (with remarks)" : ""}`}
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-2 w-full sm:w-auto">
                  <ColumnVisibilityControl columns={columnVisibility} onColumnToggle={toggleColumnVisibility} />
                  <Button
                    variant={showOnlyWithRemarks ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowOnlyWithRemarks(!showOnlyWithRemarks)}
                    className={`border-gray-300 ${
                      showOnlyWithRemarks
                        ? "bg-indigo-600 text-black hover:bg-indigo-700"
                        : "text-gray-700 hover:text-gray-700 hover:bg-gray-50 bg-transparent"
                    }`}
                  >
                    <MessageSquarePlus className="h-4 w-4 mr-2" />
                    {showOnlyWithRemarks ? "Show All" : "With Remarks"}
                  </Button>
                  <CustomExportModal
                    sales={sales}
                    onExport={async (exportedCount, selectedFields) => {
                      if (profile?.id) {
                        await logNotification(supabase, {
                          action: "export_custom_sales",
                          description: `Exported custom sales to Excel (${exportedCount} records)`,
                          ip_address: null,
                          location: null,
                          meta: JSON.stringify({
                            user_id: profile.id,
                            role: profile.role || "unknown",
                            dashboard: "super_admin_sales",
                            export_type: "custom",
                            record_count: exportedCount,
                            selected_fields: selectedFields,
                          }),
                          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
                          user_email: profile.email,
                          user_name: profile.full_name || profile.first_name || profile.id,
                          user_uuid: profile.id,
                        })
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToExcel}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white border-0 shadow-lg flex items-center justify-center"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    <span className="hidden xs:inline">Export (Invoice Only)</span>
                    <span className="inline xs:hidden">Export</span>
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
                        <TableHead
                          className="min-w-[120px] font-semibold text-gray-900 cursor-pointer select-none"
                          onClick={() => handleSort("tax_month")}
                        >
                          Tax Month
                          {sortField === "tax_month" && (
                            <span className="ml-1">{sortDirection === "asc" ? "▲" : "▼"}</span>
                          )}
                        </TableHead>
                      )}
                      {columnVisibility.find((col) => col.key === "tin")?.visible && (
                        <TableHead
                          className="min-w-[120px] font-semibold text-gray-900 cursor-pointer select-none"
                          onClick={() => handleSort("tin")}
                        >
                          TIN
                          {sortField === "tin" && <span className="ml-1">{sortDirection === "asc" ? "▲" : "▼"}</span>}
                        </TableHead>
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
                        <TableHead
                          className="min-w-[120px] font-semibold text-gray-900 cursor-pointer select-none"
                          onClick={() => handleSort("gross_taxable")}
                        >
                          Gross Taxable
                          {sortField === "gross_taxable" && (
                            <span className="ml-1">{sortDirection === "asc" ? "▲" : "▼"}</span>
                          )}
                        </TableHead>
                      )}
                      {columnVisibility.find((col) => col.key === "total_actual_amount")?.visible && (
                        <TableHead
                          className="min-w-[120px] font-semibold text-gray-900 cursor-pointer select-none"
                          onClick={() => handleSort("total_actual_amount")}
                        >
                          Total Actual Amount
                          {sortField === "total_actual_amount" && (
                            <span className="ml-1">{sortDirection === "asc" ? "▲" : "▼"}</span>
                          )}
                        </TableHead>
                      )}
                      {columnVisibility.find((col) => col.key === "invoice_number")?.visible && (
                        <TableHead
                          className="min-w-[120px] font-semibold text-gray-900 cursor-pointer select-none"
                          onClick={() => handleSort("invoice_number")}
                        >
                          Invoice #
                          {sortField === "invoice_number" && (
                            <span className="ml-1">{sortDirection === "asc" ? "▲" : "▼"}</span>
                          )}
                        </TableHead>
                      )}
                      {columnVisibility.find((col) => col.key === "pickup_date")?.visible && (
                        <TableHead
                          className="min-w-[120px] font-semibold text-gray-900 cursor-pointer select-none"
                          onClick={() => handleSort("pickup_date")}
                        >
                          Pickup Date
                          {sortField === "pickup_date" && (
                            <span className="ml-1">{sortDirection === "asc" ? "▲" : "▼"}</span>
                          )}
                        </TableHead>
                      )}
                      {columnVisibility.find((col) => col.key === "area")?.visible && (
                        <TableHead className="min-w-[150px] font-semibold text-gray-900">Area</TableHead>
                      )}
                      {columnVisibility.find((col) => col.key === "recent_remark")?.visible && (
                        <TableHead className="min-w-[150px] font-semibold text-gray-900">Recent Remark</TableHead>
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
                        <TableCell colSpan={13} className="text-center py-12">
                          <div className="flex flex-col items-center justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                            <span className="text-gray-600 font-medium">Loading sales records...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : sales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={13} className="text-center py-12">
                          <BarChart3 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">No sales records found</h3>
                          <p className="text-gray-500">Create your first sales record to get started!</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedSales.map((sale) => (
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
                          {columnVisibility.find((col) => col.key === "recent_remark")?.visible && (
                            <TableCell>
                              <RecentRemarkDisplay
                                remark={getMostRecentRemark(sale.remarks)}
                                commission={saleIdToCommission[sale.id]}
                                onCommissionClick={(commission) => {
                                  setSelectedCommission(commission)
                                  setCommissionModalOpen(true)
                                }}
                                sale={sale}
                              />
                            </TableCell>
                          )}
                          {columnVisibility.find((col) => col.key === "files")?.visible && (
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {sale.cheque && sale.cheque.length > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 px-2 py-1 rounded-lg shadow-sm"
                                  >
                                    Cheque ({sale.cheque.length})
                                  </Badge>
                                )}
                                {sale.voucher && sale.voucher.length > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs font-semibold bg-green-50 text-green-800 border border-green-200 px-2 py-1 rounded-lg shadow-sm"
                                  >
                                    Voucher ({sale.voucher.length})
                                  </Badge>
                                )}
                                {sale.invoice && sale.invoice.length > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs font-semibold bg-green-50 text-green-800 border border-green-200 px-2 py-1 rounded-lg shadow-sm"
                                  >
                                    Invoice ({sale.invoice.length})
                                  </Badge>
                                )}
                                {sale.doc_2307 && sale.doc_2307.length > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs font-semibold bg-gray-50 text-gray-800 border border-gray-200 px-2 py-1 rounded-lg shadow-sm"
                                  >
                                    2307 ({sale.doc_2307.length})
                                  </Badge>
                                )}
                                {sale.deposit_slip && sale.deposit_slip.length > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs font-semibold bg-green-50 text-green-800 border border-green-200 px-2 py-1 rounded-lg shadow-sm"
                                  >
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
                                  onClick={() => handleAddRemark(sale)}
                                  className="h-8 w-8 p-0 hover:bg-purple-100"
                                  title="Add Remark"
                                >
                                  <MessageSquarePlus className="h-4 w-4 text-purple-600" />
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

          {/* Table Controls - Below Table */}
          <Card className="mt-6 shadow-lg border border-gray-200 bg-white">
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                {/* Left side - Page size selector and record count */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Show:</span>
                    <Select
                      value={pageSize.toString()}
                      onValueChange={(value) => {
                        setPageSize(Number(value))
                        setCurrentPage(1)
                      }}
                    >
                      <SelectTrigger className="w-20 h-8 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200">
                        <SelectItem value="10" className="text-gray-900 hover:bg-gray-100">
                          10
                        </SelectItem>
                        <SelectItem value="25" className="text-gray-900 hover:bg-gray-100">
                          25
                        </SelectItem>
                        <SelectItem value="50" className="text-gray-900 hover:bg-gray-100">
                          50
                        </SelectItem>
                        <SelectItem value="100" className="text-gray-900 hover:bg-gray-100">
                          100
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-gray-700">records per page</span>
                  </div>

                  <div className="text-sm text-gray-600">
                    Showing {startRecord} to {endRecord} of {sales.length} records
                    {(searchTerm || filterTaxType !== "all" || filterMonth !== "all" || filterArea !== "all") &&
                      ` (filtered)`}
                  </div>
                </div>

                {/* Right side - Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    {/* First Page */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="h-8 px-2 border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="First page"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>

                    {/* Previous Page */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="h-8 px-2 border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {/* Page Numbers */}
                    {pageNumbers.map((pageNum) => (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`h-8 px-3 min-w-[32px] ${
                          currentPage === pageNum
                            ? "bg-indigo-600 text-white hover:bg-indigo-700 border-indigo-600"
                            : "border-gray-300 hover:text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {pageNum}
                      </Button>
                    ))}

                    {/* Next Page */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 px-2 border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>

                    {/* Last Page */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="h-8 px-2 border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Last page"
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
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
        {commissionModalOpen &&
          selectedCommission &&
          (() => {
            console.log("selectedCommission:", selectedCommission)
            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                <div className="bg-white rounded-lg shadow-lg p-6 min-w-[320px] max-w-[90vw]">
                  <h2 className="text-[#001f3f] text-xl font-bold mb-2">
                    Commission Report #{selectedCommission.report_number}
                  </h2>
                  <div className="text-[#001f3f] mb-2">
                    <span className="font-semibold">Created by:</span>{" "}
                    {creatorIdToName[selectedCommission.created_by] || selectedCommission.created_by}
                  </div>
                  <div className="text-[#001f3f] mb-2">
                    <span className="font-semibold">Date:</span>{" "}
                    {format(new Date(selectedCommission.created_at), "MMM dd, yyyy HH:mm")}
                  </div>
                  <div className="text-[#001f3f] mb-2 flex items-center gap-2">
                    <span className="font-semibold">Status:</span>
                    {selectedCommission.deleted_at ? (
                      <span className="bg-red-100 text-red-700 px-2 py-1 rounded font-semibold text-xs">Deleted</span>
                    ) : (
                      <span
                        className={
                          getStatusBadgeClass(selectedCommission.status, false) +
                          " px-2 py-1 rounded font-semibold text-xs capitalize"
                        }
                      >
                        {selectedCommission.status || "N/A"}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-end mt-4">
                    <Button onClick={() => setCommissionModalOpen(false)}>Close</Button>
                  </div>
                </div>
              </div>
            )
          })()}

        <AddRemarkModal
          open={addRemarkModalOpen}
          onOpenChange={setAddRemarkModalOpen}
          saleId={selectedSaleForRemark?.id || 0}
          onRemarkAdded={handleRemarkAdded}
        />

        <RemarksModalViewer
          isOpen={remarksModalOpen}
          onClose={() => {
            setRemarksModalOpen(false)
            setSelectedSaleForRemarks(null)
          }}
          saleId={selectedSaleForRemarks?.id || ""}
          remarks={selectedSaleForRemarks?.remarks || null}
          onRemarksUpdate={handleRemarksUpdate}
          roleColor="blue"
        />
      </div>
    </ProtectedRoute>
  )
}
