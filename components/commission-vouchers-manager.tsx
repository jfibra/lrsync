"use client"

import React, { useState, useEffect, useMemo } from "react"
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
} from "lucide-react"
import { format } from "date-fns"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase/client"
import { logNotification } from "@/utils/logNotification"
import { formatS3Url } from "@/utils/s3-url"
import { CreateCommissionVoucherModal } from "@/components/create-commission-voucher-modal"
import {
  VoucherBondpaperDocument,
  downloadVoucherBondpaperPdf,
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

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editVoucher, setEditVoucher] = useState<CommissionVoucherData | null>(null)
  const [viewVoucher, setViewVoucher] = useState<CommissionVoucherData | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  // Multi-select & Merge into Releases state
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [releaseTitle, setReleaseTitle] = useState("")
  const [releaseRemarks, setReleaseRemarks] = useState("")
  const [merging, setMerging] = useState(false)

  const roleSlug = role === "super_admin" ? "super-admin" : "secretary"

  const fetchVouchers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("commission_vouchers")
        .select("*")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })

      if (!error && data) {
        let rows = data as CommissionVoucherData[]
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

  const filteredVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      if (filterSlipType !== "all" && v.slip_type !== filterSlipType) return false
      if (searchTerm.trim() !== "") {
        const q = searchTerm.toLowerCase()
        const m1 = (v.voucher_number || "").toLowerCase().includes(q)
        const m2 = (v.agent_name || "").toLowerCase().includes(q)
        const m3 = (v.developer_name || "").toLowerCase().includes(q)
        const m4 = (v.client_name || "").toLowerCase().includes(q)
        const m5 = (v.project_name || "").toLowerCase().includes(q)
        if (!m1 && !m2 && !m3 && !m4 && !m5) return false
      }
      return true
    })
  }, [vouchers, filterSlipType, searchTerm])

  const stats = useMemo(() => {
    const totalReleased = vouchers.reduce((s, v) => s + (Number(v.amount_released) || 0), 0)
    const totalNet = vouchers.reduce((s, v) => s + (Number(v.total_amount) || 0), 0)
    const totalTax = vouchers.reduce((s, v) => s + (Number(v.withholding_tax) || 0), 0)
    return {
      count: vouchers.length,
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

  const handleDelete = async (voucher: CommissionVoucherData) => {
    if (!voucher.id) return
    if (!confirm(`Are you sure you want to delete Voucher #${voucher.voucher_number}?`)) return
    try {
      const { error } = await supabase
        .from("commission_vouchers")
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq("id", voucher.id)
      if (error) throw error
      setSelectedIds((prev) => prev.filter((id) => id !== voucher.id))
      fetchVouchers()
    } catch (err: any) {
      alert("Error deleting voucher: " + (err?.message || "Failed"))
    }
  }

  const selectedVouchers = useMemo(
    () => vouchers.filter((v) => v.id && selectedIds.includes(v.id)),
    [vouchers, selectedIds]
  )

  const selectedTotals = useMemo(() => {
    const gross = selectedVouchers.reduce((s, v) => s + (Number(v.amount_released) || 0), 0)
    const net = selectedVouchers.reduce((s, v) => s + (Number(v.total_amount) || 0), 0)
    return { gross, net }
  }, [selectedVouchers])

  const toggleSelect = (id?: string) => {
    if (!id) return
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const allVisibleIds = useMemo(
    () => filteredVouchers.map((v) => v.id).filter((id): id is string => Boolean(id)),
    [filteredVouchers]
  )

  const allVisibleSelected =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.includes(id))

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !allVisibleIds.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...allVisibleIds])))
    }
  }

  const openMergeModal = () => {
    if (selectedVouchers.length === 0) return
    setReleaseTitle("")
    setReleaseRemarks("")
    setMergeModalOpen(true)
  }

  const handleMergeIntoRelease = async () => {
    if (!releaseTitle.trim()) {
      alert("Please enter a Release Title.")
      return
    }
    if (selectedVouchers.length === 0) return

    setMerging(true)
    try {
      const pdfUrls = selectedVouchers
        .map((v) => (v.generated_pdf_url ? formatS3Url(v.generated_pdf_url) : ""))
        .filter(Boolean)

      let combinedPdfUrl: string | null = null

      if (pdfUrls.length > 0) {
        const mergeRes = await fetch("/api/merge-release-pdfs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pdfUrls }),
        })

        if (!mergeRes.ok) {
          const errJson = await mergeRes.json().catch(() => ({}))
          throw new Error(errJson?.error || "Failed to combine voucher PDFs.")
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
          description: `Commission Release "${releaseTitle.trim()}" created from ${selectedVouchers.length} voucher(s)`,
          ip_address: null,
          location: null,
          meta: JSON.stringify({
            title: releaseTitle.trim(),
            voucherNumbers,
            totalGrossComm: selectedTotals.gross,
            totalNetComm: selectedTotals.net,
          }),
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
          user_email: profile.email,
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-[#001f3f] to-[#0284c7] p-3 rounded-xl text-white shadow">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#001f3f]">
              Commission Vouchers
            </h1>
            <p className="text-sm text-slate-600">
              Generate Commission Slip Vouchers with cropped Voucher &amp; Header attachments into a single bondpaper PDF.
            </p>
          </div>
        </div>

        <Button
          onClick={() => setCreateModalOpen(true)}
          className="bg-[#001f3f] hover:bg-[#001f3f]/90 text-white font-semibold shadow"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Voucher
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Total Vouchers</p>
            <p className="text-2xl font-extrabold text-[#001f3f] mt-1">{stats.count}</p>
          </CardContent>
        </Card>
        <Card className="bg-sky-50/70 border-sky-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase text-sky-800">Total Released (Dev)</p>
            <p className="text-2xl font-extrabold text-sky-900 mt-1">
              {formatCurrency(stats.totalReleased)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50/70 border-emerald-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase text-emerald-800">Total for Release</p>
            <p className="text-2xl font-extrabold text-emerald-900 mt-1">
              {formatCurrency(stats.totalNet)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50/70 border-amber-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase text-amber-800">Total BIR 2307 / EWT</p>
            <p className="text-2xl font-extrabold text-amber-900 mt-1">
              {formatCurrency(stats.totalTax)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search voucher #, agent, developer, client, or project..."
              className="pl-9 bg-white text-[#001f3f] border-slate-300"
            />
          </div>
          <Select value={filterSlipType} onValueChange={setFilterSlipType}>
            <SelectTrigger className="w-full sm:w-56 bg-white text-[#001f3f] border-slate-300">
              <SelectValue placeholder="All Slip Types" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">All Slip Types</SelectItem>
              <SelectItem value="Non-VAT">Non-VAT</SelectItem>
              <SelectItem value="VAT w/ Invoice">VAT w/ Invoice</SelectItem>
              <SelectItem value="VAT w/o Invoice">VAT w/o Invoice</SelectItem>
              <SelectItem value="W/o Invoice">W/o Invoice</SelectItem>
              <SelectItem value="Rate w/o Invoice">Rate w/o Invoice</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Selection Action Bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#001f3f] text-white px-4 py-3 rounded-xl shadow-md">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-sky-500 text-white border-0 font-bold px-2.5 py-1">
              {selectedIds.length} Selected
            </Badge>
            <span className="text-xs sm:text-sm text-slate-200">
              Total Gross: <strong className="text-white">{formatCurrency(selectedTotals.gross)}</strong> &bull;{" "}
              Total Net: <strong className="text-emerald-300">{formatCurrency(selectedTotals.net)}</strong>
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
              onClick={openMergeModal}
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
            <CardTitle className="text-lg font-bold text-[#001f3f]">Saved Commission Vouchers</CardTitle>
            <CardDescription>
              Highlight/check vouchers to merge them into a Release, or view/edit individual vouchers.
            </CardDescription>
          </div>
          <Link href={`/dashboard/${roleSlug}/releases`}>
            <Button variant="outline" size="sm" className="border-[#001f3f] text-[#001f3f] bg-white">
              <Layers className="w-4 h-4 mr-1.5" />
              Go to Commission Releases
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#001f3f] hover:bg-[#001f3f]">
                  <TableHead className="w-10 text-center">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all visible vouchers"
                      className="border-white data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                    />
                  </TableHead>
                  <TableHead className="text-white font-semibold">Voucher #</TableHead>
                  <TableHead className="text-white font-semibold">Slip Type</TableHead>
                  <TableHead className="text-white font-semibold">Developer</TableHead>
                  <TableHead className="text-white font-semibold">Agent / Salesperson</TableHead>
                  <TableHead className="text-white font-semibold">Project &amp; Unit</TableHead>
                  <TableHead className="text-white font-semibold">Client</TableHead>
                  <TableHead className="text-white font-semibold text-right">Released</TableHead>
                  <TableHead className="text-white font-semibold text-right">Total Release</TableHead>
                  <TableHead className="text-white font-semibold">PDF Attachment</TableHead>
                  <TableHead className="text-white font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-12 text-slate-500">
                      Loading commission vouchers...
                    </TableCell>
                  </TableRow>
                ) : filteredVouchers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-12 text-slate-500">
                      No commission vouchers found. Click &ldquo;Create Voucher&rdquo; to generate one.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVouchers.map((v) => {
                    const isSelected = Boolean(v.id && selectedIds.includes(v.id))
                    return (
                    <TableRow
                      key={v.id}
                      className={isSelected ? "bg-sky-50/90 hover:bg-sky-100/70" : "hover:bg-slate-50"}
                    >
                      <TableCell className="text-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(v.id)}
                          aria-label={`Select Voucher #${v.voucher_number}`}
                        />
                      </TableCell>
                      <TableCell className="font-extrabold text-[#001f3f]">
                        #{v.voucher_number}
                        {v.created_at && (
                          <div className="text-[10px] font-normal text-slate-400">
                            {format(new Date(v.created_at), "MMM dd, yyyy")}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs border-sky-300 text-sky-800 bg-sky-50">
                          {v.slip_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-900 max-w-[180px] truncate">
                        {v.developer_name}
                        <div className="text-[10px] text-slate-500">Rate: {v.developer_rate}%</div>
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-[#001f3f]">
                        {v.agent_name}
                        <div className="text-[10px] text-slate-500 font-normal">
                          Rate: {v.agent_rate}%
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
                        {v.generated_pdf_url ? (
                          <a
                            href={formatS3Url(v.generated_pdf_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#0284c7] hover:underline bg-sky-50 px-2.5 py-1 rounded border border-sky-200"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Voucher PDF</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">No PDF</span>
                        )}
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
                        </div>
                      </TableCell>
                    </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit Voucher Modal */}
      <CreateCommissionVoucherModal
        open={createModalOpen}
        onOpenChange={(o) => {
          setCreateModalOpen(o)
          if (!o) setEditVoucher(null)
        }}
        onVoucherSaved={fetchVouchers}
        editVoucher={editVoucher}
      />

      {/* Merge Selected Vouchers into Release Modal */}
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
                <span>Total Gross Comm.: <strong className="text-[#001f3f]">{formatCurrency(selectedTotals.gross)}</strong></span>
                <span>Total Net Comm.: <strong className="text-emerald-700">{formatCurrency(selectedTotals.net)}</strong></span>
              </div>
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
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
