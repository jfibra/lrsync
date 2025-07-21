"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalendarIcon, Plus, Upload, X, AlertCircle } from "lucide-react"
import { format } from "date-fns"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase/client"
import type { TaxpayerListing } from "@/types/taxpayer"

interface AddSalesModalProps {
  onSalesAdded?: () => void
}

interface TaxMonthOption {
  label: string
  value: string
}

interface FileUpload {
  id: string
  name: string
  files: File[]
  required: boolean
  uploading: boolean
  uploadedUrls: string[]
}

// Laravel API Upload function
const uploadToLaravelAPI = async (file: File, taxMonth: string, fileName: string): Promise<string> => {
  const taxDate = new Date(taxMonth)
  const taxYear = taxDate.getFullYear().toString()
  const taxMonthNum = String(taxDate.getMonth() + 1).padStart(2, "0")
  const taxDay = String(taxDate.getDate()).padStart(2, "0")

  const formData = new FormData()
  formData.append("file", file)
  formData.append("tax_month", taxMonthNum)
  formData.append("tax_year", taxYear)
  formData.append("tax_date", taxDay)
  formData.append("file_name", fileName)

  // Construct the correct API URL
  const apiUrl = `${process.env.NEXT_PUBLIC_NEXT_API_ROUTE_LR}/upload-tax-file`

  console.log("Uploading to:", apiUrl)
  console.log("Form data:", {
    fileName,
    tax_month: taxMonthNum,
    tax_year: taxYear,
    tax_date: taxDay,
    fileSize: file.size,
    fileType: file.type,
  })

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      body: formData,
      headers: {
        Accept: "application/json",
        // Add CORS headers to the request
        "Access-Control-Allow-Origin": "*", // This is NOT a solution, server must be configured
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    })

    console.log("Response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Upload error response:", errorText)
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
    }

    const responseText = await response.text()
    console.log("Raw response:", responseText)

    // Check if response is empty
    if (!responseText.trim()) {
      throw new Error("Empty response from server")
    }

    try {
      const result = JSON.parse(responseText)
      console.log("Parsed response:", result)

      // Handle the API response format: {"0": {"url": "..."}, "success": true}
      if (result.success && result["0"] && result["0"].url) {
        return result["0"].url
      } else {
        throw new Error("Invalid response structure: missing URL in response")
      }
    } catch (parseError) {
      console.error("JSON parse error:", parseError)
      console.error("Response was:", responseText)
      throw new Error(`Invalid JSON response from server: ${parseError}`)
    }
  } catch (networkError) {
    console.error("Network error:", networkError)
    throw new Error(`Network error: ${networkError.message}`)
  }
}

export function AddSalesModal({ onSalesAdded }: AddSalesModalProps) {
  const { profile, user } = useAuth()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Form state
  const [taxMonth, setTaxMonth] = useState("")
  const [tinSearch, setTinSearch] = useState("")
  const [selectedTin, setSelectedTin] = useState<TaxpayerListing | null>(null)
  const [name, setName] = useState("")
  const [substreetStreetBrgy, setSubstreetStreetBrgy] = useState("")
  const [districtCityZip, setDistrictCityZip] = useState("")
  const [grossTaxable, setGrossTaxable] = useState("")
  const [totalActualAmount, setTotalActualAmount] = useState("")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [taxType, setTaxType] = useState("")
  const [saleType, setSaleType] = useState("")
  const [pickupDate, setPickupDate] = useState<Date>(new Date())

  // TIN search results
  const [tinResults, setTinResults] = useState<TaxpayerListing[]>([])
  const [searchingTin, setSearchingTin] = useState(false)
  const [showTinDropdown, setShowTinDropdown] = useState(false)

  // File uploads with Laravel API support
  const [fileUploads, setFileUploads] = useState<FileUpload[]>([
    { id: "cheque", name: "Cheque", files: [], required: true, uploading: false, uploadedUrls: [] },
    { id: "voucher", name: "Voucher", files: [], required: true, uploading: false, uploadedUrls: [] },
    { id: "invoice", name: "Invoice", files: [], required: true, uploading: false, uploadedUrls: [] },
    { id: "doc_2307", name: "Doc 2307", files: [], required: false, uploading: false, uploadedUrls: [] },
    { id: "deposit_slip", name: "Deposit Slip", files: [], required: false, uploading: false, uploadedUrls: [] },
  ])

  // Generate tax month options (36 months from current month backwards)
  const generateTaxMonthOptions = (): TaxMonthOption[] => {
    const options: TaxMonthOption[] = []
    const currentDate = new Date()

    for (let i = 0; i < 36; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
      const year = date.getFullYear()
      const month = date.getMonth()

      // Get last day of the month
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

  // Format TIN input to add dashes after every 3 digits (no character limit)
  const formatTinInput = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, "")

    // Add dashes after every 3 digits
    const formatted = digits.replace(/(\d{3})(?=\d)/g, "$1-")

    return formatted
  }

  // Search TIN in taxpayer_listings
  const searchTin = async (searchTerm: string) => {
    // Remove dashes for database search
    const cleanTin = searchTerm.replace(/-/g, "")

    if (cleanTin.length < 3) {
      setTinResults([])
      setShowTinDropdown(false)
      return
    }

    setSearchingTin(true)
    try {
      const { data, error } = await supabase
        .from("taxpayer_listings")
        .select("*")
        .ilike("tin", `%${cleanTin}%`)
        .eq("type", "sales")
        .limit(10)

      if (error) throw error
      setTinResults(data || [])
      setShowTinDropdown((data || []).length > 0)
    } catch (error) {
      console.error("Error searching TIN:", error)
      setTinResults([])
      setShowTinDropdown(false)
    } finally {
      setSearchingTin(false)
    }
  }

  // Handle TIN input change
  const handleTinInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTinInput(e.target.value)
    setTinSearch(formatted)
    setSelectedTin(null)
    searchTin(formatted)
  }

  // Handle TIN selection from dropdown
  const handleTinSelect = (taxpayer: TaxpayerListing) => {
    setSelectedTin(taxpayer)
    setTinSearch(formatTinInput(taxpayer.tin))
    setName(taxpayer.registered_name || "")
    setSubstreetStreetBrgy(taxpayer.substreet_street_brgy || "")
    setDistrictCityZip(taxpayer.district_city_zip || "")
    setShowTinDropdown(false)
  }

  // Format currency amounts with commas
  const formatCurrencyAmount = (value: string) => {
    const numericValue = value.replace(/[^\d]/g, "")
    if (!numericValue) return ""
    return Number.parseInt(numericValue).toLocaleString()
  }

  const handleGrossTaxableChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrencyAmount(e.target.value)
    setGrossTaxable(formatted)
  }

  const handleTotalActualAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrencyAmount(e.target.value)
    setTotalActualAmount(formatted)
  }

  // Validate file type (images only)
  const isValidImageFile = (file: File): boolean => {
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    return validTypes.includes(file.type)
  }

  // Generate filename for Laravel API upload
  const generateFileName = (taxMonth: string, tin: string, fileType: string, originalFileName: string): string => {
    const taxDate = new Date(taxMonth)
    const currentDate = new Date()
    const dateStr = format(currentDate, "MMddyyyy")
    const cleanTin = tin.replace(/-/g, "")
    const fileExtension = originalFileName.split(".").pop()
    return `${cleanTin}-${fileType}-${dateStr}.${fileExtension}`
  }

  // Handle file uploads with Laravel API
  const handleFileChange = async (uploadId: string, files: FileList | null) => {
    if (!files || !taxMonth || !tinSearch) return

    const validFiles = Array.from(files).filter((file) => {
      if (!isValidImageFile(file)) {
        alert(`${file.name} is not a valid image file. Only JPEG, PNG, GIF, and WebP files are allowed.`)
        return false
      }
      return true
    })

    if (validFiles.length === 0) return

    // Check if API endpoint is configured
    if (!process.env.NEXT_PUBLIC_NEXT_API_ROUTE_LR) {
      alert("API endpoint not configured. Please check NEXT_PUBLIC_NEXT_API_ROUTE_LR environment variable.")
      return
    }

    // Set uploading state
    setFileUploads((prev) => prev.map((upload) => (upload.id === uploadId ? { ...upload, uploading: true } : upload)))

    try {
      const uploadPromises = validFiles.map(async (file) => {
        const fileName = generateFileName(taxMonth, tinSearch, uploadId, file.name)
        return await uploadToLaravelAPI(file, taxMonth, fileName)
      })

      const uploadedUrls = await Promise.all(uploadPromises)

      setFileUploads((prev) =>
        prev.map((upload) =>
          upload.id === uploadId
            ? {
                ...upload,
                files: [...upload.files, ...validFiles],
                uploadedUrls: [...upload.uploadedUrls, ...uploadedUrls],
                uploading: false,
              }
            : upload,
        ),
      )
    } catch (error) {
      console.error("Error uploading files:", error)
      alert(`Error uploading files: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`)

      setFileUploads((prev) =>
        prev.map((upload) => (upload.id === uploadId ? { ...upload, uploading: false } : upload)),
      )
    }
  }

  const removeFile = (uploadId: string, fileIndex: number) => {
    setFileUploads((prev) =>
      prev.map((upload) =>
        upload.id === uploadId
          ? {
              ...upload,
              files: upload.files.filter((_, index) => index !== fileIndex),
              uploadedUrls: upload.uploadedUrls.filter((_, index) => index !== fileIndex),
            }
          : upload,
      ),
    )
  }

  // Check if required files are uploaded
  const areRequiredFilesUploaded = (): boolean => {
    const requiredUploads = fileUploads.filter((upload) => upload.required)
    return requiredUploads.every((upload) => upload.files.length > 0)
  }

  // Reset form
  const resetForm = () => {
    setTaxMonth("")
    setTinSearch("")
    setSelectedTin(null)
    setName("")
    setSubstreetStreetBrgy("")
    setDistrictCityZip("")
    setGrossTaxable("")
    setTotalActualAmount("")
    setInvoiceNumber("")
    setTaxType("")
    setSaleType("")
    setPickupDate(new Date())
    setFileUploads((prev) =>
      prev.map((upload) => ({
        ...upload,
        files: [],
        uploadedUrls: [],
        uploading: false,
      })),
    )
    setShowTinDropdown(false)
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !user) return

    // Check required files
    if (!areRequiredFilesUploaded()) {
      alert("Please upload required files: Cheque, Voucher, and Invoice")
      return
    }

    setLoading(true)
    try {
      let tinId = selectedTin?.id
      const cleanTin = tinSearch.replace(/-/g, "")

      // If no TIN selected, create new taxpayer listing
      if (!selectedTin && cleanTin) {
        const { data: newTaxpayer, error: taxpayerError } = await supabase
          .from("taxpayer_listings")
          .insert({
            tin: cleanTin,
            registered_name: name,
            substreet_street_brgy: substreetStreetBrgy,
            district_city_zip: districtCityZip,
            type: "sales",
            user_uuid: user.id, // Save the logged-in user's UUID
            user_full_name: profile.full_name,
          })
          .select()
          .single()

        if (taxpayerError) throw taxpayerError
        tinId = newTaxpayer.id
      }

      // Prepare file URLs from Laravel API uploads
      const fileArrays = {
        cheque: fileUploads.find((f) => f.id === "cheque")?.uploadedUrls || [],
        voucher: fileUploads.find((f) => f.id === "voucher")?.uploadedUrls || [],
        doc_2307: fileUploads.find((f) => f.id === "doc_2307")?.uploadedUrls || [],
        invoice: fileUploads.find((f) => f.id === "invoice")?.uploadedUrls || [],
        deposit_slip: fileUploads.find((f) => f.id === "deposit_slip")?.uploadedUrls || [],
      }

      // Format pickup date properly
      const formattedPickupDate = pickupDate ? format(pickupDate, "yyyy-MM-dd") : null

      // Create sales record with Laravel API URLs
      const salesData = {
        tax_month: taxMonth,
        tin_id: tinId,
        tin: cleanTin,
        name: name,
        type: "sales",
        substreet_street_brgy: substreetStreetBrgy || null,
        district_city_zip: districtCityZip || null,
        gross_taxable: Number.parseFloat(grossTaxable.replace(/,/g, "")) || 0,
        total_actual_amount: Number.parseFloat(totalActualAmount.replace(/,/g, "")) || 0,
        invoice_number: invoiceNumber || null,
        tax_type: taxType,
        sale_type: saleType,
        pickup_date: formattedPickupDate,
        cheque: fileArrays.cheque,
        voucher: fileArrays.voucher,
        doc_2307: fileArrays.doc_2307,
        invoice: fileArrays.invoice,
        deposit_slip: fileArrays.deposit_slip,
        user_uuid: user.id, // Save the logged-in user's UUID
        user_full_name: profile.full_name,
      }

      console.log("Sales data to insert:", salesData)

      const { error: salesError } = await supabase.from("sales").insert(salesData)

      if (salesError) {
        console.error("Sales insert error:", salesError)
        throw salesError
      }

      // Success
      setOpen(false)
      resetForm()
      onSalesAdded?.()
    } catch (error) {
      console.error("Error adding sales record:", error)
      alert("Error adding sales record. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200">
          <Plus className="h-4 w-4 mr-2" />
          Add Sales Record
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto bg-white">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-2xl font-bold text-gray-900">Add Sales Record</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tax Month */}
            <div className="space-y-2">
              <Label htmlFor="tax-month" className="text-sm font-medium text-gray-700">
                Tax Month *
              </Label>
              <Select value={taxMonth} onValueChange={setTaxMonth} required>
                <SelectTrigger>
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

            {/* TIN Search */}
            <div className="space-y-2 relative">
              <Label htmlFor="tin" className="text-sm font-medium text-gray-700">
                TIN # *
              </Label>
              <Input
                id="tin"
                value={tinSearch}
                onChange={handleTinInputChange}
                placeholder="000-000-000-000..."
                onFocus={() => {
                  if (tinResults.length > 0) {
                    setShowTinDropdown(true)
                  }
                }}
                onBlur={() => {
                  // Delay hiding dropdown to allow for clicks
                  setTimeout(() => setShowTinDropdown(false), 200)
                }}
                required
              />

              {/* TIN Dropdown */}
              {showTinDropdown && (
                <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {searchingTin ? (
                    <div className="p-3 text-sm text-gray-500">Searching...</div>
                  ) : tinResults.length > 0 ? (
                    tinResults.map((taxpayer) => (
                      <button
                        key={taxpayer.id}
                        type="button"
                        className="w-full text-left p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 focus:bg-blue-50 focus:outline-none"
                        onClick={() => handleTinSelect(taxpayer)}
                      >
                        <div className="font-medium text-gray-900">{formatTinInput(taxpayer.tin)}</div>
                        <div className="text-sm text-gray-600">{taxpayer.registered_name}</div>
                      </button>
                    ))
                  ) : (
                    <div className="p-3 text-sm text-gray-500">No matching TIN found</div>
                  )}
                </div>
              )}
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                Name *
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Company/Individual name"
                required
              />
            </div>

            {/* Gross Taxable and Total Actual Amount - Side by Side */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="gross-taxable" className="text-sm font-medium text-gray-700">
                    Gross Taxable *
                  </Label>
                  <Input
                    id="gross-taxable"
                    value={grossTaxable}
                    onChange={handleGrossTaxableChange}
                    placeholder="0"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="total-actual-amount" className="text-sm font-medium text-gray-700">
                    Total Actual Amount
                  </Label>
                  <Input
                    id="total-actual-amount"
                    value={totalActualAmount}
                    onChange={handleTotalActualAmountChange}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Substreet/Street/Barangay */}
            <div className="space-y-2">
              <Label htmlFor="substreet" className="text-sm font-medium text-gray-700">
                Substreet/Street/Barangay
              </Label>
              <Input
                id="substreet"
                value={substreetStreetBrgy}
                onChange={(e) => setSubstreetStreetBrgy(e.target.value)}
                placeholder="Address details"
              />
            </div>

            {/* District/City/ZIP */}
            <div className="space-y-2">
              <Label htmlFor="district" className="text-sm font-medium text-gray-700">
                District/City/ZIP
              </Label>
              <Input
                id="district"
                value={districtCityZip}
                onChange={(e) => setDistrictCityZip(e.target.value)}
                placeholder="City and ZIP code"
              />
            </div>

            {/* Invoice Number */}
            <div className="space-y-2">
              <Label htmlFor="invoice-number" className="text-sm font-medium text-gray-700">
                Invoice Number
              </Label>
              <Input
                id="invoice-number"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Invoice number"
              />
            </div>

            {/* Tax Type */}
            <div className="space-y-2">
              <Label htmlFor="tax-type" className="text-sm font-medium text-gray-700">
                Tax Type *
              </Label>
              <Select value={taxType} onValueChange={setTaxType} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select tax type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vat">VAT</SelectItem>
                  <SelectItem value="non-vat">Non-VAT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sale Type */}
            <div className="space-y-2">
              <Label htmlFor="sale-type" className="text-sm font-medium text-gray-700">
                Sale Type *
              </Label>
              <Select value={saleType} onValueChange={setSaleType} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select sale type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="non-invoice">Non-Invoice</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Pickup Date */}
            <div className="space-y-2">
              <Label htmlFor="pickup-date" className="text-sm font-medium text-gray-700">
                Pickup Date
              </Label>
              <div className="flex items-center space-x-2">
                <CalendarIcon className="h-4 w-4 text-gray-500" />
                <Input
                  type="date"
                  value={format(pickupDate, "yyyy-MM-dd")}
                  onChange={(e) => {
                    const newDate = new Date(e.target.value)
                    if (!isNaN(newDate.getTime())) {
                      setPickupDate(newDate)
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* File Uploads Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">File Uploads (Images Only)</h3>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 text-sm text-blue-800">
                <AlertCircle className="h-4 w-4" />
                <span>Required: Cheque, Voucher, Invoice | Optional: Doc 2307, Deposit Slip</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {fileUploads.map((upload) => (
                <div key={upload.id} className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    {upload.name}
                    {upload.required && <span className="text-red-500 text-xs">*</span>}
                  </Label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
                      upload.required && upload.files.length === 0
                        ? "border-red-300 hover:border-red-400 bg-red-50"
                        : "border-gray-300 hover:border-gray-400 bg-gray-50"
                    }`}
                  >
                    <input
                      id={upload.id}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileChange(upload.id, e.target.files)}
                      disabled={upload.uploading || !taxMonth || !tinSearch}
                    />
                    <label
                      htmlFor={upload.id}
                      className={`flex flex-col items-center justify-center cursor-pointer ${
                        upload.uploading || !taxMonth || !tinSearch ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      {upload.uploading ? (
                        <>
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
                          <span className="text-sm text-blue-600 font-medium">Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-gray-400 mb-2" />
                          <span className="text-sm text-gray-600 text-center">
                            {!taxMonth || !tinSearch ? (
                              <>Select tax month & TIN first</>
                            ) : (
                              <>Select tax month & TIN first</>
                            )}
                          </span>
                        </>
                      )}
                    </label>

                    {upload.files.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {upload.files.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between text-xs bg-white p-2 rounded border"
                          >
                            <span className="truncate flex-1 font-medium">{file.name}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(upload.id, index)}
                              className="h-6 w-6 p-0 hover:bg-red-100 ml-2"
                              disabled={upload.uploading}
                            >
                              <X className="h-3 w-3 text-red-500" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !areRequiredFilesUploaded() || fileUploads.some((f) => f.uploading)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Adding Sales Record...
                </>
              ) : (
                "Add Sales Record"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
