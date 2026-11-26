"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Plus,
  Search,
  FileText,
  Download,
  Eye,
  Pencil,
  Trash2,
  ExternalLink,
  Receipt,
  Layers,
  X,
  Paperclip,
  Upload,
  Loader2,
  AlertTriangle,
  Link2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Printer,
} from "lucide-react"
import { format } from "date-fns"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase/client"
import { logNotification } from "@/utils/logNotification"
import { formatS3Url } from "@/utils/s3-url"
import { downloadAttachmentsAsZip } from "@/utils/download-attachments"
import { YearSelect, MonthMultiSelect } from "@/components/date-period-filter"
import { CreateCommissionVoucherModal } from "@/components/create-commission-voucher-modal"
import {
  VoucherBondpaperDocument,
  downloadVoucherBondpaperPdf,
  generateVoucherBondpaperPdf,
  type CommissionVoucherData,
} from "@/components/voucher-bondpaper-document"

interface CommissionVouchersManagerProps {
  role: "super_admin" | "secretary"
}

export function CommissionVouchersManager({ role }: CommissionVouchersManagerProps) {
  const { profile } = useAuth()
  const [vouchers, setVouchers] = useState<CommissionVoucherData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterSlipType, setFilterSlipType] = useState("all")
  const [filterOrigin, setFilterOrigin] = useState("all")
  const [filterDeveloper, setFilterDeveloper] = useState("all")
  const [filterAgent, setFilterAgent] = useState("all")
  const [filterArea, setFilterArea] = useState("all")
  const [filterFiles, setFilterFiles] = useState("all")
  const [filterYear, setFilterYear] = useState("all")
  const [filterMonths, setFilterMonths] = useState<string[]>([])

  // Sorting & Pagination state
  type VoucherSortField =
    | "created_at"
    | "voucher_number"
    | "developer_name"
    | "agent_name"
    | "client_name"
    | "amount_released"
    | "total_amount"
  const [sortField, setSortField] = useState<VoucherSortField>("created_at")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editVoucher, setEditVoucher] = useState<CommissionVoucherData | null>(null)
  const [viewVoucher, setViewVoucher] = useState<CommissionVoucherData | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  // Extra Attachments modal state
  const [attachVoucher, setAttachVoucher] = useState<CommissionVoucherData | null>(null)
  const [uploadingAttachments, setUploadingAttachments] = useState(false)
  const extraFilesInputRef = useRef<HTMLInputElement | null>(null)

  // Multi-select & Merge into Releases state
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [releaseTitle, setReleaseTitle] = useState("")
  const [releaseRemarks, setReleaseRemarks] = useState("")
  const [merging, setMerging] = useState(false)

  // For Printing preview modal state (vouchers only, no attachments)
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false)
  const [printingVouchers, setPrintingVouchers] = useState(false)
  const printPreviewContainerRef = useRef<HTMLDivElement | null>(null)

  // Batch PDF regeneration state
  const [regeneratingPdfs, setRegeneratingPdfs] = useState(false)
  const [regenerateProgress, setRegenerateProgress] = useState("")
  const [offscreenVoucher, setOffscreenVoucher] = useState<CommissionVoucherData | null>(null)

  const roleSlug = role === "super_admin" ? "super-admin" : "secretary"
  const isReadOnly = role === "secretary"

  const fetchVouchers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("commission_vouchers")
        .select("*")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })

      if (!error && data) {
        let rows = (data as any[]).map((v) => ({
          ...v,
          attachments: Array.isArray(v.attachments) ? v.attachments : [],
        })) as CommissionVoucherData[]
        if (role === "secretary" && profile?.assigned_area) {
          const areaLower = profile.assigned_area.toLowerCase()
          rows = rows.filter(
            (v) =>
              (v.assigned_area || "").toLowerCase() === areaLower ||
              v.created_by_uuid === profile.auth_user_id ||
              v.created_by_uuid === profile.id
          )
        }
        setVouchers(rows)

        if (attachVoucher?.id) {
          const updated = rows.find((r) => r.id === attachVoucher.id)
          if (updated) setAttachVoucher(updated)
        }
        if (viewVoucher?.id) {
          const updated = rows.find((r) => r.id === viewVoucher.id)
          if (updated) setViewVoucher(updated)
        }
      }
    } catch (err) {
      console.error("Error fetching commission vouchers:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVouchers()
  }, [profile?.id])

  // Dynamic filter dropdown options derived from loaded vouchers
  const availableDevelopers = useMemo(() => {
    const set = new Set<string>()
    vouchers.forEach((v) => {
      if (v.developer_name?.trim()) set.add(v.developer_name.trim())
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [vouchers])

  const availableAgents = useMemo(() => {
    const set = new Set<string>()
    vouchers.forEach((v) => {
      if (v.agent_name?.trim()) set.add(v.agent_name.trim())
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [vouchers])

  const availableAreas = useMemo(() => {
    const set = new Set<string>()
    vouchers.forEach((v) => {
      if (v.assigned_area?.trim()) set.add(v.assigned_area.trim())
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [vouchers])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (searchTerm.trim()) count++
    if (filterSlipType !== "all") count++
    if (filterOrigin !== "all") count++
    if (filterDeveloper !== "all") count++
    if (filterAgent !== "all") count++
    if (filterArea !== "all") count++
    if (filterFiles !== "all") count++
    if (filterYear !== "all") count++
    if (filterMonths.length > 0 && filterMonths.length < 12) count++
    return count
  }, [
    searchTerm,
    filterSlipType,
    filterOrigin,
    filterDeveloper,
    filterAgent,
    filterArea,
    filterFiles,
    filterYear,
    filterMonths,
  ])

  const resetAllFilters = () => {
    setSearchTerm("")
    setFilterSlipType("all")
    setFilterOrigin("all")
    setFilterDeveloper("all")
    setFilterAgent("all")
    setFilterArea("all")
    setFilterFiles("all")
    setFilterYear("all")
    setFilterMonths([])
    setCurrentPage(1)
  }

  const handleSort = (field: VoucherSortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir(field === "created_at" || field === "amount_released" || field === "total_amount" ? "desc" : "asc")
    }
    setCurrentPage(1)
  }

  const renderSortIcon = (field: VoucherSortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-50 inline ml-1" />
    return sortDir === "asc" ? (
      <ArrowUp className="w-3 h-3 text-sky-300 inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 text-sky-300 inline ml-1" />
    )
  }

  const filteredVouchers = useMemo(() => {
    const filtered = vouchers.filter((v) => {
      if (filterSlipType !== "all" && v.slip_type !== filterSlipType) return false

      if (filterOrigin === "direct_only" && v.is_converted_from_report) return false
      if (filterOrigin === "from_reports" && !v.is_converted_from_report) return false
      if (filterOrigin === "unencoded_only" && !v.is_unencoded_sale) return false
      if (
        filterOrigin === "tl_um_shares" &&
        v.recipient_role !== "team_leader" &&
        v.recipient_role !== "unit_manager"
      ) {
        return false
      }

      if (filterDeveloper !== "all" && (v.developer_name || "").trim() !== filterDeveloper) return false
      if (filterAgent !== "all" && (v.agent_name || "").trim() !== filterAgent) return false
      if (filterArea !== "all" && (v.assigned_area || "").trim() !== filterArea) return false

      if (filterFiles === "has_pdf" && !v.generated_pdf_url) return false
      if (filterFiles === "no_pdf" && v.generated_pdf_url) return false
      if (filterFiles === "has_extra" && (!v.attachments || v.attachments.length === 0)) return false

      if (filterYear !== "all" || (filterMonths.length > 0 && filterMonths.length < 12)) {
        if (!v.created_at) return false
        const dt = new Date(v.created_at)
        if (Number.isNaN(dt.getTime())) return false
        const yr = String(dt.getFullYear())
        const mo = String(dt.getMonth() + 1).padStart(2, "0")
        if (filterYear !== "all" && yr !== filterYear) return false
        if (filterMonths.length > 0 && filterMonths.length < 12 && !filterMonths.includes(mo)) {
          return false
        }
      }

      if (searchTerm.trim() !== "") {
        const q = searchTerm.toLowerCase()
        const haystack = [
          v.voucher_number,
          v.agent_name,
          v.developer_name,
          v.client_name,
          v.project_name,
          v.unit_number,
          v.team_name,
          v.assigned_area,
          String(v.source_commission_report_number || ""),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })

    // Sort results
    const sorted = [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1
      switch (sortField) {
        case "voucher_number":
          return (
            String(a.voucher_number || "").localeCompare(String(b.voucher_number || ""), undefined, {
              numeric: true,
              sensitivity: "base",
            }) * dir
          )
        case "developer_name":
          return String(a.developer_name || "").localeCompare(String(b.developer_name || "")) * dir
        case "agent_name":
          return String(a.agent_name || "").localeCompare(String(b.agent_name || "")) * dir
        case "client_name":
          return String(a.client_name || "").localeCompare(String(b.client_name || "")) * dir
        case "amount_released":
          return ((Number(a.amount_released) || 0) - (Number(b.amount_released) || 0)) * dir
        case "total_amount":
          return ((Number(a.total_amount) || 0) - (Number(b.total_amount) || 0)) * dir
        case "created_at":
        default: {
          const ta = a.created_at ? new Date(a.created_at).getTime() : 0
          const tb = b.created_at ? new Date(b.created_at).getTime() : 0
          return (ta - tb) * dir
        }
      }
    })
    return sorted
  }, [
    vouchers,
    filterSlipType,
    filterOrigin,
    filterDeveloper,
    filterAgent,
    filterArea,
    filterFiles,
    filterYear,
    filterMonths,
    searchTerm,
    sortField,
    sortDir,
  ])

  const totalPages = Math.max(1, Math.ceil(filteredVouchers.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)

  useEffect(() => {
    setCurrentPage(1)
  }, [
    searchTerm,
    filterSlipType,
    filterOrigin,
    filterDeveloper,
    filterAgent,
    filterArea,
    filterFiles,
    filterYear,
    filterMonths,
    pageSize,
  ])

  const paginatedVouchers = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filteredVouchers.slice(start, start + pageSize)
  }, [filteredVouchers, safePage, pageSize])

  const pageNumbers = useMemo(() => {
    const pages: (number | "...")[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (safePage > 3) pages.push("...")
      const start = Math.max(2, safePage - 1)
      const end = Math.min(totalPages - 1, safePage + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (safePage < totalPages - 2) pages.push("...")
      pages.push(totalPages)
    }
    return pages
  }, [totalPages, safePage])

  // Stats exclude converted-from-report duplicates from direct stats breakdown so nothing is double-counted
  const stats = useMemo(() => {
    const directVouchers = vouchers.filter((v) => !v.is_converted_from_report)
    const convertedCount = vouchers.length - directVouchers.length
    const unencodedCount = vouchers.filter((v) => v.is_unencoded_sale).length
    const totalReleased = directVouchers.reduce((s, v) => s + (Number(v.amount_released) || 0), 0)
    const totalNet = directVouchers.reduce((s, v) => s + (Number(v.total_amount) || 0), 0)
    const totalTax = directVouchers.reduce((s, v) => s + (Number(v.withholding_tax) || 0), 0)
    return {
      count: vouchers.length,
      directCount: directVouchers.length,
      convertedCount,
      unencodedCount,
      totalReleased,
      totalNet,
      totalTax,
    }
  }, [vouchers])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(Number(val) || 0)

  const logVoucherAction = async (
    action: string,
    description: string,
    meta: Record<string, any> = {}
  ) => {
    if (!profile?.id) return
    await logNotification(supabase, {
      action,
      description,
      ip_address: null,
      location: null,
      meta: JSON.stringify(meta),
      user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
      user_email: profile.email || "",
      user_name: profile.full_name || profile.first_name || profile.email || profile.id,
      user_uuid: profile.id,
    })
  }

  const handleDelete = async (voucher: CommissionVoucherData) => {
    if (isReadOnly || !voucher.id) return
    if (!confirm(`Are you sure you want to delete Voucher #${voucher.voucher_number}?`)) return
    try {
      const { error } = await supabase
        .from("commission_vouchers")
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq("id", voucher.id)
      if (error) throw error
      await logVoucherAction(
        "commission_voucher_deleted",
        `Deleted Commission Voucher #${voucher.voucher_number} (${voucher.agent_name || "Agent"} — ${formatCurrency(Number(voucher.total_amount) || 0)})`,
        {
          voucher_id: voucher.id,
          voucher_number: voucher.voucher_number,
          agent_name: voucher.agent_name,
          developer_name: voucher.developer_name,
          total_amount: voucher.total_amount,
        }
      )
      setSelectedIds((prev) => prev.filter((id) => id !== voucher.id))
      fetchVouchers()
    } catch (err: any) {
      alert("Error deleting voucher: " + (err?.message || "Failed"))
    }
  }

  const handleUploadExtraAttachments = async (files: FileList | null) => {
    if (isReadOnly || !files || files.length === 0 || !attachVoucher?.id) return
    setUploadingAttachments(true)
    try {
      const uploadedUrls: string[] = []
      const adminName = profile?.full_name || profile?.email || "Accounting"

      for (const file of Array.from(files)) {
        const presignedRes = await fetch("/api/get-s3-upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type || "application/octet-stream",
            category: "voucher",
            reportNumber: attachVoucher.voucher_number || "voucher",
            tinName: attachVoucher.agent_name || adminName,
            assignedArea: attachVoucher.assigned_area || profile?.assigned_area || "Cebu",
            userFullName: adminName,
          }),
        })

        if (!presignedRes.ok) {
          throw new Error(`Failed to get S3 upload URL for ${file.name}`)
        }

        const { uploadUrl, publicUrl } = await presignedRes.json()
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        })
        if (!putRes.ok) {
          throw new Error(`Failed to upload ${file.name} (${putRes.status})`)
        }
        uploadedUrls.push(formatS3Url(publicUrl))
      }

      const nextAttachments = [...(attachVoucher.attachments || []), ...uploadedUrls]
      const { error } = await supabase
        .from("commission_vouchers")
        .update({
          attachments: nextAttachments,
          updated_at: new Date().toISOString(),
        })
        .eq("id", attachVoucher.id)

      if (error) throw error

      await logVoucherAction(
        "commission_voucher_attachment_uploaded",
        `Uploaded ${uploadedUrls.length} extra attachment(s) to Commission Voucher #${attachVoucher.voucher_number}`,
        {
          voucher_id: attachVoucher.id,
          voucher_number: attachVoucher.voucher_number,
          uploaded_count: uploadedUrls.length,
        }
      )

      setAttachVoucher({ ...attachVoucher, attachments: nextAttachments })
      fetchVouchers()
    } catch (err: any) {
      console.error("Error uploading voucher attachments:", err)
      alert("Error uploading attachment(s): " + (err?.message || "Please try again."))
    } finally {
      setUploadingAttachments(false)
      if (extraFilesInputRef.current) extraFilesInputRef.current.value = ""
    }
  }

  const handleRemoveExtraAttachment = async (urlToRemove: string) => {
    if (isReadOnly || !attachVoucher?.id) return
    if (!confirm("Remove this attachment from the voucher?")) return
    try {
      const nextAttachments = (attachVoucher.attachments || []).filter((u) => u !== urlToRemove)
      const { error } = await supabase
        .from("commission_vouchers")
        .update({
          attachments: nextAttachments,
          updated_at: new Date().toISOString(),
        })
        .eq("id", attachVoucher.id)
      if (error) throw error
      await logVoucherAction(
        "commission_voucher_attachment_deleted",
        `Removed an extra attachment from Commission Voucher #${attachVoucher.voucher_number}`,
        {
          voucher_id: attachVoucher.id,
          voucher_number: attachVoucher.voucher_number,
          removed_url: urlToRemove,
        }
      )
      setAttachVoucher({ ...attachVoucher, attachments: nextAttachments })
      fetchVouchers()
    } catch (err: any) {
      alert("Error removing attachment: " + (err?.message || "Failed"))
    }
  }

  const selectedVouchers = useMemo(
    () => vouchers.filter((v) => v.id && selectedIds.includes(v.id)),
    [vouchers, selectedIds]
  )

  const selectedTotals = useMemo(() => {
    const gross = selectedVouchers.reduce((s, v) => s + (Number(v.amount_released) || 0), 0)
    const net = selectedVouchers.reduce((s, v) => s + (Number(v.total_amount) || 0), 0)
    const extraAttachmentsCount = selectedVouchers.reduce(
      (s, v) => s + (v.attachments?.length || 0),
      0
    )
    return { gross, net, extraAttachmentsCount }
  }, [selectedVouchers])

  const toggleSelect = (id?: string) => {
    if (isReadOnly || !id) return
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const pageVisibleIds = useMemo(
    () => paginatedVouchers.map((v) => v.id).filter((id): id is string => Boolean(id)),
    [paginatedVouchers]
  )

  const allFilteredIds = useMemo(
    () => filteredVouchers.map((v) => v.id).filter((id): id is string => Boolean(id)),
    [filteredVouchers]
  )

  const allVisibleSelected =
    pageVisibleIds.length > 0 && pageVisibleIds.every((id) => selectedIds.includes(id))

  const toggleSelectAll = () => {
    if (isReadOnly) return
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageVisibleIds.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageVisibleIds])))
    }
  }

  const openMergeModal = () => {
    if (isReadOnly || selectedVouchers.length === 0) return
    setReleaseTitle("")
    setReleaseRemarks("")
    setMergeModalOpen(true)
  }

  const openPrintPreviewModal = () => {
    if (isReadOnly || selectedVouchers.length === 0) return
    setPrintPreviewOpen(true)
  }

  const handleTriggerBrowserPrint = async () => {
    if (selectedVouchers.length === 0 || !printPreviewContainerRef.current) return
    setPrintingVouchers(true)
    try {
      const pageNodes = Array.from(
        printPreviewContainerRef.current.querySelectorAll<HTMLElement>("[data-voucher-print-page='true']")
      )
      if (pageNodes.length === 0) {
        alert("No voucher pages found to print.")
        return
      }

      const pagesHtml = pageNodes
        .map((node) => `<div class="voucher-print-page">${node.innerHTML}</div>`)
        .join("")

      const iframe = document.createElement("iframe")
      iframe.style.position = "fixed"
      iframe.style.right = "0"
      iframe.style.bottom = "0"
      iframe.style.width = "0"
      iframe.style.height = "0"
      iframe.style.border = "0"
      document.body.appendChild(iframe)

      const doc = iframe.contentWindow?.document
      if (!doc || !iframe.contentWindow) {
        document.body.removeChild(iframe)
        throw new Error("Unable to initialize print frame.")
      }

      doc.open()
      doc.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Commission Vouchers — For Printing (${selectedVouchers.length})</title>
    <style>
      @page {
        size: A4 portrait;
        margin: 0;
      }
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        font-family: Arial, Helvetica, sans-serif;
      }
      .voucher-print-page {
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        page-break-after: always;
        break-after: page;
        overflow: hidden;
      }
      .voucher-print-page:last-child {
        page-break-after: auto;
        break-after: auto;
      }
    </style>
  </head>
  <body>${pagesHtml}</body>
</html>`)
      doc.close()

      // Wait for all images inside the print iframe to finish loading (max 3.5s)
      const imgs = Array.from(doc.querySelectorAll("img"))
      await Promise.race([
        Promise.all(
          imgs.map(
            (img) =>
              new Promise<void>((resolve) => {
                if (img.complete) return resolve()
                img.onload = () => resolve()
                img.onerror = () => resolve()
              })
          )
        ),
        new Promise<void>((resolve) => setTimeout(resolve, 3500)),
      ])

      const voucherNumbers = selectedVouchers.map((v) => v.voucher_number).filter(Boolean)
      await logVoucherAction(
        "commission_voucher_printed",
        `Prepared & printed ${selectedVouchers.length} Commission Voucher(s) without attachments (${voucherNumbers.slice(0, 8).map((n) => `#${n}`).join(", ")}${voucherNumbers.length > 8 ? ` +${voucherNumbers.length - 8} more` : ""})`,
        {
          count: selectedVouchers.length,
          voucher_ids: selectedVouchers.map((v) => v.id).filter(Boolean),
          voucher_numbers: voucherNumbers,
          total_gross: selectedTotals.gross,
          total_net: selectedTotals.net,
          attachments_excluded: true,
        }
      )

      const cleanup = () => {
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
        }, 1000)
      }
      iframe.contentWindow.onafterprint = cleanup
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
      setTimeout(cleanup, 60000)
    } catch (err: any) {
      console.error("Error printing commission vouchers:", err)
      alert("Error preparing print preview: " + (err?.message || "Please try again."))
    } finally {
      setPrintingVouchers(false)
    }
  }

  const handleMergeIntoRelease = async () => {
    if (isReadOnly) return
    if (!releaseTitle.trim()) {
      alert("Please enter a Release Title.")
      return
    }
    if (selectedVouchers.length === 0) return

    setMerging(true)
    try {
      // Include each voucher's generated bondpaper PDF followed by all of its extra attachments
      const pdfUrls: string[] = []
      for (const v of selectedVouchers) {
        if (v.generated_pdf_url) {
          pdfUrls.push(formatS3Url(v.generated_pdf_url))
        }
        if (Array.isArray(v.attachments) && v.attachments.length > 0) {
          for (const att of v.attachments) {
            if (att) pdfUrls.push(formatS3Url(att))
          }
        }
      }

      let combinedPdfUrl: string | null = null

      if (pdfUrls.length > 0) {
        const mergeRes = await fetch("/api/merge-release-pdfs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pdfUrls }),
        })

        if (!mergeRes.ok) {
          const errJson = await mergeRes.json().catch(() => ({}))
          throw new Error(errJson?.error || "Failed to combine voucher PDFs and attachments.")
        }

        const mergedBlob = await mergeRes.blob()
        const presignedRes = await fetch("/api/get-s3-upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: `${releaseTitle.trim().replace(/[^\w\-]+/g, "_")}.pdf`,
            fileType: "application/pdf",
            category: "release",
            reportNumber: releaseTitle.trim(),
            tinName: profile?.full_name || "Accounting",
            assignedArea: profile?.assigned_area || "Cebu",
            userFullName: profile?.full_name || "Accounting",
          }),
        })

        if (!presignedRes.ok) {
          throw new Error("Failed to get S3 upload authorization for merged PDF.")
        }

        const { uploadUrl, publicUrl } = await presignedRes.json()
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/pdf" },
          body: mergedBlob,
        })
        if (!putRes.ok) {
          throw new Error(`S3 upload failed (${putRes.status})`)
        }
        combinedPdfUrl = formatS3Url(publicUrl)
      }

      const voucherIds = selectedVouchers.map((v) => v.id!).filter(Boolean)
      const voucherNumbers = selectedVouchers.map((v) => v.voucher_number).filter(Boolean)

      const { error } = await supabase.from("commission_releases").insert([
        {
          title: releaseTitle.trim(),
          remarks: releaseRemarks.trim() || null,
          voucher_ids: voucherIds,
          voucher_numbers: voucherNumbers,
          total_gross_comm: selectedTotals.gross,
          total_net_comm: selectedTotals.net,
          combined_pdf_url: combinedPdfUrl,
          pot_files: [],
          created_by_uuid: profile?.auth_user_id || profile?.id || null,
          created_by_name: profile?.full_name || null,
          created_by_email: profile?.email || null,
          assigned_area: profile?.assigned_area || null,
        },
      ])

      if (error) throw error

      if (profile?.id) {
        await logNotification(supabase, {
          action: "commission_release_created",
          description: `Commission Release "${releaseTitle.trim()}" created from ${selectedVouchers.length} voucher(s) (+${selectedTotals.extraAttachmentsCount} extra attachment(s))`,
          ip_address: null,
          location: null,
          meta: JSON.stringify({
            title: releaseTitle.trim(),
            voucherNumbers,
            totalGrossComm: selectedTotals.gross,
            totalNetComm: selectedTotals.net,
            extraAttachmentsCount: selectedTotals.extraAttachmentsCount,
          }),
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
          user_email: profile.email || "",
          user_name: profile.full_name || profile.first_name || profile.id,
          user_uuid: profile.id,
        })
      }

      setSelectedIds([])
      setMergeModalOpen(false)
      alert(`Release "${releaseTitle.trim()}" created and grouped under Commission > Releases!`)
    } catch (err: any) {
      console.error("Error merging vouchers into release:", err)
      alert("Error creating release: " + (err?.message || "Please try again."))
    } finally {
      setMerging(false)
    }
  }

  const handleDownloadBondpaperPdf = async (voucher: CommissionVoucherData) => {
    await logVoucherAction(
      "commission_voucher_pdf_downloaded",
      `Opened/downloaded Bondpaper PDF for Commission Voucher #${voucher.voucher_number} (${voucher.agent_name || "Agent"})`,
      {
        voucher_id: voucher.id,
        voucher_number: voucher.voucher_number,
        agent_name: voucher.agent_name,
      }
    )
    if (voucher.generated_pdf_url) {
      window.open(formatS3Url(voucher.generated_pdf_url), "_blank")
      return
    }
    const el = document.getElementById(`view-voucher-doc-${voucher.id}`)
    if (!el) return
    setDownloadingPdf(true)
    try {
      await downloadVoucherBondpaperPdf(el, voucher.voucher_number)
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handleRegeneratePdfs = async (targets: CommissionVoucherData[]) => {
    if (isReadOnly || targets.length === 0 || regeneratingPdfs) return
    if (
      !confirm(
        `Regenerate Bondpaper PDF for ${targets.length} voucher(s) using the updated Commission Slip layout (with watermark, readable dates, and fixed underlines)?`
      )
    ) {
      return
    }

    setRegeneratingPdfs(true)
    let successCount = 0
    const adminName = profile?.full_name || profile?.email || "Accounting"

    try {
      for (let i = 0; i < targets.length; i++) {
        const v = targets[i]
        if (!v.id) continue
        setRegenerateProgress(`Regenerating ${i + 1} of ${targets.length} (#${v.voucher_number})...`)
        setOffscreenVoucher(v)

        // Wait for DOM & images/SVG watermark to paint cleanly before html2canvas capture
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        await new Promise((resolve) => setTimeout(resolve, 180))

        const el = document.getElementById("regenerate-voucher-bondpaper-hidden")
        if (!el) continue

        const { blob } = await generateVoucherBondpaperPdf(el)

        const presignedRes = await fetch("/api/get-s3-upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: `Commission_Voucher_${(v.voucher_number || v.id).replace(/[^\w\-]+/g, "_")}.pdf`,
            fileType: "application/pdf",
            category: "voucher",
            reportNumber: v.voucher_number || "voucher",
            tinName: v.agent_name || adminName,
            assignedArea: v.assigned_area || profile?.assigned_area || "Cebu",
            userFullName: adminName,
          }),
        })

        if (!presignedRes.ok) {
          throw new Error(`Failed to get S3 upload URL for Voucher #${v.voucher_number}`)
        }

        const { uploadUrl, publicUrl } = await presignedRes.json()
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/pdf" },
          body: blob,
        })
        if (!putRes.ok) {
          throw new Error(`S3 upload failed for Voucher #${v.voucher_number} (${putRes.status})`)
        }

        const newPdfUrl = formatS3Url(publicUrl)
        const { error } = await supabase
          .from("commission_vouchers")
          .update({
            generated_pdf_url: newPdfUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", v.id)

        if (error) throw error
        successCount++
      }

      await logVoucherAction(
        "commission_voucher_pdfs_regenerated",
        `Regenerated Bondpaper PDF for ${successCount} of ${targets.length} Commission Voucher(s)`,
        {
          regenerated_count: successCount,
          target_count: targets.length,
          voucher_numbers: targets.slice(0, 20).map((v) => v.voucher_number).filter(Boolean),
        }
      )

      await fetchVouchers()
      alert(`Successfully regenerated ${successCount} of ${targets.length} voucher PDF(s)!`)
    } catch (err: any) {
      console.error("Error regenerating voucher PDFs:", err)
      alert(
        `Regenerated ${successCount} voucher(s), then encountered an error: ${err?.message || "Failed"}`
      )
      await fetchVouchers()
    } finally {
      setOffscreenVoucher(null)
      setRegenerateProgress("")
      setRegeneratingPdfs(false)
    }
  }

  const getRoleBadge = (recipientRole?: string) => {
    if (recipientRole === "team_leader") {
      return (
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border border-blue-200 text-[10px] px-1.5 py-0">
          Team Leader
        </Badge>
      )
    }
    if (recipientRole === "unit_manager") {
      return (
        <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 border border-purple-200 text-[10px] px-1.5 py-0">
          Unit Manager
        </Badge>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-[#001f3f] to-[#0284c7] p-3 rounded-xl text-white shadow">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#001f3f]">
                Commission Vouchers
              </h1>
              {isReadOnly && (
                <Badge variant="outline" className="border-indigo-300 bg-indigo-50 text-indigo-700 text-xs">
                  View Only
                </Badge>
              )}
            </div>
            <p className="text-sm text-slate-600">
              {isReadOnly
                ? "View-only access to Commission Slip Vouchers and generated Bondpaper PDFs."
                : "Generate Commission Slip Vouchers with cropped Voucher & Header attachments, extra supporting files, and linked Team Leader / Unit Manager shares."}
            </p>
          </div>
        </div>

        {!isReadOnly && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleRegeneratePdfs(vouchers)}
              disabled={regeneratingPdfs || vouchers.length === 0}
              className="border-sky-600 text-sky-800 hover:bg-sky-50 bg-white font-semibold"
              title="Regenerate all saved voucher PDFs using the latest Commission Slip layout"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${regeneratingPdfs ? "animate-spin" : ""}`} />
              {regeneratingPdfs ? regenerateProgress || "Regenerating..." : "Regenerate All PDFs"}
            </Button>
            <Button
              onClick={() => setCreateModalOpen(true)}
              disabled={regeneratingPdfs}
              className="bg-[#001f3f] hover:bg-[#001f3f]/90 text-white font-semibold shadow"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Voucher
            </Button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Total Vouchers</p>
            <p className="text-2xl font-extrabold text-[#001f3f] mt-1">{stats.count}</p>
            <p className="text-[11px] text-slate-500 mt-1">
              {stats.directCount} direct &bull; {stats.convertedCount} from reports &bull; {stats.unencodedCount} unencoded
            </p>
          </CardContent>
        </Card>
        <Card className="bg-sky-50/70 border-sky-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase text-sky-800">Direct Released (Excl. Report Duplicates)</p>
            <p className="text-2xl font-extrabold text-sky-900 mt-1">
              {formatCurrency(stats.totalReleased)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50/70 border-emerald-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase text-emerald-800">Direct Net for Release</p>
            <p className="text-2xl font-extrabold text-emerald-900 mt-1">
              {formatCurrency(stats.totalNet)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50/70 border-amber-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase text-amber-800">Direct BIR 2307 / EWT</p>
            <p className="text-2xl font-extrabold text-amber-900 mt-1">
              {formatCurrency(stats.totalTax)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardContent className="p-4 space-y-3">
          {/* Filter Row 1: Search + Slip Type + Record Origin + Reset */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search voucher #, agent, developer, client, project, unit, team, or report #..."
                className="pl-9 bg-white text-[#001f3f] border-slate-300"
              />
            </div>
            <Select value={filterSlipType} onValueChange={setFilterSlipType}>
              <SelectTrigger className="w-full md:w-44 bg-white text-[#001f3f] border-slate-300">
                <SelectValue placeholder="All Slip Types" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Slip Types</SelectItem>
                <SelectItem value="Non-VAT">Non-VAT</SelectItem>
                <SelectItem value="VAT w/ Invoice">VAT w/ Invoice</SelectItem>
                <SelectItem value="VAT w/o Invoice">VAT w/o Invoice</SelectItem>
                <SelectItem value="VAT without Rate">VAT without Rate</SelectItem>
                <SelectItem value="W/o Invoice">W/o Invoice</SelectItem>
                <SelectItem value="Rate w/o Invoice">Rate w/o Invoice</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterOrigin} onValueChange={setFilterOrigin}>
              <SelectTrigger className="w-full md:w-56 bg-white text-[#001f3f] border-slate-300">
                <SelectValue placeholder="All Record Types" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Records</SelectItem>
                <SelectItem value="direct_only">Direct Only (Excl. Report Duplicates)</SelectItem>
                <SelectItem value="from_reports">Converted from Commission Reports</SelectItem>
                <SelectItem value="unencoded_only">Unencoded Sales Only</SelectItem>
                <SelectItem value="tl_um_shares">Team Leader / Unit Manager Shares</SelectItem>
              </SelectContent>
            </Select>
            {activeFilterCount > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={resetAllFilters}
                className="border-red-200 text-red-700 hover:bg-red-50 bg-white shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Reset ({activeFilterCount})
              </Button>
            )}
          </div>

          {/* Filter Row 2: Developer, Agent, Area, Year, Month, Files */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 pt-1 border-t border-slate-100">
            <Select value={filterDeveloper} onValueChange={setFilterDeveloper}>
              <SelectTrigger className="bg-white text-[#001f3f] border-slate-300 text-xs h-9">
                <SelectValue placeholder="All Developers" />
              </SelectTrigger>
              <SelectContent className="bg-white max-h-72">
                <SelectItem value="all">All Developers ({availableDevelopers.length})</SelectItem>
                {availableDevelopers.map((dev) => (
                  <SelectItem key={dev} value={dev}>
                    {dev}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterAgent} onValueChange={setFilterAgent}>
              <SelectTrigger className="bg-white text-[#001f3f] border-slate-300 text-xs h-9">
                <SelectValue placeholder="All Agents" />
              </SelectTrigger>
              <SelectContent className="bg-white max-h-72">
                <SelectItem value="all">All Agents ({availableAgents.length})</SelectItem>
                {availableAgents.map((ag) => (
                  <SelectItem key={ag} value={ag}>
                    {ag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {role === "super_admin" && (
              <Select value={filterArea} onValueChange={setFilterArea}>
                <SelectTrigger className="bg-white text-[#001f3f] border-slate-300 text-xs h-9">
                  <SelectValue placeholder="All Areas" />
                </SelectTrigger>
                <SelectContent className="bg-white max-h-72">
                  <SelectItem value="all">All Areas</SelectItem>
                  {availableAreas.map((area) => (
                    <SelectItem key={area} value={area}>
                      {area}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={filterFiles} onValueChange={setFilterFiles}>
              <SelectTrigger className="bg-white text-[#001f3f] border-slate-300 text-xs h-9">
                <SelectValue placeholder="All Files" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All PDF &amp; File Status</SelectItem>
                <SelectItem value="has_pdf">Has Slip PDF</SelectItem>
                <SelectItem value="no_pdf">Missing Slip PDF</SelectItem>
                <SelectItem value="has_extra">Has Extra Attachments</SelectItem>
              </SelectContent>
            </Select>

            <YearSelect
              value={filterYear}
              onValueChange={setFilterYear}
              className="w-full h-9 text-xs border-slate-300 bg-white text-[#001f3f]"
            />

            <MonthMultiSelect
              selectedMonths={filterMonths}
              onMonthsChange={setFilterMonths}
              selectedYear={filterYear}
              className="w-full h-9 text-xs border-slate-300 bg-white text-[#001f3f]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Selection Action Bar (Accounting Only) */}
      {!isReadOnly && selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#001f3f] text-white px-4 py-3 rounded-xl shadow-md">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-sky-500 text-white border-0 font-bold px-2.5 py-1">
              {selectedIds.length} Selected
            </Badge>
            <span className="text-xs sm:text-sm text-slate-200">
              Total Gross: <strong className="text-white">{formatCurrency(selectedTotals.gross)}</strong> &bull;{" "}
              Total Net: <strong className="text-emerald-300">{formatCurrency(selectedTotals.net)}</strong>
              {selectedTotals.extraAttachmentsCount > 0 && (
                <>
                  {" "}&bull;{" "}
                  <strong className="text-amber-300">
                    +{selectedTotals.extraAttachmentsCount} extra file(s) included
                  </strong>
                </>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds([])}
              className="text-slate-200 hover:text-white hover:bg-white/10"
            >
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleRegeneratePdfs(selectedVouchers)}
              disabled={regeneratingPdfs}
              className="border-sky-300 bg-white/10 text-white hover:bg-white/20"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${regeneratingPdfs ? "animate-spin" : ""}`} />
              Regenerate PDFs
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={openPrintPreviewModal}
              disabled={regeneratingPdfs}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold"
              title="Preview selected commission voucher(s) merged together for browser printing (excludes extra attachments)"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              For Printing
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={openMergeModal}
              disabled={regeneratingPdfs}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
            >
              <Layers className="w-4 h-4 mr-1.5" />
              Merge into Release
            </Button>
          </div>
        </div>
      )}

      {/* Vouchers Table */}
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-bold text-[#001f3f]">Saved Commission Vouchers</CardTitle>
              <Badge variant="outline" className="text-xs border-slate-300 text-slate-700 font-semibold">
                {filteredVouchers.length} {filteredVouchers.length === 1 ? "result" : "results"}
                {filteredVouchers.length !== vouchers.length ? ` of ${vouchers.length}` : ""}
              </Badge>
            </div>
            <CardDescription>
              {isReadOnly
                ? "View and download saved Commission Vouchers."
                : "Check vouchers to merge them (along with extra attachments) into a Release, or manage individual vouchers."}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {!isReadOnly && allFilteredIds.length > pageVisibleIds.length && selectedIds.length > 0 && selectedIds.length < allFilteredIds.length && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedIds(allFilteredIds)}
                className="text-xs border-sky-300 text-sky-800 bg-sky-50 hover:bg-sky-100"
              >
                Select all {allFilteredIds.length} filtered
              </Button>
            )}
            <Link href={`/dashboard/${roleSlug}/releases`}>
              <Button variant="outline" size="sm" className="border-[#001f3f] text-[#001f3f] bg-white">
                <Layers className="w-4 h-4 mr-1.5" />
                Go to Commission Releases
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#001f3f] hover:bg-[#001f3f]">
                  {!isReadOnly && (
                    <TableHead className="w-10 text-center">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all vouchers on this page"
                        className="border-white data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                      />
                    </TableHead>
                  )}
                  <TableHead
                    onClick={() => handleSort("voucher_number")}
                    className="text-white font-semibold cursor-pointer select-none whitespace-nowrap hover:text-sky-200"
                  >
                    Voucher # {renderSortIcon("voucher_number")}
                  </TableHead>
                  <TableHead className="text-white font-semibold whitespace-nowrap">Slip Type &amp; Trace</TableHead>
                  <TableHead
                    onClick={() => handleSort("developer_name")}
                    className="text-white font-semibold cursor-pointer select-none whitespace-nowrap hover:text-sky-200"
                  >
                    Developer {renderSortIcon("developer_name")}
                  </TableHead>
                  <TableHead
                    onClick={() => handleSort("agent_name")}
                    className="text-white font-semibold cursor-pointer select-none whitespace-nowrap hover:text-sky-200"
                  >
                    Recipient / Agent {renderSortIcon("agent_name")}
                  </TableHead>
                  <TableHead className="text-white font-semibold whitespace-nowrap">Project &amp; Unit</TableHead>
                  <TableHead
                    onClick={() => handleSort("client_name")}
                    className="text-white font-semibold cursor-pointer select-none whitespace-nowrap hover:text-sky-200"
                  >
                    Client {renderSortIcon("client_name")}
                  </TableHead>
                  <TableHead
                    onClick={() => handleSort("amount_released")}
                    className="text-white font-semibold text-right cursor-pointer select-none whitespace-nowrap hover:text-sky-200"
                  >
                    Released {renderSortIcon("amount_released")}
                  </TableHead>
                  <TableHead
                    onClick={() => handleSort("total_amount")}
                    className="text-white font-semibold text-right cursor-pointer select-none whitespace-nowrap hover:text-sky-200"
                  >
                    Total Release {renderSortIcon("total_amount")}
                  </TableHead>
                  <TableHead className="text-white font-semibold whitespace-nowrap">PDF &amp; Files</TableHead>
                  <TableHead className="text-white font-semibold text-right whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={isReadOnly ? 10 : 11} className="text-center py-12 text-slate-500">
                      Loading commission vouchers...
                    </TableCell>
                  </TableRow>
                ) : paginatedVouchers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isReadOnly ? 10 : 11} className="text-center py-12 text-slate-500">
                      No commission vouchers match your current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedVouchers.map((v) => {
                    const isSelected = Boolean(v.id && selectedIds.includes(v.id))
                    const extraCount = v.attachments?.length || 0
                    return (
                      <TableRow
                        key={v.id}
                        className={isSelected ? "bg-sky-50/90 hover:bg-sky-100/70" : "hover:bg-slate-50"}
                      >
                        {!isReadOnly && (
                          <TableCell className="text-center">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(v.id)}
                              aria-label={`Select Voucher #${v.voucher_number}`}
                            />
                          </TableCell>
                        )}
                        <TableCell className="font-extrabold text-[#001f3f]">
                          <div>#{v.voucher_number}</div>
                          {v.created_at && (
                            <div className="text-[10px] font-normal text-slate-400">
                              {format(new Date(v.created_at), "MMM dd, yyyy")}
                            </div>
                          )}
                          {v.parent_voucher_id && (
                            <div className="inline-flex items-center gap-0.5 text-[10px] text-indigo-600 font-medium">
                              <Link2 className="w-2.5 h-2.5" /> Linked Share
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <Badge variant="outline" className="text-xs border-sky-300 text-sky-800 bg-sky-50">
                              {v.slip_type}
                            </Badge>
                            {v.is_converted_from_report && (
                              <Badge
                                className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100 border border-indigo-200 text-[10px] px-1.5 py-0"
                                title="Converted from Secretary Commission Report (marked for duplicate traceability)"
                              >
                                Report #{v.source_commission_report_number || "?"}
                              </Badge>
                            )}
                            {v.is_unencoded_sale && (
                              <Badge
                                className="bg-orange-100 text-orange-800 hover:bg-orange-100 border border-orange-200 text-[10px] px-1.5 py-0"
                                title="Generated without an encoded LR sale"
                              >
                                <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                                Unencoded Sale
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-900 max-w-[180px] truncate">
                          {v.developer_name}
                          {v.slip_type !== "VAT without Rate" && (
                            <div className="text-[10px] text-slate-500">Rate: {v.developer_rate}%</div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-[#001f3f]">
                          <div className="flex flex-wrap items-center gap-1">
                            <span>{v.agent_name}</span>
                            {getRoleBadge(v.recipient_role)}
                          </div>
                          <div className="text-[10px] text-slate-500 font-normal">
                            {v.slip_type === "VAT without Rate" ? "No Rate (Less VAT)" : `Rate: ${v.agent_rate}%`}
                            {v.team_name ? ` · ${v.team_name}` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-700">
                          <div>{v.project_name || "-"}</div>
                          {v.unit_number && (
                            <div className="text-[10px] text-slate-500">Unit: {v.unit_number}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-700">
                          <div>{v.client_name || "-"}</div>
                          {v.reservation_date && (
                            <div className="text-[10px] text-slate-500">
                              Res. Date: {v.reservation_date}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium text-slate-700">
                          {formatCurrency(v.amount_released)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-extrabold text-emerald-700">
                          {formatCurrency(v.total_amount)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            {v.generated_pdf_url ? (
                              <a
                                href={formatS3Url(v.generated_pdf_url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0284c7] hover:underline bg-sky-50 px-2 py-0.5 rounded border border-sky-200"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Slip PDF</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">No PDF</span>
                            )}
                            {extraCount > 0 && (
                              <button
                                type="button"
                                onClick={() => setAttachVoucher(v)}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200"
                              >
                                <Paperclip className="w-3 h-3" />
                                +{extraCount} file{extraCount === 1 ? "" : "s"}
                              </button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setViewVoucher(v)}
                              className="h-7 text-xs border-[#001f3f] text-[#001f3f] bg-white"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              View
                            </Button>
                            {!isReadOnly && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setAttachVoucher(v)}
                                  className="h-7 text-xs border-sky-500 text-sky-700 hover:bg-sky-50 bg-white"
                                  title="Attach additional files (retained when merged)"
                                >
                                  <Paperclip className="w-3.5 h-3.5 mr-1" />
                                  Files
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditVoucher(v)
                                    setCreateModalOpen(true)
                                  }}
                                  className="h-7 text-xs border-amber-500 text-amber-700 hover:bg-amber-50 bg-white"
                                >
                                  <Pencil className="w-3.5 h-3.5 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleDelete(v)}
                                  className="h-7 w-7 text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* DataTable Pagination Footer */}
          {!loading && filteredVouchers.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50/70">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span>
                  Showing{" "}
                  <strong className="text-[#001f3f]">
                    {(safePage - 1) * pageSize + 1}
                  </strong>{" "}
                  to{" "}
                  <strong className="text-[#001f3f]">
                    {Math.min(safePage * pageSize, filteredVouchers.length)}
                  </strong>{" "}
                  of <strong className="text-[#001f3f]">{filteredVouchers.length}</strong> vouchers
                </span>

                <div className="flex items-center gap-1.5">
                  <span>Rows per page:</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(val) => setPageSize(Number(val))}
                  >
                    <SelectTrigger className="h-7 w-16 text-xs bg-white border-slate-300 text-[#001f3f]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {[10, 15, 25, 50, 100].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setCurrentPage(1)}
                  disabled={safePage <= 1}
                  className="h-7 w-7 border-slate-300 bg-white text-[#001f3f]"
                  title="First page"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="h-7 w-7 border-slate-300 bg-white text-[#001f3f]"
                  title="Previous page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>

                {pageNumbers.map((pg, idx) =>
                  pg === "..." ? (
                    <span key={`ellipsis-${idx}`} className="px-1.5 text-xs text-slate-400">
                      ...
                    </span>
                  ) : (
                    <Button
                      key={pg}
                      type="button"
                      size="sm"
                      variant={pg === safePage ? "default" : "outline"}
                      onClick={() => setCurrentPage(pg)}
                      className={
                        pg === safePage
                          ? "h-7 min-w-[28px] px-2 text-xs bg-[#001f3f] text-white font-bold"
                          : "h-7 min-w-[28px] px-2 text-xs border-slate-300 bg-white text-[#001f3f] hover:bg-slate-100"
                      }
                    >
                      {pg}
                    </Button>
                  )
                )}

                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="h-7 w-7 border-slate-300 bg-white text-[#001f3f]"
                  title="Next page"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safePage >= totalPages}
                  className="h-7 w-7 border-slate-300 bg-white text-[#001f3f]"
                  title="Last page"
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Voucher Modal (Accounting Only) */}
      {!isReadOnly && (
        <CreateCommissionVoucherModal
          open={createModalOpen}
          onOpenChange={(o) => {
            setCreateModalOpen(o)
            if (!o) setEditVoucher(null)
          }}
          onVoucherSaved={fetchVouchers}
          editVoucher={editVoucher}
        />
      )}

      {/* Hidden Extra Attachments File Input */}
      <input
        ref={extraFilesInputRef}
        type="file"
        multiple
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => handleUploadExtraAttachments(e.target.files)}
      />

      {/* Manage Additional Attachments Modal */}
      <Dialog open={Boolean(attachVoucher)} onOpenChange={(o) => !o && setAttachVoucher(null)}>
        <DialogContent className="max-w-lg bg-white text-[#001f3f]">
          {attachVoucher && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-[#001f3f] flex items-center gap-2">
                  <Paperclip className="w-5 h-5 text-sky-600" />
                  Voucher #{attachVoucher.voucher_number} — Additional Attachments
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-xs text-slate-600">
                  Any PDF or image files attached here are automatically retained and appended when
                  this voucher is merged into a Commission Release PDF.
                </p>

                {!isReadOnly && (
                  <Button
                    type="button"
                    onClick={() => extraFilesInputRef.current?.click()}
                    disabled={uploadingAttachments}
                    className="w-full bg-[#001f3f] hover:bg-[#001f3f]/90 text-white"
                  >
                    {uploadingAttachments ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading to S3...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Add Files / Images / PDFs
                      </>
                    )}
                  </Button>
                )}

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {!attachVoucher.attachments || attachVoucher.attachments.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400 border border-dashed rounded-lg">
                      No additional attachments yet.
                    </div>
                  ) : (
                    attachVoucher.attachments.map((url, idx) => (
                      <div
                        key={`${url}-${idx}`}
                        className="flex items-center justify-between gap-2 rounded-lg border bg-slate-50 px-3 py-2 text-xs"
                      >
                        <a
                          href={formatS3Url(url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-sky-700 hover:underline truncate"
                        >
                          <FileText className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">Attachment #{idx + 1}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => handleRemoveExtraAttachment(url)}
                            className="text-red-500 hover:text-red-700"
                            title="Remove attachment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Merge Selected Vouchers into Release Modal */}
      {!isReadOnly && (
        <Dialog open={mergeModalOpen} onOpenChange={(o) => !merging && setMergeModalOpen(o)}>
          <DialogContent className="max-w-lg bg-white text-[#001f3f]">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#001f3f] flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-600" />
                Merge Vouchers into Release
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                <div className="font-semibold text-slate-700">
                  Selected Vouchers ({selectedVouchers.length}):{" "}
                  <span className="text-[#001f3f]">
                    {selectedVouchers.map((v) => `#${v.voucher_number}`).join(", ")}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 pt-1">
                  <span>
                    Total Gross Comm.: <strong className="text-[#001f3f]">{formatCurrency(selectedTotals.gross)}</strong>
                  </span>
                  <span>
                    Total Net Comm.: <strong className="text-emerald-700">{formatCurrency(selectedTotals.net)}</strong>
                  </span>
                </div>
                {selectedTotals.extraAttachmentsCount > 0 && (
                  <div className="text-amber-700 pt-1">
                    Includes <strong>{selectedTotals.extraAttachmentsCount}</strong> extra voucher
                    attachment(s) in the merged PDF.
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#001f3f]">Release Title *</Label>
                <Input
                  value={releaseTitle}
                  onChange={(e) => setReleaseTitle(e.target.value)}
                  placeholder="e.g. FHVIP RELEASE 11.7.24"
                  className="bg-white text-[#001f3f] border-slate-300"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#001f3f]">Remarks (Optional)</Label>
                <Textarea
                  value={releaseRemarks}
                  onChange={(e) => setReleaseRemarks(e.target.value)}
                  placeholder="Enter release notes or remarks..."
                  rows={3}
                  className="bg-white text-[#001f3f] border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMergeModalOpen(false)}
                  disabled={merging}
                  className="border-slate-300 text-slate-700 bg-white"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleMergeIntoRelease}
                  disabled={merging}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  <Layers className="w-4 h-4 mr-1.5" />
                  {merging ? "Merging PDFs & Saving..." : "Merge & Save Release"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* View Voucher Bondpaper Modal */}
      <Dialog open={Boolean(viewVoucher)} onOpenChange={(o) => !o && setViewVoucher(null)}>
        <DialogContent className="max-w-4xl max-h-[94vh] overflow-y-auto bg-white text-[#001f3f]">
          {viewVoucher && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <DialogTitle className="text-xl font-bold text-[#001f3f]">
                    Commission Voucher #{viewVoucher.voucher_number}
                  </DialogTitle>
                  <Button
                    size="sm"
                    onClick={() => handleDownloadBondpaperPdf(viewVoucher)}
                    disabled={downloadingPdf}
                    className="bg-[#001f3f] hover:bg-[#001f3f]/90 text-white"
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    {downloadingPdf ? "Generating PDF..." : "Open / Download Bondpaper PDF"}
                  </Button>
                </div>
              </DialogHeader>

              <div className="bg-slate-200 p-4 rounded-xl overflow-x-auto border border-slate-300">
                <VoucherBondpaperDocument
                  voucher={viewVoucher}
                  containerId={`view-voucher-doc-${viewVoucher.id}`}
                />
              </div>

              {viewVoucher.attachments && viewVoucher.attachments.length > 0 && (
                <div className="rounded-lg border p-3 bg-slate-50 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-bold uppercase text-slate-600">
                      Additional Attachments ({viewVoucher.attachments.length})
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        downloadAttachmentsAsZip(
                          (viewVoucher.attachments || []).map((url, idx) => ({
                            url,
                            name: `Voucher_${viewVoucher.voucher_number}_Attachment_${idx + 1}_${decodeURIComponent(
                              url.split("?")[0].split("/").pop() || "file"
                            )}`,
                          })),
                          `Voucher_${viewVoucher.voucher_number}_attachments`
                        ).catch((err) => alert("Error downloading attachments: " + (err?.message || "Failed")))
                      }
                      className="h-7 text-xs border-[#001f3f] text-[#001f3f] bg-white hover:bg-slate-100 font-semibold"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Download All ({viewVoucher.attachments.length})
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {viewVoucher.attachments.map((url, idx) => (
                      <a
                        key={`${url}-${idx}`}
                        href={formatS3Url(url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 bg-white border border-sky-200 px-2.5 py-1 rounded hover:bg-sky-50"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        Attachment #{idx + 1}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* For Printing Preview Modal (Merged Vouchers Only — No Attachments) */}
      {!isReadOnly && (
        <Dialog open={printPreviewOpen} onOpenChange={setPrintPreviewOpen}>
          <DialogContent className="max-w-5xl max-h-[94vh] flex flex-col bg-white text-[#001f3f]">
            <DialogHeader className="shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
                <div>
                  <DialogTitle className="text-xl font-bold text-[#001f3f] flex items-center gap-2">
                    <Printer className="w-5 h-5 text-amber-600" />
                    For Printing — Commission Voucher Preview
                  </DialogTitle>
                  <p className="text-xs text-slate-600 mt-1">
                    Previewing <strong>{selectedVouchers.length}</strong> selected commission voucher
                    {selectedVouchers.length === 1 ? "" : "s"} merged into a single printable document
                    (1 voucher per A4 page). <strong>Extra attachments are excluded.</strong>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPrintPreviewOpen(false)}
                    disabled={printingVouchers}
                    className="border-slate-300 text-slate-700 bg-white"
                  >
                    Close
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleTriggerBrowserPrint}
                    disabled={printingVouchers || selectedVouchers.length === 0}
                    className="bg-[#001f3f] hover:bg-[#001f3f]/90 text-white font-bold shadow"
                  >
                    {printingVouchers ? (
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    ) : (
                      <Printer className="w-4 h-4 mr-1.5" />
                    )}
                    {printingVouchers
                      ? "Preparing Print..."
                      : `Print ${selectedVouchers.length > 1 ? `All (${selectedVouchers.length})` : "Voucher"}`}
                  </Button>
                </div>
              </div>
            </DialogHeader>

            <div
              ref={printPreviewContainerRef}
              className="flex-1 overflow-y-auto bg-slate-200 p-4 rounded-xl border border-slate-300 space-y-6"
            >
              {selectedVouchers.map((v, idx) => (
                <div key={v.id || `${v.voucher_number}-${idx}`} className="space-y-2">
                  <div className="flex items-center justify-between px-2 text-xs text-slate-700">
                    <span className="font-bold text-[#001f3f]">
                      Page {idx + 1} of {selectedVouchers.length} &bull; Voucher #{v.voucher_number}
                    </span>
                    <span className="text-slate-600">
                      {v.agent_name} &bull; Net: <strong>{formatCurrency(Number(v.total_amount) || 0)}</strong>
                    </span>
                  </div>
                  <div
                    data-voucher-print-page="true"
                    className="flex justify-center overflow-x-auto"
                  >
                    <VoucherBondpaperDocument
                      voucher={v}
                      containerId={`print-preview-voucher-${v.id || idx}`}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 text-xs text-slate-600">
              <span>
                Total Gross: <strong className="text-[#001f3f]">{formatCurrency(selectedTotals.gross)}</strong>{" "}
                &bull; Total Net:{" "}
                <strong className="text-emerald-700">{formatCurrency(selectedTotals.net)}</strong>
              </span>
              <Button
                type="button"
                size="sm"
                onClick={handleTriggerBrowserPrint}
                disabled={printingVouchers || selectedVouchers.length === 0}
                className="bg-[#001f3f] hover:bg-[#001f3f]/90 text-white font-bold"
              >
                {printingVouchers ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Printer className="w-4 h-4 mr-1.5" />
                )}
                {printingVouchers
                  ? "Preparing Print..."
                  : `Print ${selectedVouchers.length > 1 ? `All (${selectedVouchers.length})` : "Voucher"}`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Offscreen Bondpaper Render Target for Batch PDF Regeneration */}
      {offscreenVoucher && (
        <div style={{ position: "fixed", left: "-10000px", top: 0, width: "794px", background: "#fff" }}>
          <VoucherBondpaperDocument
            voucher={offscreenVoucher}
            containerId="regenerate-voucher-bondpaper-hidden"
          />
        </div>
      )}
    </div>
  )
}
