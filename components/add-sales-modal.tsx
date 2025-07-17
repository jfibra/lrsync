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

// S3 Upload function
const uploadToS3 = async (file: File, key: string): Promise<string> => {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("key", key)

  const response = await fetch("/api/upload-s3", {
    method: "POST",
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`)
  }

  const result = await response.json()
  return result.url
}

export function AddSalesModal({ onSalesAdded }: AddSalesModalProps) {
  const { profile } = useAuth()
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
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [taxType, setTaxType] = useState("")
  const [pickupDate, setPickupDate] = useState<Date>(new Date())

  // TIN search results
  const [tinResults, setTinResults] = useState<TaxpayerListing[]>([])
  const [searchingTin, setSearchingTin] = useState(false)
  const [showTinDropdown, setShowTinDropdown] = useState(false)

  // File uploads with S3 support
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

  // Format TIN input to 000-000-000 pattern
  const formatTinInput = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, "")

    // Limit to 9 digits
    const limitedDigits = digits.slice(0, 9)

    // Apply formatting
    if (limitedDigits.length <= 3) {
      return limitedDigits
    } else if (limitedDigits.length <= 6) {
      return `${limitedDigits.slice(0, 3)}-${limitedDigits.slice(3)}`
    } else {
      return `${limitedDigits.slice(0, 3)}-${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6)}`
    }
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

  // Format gross taxable with commas
  const formatGrossTaxable = (value: string) => {
    const numericValue = value.replace(/[^\d]/g, "")
    if (!numericValue) return ""
    return Number.parseInt(numericValue).toLocaleString()
  }

  const handleGrossTaxableChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatGrossTaxable(e.target.value)
    setGrossTaxable(formatted)
  }

  // Validate file type (images only)
  const isValidImageFile = (file: File): boolean => {
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    return validTypes.includes(file.type)
  }

  // Generate S3 key for file upload
  const generateS3Key = (taxMonth: string, tin: string, fileType: string, fileName: string): string => {
    const taxDate = new Date(taxMonth)
    const taxYear = taxDate.getFullYear()
    const taxMonthNum = String(taxDate.getMonth() + 1).padStart(2, "0")
    const taxDay = String(taxDate.getDate()).padStart(2, "0")

    const currentDate = new Date()
    const dateStr = format(currentDate, "MMddyyyy")

    const cleanTin = tin.replace(/-/g, "")
    const fileExtension = fileName.split(".").pop()

    return `lrsync/${taxYear}/${taxMonthNum}/${taxDay}/${cleanTin}-${fileType}-${dateStr}.${fileExtension}`
  }

  // Handle file uploads with S3
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

    // Set uploading state
    setFileUploads((prev) => prev.map((upload) => (upload.id === uploadId ? { ...upload, uploading: true } : upload)))

    try {
      const uploadPromises = validFiles.map(async (file) => {
        const s3Key = generateS3Key(taxMonth, tinSearch, uploadId, file.name)
        return await uploadToS3(file, s3Key)
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
      alert("Error uploading files. Please try again.")

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
    setInvoiceNumber("")
    setTaxType("")
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
    if (!profile) return

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
            user_uuid: profile.user_id,
            user_full_name: profile.full_name,
          })
          .select()
          .single()

        if (taxpayerError) throw taxpayerError
        tinId = newTaxpayer.id
      }

      // Prepare file URLs from S3 uploads
      const fileArrays = {
        cheque: fileUploads.find((f) => f.id === "cheque")?.uploadedUrls || [],
        voucher: fileUploads.find((f) => f.id === "voucher")?.uploadedUrls || [],
        doc_2307: fileUploads.find((f) => f.id === "doc_2307")?.uploadedUrls || [],
        invoice: fileUploads.find((f) => f.id === "invoice")?.uploadedUrls || [],
        deposit_slip: fileUploads.find((f) => f.id === "deposit_slip")?.uploadedUrls || [],
      }

      // Format pickup date properly
      const formattedPickupDate = pickupDate ? format(pickupDate, "yyyy-MM-dd") : null

      // Create sales record with S3 URLs
      const salesData = {
        tax_month: taxMonth,
        tin_id: tinId,
        tin: cleanTin,
        name: name,
        type: "sales",
        substreet_street_brgy: substreetStreetBrgy || null,
        district_city_zip: districtCityZip || null,
        gross_taxable: Number.parseFloat(grossTaxable.replace(/,/g, "")) || 0,
        invoice_number: invoiceNumber || null,
        tax_type: taxType,
        pickup_date: formattedPickupDate,
        cheque: fileArrays.cheque,
        voucher: fileArrays.voucher,
        doc_2307: fileArrays.doc_2307,
        invoice: fileArrays.invoice,
        deposit_slip: fileArrays.deposit_slip,
        user_uuid: profile.user_id,
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
        <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200">
          <Plus className="h-4 w-4 mr-2" />
          Add Sales Record
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Add Sales Record
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tax Month */}
            <div className="space-y-2">
              <Label htmlFor="tax-month" className="text-sm font-medium text-gray-700">
                Tax Month *
              </Label>
              <Select value={taxMonth} onValueChange={setTaxMonth} required>
                <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
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
                placeholder="000-000-000"
                className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
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
                className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            {/* Gross Taxable */}
            <div className="space-y-2">
              <Label htmlFor="gross-taxable" className="text-sm font-medium text-gray-700">
                Gross Taxable *
              </Label>
              <Input
                id="gross-taxable"
                value={grossTaxable}
                onChange={handleGrossTaxableChange}
                placeholder="0"
                className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            {/* Address Fields */}
            <div className="space-y-2">
              <Label htmlFor="substreet" className="text-sm font-medium text-gray-700">
                Substreet/Street/Barangay
              </Label>
              <Input
                id="substreet"
                value={substreetStreetBrgy}
                onChange={(e) => setSubstreetStreetBrgy(e.target.value)}
                placeholder="Address details"
                className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="district" className="text-sm font-medium text-gray-700">
                District/City/ZIP
              </Label>
              <Input
                id="district"
                value={districtCityZip}
                onChange={(e) => setDistrictCityZip(e.target.value)}
                placeholder="City and ZIP code"
                className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
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
                className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            {/* Tax Type */}
            <div className="space-y-2">
              <Label htmlFor="tax-type" className="text-sm font-medium text-gray-700">
                Tax Type *
              </Label>
              <Select value={taxType} onValueChange={setTaxType} required>
                <SelectTrigger className="border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="Select tax type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vat">VAT</SelectItem>
                  <SelectItem value="non-vat">Non-VAT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Pickup Date */}
            <div className="space-y-2 md:col-span-2">
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
                  className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* File Uploads */}
          <div className="space-y-4">
            <Label className="text-base font-semibold text-gray-700">File Uploads (Images Only)</Label>
            <div className="text-sm text-gray-600 mb-4">
              <AlertCircle className="inline h-4 w-4 mr-1" />
              Required: Cheque, Voucher, Invoice | Optional: Doc 2307, Deposit Slip
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fileUploads.map((upload) => (
                <div key={upload.id} className="space-y-2">
                  <Label htmlFor={upload.id} className="text-sm font-medium text-gray-700 flex items-center">
                    {upload.name}
                    {upload.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-4 transition-colors ${
                      upload.required && upload.files.length === 0
                        ? "border-red-300 hover:border-red-400"
                        : "border-gray-300 hover:border-blue-400"
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
                          <span className="text-sm text-blue-600">Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-gray-400 mb-2" />
                          <span className="text-sm text-gray-500">
                            {!taxMonth || !tinSearch ? "Select tax month & TIN first" : "Click to upload images"}
                          </span>
                        </>
                      )}
                    </label>

                    {upload.files.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {upload.files.map((file, index) => (
                          <div key={index} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded">
                            <span className="truncate flex-1">{file.name}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(upload.id, index)}
                              className="h-4 w-4 p-0 hover:bg-red-100 ml-2"
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
          <div className="flex justify-end space-x-4 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="border-gray-200 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !areRequiredFilesUploaded() || fileUploads.some((f) => f.uploading)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Adding...
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
