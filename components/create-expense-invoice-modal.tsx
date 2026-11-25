"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { format } from "date-fns"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase/client"
import { logNotification } from "@/utils/logNotification"
import { v4 as uuidv4 } from "uuid"
import { Mail, FileCheck, Eye } from "lucide-react"
import type { ExpenseRequestRecord } from "@/components/add-expense-request-modal"
import {
  ExpenseInvoiceDocument,
  generateExpenseInvoicePdfData,
  type ExpenseInvoiceItem,
  type ExpenseInvoiceRecord,
} from "@/components/expense-invoice-document"

interface CreateExpenseInvoiceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedRequests: ExpenseRequestRecord[]
  categoriesMap: Record<string, string>
  onInvoiceCreated: () => void
}

export function CreateExpenseInvoiceModal({
  open,
  onOpenChange,
  selectedRequests,
  categoriesMap,
  onInvoiceCreated,
}: CreateExpenseInvoiceModalProps) {
  const { profile } = useAuth()
  const [saving, setSaving] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [showPreview, setShowPreview] = useState(true)

  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [dueDate, setDueDate] = useState("")
  const [poNumber, setPoNumber] = useState("")
  const [companyName, setCompanyName] = useState("LEUTERIO REALTY & BROKERAGE")
  const [companyAddress, setCompanyAddress] = useState("Cebu City, Philippines")
  const [companyEmail, setCompanyEmail] = useState("info@filipinohomes.com")
  const [companyPhone, setCompanyPhone] = useState("")
  const [payeeName, setPayeeName] = useState("")
  const [payeeTin, setPayeeTin] = useState("")
  const [payeeSubstreet, setPayeeSubstreet] = useState("")
  const [payeeDistrict, setPayeeDistrict] = useState("")
  const [purpose, setPurpose] = useState("")
  const [notes, setNotes] = useState("")
  const [terms, setTerms] = useState("For Executive Review & Disbursement Approval")
  const [showTaxColumns, setShowTaxColumns] = useState(true)

  useEffect(() => {
    if (!open) return

    const initInvoiceFields = async () => {
      // Generate next invoice number
      const { count } = await supabase
        .from("expense_request_invoices")
        .select("*", { count: "exact", head: true })

      const nextSeq = String((count || 0) + 1).padStart(4, "0")
      setInvoiceNumber(`EXP-${format(new Date(), "yyyyMM")}-${nextSeq}`)
      setInvoiceDate(format(new Date(), "yyyy-MM-dd"))

      if (selectedRequests.length > 0) {
        const first = selectedRequests[0]
        const uniqueNames = Array.from(
          new Set(selectedRequests.map((r) => r.name).filter(Boolean))
        )
        setPayeeName(
          uniqueNames.length === 1
            ? uniqueNames[0]
            : first.name || first.item_name || "Internal Expense Request"
        )
        setPayeeTin(first.tin || "000")
        setPayeeSubstreet(first.substreet_street_brgy || profile?.assigned_area || "Cebu City")
        setPayeeDistrict(first.district_city_zip || profile?.assigned_area || "Cebu City")
        setPurpose(
          `Expense Request for ${selectedRequests.map((r) => r.item_name).join(", ")}`
        )
        // Auto-hide Tax Type & Gross Taxable if all selected items look like budget requests (no Gross Taxable yet)
        const allBudgetRequests = selectedRequests.every(
          (r) => !Number(r.gross_taxable) || Number(r.gross_taxable) === 0
        )
        setShowTaxColumns(!allBudgetRequests)
      }
    }

    initInvoiceFields()
  }, [open, selectedRequests])

  const invoiceItems: ExpenseInvoiceItem[] = selectedRequests.map((req) => {
    const amt = Number(req.total_actual_amount ?? req.amount ?? req.gross_taxable ?? 0)
    const gross = Number(req.gross_taxable ?? amt)
    let rawReceipts: string[] = []
    if (Array.isArray(req.official_receipt)) {
      rawReceipts = req.official_receipt
    } else if (typeof req.official_receipt === "string" && req.official_receipt.trim() !== "") {
      try {
        const parsed = JSON.parse(req.official_receipt)
        rawReceipts = Array.isArray(parsed) ? parsed : [req.official_receipt]
      } catch {
        rawReceipts = [req.official_receipt]
      }
    }

    return {
      expense_request_id: req.id,
      item_name: req.item_name || req.name || "Expense Item",
      description: req.item_name || req.name || "",
      tin: req.tin || "",
      supplier_name: req.name || "",
      substreet_street_brgy: req.substreet_street_brgy || "",
      district_city_zip: req.district_city_zip || "",
      tax_type: req.tax_type || "non-vat",
      tax_month: req.tax_month,
      category_id: req.category_id || "",
      category_name: req.category_id ? categoriesMap[req.category_id] || "General" : "General",
      invoice_number: req.invoice_number || "0",
      quantity: 1,
      rate: amt,
      amount: amt,
      gross_taxable: gross,
      total_actual_amount: amt,
      official_receipt: rawReceipts,
    }
  })

  const subtotal = invoiceItems.reduce((sum, it) => sum + (Number(it.amount) || 0), 0)
  const total = subtotal

  const previewRecord: ExpenseInvoiceRecord = {
    invoice_number: invoiceNumber || "EXP-0001",
    invoice_date: invoiceDate,
    due_date: dueDate || null,
    payment_terms: showTaxColumns ? null : "hide_tax_columns",
    po_number: poNumber || null,
    company_name: companyName,
    company_address: companyAddress,
    company_email: companyEmail,
    company_phone: companyPhone,
    requested_by_uuid: profile?.auth_user_id || profile?.id || null,
    requested_by_name: profile?.full_name || "Accounting / Secretary",
    requested_by_email: profile?.email || null,
    assigned_area: profile?.assigned_area || "Cebu",
    payee_name: payeeName,
    payee_tin: payeeTin,
    payee_substreet_street_brgy: payeeSubstreet,
    payee_district_city_zip: payeeDistrict,
    purpose,
    notes,
    terms,
    items: invoiceItems,
    expense_request_ids: selectedRequests.map((r) => r.id),
    subtotal,
    total,
    currency: "PHP",
    status: "pending_approval",
    approved_by_name: "ANTHONY GERARD LEUTERIO",
    approved_by_email: "mindworth@gmail.com",
  }

  const handleCreateInvoice = async (shouldSendEmail: boolean) => {
    if (selectedRequests.length === 0) return

    if (shouldSendEmail) {
      setSendingEmail(true)
    } else {
      setSaving(true)
    }

    try {
      const approvalToken = uuidv4().replace(/-/g, "") + uuidv4().replace(/-/g, "")
      const requestIds = selectedRequests.map((r) => r.id)

      const insertPayload = {
        invoice_number: invoiceNumber.trim() || `EXP-${Date.now()}`,
        invoice_date: invoiceDate || format(new Date(), "yyyy-MM-dd"),
        due_date: dueDate || null,
        payment_terms: showTaxColumns ? null : "hide_tax_columns",
        po_number: poNumber || null,
        company_name: companyName,
        company_address: companyAddress,
        company_email: companyEmail,
        company_phone: companyPhone || null,
        requested_by_uuid: profile?.auth_user_id || profile?.id || null,
        requested_by_name: profile?.full_name || "Accounting / Secretary",
        requested_by_email: profile?.email || null,
        assigned_area: profile?.assigned_area || "Cebu",
        payee_name: payeeName || null,
        payee_tin: payeeTin || null,
        payee_substreet_street_brgy: payeeSubstreet || null,
        payee_district_city_zip: payeeDistrict || null,
        purpose: purpose || null,
        notes: notes || null,
        terms: terms || null,
        items: invoiceItems,
        expense_request_ids: requestIds,
        subtotal,
        total,
        currency: "PHP",
        status: "pending_approval",
        approval_token: approvalToken,
        approved_by_name: "ANTHONY GERARD LEUTERIO",
        approved_by_email: "mindworth@gmail.com",
      }

      const { data: createdInvoice, error: createError } = await supabase
        .from("expense_request_invoices")
        .insert([insertPayload])
        .select("*")
        .single()

      if (createError || !createdInvoice) {
        throw new Error(createError?.message || "Failed to save expense invoice")
      }

      // Link all selected expense_requests to this invoice
      const { error: linkError } = await supabase
        .from("expense_requests")
        .update({
          status: "invoiced",
          expense_invoice_id: createdInvoice.id,
          expense_invoice_number: createdInvoice.invoice_number,
          updated_at: new Date().toISOString(),
        })
        .in("id", requestIds)

      if (linkError) throw linkError

      // Log notification (non-blocking)
      if (profile?.id) {
        try {
          await logNotification(supabase, {
            action: "expense_invoice_created",
            description: `Expense Invoice #${createdInvoice.invoice_number} (₱${total.toLocaleString()}) created from ${requestIds.length} itemized record(s)`,
            ip_address: null,
            location: null,
            meta: JSON.stringify({
              invoice_id: createdInvoice.id,
              invoice_number: createdInvoice.invoice_number,
              total,
              item_count: requestIds.length,
            }),
            user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
            user_email: profile.email,
            user_name: profile.full_name || profile.first_name || profile.id,
            user_uuid: profile.id,
          })
        } catch (notifErr) {
          console.warn("Non-blocking notification log error:", notifErr)
        }
      }

      if (shouldSendEmail) {
        let pdfUrl = ""
        let pdfBase64 = ""
        const docEl = document.getElementById("create-expense-invoice-preview-doc")
        if (docEl) {
          try {
            const pdfData = await generateExpenseInvoicePdfData(docEl)
            // Upload PDF directly to S3 to avoid Vercel 4.5MB 413 payload limit
            try {
              const presignedRes = await fetch("/api/get-s3-upload-url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  fileName: `Expense-Voucher-${createdInvoice.invoice_number}.pdf`,
                  fileType: "application/pdf",
                  category: "expense-invoice",
                  reportNumber: createdInvoice.invoice_number,
                }),
              })
              if (presignedRes.ok) {
                const { uploadUrl, publicUrl } = await presignedRes.json()
                const putRes = await fetch(uploadUrl, {
                  method: "PUT",
                  headers: { "Content-Type": "application/pdf" },
                  body: pdfData.blob,
                })
                if (putRes.ok) {
                  pdfUrl = publicUrl
                }
              }
            } catch (s3Err) {
              console.warn("S3 PDF upload fallback to base64:", s3Err)
            }

            if (!pdfUrl && pdfData.base64 && pdfData.base64.length < 3_000_000) {
              pdfBase64 = pdfData.base64
            }
          } catch (pdfErr) {
            console.warn("Could not generate PDF attachment, sending HTML email:", pdfErr)
          }
        }

        const emailRes = await fetch("/api/send-expense-invoice-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invoiceId: createdInvoice.id,
            pdfUrl: pdfUrl || undefined,
            pdfBase64: pdfBase64 || undefined,
            baseUrl: typeof window !== "undefined" ? window.location.origin : undefined,
          }),
        })

        const rawText = await emailRes.text()
        let emailData: any = {}
        try {
          emailData = rawText ? JSON.parse(rawText) : {}
        } catch {
          emailData = { error: rawText || `HTTP ${emailRes.status}` }
        }
        if (!emailRes.ok) {
          alert(
            `Expense Voucher #${createdInvoice.invoice_number} was created, but sending email encountered an error: ${emailData.error || "Unknown error"}`
          )
        } else {
          alert(
            `Expense Voucher #${createdInvoice.invoice_number} created and sent via email to ${emailData.sentTo} for signature approval!`
          )
        }
      } else {
        alert(
          `Expense Voucher #${createdInvoice.invoice_number} created! It is now visible on Anthony Leuterio's exclusive approval dashboard.`
        )
      }

      onOpenChange(false)
      onInvoiceCreated()
    } catch (error: any) {
      console.error("Error creating expense invoice:", error)
      alert("Error creating expense invoice: " + (error?.message || "Please try again."))
    } finally {
      setSaving(false)
      setSendingEmail(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[94vh] overflow-y-auto bg-white text-[#001f3f]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#001f3f]">
            Create Expense Voucher ({selectedRequests.length} Selected Item{selectedRequests.length === 1 ? "" : "s"})
          </DialogTitle>
          <p className="text-sm text-slate-600">
            Bundle the selected itemized expense requests into an official expense voucher for signature approval by Sir Anthony Leuterio (<strong>mindworth@gmail.com</strong>).
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Editable Voucher Meta Form */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#001f3f]">Voucher Number *</Label>
              <Input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="bg-white text-[#001f3f] border-slate-300 font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#001f3f]">Voucher Date *</Label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="bg-white text-[#001f3f] border-slate-300"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#001f3f]">Payee / Vendor Name</Label>
              <Input
                value={payeeName}
                onChange={(e) => setPayeeName(e.target.value)}
                placeholder="Payee or Vendor Name"
                className="bg-white text-[#001f3f] border-slate-300"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#001f3f]">Reference / PO # (Optional)</Label>
              <Input
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="Optional Ref #"
                className="bg-white text-[#001f3f] border-slate-300"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold text-[#001f3f]">Purpose / Summary</Label>
              <Input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Purpose of expense request..."
                className="bg-white text-[#001f3f] border-slate-300"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold text-[#001f3f]">Additional Notes / Disbursement Instructions</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes or bank transfer details..."
                className="bg-white text-[#001f3f] border-slate-300"
              />
            </div>

            <div className="md:col-span-4 flex items-center justify-between gap-3 pt-2 border-t border-slate-200">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showTaxColumns}
                  onChange={(e) => setShowTaxColumns(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-400 text-[#001f3f] focus:ring-[#0284c7] cursor-pointer"
                />
                <span className="text-xs font-semibold text-[#001f3f]">
                  Show Tax Type &amp; Gross Taxable columns on Voucher
                </span>
              </label>
              <span className="text-[11px] text-slate-500">
                Uncheck for budget requests without Official Receipts yet (hides NON-VAT &amp; ₱0.00 columns)
              </span>
            </div>
          </div>

          {/* Live Professional Invoice Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-[#0284c7]" />
                Live Professional Voucher &amp; PDF Preview
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs text-[#0284c7]"
              >
                {showPreview ? "Hide Preview" : "Show Preview"}
              </Button>
            </div>

            <div className={showPreview ? "bg-slate-100 p-4 rounded-xl border border-slate-200 overflow-x-auto" : "sr-only"}>
              <ExpenseInvoiceDocument
                invoice={previewRecord}
                containerId="create-expense-invoice-preview-doc"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t">
            <div className="text-xs text-slate-500">
              Email recipient is set exclusively to <strong>mindworth@gmail.com</strong> (and visible in <strong>mindworth@gmail.com</strong> dashboard).
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving || sendingEmail}
                className="border-slate-300 text-slate-700 bg-white"
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => handleCreateInvoice(false)}
                disabled={saving || sendingEmail}
                className="border-[#001f3f] text-[#001f3f] hover:bg-slate-100 bg-white font-semibold"
              >
                <FileCheck className="w-4 h-4 mr-2" />
                {saving ? "Saving Voucher..." : "Create Voucher Only"}
              </Button>

              <Button
                type="button"
                onClick={() => handleCreateInvoice(true)}
                disabled={saving || sendingEmail}
                className="bg-gradient-to-r from-[#001f3f] to-[#0284c7] hover:opacity-95 text-white font-semibold shadow-md"
              >
                <Mail className="w-4 h-4 mr-2" />
                {sendingEmail
                  ? "Creating & Sending Email..."
                  : "Create Voucher & Send Email (mindworth@gmail.com)"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
