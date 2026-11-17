"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  Trash2,
  ExternalLink,
  Receipt,
} from "lucide-react"
import { format } from "date-fns"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase/client"
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
  const [viewVoucher, setViewVoucher] = useState<CommissionVoucherData | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

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
      fetchVouchers()
    } catch (err: any) {
      alert("Error deleting voucher: " + (err?.message || "Failed"))
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

      {/* Vouchers Table */}
      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-lg font-bold text-[#001f3f]">Saved Commission Vouchers</CardTitle>
          <CardDescription>
            Each saved voucher includes its generated single-page bondpaper PDF attachment.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#001f3f] hover:bg-[#001f3f]">
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
                    <TableCell colSpan={10} className="text-center py-12 text-slate-500">
                      Loading commission vouchers...
                    </TableCell>
                  </TableRow>
                ) : filteredVouchers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-slate-500">
                      No commission vouchers found. Click &ldquo;Create Voucher&rdquo; to generate one.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVouchers.map((v) => (
                    <TableRow key={v.id} className="hover:bg-slate-50">
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create Voucher Modal */}
      <CreateCommissionVoucherModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onVoucherSaved={fetchVouchers}
      />

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
