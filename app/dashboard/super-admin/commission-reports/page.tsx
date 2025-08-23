"use client"

import React from "react"

import { useState, useEffect } from "react"
import Swal from "sweetalert2"
import { supabase } from "@/lib/supabase/client"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Search,
  FileText,
  Calendar,
  User,
  Hash,
  Upload,
  X,
  CheckCircle,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { CommissionReportViewModal } from "@/components/commission-report-view-modal"
import { logNotification } from "@/utils/logNotification"
import { useAuth } from "@/contexts/auth-context" // If not already imported
import { CommissionReportsExportModal } from "@/components/commission-reports-export-modal"
import { ColumnVisibilityControl } from "@/components/column-visibility-control"
import * as XLSX from "xlsx"
import { format } from "date-fns"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useRouter } from "next/navigation"

interface CommissionReport {
  uuid: string
  report_number: number
  sales_uuids: string[]
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string
  remarks: string
  status: string
  accounting_pot: string | null
  history: Array<{
    action: string
    remarks: string
    user_id: string
    timestamp: string
    user_name: string
  }>
  creator_name?: string
  user_profiles?: {
    full_name?: string
    assigned_area?: string
  }
  _attachmentType?: string
}

interface UploadedFile {
  id?: string
  name: string
  webViewLink?: string
  webContentLink?: string
  originalName: string
  error?: string
}

interface SalesData {
  id: string
  tax_month: string
  tin: string
  name: string
  type: string
  substreet_street_brgy: string
  district_city_zip: string
  gross_taxable: number
  invoice_number: string
  tax_type: string
  pickup_date: string
  total_actual_amount: number
  sale_type: string
  remarks: string
  created_at: string
}

export default function SuperAdminCommissionReportsPage() {
  const [reports, setReports] = useState<CommissionReport[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [recordsPerPage, setRecordsPerPage] = useState(10)
  const [totalRecords, setTotalRecords] = useState(0)
  const [selectedReport, setSelectedReport] = useState<CommissionReport | null>(null)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const { profile } = useAuth()
  const router = useRouter()

  // State for update status modal
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [statusUpdateReport, setStatusUpdateReport] = useState<CommissionReport | null>(null)
  const [newStatus, setNewStatus] = useState("")
  const [statusRemark, setStatusRemark] = useState("")
  const [statusSaving, setStatusSaving] = useState(false)
  const [statusError, setStatusError] = useState("")

  // For Upload Attachments modal
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [uploadReport, setUploadReport] = useState<CommissionReport | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [assignedAreas, setAssignedAreas] = useState<string[]>([])
  const [assignedAreaFilter, setAssignedAreaFilter] = useState("all")
  const [attachmentsModalOpen, setAttachmentsModalOpen] = useState(false)
  const [selectedAttachmentsReport, setSelectedAttachmentsReport] = useState<CommissionReport | null>(null)

  const [imageLightboxOpen, setImageLightboxOpen] = useState(false)
  const [selectedImageReport, setSelectedImageReport] = useState(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const [columnVisibility, setColumnVisibility] = useState([
    { key: "report_number", label: "Report #", visible: true },
    { key: "created_by", label: "Created By", visible: true },
    { key: "assigned_area", label: "Assigned Area", visible: true },
    { key: "created_date", label: "Created Date", visible: true },
    { key: "status", label: "Status", visible: true },
    { key: "sales_count", label: "Sales Count", visible: true },
    { key: "accounting_attachments", label: "Accounting Attachments", visible: true },
    { key: "secretary_attachments", label: "Secretary Attachments", visible: true },
    { key: "remarks", label: "Remarks", visible: true },
    { key: "actions", label: "Actions", visible: true },
  ])

  const [salesBreakdownOpen, setSalesBreakdownOpen] = useState(false)
  const [selectedSalesData, setSelectedSalesData] = useState<SalesData[]>([])
  const [loadingSalesData, setLoadingSalesData] = useState(false)
  const [selectedReportForSales, setSelectedReportForSales] = useState<CommissionReport | null>(null)

  const toggleColumnVisibility = (key: string) => {
    setColumnVisibility((prev) => prev.map((col) => (col.key === key ? { ...col, visible: !col.visible } : col)))
  }

  const exportToExcel = () => {
    // Create workbook
    const wb = XLSX.utils.book_new()

    // Calculate statistics
    const totalReports = reports.length
    const newReports = reports.filter((r) => r.status === "new").length
    const approvedReports = reports.filter((r) => r.status === "approved").length
    const rejectedReports = reports.filter((r) => r.status === "rejected").length

    // Create summary data
    const summaryData = [
      ["COMMISSION REPORTS MANAGEMENT REPORT - Super Admin"],
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
      ["Total Reports", totalReports, "Total commission reports"],
      ["New Reports", newReports, "Pending approval"],
      ["Approved Reports", approvedReports, "Approved reports"],
      ["Rejected Reports", rejectedReports, "Rejected reports"],
      [""],
      ["DETAILED COMMISSION REPORTS"],
      [
        "Report #",
        "Created By",
        "Assigned Area",
        "Created Date",
        "Status",
        "Sales Count",
        "Accounting Attachments",
        "Secretary Attachments",
        "Remarks",
      ],
    ]

    // Add report data
    reports.forEach((report) => {
      const accountingAttachments = report.accounting_pot ? JSON.parse(report.accounting_pot) : []
      const secretaryAttachments = report.secretary_pot ? JSON.parse(report.secretary_pot) : []

      summaryData.push([
        `#${report.report_number}`,
        report.user_profiles?.full_name || "Unknown User",
        report.user_profiles?.assigned_area || "N/A",
        format(new Date(report.created_at), "MMM dd, yyyy HH:mm"),
        report.status?.toUpperCase() || "UNKNOWN",
        report.sales_uuids?.length || 0,
        Array.isArray(accountingAttachments) ? accountingAttachments.length : 0,
        Array.isArray(secretaryAttachments) ? secretaryAttachments.length : 0,
        report.remarks || "",
      ])
    })

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(summaryData)

    // Set column widths
    ws["!cols"] = [
      { width: 15 }, // Report #
      { width: 25 }, // Created By
      { width: 20 }, // Assigned Area
      { width: 20 }, // Created Date
      { width: 12 }, // Status
      { width: 12 }, // Sales Count
      { width: 20 }, // Accounting Attachments
      { width: 20 }, // Secretary Attachments
      { width: 30 }, // Remarks
    ]

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Commission Reports")

    // Generate filename
    const filename = `Commission_Reports_${new Date().toISOString().split("T")[0]}.xlsx`

    // Download file
    XLSX.writeFile(wb, filename)

    // Log export action
    if (profile?.id) {
      logNotification(supabase, {
        action: "export_commission_reports",
        user_uuid: profile.id,
        user_name: profile.full_name || profile.first_name || profile.id,
        user_email: profile.email,
        description: `Exported commission reports to Excel (${reports.length} records)`,
        user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
        meta: JSON.stringify({
          user_id: profile.id,
          role: profile.role || "unknown",
          dashboard: "super_admin_commission_reports",
          export_type: "standard",
          record_count: reports.length,
        }),
      })
    }
  }

  const statusOptions = [
    { value: "new", label: "New" },
    { value: "ongoing_verification", label: "Ongoing Verification" },
    { value: "for_approval", label: "For Approval" },
    { value: "approved", label: "Approved" },
    { value: "cancelled", label: "Cancelled" },
    { value: "for_testing", label: "For Testing" },
  ]

  const handleOpenUploadModal = (report: CommissionReport) => {
    setUploadReport(report)
    setSelectedFiles([])
    setUploadError(null)
    setUploadModalOpen(true)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }

  const handleFiles = (files: File[]) => {
    const allowed = files.filter((file) => file.type.startsWith("image/") || file.type === "application/pdf")
    if (allowed.length !== files.length) {
      setUploadError("Only image and PDF files are allowed.")
    } else {
      setUploadError(null)
    }
    setSelectedFiles((prev) => [...prev, ...allowed])
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files))
    }
  }

  const handleRemoveFile = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleUpload = async () => {
    if (!uploadReport || selectedFiles.length === 0) return

    setUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      selectedFiles.forEach((file) => {
        formData.append("files", file)
      })
      formData.append("reportId", uploadReport.uuid)
      formData.append("assigned_area", uploadReport.user_profiles?.assigned_area || "Unknown")
      formData.append("created_date", uploadReport.created_at)
      formData.append("report_number", uploadReport.report_number?.toString() || "")
      const existingData = uploadReport.accounting_pot ? JSON.parse(uploadReport.accounting_pot) : []
      formData.append("existing_count", Array.isArray(existingData) ? existingData.length.toString() : "0")

      const response = await fetch("/api/upload-to-s3", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Upload failed")
      }

      const successfulUploads = result.files.filter((file: any) => file.url)
      const failedUploads = result.files.filter((file: any) => !file.url)

      if (failedUploads.length > 0) {
        console.warn("Some files failed to upload:", failedUploads)
      }

      if (successfulUploads.length > 0) {
        const fileData = successfulUploads.map((file: any) => ({
          name: file.name,
          url: file.url,
          uploadedAt: new Date().toISOString(),
        }))

        const existingData = uploadReport.accounting_pot ? JSON.parse(uploadReport.accounting_pot) : []

        const updatedData = Array.isArray(existingData) ? [...existingData, ...fileData] : fileData

        const { error: dbError } = await supabase
          .from("commission_report")
          .update({
            accounting_pot: JSON.stringify(updatedData),
            updated_at: new Date().toISOString(),
          })
          .eq("uuid", uploadReport.uuid)

        if (dbError) {
          throw new Error(`Database update failed: ${dbError.message}`)
        }

        setReports((prev) =>
          prev.map((report) =>
            report.uuid === uploadReport.uuid ? { ...report, accounting_pot: JSON.stringify(updatedData) } : report,
          ),
        )

        await Swal.fire({
          title: "Success!",
          text: `${successfulUploads.length} file(s) uploaded successfully${
            failedUploads.length > 0 ? `. ${failedUploads.length} file(s) failed.` : "."
          }`,
          icon: "success",
          confirmButtonColor: "#4284f2",
        })

        setUploadModalOpen(false)
        setSelectedFiles([])
        setUploadReport(null)

        if (profile?.id) {
          await logNotification(supabase, {
            action: "commission_report_attachments_uploaded",
            description: `Uploaded ${successfulUploads.length} attachment(s) to report #${uploadReport.report_number}`,
            ip_address: null,
            location: null,
            meta: JSON.stringify({
              report_uuid: uploadReport.uuid,
              report_number: uploadReport.report_number,
              uploaded_files: successfulUploads.map((file: any) => ({
                name: file.name,
                url: file.url,
              })),
            }),
            user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
            user_email: profile.email,
            user_name: profile.full_name || profile.first_name || profile.id,
            user_uuid: profile.id,
          })
        }
      } else {
        throw new Error("All files failed to upload")
      }
    } catch (error) {
      console.error("Upload error:", error)
      setUploadError(error instanceof Error ? error.message : "Upload failed")

      await Swal.fire({
        title: "Upload Failed",
        text: error instanceof Error ? error.message : "An unknown error occurred",
        icon: "error",
        confirmButtonColor: "#ee3433",
      })
    } finally {
      setUploading(false)
    }
  }

  // Map frontend value to DB enum value (with spaces, lowercase)
  const statusValueToEnum = (val: string) => {
    switch (val) {
      case "new":
        return "new"
      case "ongoing_verification":
        return "ongoing verification"
      case "for_approval":
        return "for approval"
      case "approved":
        return "approved"
      case "cancelled":
        return "cancelled"
      case "for_testing":
        return "for testing"
      default:
        return val
    }
  }

  function AttachmentsModal({ report, onClose, onDeleteAttachment }) {
    const [page, setPage] = useState(1)
    const [perPage, setPerPage] = useState(5)

    const allAttachments =
      report._attachmentType === "secretary"
        ? report.secretary_pot
          ? JSON.parse(report.secretary_pot)
          : []
        : report.accounting_pot
          ? JSON.parse(report.accounting_pot)
          : []

    const pdfAttachments = allAttachments.filter(
      (file) => file.name?.toLowerCase().endsWith(".pdf") || file.type === "application/pdf",
    )

    const total = pdfAttachments.length
    const totalPages = Math.max(1, Math.ceil(total / perPage))
    const paged = pdfAttachments.slice((page - 1) * perPage, page * perPage)

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
        <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6 relative max-h-[90vh] overflow-y-auto border-2 border-blue-200">
          <button className="absolute top-3 right-3 text-gray-400 hover:text-red-500" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-lg text-[#001f3f] font-semibold mb-4">
            PDF Attachments for Report <span className="text-blue-700">#{report.report_number}</span>
          </h2>
          <div className="mb-4 flex justify-between items-center">
            <span className="text-sm text-gray-700">
              Showing <span className="font-semibold text-[#001f3f]">{Math.min((page - 1) * perPage + 1, total)}</span>{" "}
              to <span className="font-semibold text-[#001f3f]">{Math.min(page * perPage, total)}</span> of{" "}
              <span className="font-semibold text-[#001f3f]">{total}</span> PDF files
            </span>
            <div>
              <label className="mr-2 text-sm text-[#001f3f]">Show</label>
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value))
                  setPage(1)
                }}
                className="border border-blue-200 rounded px-2 py-1 text-sm text-[#001f3f] bg-white"
              >
                {[5, 10, 25, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span className="ml-2 text-sm text-[#001f3f]">per page</span>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-blue-50 border-b border-blue-200">
                <TableHead className="text-blue-700 font-semibold">#</TableHead>
                <TableHead className="text-blue-700 font-semibold">File Name</TableHead>
                <TableHead className="text-blue-700 font-semibold">Uploaded At</TableHead>
                <TableHead className="text-blue-700 font-semibold text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-400 py-6">
                    No PDF attachments found.
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((file, idx) => (
                  <TableRow key={idx} className="hover:bg-blue-50 transition-colors">
                    <TableCell className="text-[#001f3f] font-medium">{(page - 1) * perPage + idx + 1}</TableCell>
                    <TableCell className="truncate max-w-xs text-[#001f3f]">{file.name}</TableCell>
                    <TableCell className="text-[#001f3f]">
                      {file.uploadedAt ? new Date(file.uploadedAt).toLocaleString() : ""}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="mr-2 border-blue-400 bg-white text-blue-700 hover:bg-blue-100 hover:text-blue-900"
                        onClick={() => window.open(file.url, "_blank")}
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="border-red-400 text-white hover:bg-red-100 hover:text-red-900"
                        onClick={() => {
                          if (window.confirm("Are you sure you want to delete this attachment?")) {
                            const originalIndex = allAttachments.findIndex(
                              (f) => f.name === file.name && f.url === file.url,
                            )
                            onDeleteAttachment(originalIndex)
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="flex justify-between items-center mt-4">
            <div className="text-[#001f3f]">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-blue-400 text-blue-700 bg-transparent"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-blue-400 text-blue-700 bg-transparent"
                disabled={page === totalPages || totalPages === 0}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  function ImageLightboxModal({ report, onClose }) {
    const allAttachments =
      report._attachmentType === "secretary"
        ? report.secretary_pot
          ? JSON.parse(report.secretary_pot)
          : []
        : report.accounting_pot
          ? JSON.parse(report.accounting_pot)
          : []

    const imageAttachments = allAttachments.filter(
      (file) => file.name?.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) || file.type?.startsWith("image/"),
    )

    const [currentIndex, setCurrentIndex] = useState(0)

    const nextImage = () => {
      setCurrentIndex((prev) => (prev + 1) % imageAttachments.length)
    }

    const prevImage = () => {
      setCurrentIndex((prev) => (prev - 1 + imageAttachments.length) % imageAttachments.length)
    }

    if (imageAttachments.length === 0) {
      return null
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90">
        <button className="absolute top-4 right-4 text-white hover:text-gray-300 z-10" onClick={onClose}>
          <X className="h-8 w-8" />
        </button>

        {imageAttachments.length > 1 && (
          <>
            <button
              className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 z-10"
              onClick={prevImage}
            >
              <ChevronLeft className="h-12 w-12" />
            </button>
            <button
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 z-10"
              onClick={nextImage}
            >
              <ChevronRight className="h-12 w-12" />
            </button>
          </>
        )}

        <div className="max-w-4xl max-h-[90vh] flex flex-col items-center">
          <img
            src={imageAttachments[currentIndex]?.url || "/placeholder.svg"}
            alt={imageAttachments[currentIndex]?.name}
            className="max-w-full max-h-[80vh] object-contain"
          />
          <div className="mt-4 text-white text-center">
            <p className="text-lg font-medium">{imageAttachments[currentIndex]?.name}</p>
            {imageAttachments.length > 1 && (
              <p className="text-sm text-gray-300 mt-2">
                {currentIndex + 1} of {imageAttachments.length}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  const handleOpenStatusModal = (report: CommissionReport) => {
    setStatusUpdateReport(report)
    setNewStatus(report.status)
    setStatusRemark("")
    setStatusModalOpen(true)
    setStatusError("")
  }

  const handleUpdateStatus = async () => {
    if (!statusUpdateReport) return
    setStatusSaving(true)
    setStatusError("")
    try {
      // Fetch user info (simulate, replace with actual user context if available)
      const user_id = (typeof window !== "undefined" && localStorage.getItem("user_id")) || "system"
      const user_name = (typeof window !== "undefined" && localStorage.getItem("user_name")) || "System"
      // Prepare new history entry
      const newHistory = Array.isArray(statusUpdateReport.history) ? [...statusUpdateReport.history] : []
      newHistory.push({
        action: "status_update",
        remarks: statusRemark,
        user_id,
        user_name,
        timestamp: new Date().toISOString(),
        status: newStatus,
      })
      // Map to DB enum value
      const dbStatus = statusValueToEnum(newStatus)
      // Update status, remarks, and history in DB
      const { error } = await supabase
        .from("commission_report")
        .update({
          status: dbStatus,
          remarks: statusRemark,
          history: newHistory,
        })
        .eq("uuid", statusUpdateReport.uuid)
      if (error) throw error
      setStatusModalOpen(false)
      // Update local state
      setReports((prev) =>
        prev.map((r) =>
          r.uuid === statusUpdateReport.uuid
            ? {
                ...r,
                status: dbStatus,
                remarks: statusRemark,
                history: newHistory,
              }
            : r,
        ),
      )

      if (profile?.id && statusUpdateReport) {
        await logNotification(supabase, {
          action: "commission_report_status_updated",
          description: `Updated status for report #${statusUpdateReport.report_number} to "${newStatus}"`,
          ip_address: null,
          location: null,
          meta: JSON.stringify({
            report_uuid: statusUpdateReport.uuid,
            report_number: statusUpdateReport.report_number,
            new_status: newStatus,
            remarks: statusRemark,
          }),
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
          user_email: profile.email,
          user_name: profile.full_name || profile.first_name || profile.id,
          user_uuid: profile.id,
        })
      }
    } catch (err: any) {
      setStatusError("Failed to update status. Please try again.")
    } finally {
      setStatusSaving(false)
    }
  }

  // Fetch commission reports from Supabase
  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true)

      let query = supabase
        .from("commission_report")
        .select("*, user_profiles:created_by(full_name,assigned_area)", { count: "exact" })
        .is("deleted_at", null)
        .order("created_at", { ascending: false })

      // Apply status filter
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter)
      }

      let data: any[] = []
      let count = 0
      const error = null

      if (searchTerm) {
        // Search by report_number or remarks
        const { data: reportsByNumber } = await supabase
          .from("commission_report")
          .select("*, user_profiles:created_by(full_name,assigned_area)")
          .ilike("report_number", `%${searchTerm}%`)
          .is("deleted_at", null)
        const { data: reportsByRemarks } = await supabase
          .from("commission_report")
          .select("*, user_profiles:created_by(full_name,assigned_area)")
          .ilike("remarks", `%${searchTerm}%`)
          .is("deleted_at", null)

        let merged = [...(reportsByNumber || []), ...(reportsByRemarks || [])]
        // Remove duplicates
        merged = merged.filter((v, i, a) => a.findIndex((t) => t.uuid === v.uuid) === i)

        // Apply status filter
        if (statusFilter !== "all") {
          merged = merged.filter((r) => r.status === statusFilter)
        }

        // Apply assigned area filter
        if (assignedAreaFilter !== "all") {
          merged = merged.filter((r) => r.user_profiles && r.user_profiles.assigned_area === assignedAreaFilter)
        }

        count = merged.length
        // Apply pagination AFTER all filters
        const from = (currentPage - 1) * recordsPerPage
        data = merged.slice(from, from + recordsPerPage)
      } else {
        const { data: allData, error: fetchError } = await supabase
          .from("commission_report")
          .select("*, user_profiles:created_by(full_name,assigned_area)")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })

        if (fetchError) {
          console.log("[v0] Error fetching commission reports:", fetchError)
          setReports([])
          setTotalRecords(0)
          setLoading(false)
          return
        }

        let filteredData = allData || []

        // Apply status filter
        if (statusFilter !== "all") {
          filteredData = filteredData.filter((r) => r.status === statusFilter)
        }

        // Apply assigned area filter
        if (assignedAreaFilter !== "all") {
          filteredData = filteredData.filter(
            (r) => r.user_profiles && r.user_profiles.assigned_area === assignedAreaFilter,
          )
        }

        count = filteredData.length
        // Apply pagination AFTER all filters
        const from = (currentPage - 1) * recordsPerPage
        data = filteredData.slice(from, from + recordsPerPage)
      }

      setTotalRecords(count)
      setReports(
        (data || []).map((r: any) => ({
          ...r,
          creator_name: r.user_profiles?.full_name || "",
          assigned_area: r.user_profiles?.assigned_area || "",
        })),
      )

      setLoading(false)
    }

    const fetchAllAreas = async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("assigned_area")
        .neq("assigned_area", null)
        .neq("assigned_area", "")

      if (!error && data) {
        const allAreas = data.map((r: any) => r.assigned_area).filter((v: string | undefined) => v && v.trim() !== "")
        setAssignedAreas(Array.from(new Set(allAreas)))
      }
    }
    fetchAllAreas()
    fetchReports()
  }, [currentPage, recordsPerPage, searchTerm, statusFilter, assignedAreaFilter])

  // Status badge helper (updated for new statuses)

  const getStatusBadge = (status: string) => {
    const colorMap: Record<string, { color: string; bg: string; label: string }> = {
      new: { color: "#fff", bg: "#6c757d", label: "New" },
      ongoing_verification: {
        color: "#fff",
        bg: "#0074d9",
        label: "Ongoing Verification",
      },
      for_approval: { color: "#fff", bg: "#ff851b", label: "For Approval" },
      approved: { color: "#fff", bg: "#2ecc40", label: "Approved" },
      cancelled: { color: "#fff", bg: "#ee3433", label: "Cancelled" },
      for_testing: { color: "#fff", bg: "#b10dc9", label: "For Testing" },
    }
    const key = (status || "").toLowerCase().replace(/ /g, "_")
    const config = colorMap[key] || {
      color: "#fff",
      bg: "#6c757d",
      label: status,
    }
    return (
      <span
        style={{
          background: config.bg,
          color: config.color,
          borderRadius: 6,
          padding: "2px 10px",
          fontWeight: 500,
          fontSize: 13,
          whiteSpace: "nowrap", // <-- Add this line
          display: "inline-block", // <-- Add this line for extra safety
        }}
      >
        {config.label}
      </span>
    )
  }

  const getPdfCount = (attachments) => {
    if (!attachments) return 0
    const parsed = JSON.parse(attachments)
    return parsed.filter((file) => file.name?.toLowerCase().endsWith(".pdf") || file.type === "application/pdf").length
  }

  const getImageCount = (attachments) => {
    if (!attachments) return 0
    const parsed = JSON.parse(attachments)
    return parsed.filter(
      (file) => file.name?.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) || file.type?.startsWith("image/"),
    ).length
  }

  const handleViewReport = (report: CommissionReport) => {
    setSelectedReport(report)
    setViewModalOpen(true)
  }

  // Soft delete: set deleted_at to now in the database and remove from visible list after confirmation
  const handleDeleteReport = async (uuid: string) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "This will mark the report as deleted. You can recover it from the database if needed.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
    })
    if (!result.isConfirmed) return

    const { error } = await supabase
      .from("commission_report")
      .update({ deleted_at: new Date().toISOString() })
      .eq("uuid", uuid)

    if (error) {
      Swal.fire("Error", "Failed to delete the report. Please try again.", "error")
      return
    }

    setReports((prev) => prev.filter((r) => r.uuid !== uuid))
    setTotalRecords((prev) => prev - 1)

    if (profile?.id) {
      await logNotification(supabase, {
        action: "commission_report_deleted",
        description: `Deleted commission report #${reports.find((r) => r.uuid === uuid)?.report_number}`,
        ip_address: null,
        location: null,
        meta: JSON.stringify({
          report_uuid: uuid,
          report_number: reports.find((r) => r.uuid === uuid)?.report_number,
        }),
        user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
        user_email: profile.email,
        user_name: profile.full_name || profile.first_name || profile.id,
        user_uuid: profile.id,
      })
    }

    Swal.fire("Deleted!", "The commission report has been deleted.", "success")
  }

  const handleSalesCountClick = async (report: CommissionReport) => {
    if (!report.sales_uuids || report.sales_uuids.length === 0) {
      alert("No sales data available for this report.")
      return
    }

    setSelectedReportForSales(report)
    setLoadingSalesData(true)
    setSalesBreakdownOpen(true)

    try {
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .in("id", report.sales_uuids)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })

      if (error) throw error

      setSelectedSalesData(data || [])
    } catch (error) {
      console.error("Error fetching sales data:", error)
      alert("Error loading sales data. Please try again.")
    } finally {
      setLoadingSalesData(false)
    }
  }

  const totalPages = Math.ceil(totalRecords / recordsPerPage)
  const startRecord = (currentPage - 1) * recordsPerPage + 1
  const endRecord = Math.min(currentPage * recordsPerPage, totalRecords)

  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <div className="min-h-screen bg-white">
        <DashboardHeader />

        <div className="pt-20 px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-2 rounded-lg">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-[#001f3f]">Commission Reports</h1>
                <p className="text-gray-600">View and manage all commission reports</p>
              </div>
            </div>
          </div>

          {/* Filters and Search */}
          <Card className="mb-6 bg-white border-2 border-blue-200">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-500 h-4 w-4" />
                    <Input
                      placeholder="Search by report number or remarks..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white text-[#001f3f] placeholder-gray-400"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48 border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white text-[#001f3f]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-blue-200 text-[#001f3f]">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="ongoing_verification">Ongoing Verification</SelectItem>
                    <SelectItem value="for_approval">For Approval</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="for_testing">For Testing</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={assignedAreaFilter} onValueChange={setAssignedAreaFilter}>
                  <SelectTrigger className="w-full sm:w-48 border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white text-[#001f3f]">
                    <SelectValue placeholder="Filter by area" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-blue-200 text-[#001f3f]">
                    <SelectItem value="all">All Areas</SelectItem>
                    {assignedAreas.map((area) => (
                      <SelectItem key={area} value={area}>
                        {area}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Data Table */}
          <Card className="bg-white border-2 border-blue-200">
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-[#001f3f] text-lg sm:text-2xl">Commission Reports</CardTitle>
                <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:items-center">
                    <ColumnVisibilityControl columns={columnVisibility} onColumnToggle={toggleColumnVisibility} />
                    <CommissionReportsExportModal
                      reports={reports}
                      onExport={(exportedCount) => {
                        if (profile?.id) {
                          logNotification(supabase, {
                            action: "export_custom_commission_reports",
                            user_uuid: profile.id,
                            user_name: profile.full_name || profile.first_name || profile.id,
                            user_email: profile.email,
                            description: `Exported custom commission reports to Excel (${exportedCount} records)`,
                            user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
                            meta: JSON.stringify({
                              user_id: profile.id,
                              role: profile.role || "unknown",
                              dashboard: "super_admin_commission_reports",
                              export_type: "custom",
                              record_count: exportedCount,
                            }),
                          })
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportToExcel}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0 shadow-lg flex items-center justify-center w-full sm:w-auto"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      <span className="hidden xs:inline">Export Excel</span>
                      <span className="inline xs:hidden">Export</span>
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 w-full sm:w-auto">
                    <span className="text-sm font-medium text-[#001f3f]">Show</span>
                    <Select
                      value={recordsPerPage.toString()}
                      onValueChange={(value) => setRecordsPerPage(Number(value))}
                    >
                      <SelectTrigger className="w-full sm:w-20 border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white text-[#001f3f] font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-blue-200 text-[#001f3f]">
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm font-medium text-[#001f3f]">entries</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-blue-50 border-b border-blue-200">
                          {columnVisibility.find((col) => col.key === "report_number")?.visible && (
                            <TableHead className="text-blue-700 font-semibold border-b border-blue-200">
                              <div className="flex items-center gap-2">
                                <Hash className="h-4 w-4" />
                                Report #
                              </div>
                            </TableHead>
                          )}
                          {columnVisibility.find((col) => col.key === "created_by")?.visible && (
                            <TableHead className="text-blue-700 font-semibold border-b border-blue-200">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                Created By
                              </div>
                            </TableHead>
                          )}
                          {columnVisibility.find((col) => col.key === "assigned_area")?.visible && (
                            <TableHead className="text-blue-700 font-semibold border-b border-blue-200">
                              Assigned Area
                            </TableHead>
                          )}
                          {columnVisibility.find((col) => col.key === "created_date")?.visible && (
                            <TableHead className="text-blue-700 font-semibold border-b border-blue-200">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                Created Date
                              </div>
                            </TableHead>
                          )}
                          {columnVisibility.find((col) => col.key === "sales_count")?.visible && (
                            <TableHead className="text-blue-700 font-semibold border-b border-blue-200">
                              Sales Count
                            </TableHead>
                          )}
                          {columnVisibility.find((col) => col.key === "accounting_attachments")?.visible && (
                            <TableHead className="text-blue-700 font-semibold border-b border-blue-200">
                              Attachments (Accounting)
                            </TableHead>
                          )}
                          {columnVisibility.find((col) => col.key === "secretary_attachments")?.visible && (
                            <TableHead className="text-blue-700 font-semibold border-b border-blue-200">
                              Attachments (Secretary)
                            </TableHead>
                          )}
                          {columnVisibility.find((col) => col.key === "status")?.visible && (
                            <TableHead className="text-blue-700 font-semibold border-b border-blue-200">
                              Status
                            </TableHead>
                          )}
                          {columnVisibility.find((col) => col.key === "remarks")?.visible && (
                            <TableHead className="text-blue-700 font-semibold border-b border-blue-200">
                              Remarks
                            </TableHead>
                          )}
                          {columnVisibility.find((col) => col.key === "actions")?.visible && (
                            <TableHead className="text-center text-blue-700 font-semibold border-b border-blue-200">
                              Actions
                            </TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reports.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-gray-400">
                              No commission reports found
                            </TableCell>
                          </TableRow>
                        ) : (
                          reports.map((report) => {
                            const attachments = report.accounting_pot ? JSON.parse(report.accounting_pot) : []
                            const attachmentCount = Array.isArray(attachments) ? attachments.length : 0

                            // Add these lines:
                            const secretaryAttachments = report.secretary_pot ? JSON.parse(report.secretary_pot) : []
                            const secretaryAttachmentCount = Array.isArray(secretaryAttachments)
                              ? secretaryAttachments.length
                              : 0

                            return (
                              <TableRow key={report.uuid} className="hover:bg-blue-50 border-b border-blue-200">
                                {columnVisibility.find((col) => col.key === "report_number")?.visible && (
                                  <TableCell className="text-[#001f3f] font-medium">
                                    <a
                                      href={`/dashboard/commission-report/${report.report_number}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="hover:underline hover:text-purple-600 transition-colors cursor-pointer"
                                      style={{ display: "inline-block", padding: "0.25rem 0.5rem" }}
                                    >
                                      #{report.report_number}
                                    </a>
                                  </TableCell>
                                )}
                                {columnVisibility.find((col) => col.key === "created_by")?.visible && (
                                  <TableCell className="text-[#001f3f]">
                                    {report.user_profiles?.full_name || (
                                      <span className="text-gray-400">Unknown User</span>
                                    )}
                                  </TableCell>
                                )}
                                {columnVisibility.find((col) => col.key === "assigned_area")?.visible && (
                                  <TableCell className="text-[#001f3f]">
                                    {report.user_profiles?.assigned_area || "N/A"}
                                  </TableCell>
                                )}
                                {columnVisibility.find((col) => col.key === "created_date")?.visible && (
                                  <TableCell className="text-[#001f3f]">
                                    {new Date(report.created_at).toLocaleDateString("en-US", {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </TableCell>
                                )}
                                {columnVisibility.find((col) => col.key === "sales_count")?.visible && (
                                  <TableCell>
                                    <button
                                      onClick={() => handleSalesCountClick(report)}
                                      className="text-[#001f3f] hover:bg-blue-50 transition-colors duration-200 rounded-md p-1"
                                      title="Click to view sales breakdown"
                                    >
                                      <Badge
                                        className="text-[#001f3f] cursor-pointer hover:bg-blue-100"
                                        variant="outline"
                                      >
                                        {report.sales_uuids?.length || 0} sales
                                      </Badge>
                                    </button>
                                  </TableCell>
                                )}
                                {columnVisibility.find((col) => col.key === "accounting_attachments")?.visible && (
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      {(() => {
                                        const pdfCount = getPdfCount(report.accounting_pot)
                                        const imageCount = getImageCount(report.accounting_pot)

                                        return (
                                          <>
                                            {pdfCount > 0 && (
                                              <Badge
                                                variant="default"
                                                className="bg-green-600 cursor-pointer hover:bg-green-700 mr-1"
                                                onClick={() => {
                                                  setSelectedAttachmentsReport(report)
                                                  setAttachmentsModalOpen(true)
                                                }}
                                              >
                                                {pdfCount} pdf files
                                              </Badge>
                                            )}
                                            {imageCount > 0 && (
                                              <Badge
                                                variant="default"
                                                className="bg-blue-600 cursor-pointer hover:bg-blue-700"
                                                onClick={() => {
                                                  setSelectedImageReport(report)
                                                  setImageLightboxOpen(true)
                                                }}
                                              >
                                                {imageCount} image files
                                              </Badge>
                                            )}
                                            {(pdfCount > 0 || imageCount > 0) && (
                                              <CheckCircle className="h-4 w-4 text-green-600" />
                                            )}
                                          </>
                                        )
                                      })()}
                                    </div>
                                  </TableCell>
                                )}
                                {columnVisibility.find((col) => col.key === "secretary_attachments")?.visible && (
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      {(() => {
                                        const pdfCount = getPdfCount(report.secretary_pot)
                                        const imageCount = getImageCount(report.secretary_pot)

                                        return (
                                          <>
                                            {pdfCount > 0 && (
                                              <Badge
                                                variant="default"
                                                className="bg-purple-600 cursor-pointer hover:bg-purple-700 mr-1"
                                                onClick={() => {
                                                  setSelectedAttachmentsReport({
                                                    ...report,
                                                    _attachmentType: "secretary",
                                                  })
                                                  setAttachmentsModalOpen(true)
                                                }}
                                              >
                                                {pdfCount} pdf files
                                              </Badge>
                                            )}
                                            {imageCount > 0 && (
                                              <Badge
                                                variant="default"
                                                className="bg-indigo-600 cursor-pointer hover:bg-indigo-700"
                                                onClick={() => {
                                                  setSelectedImageReport({
                                                    ...report,
                                                    _attachmentType: "secretary",
                                                  })
                                                  setImageLightboxOpen(true)
                                                }}
                                              >
                                                {imageCount} image files
                                              </Badge>
                                            )}
                                            {(pdfCount > 0 || imageCount > 0) && (
                                              <CheckCircle className="h-4 w-4 text-purple-600" />
                                            )}
                                          </>
                                        )
                                      })()}
                                    </div>
                                  </TableCell>
                                )}
                                {columnVisibility.find((col) => col.key === "status")?.visible && (
                                  <TableCell>{getStatusBadge(report.status)}</TableCell>
                                )}
                                {columnVisibility.find((col) => col.key === "remarks")?.visible && (
                                  <TableCell className="text-[#001f3f] max-w-xs">
                                    {Array.isArray(report.history) && report.history.length > 0 ? (
                                      (() => {
                                        // Filter out 'created' actions and remarks with empty text
                                        const filtered = report.history.filter(
                                          (h) => h.action !== "created" && h.remarks && h.remarks.trim() !== "",
                                        )
                                        if (filtered.length === 0) {
                                          return <span className="text-gray-400 italic">No remarks</span>
                                        }
                                        // Sort by timestamp descending and get the most recent
                                        const mostRecent = filtered.sort(
                                          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
                                        )[0]
                                        return (
                                          <div className="p-2 rounded bg-blue-50 border border-blue-100">
                                            <div className="text-sm text-gray-800 whitespace-pre-line">
                                              {mostRecent.remarks}
                                            </div>
                                            <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                                              <span>
                                                <User className="inline h-3 w-3 mr-1" />
                                                {mostRecent.user_name || "Unknown"}
                                              </span>
                                              <span>
                                                {mostRecent.timestamp
                                                  ? new Date(mostRecent.timestamp).toLocaleString("en-US", {
                                                      year: "numeric",
                                                      month: "short",
                                                      day: "numeric",
                                                      hour: "2-digit",
                                                      minute: "2-digit",
                                                    })
                                                  : ""}
                                              </span>
                                            </div>
                                          </div>
                                        )
                                      })()
                                    ) : (
                                      <span className="text-gray-400 italic">No remarks</span>
                                    )}
                                  </TableCell>
                                )}
                                {columnVisibility.find((col) => col.key === "actions")?.visible && (
                                  <TableCell className="text-center">
                                    <div className="flex gap-1 justify-end flex-wrap">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1 bg-white border-blue-500 text-blue-700 hover:bg-blue-100 hover:border-blue-600 hover:text-blue-900 text-xs px-2 py-1"
                                        onClick={() => handleOpenStatusModal(report)}
                                      >
                                        Status
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1 bg-white border-green-500 text-green-700 hover:bg-green-100 hover:border-green-600 hover:text-green-900 text-xs px-2 py-1"
                                        onClick={() => handleOpenUploadModal(report)}
                                      >
                                        <Upload className="h-3 w-3" />
                                        Upload
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDeleteReport(report.uuid)}
                                        className="gap-1 bg-white border-red-400 text-red-600 hover:bg-red-50 hover:border-red-600 hover:text-red-800 text-xs px-2 py-1"
                                      >
                                        Delete
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

                  {/* Pagination and Record Info */}
                  <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-sm font-medium text-[#001f3f] bg-white px-4 py-2 rounded-md border border-blue-200">
                      Showing <span className="font-bold text-blue-700">{startRecord}</span> to{" "}
                      <span className="font-bold text-blue-700">{endRecord}</span> of{" "}
                      <span className="font-bold text-blue-700">{totalRecords}</span> records
                    </div>

                    {totalPages > 1 && (
                      <Pagination>
                        <PaginationContent className="gap-1">
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                              className={
                                currentPage === 1
                                  ? "pointer-events-none opacity-50 bg-gray-100"
                                  : "cursor-pointer bg-white text-blue-700 hover:bg-blue-100 hover:text-blue-900 border border-blue-300"
                              }
                            />
                          </PaginationItem>

                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter((pageNum) => {
                              // Show first page, last page, current page, and pages around current
                              if (pageNum === 1 || pageNum === totalPages) return true
                              if (Math.abs(pageNum - currentPage) <= 1) return true
                              return false
                            })
                            .map((pageNum, index, visiblePages) => {
                              // Add ellipsis if there's a gap
                              const prevPage = index > 0 ? visiblePages[index - 1] : 0
                              const showEllipsis = pageNum - prevPage > 1

                              return (
                                <React.Fragment key={pageNum}>
                                  {showEllipsis && <span className="px-2 text-blue-600">...</span>}
                                  <PaginationItem>
                                    <PaginationLink
                                      onClick={() => setCurrentPage(pageNum)}
                                      isActive={pageNum === currentPage}
                                      className={
                                        pageNum === currentPage
                                          ? "cursor-pointer bg-blue-700 text-white font-bold border border-blue-700"
                                          : "cursor-pointer bg-white text-blue-700 hover:bg-blue-100 hover:text-blue-900 border border-blue-300"
                                      }
                                    >
                                      {pageNum}
                                    </PaginationLink>
                                  </PaginationItem>
                                </React.Fragment>
                              )
                            })}

                          <PaginationItem>
                            <PaginationNext
                              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                              className={
                                currentPage === totalPages
                                  ? "pointer-events-none opacity-50 bg-gray-100"
                                  : "cursor-pointer bg-white text-blue-700 hover:bg-blue-100 hover:text-blue-900 border border-blue-300"
                              }
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Update Status Modal */}
      {statusUpdateReport && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 ${
            statusModalOpen ? "" : "hidden"
          }`}
        >
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h2 className="text-lg text-[#001f3f] font-semibold mb-4">Update Status</h2>
            <div className="mb-4">
              <label className="block text-sm text-[#001f3f] font-medium mb-1">Status</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger
                  className="w-full border border-blue-500 focus:border-[#ee3433] focus:ring-2 focus:ring-[#ee3433] bg-white text-[#001f3f] font-semibold rounded shadow-sm"
                  style={{ minHeight: 40 }}
                >
                  <SelectValue className="text-[#001f3f]" placeholder="Select status..." />
                </SelectTrigger>
                <SelectContent className="bg-white border border-blue-500 text-[#001f3f] rounded shadow-lg">
                  {statusOptions.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      className="data-[state=checked]:!bg-[#ee3433] data-[state=checked]:!text-white hover:bg-blue-100 hover:text-[#001f3f] px-3 py-2 cursor-pointer font-medium rounded"
                      style={{ transition: "background 0.2s, color 0.2s" }}
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mb-4">
              <label className="block text-sm text-[#001f3f] font-medium mb-1">Remarks</label>
              <textarea
                className="w-full text-[#001f3f] border border-gray-300 bg-white rounded p-2"
                rows={3}
                value={statusRemark}
                onChange={(e) => setStatusRemark(e.target.value)}
                placeholder="Enter remarks for this status update..."
              />
            </div>
            {statusError && <div className="text-red-600 text-sm mb-2">{statusError}</div>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStatusModalOpen(false)} disabled={statusSaving}>
                Cancel
              </Button>
              <Button
                onClick={handleUpdateStatus}
                className="bg-[#4284f2] hover:bg-[#357ae8] text-white"
                disabled={statusSaving || !newStatus}
              >
                {statusSaving ? "Saving..." : "Update Status"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {selectedReport && (
        <CommissionReportViewModal
          isOpen={viewModalOpen}
          onClose={() => {
            setViewModalOpen(false)
            setSelectedReport(null)
          }}
          report={selectedReport}
        />
      )}

      {/* Upload Attachments Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-red-500"
              onClick={() => setUploadModalOpen(false)}
              disabled={uploading}
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-lg text-[#001f3f] font-semibold mb-4">Upload Attachments</h2>

            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-[#001f3f]">
                <strong>Report #{uploadReport?.report_number}</strong>
              </p>
              <p className="text-xs text-gray-600">Files will be uploaded to our server and made publicly viewable</p>
            </div>

            <div
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 mb-4 transition cursor-pointer ${
                uploading
                  ? "border-gray-300 bg-gray-50 cursor-not-allowed"
                  : "border-blue-400 bg-blue-50 hover:bg-blue-100"
              }`}
              onDrop={uploading ? undefined : handleDrop}
              onDragOver={uploading ? undefined : (e) => e.preventDefault()}
              onClick={uploading ? undefined : () => document.getElementById("file-upload-input")?.click()}
            >
              <Upload className={`h-10 w-10 mb-2 ${uploading ? "text-gray-400" : "text-blue-400"}`} />
              <p className={`font-medium mb-1 ${uploading ? "text-gray-500" : "text-[#001f3f]"}`}>
                {uploading ? "Uploading..." : "Click to select files or drag and drop here"}
              </p>
              <p className="text-xs text-gray-500">Only image or PDF files are allowed.</p>
              <input
                id="file-upload-input"
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={handleFileInput}
                disabled={uploading}
              />
            </div>

            {uploadError && <div className="text-red-600 text-sm mb-4 p-3 bg-red-50 rounded-lg">{uploadError}</div>}

            {selectedFiles.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-[#001f3f] font-medium mb-2">Selected Files ({selectedFiles.length}):</p>
                <div className="max-h-32 overflow-y-auto">
                  <ul className="space-y-1">
                    {selectedFiles.map((file, idx) => (
                      <li key={idx} className="flex items-center justify-between bg-blue-100 rounded px-3 py-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          <span className="truncate text-sm text-[#001f3f]">{file.name}</span>
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            ({(file.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </div>
                        {!uploading && (
                          <button
                            className="ml-2 text-red-500 hover:text-red-700 flex-shrink-0"
                            onClick={() => handleRemoveFile(idx)}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setUploadModalOpen(false)}
                className="border-[#001f3f] bg-white text-[#001f3f]"
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                className="bg-[#4284f2] hover:bg-[#357ae8] text-white"
                disabled={uploading || selectedFiles.length === 0}
              >
                {uploading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Uploading...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Upload Attachments
                  </div>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
      {attachmentsModalOpen && selectedAttachmentsReport && (
        <AttachmentsModal
          report={selectedAttachmentsReport}
          onClose={() => setAttachmentsModalOpen(false)}
          onDeleteAttachment={async (fileIdx) => {
            // Use secretary_pot if _attachmentType is secretary, else accounting_pot
            const isSecretary = selectedAttachmentsReport._attachmentType === "secretary"
            const attachments = isSecretary
              ? selectedAttachmentsReport.secretary_pot
                ? JSON.parse(selectedAttachmentsReport.secretary_pot)
                : []
              : selectedAttachmentsReport.accounting_pot
                ? JSON.parse(selectedAttachmentsReport.accounting_pot)
                : []
            const fileToDelete = attachments[fileIdx]
            const s3Url = fileToDelete.url
            // For secretary, use your secretary delete API; for accounting, use accounting API
            await fetch(isSecretary ? "/api/delete-from-s3-secretary" : "/api/delete-from-s3", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: isSecretary
                ? JSON.stringify({ url: s3Url })
                : JSON.stringify({ key: s3Url.split(".amazonaws.com/")[1] }),
            })

            const updated = attachments.filter((_, idx) => idx !== fileIdx)
            const updateField = isSecretary
              ? { secretary_pot: JSON.stringify(updated) }
              : { accounting_pot: JSON.stringify(updated) }
            const { error } = await supabase
              .from("commission_report")
              .update(updateField)
              .eq("uuid", selectedAttachmentsReport.uuid)

            if (profile?.id) {
              await logNotification(supabase, {
                action: "commission_report_attachment_deleted",
                description: `Deleted attachment "${fileToDelete.name}" from report #${selectedAttachmentsReport.report_number}`,
                ip_address: null,
                location: null,
                meta: JSON.stringify({
                  report_uuid: selectedAttachmentsReport.uuid,
                  report_number: selectedAttachmentsReport.report_number,
                  attachment_name: fileToDelete.name,
                  attachment_url: fileToDelete.url,
                  attachment_type: selectedAttachmentsReport._attachmentType,
                }),
                user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
                user_email: profile.email,
                user_name: profile.full_name || profile.first_name || profile.id,
                user_uuid: profile.id,
              })
            }

            if (!error) {
              setReports((prev) =>
                prev.map((r) =>
                  r.uuid === selectedAttachmentsReport.uuid
                    ? {
                        ...r,
                        ...(isSecretary
                          ? { secretary_pot: JSON.stringify(updated) }
                          : { accounting_pot: JSON.stringify(updated) }),
                      }
                    : r,
                ),
              )
              setSelectedAttachmentsReport((prev) =>
                prev
                  ? {
                      ...prev,
                      ...(isSecretary
                        ? { secretary_pot: JSON.stringify(updated) }
                        : { accounting_pot: JSON.stringify(updated) }),
                    }
                  : prev,
              )
            }
          }}
        />
      )}
      {imageLightboxOpen && selectedImageReport && (
        <ImageLightboxModal report={selectedImageReport} onClose={() => setImageLightboxOpen(false)} />
      )}
      <Dialog open={salesBreakdownOpen} onOpenChange={setSalesBreakdownOpen}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <div className="flex items-center justify-between" style={{ color: "#001f3f" }}>
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-lg">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-xl" style={{ color: "#001f3f" }}>
                    Sales Breakdown - Report #{selectedReportForSales?.report_number}
                  </DialogTitle>
                  <p className="text-sm" style={{ color: "#001f3f", opacity: 0.7 }}>
                    Detailed breakdown of {selectedSalesData.length} sales records
                  </p>
                </div>
              </div>
            </div>
          </DialogHeader>

          {loadingSalesData ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow style={{ backgroundColor: "#001f3f" }}>
                      <TableHead style={{ color: "white", textAlign: "center" }}>TIN</TableHead>
                      <TableHead style={{ color: "white", textAlign: "center" }}>Taxpayer Name</TableHead>
                      <TableHead style={{ color: "white", textAlign: "center" }}>Tax Month</TableHead>
                      <TableHead style={{ color: "white", textAlign: "center" }}>Type</TableHead>
                      <TableHead style={{ color: "white", textAlign: "center" }}>Gross Taxable</TableHead>
                      <TableHead style={{ color: "white", textAlign: "center" }}>Total Amount</TableHead>
                      <TableHead style={{ color: "white", textAlign: "center" }}>Invoice #</TableHead>
                      <TableHead style={{ color: "white", textAlign: "center" }}>Pickup Date</TableHead>
                      <TableHead style={{ color: "white", textAlign: "center" }}>Sale Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSalesData.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-medium" style={{ color: "#001f3f" }}>
                          {sale.tin}
                        </TableCell>
                        <TableCell style={{ color: "#001f3f" }}>{sale.name}</TableCell>
                        <TableCell style={{ color: "#001f3f" }}>
                          {sale.tax_month
                            ? new Date(sale.tax_month).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            : "N/A"}
                        </TableCell>
                        <TableCell style={{ color: "#001f3f" }}>
                          <Badge variant="outline" style={{ color: "#001f3f" }}>
                            {sale.tax_type?.toUpperCase() || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell style={{ color: "#001f3f" }}>
                          {sale.gross_taxable
                            ? new Intl.NumberFormat("en-PH", {
                                style: "currency",
                                currency: "PHP",
                              }).format(sale.gross_taxable)
                            : "N/A"}
                        </TableCell>
                        <TableCell style={{ color: "#001f3f" }}>
                          {sale.total_actual_amount
                            ? new Intl.NumberFormat("en-PH", {
                                style: "currency",
                                currency: "PHP",
                              }).format(sale.total_actual_amount)
                            : "N/A"}
                        </TableCell>
                        <TableCell style={{ color: "#001f3f" }}>{sale.invoice_number || "N/A"}</TableCell>
                        <TableCell style={{ color: "#001f3f" }}>
                          {sale.pickup_date
                            ? new Date(sale.pickup_date).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            : "N/A"}
                        </TableCell>
                        <TableCell style={{ color: "#001f3f" }}>
                          <Badge variant="outline" style={{ color: "#001f3f" }}>
                            {sale.sale_type?.toUpperCase() || "N/A"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {selectedSalesData.length === 0 && !loadingSalesData && (
                <div className="text-center py-8" style={{ color: "#001f3f" }}>
                  <p>No sales data found for this commission report.</p>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t">
                <div style={{ color: "#001f3f" }}>
                  <strong>Total Records: {selectedSalesData.length}</strong>
                </div>
                <div style={{ color: "#001f3f" }}>
                  <strong>
                    Total Amount:{" "}
                    {new Intl.NumberFormat("en-PH", {
                      style: "currency",
                      currency: "PHP",
                    }).format(selectedSalesData.reduce((sum, sale) => sum + (sale.total_actual_amount || 0), 0))}
                  </strong>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  )
}
