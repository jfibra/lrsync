"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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

// S3 Upload function via API route
const uploadToS3API = async (
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
  const [totalActualAmount, setTotalActualAmount] = useState("")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [taxType, setTaxType] = useState("")
  const [saleType, setSaleType] = useState("")
  const [pickupDate, setPickupDate] = useState<Date>(new Date())

  // TIN search results
  const [tinResults, setTinResults] = useState<TaxpayerListing[]>([])
  const [searchingTin, setSearchingTin] = useState(false)
  const [showTinDropdown, setShowTinDropdown] = useState(false)

  // File uploads
  const [fileUploads, setFileUploads] = useState<FileUpload[]>([
    {
      id: "voucher",
      name: "Voucher",
      files: [],
      required: true,
      uploading: false,
      uploadedUrls: [],
      existingUrls: [],
    },
    { id: "cheque", name: "Cheque", files: [], required: false, uploading: false, uploadedUrls: [], existingUrls: [] },
    {
      id: "invoice",
      name: "Invoice",
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
      required: true,
      uploading: false,
      uploadedUrls: [],
      existingUrls: [],
    },
    {
      id: "doc_2307",
      name: "Doc 2307",
      files: [],
      required: false,
      uploading: false,
      uploadedUrls: [],
      existingUrls: [],
    },
  ])

  // Add state for remark input and remarks
  const [remarkInput, setRemarkInput] = useState("")
  const [remarks, setRemarks] = useState<any[]>([])

  // Initialize form with sale data
  useEffect(() => {
    if (sale && open) {
      setTaxMonth(sale.tax_month)
      setTinSearch(formatTinInput(sale.tin))
      setName(sale.name)
      setSubstreetStreetBrgy(sale.substreet_street_brgy || "")
      setDistrictCityZip(sale.district_city_zip || "")
      setGrossTaxable(sale.gross_taxable ? sale.gross_taxable.toLocaleString() : "")
      setTotalActualAmount(sale.total_actual_amount ? sale.total_actual_amount.toLocaleString() : "")
      setInvoiceNumber(sale.invoice_number || "")
      setTaxType(sale.tax_type)
      setSaleType(sale.sale_type || "invoice")
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

      setRemarkInput("")
      let parsedRemarks: any[] = []
      if (sale.remarks) {
        try {
          parsedRemarks = JSON.parse(sale.remarks)
        } catch {
          parsedRemarks = []
        }
      }
      setRemarks(Array.isArray(parsedRemarks) ? parsedRemarks : [])
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

  // Format TIN input - add dash after every 3 digits
  const formatTinInput = (value: string) => {
    const digits = value.replace(/\D/g, "")
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

  const handleGrossTaxableChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/,/g, "")
    // Allow empty string, integers, and decimals (including trailing decimal point)
    if (rawValue === "" || /^\d*\.?\d*$/.test(rawValue)) {
      const formatted = formatNumberWithCommas(rawValue)
      setGrossTaxable(formatted)
    }
  }

  const handleTotalActualAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/,/g, "")
    // Allow empty string, integers, and decimals (including trailing decimal point)
    if (rawValue === "" || /^\d*\.?\d*$/.test(rawValue)) {
      const formatted = formatNumberWithCommas(rawValue)
      setTotalActualAmount(formatted)
    }
  }

  // Validate file type
  const isValidFile = (file: File): boolean => {
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "application/pdf"]
    return validTypes.includes(file.type)
  }

  // Handle file uploads to S3
  const handleFileChange = async (uploadId: string, files: FileList | null) => {
    if (!files || !taxMonth || !tinSearch) return

    const validFiles = Array.from(files).filter((file) => {
      if (!isValidFile(file)) {
        alert(`${file.name} is not a valid file type. Only JPEG, PNG, GIF, WebP, and PDF files are allowed.`)
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
        return await uploadToS3API(file, taxMonth, tinSearch, uploadId, existingFileCount + index)
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

  // Check if required files are available (currently none are required)
  const areRequiredFilesAvailable = (): boolean => {
    return true
  }

  // Add Remark handler
  const handleAddRemark = () => {
    if (!remarkInput.trim() || !profile) return
    const newRemark = {
      remark: remarkInput.trim(),
      name: profile.full_name || "",
      uuid: profile.id || "",
      date: new Date().toISOString(),
    }
    setRemarks((prev) => [...prev, newRemark])
    setRemarkInput("")
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !sale) return

    if (!areRequiredFilesAvailable()) {
      alert("Please ensure required files are available")
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
        remarks: remarks.length > 0 ? JSON.stringify(remarks) : null,
        updated_at: new Date().toISOString(),
      }

      const { error: salesError } = await supabase.from("sales").update(salesData).eq("id", sale.id)

      if (salesError) {
        console.error("Sales update error:", salesError)
        throw salesError
      }

      // Gather all file attachment URLs for meta
      const fileMeta: Record<string, string[]> = {}
      fileUploads.forEach((upload) => {
        const allUrls = [...(upload.existingUrls || []), ...(upload.uploadedUrls || [])]
        if (allUrls.length > 0) {
          fileMeta[upload.id] = allUrls
        }
      })
      // Log notification for all roles
      await supabase.rpc('log_notification', {
        p_action: 'sales_updated',
        p_description: `Sales record updated for ${name} (TIN: ${tinSearch})`,
        p_ip_address: '', // Optionally get from request headers
        p_location: null, // Optionally provide location info
        p_user_agent: typeof window !== 'undefined' ? window.navigator.userAgent : '',
        p_meta: {
          saleId: sale.id,
          updatedBy: profile?.full_name || '',
          role: profile?.role || '',
          file_attachments: fileMeta
        }
      })

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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white text-[#001f3f]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#001f3f]">Edit Sales Record</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* First Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tax Month - Read Only */}
            <div className="space-y-2">
              <Label htmlFor="tax-month" className="text-sm font-medium text-[#001f3f]">
                Tax Month (Read Only)
              </Label>
              <Input
                id="tax-month"
                value={taxMonthOptions.find((option) => option.value === taxMonth)?.label || taxMonth}
                readOnly
                className="border-[#001f3f] bg-gray-200 text-[#001f3f] cursor-not-allowed"
              />
            </div>

            {/* Tax Type */}
            <div className="space-y-2">
              <Label htmlFor="tax-type" className="text-sm font-medium text-[#001f3f]">
                Tax Type *
              </Label>
              <Select value={taxType} onValueChange={setTaxType} required>
                <SelectTrigger className="border-[#001f3f] focus:border-blue-500 focus:ring-blue-500 text-[#001f3f] bg-white">
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

            {/* Sale Type */}
            <div className="space-y-2">
              <Label htmlFor="sale-type" className="text-sm font-medium text-[#001f3f]">
                Sale Type *
              </Label>
              <Select value={saleType} onValueChange={setSaleType} required>
                <SelectTrigger className="border-[#001f3f] focus:border-blue-500 focus:ring-blue-500 text-[#001f3f] bg-white">
                  <SelectValue placeholder="Select sale type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice" className="text-white">
                    Invoice
                  </SelectItem>
                  <SelectItem value="non-invoice" className="text-white">
                    No Invoice
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <hr/>
          {/* Second Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* TIN Search - Read Only */}
            <div className="space-y-2 relative">
              <Label htmlFor="tin" className="text-sm font-medium text-[#001f3f]">
                TIN # (Read Only)
              </Label>
              <Input
                id="tin"
                value={tinSearch}
                readOnly
                className="border-[#001f3f] bg-gray-200 text-[#001f3f] cursor-not-allowed"
              />
            </div>

            {/* Name - Read Only */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-[#001f3f]">
                Name (Read Only)
              </Label>
              <Input
                id="name"
                value={name}
                readOnly
                className="border-[#001f3f] bg-gray-200 text-[#001f3f] cursor-not-allowed"
              />
            </div>

            {/* Address Fields - Read Only */}
            <div className="space-y-2">
              <Label htmlFor="substreet" className="text-sm font-medium text-[#001f3f]">
                Substreet/Street/Barangay (Read Only)
              </Label>
              <Input
                id="substreet"
                value={substreetStreetBrgy}
                readOnly
                className="border-[#001f3f] bg-gray-200 text-[#001f3f] cursor-not-allowed"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="district" className="text-sm font-medium text-[#001f3f]">
                District/City/ZIP (Read Only)
              </Label>
              <Input
                id="district"
                value={districtCityZip}
                readOnly
                className="border-[#001f3f] bg-gray-200 text-[#001f3f] cursor-not-allowed"
              />
            </div>
          </div>
          <hr/>
          {/* Third Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Gross Taxable */}
            <div className="space-y-2">
              <Label htmlFor="gross-taxable" className="text-sm font-medium text-[#001f3f]">
                Gross Taxable *
              </Label>
              <Input
                id="gross-taxable"
                value={grossTaxable}
                onChange={handleGrossTaxableChange}
                placeholder="0"
                className="border-[#001f3f] focus:border-blue-500 focus:ring-blue-500 text-[#001f3f] bg-white"
                required
              />
            </div>

            {/* Total Actual Amount */}
            <div className="space-y-2">
              <Label htmlFor="total-actual-amount" className="text-sm font-medium text-[#001f3f]">
                Total Actual Amount *
              </Label>
              <Input
                id="total-actual-amount"
                value={totalActualAmount}
                onChange={handleTotalActualAmountChange}
                placeholder="0"
                className="border-[#001f3f] focus:border-blue-500 focus:ring-blue-500 text-[#001f3f] bg-white"
                required
              />
            </div>

            {/* Invoice Number */}
            <div className="space-y-2">
              <Label htmlFor="invoice-number" className="text-sm font-medium text-[#001f3f]">
                Invoice Number
              </Label>
              <Input
                id="invoice-number"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Invoice number"
                className="border-[#001f3f] focus:border-blue-500 focus:ring-blue-500 text-[#001f3f] bg-white"
              />
            </div>

            {/* Pickup Date */}
            <div className="space-y-2">
              <Label htmlFor="pickup-date" className="text-sm font-medium text-[#001f3f]">
                Pickup Date
              </Label>
              <Input
                type="date"
                value={format(pickupDate, "yyyy-MM-dd")}
                onChange={(e) => {
                  const newDate = new Date(e.target.value)
                  if (!isNaN(newDate.getTime())) {
                    setPickupDate(newDate)
                  }
                }}
                className="border-[#001f3f] focus:border-blue-500 focus:ring-blue-500 text-[#001f3f] bg-white"
              />
            </div>
          </div>

          {/* Remark Input Row */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 py-4">
            <div className="flex-1 w-full">
              <Label htmlFor="remark" className="text-sm font-medium text-[#001f3f]">Add Remark</Label>
              <textarea
                id="remark"
                value={remarkInput}
                onChange={(e) => setRemarkInput(e.target.value)}
                rows={2}
                className="w-full border-2 border-[#001f3f] focus:border-blue-500 focus:ring-blue-500 text-[#001f3f] bg-blue-50 rounded-lg p-3 shadow-sm"
                placeholder="Enter your remark..."
              />
            </div>
            <Button
              type="button"
              onClick={handleAddRemark}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white mt-2 md:mt-0"
              disabled={loading || !remarkInput.trim()}
            >
              Add Remark
            </Button>
          </div>

          {/* File Uploads */}
          <div className="space-y-4">
            <Label className="text-base font-semibold text-[#001f3f]">File Management</Label>
            <div className="text-sm text-[#001f3f]/80 mb-4">
              <AlertCircle className="inline h-4 w-4 mr-1" />
              Required: None | Optional: Voucher, Deposit Slip, Cheque, Invoice, Doc 2307
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fileUploads.map((upload) => (
                <div key={upload.id} className="space-y-2">
                  <Label className="text-sm font-medium text-[#001f3f] flex items-center">
                    {upload.name}
                    {upload.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>

                  {/* Existing Files */}
                  {upload.existingUrls.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs text-[#001f3f]/60">Existing Files:</div>
                      {upload.existingUrls.map((url, index) => (
                        <div key={index} className="flex items-center justify-between bg-blue-50 p-2 rounded text-xs">
                          <span className="truncate flex-1 text-[#001f3f]">
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
                      <div className="text-xs text-[#001f3f]/60">New Files:</div>
                      {upload.files.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-green-50 p-2 rounded text-xs">
                          <span className="truncate flex-1 text-[#001f3f]">{file.name}</span>
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
                  <div className="border-2 border-dashed rounded-lg p-4 transition-colors border-[#001f3f] hover:border-blue-400">
                    <input
                      id={upload.id}
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
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
                          <Upload className="h-6 w-6 text-[#001f3f] mb-2" />
                          <span className="text-xs text-[#001f3f]/60">
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
              className="border-[#001f3f] hover:bg-[#001f3f]/10 text-white"
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
