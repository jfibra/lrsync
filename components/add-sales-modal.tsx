"use client"

import type React from "react"
import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Plus, Upload, X } from "lucide-react"
import { format } from "date-fns"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"

interface AddSalesModalProps {
  onSalesAdded: () => void
}

interface TaxMonthOption {
  label: string
  value: string
}

interface TaxpayerSuggestion {
  tin: string
  registered_name: string
  substreet_street_brgy: string
  district_city_zip: string
}

export function AddSalesModal({ onSalesAdded }: AddSalesModalProps) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [taxMonth, setTaxMonth] = useState<string>("")
  const [pickupDate, setPickupDate] = useState<Date>()
  const [taxpayerSuggestions, setTaxpayerSuggestions] = useState<TaxpayerSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  const [formData, setFormData] = useState({
    tin: "",
    name: "",
    substreet_street_brgy: "",
    district_city_zip: "",
    tax_type: "",
    sale_type: "invoice",
    gross_taxable: "",
    total_actual_amount: "",
    invoice_number: "",
    cheque: [] as string[],
    voucher: [] as string[],
    invoice: [] as string[],
    doc_2307: [] as string[],
    deposit_slip: [] as string[],
  })

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

  // Format number with commas
  const formatNumberWithCommas = (value: string): string => {
    if (!value) return ""
    const numericValue = value.replace(/,/g, "")
    if (isNaN(Number(numericValue))) return value
    return Number(numericValue).toLocaleString()
  }

  // Remove commas from formatted number
  const removeCommas = (value: string): string => {
    return value.replace(/,/g, "")
  }

  // Search taxpayers based on TIN prefix
  const searchTaxpayers = async (tinPrefix: string) => {
    if (tinPrefix.length < 3) {
      setTaxpayerSuggestions([])
      setShowSuggestions(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from("taxpayer_listings")
        .select("tin, registered_name, substreet_street_brgy, district_city_zip")
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

  // Handle taxpayer suggestion selection
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

  const handleFileUpload = useCallback((field: keyof typeof formData, files: FileList | null) => {
    if (!files) return

    const fileNames = Array.from(files).map((file) => file.name)
    setFormData((prev) => ({
      ...prev,
      [field]: [...(prev[field] as string[]), ...fileNames],
    }))
  }, [])

  const removeFile = useCallback((field: keyof typeof formData, index: number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: (prev[field] as string[]).filter((_, i) => i !== index),
    }))
  }, [])

  // Check if required files are uploaded
  const areRequiredFilesUploaded = (): boolean => {
    return formData.voucher.length > 0 && formData.deposit_slip.length > 0
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
            type: "sales", // Default type for sales records
            date_added: format(new Date(), "yyyy-MM-dd"),
            user_uuid: user?.id || null,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !taxMonth) {
      alert("Please select a Tax Month.")
      return
    }

    if (!areRequiredFilesUploaded()) {
      alert("Please upload required files: Voucher and Deposit Slip")
      return
    }

    setLoading(true)
    try {
      // Get or create taxpayer listing
      const taxpayerListingId = await getOrCreateTaxpayerListing({
        tin: formData.tin,
        name: formData.name,
        substreet_street_brgy: formData.substreet_street_brgy,
        district_city_zip: formData.district_city_zip,
      })

      const salesData = {
        user_uuid: user.id,
        tin_id: taxpayerListingId, // Use tin_id instead of taxpayer_listing_id
        tax_month: taxMonth,
        tin: formData.tin,
        name: formData.name,
        substreet_street_brgy: formData.substreet_street_brgy,
        district_city_zip: formData.district_city_zip,
        tax_type: formData.tax_type,
        sale_type: formData.sale_type,
        gross_taxable: formData.gross_taxable ? Number.parseFloat(removeCommas(formData.gross_taxable)) : null,
        total_actual_amount: formData.total_actual_amount
          ? Number.parseFloat(removeCommas(formData.total_actual_amount))
          : null,
        invoice_number: formData.invoice_number || null,
        pickup_date: pickupDate ? format(pickupDate, "yyyy-MM-dd") : null,
        cheque: formData.cheque.length > 0 ? formData.cheque : null,
        voucher: formData.voucher.length > 0 ? formData.voucher : null,
        invoice: formData.invoice.length > 0 ? formData.invoice : null,
        doc_2307: formData.doc_2307.length > 0 ? formData.doc_2307 : null,
        deposit_slip: formData.deposit_slip.length > 0 ? formData.deposit_slip : null,
      }

      const { error } = await supabase.from("sales").insert([salesData])

      if (error) throw error

      // Reset form
      setFormData({
        tin: "",
        name: "",
        substreet_street_brgy: "",
        district_city_zip: "",
        tax_type: "",
        sale_type: "invoice",
        gross_taxable: "",
        total_actual_amount: "",
        invoice_number: "",
        cheque: [],
        voucher: [],
        invoice: [],
        doc_2307: [],
        deposit_slip: [],
      })
      setTaxMonth("")
      setPickupDate(undefined)
      setTaxpayerSuggestions([])
      setShowSuggestions(false)
      setOpen(false)
      onSalesAdded()
    } catch (error) {
      console.error("Error adding sales record:", error)
      alert("Error adding sales record. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const FileUploadArea = ({
    field,
    label,
    required = false,
  }: {
    field: keyof typeof formData
    label: string
    required?: boolean
  }) => (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-[#001f3f]">
        {label} {required && "*"}
      </Label>
      <div className="border-2 border-dashed border-[#001f3f] rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
        <input
          type="file"
          multiple
          accept="image/*,application/pdf"
          onChange={(e) => handleFileUpload(field, e.target.files)}
          className="hidden"
          id={`file-${field}`}
        />
        <label htmlFor={`file-${field}`} className="cursor-pointer">
          <Upload className="mx-auto h-8 w-8 text-[#001f3f] mb-2" />
          <p className="text-sm text-[#001f3f]/60">
            Select tax month & TIN first<br />
            <span className="block mt-1">Accepted: <span className="font-semibold">Image</span> or <span className="font-semibold">PDF</span> files</span>
          </p>
        </label>
      </div>
      {(formData[field] as string[]).length > 0 && (
        <div className="space-y-1">
          {(formData[field] as string[]).map((fileName, index) => (
            <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
              <span className="text-sm text-[#001f3f] truncate">{fileName}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeFile(field, index)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg">
          <Plus className="h-4 w-4 mr-2" />
          Add Sales Record
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white text-[#001f3f]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#001f3f]">Add Sales Record</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* First Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tax_month" className="text-sm font-medium text-[#001f3f]">
                Tax Month *
              </Label>
              <Select value={taxMonth} onValueChange={setTaxMonth} required>
                <SelectTrigger className="w-full bg-white text-[#001f3f] border-[#001f3f]">
                  <SelectValue placeholder="Select tax month..." />
                </SelectTrigger>
                <SelectContent>
                  {taxMonthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-white">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 relative">
              <Label htmlFor="tin" className="text-sm font-medium text-[#001f3f]">
                TIN # *
              </Label>
              <Input
                id="tin"
                value={formData.tin}
                onChange={(e) => handleTinChange(e.target.value)}
                placeholder="000-000-000-000..."
                required
                className="bg-white text-[#001f3f] border-[#001f3f]"
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
          </div>

          {/* Second Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-[#001f3f]">
                Name *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Company/Individual name"
                required
                className="bg-white text-[#001f3f] border-[#001f3f]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gross_taxable" className="text-sm font-medium text-[#001f3f]">
                Gross Taxable *
              </Label>
              <Input
                id="gross_taxable"
                type="text"
                value={formatNumberWithCommas(formData.gross_taxable)}
                onChange={(e) => {
                  const rawValue = removeCommas(e.target.value)
                  if (rawValue === "" || /^\d*\.?\d*$/.test(rawValue)) {
                    setFormData({ ...formData, gross_taxable: rawValue })
                  }
                }}
                placeholder="0"
                className="bg-white text-[#001f3f] border-[#001f3f]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_actual_amount" className="text-sm font-medium text-[#001f3f]">
                Total Actual Amount
              </Label>
              <Input
                id="total_actual_amount"
                type="text"
                value={formatNumberWithCommas(formData.total_actual_amount)}
                onChange={(e) => {
                  const rawValue = removeCommas(e.target.value)
                  if (rawValue === "" || /^\d*\.?\d*$/.test(rawValue)) {
                    setFormData({ ...formData, total_actual_amount: rawValue })
                  }
                }}
                placeholder="0"
                className="bg-white text-[#001f3f] border-[#001f3f]"
              />
            </div>
          </div>

          {/* Third Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="substreet_street_brgy" className="text-sm font-medium text-[#001f3f]">
                Substreet/Street/Barangay
              </Label>
              <Input
                id="substreet_street_brgy"
                value={formData.substreet_street_brgy}
                onChange={(e) => setFormData({ ...formData, substreet_street_brgy: e.target.value })}
                placeholder="Address details"
                className="bg-white text-[#001f3f] border-[#001f3f]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="district_city_zip" className="text-sm font-medium text-[#001f3f]">
                District/City/ZIP
              </Label>
              <Input
                id="district_city_zip"
                value={formData.district_city_zip}
                onChange={(e) => setFormData({ ...formData, district_city_zip: e.target.value })}
                placeholder="City and ZIP code"
                className="bg-white text-[#001f3f] border-[#001f3f]"
              />
            </div>
          </div>

          {/* Fourth Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoice_number" className="text-sm font-medium text-[#001f3f]">
                Invoice Number
              </Label>
              <Input
                id="invoice_number"
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                placeholder="Invoice number"
                className="bg-white text-[#001f3f] border-[#001f3f]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax_type" className="text-sm font-medium text-[#001f3f]">
                Tax Type *
              </Label>
              <Select
                value={formData.tax_type}
                onValueChange={(value) => setFormData({ ...formData, tax_type: value })}
              >
                <SelectTrigger className="bg-white text-[#001f3f] border-[#001f3f]">
                  <SelectValue placeholder="Select tax type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vat" className="text-white">
                    VAT
                  </SelectItem>
                  <SelectItem value="non-vat" className="text-white">
                    Non-VAT
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pickup_date" className="text-sm font-medium text-[#001f3f]">
                Pickup Date
              </Label>
              <div className="flex items-center space-x-2">
                <Input
                  type="date"
                  value={pickupDate ? format(pickupDate, "yyyy-MM-dd") : ""}
                  onChange={(e) => {
                    const newDate = new Date(e.target.value)
                    if (!isNaN(newDate.getTime())) {
                      setPickupDate(newDate)
                    }
                  }}
                  className="bg-white text-[#001f3f] border-[#001f3f] flex-1"
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="border-[#001f3f] text-[#001f3f] hover:bg-[#001f3f]/10 bg-transparent"
                    >
                      <CalendarIcon className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white text-[#001f3f]" align="start">
                    <Calendar
                      mode="single"
                      selected={pickupDate}
                      onSelect={setPickupDate}
                      disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Fifth Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sale_type" className="text-sm font-medium text-[#001f3f]">
                Sale Type *
              </Label>
              <Select
                value={formData.sale_type}
                onValueChange={(value) => setFormData({ ...formData, sale_type: value })}
              >
                <SelectTrigger className="bg-white text-[#001f3f] border-[#001f3f]">
                  <SelectValue placeholder="Select sale type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice" className="text-white">
                    Invoice
                  </SelectItem>
                  <SelectItem value="non-invoice" className="text-white">
                    Non-Invoice
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* File Uploads Section */}
          <div className="space-y-4">
            <div className="border-t pt-4">
              <h3 className="text-lg font-medium text-[#001f3f] mb-4">File Uploads (Images and PDF Accepted)</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Required:</span> None | {" "}
                  <span className="font-medium">Optional:</span> Voucher, Deposit Slip , Cheque, Invoice, Doc 2307
                </p>
              </div>
            </div>

            {/* First row of file uploads */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FileUploadArea field="deposit_slip" label="Deposit Slip"/>
              <FileUploadArea field="voucher" label="Voucher"/>
            </div>

            {/* Second row of file uploads */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FileUploadArea field="cheque" label="Cheque" />
              <FileUploadArea field="invoice" label="Invoice" />
              <FileUploadArea field="doc_2307" label="Doc 2307" />
            </div>
          </div>

          <DialogFooter className="flex gap-3 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="px-6 border-[#001f3f] text-white hover:bg-[#001f3f]/10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6"
            >
              {loading ? "Adding..." : "Add Sales Record"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
