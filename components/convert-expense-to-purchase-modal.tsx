"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase/client"
import { logNotification } from "@/utils/logNotification"
import { Upload, X, CheckCircle2, FileText, ArrowRightLeft } from "lucide-react"
import { formatS3Url } from "@/utils/s3-url"
import type { ExpenseRequestRecord } from "@/components/add-expense-request-modal"
import {
  ExpenseInvoiceDocument,
  generateExpenseInvoicePdfData,
  type ExpenseInvoiceRecord,
} from "@/components/expense-invoice-document"

interface ConvertExpenseToPurchaseModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: ExpenseInvoiceRecord | null
  linkedRequests: ExpenseRequestRecord[]
  onConverted: () => void
}

interface TaxMonthOption {
  label: string
  value: string
}

interface TaxpayerSuggestion {
  id?: string
  tin: string
  registered_name: string
  substreet_street_brgy: string
  district_city_zip: string
}

export function ConvertExpenseToPurchaseModal({
  open,
  onOpenChange,
  invoice,
  linkedRequests,
  onConverted,
}: ConvertExpenseToPurchaseModalProps) {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [attachSignedPdf, setAttachSignedPdf] = useState(true)
  const [isPayeeNotApplicable, setIsPayeeNotApplicable] = useState(false)

  const [formData, setFormData] = useState({
    tin: "",
    name: "",
    substreet_street_brgy: "",
    district_city_zip: "",
    tax_type: "non-vat",
    gross_taxable: "",
    total_actual_amount: "",
    invoice_number: "",
    tax_month: "",
    remarks: "",
  })

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("")
  const [categories, setCategories] = useState<{ id: string; category: string }[]>([])

  const [taxpayerSuggestions, setTaxpayerSuggestions] = useState<TaxpayerSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [nameSuggestions, setNameSuggestions] = useState<TaxpayerSuggestion[]>([])
  const [showNameSuggestions, setShowNameSuggestions] = useState(false)

  const [officialReceiptFiles, setOfficialReceiptFiles] = useState<{ name: string; url: string }[]>([])
  const [officialReceiptUploading, setOfficialReceiptUploading] = useState(false)

  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from("purchases_categories")
        .select("id, category")
        .eq("is_deleted", false)
        .order("category", { ascending: true })
      if (!error && data) setCategories(data)
    }
    fetchCategories()
  }, [])

  const generateTaxMonthOptions = (): TaxMonthOption[] => {
    const options: TaxMonthOption[] = []
    const currentDate = new Date()

    for (let i = 0; i < 36; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
      const year = date.getFullYear()
      const month = date.getMonth()
      const lastDay = new Date(year, month + 1, 0).getDate()
      const monthName = date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      const value = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
      options.push({ label: monthName, value })
    }
    return options
  }

  const taxMonthOptions = generateTaxMonthOptions()

  const formatTinInput = (value: string): string => {
    const digits = (value || "").replace(/\D/g, "")
    return digits.replace(/(\d{3})(?=\d)/g, "$1-")
  }

  const formatNumberWithCommas = (value: string): string => {
    if (!value) return ""
    const numericValue = value.replace(/,/g, "")
    if (isNaN(Number(numericValue))) return value
    const parts = numericValue.split(".")
    const integerPart = parts[0]
    const decimalPart = parts[1]
    const formattedInteger = Number(integerPart).toLocaleString()
    return decimalPart !== undefined ? `${formattedInteger}.${decimalPart}` : formattedInteger
  }

  // Initialize form from the approved invoice + linked requests
  useEffect(() => {
    if (!open || !invoice) return

    const items = Array.isArray(invoice.items) ? invoice.items : []
    const firstReq = linkedRequests[0]
    const firstItem = items[0]

    const totalGross =
      linkedRequests.length > 0
        ? linkedRequests.reduce((s, r) => s + (Number(r.gross_taxable) || Number(r.amount) || 0), 0)
        : items.reduce((s, it) => s + (Number(it.gross_taxable) || Number(it.amount) || 0), 0) ||
          Number(invoice.total) ||
          0

    const totalActual =
      linkedRequests.length > 0
        ? linkedRequests.reduce(
            (s, r) => s + (Number(r.total_actual_amount ?? r.amount ?? r.gross_taxable) || 0),
            0
          )
        : Number(invoice.total) || totalGross

    const defaultTaxMonth =
      firstReq?.tax_month ||
      firstItem?.tax_month ||
      taxMonthOptions[0]?.value ||
      format(new Date(), "yyyy-MM-dd")

    const rawTin = invoice.payee_tin || firstReq?.tin || firstItem?.tin || "000"
    const isNoCompany = rawTin === "000" || rawTin === "0"
    setIsPayeeNotApplicable(isNoCompany)
    const defaultTin = isNoCompany ? "000" : rawTin
    const defaultName =
      invoice.payee_name ||
      firstReq?.name ||
      firstItem?.supplier_name ||
      firstItem?.item_name ||
      "Approved Expense"

    const defaultSubstreet =
      invoice.payee_substreet_street_brgy ||
      firstReq?.substreet_street_brgy ||
      firstItem?.substreet_street_brgy ||
      profile?.assigned_area ||
      "Cebu City"

    const defaultDistrict =
      invoice.payee_district_city_zip ||
      firstReq?.district_city_zip ||
      firstItem?.district_city_zip ||
      profile?.assigned_area ||
      "Cebu City"

    const defaultTaxType = firstReq?.tax_type || firstItem?.tax_type || "non-vat"
    const defaultCategory =
      firstReq?.category_id || firstItem?.category_id || categories[0]?.id || ""

    const itemizedSummaryText = items
      .map(
        (it) =>
          `${it.item_name}: ₱${Number(it.amount ?? it.total_actual_amount ?? 0).toLocaleString()}`
      )
      .join(", ")

    const signedDateStr = invoice.signed_at
      ? format(new Date(invoice.signed_at), "MMM dd, yyyy hh:mm a")
      : "Approved"

    const autoRemark = `Converted from Approved Expense Invoice #${invoice.invoice_number} (Signed by ${
      invoice.approved_by_name || "ANTHONY GERARD LEUTERIO"
    } on ${signedDateStr}). Items: ${itemizedSummaryText}`

    setFormData({
      tin: formatTinInput(defaultTin),
      name: defaultName,
      substreet_street_brgy: defaultSubstreet,
      district_city_zip: defaultDistrict,
      tax_type: defaultTaxType,
      gross_taxable: formatNumberWithCommas(totalGross.toFixed(2).replace(/\.00$/, "")),
      total_actual_amount: formatNumberWithCommas(totalActual.toFixed(2).replace(/\.00$/, "")),
      invoice_number: invoice.invoice_number,
      tax_month: defaultTaxMonth,
      remarks: autoRemark,
    })

    setSelectedCategoryId(defaultCategory)

    // Gather existing receipt URLs from linked requests & items
    const receiptUrls = new Set<string>()
    if (invoice.signed_pdf_url) {
      receiptUrls.add(formatS3Url(invoice.signed_pdf_url))
    }
    linkedRequests.forEach((req) => {
      if (Array.isArray(req.official_receipt)) {
        req.official_receipt.filter(Boolean).forEach((u: string) => receiptUrls.add(formatS3Url(u)))
      } else if (typeof req.official_receipt === "string" && req.official_receipt.trim() !== "") {
        try {
          const parsed = JSON.parse(req.official_receipt)
          if (Array.isArray(parsed)) {
            parsed.filter(Boolean).forEach((u: string) => receiptUrls.add(formatS3Url(u)))
          }
        } catch {
          receiptUrls.add(formatS3Url(req.official_receipt))
        }
      }
    })
    items.forEach((it) => {
      if (Array.isArray(it.official_receipt)) {
        it.official_receipt.filter(Boolean).forEach((u: string) => receiptUrls.add(formatS3Url(u)))
      }
    })

    setOfficialReceiptFiles(
      Array.from(receiptUrls).map((url) => ({
        name: decodeURIComponent(url.split("/").pop() || "Attachment"),
        url,
      }))
    )
  }, [open, invoice, linkedRequests, categories.length])

  const searchTaxpayers = async (tinPrefix: string) => {
    if (tinPrefix.length < 3) {
      setTaxpayerSuggestions([])
      setShowSuggestions(false)
      return
    }
    try {
      const { data } = await supabase
        .from("taxpayer_listings")
        .select("id, tin, registered_name, substreet_street_brgy, district_city_zip")
        .eq("type", "purchases")
        .ilike("tin", `${tinPrefix}%`)
        .limit(5)
      setTaxpayerSuggestions(data || [])
      setShowSuggestions(Boolean(data && data.length > 0))
    } catch {
      setTaxpayerSuggestions([])
      setShowSuggestions(false)
    }
  }

  const searchTaxpayersByName = async (namePrefix: string) => {
    if (namePrefix.length < 3) {
      setNameSuggestions([])
      setShowNameSuggestions(false)
      return
    }
    try {
      const { data } = await supabase
        .from("taxpayer_listings")
        .select("id, tin, registered_name, substreet_street_brgy, district_city_zip")
        .eq("type", "purchases")
        .ilike("registered_name", `%${namePrefix}%`)
        .limit(5)
      setNameSuggestions(data || [])
      setShowNameSuggestions(Boolean(data && data.length > 0))
    } catch {
      setNameSuggestions([])
      setShowNameSuggestions(false)
    }
  }

  const handleSuggestionSelect = (s: TaxpayerSuggestion) => {
    setFormData({
      ...formData,
      tin: formatTinInput(s.tin),
      name: s.registered_name,
      substreet_street_brgy: s.substreet_street_brgy || formData.substreet_street_brgy,
      district_city_zip: s.district_city_zip || formData.district_city_zip,
    })
    setShowSuggestions(false)
    setShowNameSuggestions(false)
  }

  const handleOfficialReceiptUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setOfficialReceiptUploading(true)
    try {
      const fileList = Array.from(files)
      const uploaded: { name: string; url: string }[] = []

      for (const file of fileList) {
        const presignedRes = await fetch("/api/get-s3-upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type || "application/octet-stream",
            category: "purchases",
            tinName: formData.name || "Expense",
            tinNumber: formData.tin.replace(/[^0-9]/g, "") || "0",
            assignedArea: profile?.assigned_area || "Cebu",
            userFullName: profile?.full_name || "User",
          }),
        })

        if (!presignedRes.ok) throw new Error("Failed to get S3 upload URL")
        const { uploadUrl, publicUrl, fileName } = await presignedRes.json()

        const s3Res = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        })
        if (!s3Res.ok) throw new Error("S3 upload failed")

        uploaded.push({
          name: fileName,
          url: formatS3Url(publicUrl),
        })
      }

      setOfficialReceiptFiles((prev) => [...prev, ...uploaded])
    } catch (err: any) {
      alert("Error uploading file: " + (err?.message || "Upload failed"))
    } finally {
      setOfficialReceiptUploading(false)
    }
  }

  const getOrCreateTaxpayerListing = async (tinData: {
    tin: string
    name: string
    substreet_street_brgy: string
    district_city_zip: string
  }) => {
    const cleanTin = tinData.tin.replace(/[^0-9]/g, "") || "0"
    const { data: existing } = await supabase
      .from("taxpayer_listings")
      .select("id")
      .eq("tin", cleanTin)
      .eq("type", "purchases")
      .limit(1)
      .maybeSingle()

    if (existing?.id) return existing.id

    const { data: created, error } = await supabase
      .from("taxpayer_listings")
      .insert([
        {
          tin: cleanTin,
          registered_name: tinData.name,
          substreet_street_brgy: tinData.substreet_street_brgy,
          district_city_zip: tinData.district_city_zip,
          type: "purchases",
          date_added: format(new Date(), "yyyy-MM-dd"),
          user_uuid: profile?.auth_user_id || null,
        },
      ])
      .select("id")
      .single()

    if (error) throw error
    return created.id
  }

  const handleConvertSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invoice) return
    setLoading(true)

    try {
      const finalReceipts = [...officialReceiptFiles.map((f) => f.url)]

      // Auto-generate and upload the signed Expense Invoice PDF to S3 if enabled
      if (attachSignedPdf) {
        const docEl = document.getElementById("convert-modal-hidden-invoice-doc")
        if (docEl) {
          try {
            const { blob } = await generateExpenseInvoicePdfData(docEl)
            const pdfFileName = `Signed_Expense_Invoice_${invoice.invoice_number}.pdf`
            const presignedRes = await fetch("/api/get-s3-upload-url", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fileName: pdfFileName,
                fileType: "application/pdf",
                category: "purchases",
                tinName: formData.name || "ExpenseInvoice",
                tinNumber: formData.tin.replace(/[^0-9]/g, "") || "0",
                assignedArea: invoice.assigned_area || profile?.assigned_area || "Cebu",
                userFullName: profile?.full_name || invoice.requested_by_name || "Accounting",
              }),
            })

            if (presignedRes.ok) {
              const { uploadUrl, publicUrl } = await presignedRes.json()
              const putRes = await fetch(uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": "application/pdf" },
                body: blob,
              })
              if (putRes.ok) {
                const formattedPdfUrl = formatS3Url(publicUrl)
                if (!finalReceipts.includes(formattedPdfUrl)) {
                  finalReceipts.unshift(formattedPdfUrl)
                }
              }
            }
          } catch (pdfUploadErr) {
            console.warn("Could not auto-upload signed invoice PDF to S3:", pdfUploadErr)
          }
        }
      }

      const cleanTin = isPayeeNotApplicable
        ? "000"
        : formData.tin.replace(/[^0-9]/g, "") || "000"

      const taxpayerListingId = await getOrCreateTaxpayerListing({
        tin: cleanTin,
        name: formData.name,
        substreet_street_brgy: formData.substreet_street_brgy || "N/A",
        district_city_zip: formData.district_city_zip || "N/A",
      })
      const structuredRemarks = formData.remarks.trim()
        ? JSON.stringify([
            {
              remark: formData.remarks.trim(),
              name: profile?.full_name || "Accounting",
              uuid: profile?.id || null,
              date: new Date().toISOString(),
            },
          ])
        : null

      // Insert 1 combined record into public.purchases
      const purchaseData = {
        tax_month: formData.tax_month,
        tin_id: taxpayerListingId,
        tin: cleanTin,
        name: formData.name,
        substreet_street_brgy: formData.substreet_street_brgy || null,
        district_city_zip: formData.district_city_zip || null,
        gross_taxable: Number.parseFloat(formData.gross_taxable.replace(/,/g, "")) || 0,
        total_actual_amount: Number.parseFloat(formData.total_actual_amount.replace(/,/g, "")) || 0,
        category_id: selectedCategoryId || null,
        invoice_number: formData.invoice_number || invoice.invoice_number || null,
        tax_type: formData.tax_type,
        official_receipt: finalReceipts,
        date_added: format(new Date(), "yyyy-MM-dd"),
        user_uuid: invoice.requested_by_uuid || profile?.auth_user_id || null,
        user_full_name: invoice.requested_by_name || profile?.full_name || null,
        remarks: structuredRemarks,
      }

      const { data: newPurchase, error: purchaseError } = await supabase
        .from("purchases")
        .insert([purchaseData])
        .select("*")
        .single()

      if (purchaseError || !newPurchase) {
        throw new Error(purchaseError?.message || "Failed to insert consolidated purchase record")
      }

      const now = new Date().toISOString()

      // Mark invoice as converted
      if (invoice.id) {
        await supabase
          .from("expense_request_invoices")
          .update({
            status: "converted",
            converted_purchase_id: newPurchase.id,
            converted_at: now,
            converted_by_uuid: profile?.id || null,
            converted_by_name: profile?.full_name || null,
            signed_pdf_url: finalReceipts[0] || invoice.signed_pdf_url || null,
            updated_at: now,
          })
          .eq("id", invoice.id)

        // Mark all linked expense_requests as converted
        await supabase
          .from("expense_requests")
          .update({
            status: "converted",
            converted_purchase_id: newPurchase.id,
            converted_at: now,
            converted_by_name: profile?.full_name || null,
            updated_at: now,
          })
          .eq("expense_invoice_id", invoice.id)
      }

      if (linkedRequests.length > 0) {
        await supabase
          .from("expense_requests")
          .update({
            status: "converted",
            converted_purchase_id: newPurchase.id,
            converted_at: now,
            converted_by_name: profile?.full_name || null,
            updated_at: now,
          })
          .in(
            "id",
            linkedRequests.map((r) => r.id)
          )
      }

      if (profile?.id) {
        await logNotification(supabase, {
          action: "expense_converted_to_purchase",
          description: `Approved Expense Invoice #${invoice.invoice_number} converted into 1 Purchase record for ${formData.name} (₱${formData.total_actual_amount})`,
          ip_address: null,
          location: null,
          meta: JSON.stringify({
            purchase_id: newPurchase.id,
            invoice_id: invoice.id,
            invoice_number: invoice.invoice_number,
            amount: formData.total_actual_amount,
          }),
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
          user_email: profile.email,
          user_name: profile.full_name || profile.first_name || profile.id,
          user_uuid: profile.id,
        })
      }

      alert(
        `Success! Approved Expense Invoice #${invoice.invoice_number} has been converted into 1 consolidated Purchase record in the Purchases page.`
      )
      onOpenChange(false)
      onConverted()
    } catch (error: any) {
      console.error("Error converting expense to purchase:", error)
      alert("Error converting to purchase record: " + (error?.message || "Please try again."))
    } finally {
      setLoading(false)
    }
  }

  if (!invoice) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto bg-white text-[#001f3f]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold text-[#001f3f] flex items-center gap-2">
              <ArrowRightLeft className="w-6 h-6 text-emerald-600" />
              Convert Approved Invoice to Purchases Record
            </DialogTitle>
            <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Signed &amp; Approved
            </Badge>
          </div>
          <p className="text-sm text-slate-600">
            This will consolidate the{" "}
            <strong>{(invoice.items || []).length} approved itemized record(s)</strong> from Invoice{" "}
            <strong>#{invoice.invoice_number}</strong> into <strong>one (1) Purchase Record</strong> in the Purchases page.
          </p>
        </DialogHeader>

        {/* Itemized Summary Banner */}
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900">
            <div>
              <strong>Approved By:</strong> {invoice.approved_by_name || "ANTHONY GERARD LEUTERIO"}
            </div>
            {invoice.signed_at && (
              <div>
                <strong>Signed Date:</strong>{" "}
                {format(new Date(invoice.signed_at), "MMMM dd, yyyy hh:mm a")}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {(invoice.items || []).map((item, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 bg-white border border-emerald-200 px-2.5 py-1 rounded-md text-xs font-medium text-slate-800"
              >
                <span>{item.item_name}:</span>
                <strong className="text-emerald-700">
                  ₱{Number(item.amount ?? item.total_actual_amount ?? 0).toLocaleString()}
                </strong>
              </span>
            ))}
          </div>
        </div>

        <form onSubmit={handleConvertSubmit} className="space-y-5">
          {/* First Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#001f3f]">Tax Month *</Label>
              <Select
                value={formData.tax_month}
                onValueChange={(value) => setFormData({ ...formData, tax_month: value })}
                required
              >
                <SelectTrigger className="bg-white text-[#001f3f] border-[#001f3f]">
                  <SelectValue placeholder="Select tax month..." />
                </SelectTrigger>
                <SelectContent>
                  {taxMonthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#001f3f]">Tax Type *</Label>
              <Select
                value={formData.tax_type}
                onValueChange={(value) => setFormData({ ...formData, tax_type: value })}
                required
              >
                <SelectTrigger className="bg-white text-[#001f3f] border-[#001f3f]">
                  <SelectValue placeholder="Select tax type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vat">VAT</SelectItem>
                  <SelectItem value="non-vat">Non-VAT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#001f3f]">Invoice Number *</Label>
              <Input
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                placeholder="Invoice number"
                required
                className="bg-white text-[#001f3f] border-[#001f3f]"
              />
            </div>
          </div>

          {/* TIN & Name */}
          <div className="flex items-center justify-between bg-slate-100 px-3.5 py-2.5 rounded-lg border border-slate-200">
            <span className="text-xs font-bold uppercase tracking-wider text-[#001f3f]">
              Payee / Company Accreditation
            </span>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#001f3f]">
              <input
                type="checkbox"
                checked={isPayeeNotApplicable}
                onChange={(e) => {
                  const checked = e.target.checked
                  setIsPayeeNotApplicable(checked)
                  if (checked) {
                    setFormData((prev) => ({
                      ...prev,
                      tin: "000",
                      tax_type: "non-vat",
                      substreet_street_brgy: prev.substreet_street_brgy || profile?.assigned_area || "N/A",
                      district_city_zip: prev.district_city_zip || profile?.assigned_area || "N/A",
                    }))
                  }
                }}
                className="rounded border-slate-300 text-[#0284c7]"
              />
              Not Applicable (No Company / Auto-set TIN to <code className="bg-amber-100 text-amber-900 px-1 py-0.5 rounded font-mono">000</code>)
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 relative">
              <Label className="text-sm font-medium text-[#001f3f]">TIN *</Label>
              <Input
                value={isPayeeNotApplicable ? "000" : formData.tin}
                disabled={isPayeeNotApplicable}
                onChange={(e) => {
                  const formatted = formatTinInput(e.target.value)
                  setFormData({ ...formData, tin: formatted })
                  const clean = e.target.value.replace(/[^0-9]/g, "")
                  if (clean.length >= 3) searchTaxpayers(clean.substring(0, 3))
                  else setShowSuggestions(false)
                }}
                placeholder="000-000-000-000"
                required
                className="bg-white text-[#001f3f] border-[#001f3f] disabled:bg-slate-100 disabled:font-bold"
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              />
              {showSuggestions && taxpayerSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 bg-white border border-[#001f3f] rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {taxpayerSuggestions.map((s, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                      onClick={() => handleSuggestionSelect(s)}
                    >
                      <div className="font-medium text-sm">{formatTinInput(s.tin)}</div>
                      <div className="text-xs text-slate-600">{s.registered_name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2 relative">
              <Label className="text-sm font-medium text-[#001f3f]">Name (Payee / Supplier) *</Label>
              <Input
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value })
                  if (e.target.value.length >= 3) searchTaxpayersByName(e.target.value)
                  else setShowNameSuggestions(false)
                }}
                placeholder="Company / Individual name"
                required
                className="bg-white text-[#001f3f] border-[#001f3f]"
                onBlur={() => setTimeout(() => setShowNameSuggestions(false), 200)}
              />
              {showNameSuggestions && nameSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 bg-white border border-[#001f3f] rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {nameSuggestions.map((s, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                      onClick={() => handleSuggestionSelect(s)}
                    >
                      <div className="font-medium text-sm">{s.registered_name}</div>
                      <div className="text-xs text-slate-600">{formatTinInput(s.tin)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#001f3f]">Substreet/Street/Barangay *</Label>
              <Input
                value={formData.substreet_street_brgy}
                onChange={(e) => setFormData({ ...formData, substreet_street_brgy: e.target.value })}
                required
                className="bg-white text-[#001f3f] border-[#001f3f]"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#001f3f]">District/City/ZIP *</Label>
              <Input
                value={formData.district_city_zip}
                onChange={(e) => setFormData({ ...formData, district_city_zip: e.target.value })}
                required
                className="bg-white text-[#001f3f] border-[#001f3f]"
              />
            </div>
          </div>

          {/* Amounts & Category */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#001f3f]">Combined Gross Taxable *</Label>
              <Input
                value={formData.gross_taxable}
                onChange={(e) => {
                  const raw = e.target.value.replace(/,/g, "")
                  if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
                    setFormData({ ...formData, gross_taxable: formatNumberWithCommas(raw) })
                  }
                }}
                required
                className="bg-white text-[#001f3f] border-[#001f3f] font-bold"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#001f3f]">Combined Total Actual Amount *</Label>
              <Input
                value={formData.total_actual_amount}
                onChange={(e) => {
                  const raw = e.target.value.replace(/,/g, "")
                  if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
                    setFormData({ ...formData, total_actual_amount: formatNumberWithCommas(raw) })
                  }
                }}
                required
                className="bg-white text-[#001f3f] border-[#001f3f] font-bold"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#001f3f]">Purchase Category *</Label>
              <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId} required>
                <SelectTrigger className="bg-white text-[#001f3f] border-[#001f3f]">
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Remarks & Official Receipt Attachments */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-[#001f3f]">Remarks (Audit Trail)</Label>
            <Textarea
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              className="bg-white text-[#001f3f] border-[#001f3f] h-20 text-xs"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-[#001f3f]">
                Official Receipt(s) &amp; Signed Expense Invoice PDF
              </Label>
              <label className="flex items-center gap-2 text-xs text-emerald-700 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={attachSignedPdf}
                  onChange={(e) => setAttachSignedPdf(e.target.checked)}
                  className="rounded border-emerald-500"
                />
                <FileText className="w-3.5 h-3.5" />
                Auto-attach Signed Expense Invoice PDF to Purchase Record
              </label>
            </div>

            {officialReceiptFiles.length > 0 && (
              <div className="space-y-1 mb-2">
                {officialReceiptFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-green-50 p-2 rounded text-xs">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate flex-1 text-[#001f3f] underline"
                    >
                      {file.name}
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setOfficialReceiptFiles((files) => files.filter((_, i) => i !== idx))
                      }
                      className="h-6 w-6 p-0 hover:bg-red-100"
                    >
                      <X className="h-3 w-3 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="border-2 border-dashed border-[#001f3f] rounded-lg p-3 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={(e) => handleOfficialReceiptUpload(e.target.files)}
                className="hidden"
                id="convert-purchase-receipt-upload"
                disabled={officialReceiptUploading}
              />
              <label htmlFor="convert-purchase-receipt-upload" className="cursor-pointer block">
                <Upload className="mx-auto h-5 w-5 text-[#001f3f] mb-1" />
                <p className="text-xs text-[#001f3f]/70">
                  {officialReceiptUploading
                    ? "Uploading additional receipt..."
                    : "Click to upload additional Official Receipt(s) if needed"}
                </p>
              </label>
            </div>
          </div>

          {/* Off-screen Invoice Document used to render the Signed Invoice PDF */}
          <div style={{ position: "fixed", left: "-9999px", top: 0, width: 820 }}>
            <ExpenseInvoiceDocument
              invoice={invoice}
              containerId="convert-modal-hidden-invoice-doc"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="border-slate-300 bg-white text-slate-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || officialReceiptUploading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {loading ? "Converting to Purchase Record..." : "Confirm & Save as 1 Purchase Record"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
