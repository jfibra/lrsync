"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase/client"
import { logNotification } from "@/utils/logNotification"
import { Upload, X } from "lucide-react";

interface AddPurchasesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPurchaseAdded: () => void
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

export function AddPurchasesModal({ open, onOpenChange, onPurchaseAdded }: AddPurchasesModalProps) {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    tin: "",
    name: "",
    substreet_street_brgy: "",
    district_city_zip: "",
    tax_type: "",
    gross_taxable: "",
    total_actual_amount: "", // <-- add this
    invoice_number: "",
    official_receipt: "",
    tax_month: "",
  })

  // TIN search suggestions
  const [taxpayerSuggestions, setTaxpayerSuggestions] = useState<TaxpayerSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  // Name search suggestions
  const [nameSuggestions, setNameSuggestions] = useState<TaxpayerSuggestion[]>([])
  const [showNameSuggestions, setShowNameSuggestions] = useState(false)

  const [officialReceiptFiles, setOfficialReceiptFiles] = useState<{ name: string; url: string }[]>([]);
  const [officialReceiptUploading, setOfficialReceiptUploading] = useState(false);
  const [officialReceiptUrl, setOfficialReceiptUrl] = useState<string | null>(null);

  const [categories, setCategories] = useState<{ id: string; category: string }[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("")

  const isFileUploadDisabled =
    !formData.tax_month ||
    !formData.tin ||
    !formData.name ||
    !formData.invoice_number;

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

  // Generate tax month options
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
        value: value,
      })
    }

    return options
  }

  const taxMonthOptions = generateTaxMonthOptions()

  // Format TIN with dashes
  const formatTinInput = (value: string): string => {
    const digits = value.replace(/\D/g, "")
    return digits.replace(/(\d{3})(?=\d)/g, "$1-")
  }

  // Format TIN for display (used for suggestions)
  const formatTinDisplay = (tin: string): string => {
    const digits = tin.replace(/\D/g, "")
    return digits.replace(/(\d{3})(?=\d)/g, "$1-")
  }

  // Format number with commas and preserve decimals
  const formatNumberWithCommas = (value: string): string => {
    if (!value) return ""

    // Remove existing commas
    const numericValue = value.replace(/,/g, "")

    // Check if it's a valid number (including decimals)
    if (isNaN(Number(numericValue))) return value

    // Split into integer and decimal parts
    const parts = numericValue.split(".")
    const integerPart = parts[0]
    const decimalPart = parts[1]

    // Format integer part with commas
    const formattedInteger = Number(integerPart).toLocaleString()

    // Combine with decimal part if it exists
    return decimalPart !== undefined ? `${formattedInteger}.${decimalPart}` : formattedInteger
  }

  // Search taxpayers based on TIN prefix (purchases type only)
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
        .eq("type", "purchases") // Filter for purchases type only
        .ilike("tin", `${tinPrefix}%`)
        .limit(5)
      if (error) throw error
      setTaxpayerSuggestions(data || [])
      setShowSuggestions(data && data.length > 0)
    } catch (error) {
      console.error("Error searching taxpayers:", error)
      setTaxpayerSuggestions([])
      setShowSuggestions(false)
    }
  }

  // Search taxpayers by name (purchases type only)
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
        .eq("type", "purchases") // Filter for purchases type only
        .ilike("registered_name", `%${namePrefix}%`)
        .limit(5)
      if (error) throw error
      setNameSuggestions(data || [])
      setShowNameSuggestions(data && data.length > 0)
    } catch (error) {
      console.error("Error searching taxpayers by name:", error)
      setNameSuggestions([])
      setShowNameSuggestions(false)
    }
  }

  // Handle TIN input change
  const handleTinChange = (value: string) => {
    const formattedTin = formatTinInput(value)
    setFormData({ ...formData, tin: formattedTin })

    // Search for taxpayers when first 3 digits are entered
    const cleanTin = value.replace(/[^0-9]/g, "")
    if (cleanTin.length >= 3) {
      const prefix = cleanTin.substring(0, 3)
      searchTaxpayers(prefix)
    } else {
      setTaxpayerSuggestions([])
      setShowSuggestions(false)
    }
  }

  // Handle taxpayer suggestion selection (TIN)
  const handleSuggestionSelect = (suggestion: TaxpayerSuggestion) => {
    setFormData({
      ...formData,
      tin: formatTinDisplay(suggestion.tin),
      name: suggestion.registered_name,
      substreet_street_brgy: suggestion.substreet_street_brgy,
      district_city_zip: suggestion.district_city_zip,
    })
    setShowSuggestions(false)
  }

  // Handle taxpayer suggestion selection (Name)
  const handleNameSuggestionSelect = (suggestion: TaxpayerSuggestion) => {
    setFormData({
      ...formData,
      tin: formatTinDisplay(suggestion.tin),
      name: suggestion.registered_name,
      substreet_street_brgy: suggestion.substreet_street_brgy,
      district_city_zip: suggestion.district_city_zip,
    })
    setShowNameSuggestions(false)
  }

  // Function to handle taxpayer listing creation or retrieval
  const getOrCreateTaxpayerListing = async (tinData: {
    tin: string
    name: string
    substreet_street_brgy: string
    district_city_zip: string
  }) => {
    try {
      // First, check if taxpayer already exists
      const { data: existingTaxpayer, error: searchError } = await supabase
        .from("taxpayer_listings")
        .select("id")
        .eq("tin", tinData.tin.replace(/[^0-9]/g, "")) // Remove dashes for comparison
        .eq("type", "purchases") // Check for purchases type
        .single()

      if (searchError && searchError.code !== "PGRST116") {
        // PGRST116 is "not found" error, which is expected if taxpayer doesn't exist
        throw searchError
      }

      // If taxpayer exists, return the existing ID
      if (existingTaxpayer) {
        return existingTaxpayer.id
      }

      // If taxpayer doesn't exist, create a new one
      const { data: newTaxpayer, error: insertError } = await supabase
        .from("taxpayer_listings")
        .insert([
          {
            tin: tinData.tin.replace(/[^0-9]/g, ""), // Store TIN without dashes
            registered_name: tinData.name,
            substreet_street_brgy: tinData.substreet_street_brgy,
            district_city_zip: tinData.district_city_zip,
            type: "purchases", // Set type to purchases
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
      throw error
    }
  }

  const handleOfficialReceiptUpload = async (files: FileList | null) => {
    if (
      isFileUploadDisabled ||
      !files ||
      files.length === 0
    ) {
      alert("Please fill in Tax Month, TIN #, Name, and Invoice # before uploading files.");
      return;
    }
    if (!files || files.length === 0) return;
    setOfficialReceiptUploading(true);
    try {
      // Prepare FormData for S3 API
      const uploadFormData = new FormData();
      Array.from(files).forEach(file => uploadFormData.append("files", file));
      uploadFormData.append("tin_name", formData.name || "");
      uploadFormData.append("tin_number", formData.tin.replace(/[^0-9]/g, "") || "");
      uploadFormData.append("assigned_area", profile?.assigned_area || "");
      uploadFormData.append("user_full_name", profile?.full_name || "");

      const res = await fetch("/api/upload-official-receipt-purchases", {
        method: "POST",
        body: uploadFormData,
      });

      if (!res.ok) {
        throw new Error("Failed to upload file(s) to S3.");
      }

      const data = await res.json();
      setOfficialReceiptFiles(prev => [
        ...prev,
        ...data.files.map((f: { name: string; url: string }) => ({
          name: f.name,
          url: f.url,
        })),
      ]);
    } catch (error) {
      alert("Error uploading official receipt.");
    } finally {
      setOfficialReceiptUploading(false);
    }
  };

  function getS3KeyFromUrl(url: string) {
    // Example: https://your-bucket.s3.amazonaws.com/lrsync/purchases/2025/08/16/OR # 12345678 - Name - TIN (Area - User).pdf
    const match = url.match(/\/(lrsync\/purchases\/.+)$/);
    return match ? match[1] : null;
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      tin: "",
      name: "",
      substreet_street_brgy: "",
      district_city_zip: "",
      tax_type: "",
      gross_taxable: "",
      total_actual_amount: "", // <-- add this
      invoice_number: "",
      official_receipt: "",
      tax_month: "",
    });
    setTaxpayerSuggestions([]);
    setShowSuggestions(false);
    setNameSuggestions([]);
    setShowNameSuggestions(false);
    setOfficialReceiptFiles([]); // <-- Add this line to clear attachments
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Get or create taxpayer listing
      const taxpayerListingId = await getOrCreateTaxpayerListing({
        tin: formData.tin,
        name: formData.name,
        substreet_street_brgy: formData.substreet_street_brgy,
        district_city_zip: formData.district_city_zip,
      })

      const cleanTin = formData.tin.replace(/[^0-9]/g, "")

      const purchaseData = {
        tax_month: formData.tax_month,
        tin_id: taxpayerListingId,
        tin: cleanTin,
        name: formData.name,
        substreet_street_brgy: formData.substreet_street_brgy || null,
        district_city_zip: formData.district_city_zip || null,
        gross_taxable: Number.parseFloat(formData.gross_taxable.replace(/,/g, "")) || 0,
        total_actual_amount: Number.parseFloat(formData.total_actual_amount.replace(/,/g, "")) || 0, // <-- add this
        category_id: selectedCategoryId,
        invoice_number: formData.invoice_number || null,
        tax_type: formData.tax_type,
        official_receipt: JSON.stringify(officialReceiptFiles.map(f => f.url)),
        date_added: format(new Date(), "yyyy-MM-dd"),
        user_uuid: profile?.auth_user_id || null,
        user_full_name: profile?.full_name || null,
      };

      const { error } = await supabase.from("purchases").insert([purchaseData])

      if (error) throw error

      // Log notification
      if (profile?.id) {
        await logNotification(supabase, {
          action: "purchase_created",
          description: `Purchase record created for ${formData.name} (TIN: ${formData.tin})`,
          ip_address: null,
          location: null,
          meta: JSON.stringify({
            createdBy: profile?.full_name || "",
            role: profile?.role || "",
            taxMonth: formData.tax_month,
            grossTaxable: formData.gross_taxable,
          }),
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
          user_email: profile.email,
          user_name: profile.full_name || profile.first_name || profile.id,
          user_uuid: profile.id,
        })
      }

      resetForm()
      onOpenChange(false)
      onPurchaseAdded()
    } catch (error) {
      console.error("Error creating purchase record:", error)
      alert("Error creating purchase record. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      resetForm()
    }
  }, [open])

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        // Only allow closing if no attachments
        if (!nextOpen && officialReceiptFiles.length === 0) {
          onOpenChange(false);
        }
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white text-[#001f3f]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#001f3f]">Add Purchase Record</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* First Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tax Month */}
            <div className="space-y-2">
              <Label htmlFor="tax-month" className="text-sm font-medium text-[#001f3f]">
                Tax Month *
              </Label>
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
              <Label htmlFor="tax-type" className="text-sm font-medium text-[#001f3f]">
                Tax Type *
              </Label>
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
              <Label htmlFor="invoice-number" className="text-sm font-medium text-[#001f3f]">
                Invoice Number
              </Label>
              <Input
                id="invoice-number"
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                placeholder="Invoice number"
                className="bg-white text-[#001f3f] border-[#001f3f]"
              />
            </div>
          </div>

          {/* First Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* TIN Search */}
            <div className="space-y-2 relative">
              <Label htmlFor="tin" className="text-sm font-medium text-[#001f3f]">
                TIN *
              </Label>
              <Input
                id="tin"
                name="tin_random_1"
                value={formData.tin}
                onChange={(e) => handleTinChange(e.target.value)}
                placeholder="000-000-000-000..."
                required
                className="bg-white text-[#001f3f] border-[#001f3f]"
                autoComplete="new-password"
                onFocus={() => {
                  if (taxpayerSuggestions.length > 0) {
                    setShowSuggestions(true)
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setShowSuggestions(false), 200)
                }}
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

            {/* Name Search */}
            <div className="space-y-2 relative">
              <Label htmlFor="name" className="text-sm font-medium text-[#001f3f]">
                Name *
              </Label>
              <Input
                id="name"
                name="name_random_2"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value })
                  // Trigger name search
                  const value = e.target.value
                  if (value.length >= 3) {
                    searchTaxpayersByName(value)
                  } else {
                    setNameSuggestions([])
                    setShowNameSuggestions(false)
                  }
                }}
                placeholder="Company/Individual name"
                required
                className="bg-white text-[#001f3f] border-[#001f3f]"
                autoComplete="new-password"
                onFocus={() => {
                  if (nameSuggestions.length > 0) {
                    setShowNameSuggestions(true)
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setShowNameSuggestions(false), 200)
                }}
              />
              {showNameSuggestions && nameSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 bg-white border border-[#001f3f] rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {nameSuggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="p-3 hover:bg-[#e6f0ff] cursor-pointer border-b border-gray-100 last:border-b-0"
                      onClick={() => handleNameSuggestionSelect(suggestion)}
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
              <Label htmlFor="substreet" className="text-sm font-medium text-[#001f3f]">
                Substreet/Street/Barangay *
              </Label>
              <Input
                id="substreet"
                value={formData.substreet_street_brgy}
                onChange={(e) => setFormData({ ...formData, substreet_street_brgy: e.target.value })}
                placeholder="Address line 1"
                required
                className="bg-white text-[#001f3f] border-[#001f3f]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="district" className="text-sm font-medium text-[#001f3f]">
                District/City/ZIP *
              </Label>
              <Input
                id="district"
                value={formData.district_city_zip}
                onChange={(e) => setFormData({ ...formData, district_city_zip: e.target.value })}
                placeholder="Address line 2"
                required
                className="bg-white text-[#001f3f] border-[#001f3f]"
              />
            </div>
          </div>

          {/* Optional fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Gross Taxable */}
            <div className="space-y-2">
              <Label htmlFor="gross-taxable" className="text-sm font-medium text-[#001f3f]">
                Gross Taxable *
              </Label>
              <Input
                id="gross-taxable"
                value={formData.gross_taxable}
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/,/g, "")
                  if (rawValue === "" || /^\d*\.?\d*$/.test(rawValue)) {
                    const formatted = formatNumberWithCommas(rawValue)
                    setFormData({ ...formData, gross_taxable: formatted })
                  }
                }}
                placeholder="0"
                className="bg-white text-[#001f3f] border-[#001f3f]"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="total-actual-amount" className="text-sm font-medium text-[#001f3f]">
                Total Actual Amount
              </Label>
              <Input
                id="total-actual-amount"
                value={formData.total_actual_amount}
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/,/g, "")
                  if (rawValue === "" || /^\d*\.?\d*$/.test(rawValue)) {
                    const formatted = formatNumberWithCommas(rawValue)
                    setFormData({ ...formData, total_actual_amount: formatted })
                  }
                }}
                placeholder="0"
                className="bg-white text-[#001f3f] border-[#001f3f]"
                required
              />
            </div>
            {/* Purchase Category Dropdown */}
            <div className="space-y-2">
              <Label htmlFor="purchase-category" className="text-sm font-medium text-[#001f3f]">
                Purchase Category *
              </Label>
              <Select
                value={selectedCategoryId}
                onValueChange={setSelectedCategoryId}
                required
              >
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


          {/* Optional fields */}
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#001f3f]">
                Official Receipt (Image or PDF)
              </Label>
              {/* Uploaded Files Preview */}
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
                        onClick={async () => {
                          const key = getS3KeyFromUrl(file.url);
                          if (!key) {
                            alert("Could not determine S3 key for this file.");
                            return;
                          }
                          try {
                            const res = await fetch("/api/delete-from-s3", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ key }),
                            });
                            if (!res.ok) throw new Error("Failed to delete file from S3.");
                            setOfficialReceiptFiles(files => files.filter((_, i) => i !== idx));
                          } catch (err) {
                            alert("Error deleting file from S3.");
                          }
                        }}
                        className="h-6 w-6 p-0 hover:bg-red-100"
                        disabled={officialReceiptUploading}
                      >
                        <X className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {/* Upload Area */}
              <div
                className={`border-2 border-dashed border-[#001f3f] rounded-lg p-4 text-center hover:border-blue-400 transition-colors
                  ${(officialReceiptUploading || isFileUploadDisabled) ? "opacity-50 cursor-not-allowed" : ""}
                `}
                onDrop={e => {
                  e.preventDefault();
                  if (officialReceiptUploading || isFileUploadDisabled) return;
                  handleOfficialReceiptUpload(e.dataTransfer.files);
                }}
                onDragOver={e => {
                  e.preventDefault();
                  if (!(officialReceiptUploading || isFileUploadDisabled)) e.currentTarget.classList.add("border-blue-400");
                }}
                onDragLeave={e => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("border-blue-400");
                }}
              >
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  onChange={(e) => handleOfficialReceiptUpload(e.target.files)}
                  className="hidden"
                  id="official-receipt-upload"
                  disabled={officialReceiptUploading || isFileUploadDisabled}
                />
                <label
                  htmlFor="official-receipt-upload"
                  className={`cursor-pointer ${officialReceiptUploading || isFileUploadDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  style={{ display: "block" }}
                >
                  {officialReceiptUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                      <p className="text-sm text-blue-600">Uploading...</p>
                    </>
                  ) : (
                    <>
                      <Upload className="mx-auto h-8 w-8 text-[#001f3f] mb-2" />
                      <p className="text-sm text-[#001f3f]/60">
                        Click or drag to upload Official Receipt(s)<br />
                        <span className="block mt-1">
                          Accepted: <span className="font-semibold">Image</span> or <span className="font-semibold">PDF</span>
                        </span>
                      </p>
                    </>
                  )}
                </label>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (officialReceiptFiles.length === 0) {
                  onOpenChange(false);
                }
              }}
              disabled={loading || officialReceiptFiles.length > 0}
              className="border-[#001f3f] bg-white hover:bg-[#001f3f]/10 text-[#001f3f]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                loading ||
                !formData.tax_month ||
                !formData.tin ||
                !formData.name ||
                !formData.invoice_number
              }
              className="bg-[#001f3f] hover:bg-[#001f3f]/90 text-white"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                "Create Purchase Record"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog >
  )
}
