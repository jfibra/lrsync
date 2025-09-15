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
import * as XLSX from "xlsx"
import { exportPurchasesToExcel } from "@/utils/export-purchases"

// Import modals
import { AddPurchasesModal } from "@/components/add-purchases-modal"
import { ViewPurchasesModal } from "@/components/view-purchases-modal"
import { EditPurchasesModal } from "@/components/edit-purchases-modal"
import { AddPurchasesRemarkModal } from "@/components/add-purchases-remark-modal"
import { PurchasesExportModal } from "@/components/purchases-export-modal"
import { ColumnVisibilityControl } from "@/components/column-visibility-control"
import { RemarksModalViewerPurchases } from "@/components/remarks-modal-viewer-purchases"

interface Purchase {
  id: string
  tax_month: string
  tin_id: string | null
  tin: string
  name: string
  substreet_street_brgy: string | null
  district_city_zip: string | null
  gross_taxable: number
  total_actual_amount?: number
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
  category_id?: string | null
}

export default function SuperAdminPurchasesPage() {
  const { profile } = useAuth()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterTaxType, setFilterTaxType] = useState("all")
  const [filterMonth, setFilterMonth] = useState("all")
  const [filterArea, setFilterArea] = useState("all")
  const [availableAreas, setAvailableAreas] = useState<string[]>([])

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [remarkModalOpen, setRemarkModalOpen] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null)

  const [sortField, setSortField] = useState<string>("created_at")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

  const [categories, setCategories] = useState<{ id: string; category: string }[]>([])

  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxImages, setLightboxImages] = useState<{ url: string; label: string }[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const [filterCategory, setFilterCategory] = useState("all")
  const [selectedSales, setSelectedSales] = useState<string[]>([])

  const [remarksModalOpen, setRemarksModalOpen] = useState(false)
  const [selectedPurchaseForRemarks, setSelectedPurchaseForRemarks] = useState<any>(null)

  const handleRemarksUpdate = (purchaseId: string, updatedRemarks: any[]) => {
    setPurchases((prev) =>
      prev.map((purchase) =>
        purchase.id === purchaseId
          ? { ...purchase, remarks: JSON.stringify(updatedRemarks) }
          : purchase
      )
    )
  }

  const handleRowSelect = (id: string) => {
    setSelectedSales(prev =>
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    )
  }

  function LightboxModal({
    images,
    index,
    onClose,
  }: {
    images: { url: string; label: string }[]
    index: number
    onClose: () => void
  }) {
    const [current, setCurrent] = useState(index)
    const [zoom, setZoom] = useState(1)
    const [rotation, setRotation] = useState(0)
    const [offset, setOffset] = useState({ x: 0, y: 0 })
    const [dragging, setDragging] = useState(false)
    const [start, setStart] = useState<{ x: number; y: number } | null>(null)

    const currentImage = images[current]

    // Keyboard navigation
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "ArrowLeft") {
          setCurrent((prev) => (prev === 0 ? images.length - 1 : prev - 1))
        } else if (e.key === "ArrowRight") {
          setCurrent((prev) => (prev === images.length - 1 ? 0 : prev + 1))
        } else if (e.key === "Escape") {
          onClose()
        }
      }
      window.addEventListener("keydown", handleKeyDown)
      return () => window.removeEventListener("keydown", handleKeyDown)
    }, [images.length, onClose])

    // Reset pan/zoom/rotation when image changes
    useEffect(() => {
      setZoom(1)
      setRotation(0)
      setOffset({ x: 0, y: 0 })
    }, [current, index, images])

    // Mouse/touch drag handlers for panning
    const handleMouseDown = (e: React.MouseEvent) => {
      if (zoom === 1) return
      setDragging(true)
      setStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
    }
    const handleMouseMove = (e: React.MouseEvent) => {
      if (!dragging || zoom === 1) return
      setOffset({
        x: e.clientX - (start?.x ?? 0),
        y: e.clientY - (start?.y ?? 0),
      })
    }
    const handleMouseUp = () => setDragging(false)

    // Touch events for mobile
    const handleTouchStart = (e: React.TouchEvent) => {
      if (zoom === 1) return
      setDragging(true)
      const touch = e.touches[0]
      setStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y })
    }
    const handleTouchMove = (e: React.TouchEvent) => {
      if (!dragging || zoom === 1) return
      const touch = e.touches[0]
      setOffset({
        x: touch.clientX - (start?.x ?? 0),
        y: touch.clientY - (start?.y ?? 0),
      })
    }
    const handleTouchEnd = () => setDragging(false)

    const handlePrev = () => setCurrent((prev) => (prev === 0 ? images.length - 1 : prev - 1))
    const handleNext = () => setCurrent((prev) => (prev === images.length - 1 ? 0 : prev + 1))
    const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 3))
    const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 1))
    const handleRotate = () => setRotation((r) => r + 90)
    const handleReset = () => {
      setZoom(1)
      setRotation(0)
      setOffset({ x: 0, y: 0 })
    }

    if (!currentImage) return null

    return (
      <div
        className="fixed inset-0 z-[9999] bg-black bg-opacity-95 overflow-hidden flex items-center justify-center"
        style={{ touchAction: "none" }}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
      >
        {/* Close Button */}
        <button
          className="absolute top-6 right-6 text-white text-3xl z-20"
          onClick={onClose}
          aria-label="Close"
          style={{ lineHeight: 1 }}
        >
          ×
        </button>

        {/* Controls - absolute at top center */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex gap-2 bg-black bg-opacity-60 rounded-lg px-4 py-2">
          <button onClick={handlePrev} className="text-white px-2 py-1 rounded hover:bg-gray-700">&lt;</button>
          <button onClick={handleNext} className="text-white px-2 py-1 rounded hover:bg-gray-700">&gt;</button>
          <button onClick={handleZoomIn} className="text-white px-2 py-1 rounded hover:bg-gray-700">Zoom In</button>
          <button onClick={handleZoomOut} className="text-white px-2 py-1 rounded hover:bg-gray-700">Zoom Out</button>
          <button onClick={handleRotate} className="text-white px-2 py-1 rounded hover:bg-gray-700">Rotate</button>
          <button onClick={handleReset} className="text-white px-2 py-1 rounded hover:bg-gray-700">Reset</button>
          <a
            href={currentImage.url}
            download
            className="text-white px-2 py-1 rounded hover:bg-gray-700"
            target="_blank"
            rel="noopener noreferrer"
          >
            Download
          </a>
        </div>

        {/* Image - centered and fills available space */}
        <div className="absolute inset-0 flex items-center justify-center select-none">
          <img
            src={currentImage.url}
            alt={currentImage.label}
            className="max-w-[90vw] max-h-[80vh] object-contain"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              transition: dragging ? "none" : "transform 0.2s",
              cursor: zoom > 1 ? "grab" : "default",
              userSelect: "none",
              display: "block",
              margin: "auto",
            }}
            draggable={false}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
          />
          {/* Image label at bottom center */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white bg-black bg-opacity-60 rounded px-3 py-1 z-20">
            {currentImage.label}
          </div>
          {/* Image index label */}
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white bg-black bg-opacity-60 rounded px-3 py-1 z-20">
            Image {current + 1} of {images.length}
          </div>
        </div>
      </div>
    )
  }

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState({
    tax_month: true,
    tin: true,
    name: true,
    tax_type: true,
    gross_taxable: true,
    invoice_number: true,
    category_id: true,
    official_receipt: true,
    remark: true,
    area: true,
    actions: true,
  })

  // Statistics
  const totalPurchases = purchases.length
  const totalGrossTaxable = purchases.reduce((sum, purchase) => sum + (purchase.gross_taxable || 0), 0)
  const vatPurchases = purchases.filter((p) => p.tax_type === "vat").length
  const nonVatPurchases = purchases.filter((p) => p.tax_type === "non-vat").length

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

  // Fetch available areas
  const fetchAvailableAreas = async () => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("assigned_area")
        .not("assigned_area", "is", null)

      if (error) throw error

      const areas = [...new Set(data?.map((profile) => profile.assigned_area).filter(Boolean))] as string[]
      setAvailableAreas(areas.sort())
    } catch (error) {
      console.error("Error fetching areas:", error)
    }
  }

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("purchases_categories")
        .select("id, category")
        .eq("is_deleted", false)
        .order("category", { ascending: true })

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error("Error fetching categories:", error)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  // Fetch purchases data
  const fetchPurchases = async () => {
    try {
      setLoading(true)

      let purchasesQuery = supabase
        .from("purchases")
        .select("*")
        .eq("is_deleted", false)
        .order(sortField, { ascending: sortDirection === "asc" })

      // Apply filters BEFORE fetching data
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

      if (filterCategory !== "all") {
        purchasesQuery = purchasesQuery.eq("category_id", filterCategory)
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

      // Filter by area if selected (local filtering)
      let filteredData = purchasesWithProfiles
      if (filterArea !== "all") {
        filteredData = filteredData.filter((purchase) => purchase.user_assigned_area === filterArea)
      }

      setPurchases(filteredData)
    } catch (error) {
      console.error("Error fetching purchases:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAvailableAreas()
  }, [])

  useEffect(() => {
    fetchPurchases()
  }, [searchTerm, filterTaxType, filterMonth, filterArea, sortField, sortDirection, filterCategory])

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

  // Standard Excel export function
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
        Area: purchase.user_assigned_area || "",
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
      const filename = `purchases_${timestamp}.xlsx`
      XLSX.writeFile(wb, filename)

      if (profile?.id) {
        await logNotification(supabase, {
          action: "purchases_exported",
          description: `Purchases data exported to Excel (${purchases.length} records)`,
          ip_address: null,
          location: null,
          meta: JSON.stringify({
            recordCount: purchases.length,
            filename,
            role: "super-admin",
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

  const handleExportSelected = async () => {
    try {
      const selectedPurchases = purchases.filter(p => selectedSales.includes(p.id))
      if (selectedPurchases.length === 0) {
        alert("No records selected.")
        return
      }

      const exportData = selectedPurchases.map((purchase) => ({
        "Tax Month": format(new Date(purchase.tax_month), "MMMM yyyy"),
        TIN: formatTin(purchase.tin),
        Name: purchase.name,
        "Address (Street/Brgy)": purchase.substreet_street_brgy || "",
        "Address (City/District)": purchase.district_city_zip || "",
        "Tax Type": purchase.tax_type?.toUpperCase() || "",
        "Gross Taxable Amount": purchase.gross_taxable || 0,
        "Total Actual Amount": purchase.total_actual_amount || 0,
        "Invoice Number": purchase.invoice_number || "",
        Area: purchase.user_assigned_area || "",
        "Date Created": format(new Date(purchase.created_at), "MMM dd, yyyy HH:mm"),
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(exportData)

      const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
        wch: Math.max(key.length, 15),
      }))
      ws["!cols"] = colWidths

      XLSX.utils.book_append_sheet(wb, ws, "Selected Purchases")

      const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm")
      const filename = `selected_purchases_${timestamp}.xlsx`
      XLSX.writeFile(wb, filename)
    } catch (error) {
      console.error("Error exporting selected purchases:", error)
      alert("Error exporting selected purchases. Please try again.")
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

  const handleColumnToggle = (key: string) => {
    setColumns((prev) =>
      prev.map((col) => (col.key === key ? { ...col, visible: !col.visible } : col))
    )
  }

  const [columns, setColumns] = useState([
    { key: "tax_month", label: "Tax Month", visible: true },
    { key: "tin", label: "TIN", visible: true },
    { key: "name", label: "Name", visible: true },
    { key: "tax_type", label: "Tax Type", visible: true },
    { key: "gross_taxable", label: "Gross Taxable", visible: true },
    { key: "total_actual_amount", label: "Total Actual Amount", visible: true },
    { key: "invoice_number", label: "Invoice #", visible: true },
    { key: "category_id", label: "Category", visible: true },
    { key: "official_receipt", label: "File Attachments", visible: true },
    { key: "remark", label: "Remark", visible: true },
    { key: "area", label: "Area", visible: true },
    { key: "actions", label: "Actions", visible: true },
  ])

  return (
    <div className="space-y-6 p-6 bg-white min-h-screen">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#001f3f]">Purchases Management</h1>
          <p className="text-[#001f3f]/70 mt-1">Manage and track all purchase records</p>
        </div>
        <Button onClick={() => setAddModalOpen(true)} className="bg-[#001f3f] hover:bg-[#001f3f]/90 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Add Purchase Record
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-[#001f3f]/20 shadow-lg bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#001f3f]/70">Total Purchases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#001f3f]">{totalPurchases.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="border-[#3c8dbc]/20 shadow-lg bg-white">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-[#3c8dbc]">VAT Purchases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#3c8dbc]">{vatPurchases.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="border-[#ffc107]/20 shadow-lg bg-white">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-[#ffc107]">Non-VAT Purchases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#ffc107]">{nonVatPurchases.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="border-[#dc3545]/20 shadow-lg bg-white">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-[#dc3545]">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#dc3545]">{formatCurrency(totalGrossTaxable)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-[#001f3f]/20 shadow-lg bg-white">
        <CardHeader>
          <CardTitle className="text-[#001f3f]">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#001f3f]/50" />
              <Input
                placeholder="Search by name, TIN, or invoice..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white border-[#001f3f]/30 focus:border-[#001f3f] text-[#001f3f]"
              />
            </div>

            {/* Tax Type Filter */}
            <Select value={filterTaxType} onValueChange={setFilterTaxType}>
              <SelectTrigger className="bg-white border-[#001f3f]/30 focus:border-[#001f3f] text-[#001f3f]">
                <SelectValue placeholder="Tax Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tax Types</SelectItem>
                <SelectItem value="vat">VAT</SelectItem>
                <SelectItem value="non-vat">Non-VAT</SelectItem>
              </SelectContent>
            </Select>

            {/* Month Filter */}
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="bg-white border-[#001f3f]/30 focus:border-[#001f3f] text-[#001f3f]">
                <SelectValue placeholder="Tax Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {taxMonthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Purchase Categories Filter */}
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="bg-white border-[#001f3f]/30 focus:border-[#001f3f] text-[#001f3f]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Area Filter */}
            <Select value={filterArea} onValueChange={setFilterArea}>
              <SelectTrigger className="bg-white border-[#001f3f]/30 focus:border-[#001f3f] text-[#001f3f]">
                <SelectValue placeholder="Area" />
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

            {/* Clear Filters */}
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm("")
                setFilterTaxType("all")
                setFilterMonth("all")
                setFilterArea("all")
              }}
              className="bg-white border-[#001f3f]/30 text-[#001f3f] hover:bg-[#001f3f]/10"
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedSales.length > 0 && (
        <Button
          className="bg-blue-700 text-white px-4 py-2 rounded"
          onClick={() => exportPurchasesToExcel(
            purchases.filter(p => selectedSales.includes(p.id)),
            profile
          )}
        >
          Export Selected Purchase Records ({selectedSales.length})
        </Button>
      )}

      {/* Purchases Table */}
      <Card className="border-[#001f3f]/20 shadow-lg bg-white">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-[#001f3f] text-lg sm:text-2xl">
                <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-[#001f3f]" />
                Purchase Records
              </CardTitle>
              <CardDescription className="text-[#001f3f]/70 mt-1 text-sm sm:text-base">
                {loading ? "Loading..." : `${purchases.length} records found`}
              </CardDescription>
            </div>
            {/* Export and column visibility controls */}
            <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:items-center sm:gap-2">
              <ColumnVisibilityControl
                columns={columns}
                onColumnToggle={handleColumnToggle}
                role="admin"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportPurchasesToExcel(purchases, profile)}
                className="bg-white border-[#001f3f]/30 text-[#001f3f] hover:bg-[#001f3f]/10 flex items-center justify-center"
              >
                <Download className="h-4 w-4 mr-2" />
                <span className="hidden xs:inline">Export</span>
                <span className="inline xs:hidden">Export</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExportModalOpen(true)}
                className="bg-white border-[#001f3f]/30 text-[#001f3f] hover:bg-[#001f3f]/10 flex items-center justify-center"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                <span className="hidden xs:inline">Custom Export</span>
                <span className="inline xs:hidden">Custom</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 bg-white">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#001f3f]/5 border-b border-[#001f3f]/20">
                  {columns.filter(col => col.visible).map(col => (
                    <TableHead key={col.key} className="min-w-[120px] font-semibold text-[#001f3f]">
                      {col.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedPurchases.map((purchase) => (
                  <TableRow
                    key={purchase.id}
                    onClick={() => handleRowSelect(purchase.id)}
                    className={`cursor-pointer transition-colors ${selectedSales.includes(purchase.id)
                      ? "bg-blue-100 hover:bg-blue-200"
                      : "hover:bg-gray-100"
                      }`}
                  >
                    {columns.filter(col => col.visible).map(col => {
                      switch (col.key) {
                        case "tax_month":
                          return (
                            <TableCell key={col.key}>
                              <div className="flex items-center gap-2 text-[#001f3f]">
                                <Calendar className="h-4 w-4 text-[#001f3f]" />
                                {format(new Date(purchase.tax_month), "MMM yyyy")}
                              </div>
                            </TableCell>
                          )
                        case "tin":
                          return (
                            <TableCell key={col.key} className="font-mono text-[#001f3f]">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-[#3c8dbc] rounded-full"></div>
                                {formatTin(purchase.tin)}
                              </div>
                            </TableCell>
                          )
                        case "name":
                          return (
                            <TableCell key={col.key} className="text-[#001f3f]">
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
                          )
                        case "tax_type":
                          return (
                            <TableCell key={col.key}>
                              <Badge className={getTaxTypeBadgeColor(purchase.tax_type)}>
                                {purchase.tax_type?.toUpperCase()}
                              </Badge>
                            </TableCell>
                          )
                        case "gross_taxable":
                          return (
                            <TableCell key={col.key} className="text-[#001f3f] font-semibold">
                              {formatCurrency(purchase.gross_taxable || 0)}
                            </TableCell>
                          )
                        case "total_actual_amount":
                          return (
                            <TableCell key={col.key} className="text-[#001f3f] font-semibold">
                              {formatCurrency(purchase.total_actual_amount || 0)}
                            </TableCell>
                          )
                        case "invoice_number":
                          return (
                            <TableCell key={col.key} className="text-[#001f3f]/70">
                              {purchase.invoice_number || "-"}
                            </TableCell>
                          )
                        case "category_id":
                          return (
                            <TableCell key={col.key} className="text-[#001f3f]/70">
                              {categories.find(cat => cat.id === purchase.category_id)?.category || (
                                <span className="italic text-gray-400">Uncategorized</span>
                              )}
                            </TableCell>
                          )
                        case "official_receipt": {
                          // Parse files
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

                          // Separate images and pdfs
                          const isImageFile = (url: string) => {
                            const ext = url.split(".").pop()?.toLowerCase()
                            return ["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(ext || "")
                          }
                          const isPdfFile = (url: string) => url.split(".").pop()?.toLowerCase() === "pdf"

                          const imageFiles = files
                            .map((url, i) => ({
                              url: url
                                .split("/")
                                .map((part, i, arr) =>
                                  i === arr.length - 1 ? encodeURIComponent(part).replace(/%20/g, "+") : part,
                                )
                                .join("/"),
                              label: `Attachment ${i + 1}`,
                            }))
                            .filter((f) => isImageFile(f.url));
                          const pdfFiles = files.filter(isPdfFile)

                          if (!files.length) {
                            return (
                              <TableCell key={col.key} className="text-[#001f3f]/70">
                                <span>-</span>
                              </TableCell>
                            )
                          }

                          return (
                            <TableCell key={col.key} className="text-[#001f3f]/70">
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full justify-start bg-white text-[#3c8dbc] border-[#3c8dbc] hover:bg-[#3c8dbc]/10 hover:text-[#001f3f] px-2 py-1 text-xs font-medium"
                                onClick={() => {
                                  if (imageFiles.length > 0) {
                                    setLightboxImages(imageFiles)
                                    setLightboxIndex(0)
                                    setLightboxOpen(true)
                                  } else if (pdfFiles.length > 0) {
                                    pdfFiles.forEach((url) => window.open(url, "_blank"))
                                  }
                                }}
                              >
                                View Attachments
                              </Button>
                            </TableCell>
                          )
                        }
                        case "remark": {
                          const recentRemark = getMostRecentRemark(purchase.remarks)
                          return (
                            <TableCell key={col.key} className="text-[#001f3f]/70">
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
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedPurchaseForRemarks(purchase)
                                      setRemarksModalOpen(true)
                                    }}
                                    className="text-xs text-blue-600 bg-white hover:text-white hover:bg-[#001f3f] border-blue-200 hover:border-blue-300 mt-2"
                                  >
                                    View All Remarks
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-[#001f3f]/40 italic">No remarks</span>
                              )}
                            </TableCell>
                          )
                        }
                        case "area":
                          return (
                            <TableCell key={col.key} className="text-[#001f3f]/70">
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-[#001f3f]/50" />
                                <span className="text-sm bg-[#001f3f]/10 px-2 py-1 rounded text-[#001f3f]">
                                  {purchase.user_assigned_area || "N/A"}
                                </span>
                              </div>
                            </TableCell>
                          )
                        case "actions":
                          return (
                            <TableCell key={col.key}>
                              <div className="flex gap-2">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleViewPurchase(purchase)}
                                  title="View"
                                >
                                  <Eye className="h-4 w-4 text-[#001f3f]" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleEditPurchase(purchase)}
                                  title="Edit"
                                >
                                  <Edit className="h-4 w-4 text-[#3c8dbc]" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleAddRemark(purchase)}
                                  title="Add Remark"
                                >
                                  <MessageSquarePlus className="h-4 w-4 text-[#ffc107]" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleSoftDelete(purchase)}
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4 text-[#dc3545]" />
                                </Button>
                              </div>
                            </TableCell>
                          )
                        default:
                          return null
                      }
                    })}
                  </TableRow>
                ))}
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
                    <SelectItem value="10">10</SelectItem>
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
                className="bg-white border-[#001f3f]/30 text-[#001f3f] hover:bg-[#001f3f]/10"
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
                        ? "bg-[#001f3f] text-white hover:bg-[#001f3f]/90"
                        : "border-[#001f3f]/30 text-[#001f3f] hover:bg-[#001f3f]/10"
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
                className="bg-white border-[#001f3f]/30 text-[#001f3f] hover:bg-[#001f3f]/10"
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
        role="admin"
      />

      {lightboxOpen && (
        <LightboxModal
          images={lightboxImages}
          index={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {selectedPurchaseForRemarks && (
        <RemarksModalViewerPurchases
          isOpen={remarksModalOpen}
          onClose={() => {
            setRemarksModalOpen(false)
            setSelectedPurchaseForRemarks(null)
          }}
          purchaseId={selectedPurchaseForRemarks.id}
          remarks={selectedPurchaseForRemarks.remarks}
          onRemarksUpdate={handleRemarksUpdate}
          userRole={profile?.role}
        />
      )}
    </div>
  )
}
