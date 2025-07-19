"use client"

import type React from "react"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Plus, CalendarIcon, Search, Upload, X, FileText } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import type { TaxpayerListing } from "@/types/taxpayer"

interface AddSalesModalProps {
  onSalesAdded: () => void
}

interface FileUpload {
  file: File
  preview: string
}

interface FileUploads {
  cheque: FileUpload[]
  voucher: FileUpload[]
  invoice: FileUpload[]
  doc_2307: FileUpload[]
  deposit_slip: FileUpload[]
}

export function AddSalesModal({ onSalesAdded }: AddSalesModalProps) {
  const { user, profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [taxpayers, setTaxpayers] = useState<TaxpayerListing[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedTaxpayer, setSelectedTaxpayer] = useState<TaxpayerListing | null>(null)

  // Form state
  const [taxMonth, setTaxMonth] = useState<Date>()
  const [grossTaxable, setGrossTaxable] = useState("")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [taxType, setTaxType] = useState("")
  const [pickupDate, setPickupDate] = useState<Date>()

  // File uploads state
  const [fileUploads, setFileUploads] = useState<FileUploads>({
    cheque: [],
    voucher: [],
    invoice: [],
    doc_2307: [],
    deposit_slip: [],
  })

  // Search taxpayers
  const searchTaxpayers = async (term: string) => {
    if (!term.trim()) {
      setTaxpayers([])
      return
    }

    setSearchLoading(true)
    try {
      const { data, error } = await supabase
        .from("taxpayer_listings")
        .select("*")
        .or(`tin.ilike.%${term}%,registered_name.ilike.%${term}%`)
        .limit(10)

      if (error) throw error
      setTaxpayers(data || [])
    } catch (error) {
      console.error("Error searching taxpayers:", error)
    } finally {
      setSearchLoading(false)
    }
  }

  // Handle taxpayer selection
  const handleTaxpayerSelect = (taxpayer: TaxpayerListing) => {
    setSelectedTaxpayer(taxpayer)
    setSearchTerm("")
    setTaxpayers([])
  }

  // Handle file upload
  const handleFileUpload = (type: keyof FileUploads, files: FileList | null) => {
    if (!files) return

    const newFiles: FileUpload[] = []
    Array.from(files).forEach((file) => {
      if (file.type.startsWith("image/") || file.type === "application/pdf") {
        const preview = URL.createObjectURL(file)
        newFiles.push({ file, preview })
      }
    })

    setFileUploads((prev) => ({
      ...prev,
      [type]: [...prev[type], ...newFiles],
    }))
  }

  // Remove file
  const removeFile = (type: keyof FileUploads, index: number) => {
    setFileUploads((prev) => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index),
    }))
  }

  // Upload files to Laravel API
  const uploadFiles = async (files: FileUpload[], type: string): Promise<string[]> => {
    if (files.length === 0) return []

    const uploadedUrls: string[] = []

    for (const fileUpload of files) {
      const formData = new FormData()
      formData.append("file", fileUpload.file)
      formData.append("type", type)
      formData.append("tin", selectedTaxpayer?.tin || "")
      formData.append("tax_month", taxMonth ? format(taxMonth, "yyyy-MM") : "")

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_NEXT_API_ROUTE_LR}/api/upload`, {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`)
        }

        const result = await response.json()
        uploadedUrls.push(result.url)
      } catch (error) {
        console.error(`Error uploading ${type} file:`, error)
        throw error
      }
    }

    return uploadedUrls
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTaxpayer || !taxMonth || !user || !profile) return

    setLoading(true)
    try {
      // Upload all files
      const [chequeUrls, voucherUrls, invoiceUrls, doc2307Urls, depositSlipUrls] = await Promise.all([
        uploadFiles(fileUploads.cheque, "cheque"),
        uploadFiles(fileUploads.voucher, "voucher"),
        uploadFiles(fileUploads.invoice, "invoice"),
        uploadFiles(fileUploads.doc_2307, "doc_2307"),
        uploadFiles(fileUploads.deposit_slip, "deposit_slip"),
      ])

      // Insert sales record
      const { error } = await supabase.from("sales").insert({
        tax_month: format(taxMonth, "yyyy-MM-dd"),
        tin_id: selectedTaxpayer.id,
        tin: selectedTaxpayer.tin,
        name: selectedTaxpayer.registered_name || "",
        type: selectedTaxpayer.type,
        substreet_street_brgy: selectedTaxpayer.substreet_street_brgy,
        district_city_zip: selectedTaxpayer.district_city_zip,
        gross_taxable: Number.parseFloat(grossTaxable) || 0,
        invoice_number: invoiceNumber || null,
        tax_type: taxType,
        pickup_date: pickupDate ? format(pickupDate, "yyyy-MM-dd") : null,
        cheque: chequeUrls.length > 0 ? chequeUrls : null,
        voucher: voucherUrls.length > 0 ? voucherUrls : null,
        invoice: invoiceUrls.length > 0 ? invoiceUrls : null,
        doc_2307: doc2307Urls.length > 0 ? doc2307Urls : null,
        deposit_slip: depositSlipUrls.length > 0 ? depositSlipUrls : null,
        user_uuid: user.id, // Save the logged-in user's UUID
        user_full_name: profile.full_name,
      })

      if (error) throw error

      // Reset form
      setSelectedTaxpayer(null)
      setTaxMonth(undefined)
      setGrossTaxable("")
      setInvoiceNumber("")
      setTaxType("")
      setPickupDate(undefined)
      setFileUploads({
        cheque: [],
        voucher: [],
        invoice: [],
        doc_2307: [],
        deposit_slip: [],
      })

      setOpen(false)
      onSalesAdded()
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
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Sales Record
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Sales Record</DialogTitle>
          <DialogDescription>
            Add a new sales record with taxpayer information and supporting documents.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Taxpayer Search */}
          <div className="space-y-2">
            <Label htmlFor="taxpayer-search">Search Taxpayer</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                id="taxpayer-search"
                placeholder="Search by TIN or name..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  searchTaxpayers(e.target.value)
                }}
                className="pl-10"
              />
              {searchLoading && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                </div>
              )}
            </div>

            {/* Search Results */}
            {taxpayers.length > 0 && (
              <div className="border rounded-md max-h-40 overflow-y-auto">
                {taxpayers.map((taxpayer) => (
                  <div
                    key={taxpayer.id}
                    className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                    onClick={() => handleTaxpayerSelect(taxpayer)}
                  >
                    <div className="font-medium">{taxpayer.registered_name}</div>
                    <div className="text-sm text-gray-500">TIN: {taxpayer.tin}</div>
                    <div className="text-sm text-gray-500">{taxpayer.substreet_street_brgy}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Selected Taxpayer */}
            {selectedTaxpayer && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{selectedTaxpayer.registered_name}</div>
                    <div className="text-sm text-gray-600">TIN: {selectedTaxpayer.tin}</div>
                    <div className="text-sm text-gray-600">{selectedTaxpayer.substreet_street_brgy}</div>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedTaxpayer(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tax Month */}
            <div className="space-y-2">
              <Label>Tax Month *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !taxMonth && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {taxMonth ? format(taxMonth, "MMMM yyyy") : "Select month"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={taxMonth} onSelect={setTaxMonth} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            {/* Gross Taxable */}
            <div className="space-y-2">
              <Label htmlFor="gross-taxable">Gross Taxable Amount *</Label>
              <Input
                id="gross-taxable"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={grossTaxable}
                onChange={(e) => setGrossTaxable(e.target.value)}
                required
              />
            </div>

            {/* Invoice Number */}
            <div className="space-y-2">
              <Label htmlFor="invoice-number">Invoice Number</Label>
              <Input
                id="invoice-number"
                placeholder="Enter invoice number"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </div>

            {/* Tax Type */}
            <div className="space-y-2">
              <Label>Tax Type *</Label>
              <Select value={taxType} onValueChange={setTaxType} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select tax type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vat">VAT</SelectItem>
                  <SelectItem value="non-vat">Non-VAT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Pickup Date */}
            <div className="space-y-2 md:col-span-2">
              <Label>Pickup Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !pickupDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {pickupDate ? format(pickupDate, "PPP") : "Select pickup date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={pickupDate} onSelect={setPickupDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* File Uploads */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Supporting Documents</Label>

            {Object.entries(fileUploads).map(([type, files]) => (
              <div key={type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="capitalize">{type.replace("_", " ")}</Label>
                  <div className="relative">
                    <Input
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      onChange={(e) => handleFileUpload(type as keyof FileUploads, e.target.files)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Button type="button" variant="outline" size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload {type.replace("_", " ")}
                    </Button>
                  </div>
                </div>

                {files.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {files.map((fileUpload, index) => (
                      <div key={index} className="relative">
                        <Badge variant="outline" className="pr-6">
                          <FileText className="h-3 w-3 mr-1" />
                          {fileUpload.file.name}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute -top-1 -right-1 h-4 w-4 p-0"
                          onClick={() => removeFile(type as keyof FileUploads, index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !selectedTaxpayer || !taxMonth || !grossTaxable || !taxType}>
              {loading ? "Adding..." : "Add Sales Record"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
