"use client"

import React, { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { format } from "date-fns"
import {
  Download,
  Mail,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  ExternalLink,
  PenTool,
  Clock,
} from "lucide-react"
import {
  ExpenseInvoiceDocument,
  downloadExpenseInvoicePdf,
  generateExpenseInvoicePdfData,
  type ExpenseInvoiceRecord,
} from "@/components/expense-invoice-document"
import { SignaturePad } from "@/components/signature-pad"

interface ViewExpenseInvoiceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: ExpenseInvoiceRecord | null
  canApprove?: boolean
  onConvertClick?: (invoice: ExpenseInvoiceRecord) => void
  onUpdated?: () => void
}

export function ViewExpenseInvoiceModal({
  open,
  onOpenChange,
  invoice,
  canApprove = false,
  onConvertClick,
  onUpdated,
}: ViewExpenseInvoiceModalProps) {
  const [downloading, setDownloading] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [submittingSignature, setSubmittingSignature] = useState(false)
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [showRejectInput, setShowRejectInput] = useState(false)

  if (!invoice) return null

  const docContainerId = `view-expense-invoice-doc-${invoice.id || "preview"}`
  const isApproved = invoice.status === "approved" || invoice.status === "converted"
  const isConverted = invoice.status === "converted"
  const isRejected = invoice.status === "rejected"

  const handleDownloadPdf = async () => {
    const el = document.getElementById(docContainerId)
    if (!el) return
    setDownloading(true)
    try {
      await downloadExpenseInvoicePdf(el, invoice.invoice_number)
    } catch (err) {
      console.error("Failed to download PDF:", err)
      alert("Error generating PDF.")
    } finally {
      setDownloading(false)
    }
  }

  const handleSendEmail = async () => {
    if (!invoice.id) return
    setSendingEmail(true)
    try {
      let pdfBase64 = ""
      const el = document.getElementById(docContainerId)
      if (el) {
        try {
          const pdfData = await generateExpenseInvoicePdfData(el)
          pdfBase64 = pdfData.base64
        } catch (e) {
          console.warn("Could not attach PDF base64:", e)
        }
      }

      const res = await fetch("/api/send-expense-invoice-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice.id,
          pdfBase64,
          baseUrl: typeof window !== "undefined" ? window.location.origin : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send email")

      alert(`Email sent successfully to ${data.sentTo}!`)
      onUpdated?.()
    } catch (err: any) {
      alert("Error sending email: " + (err?.message || "Failed"))
    } finally {
      setSendingEmail(false)
    }
  }

  const handleSignApproval = async (action: "approve" | "reject") => {
    if (!invoice.id) return
    if (action === "approve" && !signatureData) {
      alert("Please draw or upload your signature before approving.")
      return
    }
    setSubmittingSignature(true)
    try {
      const res = await fetch("/api/expense-invoice-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice.id,
          action,
          signatureData,
          approvedByName: "ANTHONY GERARD LEUTERIO",
          approvedByEmail: "mindworth@gmail.com",
          signedVia: "dashboard",
          rejectionReason: action === "reject" ? rejectionReason : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to process approval")

      alert(
        action === "approve"
          ? `Expense Invoice #${invoice.invoice_number} has been signed and approved!`
          : `Expense Invoice #${invoice.invoice_number} has been marked as rejected.`
      )
      setSignatureData(null)
      setShowRejectInput(false)
      onUpdated?.()
      onOpenChange(false)
    } catch (err: any) {
      alert("Error: " + (err?.message || "Failed to submit"))
    } finally {
      setSubmittingSignature(false)
    }
  }

  const approvalUrl =
    typeof window !== "undefined" && invoice.approval_token
      ? `${window.location.origin}/expense-approval/${invoice.approval_token}`
      : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[94vh] overflow-y-auto bg-white text-[#001f3f]">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-2xl font-bold text-[#001f3f]">
                Expense Request Invoice #{invoice.invoice_number}
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-600">
                {invoice.email_sent_at ? (
                  <span className="text-sky-700 font-medium">
                    ✉ Email sent to {invoice.sent_to_email || "johnryfibra2@gmail.com"} on{" "}
                    {format(new Date(invoice.email_sent_at), "MMM dd, yyyy hh:mm a")}
                  </span>
                ) : (
                  <span className="text-amber-700">Email not sent yet</span>
                )}
                {invoice.signed_at && (
                  <span className="text-emerald-700 font-semibold">
                    • Signed on {format(new Date(invoice.signed_at), "MMMM dd, yyyy hh:mm a")} (
                    {invoice.signed_via === "email_link" ? "via Email Link" : "via Executive Dashboard"})
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="border-sky-600 text-sky-700 hover:bg-sky-50 bg-white"
              >
                <Mail className="w-4 h-4 mr-1.5" />
                {sendingEmail
                  ? "Sending..."
                  : invoice.email_sent_at
                  ? "Resend Email (johnryfibra2@gmail.com)"
                  : "Send Email (johnryfibra2@gmail.com)"}
              </Button>

              {approvalUrl && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(approvalUrl, "_blank")}
                  className="border-slate-300 text-slate-700 hover:bg-slate-50 bg-white"
                  title="Open Public No-Login Signing Page"
                >
                  <ExternalLink className="w-4 h-4 mr-1.5" />
                  Public Signing Link
                </Button>
              )}

              <Button
                type="button"
                size="sm"
                onClick={handleDownloadPdf}
                disabled={downloading}
                className="bg-[#001f3f] hover:bg-[#001f3f]/90 text-white"
              >
                <Download className="w-4 h-4 mr-1.5" />
                {downloading ? "Generating PDF..." : "Download PDF"}
              </Button>

              {isApproved && !isConverted && onConvertClick && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false)
                    onConvertClick(invoice)
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  <ArrowRightLeft className="w-4 h-4 mr-1.5" />
                  Convert to Purchases Record
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Invoice Document */}
        <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 overflow-x-auto">
          <ExpenseInvoiceDocument
            invoice={{
              ...invoice,
              signature_data: signatureData || invoice.signature_data,
            }}
            containerId={docContainerId}
          />
        </div>

        {/* Executive Approval Section (if canApprove and not yet converted) */}
        {canApprove && !isConverted && (
          <div className="bg-slate-50 border-2 border-[#001f3f]/20 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#001f3f] flex items-center gap-2">
                  <PenTool className="w-4 h-4 text-[#0284c7]" />
                  {isApproved
                    ? "Update Executive Signature"
                    : "Executive Signature & Expense Approval (Sir Anthony Leuterio)"}
                </h3>
                <p className="text-xs text-slate-600">
                  Sign below to approve this expense request invoice. The signed date and signature will be permanently recorded on the invoice and unlock conversion to Purchases.
                </p>
              </div>
              {invoice.signed_at && (
                <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <Clock className="w-3 h-3 mr-1" />
                  Signed {format(new Date(invoice.signed_at), "MMM dd, yyyy hh:mm a")}
                </Badge>
              )}
            </div>

            <SignaturePad
              value={signatureData}
              onChange={setSignatureData}
              signerName="ANTHONY GERARD LEUTERIO"
              disabled={submittingSignature}
            />

            {showRejectInput && (
              <div className="space-y-2 pt-2">
                <Label className="text-xs font-semibold text-red-700">Reason for Rejection</Label>
                <Input
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejecting this expense invoice..."
                  className="bg-white border-red-300 text-slate-900"
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              {!isRejected && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (!showRejectInput) {
                      setShowRejectInput(true)
                    } else {
                      handleSignApproval("reject")
                    }
                  }}
                  disabled={submittingSignature}
                  className="border-red-300 text-red-600 hover:bg-red-50 bg-white"
                >
                  <XCircle className="w-4 h-4 mr-1.5" />
                  {showRejectInput ? "Confirm Reject Invoice" : "Reject Invoice"}
                </Button>
              )}

              <Button
                type="button"
                onClick={() => handleSignApproval("approve")}
                disabled={submittingSignature || !signatureData}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                {submittingSignature ? "Recording Signature..." : "Sign & Approve Expense Invoice"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
