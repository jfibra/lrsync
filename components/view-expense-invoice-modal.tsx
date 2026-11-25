"use client"

import React, { useState, useEffect } from "react"
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
  Upload,
  Paperclip,
  Loader2,
  X,
  ShieldCheck,
} from "lucide-react"
import {
  ExpenseInvoiceDocument,
  downloadExpenseInvoicePdf,
  generateExpenseInvoicePdfData,
  type ExpenseInvoiceRecord,
} from "@/components/expense-invoice-document"
import { SignaturePad } from "@/components/signature-pad"
import { useAuth } from "@/contexts/auth-context"
import { formatS3Url } from "@/utils/s3-url"
import { downloadAttachmentsAsZip } from "@/utils/download-attachments"

interface ViewExpenseInvoiceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: ExpenseInvoiceRecord | null
  canApprove?: boolean
  canManualApprove?: boolean
  onConvertClick?: (invoice: ExpenseInvoiceRecord) => void
  onUpdated?: () => void
}

function parseProofAttachments(invoice: ExpenseInvoiceRecord | null): string[] {
  if (!invoice) return []
  if (Array.isArray(invoice.approval_attachments) && invoice.approval_attachments.length > 0) {
    return invoice.approval_attachments.filter(Boolean).map((u) => formatS3Url(u))
  }
  const raw = (invoice.signed_pdf_url || "").trim()
  if (!raw) return []
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean).map((u: string) => formatS3Url(u))
      }
    } catch {
      return [formatS3Url(raw)]
    }
  }
  return [formatS3Url(raw)]
}

export function ViewExpenseInvoiceModal({
  open,
  onOpenChange,
  invoice,
  canApprove = false,
  canManualApprove = false,
  onConvertClick,
  onUpdated,
}: ViewExpenseInvoiceModalProps) {
  const { profile } = useAuth()
  const [downloading, setDownloading] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [submittingSignature, setSubmittingSignature] = useState(false)
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [showRejectInput, setShowRejectInput] = useState(false)

  // Super Admin Manual Approval with mandatory proof attachment
  const [uploadedProofUrls, setUploadedProofUrls] = useState<{ url: string; name: string }[]>([])
  const [uploadingProof, setUploadingProof] = useState(false)
  const [submittingManualApproval, setSubmittingManualApproval] = useState(false)
  const [downloadingAllProofs, setDownloadingAllProofs] = useState(false)
  const [showTaxColumns, setShowTaxColumns] = useState(true)

  useEffect(() => {
    setShowTaxColumns(invoice?.payment_terms !== "hide_tax_columns")
    if (!open) {
      setUploadedProofUrls([])
      setSignatureData(null)
      setShowRejectInput(false)
      setRejectionReason("")
    }
  }, [open, invoice?.id, invoice?.payment_terms])

  if (!invoice) return null

  const docContainerId = `view-expense-invoice-doc-${invoice.id || "preview"}`
  const isApproved = invoice.status === "approved" || invoice.status === "converted"
  const isConverted = invoice.status === "converted"
  const isRejected = invoice.status === "rejected"
  const existingProofAttachments = parseProofAttachments(invoice)

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
      let pdfUrl = ""
      let pdfBase64 = ""
      const el = document.getElementById(docContainerId)
      if (el) {
        try {
          const pdfData = await generateExpenseInvoicePdfData(el)
          try {
            const presignedRes = await fetch("/api/get-s3-upload-url", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fileName: `Expense-Voucher-${invoice.invoice_number}.pdf`,
                fileType: "application/pdf",
                category: "expense-invoice",
                reportNumber: invoice.invoice_number,
              }),
            })
            if (presignedRes.ok) {
              const { uploadUrl, publicUrl } = await presignedRes.json()
              const putRes = await fetch(uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": "application/pdf" },
                body: pdfData.blob,
              })
              if (putRes.ok) pdfUrl = publicUrl
            }
          } catch (s3Err) {
            console.warn("S3 PDF upload fallback:", s3Err)
          }
          if (!pdfUrl && pdfData.base64 && pdfData.base64.length < 3_000_000) {
            pdfBase64 = pdfData.base64
          }
        } catch (e) {
          console.warn("Could not attach PDF:", e)
        }
      }

      const res = await fetch("/api/send-expense-invoice-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice.id,
          pdfUrl: pdfUrl || undefined,
          pdfBase64: pdfBase64 || undefined,
          baseUrl: typeof window !== "undefined" ? window.location.origin : undefined,
        }),
      })
      const rawText = await res.text()
      let data: any = {}
      try {
        data = rawText ? JSON.parse(rawText) : {}
      } catch {
        data = { error: rawText || `HTTP ${res.status}` }
      }
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
          ? `Expense Voucher #${invoice.invoice_number} has been signed and approved!`
          : `Expense Voucher #${invoice.invoice_number} has been marked as rejected.`
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

  const handleUploadProofFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploadingProof(true)
    try {
      const newlyUploaded: { url: string; name: string }[] = []
      for (const file of Array.from(files)) {
        const presignedRes = await fetch("/api/get-s3-upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type || "application/octet-stream",
            category: "expense-invoice",
            reportNumber: invoice.invoice_number || "ExpenseVoucher",
            tinName: invoice.payee_name || "Expense",
            assignedArea: invoice.assigned_area || profile?.assigned_area || "Cebu",
            userFullName: profile?.full_name || "Super Admin",
          }),
        })
        if (!presignedRes.ok) {
          throw new Error(`Failed to get S3 upload authorization for ${file.name}`)
        }
        const { uploadUrl, publicUrl } = await presignedRes.json()
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        })
        if (!putRes.ok) {
          throw new Error(`S3 upload failed for ${file.name} (${putRes.status})`)
        }
        newlyUploaded.push({ url: formatS3Url(publicUrl), name: file.name })
      }
      setUploadedProofUrls((prev) => [...prev, ...newlyUploaded])
    } catch (err: any) {
      alert("Error uploading attachment: " + (err?.message || "Please try again."))
    } finally {
      setUploadingProof(false)
    }
  }

  const handleManualApproveWithAttachment = async () => {
    if (!invoice.id) return
    if (uploadedProofUrls.length === 0) {
      alert("Please upload at least one signed/proof attachment before approving.")
      return
    }
    if (
      !window.confirm(
        `Approve Expense Voucher #${invoice.invoice_number} using the ${uploadedProofUrls.length} uploaded proof attachment(s)?`
      )
    ) {
      return
    }
    setSubmittingManualApproval(true)
    try {
      const approverName = profile?.full_name
        ? `${profile.full_name} (Approved w/ Proof)`
        : "Super Admin (Approved w/ Proof)"
      const res = await fetch("/api/expense-invoice-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice.id,
          action: "approve",
          signedVia: "super_admin_attachment",
          approvalAttachments: uploadedProofUrls.map((f) => f.url),
          approvedByName: approverName,
          approvedByEmail: profile?.email || "super_admin",
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to approve expense voucher")

      alert(
        `Expense Voucher #${invoice.invoice_number} has been approved with the uploaded proof attachment! You can now convert it to a Purchase record.`
      )
      setUploadedProofUrls([])
      onUpdated?.()
      onOpenChange(false)
    } catch (err: any) {
      alert("Error approving voucher: " + (err?.message || "Please try again."))
    } finally {
      setSubmittingManualApproval(false)
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
                Expense Voucher #{invoice.invoice_number}
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-600">
                {invoice.email_sent_at ? (
                  <span className="text-sky-700 font-medium">
                    ✉ Email sent to {invoice.sent_to_email || "mindworth@gmail.com"} on{" "}
                    {format(new Date(invoice.email_sent_at), "MMM dd, yyyy hh:mm a")}
                  </span>
                ) : (
                  <span className="text-amber-700">Email not sent yet</span>
                )}
                {invoice.signed_at && (
                  <span className="text-emerald-700 font-semibold">
                    • Approved on {format(new Date(invoice.signed_at), "MMMM dd, yyyy hh:mm a")} (
                    {invoice.signed_via === "super_admin_attachment"
                      ? "via Super Admin Proof Attachment"
                      : invoice.signed_via === "email_link"
                        ? "via Email Link"
                        : "via Executive Dashboard"}
                    )
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
                    ? "Resend Email (mindworth@gmail.com)"
                    : "Send Email (mindworth@gmail.com)"}
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

        {/* Optional Display Toggle for Tax Type & Gross Taxable */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showTaxColumns}
              onChange={(e) => setShowTaxColumns(e.target.checked)}
              className="h-4 w-4 rounded border-slate-400 text-[#001f3f] cursor-pointer"
            />
            <span className="text-xs font-semibold text-[#001f3f]">
              Show Tax Type &amp; Gross Taxable columns on Voucher / PDF
            </span>
          </label>
          <span className="text-[11px] text-slate-500">
            Uncheck for budget requests without ORs yet
          </span>
        </div>

        {/* Expense Voucher Document */}
        <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 overflow-x-auto">
          <ExpenseInvoiceDocument
            invoice={{
              ...invoice,
              payment_terms: showTaxColumns ? null : "hide_tax_columns",
              signature_data: signatureData || invoice.signature_data,
            }}
            containerId={docContainerId}
          />
        </div>

        {/* Uploaded Approval Proof Attachments (if any) */}
        {existingProofAttachments.length > 0 && (
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                <Paperclip className="w-4 h-4 text-emerald-700" />
                Uploaded Approval Proof Attachments ({existingProofAttachments.length})
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={downloadingAllProofs}
                onClick={async () => {
                  setDownloadingAllProofs(true)
                  try {
                    await downloadAttachmentsAsZip(
                      existingProofAttachments.map((url, idx) => ({
                        url,
                        name: `Approval_Proof_${idx + 1}_${decodeURIComponent(
                          url.split("?")[0].split("/").pop() || "file"
                        )}`,
                      })),
                      `Expense_Voucher_${invoice.invoice_number}_approval_proof`
                    )
                  } catch (err: any) {
                    alert("Error downloading attachments: " + (err?.message || "Failed"))
                  } finally {
                    setDownloadingAllProofs(false)
                  }
                }}
                className="h-7 text-xs border-emerald-400 text-emerald-900 bg-white hover:bg-emerald-100 font-semibold"
              >
                {downloadingAllProofs ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5 mr-1" />
                )}
                Download All ({existingProofAttachments.length})
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {existingProofAttachments.map((url, idx) => (
                <a
                  key={idx}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-white border border-emerald-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Proof Attachment #{idx + 1}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Super Admin Manual Approval with Mandatory Proof Attachment */}
        {canManualApprove && !isApproved && !isConverted && (
          <div className="bg-amber-50/70 border-2 border-amber-300 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-[#001f3f] flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-600" />
                  Super Admin Manual Approval (Signed / Proof Attachment Required)
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  If Boss Ton signed offline or approved via chat/paper, upload the signed copy or approval proof below to approve this expense voucher directly.{" "}
                  <strong>At least 1 attachment is required.</strong>
                </p>
              </div>
              <label className="cursor-pointer inline-flex items-center gap-1.5 bg-[#001f3f] hover:bg-[#001f3f]/90 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-sm shrink-0">
                {uploadingProof ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>{uploadingProof ? "Uploading..." : "Upload Approval Attachment"}</span>
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  className="hidden"
                  disabled={uploadingProof || submittingManualApproval}
                  onChange={(e) => {
                    handleUploadProofFiles(e.target.files)
                    e.target.value = ""
                  }}
                />
              </label>
            </div>

            {uploadedProofUrls.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-emerald-800">
                  Uploaded Proof Files ({uploadedProofUrls.length}):
                </div>
                <div className="flex flex-wrap gap-2">
                  {uploadedProofUrls.map((file, idx) => (
                    <div
                      key={`${file.url}-${idx}`}
                      className="inline-flex items-center gap-2 bg-white border border-emerald-200 rounded-lg px-3 py-1.5 text-xs"
                    >
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-700 hover:underline font-medium max-w-[200px] truncate"
                      >
                        {file.name}
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          setUploadedProofUrls((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-slate-400 hover:text-red-600"
                        title="Remove file"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-xs text-amber-900/80 bg-white/80 border border-dashed border-amber-300 rounded-lg px-3 py-2.5">
                No attachment uploaded yet. Upload a signed voucher photo, screenshot, or PDF to enable manual approval.
              </div>
            )}

            <div className="flex justify-end pt-1">
              <Button
                type="button"
                onClick={handleManualApproveWithAttachment}
                disabled={
                  uploadedProofUrls.length === 0 || uploadingProof || submittingManualApproval
                }
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5"
              >
                {submittingManualApproval ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Approving Voucher...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Approve Expense Voucher with Attachment
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

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
                  Sign below to approve this expense voucher. The signed date and signature will be permanently recorded on the voucher and unlock conversion to Purchases.
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
                  placeholder="Enter reason for rejecting this expense voucher..."
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
                  {showRejectInput ? "Confirm Reject Voucher" : "Reject Voucher"}
                </Button>
              )}

              <Button
                type="button"
                onClick={() => handleSignApproval("approve")}
                disabled={submittingSignature || !signatureData}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                {submittingSignature ? "Recording Signature..." : "Sign & Approve Expense Voucher"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
