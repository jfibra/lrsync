"use client"

import React, { useState, useEffect, useMemo } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase/client"
import { format } from "date-fns"
import {
  ShieldCheck,
  PenTool,
  CheckCircle2,
  Clock,
  XCircle,
  Download,
  Search,
  FileText,
  Lock,
  ExternalLink,
} from "lucide-react"
import {
  ExpenseInvoiceDocument,
  downloadExpenseInvoicePdf,
  type ExpenseInvoiceRecord,
} from "@/components/expense-invoice-document"
import { SignaturePad } from "@/components/signature-pad"

const EXCLUSIVE_EMAIL = "mindworth@gmail.com"

export default function ExclusiveExpenseApprovalsPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const [invoices, setInvoices] = useState<ExpenseInvoiceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTab, setFilterTab] = useState<"pending_approval" | "approved" | "all">("pending_approval")
  const [searchTerm, setSearchTerm] = useState("")

  // Active invoice for signing / viewing
  const [activeInvoice, setActiveInvoice] = useState<ExpenseInvoiceRecord | null>(null)
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const isAuthorizedExecutive =
    user?.email?.toLowerCase() === EXCLUSIVE_EMAIL ||
    profile?.email?.toLowerCase() === EXCLUSIVE_EMAIL

  const fetchInvoices = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("expense_request_invoices")
        .select("*")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })

      if (!error && data) {
        setInvoices(data as ExpenseInvoiceRecord[])
      }
    } catch (err) {
      console.error("Error fetching expense invoices:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthorizedExecutive) {
      fetchInvoices()
    } else {
      setLoading(false)
    }
  }, [isAuthorizedExecutive])

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (filterTab === "pending_approval" && inv.status !== "pending_approval") return false
      if (
        filterTab === "approved" &&
        inv.status !== "approved" &&
        inv.status !== "converted"
      ) {
        return false
      }

      if (searchTerm.trim() !== "") {
        const q = searchTerm.toLowerCase()
        const matchNo = (inv.invoice_number || "").toLowerCase().includes(q)
        const matchReq = (inv.requested_by_name || "").toLowerCase().includes(q)
        const matchPayee = (inv.payee_name || "").toLowerCase().includes(q)
        const matchItems = (inv.items || []).some((it) =>
          (it.item_name || "").toLowerCase().includes(q)
        )
        if (!matchNo && !matchReq && !matchPayee && !matchItems) return false
      }
      return true
    })
  }, [invoices, filterTab, searchTerm])

  const stats = useMemo(() => {
    const pending = invoices.filter((i) => i.status === "pending_approval")
    const approved = invoices.filter(
      (i) => i.status === "approved" || i.status === "converted"
    )
    const pendingTotal = pending.reduce((s, i) => s + (Number(i.total) || 0), 0)
    const approvedTotal = approved.reduce((s, i) => s + (Number(i.total) || 0), 0)
    return {
      pendingCount: pending.length,
      approvedCount: approved.length,
      pendingTotal,
      approvedTotal,
      totalCount: invoices.length,
    }
  }, [invoices])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(Number(val) || 0)

  const handleSignSubmit = async (action: "approve" | "reject") => {
    if (!activeInvoice?.id) return
    if (action === "approve" && !signatureData) {
      alert("Please draw or upload your signature before approving.")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/expense-invoice-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: activeInvoice.id,
          action,
          signatureData,
          approvedByName: profile?.full_name?.toUpperCase() || "ANTHONY GERARD LEUTERIO",
          approvedByEmail: EXCLUSIVE_EMAIL,
          signedVia: "dashboard",
          rejectionReason: action === "reject" ? rejectionReason : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to record signature")

      alert(
        action === "approve"
          ? `Expense Invoice #${activeInvoice.invoice_number} has been signed and approved! Accounting and Secretaries can now convert it into a Purchase record.`
          : `Expense Invoice #${activeInvoice.invoice_number} has been rejected.`
      )
      setActiveInvoice(null)
      setSignatureData(null)
      setShowRejectInput(false)
      setRejectionReason("")
      fetchInvoices()
    } catch (err: any) {
      alert("Error: " + (err?.message || "Failed to process approval"))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownloadPdf = async (inv: ExpenseInvoiceRecord) => {
    const el = document.getElementById(`exec-invoice-doc-${inv.id}`)
    if (!el) return
    setDownloadingPdf(true)
    try {
      await downloadExpenseInvoicePdf(el, inv.invoice_number)
    } finally {
      setDownloadingPdf(false)
    }
  }

  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <div className="min-h-screen bg-slate-50">
        <DashboardHeader />
        <div className="pt-20 px-4 sm:px-6 lg:px-8 pb-12 max-w-7xl mx-auto">
          {!authLoading && !isAuthorizedExecutive ? (
            <Card className="max-w-xl mx-auto mt-16 border-red-200 bg-white shadow-lg">
              <CardHeader className="text-center">
                <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
                  <Lock className="w-7 h-7" />
                </div>
                <CardTitle className="text-2xl font-bold text-slate-900">
                  Exclusive Executive Portal
                </CardTitle>
                <CardDescription className="text-slate-600">
                  This Expense Invoice Approval page is exclusive to{" "}
                  <strong>Anthony Leuterio ({EXCLUSIVE_EMAIL})</strong>.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Executive Banner */}
              <div className="bg-gradient-to-r from-[#001f3f] via-[#0f3460] to-[#0284c7] rounded-2xl p-6 sm:p-8 text-white shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="bg-white/15 backdrop-blur-sm p-3.5 rounded-xl border border-white/20">
                      <ShieldCheck className="w-8 h-8 text-amber-300" />
                    </div>
                    <div>
                      <div className="inline-flex items-center gap-1.5 bg-amber-400/20 border border-amber-300/40 text-amber-200 text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full mb-2">
                        Exclusive Executive Portal &bull; {EXCLUSIVE_EMAIL}
                      </div>
                      <h1 className="text-2xl sm:text-3xl font-extrabold">
                        Expense Request Invoice Approvals
                      </h1>
                      <p className="text-sm text-sky-100 mt-1 max-w-2xl">
                        Welcome, <strong>Sir Anthony Gerard Leuterio</strong>. Review itemized expense invoices submitted by Accounting and Secretaries, sign digitally to approve, and automatically record the official signed date.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <Card className="bg-amber-50/80 border-2 border-amber-200 shadow-sm">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
                        Awaiting Your Signature
                      </p>
                      <p className="text-3xl font-extrabold text-amber-900 mt-1">
                        {stats.pendingCount}
                      </p>
                      <p className="text-xs font-semibold text-amber-700 mt-1">
                        Total: {formatCurrency(stats.pendingTotal)}
                      </p>
                    </div>
                    <div className="bg-amber-500 text-white p-3.5 rounded-xl shadow">
                      <PenTool className="w-6 h-6" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-emerald-50/80 border-2 border-emerald-200 shadow-sm">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                        Signed &amp; Approved Invoices
                      </p>
                      <p className="text-3xl font-extrabold text-emerald-900 mt-1">
                        {stats.approvedCount}
                      </p>
                      <p className="text-xs font-semibold text-emerald-700 mt-1">
                        Total: {formatCurrency(stats.approvedTotal)}
                      </p>
                    </div>
                    <div className="bg-emerald-600 text-white p-3.5 rounded-xl shadow">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white border-2 border-slate-200 shadow-sm">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        All Submitted Invoices
                      </p>
                      <p className="text-3xl font-extrabold text-[#001f3f] mt-1">
                        {stats.totalCount}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">All branches &amp; accounting</p>
                    </div>
                    <div className="bg-[#001f3f] text-white p-3.5 rounded-xl shadow">
                      <FileText className="w-6 h-6" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Filter & Search Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={filterTab === "pending_approval" ? "default" : "outline"}
                    onClick={() => setFilterTab("pending_approval")}
                    className={
                      filterTab === "pending_approval"
                        ? "bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                        : "border-slate-300 text-slate-700 bg-white"
                    }
                  >
                    <Clock className="w-4 h-4 mr-1.5" />
                    Pending Signature ({stats.pendingCount})
                  </Button>
                  <Button
                    size="sm"
                    variant={filterTab === "approved" ? "default" : "outline"}
                    onClick={() => setFilterTab("approved")}
                    className={
                      filterTab === "approved"
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                        : "border-slate-300 text-slate-700 bg-white"
                    }
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Signed &amp; Approved ({stats.approvedCount})
                  </Button>
                  <Button
                    size="sm"
                    variant={filterTab === "all" ? "default" : "outline"}
                    onClick={() => setFilterTab("all")}
                    className={
                      filterTab === "all"
                        ? "bg-[#001f3f] text-white font-semibold"
                        : "border-slate-300 text-slate-700 bg-white"
                    }
                  >
                    All Invoices ({stats.totalCount})
                  </Button>
                </div>

                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search invoice #, item, requester..."
                    className="pl-9 bg-white text-[#001f3f] border-slate-300"
                  />
                </div>
              </div>

              {/* Invoices List */}
              {loading ? (
                <Card className="bg-white border-slate-200 p-12 text-center text-slate-500">
                  Loading expense request invoices...
                </Card>
              ) : filteredInvoices.length === 0 ? (
                <Card className="bg-white border-slate-200 p-12 text-center text-slate-500">
                  No expense request invoices found in this view.
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredInvoices.map((inv) => {
                    const items = Array.isArray(inv.items) ? inv.items : []
                    const isPending = inv.status === "pending_approval"
                    const isApproved = inv.status === "approved" || inv.status === "converted"

                    return (
                      <Card
                        key={inv.id}
                        className={`bg-white border-2 transition-shadow hover:shadow-md ${
                          isPending ? "border-amber-200" : "border-slate-200"
                        }`}
                      >
                        <CardContent className="p-5">
                          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div className="space-y-2 flex-1">
                              <div className="flex flex-wrap items-center gap-2.5">
                                <span className="text-xl font-extrabold text-[#001f3f]">
                                  Invoice #{inv.invoice_number}
                                </span>
                                {isPending ? (
                                  <Badge className="bg-amber-100 text-amber-800 border border-amber-300">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Awaiting Your Signature
                                  </Badge>
                                ) : isApproved ? (
                                  <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    {inv.status === "converted"
                                      ? "Signed & Converted to Purchase"
                                      : "Signed & Approved"}
                                  </Badge>
                                ) : (
                                  <Badge className="bg-red-100 text-red-800 border border-red-300">
                                    Rejected
                                  </Badge>
                                )}
                                <span className="text-xs text-slate-500">
                                  Date:{" "}
                                  {inv.invoice_date
                                    ? format(new Date(inv.invoice_date), "MMMM dd, yyyy")
                                    : "-"}
                                </span>
                              </div>

                              <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                                <span>
                                  <strong>Requested By:</strong> {inv.requested_by_name || "Accounting"}{" "}
                                  {inv.assigned_area ? `(${inv.assigned_area})` : ""}
                                </span>
                                {inv.payee_name && (
                                  <span>
                                    <strong>Payee:</strong> {inv.payee_name}
                                  </span>
                                )}
                                {inv.signed_at && (
                                  <span className="text-emerald-700 font-semibold">
                                    <strong>Signed Date:</strong>{" "}
                                    {format(new Date(inv.signed_at), "MMMM dd, yyyy hh:mm a")} (
                                    {inv.signed_via === "email_link"
                                      ? "Signed via Email"
                                      : "Signed on Dashboard"}
                                    )
                                  </span>
                                )}
                              </div>

                              {/* Itemized Pills */}
                              <div className="flex flex-wrap gap-2 pt-1">
                                {items.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="inline-flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg text-xs"
                                  >
                                    <span className="font-semibold text-slate-800">
                                      {item.item_name}
                                    </span>
                                    <span className="font-extrabold text-[#0284c7]">
                                      {formatCurrency(item.amount || 0)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 border-t lg:border-t-0 pt-3 lg:pt-0">
                              <div className="text-left lg:text-right">
                                <span className="text-xs uppercase font-bold text-slate-400 block">
                                  Total Invoice Amount
                                </span>
                                <span className="text-2xl font-extrabold text-[#001f3f]">
                                  {formatCurrency(inv.total || 0)}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                {inv.signature_data && (
                                  <img
                                    src={inv.signature_data}
                                    alt="Signature"
                                    className="h-9 w-auto bg-slate-50 border border-slate-200 rounded px-2 object-contain"
                                  />
                                )}
                                <Button
                                  onClick={() => {
                                    setActiveInvoice(inv)
                                    setSignatureData(null)
                                    setShowRejectInput(false)
                                  }}
                                  className={
                                    isPending
                                      ? "bg-gradient-to-r from-[#001f3f] to-[#0284c7] hover:opacity-95 text-white font-bold shadow"
                                      : "bg-slate-800 hover:bg-slate-900 text-white"
                                  }
                                >
                                  <PenTool className="w-4 h-4 mr-2" />
                                  {isPending ? "Review & Sign Invoice" : "View Signed Invoice / PDF"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Review & Sign Modal */}
      <Dialog
        open={Boolean(activeInvoice)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setActiveInvoice(null)
            setSignatureData(null)
          }
        }}
      >
        <DialogContent className="max-w-5xl max-h-[94vh] overflow-y-auto bg-white text-[#001f3f]">
          {activeInvoice && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <DialogTitle className="text-2xl font-bold text-[#001f3f]">
                      Review &amp; Sign Expense Invoice #{activeInvoice.invoice_number}
                    </DialogTitle>
                    {activeInvoice.signed_at && (
                      <p className="text-xs text-emerald-700 font-semibold mt-1">
                        ✓ Signed on{" "}
                        {format(new Date(activeInvoice.signed_at), "MMMM dd, yyyy 'at' hh:mm a")}
                      </p>
                    )}
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleDownloadPdf(activeInvoice)}
                    disabled={downloadingPdf}
                    className="bg-[#001f3f] text-white"
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    {downloadingPdf ? "Generating PDF..." : "Download PDF"}
                  </Button>
                </div>
              </DialogHeader>

              <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 overflow-x-auto">
                <ExpenseInvoiceDocument
                  invoice={{
                    ...activeInvoice,
                    signature_data: signatureData || activeInvoice.signature_data,
                  }}
                  containerId={`exec-invoice-doc-${activeInvoice.id}`}
                />
              </div>

              {activeInvoice.status !== "converted" && (
                <div className="bg-slate-50 border-2 border-[#001f3f]/20 rounded-xl p-5 space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-[#001f3f] flex items-center gap-2">
                      <PenTool className="w-4 h-4 text-[#0284c7]" />
                      {activeInvoice.status === "approved"
                        ? "Update Your Digital Signature"
                        : "Sign Below to Approve Expense Request Invoice"}
                    </h3>
                    <p className="text-xs text-slate-600">
                      Your signature and the current date &amp; time will be permanently recorded on this invoice.
                    </p>
                  </div>

                  <SignaturePad
                    value={signatureData}
                    onChange={setSignatureData}
                    signerName="ANTHONY GERARD LEUTERIO"
                    disabled={submitting}
                  />

                  {showRejectInput && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-red-700">
                        Reason for Rejection
                      </Label>
                      <Input
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Optional reason for rejecting this expense invoice..."
                        className="bg-white border-red-300 text-slate-900"
                      />
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (!showRejectInput) setShowRejectInput(true)
                        else handleSignSubmit("reject")
                      }}
                      disabled={submitting}
                      className="border-red-300 text-red-600 hover:bg-red-50 bg-white"
                    >
                      <XCircle className="w-4 h-4 mr-1.5" />
                      {showRejectInput ? "Confirm Reject" : "Reject Invoice"}
                    </Button>

                    <Button
                      type="button"
                      onClick={() => handleSignSubmit("approve")}
                      disabled={submitting || !signatureData}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 shadow-md"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      {submitting ? "Recording Signature..." : "Sign & Approve Expense Invoice"}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  )
}
