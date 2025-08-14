"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase/client"
import { logNotification } from "@/utils/logNotification"

interface Purchase {
  id: string
  tax_month: string
  tin_id: string | null
  tin: string
  name: string
  substreet_street_brgy: string | null
  district_city_zip: string | null
  gross_taxable: number
  invoice_number: string | null
  tax_type: string
  official_receipt: string | null
  date_added: string | null
  user_uuid: string | null
  user_full_name: string | null
  remarks: string | null
  created_at: string
}

interface EditPurchasesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  purchase: Purchase | null
  onPurchaseUpdated?: () => void
}

interface TaxMonthOption {
  label: string
  value: string
}

export function EditPurchasesModal({ open, onOpenChange, purchase, onPurchaseUpdated }: EditPurchasesModalProps) {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)

  // Form state
  const [taxMonth, setTaxMonth] = useState("")
  const [tinSearch, setTinSearch] = useState("")
  const [name, setName] = useState("")
  const [substreetStreetBrgy, setSubstreetStreetBrgy] = useState("")
  const [districtCityZip, setDistrictCityZip] = useState("")
  const [grossTaxable, setGrossTaxable] = useState("")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [taxType, setTaxType] = useState("")
  const [officialReceipt, setOfficialReceipt] = useState("")
  const [remarks, setRemarks] = useState("")

  // Initialize form with purchase data
  useEffect(() => {
    if (purchase && open) {
      setTaxMonth(purchase.tax_month)
      setTinSearch(formatTinInput(purchase.tin))
      setName(purchase.name)
      setSubstreetStreetBrgy(purchase.substreet_street_brgy || "")
      setDistrictCityZip(purchase.district_city_zip || "")
      setGrossTaxable(purchase.gross_taxable ? purchase.gross_taxable.toLocaleString() : "")
      setInvoiceNumber(purchase.invoice_number || "")
      setTaxType(purchase.tax_type)
      setOfficialReceipt(purchase.official_receipt || "")
      setRemarks(purchase.remarks || "")
    }
  }, [purchase, open])

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
    return digits.replace(/(\d{3})(?=\d)/g, "$1-")
  }

  // Format number with commas
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

  const handleGrossTaxableChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/,/g, "")
    if (rawValue === "" || /^\d*\.?\d*$/.test(rawValue)) {
      const formatted = formatNumberWithCommas(rawValue)
      setGrossTaxable(formatted)
    }
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!purchase) return

    setLoading(true)
    try {
      const cleanTin = tinSearch.replace(/-/g, "")

      const purchaseData = {
        tax_month: taxMonth,
        tin: cleanTin,
        name: name,
        substreet_street_brgy: substreetStreetBrgy || null,
        district_city_zip: districtCityZip || null,
        gross_taxable: Number.parseFloat(grossTaxable.replace(/,/g, "")) || 0,
        invoice_number: invoiceNumber || null,
        tax_type: taxType,
        official_receipt: officialReceipt || null,
        remarks: remarks || null,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase.from("purchases").update(purchaseData).eq("id", purchase.id)

      if (error) throw error

      // Log notification
      if (profile?.id) {
        await logNotification(supabase, {
          action: "purchase_updated",
          description: `Purchase record updated for ${name} (TIN: ${tinSearch})`,
          ip_address: null,
          location: null,
          meta: JSON.stringify({
            purchaseId: purchase.id,
            updatedBy: profile?.full_name || "",
            role: profile?.role || "",
          }),
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
          user_email: profile.email,
          user_name: profile.full_name || profile.first_name || profile.id,
          user_uuid: profile.id,
        })
      }

      onOpenChange(false)
      onPurchaseUpdated?.()
    } catch (error) {
      console.error("Error updating purchase record:", error)
      alert("Error updating purchase record. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (!purchase) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white text-[#001f3f]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#001f3f]">Edit Purchase Record</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* First Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tax Month */}
            <div className="space-y-2">
              <Label htmlFor="tax-month" className="text-sm font-medium text-[#001f3f]">
                Tax Month *
              </Label>
              <Select value={taxMonth} onValueChange={setTaxMonth} required>
                <SelectTrigger className="border-[#001f3f] focus:border-[#3c8dbc] focus:ring-[#3c8dbc] text-[#001f3f] bg-white">
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
              <Select value={taxType} onValueChange={setTaxType} required>
                <SelectTrigger className="border-[#001f3f] focus:border-[#3c8dbc] focus:ring-[#3c8dbc] text-[#001f3f] bg-white">
                  <SelectValue placeholder="Select tax type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vat">VAT</SelectItem>
                  <SelectItem value="non-vat">Non-VAT</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
                className="border-[#001f3f] focus:border-[#3c8dbc] focus:ring-[#3c8dbc] text-[#001f3f] bg-white"
                required
              />
            </div>
          </div>

          {/* Second Row - Read Only Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="tin" className="text-sm font-medium text-[#001f3f]">
                TIN # (Read Only)
              </Label>
              <Input
                id="tin"
                value={tinSearch}
                readOnly
                className="border-[#001f3f] bg-gray-100 text-[#001f3f] cursor-not-allowed"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-[#001f3f]">
                Name (Read Only)
              </Label>
              <Input
                id="name"
                value={name}
                readOnly
                className="border-[#001f3f] bg-gray-100 text-[#001f3f] cursor-not-allowed"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="substreet" className="text-sm font-medium text-[#001f3f]">
                Substreet/Street/Barangay (Read Only)
              </Label>
              <Input
                id="substreet"
                value={substreetStreetBrgy}
                readOnly
                className="border-[#001f3f] bg-gray-100 text-[#001f3f] cursor-not-allowed"
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
                className="border-[#001f3f] bg-gray-100 text-[#001f3f] cursor-not-allowed"
              />
            </div>
          </div>

          {/* Third Row - Editable Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoice-number" className="text-sm font-medium text-[#001f3f]">
                Invoice Number
              </Label>
              <Input
                id="invoice-number"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Invoice number"
                className="border-[#001f3f] focus:border-[#3c8dbc] focus:ring-[#3c8dbc] text-[#001f3f] bg-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="official-receipt" className="text-sm font-medium text-[#001f3f]">
                Official Receipt
              </Label>
              <Input
                id="official-receipt"
                value={officialReceipt}
                onChange={(e) => setOfficialReceipt(e.target.value)}
                placeholder="Official receipt number"
                className="border-[#001f3f] focus:border-[#3c8dbc] focus:ring-[#3c8dbc] text-[#001f3f] bg-white"
              />
            </div>
          </div>

          {/* Remarks */}
          <div className="space-y-2">
            <Label htmlFor="remarks" className="text-sm font-medium text-[#001f3f]">
              Remarks
            </Label>
            <Input
              id="remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Additional remarks..."
              className="border-[#001f3f] focus:border-[#3c8dbc] focus:ring-[#3c8dbc] text-[#001f3f] bg-white"
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-[#001f3f]/20">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="border-[#001f3f] hover:bg-[#001f3f]/10 text-[#001f3f]"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-[#001f3f] hover:bg-[#001f3f]/90 text-white">
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating...
                </>
              ) : (
                "Update Purchase Record"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
