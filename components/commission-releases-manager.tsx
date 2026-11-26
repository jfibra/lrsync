"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Search,
  ExternalLink,
  Plus,
  Trash2,
  Eye,
  Layers,
  Receipt,
  FileText,
  Download,
  RotateCcw,
} from "lucide-react"
import { format } from "date-fns"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase/client"
import { formatS3Url } from "@/utils/s3-url"
import { downloadAttachmentsAsZip } from "@/utils/download-attachments"
import { logNotification } from "@/utils/logNotification"
import { YearSelect, MonthMultiSelect } from "@/components/date-period-filter"
import { DataTablePagination } from "@/components/data-table-pagination"

export interface PotFileItem {
  id: string
  url: string
  filename: string
  admin_name: string
  admin_uuid?: string | null
  uploaded_at: string
}

export interface CommissionReleaseRecord {
  id: string
  title: string
  remarks?: string | null
  voucher_ids: string[]
  voucher_numbers: string[]
  total_gross_comm: number
  total_net_comm: number
  combined_pdf_url?: string | null
  pot_files: PotFileItem[]
  created_by_uuid?: string | null
  created_by_name?: string | null
  created_by_email?: string | null
  assigned_area?: string | null
  created_at?: string
}

interface CommissionReleasesManagerProps {
  role: "super_admin" | "secretary"
}

export function CommissionReleasesManager({ role }: CommissionReleasesManagerProps) {
  const { profile } = useAuth()
  const [releases, setReleases] = useState<CommissionReleaseRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterPotStatus, setFilterPotStatus] = useState("all")
  const [filterArea, setFilterArea] = useState("all")
  const [filterYear, setFilterYear] = useState("all")
  const [filterMonths, setFilterMonths] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [selectedRelease, setSelectedRelease] = useState<CommissionReleaseRecord | null>(null)
  const [uploadingPot, setUploadingPot] = useState(false)
  const potInputRef = useRef<HTMLInputElement | null>(null)

  const roleSlug = role === "super_admin" ? "super-admin" : "secretary"
  const isReadOnly = role === "secretary"

  const fetchReleases = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("commission_releases")
        .select("*")
        .order("created_at", { ascending: false })

      if (!error && data) {
        let rows = (data as any[]).map((r) => ({
          ...r,
          pot_files: Array.isArray(r.pot_files) ? r.pot_files : [],
          voucher_ids: Array.isArray(r.voucher_ids) ? r.voucher_ids : [],
          voucher_numbers: Array.isArray(r.voucher_numbers) ? r.voucher_numbers : [],
        })) as CommissionReleaseRecord[]

        if (role === "secretary" && profile?.assigned_area) {
          const areaLower = profile.assigned_area.toLowerCase()
          rows = rows.filter(
            (r) =>
              (r.assigned_area || "").toLowerCase() === areaLower ||
              r.created_by_uuid === profile.auth_user_id ||
              r.created_by_uuid === profile.id
          )
        }
        setReleases(rows)

        if (selectedRelease) {
          const updated = rows.find((r) => r.id === selectedRelease.id)
          if (updated) setSelectedRelease(updated)
        }
      }
    } catch (err) {
      console.error("Error fetching commission releases:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReleases()
  }, [profile?.assigned_area, profile?.id])

  const availableAreas = useMemo(() => {
    const set = new Set<string>()
    releases.forEach((r) => {
      if (r.assigned_area?.trim()) set.add(r.assigned_area.trim())
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [releases])

  const activeFilterCount = useMemo(() => {
    let c = 0
    if (searchTerm.trim()) c++
    if (filterPotStatus !== "all") c++
    if (filterArea !== "all") c++
    if (filterYear !== "all") c++
    if (filterMonths.length > 0 && filterMonths.length < 12) c++
    return c
  }, [searchTerm, filterPotStatus, filterArea, filterYear, filterMonths])

  const resetFilters = () => {
    setSearchTerm("")
    setFilterPotStatus("all")
    setFilterArea("all")
    setFilterYear("all")
    setFilterMonths([])
    setCurrentPage(1)
  }

  const filteredReleases = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return releases.filter((r) => {
      if (filterPotStatus === "has_pot" && (!r.pot_files || r.pot_files.length === 0)) return false
      if (filterPotStatus === "no_pot" && r.pot_files && r.pot_files.length > 0) return false
      if (filterPotStatus === "has_pdf" && !r.combined_pdf_url) return false
      if (filterArea !== "all" && (r.assigned_area || "").trim() !== filterArea) return false

      if (filterYear !== "all" || (filterMonths.length > 0 && filterMonths.length < 12)) {
        if (!r.created_at) return false
        const dt = new Date(r.created_at)
        if (Number.isNaN(dt.getTime())) return false
        const yr = String(dt.getFullYear())
        const mo = String(dt.getMonth() + 1).padStart(2, "0")
        if (filterYear !== "all" && yr !== filterYear) return false
        if (filterMonths.length > 0 && filterMonths.length < 12 && !filterMonths.includes(mo)) return false
      }

      if (q) {
        const m1 = (r.title || "").toLowerCase().includes(q)
        const m2 = (r.remarks || "").toLowerCase().includes(q)
        const m3 = (r.voucher_numbers || []).some((vn) => vn.toLowerCase().includes(q))
        const m4 = (r.created_by_name || "").toLowerCase().includes(q)
        if (!m1 && !m2 && !m3 && !m4) return false
      }
      return true
    })
  }, [releases, searchTerm, filterPotStatus, filterArea, filterYear, filterMonths])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterPotStatus, filterArea, filterYear, filterMonths, pageSize])

  const paginatedReleases = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(filteredReleases.length / pageSize))
    const safePage = Math.min(currentPage, totalPages)
    const start = (safePage - 1) * pageSize
    return filteredReleases.slice(start, start + pageSize)
  }, [filteredReleases, currentPage, pageSize])

  const stats = useMemo(() => {
    const totalGross = releases.reduce((s, r) => s + (Number(r.total_gross_comm) || 0), 0)
    const totalNet = releases.reduce((s, r) => s + (Number(r.total_net_comm) || 0), 0)
    const totalPots = releases.reduce((s, r) => s + (r.pot_files?.length || 0), 0)
    return {
      count: releases.length,
      totalGross,
      totalNet,
      totalPots,
    }
  }, [releases])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(Number(val) || 0)

  const handleAddPotFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !selectedRelease) return
    setUploadingPot(true)
    try {
      const adminName = profile?.full_name || profile?.first_name || profile?.email || "Accounting"
      const uploadedItems: PotFileItem[] = []

      for (const file of Array.from(files)) {
        const presignedRes = await fetch("/api/get-s3-upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type || "application/octet-stream",
            category: "release",
            reportNumber: selectedRelease.title,
            tinName: adminName,
            assignedArea: profile?.assigned_area || "Cebu",
            userFullName: adminName,
          }),
        })

        if (!presignedRes.ok) {
          throw new Error(`Failed to authorize upload for ${file.name}`)
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

        const formattedUrl = formatS3Url(publicUrl)
        uploadedItems.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          url: formattedUrl,
          filename: formattedUrl,
          admin_name: adminName,
          admin_uuid: profile?.auth_user_id || profile?.id || null,
          uploaded_at: new Date().toISOString(),
        })
      }

      const nextPotFiles = [...(selectedRelease.pot_files || []), ...uploadedItems]
      const { error } = await supabase
        .from("commission_releases")
        .update({
          pot_files: nextPotFiles,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedRelease.id)

      if (error) throw error

      if (profile?.id) {
        await logNotification(supabase, {
          action: "commission_release_pot_added",
          description: `Added ${uploadedItems.length} Proof of Transaction file(s) to Release "${selectedRelease.title}"`,
          ip_address: null,
          location: null,
          meta: JSON.stringify({ releaseId: selectedRelease.id, title: selectedRelease.title }),
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
          user_email: profile.email,
          user_name: adminName,
          user_uuid: profile.id,
        })
      }

      setSelectedRelease({ ...selectedRelease, pot_files: nextPotFiles })
      fetchReleases()
    } catch (err: any) {
      console.error("Error uploading POT:", err)
      alert("Error uploading Proof of Transaction: " + (err?.message || "Please try again."))
    } finally {
      setUploadingPot(false)
      if (potInputRef.current) potInputRef.current.value = ""
    }
  }

  const handleDeletePotFile = async (potId: string) => {
    if (!selectedRelease) return
    if (!confirm("Remove this Proof of Transaction file?")) return
    try {
      const nextPotFiles = (selectedRelease.pot_files || []).filter((p) => p.id !== potId)
      const { error } = await supabase
        .from("commission_releases")
        .update({
          pot_files: nextPotFiles,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedRelease.id)

      if (error) throw error

      if (profile?.id) {
        await logNotification(supabase, {
          action: "commission_release_pot_deleted",
          description: `Removed a Proof of Transaction file from Release "${selectedRelease.title}"`,
          ip_address: null,
          location: null,
          meta: JSON.stringify({ releaseId: selectedRelease.id, title: selectedRelease.title, potId }),
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
          user_email: profile.email || "",
          user_name: profile.full_name || profile.email || profile.id,
          user_uuid: profile.id,
        })
      }

      setSelectedRelease({ ...selectedRelease, pot_files: nextPotFiles })
      fetchReleases()
    } catch (err: any) {
      alert("Error removing POT file: " + (err?.message || "Failed"))
    }
  }

  const handleDeleteRelease = async (release: CommissionReleaseRecord, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Delete Release "${release.title}"?`)) return
    try {
      const { error } = await supabase
        .from("commission_releases")
        .delete()
        .eq("id", release.id)
      if (error) throw error
      if (profile?.id) {
        await logNotification(supabase, {
          action: "commission_release_deleted",
          description: `Deleted Commission Release "${release.title}" (${release.voucher_numbers?.length || 0} voucher(s))`,
          ip_address: null,
          location: null,
          meta: JSON.stringify({
            releaseId: release.id,
            title: release.title,
            voucherNumbers: release.voucher_numbers || [],
            totalNetComm: release.total_net_comm,
          }),
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
          user_email: profile.email || "",
          user_name: profile.full_name || profile.email || profile.id,
          user_uuid: profile.id,
        })
      }
      if (selectedRelease?.id === release.id) setSelectedRelease(null)
      fetchReleases()
    } catch (err: any) {
      alert("Error deleting release: " + (err?.message || "Failed"))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#001f3f] text-white flex items-center justify-center shadow-sm">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-[#001f3f] tracking-tight">
                Commission Releases
              </h1>
              {isReadOnly && (
                <Badge variant="outline" className="border-indigo-300 bg-indigo-50 text-indigo-700 text-xs">
                  View Only
                </Badge>
              )}
            </div>
            <p className="text-sm text-slate-600">
              Grouped commission voucher releases with combined PDFs and Proof of Transactions (POT).
            </p>
          </div>
        </div>

        <Link href={`/dashboard/${roleSlug}/vouchers`}>
          <Button className="bg-[#001f3f] hover:bg-[#001f3f]/90 text-white font-semibold shadow-sm">
            <Receipt className="w-4 h-4 mr-2" />
            {isReadOnly ? "View Commission Vouchers" : "Select Vouchers to Merge"}
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Releases</p>
            <p className="text-2xl font-extrabold text-[#001f3f] mt-1">{stats.count}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Gross Comm.</p>
            <p className="text-2xl font-extrabold text-sky-700 mt-1">
              {formatCurrency(stats.totalGross)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Net Comm.</p>
            <p className="text-2xl font-extrabold text-emerald-700 mt-1">
              {formatCurrency(stats.totalNet)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total POT Files</p>
            <p className="text-2xl font-extrabold text-amber-700 mt-1">{stats.totalPots}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search release title, remarks, voucher #, or admin..."
                className="pl-9 bg-white text-[#001f3f] border-slate-300"
              />
            </div>
            <Select value={filterPotStatus} onValueChange={setFilterPotStatus}>
              <SelectTrigger className="w-full md:w-48 bg-white text-[#001f3f] border-slate-300">
                <SelectValue placeholder="POT / PDF Status" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All POT &amp; PDF Status</SelectItem>
                <SelectItem value="has_pot">Has POT Files</SelectItem>
                <SelectItem value="no_pot">Missing POT Files</SelectItem>
                <SelectItem value="has_pdf">Has Combined PDF</SelectItem>
              </SelectContent>
            </Select>
            {role === "super_admin" && availableAreas.length > 0 && (
              <Select value={filterArea} onValueChange={setFilterArea}>
                <SelectTrigger className="w-full md:w-40 bg-white text-[#001f3f] border-slate-300">
                  <SelectValue placeholder="All Areas" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">All Areas</SelectItem>
                  {availableAreas.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="w-full md:w-36">
              <YearSelect value={filterYear} onValueChange={setFilterYear} />
            </div>
            <div className="w-full md:w-44">
              <MonthMultiSelect
                selectedMonths={filterMonths}
                onMonthsChange={setFilterMonths}
                selectedYear={filterYear}
              />
            </div>
            {activeFilterCount > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={resetFilters}
                className="border-red-200 text-red-700 hover:bg-red-50 bg-white shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Reset ({activeFilterCount})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Releases DataTable */}
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-lg font-bold text-[#001f3f]">Commission Releases</CardTitle>
          <CardDescription>
            Click any release row to view its combined PDF, gross/net totals, and Proof of Transactions (POT).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#001f3f] hover:bg-[#001f3f]">
                  <TableHead className="text-white font-semibold">Release Title</TableHead>
                  <TableHead className="text-white font-semibold">Vouchers Included</TableHead>
                  <TableHead className="text-white font-semibold text-right">Total Gross Comm.</TableHead>
                  <TableHead className="text-white font-semibold text-right">Total Net Comm.</TableHead>
                  <TableHead className="text-white font-semibold text-center">POT Files</TableHead>
                  <TableHead className="text-white font-semibold">Combined PDF</TableHead>
                  <TableHead className="text-white font-semibold">Created</TableHead>
                  <TableHead className="text-white font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                      Loading commission releases...
                    </TableCell>
                  </TableRow>
                ) : paginatedReleases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                      No commission releases found. Highlight vouchers on the Vouchers page and click &ldquo;Merge into Release&rdquo;.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedReleases.map((r) => (
                    <TableRow
                      key={r.id}
                      onClick={() => setSelectedRelease(r)}
                      className="hover:bg-slate-50 cursor-pointer"
                    >
                      <TableCell className="font-bold text-[#001f3f]">
                        <div>{r.title}</div>
                        {r.remarks && (
                          <div className="text-xs font-normal text-slate-500 truncate max-w-[240px]">
                            {r.remarks}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {(r.voucher_numbers || []).map((vn, idx) => (
                            <Badge
                              key={`${vn}-${idx}`}
                              variant="outline"
                              className="text-[11px] border-sky-300 text-sky-800 bg-sky-50"
                            >
                              #{vn}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-[#001f3f]">
                        {formatCurrency(r.total_gross_comm)}
                      </TableCell>
                      <TableCell className="text-right font-extrabold text-emerald-700">
                        {formatCurrency(r.total_net_comm)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs border-slate-300 text-slate-700">
                          {r.pot_files?.length || 0} file(s)
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {r.combined_pdf_url ? (
                          <a
                            href={formatS3Url(r.combined_pdf_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#0284c7] hover:underline bg-sky-50 px-2.5 py-1 rounded border border-sky-200"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>View PDF</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">No PDF</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {r.created_at ? format(new Date(r.created_at), "MMM dd, yyyy") : "-"}
                        {r.created_by_name && (
                          <div className="text-[10px] text-slate-400">{r.created_by_name}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedRelease(r)}
                            className="h-7 text-xs border-[#001f3f] text-[#001f3f] bg-white"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Open
                          </Button>
                          {!isReadOnly && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => handleDeleteRelease(r, e)}
                              className="h-7 w-7 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {!loading && (
            <DataTablePagination
              totalItems={filteredReleases.length}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              itemLabel="releases"
            />
          )}
        </CardContent>
      </Card>

      {/* Hidden POT File Input */}
      <input
        ref={potInputRef}
        type="file"
        multiple
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => handleAddPotFiles(e.target.files)}
      />

      {/* Release Details Modal (matching screenshot layout) */}
      <Dialog open={Boolean(selectedRelease)} onOpenChange={(o) => !o && setSelectedRelease(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto bg-white text-[#0f172a]">
          {selectedRelease && (
            <div className="space-y-5">
              <DialogHeader className="sr-only">
                <DialogTitle>{selectedRelease.title}</DialogTitle>
              </DialogHeader>

              {/* Top Action Bar: VIEW PDF | + ADD POT */}
              <div className="flex flex-wrap items-center">
                <div className="inline-flex rounded border border-red-200 overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedRelease.combined_pdf_url) {
                        window.open(formatS3Url(selectedRelease.combined_pdf_url), "_blank")
                      } else {
                        alert("No combined PDF attached to this release.")
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold tracking-wide text-red-600 hover:bg-red-50 ${!isReadOnly ? "border-r border-red-200" : ""} transition-colors`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    VIEW PDF
                  </button>
                  {!isReadOnly && (
                    <button
                      type="button"
                      disabled={uploadingPot}
                      onClick={() => potInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold tracking-wide text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {uploadingPot ? "UPLOADING..." : "ADD POT"}
                    </button>
                  )}
                </div>
                {(selectedRelease.combined_pdf_url || (selectedRelease.pot_files?.length || 0) > 0) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const files = [
                        ...(selectedRelease.combined_pdf_url
                          ? [{ url: selectedRelease.combined_pdf_url, name: `${selectedRelease.title || "Release"}_Combined.pdf` }]
                          : []),
                        ...(selectedRelease.pot_files || []).map((pf, idx) => ({
                          url: pf.url,
                          name: `POT_${idx + 1}_${decodeURIComponent(pf.url.split("?")[0].split("/").pop() || "file")}`,
                        })),
                      ]
                      downloadAttachmentsAsZip(files, `${selectedRelease.title || "Release"}_attachments`).catch(
                        (err) => alert("Error downloading attachments: " + (err?.message || "Failed"))
                      )
                    }}
                    className="ml-2 h-8 text-xs border-[#001f3f] text-[#001f3f] bg-white hover:bg-slate-100 font-semibold"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Download All (
                    {(selectedRelease.combined_pdf_url ? 1 : 0) + (selectedRelease.pot_files?.length || 0)})
                  </Button>
                )}
              </div>

              {/* Title Box */}
              <div className="relative border border-slate-300 rounded px-3.5 py-2.5 bg-white">
                <span className="absolute -top-2.5 left-2.5 bg-white px-1 text-[11px] font-medium text-slate-500">
                  Title
                </span>
                <div className="text-sm font-medium text-slate-900">{selectedRelease.title}</div>
                {selectedRelease.remarks && (
                  <div className="text-xs text-slate-500 mt-1">{selectedRelease.remarks}</div>
                )}
              </div>

              {/* Total Gross Comm. & Total Net Comm. */}
              <div className="flex flex-wrap items-start gap-10 pt-1">
                <div>
                  <div className="text-sm text-slate-600">Total Gross Comm.</div>
                  <div className="text-2xl font-normal text-slate-900 mt-0.5">
                    {formatCurrency(selectedRelease.total_gross_comm)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-600">Total Net Comm.</div>
                  <div className="text-2xl font-normal text-slate-900 mt-0.5">
                    {formatCurrency(selectedRelease.total_net_comm)}
                  </div>
                </div>
              </div>

              {/* Proof of Transactions Table */}
              <div className="space-y-2 pt-1">
                <h3 className="text-base font-medium text-slate-800">Proof of Transactions</h3>
                <div className="border-t border-slate-200 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-b border-slate-200">
                        <TableHead className="text-slate-900 font-bold w-48">Admin</TableHead>
                        <TableHead className="text-slate-900 font-bold">Filename</TableHead>
                        <TableHead className="text-slate-900 font-bold text-right w-40">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!selectedRelease.pot_files || selectedRelease.pot_files.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-sm text-slate-400">
                            No Proof of Transactions uploaded yet. Click &ldquo;+ ADD POT&rdquo; to upload.
                          </TableCell>
                        </TableRow>
                      ) : (
                        selectedRelease.pot_files.map((pot) => (
                          <TableRow key={pot.id} className="border-b border-slate-100">
                            <TableCell className="text-sm text-slate-800 align-middle">
                              {pot.admin_name || "Admin"}
                            </TableCell>
                            <TableCell className="text-sm text-slate-700 align-middle max-w-[340px] truncate">
                              {pot.filename || pot.url}
                            </TableCell>
                            <TableCell className="text-right align-middle">
                              <div className="inline-flex rounded overflow-hidden border border-red-200">
                                {!isReadOnly && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePotFile(pot.id)}
                                    className="px-3.5 py-1.5 text-xs font-medium text-red-600 bg-white hover:bg-red-50 border-r border-red-200 transition-colors"
                                  >
                                    Delete
                                  </button>
                                )}
                                <a
                                  href={formatS3Url(pot.url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-4 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
                                >
                                  View
                                </a>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
