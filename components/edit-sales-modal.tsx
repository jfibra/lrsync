"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalendarIcon, Upload, X, AlertCircle } from "lucide-react"
import { format } from "date-fns"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase/client"
import type { Sales } from "@/types/sales"
import type { TaxpayerListing } from "@/types/taxpayer"

interface EditSalesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sale: Sales | null
  onSalesUpdated?: () => void
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
  existingUrls: string[]
}

// Laravel API Upload function with proper parameters
const uploadToLaravelAPI = async (
  file: File,
  taxMonth: string,
  tin: string,
  fileType: string,
  existingFileCount: number,
): Promise<string> => {
  const taxDate = new Date(taxMonth)
  const taxYear = taxDate.getFullYear().toString()
  const taxMonthNum = String(taxDate.getMonth() + 1).padStart(2, "0")
  const taxDay = String(taxDate.getDate()).padStart(2, "0")

  const formData = new FormData()
  formData.append("file", file)
  formData.append("tax_month", taxMonthNum)
  formData.append("tax_year", taxYear)
  formData.append("tax_date", taxDay)

  // Generate filename with proper indexing
  const cleanTin = tin.replace(/-/g, "")
  const fileExtension = file.name.split(".").pop()
  const baseFileName = `${cleanTin}-${fileType}-${format(new Date(), "MMddyyyy")}`
  const fileName =
    existingFileCount > 0
      ? `${baseFileName}-${existingFileCount + 1}.${fileExtension}`
      : `${baseFileName}.${fileExtension}`

  formData.append("file_name", fileName)

  const apiUrl = `${process.env.NEXT_PUBLIC_NEXT_API_ROUTE_LR}/upload-tax-file`

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      body: formData,
      headers: {
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Upload error response:", errorText)
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
    }

    const responseText = await response.text()

    if (!responseText.trim()) {
      throw new Error("Empty response from server")
    }

    const result = JSON.parse(responseText)

    if (result.success && result["0"] && result["0"].url) {
      return result["0"].url
    } else {
      throw new Error("Invalid response structure: missing URL in response")
    }
  } catch (error) {
    console.error("Network error:", error)
    throw new Error(`Network error: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

export function EditSalesModal({ open, onOpenChange, sale, onSalesUpdated }: EditSalesModalProps) {
  const { profile } = useAuth()
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

  // File uploads
  const [fileUploads, setFileUploads] = useState<FileUpload[]>([
    { id: "cheque", name: "Cheque", files: [], required: true, uploading: false, uploadedUrls: [], existingUrls: [] },
    { id: "voucher", name: "Voucher", files: [], required: true, uploading: false, uploadedUrls: [], existingUrls: [] },
    { id: "invoice", name: "Invoice", files: [], required: true, uploading: false, uploadedUrls: [], existingUrls: [] },
    {
      id: "doc_2307",
      name: "Doc 2307",
      files: [],
      required: false,
      uploading: false,
      uploadedUrls: [],
      existingUrls: [],
    },
    {
      id: "deposit_slip",
      name: "Deposit Slip",
      files: [],
      required: false,
      uploading: false,
      uploadedUrls: [],
      existingUrls: [],
    },
  ])

  // Initialize form with sale data
  useEffect(() => {
    if (sale && open) {
      setTaxMonth(sale.tax_month)
      setTinSearch(formatTinInput(sale.tin))
      setName(sale.name)
      setSubstreetStreetBrgy(sale.substreet_street_brgy || "")
      setDistrictCityZip(sale.district_city_zip || "")
      setGrossTaxable(sale.gross_taxable ? sale.gross_taxable.toLocaleString() : "")
      setInvoiceNumber(sale.invoice_number || "")
      setTaxType(sale.tax_type)
      setPickupDate(sale.pickup_date ? new Date(sale.pickup_date) : new Date())

      // Initialize file uploads with existing files
      setFileUploads((prev) =>
        prev.map((upload) => ({
          ...upload,
          existingUrls: (sale[upload.id as keyof Sales] as string[]) || [],
          files: [],
          uploadedUrls: [],
        })),
      )
    }
  }, [sale, open])

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

  // Format TIN input
  const formatTinInput = (value: string) => {
    const digits = value.replace(/\D/g, "")
    const limitedDigits = digits.slice(0, 9)

    if (limitedDigits.length <= 3) {
      return limitedDigits
    } else if (limitedDigits.length <= 6) {
      return `${limitedDigits.slice(0, 3)}-${limitedDigits.slice(3)}`
    } else {
      return `${limitedDigits.slice(0, 3)}-${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6)}`
    }
  }

  // Search TIN in taxpayer_listings
  const formatGrossTaxable = (value: string) => {
    const numericValue = value.replace(/[^\d]/g, "")
    if (!numericValue) return ""
    return Number.parseInt(numericValue).toLocaleString()
  }

  const handleGrossTaxableChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatGrossTaxable(e.target.value)
    setGrossTaxable(formatted)
  }

  // Validate file type
  const isValidImageFile = (file: File): boolean => {
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    return validTypes.includes(file.type)
  }

  // Handle file uploads
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

    if (!process.env.NEXT_PUBLIC_NEXT_API_ROUTE_LR) {
      alert("API endpoint not configured. Please check NEXT_PUBLIC_NEXT_API_ROUTE_LR environment variable.")
      return
    }

    setFileUploads((prev) => prev.map((upload) => (upload.id === uploadId ? { ...upload, uploading: true } : upload)))

    try {
      const currentUpload = fileUploads.find((u) => u.id === uploadId)
      const existingFileCount = (currentUpload?.existingUrls.length || 0) + (currentUpload?.uploadedUrls.length || 0)

      const uploadPromises = validFiles.map(async (file, index) => {
        return await uploadToLaravelAPI(file, taxMonth, tinSearch, uploadId, existingFileCount + index)
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

  // Remove existing file
  const removeExistingFile = (uploadId: string, fileIndex: number) => {
    setFileUploads((prev) =>
      prev.map((upload) =>
        upload.id === uploadId
          ? {
              ...upload,
              existingUrls: upload.existingUrls.filter((_, index) => index !== fileIndex),
            }
          : upload,
      ),
    )
  }

  // Remove new file
  const removeNewFile = (uploadId: string, fileIndex: number) => {
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

  // Check if required files are available
  const areRequiredFilesAvailable = (): boolean => {
    const requiredUploads = fileUploads.filter((upload) => upload.required)
    return requiredUploads.every((upload) => upload.existingUrls.length > 0 || upload.uploadedUrls.length > 0)
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !sale) return

    if (!areRequiredFilesAvailable()) {
      alert("Please ensure required files are available: Cheque, Voucher, and Invoice")
      return
    }

    setLoading(true)
    try {
      const tinId = sale.tin_id
      const cleanTin = tinSearch.replace(/-/g, "")

      // Prepare file URLs (combine existing and new uploads)
      const fileArrays = {
        cheque: [
          ...(fileUploads.find((f) => f.id === "cheque")?.existingUrls || []),
          ...(fileUploads.find((f) => f.id === "cheque")?.uploadedUrls || []),
        ],
        voucher: [
          ...(fileUploads.find((f) => f.id === "voucher")?.existingUrls || []),
          ...(fileUploads.find((f) => f.id === "voucher")?.uploadedUrls || []),
        ],
        doc_2307: [
          ...(fileUploads.find((f) => f.id === "doc_2307")?.existingUrls || []),
          ...(fileUploads.find((f) => f.id === "doc_2307")?.uploadedUrls || []),
        ],
        invoice: [
          ...(fileUploads.find((f) => f.id === "invoice")?.existingUrls || []),
          ...(fileUploads.find((f) => f.id === "invoice")?.uploadedUrls || []),
        ],
        deposit_slip: [
          ...(fileUploads.find((f) => f.id === "deposit_slip")?.existingUrls || []),
          ...(fileUploads.find((f) => f.id === "deposit_slip")?.uploadedUrls || []),
        ],
      }

      const formattedPickupDate = pickupDate ? format(pickupDate, "yyyy-MM-dd") : null

      // Update sales record
      const salesData = {
        tax_month: taxMonth,
        tin_id: tinId,
        tin: cleanTin,
        name: name,
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
        updated_at: new Date().toISOString(),
      }

      const { error: salesError } = await supabase.from("sales").update(salesData).eq("id", sale.id)

      if (salesError) {
        console.error("Sales update error:", salesError)
        throw salesError
      }

      // Success
      onOpenChange(false)
      onSalesUpdated?.()
    } catch (error) {
      console.error("Error updating sales record:", error)
      alert("Error updating sales record. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (!sale) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Edit Sales Record
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tax Month - Read Only */}
            <div className="space-y-2">
              <Label htmlFor="tax-month" className="text-sm font-medium text-gray-700">
                Tax Month (Read Only)
              </Label>
              <Input
                id="tax-month"
                value={taxMonthOptions.find((option) => option.value === taxMonth)?.label || taxMonth}
                readOnly
                className="border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed"
              />
            </div>

            {/* TIN Search - Read Only */}
            <div className="space-y-2 relative">
              <Label htmlFor="tin" className="text-sm font-medium text-gray-700">
                TIN # (Read Only)
              </Label>
              <Input
                id="tin"
                value={tinSearch}
                readOnly
                className="border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed"
              />
            </div>

            {/* Name - Read Only */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                Name (Read Only)
              </Label>
              <Input
                id="name"
                value={name}
                readOnly
                className="border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed"
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

            {/* Address Fields - Read Only */}
            <div className="space-y-2">
              <Label htmlFor="substreet" className="text-sm font-medium text-gray-700">
                Substreet/Street/Barangay (Read Only)
              </Label>
              <Input
                id="substreet"
                value={substreetStreetBrgy}
                readOnly
                className="border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="district" className="text-sm font-medium text-gray-700">
                District/City/ZIP (Read Only)
              </Label>
              <Input
                id="district"
                value={districtCityZip}
                readOnly
                className="border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed"
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
            <Label className="text-base font-semibold text-gray-700">File Management</Label>
            <div className="text-sm text-gray-600 mb-4">
              <AlertCircle className="inline h-4 w-4 mr-1" />
              Required: Cheque, Voucher, Invoice | Optional: Doc 2307, Deposit Slip
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fileUploads.map((upload) => (
                <div key={upload.id} className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700 flex items-center">
                    {upload.name}
                    {upload.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>

                  {/* Existing Files */}
                  {upload.existingUrls.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs text-gray-500">Existing Files:</div>
                      {upload.existingUrls.map((url, index) => (
                        <div key={index} className="flex items-center justify-between bg-blue-50 p-2 rounded text-xs">
                          <span className="truncate flex-1">
                            Existing {upload.name} {index + 1}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeExistingFile(upload.id, index)}
                            className="h-6 w-6 p-0 hover:bg-red-100"
                          >
                            <X className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* New Files */}
                  {upload.files.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs text-gray-500">New Files:</div>
                      {upload.files.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-green-50 p-2 rounded text-xs">
                          <span className="truncate flex-1">{file.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeNewFile(upload.id, index)}
                            className="h-6 w-6 p-0 hover:bg-red-100"
                            disabled={upload.uploading}
                          >
                            <X className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload Area */}
                  <div className="border-2 border-dashed rounded-lg p-4 transition-colors border-gray-300 hover:border-blue-400">
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
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mb-2"></div>
                          <span className="text-xs text-blue-600">Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-6 w-6 text-gray-400 mb-2" />
                          <span className="text-xs text-gray-500">
                            {!taxMonth || !tinSearch ? "Select tax month & TIN first" : "Add more files"}
                          </span>
                        </>
                      )}
                    </label>
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
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="border-gray-200 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !areRequiredFilesAvailable() || fileUploads.some((f) => f.uploading)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating...
                </>
              ) : (
                "Update Sales Record"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
