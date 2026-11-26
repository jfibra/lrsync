"use client"

import type React from "react"
import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { logNotification } from "@/utils/logNotification"
import { formatS3Url } from "@/utils/s3-url"
import { PHILIPPINE_BANKS } from "@/lib/philippine-banks"
import { TaxMonthPicker } from "@/components/tax-month-picker"
import type { CollectorTransaction } from "@/types/collector"
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileImage,
  Loader2,
  Paperclip,
  Upload,
  X,
} from "lucide-react"
import { toast } from "sonner"

interface ConvertCollectorToSaleModalProps {
  transaction: CollectorTransaction | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConverted: () => void
}

type AttachmentCategory = "invoice" | "cheque" | "deposit_slip" | "doc_2307" | "voucher"

const ATTACHMENT_LABELS: Record<AttachmentCategory, string> = {
  invoice: "Invoice",
  cheque: "Cheque",
  deposit_slip: "Deposit Slip",
  doc_2307: "BIR 2307",
  voucher: "Voucher",
}

function formatPHP(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return "—"
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(Number(amount))
}

function getEndOfMonthString(dateStr?: string | null): string {
  const d = dateStr ? new Date(dateStr) : new Date()
  if (Number.isNaN(d.getTime())) {
    const now = new Date()
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return last.toISOString().split("T")[0]
  }
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return last.toISOString().split("T")[0]
}

function generateTaxMonthOptions(): { label: string; value: string }[] {
  const options: { label: string; value: string }[] = []
  const now = new Date()
  for (let i = -18; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 0)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    options.push({ label, value: `${year}-${month}-${day}` })
  }
  return options.reverse()
}

export function ConvertCollectorToSaleModal({
  transaction,
  open,
  onOpenChange,
  onConverted,
}: ConvertCollectorToSaleModalProps) {
  const { user, profile } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [uploadingKey, setUploadingKey] = useState<AttachmentCategory | null>(null)
  const taxMonthOptions = generateTaxMonthOptions()

  const [formData, setFormData] = useState({
    tax_month: "",
    tin: "",
    name: "",
    substreet_street_brgy: "",
    district_city_zip: "",
    tax_type: "vat" as "vat" | "non-vat",
    sale_type: "invoice",
    invoice_number: "",
    pickup_date: "",
    gross_taxable: "",
    total_actual_amount: "",
    net_commission_amount: "",
    project_or_unit_ref: "",
    vat_ewt_notes: "",
    bank_name: "",
    bank_account_no: "",
    date_deposited: "",
    remarks: "",
  })

  const [attachments, setAttachments] = useState<Record<AttachmentCategory, string[]>>({
    invoice: [],
    cheque: [],
    deposit_slip: [],
    doc_2307: [],
    voucher: [],
  })

  useEffect(() => {
    if (!transaction || !open) return

    const defaultTaxMonth = getEndOfMonthString(transaction.invoice_date || transaction.deposit_date)

    const baseAmount =
      transaction.commission_amount ?? transaction.cheque_amount ?? transaction.deposit_amount ?? 0
    const actualAmount =
      transaction.deposit_amount ?? transaction.cheque_amount ?? transaction.commission_amount ?? 0

    const combinedRemarks = [
      transaction.voucher_number ? `Voucher #: ${transaction.voucher_number}` : null,
      transaction.invoice_remarks ? `Invoice: ${transaction.invoice_remarks}` : null,
      transaction.cheque_remarks ? `Cheque: ${transaction.cheque_remarks}` : null,
      transaction.deposit_remarks ? `Deposit: ${transaction.deposit_remarks}` : null,
      transaction.accounting_remarks ? `Accounting: ${transaction.accounting_remarks}` : null,
    ]
      .filter(Boolean)
      .join(" | ")

    setFormData({
      tax_month: defaultTaxMonth,
      tin: transaction.developer_tin || "",
      name: transaction.developer_name || "",
      substreet_street_brgy: transaction.developer_substreet_street_brgy || "",
      district_city_zip: transaction.developer_district_city_zip || "",
      tax_type: "vat",
      sale_type: "invoice",
      invoice_number: "",
      pickup_date:
        transaction.cheque_date_collected ||
        transaction.deposit_date ||
        new Date().toISOString().split("T")[0],
      gross_taxable: baseAmount ? String(baseAmount) : "",
      total_actual_amount: actualAmount ? String(actualAmount) : "",
      net_commission_amount: "",
      project_or_unit_ref: "",
      vat_ewt_notes: "",
      bank_name: transaction.deposit_bank || "",
      bank_account_no: "",
      date_deposited: transaction.deposit_date || "",
      remarks: combinedRemarks,
    })

    setAttachments({
      invoice: transaction.invoice_photo_urls || [],
      cheque: transaction.cheque_photo_urls || [],
      deposit_slip: transaction.deposit_slip_urls || [],
      doc_2307: transaction.doc_2307_photo_urls || [],
      voucher: transaction.voucher_photo_urls || [],
    })
  }, [transaction, open])

  const handleExtraUpload = async (
    category: AttachmentCategory,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploadingKey(category)
    try {
      const uploadedUrls: string[] = []
      const existingCount = attachments[category].length

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const presignedRes = await fetch("/api/get-s3-upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type || "application/octet-stream",
            category: "sales",
            attachmentType: category,
            taxMonth: formData.tax_month || getEndOfMonthString(),
            tin: formData.tin || "collector",
            existingCount: existingCount + i,
          }),
        })

        if (!presignedRes.ok) {
          throw new Error("Failed to get upload URL")
        }

        const { uploadUrl, publicUrl } = await presignedRes.json()
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        })
        if (!putRes.ok) throw new Error("Failed to upload file to S3")

        uploadedUrls.push(formatS3Url(publicUrl))
      }

      setAttachments((prev) => ({
        ...prev,
        [category]: [...prev[category], ...uploadedUrls],
      }))
      toast.success(`Added ${uploadedUrls.length} ${ATTACHMENT_LABELS[category]} file(s)`)
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploadingKey(null)
      e.target.value = ""
    }
  }

  const removeAttachment = (category: AttachmentCategory, index: number) => {
    setAttachments((prev) => ({
      ...prev,
      [category]: prev[category].filter((_, idx) => idx !== index),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transaction || !user) return

    if (!formData.tax_month) {
      toast.error("Please select a Tax Month")
      return
    }
    if (!formData.name.trim()) {
      toast.error("Developer / Taxpayer Name is required")
      return
    }

    setSubmitting(true)
    try {
      // Idempotency guard: re-check live database state before inserting into sales
      const { data: latestTx, error: checkError } = await supabase
        .from("collector_transactions")
        .select("id, workflow_status, sales_id")
        .eq("id", transaction.id)
        .single()

      if (checkError) throw checkError

      if (latestTx.sales_id || latestTx.workflow_status === "converted_to_sale") {
        toast.info("This transaction has already been converted to a Sale.")
        onOpenChange(false)
        onConverted()
        return
      }

      if (latestTx.workflow_status !== "verified") {
        toast.error("Only verified transactions can be converted to a Sale.")
        return
      }

      // Build final remarks including optional accounting-only details
      const extraMetaParts = [
        formData.project_or_unit_ref.trim()
          ? `Project/Unit: ${formData.project_or_unit_ref.trim()}`
          : null,
        formData.net_commission_amount.trim()
          ? `Net Comm: PHP ${Number(formData.net_commission_amount).toLocaleString("en-PH", {
              minimumFractionDigits: 2,
            })}`
          : null,
        formData.vat_ewt_notes.trim() ? `VAT/EWT: ${formData.vat_ewt_notes.trim()}` : null,
        formData.remarks.trim() || null,
      ].filter(Boolean)

      const salesPayload = {
        user_uuid: user.id,
        user_full_name: profile?.full_name || profile?.email || "Accounting",
        tin_id: transaction.developer_tin_id,
        tax_month: formData.tax_month,
        tin: formData.tin.trim() || null,
        name: formData.name.trim(),
        type: "sales",
        substreet_street_brgy: formData.substreet_street_brgy.trim() || null,
        district_city_zip: formData.district_city_zip.trim() || null,
        tax_type: formData.tax_type,
        sale_type: formData.sale_type,
        gross_taxable: formData.gross_taxable ? Number.parseFloat(formData.gross_taxable) : null,
        total_actual_amount: formData.total_actual_amount
          ? Number.parseFloat(formData.total_actual_amount)
          : null,
        invoice_number: formData.invoice_number.trim() || null,
        pickup_date: formData.pickup_date || null,
        bank_name: formData.bank_name.trim() || null,
        bank_account_no: formData.bank_account_no.trim() || null,
        date_deposited: formData.date_deposited || null,
        remarks: extraMetaParts.length > 0 ? extraMetaParts.join(" | ") : null,
        invoice: attachments.invoice.length > 0 ? attachments.invoice : null,
        cheque: attachments.cheque.length > 0 ? attachments.cheque : null,
        deposit_slip: attachments.deposit_slip.length > 0 ? attachments.deposit_slip : null,
        doc_2307: attachments.doc_2307.length > 0 ? attachments.doc_2307 : null,
        voucher: attachments.voucher.length > 0 ? attachments.voucher : null,
      }

      const { data: insertedSale, error: insertError } = await supabase
        .from("sales")
        .insert([salesPayload])
        .select("id")
        .single()

      if (insertError) throw insertError

      // Atomic conditional update: only link if sales_id is still NULL
      const { data: updatedTx, error: updateError } = await supabase
        .from("collector_transactions")
        .update({
          sales_id: insertedSale.id,
          workflow_status: "converted_to_sale",
          cheque_status: "verified",
          converted_to_sale_at: new Date().toISOString(),
        })
        .eq("id", transaction.id)
        .is("sales_id", null)
        .select("id")
        .maybeSingle()

      if (updateError) throw updateError

      if (!updatedTx) {
        // Race condition safeguard: roll back orphaned sale if another tab converted simultaneously
        await supabase.from("sales").delete().eq("id", insertedSale.id)
        toast.info("This transaction was already converted to a Sale in another session.")
        onOpenChange(false)
        onConverted()
        return
      }

      await logNotification(supabase, {
        action: "convert_collector_to_sale",
        description: `Converted verified cheque (Invoice #${formData.invoice_number || "N/A"} - ${formData.name}) to Sales record`,
        user_email: profile?.email || user.email || "",
        user_name: profile?.full_name || profile?.email || "Accounting",
        user_uuid: user.id,
        meta: JSON.stringify({
          collection_id: transaction.id,
          sales_id: insertedSale.id,
          invoice_number: formData.invoice_number,
          developer_name: formData.name,
          gross_taxable: salesPayload.gross_taxable,
          total_actual_amount: salesPayload.total_actual_amount,
        }),
        user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
      })

      toast.success("Successfully converted to Sales with all attachments!")
      onOpenChange(false)
      onConverted()
    } catch (err) {
      console.error("Convert to sale error:", err)
      toast.error(err instanceof Error ? err.message : "Failed to convert to sale")
    } finally {
      setSubmitting(false)
    }
  }

  if (!transaction) return null

  const totalAttachedCount = Object.values(attachments).reduce((sum, arr) => sum + arr.length, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Convert Verified Transaction to Sale
          </DialogTitle>
          <DialogDescription>
            All photos uploaded by the collector ({totalAttachedCount} file
            {totalAttachedCount === 1 ? "" : "s"}) are automatically attached. Fill out the
            accounting-only fields below to create an official Sales record.
          </DialogDescription>
        </DialogHeader>

        {/* Reference Summary from Collector */}
        <div className="rounded-lg border bg-emerald-50/60 border-emerald-200 p-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          <div>
            <div className="text-slate-500">Invoice Date</div>
            <div className="font-semibold text-slate-900">{transaction.invoice_date || "—"}</div>
          </div>
          <div>
            <div className="text-slate-500">Commission</div>
            <div className="font-semibold text-slate-900">
              {formatPHP(transaction.commission_amount)}
            </div>
          </div>
          <div>
            <div className="text-slate-500">Cheque Amt</div>
            <div className="font-semibold text-slate-900">
              {formatPHP(transaction.cheque_amount)}
            </div>
          </div>
          <div>
            <div className="text-slate-500">Deposit Amt</div>
            <div className="font-semibold text-emerald-700">
              {formatPHP(transaction.deposit_amount ?? transaction.cheque_amount)}
            </div>
          </div>
          <div>
            <div className="text-slate-500">Deposit Date</div>
            <div className="font-semibold text-slate-900">{transaction.deposit_date || "—"}</div>
          </div>
        </div>

        {transaction.amount_discrepancy && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            Amount discrepancy was flagged between invoice commission and cheque amount. Double-check
            Gross Taxable and Total Actual Amount below.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Developer / Taxpayer Details */}
          <div className="rounded-lg border bg-slate-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-800">Developer / Taxpayer Details</h4>
              {transaction.developer_tin_id && (
                <Badge
                  variant="outline"
                  className="bg-emerald-50 text-emerald-700 border-emerald-200"
                >
                  Linked to TIN Library
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sale-name">Developer / Registered Name *</Label>
                <Input
                  id="sale-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="sale-tin">TIN Number</Label>
                <Input
                  id="sale-tin"
                  value={formData.tin}
                  onChange={(e) => setFormData({ ...formData, tin: e.target.value })}
                  placeholder="000-000-000-000"
                />
              </div>
              <div>
                <Label htmlFor="sale-brgy">Substreet / Street / Brgy</Label>
                <Input
                  id="sale-brgy"
                  value={formData.substreet_street_brgy}
                  onChange={(e) =>
                    setFormData({ ...formData, substreet_street_brgy: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="sale-city">District / City / Zip</Label>
                <Input
                  id="sale-city"
                  value={formData.district_city_zip}
                  onChange={(e) => setFormData({ ...formData, district_city_zip: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Accounting & Tax Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="sale-invoice-no">Invoice Number</Label>
              <Input
                id="sale-invoice-no"
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                placeholder="e.g. SI-2026-00123"
              />
            </div>

            <div>
              <Label htmlFor="sale-tax-month">Tax Month *</Label>
              <TaxMonthPicker
                id="sale-tax-month"
                value={formData.tax_month}
                onValueChange={(value) => setFormData({ ...formData, tax_month: value })}
                triggerClassName="bg-white text-[#001f3f] border-slate-300"
              />
            </div>

            <div>
              <Label htmlFor="sale-tax-type">Tax Type *</Label>
              <Select
                value={formData.tax_type}
                onValueChange={(value: "vat" | "non-vat") =>
                  setFormData({ ...formData, tax_type: value })
                }
              >
                <SelectTrigger id="sale-tax-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vat">VAT</SelectItem>
                  <SelectItem value="non-vat">Non-VAT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="sale-type">Sale Type *</Label>
              <Select
                value={formData.sale_type}
                onValueChange={(value) => setFormData({ ...formData, sale_type: value })}
              >
                <SelectTrigger id="sale-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="no-invoice">No Invoice</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="sale-pickup-date">Pickup / Collection Date</Label>
              <Input
                id="sale-pickup-date"
                type="date"
                value={formData.pickup_date}
                onChange={(e) => setFormData({ ...formData, pickup_date: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="sale-project-ref">Project / Unit Ref (Optional)</Label>
              <Input
                id="sale-project-ref"
                value={formData.project_or_unit_ref}
                onChange={(e) => setFormData({ ...formData, project_or_unit_ref: e.target.value })}
                placeholder="e.g. Tower B Unit 1402"
              />
            </div>

            <div>
              <Label htmlFor="sale-gross">Gross Taxable Amount (PHP)</Label>
              <Input
                id="sale-gross"
                type="number"
                step="0.01"
                value={formData.gross_taxable}
                onChange={(e) => setFormData({ ...formData, gross_taxable: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="sale-actual">Total Actual Amount (PHP)</Label>
              <Input
                id="sale-actual"
                type="number"
                step="0.01"
                value={formData.total_actual_amount}
                onChange={(e) => setFormData({ ...formData, total_actual_amount: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="sale-net-comm">Net Commission Amount (Optional)</Label>
              <Input
                id="sale-net-comm"
                type="number"
                step="0.01"
                value={formData.net_commission_amount}
                onChange={(e) =>
                  setFormData({ ...formData, net_commission_amount: e.target.value })
                }
                placeholder="Optional net amount"
              />
            </div>

            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t">
              <div>
                <Label htmlFor="conv-bank-name">Bank (Optional)</Label>
                <Select
                  value={
                    PHILIPPINE_BANKS.includes(formData.bank_name as any)
                      ? formData.bank_name
                      : formData.bank_name
                        ? "Other"
                        : "__none__"
                  }
                  onValueChange={(value) =>
                    setFormData({ ...formData, bank_name: value === "__none__" ? "" : value })
                  }
                >
                  <SelectTrigger id="conv-bank-name">
                    <SelectValue placeholder="Select Philippine bank" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="__none__">— None —</SelectItem>
                    {PHILIPPINE_BANKS.map((bank) => (
                      <SelectItem key={bank} value={bank}>
                        {bank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="conv-bank-acct">Bank Account No. (Optional)</Label>
                <Input
                  id="conv-bank-acct"
                  value={formData.bank_account_no}
                  onChange={(e) => setFormData({ ...formData, bank_account_no: e.target.value })}
                  placeholder="Account number"
                />
              </div>
              <div>
                <Label htmlFor="conv-date-deposited">Date Deposited (Optional)</Label>
                <Input
                  id="conv-date-deposited"
                  type="date"
                  value={formData.date_deposited}
                  onChange={(e) => setFormData({ ...formData, date_deposited: e.target.value })}
                />
              </div>
            </div>

            <div className="md:col-span-3">
              <Label htmlFor="sale-vat-ewt">VAT / EWT Breakdown Notes (Optional)</Label>
              <Input
                id="sale-vat-ewt"
                value={formData.vat_ewt_notes}
                onChange={(e) => setFormData({ ...formData, vat_ewt_notes: e.target.value })}
                placeholder="e.g. 12% VAT + 10% EWT per BIR 2307"
              />
            </div>

            <div className="md:col-span-3">
              <Label htmlFor="sale-remarks">Remarks</Label>
              <Textarea
                id="sale-remarks"
                rows={2}
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="Additional accounting notes..."
              />
            </div>
          </div>

          {/* Auto-Attached Files */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-blue-600" />
                Auto-Attached Collector Files ({totalAttachedCount})
              </h4>
              <span className="text-xs text-slate-500">
                Preview, remove, or attach additional documents
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(Object.keys(ATTACHMENT_LABELS) as AttachmentCategory[]).map((category) => {
                const urls = attachments[category]
                return (
                  <div key={category} className="rounded-md border bg-white p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        {ATTACHMENT_LABELS[category]} ({urls.length})
                      </span>
                      <label className="cursor-pointer inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                        {uploadingKey === category ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        Add
                        <input
                          type="file"
                          multiple
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={(e) => handleExtraUpload(category, e)}
                          disabled={uploadingKey !== null}
                        />
                      </label>
                    </div>

                    {urls.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No files attached</p>
                    ) : (
                      <div className="space-y-1.5">
                        {urls.map((url, idx) => (
                          <div
                            key={`${category}-${idx}`}
                            className="flex items-center justify-between gap-2 rounded bg-slate-50 px-2 py-1.5 text-xs"
                          >
                            <a
                              href={formatS3Url(url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-blue-600 hover:underline truncate"
                            >
                              <FileImage className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">
                                {ATTACHMENT_LABELS[category]} #{idx + 1}
                              </span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                            <button
                              type="button"
                              onClick={() => removeAttachment(category, idx)}
                              className="text-slate-400 hover:text-red-600"
                              title="Remove attachment"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || uploadingKey !== null}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Sale...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Save &amp; Convert to Sale
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
