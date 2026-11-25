"use client"

import React, { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { format } from "date-fns"
import {
  CheckCircle2,
  XCircle,
  Download,
  PenTool,
  ShieldCheck,
  FileText,
  ExternalLink,
  Clock,
  AlertTriangle,
} from "lucide-react"
import {
  ExpenseInvoiceDocument,
  downloadExpenseInvoicePdf,
  type ExpenseInvoiceRecord,
} from "@/components/expense-invoice-document"
import { SignaturePad } from "@/components/signature-pad"
import { formatS3Url } from "@/utils/s3-url"

export default function PublicExpenseApprovalPage() {
  const params = useParams()
  const token = params?.token as string

  const [invoice, setInvoice] = useState<ExpenseInvoiceRecord | null>(null)
  const [expenseItems, setExpenseItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [signerName, setSignerName] = useState("ANTHONY GERARD LEUTERIO")
  const [submitting, setSubmitting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [justApproved, setJustApproved] = useState(false)

  const fetchInvoiceByToken = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/expense-invoice-public?token=${encodeURIComponent(token)}`)
      const data = await res.json()
      if (!res.ok || !data.invoice) {
        throw new Error(data.error || "Invoice not found or approval link is invalid.")
      }
      setInvoice(data.invoice)
      setExpenseItems(data.expenseItems || [])
      if (data.invoice.approved_by_name) {
        setSignerName(data.invoice.approved_by_name)
      }
    } catch (err: any) {
      setError(err?.message || "Could not load expense invoice.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoiceByToken()
  }, [token])

  const handleAction = async (action: "approve" | "reject") => {
    if (!token || !invoice) return
    if (action === "approve" && !signatureData) {
      alert("Please draw or upload your signature in the signature box before approving.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/expense-invoice-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          action,
          signatureData,
          approvedByName: signerName || "ANTHONY GERARD LEUTERIO",
          approvedByEmail: "mindworth@gmail.com",
          signedVia: "email_link",
          rejectionReason: action === "reject" ? rejectionReason : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to record signature")

      setInvoice(data.invoice)
      setSignatureData(null)
      setShowRejectInput(false)
      if (action === "approve") {
        setJustApproved(true)
      }
    } catch (err: any) {
      alert("Error: " + (err?.message || "Failed to submit approval"))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!invoice) return
    const el = document.getElementById("public-approval-invoice-doc")
    if (!el) return
    setDownloading(true)
    try {
      await downloadExpenseInvoicePdf(el, invoice.invoice_number)
    } finally {
      setDownloading(false)
    }
  }

  // Gather any supporting receipts attached to the items
  const attachedFiles: string[] = []
  expenseItems.forEach((item) => {
    if (Array.isArray(item.official_receipt)) {
      item.official_receipt.filter(Boolean).forEach((u: string) => {
        const formatted = formatS3Url(u)
        if (!attachedFiles.includes(formatted)) attachedFiles.push(formatted)
      })
    }
  })
  if (invoice && Array.isArray(invoice.items)) {
    invoice.items.forEach((it) => {
      if (Array.isArray(it.official_receipt)) {
        it.official_receipt.filter(Boolean).forEach((u: string) => {
          const formatted = formatS3Url(u)
          if (!attachedFiles.includes(formatted)) attachedFiles.push(formatted)
        })
      }
    })
  }

  const isApproved = invoice?.status === "approved" || invoice?.status === "converted"
  const isConverted = invoice?.status === "converted"
  const isRejected = invoice?.status === "rejected"

  return (
    <div className="min-h-screen bg-slate-100 text-[#001f3f]">
      {/* Top Executive Portal Bar */}
      <header className="bg-[#001f3f] text-white border-b border-white/10 sticky top-0 z-40 shadow-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-sky-500/20 border border-sky-400/30 p-2 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-sky-300" />
            </div>
            <div>
              <div className="font-bold text-sm sm:text-base tracking-tight">
                LR Accounting Software &bull; Executive Expense Approval
              </div>
              <div className="text-[11px] text-slate-300">
                Secure No-Login Voucher Review &amp; Digital Signature Portal
              </div>
            </div>
          </div>

          {invoice && (
            <Button
              size="sm"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="bg-sky-600 hover:bg-sky-700 text-white font-semibold"
            >
              <Download className="w-4 h-4 mr-1.5" />
              {downloading ? "Generating PDF..." : "Download Voucher PDF"}
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {loading ? (
          <Card className="bg-white border-slate-200 p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#001f3f] mx-auto mb-3" />
            <p className="text-slate-600 font-medium">Loading Expense Voucher...</p>
          </Card>
        ) : error || !invoice ? (
          <Card className="bg-white border-red-200 p-10 text-center max-w-lg mx-auto mt-10">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <CardTitle className="text-xl font-bold text-slate-900 mb-2">
              Unable to Load Expense Voucher
            </CardTitle>
            <CardDescription className="text-slate-600">
              {error || "This voucher link may be invalid or expired."}
            </CardDescription>
          </Card>
        ) : (
          <>
            {/* Status Banner */}
            {isApproved && (
              <div className="bg-emerald-600 text-white rounded-xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-7 h-7 text-emerald-200 shrink-0 mt-0.5" />
                  <div>
                    <h2 className="text-lg font-extrabold">
                      {justApproved
                        ? "Thank You! Expense Voucher Signed & Approved"
                        : "This Expense Voucher is Officially Signed & Approved"}
                    </h2>
                    <p className="text-xs sm:text-sm text-emerald-100 mt-0.5">
                      Signed by <strong>{invoice.approved_by_name || "ANTHONY GERARD LEUTERIO"}</strong>
                      {invoice.signed_at && (
                        <>
                          {" "}
                          on{" "}
                          <strong>
                            {format(new Date(invoice.signed_at), "MMMM dd, yyyy 'at' hh:mm a")}
                          </strong>
                        </>
                      )}
                      . Accounting and Secretaries can now convert this record into Purchases.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleDownloadPdf}
                  disabled={downloading}
                  className="bg-white text-emerald-800 hover:bg-emerald-50 font-bold shrink-0"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Download Signed PDF
                </Button>
              </div>
            )}

            {isRejected && (
              <div className="bg-red-600 text-white rounded-xl p-5 shadow-lg flex items-center gap-3">
                <XCircle className="w-7 h-7 text-red-200 shrink-0" />
                <div>
                  <h2 className="text-lg font-extrabold">Expense Voucher Rejected</h2>
                  {invoice.rejection_reason && (
                    <p className="text-sm text-red-100 mt-0.5">
                      Reason: {invoice.rejection_reason}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Digital Signature Box (Shown at the top or bottom when pending, or to update signature before conversion) */}
            {!isConverted && (
              <Card className="bg-white border-2 border-[#0284c7]/30 shadow-md">
                <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/70">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg font-bold text-[#001f3f] flex items-center gap-2">
                        <PenTool className="w-5 h-5 text-[#0284c7]" />
                        {isApproved
                          ? "Update Digital Signature"
                          : "Sign Below to Approve Expense Voucher"}
                      </CardTitle>
                      <CardDescription>
                        Draw your signature in the pad below and click{" "}
                        <strong>&ldquo;Sign &amp; Approve Expense Voucher&rdquo;</strong>. No login is required.
                      </CardDescription>
                    </div>
                    {invoice.signed_at && (
                      <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <Clock className="w-3.5 h-3.5 mr-1" />
                        Signed {format(new Date(invoice.signed_at), "MMM dd, yyyy hh:mm a")}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="max-w-sm">
                    <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                      Approver Name
                    </Label>
                    <Input
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      className="bg-white text-[#001f3f] border-slate-300 font-bold"
                    />
                  </div>

                  <SignaturePad
                    value={signatureData}
                    onChange={setSignatureData}
                    signerName={signerName}
                    disabled={submitting}
                  />

                  {showRejectInput && (
                    <div className="space-y-1.5 pt-2">
                      <Label className="text-xs font-semibold text-red-700">
                        Reason for Rejection
                      </Label>
                      <Input
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Enter reason for rejecting this expense request..."
                        className="bg-white border-red-300 text-slate-900"
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap justify-end gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (!showRejectInput) setShowRejectInput(true)
                        else handleAction("reject")
                      }}
                      disabled={submitting}
                      className="border-red-300 text-red-600 hover:bg-red-50 bg-white"
                    >
                      <XCircle className="w-4 h-4 mr-1.5" />
                      {showRejectInput ? "Confirm Reject Invoice" : "Reject"}
                    </Button>

                    <Button
                      type="button"
                      onClick={() => handleAction("approve")}
                      disabled={submitting || !signatureData}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 shadow-md"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      {submitting
                        ? "Recording Signature & Date..."
                        : "Sign & Approve Expense Invoice"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Supporting Attachments (if any) */}
            {attachedFiles.length > 0 && (
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader className="py-3 px-5 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold text-[#001f3f] flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#0284c7]" />
                    Attached Supporting Receipts / Documents ({attachedFiles.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 flex flex-wrap gap-2">
                  {attachedFiles.map((url, idx) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-slate-50 hover:bg-sky-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium text-[#001f3f]"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-sky-600" />
                      {decodeURIComponent(url.split("/").pop() || `Attachment ${idx + 1}`)}
                    </a>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Full Professional Invoice Document */}
            <div className="bg-white p-2 sm:p-6 rounded-2xl shadow-lg border border-slate-200 overflow-x-auto">
              <ExpenseInvoiceDocument
                invoice={{
                  ...invoice,
                  approved_by_name: signerName || invoice.approved_by_name,
                  signature_data: signatureData || invoice.signature_data,
                }}
                containerId="public-approval-invoice-doc"
              />
            </div>
          </>
        )}
      </main>
    </div>
  )
}
