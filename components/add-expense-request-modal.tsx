"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase/client"
import { logNotification } from "@/utils/logNotification"
import { Upload, X, Plus, Trash2 } from "lucide-react"
import { formatS3Url } from "@/utils/s3-url"

export interface ExpenseRequestRecord {
  id: string
  item_name: string
  amount: number
  quantity?: number
  unit_price?: number
  tax_month: string
  tin_id: string | null
  tin: string
  name: string
  substreet_street_brgy: string | null
  district_city_zip: string | null
  gross_taxable: number
  total_actual_amount?: number
  invoice_number: string | null
  tax_type: string
  official_receipt?: any
  category_id?: string | null
  date_added: string | null
  user_uuid: string | null
  user_full_name: string | null
  user_email?: string | null
  user_assigned_area?: string | null
  remarks: string | null
  status: string
  expense_invoice_id?: string | null
  expense_invoice_number?: string | null
  approved_at?: string | null
  approved_by?: string | null
  converted_purchase_id?: string | null
  converted_at?: string | null
  converted_by_name?: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
}

interface AddExpenseRequestModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  editRecord?: ExpenseRequestRecord | null
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

interface ItemRowInput {
  id: string
  item_name: string
  gross_taxable: string
  total_actual_amount: string
  category_id: string
  invoice_number: string
}

export function AddExpenseRequestModal({
  open,
  onOpenChange,
  onSaved,
  editRecord,
}: AddExpenseRequestModalProps) {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)

  // Shared Purchase-identical fields
  const [isPayeeNotApplicable, setIsPayeeNotApplicable] = useState(false)
  const [formData, setFormData] = useState({
    tin: "000-000-000-000",
    name: "",
    substreet_street_brgy: "",
    district_city_zip: "",
    tax_type: "non-vat",
    tax_month: "",
    remarks: "",
  })

  // Itemized rows (supports adding 1 or multiple items at once, e.g., petty cash - 1000, birthday celebration - 1500, event venue - 25000)
  const [itemRows, setItemRows] = useState<ItemRowInput[]>([
    {
      id: "row-1",
      item_name: "",
      gross_taxable: "",
      total_actual_amount: "",
      category_id: "",
      invoice_number: "0",
    },
  ])

  const [taxpayerSuggestions, setTaxpayerSuggestions] = useState<TaxpayerSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [nameSuggestions, setNameSuggestions] = useState<TaxpayerSuggestion[]>([])
  const [showNameSuggestions, setShowNameSuggestions] = useState(false)

  const [officialReceiptFiles, setOfficialReceiptFiles] = useState<{ name: string; url: string }[]>([])
  const [officialReceiptUploading, setOfficialReceiptUploading] = useState(false)

  const [categories, setCategories] = useState<{ id: string; category: string }[]>([])

  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from("purchases_categories")
        .select("id, category")
        .eq("is_deleted", false)
        .order("category", { ascending: true })
      if (!error && data) {
        setCategories(data)
      }
    }
    fetchCategories()
  }, [])

  // Generate tax month options (same as AddPurchasesModal)
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

      options.push({
        label: monthName,
        value,
      })
    }

    return options
  }

  const taxMonthOptions = generateTaxMonthOptions()

  const formatTinInput = (value: string): string => {
    const digits = value.replace(/\D/g, "")
    return digits.replace(/(\d{3})(?=\d)/g, "$1-")
  }

  const formatTinDisplay = (tin: string): string => {
    const digits = (tin || "").replace(/\D/g, "")
    if (!digits) return ""
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

  // Populate form when editing or opening
  useEffect(() => {
    if (!open) return

    const defaultTaxMonth = taxMonthOptions[0]?.value || format(new Date(), "yyyy-MM-dd")
    const defaultCat = categories[0]?.id || ""

    if (editRecord) {
      let parsedRemarks = editRecord.remarks || ""
      try {
        if (parsedRemarks.startsWith("[")) {
          const arr = JSON.parse(parsedRemarks)
          if (Array.isArray(arr) && arr.length > 0) {
            parsedRemarks = arr.map((r: any) => r.remark || "").join("; ")
          }
        }
      } catch {
        // keep string
      }

      const isNoCompany = editRecord.tin === "000" || editRecord.tin === "0"
      setIsPayeeNotApplicable(isNoCompany)
      setFormData({
        tin: isNoCompany ? "000" : formatTinDisplay(editRecord.tin || "000000000000"),
        name: editRecord.name || "",
        substreet_street_brgy: editRecord.substreet_street_brgy || "",
        district_city_zip: editRecord.district_city_zip || "",
        tax_type: editRecord.tax_type || "non-vat",
        tax_month: editRecord.tax_month || defaultTaxMonth,
        remarks: parsedRemarks,
      })

      setItemRows([
        {
          id: editRecord.id,
          item_name: editRecord.item_name || editRecord.name || "",
          gross_taxable: formatNumberWithCommas(String(editRecord.gross_taxable || editRecord.amount || 0)),
          total_actual_amount: formatNumberWithCommas(
            String(editRecord.total_actual_amount ?? editRecord.amount ?? editRecord.gross_taxable ?? 0)
          ),
          category_id: editRecord.category_id || defaultCat,
          invoice_number: editRecord.invoice_number || "0",
        },
      ])

      const rawReceipt = editRecord.official_receipt
      let files: string[] = []
      if (Array.isArray(rawReceipt)) {
        files = rawReceipt
      } else if (typeof rawReceipt === "string" && rawReceipt.trim() !== "") {
        try {
          const parsed = JSON.parse(rawReceipt)
          files = Array.isArray(parsed) ? parsed : [rawReceipt]
        } catch {
          files = [rawReceipt]
        }
      }
      setOfficialReceiptFiles(
        files.filter(Boolean).map((url: string) => ({
          name: decodeURIComponent(url.split("/").pop() || "Receipt"),
          url: formatS3Url(url),
        }))
      )
    } else {
      setIsPayeeNotApplicable(false)
      setFormData({
        tin: "000-000-000-000",
        name: "",
        substreet_street_brgy: profile?.assigned_area || "Cebu City",
        district_city_zip: profile?.assigned_area || "Cebu City",
        tax_type: "non-vat",
        tax_month: defaultTaxMonth,
        remarks: "",
      })
      setItemRows([
        {
          id: `row-${Date.now()}`,
          item_name: "",
          gross_taxable: "",
          total_actual_amount: "",
          category_id: defaultCat,
          invoice_number: "0",
        },
      ])
      setOfficialReceiptFiles([])
    }
  }, [open, editRecord, categories.length])

  const searchTaxpayers = async (tinPrefix: string) => {
    if (tinPrefix.length < 3) {
      setTaxpayerSuggestions([])
      setShowSuggestions(false)
      return
    }
    try {
      const { data, error } = await supabase
        .from("taxpayer_listings")
        .select("id, tin, registered_name, substreet_street_brgy, district_city_zip")
        .eq("type", "purchases")
        .ilike("tin", `${tinPrefix}%`)
        .limit(5)
      if (error) throw error
      setTaxpayerSuggestions(data || [])
      setShowSuggestions(Boolean(data && data.length > 0))
    } catch (error) {
      console.error("Error searching taxpayers:", error)
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
      const { data, error } = await supabase
        .from("taxpayer_listings")
        .select("id, tin, registered_name, substreet_street_brgy, district_city_zip")
        .eq("type", "purchases")
        .ilike("registered_name", `%${namePrefix}%`)
        .limit(5)
      if (error) throw error
      setNameSuggestions(data || [])
      setShowNameSuggestions(Boolean(data && data.length > 0))
    } catch (error) {
      console.error("Error searching taxpayers by name:", error)
      setNameSuggestions([])
      setShowNameSuggestions(false)
    }
  }

  const handleTinChange = (value: string) => {
    const formattedTin = formatTinInput(value)
    setFormData({ ...formData, tin: formattedTin })
    const cleanTin = value.replace(/[^0-9]/g, "")
    if (cleanTin.length >= 3) {
      searchTaxpayers(cleanTin.substring(0, 3))
    } else {
      setTaxpayerSuggestions([])
      setShowSuggestions(false)
    }
  }

  const handleSuggestionSelect = (suggestion: TaxpayerSuggestion) => {
    setFormData({
      ...formData,
      tin: formatTinDisplay(suggestion.tin),
      name: suggestion.registered_name,
      substreet_street_brgy: suggestion.substreet_street_brgy || formData.substreet_street_brgy,
      district_city_zip: suggestion.district_city_zip || formData.district_city_zip,
    })
    setShowSuggestions(false)
    setShowNameSuggestions(false)
  }

  const getOrCreateTaxpayerListing = async (tinData: {
    tin: string
    name: string
    substreet_street_brgy: string
    district_city_zip: string
  }) => {
    try {
      const cleanTin = tinData.tin.replace(/[^0-9]/g, "") || "0"
      const { data: existingTaxpayer } = await supabase
        .from("taxpayer_listings")
        .select("id")
        .eq("tin", cleanTin)
        .eq("type", "purchases")
        .limit(1)
        .maybeSingle()

      if (existingTaxpayer?.id) {
        return existingTaxpayer.id
      }

      const { data: newTaxpayer, error: insertError } = await supabase
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

      if (insertError) throw insertError
      return newTaxpayer.id
    } catch (error) {
      console.error("Error handling taxpayer listing:", error)
      return null
    }
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
            category: "expense-request",
            tinName: formData.name || itemRows[0]?.item_name || "Expense",
            tinNumber: formData.tin.replace(/[^0-9]/g, "") || "0",
            assignedArea: profile?.assigned_area || "Cebu",
            userFullName: profile?.full_name || "User",
          }),
        })

        if (!presignedRes.ok) {
          throw new Error("Failed to get S3 upload authorization")
        }

        const { uploadUrl, publicUrl, fileName } = await presignedRes.json()

        const s3Res = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        })

        if (!s3Res.ok) {
          throw new Error(`Direct S3 upload failed with status ${s3Res.status}`)
        }

        uploaded.push({
          name: fileName,
          url: formatS3Url(publicUrl),
        })
      }

      setOfficialReceiptFiles((prev) => [...prev, ...uploaded])
    } catch (error) {
      console.error("Error uploading official receipt:", error)
      alert("Error uploading attachment: " + (error instanceof Error ? error.message : "Upload failed"))
    } finally {
      setOfficialReceiptUploading(false)
    }
  }

  const addItemRow = () => {
    const lastRow = itemRows[itemRows.length - 1]
    setItemRows([
      ...itemRows,
      {
        id: `row-${Date.now()}-${Math.random()}`,
        item_name: "",
        gross_taxable: "",
        total_actual_amount: "",
        category_id: lastRow?.category_id || categories[0]?.id || "",
        invoice_number: lastRow?.invoice_number || "0",
      },
    ])
  }

  const removeItemRow = (id: string) => {
    if (itemRows.length <= 1) return
    setItemRows(itemRows.filter((r) => r.id !== id))
  }

  const updateItemRow = (id: string, field: keyof ItemRowInput, value: string) => {
    setItemRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row
        const updated = { ...row, [field]: value }
        // Mirror gross_taxable into total_actual_amount if total_actual_amount hasn't been customized yet
        if (field === "gross_taxable" && (!row.total_actual_amount || row.total_actual_amount === row.gross_taxable)) {
          updated.total_actual_amount = value
        }
        return updated
      })
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validRows = itemRows.filter(
      (r) => r.item_name.trim() !== "" && (Number(r.gross_taxable.replace(/,/g, "")) > 0 || Number(r.total_actual_amount.replace(/,/g, "")) > 0)
    )

    if (validRows.length === 0) {
      alert("Please enter at least one itemized expense description and amount.")
      return
    }

    setLoading(true)
    try {
      const effectiveSupplierName = isPayeeNotApplicable
        ? validRows[0].item_name.trim()
        : formData.name.trim() || validRows[0].item_name.trim()
      const cleanTin = isPayeeNotApplicable
        ? "000"
        : formData.tin.replace(/[^0-9]/g, "") || "000"
      const effectiveSubstreet = isPayeeNotApplicable
        ? formData.substreet_street_brgy || profile?.assigned_area || "N/A"
        : formData.substreet_street_brgy || "N/A"
      const effectiveDistrict = isPayeeNotApplicable
        ? formData.district_city_zip || profile?.assigned_area || "N/A"
        : formData.district_city_zip || "N/A"

      const taxpayerListingId = await getOrCreateTaxpayerListing({
        tin: cleanTin,
        name: effectiveSupplierName,
        substreet_street_brgy: effectiveSubstreet,
        district_city_zip: effectiveDistrict,
      })

      const formattedRemarks = formData.remarks.trim()
        ? JSON.stringify([
            {
              remark: formData.remarks.trim(),
              name: profile?.full_name || "User",
              uuid: profile?.id || null,
              date: new Date().toISOString(),
            },
          ])
        : null

      if (editRecord) {
        const row = validRows[0]
        const gross = Number.parseFloat(row.gross_taxable.replace(/,/g, "")) || 0
        const actual = Number.parseFloat(row.total_actual_amount.replace(/,/g, "")) || gross

        const updatePayload = {
          item_name: row.item_name.trim(),
          amount: actual,
          unit_price: actual,
          tax_month: formData.tax_month,
          tin_id: taxpayerListingId,
          tin: cleanTin,
          name: effectiveSupplierName,
          substreet_street_brgy: effectiveSubstreet,
          district_city_zip: effectiveDistrict,
          gross_taxable: gross,
          total_actual_amount: actual,
          category_id: row.category_id || null,
          invoice_number: row.invoice_number || "0",
          tax_type: isPayeeNotApplicable ? "non-vat" : formData.tax_type,
          official_receipt: officialReceiptFiles.map((f) => f.url),
          remarks: formattedRemarks,
          updated_at: new Date().toISOString(),
        }

        const { error } = await supabase
          .from("expense_requests")
          .update(updatePayload)
          .eq("id", editRecord.id)

        if (error) throw error
      } else {
        const rowsToInsert = validRows.map((row) => {
          const gross = Number.parseFloat(row.gross_taxable.replace(/,/g, "")) || 0
          const actual = Number.parseFloat(row.total_actual_amount.replace(/,/g, "")) || gross
          const rowSupplierName = isPayeeNotApplicable
            ? row.item_name.trim()
            : formData.name.trim() || row.item_name.trim()

          return {
            item_name: row.item_name.trim(),
            amount: actual,
            quantity: 1,
            unit_price: actual,
            tax_month: formData.tax_month,
            tin_id: taxpayerListingId,
            tin: cleanTin,
            name: rowSupplierName,
            substreet_street_brgy: effectiveSubstreet,
            district_city_zip: effectiveDistrict,
            gross_taxable: gross,
            total_actual_amount: actual,
            category_id: row.category_id || null,
            invoice_number: row.invoice_number || "0",
            tax_type: isPayeeNotApplicable ? "non-vat" : formData.tax_type,
            official_receipt: officialReceiptFiles.map((f) => f.url),
            date_added: format(new Date(), "yyyy-MM-dd"),
            user_uuid: profile?.auth_user_id || profile?.id || null,
            user_full_name: profile?.full_name || null,
            user_email: profile?.email || null,
            user_assigned_area: profile?.assigned_area || null,
            remarks: formattedRemarks,
            status: "pending",
          }
        })

        const { error } = await supabase.from("expense_requests").insert(rowsToInsert)
        if (error) throw error

        if (profile?.id) {
          await logNotification(supabase, {
            action: "expense_request_created",
            description: `Created ${rowsToInsert.length} itemized expense request(s): ${rowsToInsert
              .map((r) => `${r.item_name} (₱${r.amount.toLocaleString()})`)
              .join(", ")}`,
            ip_address: null,
            location: null,
            meta: JSON.stringify({
              createdBy: profile.full_name || "",
              role: profile.role || "",
              count: rowsToInsert.length,
            }),
            user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
            user_email: profile.email,
            user_name: profile.full_name || profile.first_name || profile.id,
            user_uuid: profile.id,
          })
        }
      }

      onOpenChange(false)
      onSaved()
    } catch (error: any) {
      console.error("Error saving expense request:", error)
      alert("Error saving expense request: " + (error?.message || "Please try again."))
    } finally {
      setLoading(false)
    }
  }

  const totalPreviewAmount = itemRows.reduce((sum, r) => {
    const val = Number(r.total_actual_amount.replace(/,/g, "")) || Number(r.gross_taxable.replace(/,/g, "")) || 0
    return sum + val
  }, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto bg-white text-[#001f3f]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#001f3f]">
            {editRecord ? "Edit Itemized Expense Request" : "Add Itemized Expense Request(s)"}
          </DialogTitle>
          <p className="text-sm text-slate-600">
            Enter one or more itemized expenses (e.g., Petty Cash - 1,000, Birthday Celebration - 1,500, Event Venue - 25,000) along with the purchase record fields.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Itemized Expense Rows Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#001f3f]">
                  1. Itemized Expense Particulars &amp; Amounts *
                </h3>
                <p className="text-xs text-slate-500">
                  Each row is saved as an itemized expense request that can be selected to generate an invoice.
                </p>
              </div>
              {!editRecord && (
                <Button
                  type="button"
                  size="sm"
                  onClick={addItemRow}
                  className="bg-[#0284c7] hover:bg-[#0369a1] text-white"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Another Item
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {itemRows.map((row, idx) => (
                <div
                  key={row.id}
                  className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-white p-3 rounded-lg border border-slate-200 shadow-sm"
                >
                  <div className="md:col-span-4 space-y-1">
                    <Label className="text-xs font-semibold text-[#001f3f]">
                      Item #{idx + 1} Description / Particulars *
                    </Label>
                    <Input
                      value={row.item_name}
                      onChange={(e) => updateItemRow(row.id, "item_name", e.target.value)}
                      placeholder="e.g., Petty Cash, Birthday Celebration, Event Venue"
                      required
                      className="bg-white text-[#001f3f] border-slate-300"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <Label className="text-xs font-semibold text-[#001f3f]">Gross Taxable *</Label>
                    <Input
                      value={row.gross_taxable}
                      onChange={(e) => {
                        const rawValue = e.target.value.replace(/,/g, "")
                        if (rawValue === "" || /^\d*\.?\d*$/.test(rawValue)) {
                          updateItemRow(row.id, "gross_taxable", formatNumberWithCommas(rawValue))
                        }
                      }}
                      placeholder="0.00"
                      required
                      className="bg-white text-[#001f3f] border-slate-300 font-semibold placeholder:text-slate-300"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <Label className="text-xs font-semibold text-[#001f3f]">Actual Amount *</Label>
                    <Input
                      value={row.total_actual_amount}
                      onChange={(e) => {
                        const rawValue = e.target.value.replace(/,/g, "")
                        if (rawValue === "" || /^\d*\.?\d*$/.test(rawValue)) {
                          updateItemRow(row.id, "total_actual_amount", formatNumberWithCommas(rawValue))
                        }
                      }}
                      placeholder="0.00"
                      required
                      className="bg-white text-[#001f3f] border-slate-300 font-semibold placeholder:text-slate-300"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <Label className="text-xs font-semibold text-[#001f3f]">Category *</Label>
                    <Select
                      value={row.category_id}
                      onValueChange={(val) => updateItemRow(row.id, "category_id", val)}
                    >
                      <SelectTrigger className="bg-white text-[#001f3f] border-slate-300">
                        <SelectValue placeholder="Category..." />
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

                  <div className="md:col-span-2 flex items-center gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs font-semibold text-[#001f3f]">OR / Inv #</Label>
                      <Input
                        value={row.invoice_number}
                        onChange={(e) => updateItemRow(row.id, "invoice_number", e.target.value)}
                        placeholder="0"
                        className="bg-white text-[#001f3f] border-slate-300"
                      />
                    </div>
                    {!editRecord && itemRows.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItemRow(row.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 mt-5"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end items-center pt-2 border-t border-slate-200">
              <span className="text-sm text-slate-600 mr-3">Total of Entered Item(s):</span>
              <span className="text-lg font-extrabold text-[#001f3f]">
                ₱{totalPreviewAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Purchase Fields Section */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100/80 border border-slate-200 px-4 py-3 rounded-xl">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#001f3f]">
                  2. Purchase / BIR Tax &amp; Payee Details
                </h3>
                <p className="text-xs text-slate-500">
                  Check &ldquo;Not Applicable&rdquo; if this expense has no company to accredit to (e.g., Petty Cash).
                </p>
              </div>

              <label className="flex items-center gap-2.5 bg-white border-2 border-[#0284c7] px-3.5 py-2 rounded-lg cursor-pointer shadow-sm hover:bg-sky-50 transition-colors">
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
                        name: "",
                        tax_type: "non-vat",
                        substreet_street_brgy: prev.substreet_street_brgy || profile?.assigned_area || "N/A",
                        district_city_zip: prev.district_city_zip || profile?.assigned_area || "N/A",
                      }))
                    } else {
                      setFormData((prev) => ({
                        ...prev,
                        tin: prev.tin === "000" ? "000-000-000-000" : prev.tin,
                      }))
                    }
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-[#0284c7] focus:ring-[#0284c7] cursor-pointer"
                />
                <span className="text-xs sm:text-sm font-bold text-[#001f3f]">
                  Not Applicable (No Company / Auto-set TIN to <code className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-mono">000</code>)
                </span>
              </label>
            </div>

            {isPayeeNotApplicable ? (
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="text-xs text-amber-900 space-y-1">
                  <div className="font-bold text-sm text-amber-950">
                    ✓ Company / Payee Details Skipped (Not Applicable)
                  </div>
                  <p>
                    TIN is automatically set to <strong>000</strong> (no company to accredit to), Tax Type is set to <strong>Non-VAT</strong>, and each itemized entry will use its Item Description as the record name.
                  </p>
                </div>

                <div className="w-full sm:w-64 shrink-0 space-y-1">
                  <Label className="text-xs font-semibold text-amber-950">Tax Month *</Label>
                  <Select
                    value={formData.tax_month}
                    onValueChange={(value) => setFormData({ ...formData, tax_month: value })}
                    required
                  >
                    <SelectTrigger className="bg-white text-[#001f3f] border-amber-300">
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
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Tax Month */}
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

                  {/* Tax Type */}
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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* TIN Search */}
                  <div className="space-y-2 relative">
                    <Label className="text-sm font-medium text-[#001f3f]">TIN (or 000) *</Label>
                    <Input
                      value={formData.tin}
                      onChange={(e) => handleTinChange(e.target.value)}
                      placeholder="000-000-000-000"
                      required
                      className="bg-white text-[#001f3f] border-[#001f3f]"
                      onFocus={() => {
                        if (taxpayerSuggestions.length > 0) setShowSuggestions(true)
                      }}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    />
                    {showSuggestions && taxpayerSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-white border border-[#001f3f] rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {taxpayerSuggestions.map((suggestion, index) => (
                          <div
                            key={index}
                            className="p-3 hover:bg-[#e6f0ff] cursor-pointer border-b border-gray-100 last:border-b-0"
                            onClick={() => handleSuggestionSelect(suggestion)}
                          >
                            <div className="font-medium text-[#001f3f]">{formatTinDisplay(suggestion.tin)}</div>
                            <div className="text-sm text-[#001f3f]/80">{suggestion.registered_name}</div>
                            <div className="text-xs text-[#001f3f]/60">
                              {suggestion.substreet_street_brgy}, {suggestion.district_city_zip}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Supplier / Payee Name */}
                  <div className="space-y-2 relative">
                    <Label className="text-sm font-medium text-[#001f3f]">
                      Supplier / Payee Name (defaults to Item Name if blank)
                    </Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => {
                        setFormData({ ...formData, name: e.target.value })
                        if (e.target.value.length >= 3) {
                          searchTaxpayersByName(e.target.value)
                        } else {
                          setNameSuggestions([])
                          setShowNameSuggestions(false)
                        }
                      }}
                      placeholder="Company / Payee / Vendor Name"
                      className="bg-white text-[#001f3f] border-[#001f3f]"
                      onFocus={() => {
                        if (nameSuggestions.length > 0) setShowNameSuggestions(true)
                      }}
                      onBlur={() => setTimeout(() => setShowNameSuggestions(false), 200)}
                    />
                    {showNameSuggestions && nameSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-white border border-[#001f3f] rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {nameSuggestions.map((suggestion, index) => (
                          <div
                            key={index}
                            className="p-3 hover:bg-[#e6f0ff] cursor-pointer border-b border-gray-100 last:border-b-0"
                            onClick={() => handleSuggestionSelect(suggestion)}
                          >
                            <div className="font-medium text-[#001f3f]">{suggestion.registered_name}</div>
                            <div className="text-sm text-[#001f3f]/80">{formatTinDisplay(suggestion.tin)}</div>
                            <div className="text-xs text-[#001f3f]/60">
                              {suggestion.substreet_street_brgy}, {suggestion.district_city_zip}
                            </div>
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
                      placeholder="Address line 1"
                      required
                      className="bg-white text-[#001f3f] border-[#001f3f]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[#001f3f]">District/City/ZIP *</Label>
                    <Input
                      value={formData.district_city_zip}
                      onChange={(e) => setFormData({ ...formData, district_city_zip: e.target.value })}
                      placeholder="Address line 2"
                      required
                      className="bg-white text-[#001f3f] border-[#001f3f]"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Remarks & Attachments */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#001f3f]">Remarks / Notes</Label>
                <Textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Optional purpose or accounting notes..."
                  className="bg-white text-[#001f3f] border-[#001f3f] h-28"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#001f3f]">
                  Supporting Receipt / Quotation (Image or PDF)
                </Label>
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

                <div className="border-2 border-dashed border-[#001f3f] rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    onChange={(e) => handleOfficialReceiptUpload(e.target.files)}
                    className="hidden"
                    id="expense-receipt-upload"
                    disabled={officialReceiptUploading}
                  />
                  <label htmlFor="expense-receipt-upload" className="cursor-pointer block">
                    {officialReceiptUploading ? (
                      <div className="py-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-1" />
                        <p className="text-xs text-blue-600">Uploading to S3...</p>
                      </div>
                    ) : (
                      <>
                        <Upload className="mx-auto h-6 w-6 text-[#001f3f] mb-1" />
                        <p className="text-xs text-[#001f3f]/70">
                          Click to upload Receipt / Supporting Document (Image or PDF)
                        </p>
                      </>
                    )}
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="border-[#001f3f] bg-white text-[#001f3f]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || officialReceiptUploading}
              className="bg-[#001f3f] hover:bg-[#001f3f]/90 text-white"
            >
              {loading
                ? "Saving..."
                : editRecord
                ? "Update Expense Request"
                : `Save ${itemRows.length > 1 ? `${itemRows.length} Expense Items` : "Expense Request"}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
