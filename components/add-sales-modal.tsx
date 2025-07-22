"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Plus } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"

interface AddSalesModalProps {
  onSalesAdded: () => void
}

export function AddSalesModal({ onSalesAdded }: AddSalesModalProps) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [taxMonth, setTaxMonth] = useState<Date>()
  const [pickupDate, setPickupDate] = useState<Date>()

  const [formData, setFormData] = useState({
    tin: "",
    name: "",
    substreet_street_brgy: "",
    district_city_zip: "",
    tax_type: "",
    sale_type: "invoice", // Default to invoice
    gross_taxable: "",
    total_actual_amount: "", // New field
    invoice_number: "",
    cheque: [] as string[],
    voucher: [] as string[],
    invoice: [] as string[],
    doc_2307: [] as string[],
    deposit_slip: [] as string[],
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !taxMonth) return

    setLoading(true)
    try {
      const salesData = {
        user_uuid: user.id,
        tax_month: format(taxMonth, "yyyy-MM-dd"),
        tin: formData.tin,
        name: formData.name,
        substreet_street_brgy: formData.substreet_street_brgy,
        district_city_zip: formData.district_city_zip,
        tax_type: formData.tax_type,
        sale_type: formData.sale_type,
        gross_taxable: formData.gross_taxable ? Number.parseFloat(formData.gross_taxable) : null,
        total_actual_amount: formData.total_actual_amount ? Number.parseFloat(formData.total_actual_amount) : null,
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
      setTaxMonth(undefined)
      setPickupDate(undefined)
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
        <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg">
          <Plus className="h-4 w-4 mr-2" />
          Add Sales Record
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">Add New Sales Record</DialogTitle>
          <DialogDescription className="text-gray-600">
            Enter the details for the new sales record. All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tax Month */}
            <div className="space-y-2">
              <Label htmlFor="tax_month" className="text-sm font-medium text-gray-700">
                Tax Month *
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !taxMonth && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {taxMonth ? format(taxMonth, "MMMM yyyy") : "Select tax month"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={taxMonth}
                    onSelect={setTaxMonth}
                    disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* TIN */}
            <div className="space-y-2">
              <Label htmlFor="tin" className="text-sm font-medium text-gray-700">
                TIN *
              </Label>
              <Input
                id="tin"
                value={formData.tin}
                onChange={(e) => setFormData({ ...formData, tin: e.target.value })}
                placeholder="000-000-000-000"
                required
                className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                Taxpayer Name *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter taxpayer name"
                required
                className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            {/* Tax Type */}
            <div className="space-y-2">
              <Label htmlFor="tax_type" className="text-sm font-medium text-gray-700">
                Tax Type *
              </Label>
              <Select
                value={formData.tax_type}
                onValueChange={(value) => setFormData({ ...formData, tax_type: value })}
              >
                <SelectTrigger className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500">
                  <SelectValue placeholder="Select tax type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vat">VAT</SelectItem>
                  <SelectItem value="non-vat">Non-VAT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sale Type */}
            <div className="space-y-2">
              <Label htmlFor="sale_type" className="text-sm font-medium text-gray-700">
                Sale Type *
              </Label>
              <Select
                value={formData.sale_type}
                onValueChange={(value) => setFormData({ ...formData, sale_type: value })}
              >
                <SelectTrigger className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500">
                  <SelectValue placeholder="Select sale type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="non-invoice">Non-Invoice</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Gross Taxable */}
            <div className="space-y-2">
              <Label htmlFor="gross_taxable" className="text-sm font-medium text-gray-700">
                Gross Taxable Amount
              </Label>
              <Input
                id="gross_taxable"
                type="number"
                step="0.01"
                value={formData.gross_taxable}
                onChange={(e) => setFormData({ ...formData, gross_taxable: e.target.value })}
                placeholder="0.00"
                className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            {/* Total Actual Amount */}
            <div className="space-y-2">
              <Label htmlFor="total_actual_amount" className="text-sm font-medium text-gray-700">
                Total Actual Amount
              </Label>
              <Input
                id="total_actual_amount"
                type="number"
                step="0.01"
                value={formData.total_actual_amount}
                onChange={(e) => setFormData({ ...formData, total_actual_amount: e.target.value })}
                placeholder="0.00"
                className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            {/* Invoice Number */}
            <div className="space-y-2">
              <Label htmlFor="invoice_number" className="text-sm font-medium text-gray-700">
                Invoice Number
              </Label>
              <Input
                id="invoice_number"
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                placeholder="Enter invoice number"
                className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            {/* Pickup Date */}
            <div className="space-y-2">
              <Label htmlFor="pickup_date" className="text-sm font-medium text-gray-700">
                Pickup Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal border-gray-300 focus:border-indigo-500",
                      !pickupDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {pickupDate ? format(pickupDate, "PPP") : "Select pickup date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
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

          {/* Address Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="substreet_street_brgy" className="text-sm font-medium text-gray-700">
                Street/Barangay
              </Label>
              <Input
                id="substreet_street_brgy"
                value={formData.substreet_street_brgy}
                onChange={(e) => setFormData({ ...formData, substreet_street_brgy: e.target.value })}
                placeholder="Enter street/barangay"
                className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="district_city_zip" className="text-sm font-medium text-gray-700">
                City/District/ZIP
              </Label>
              <Input
                id="district_city_zip"
                value={formData.district_city_zip}
                onChange={(e) => setFormData({ ...formData, district_city_zip: e.target.value })}
                placeholder="Enter city/district/ZIP"
                className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-3 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg"
            >
              {loading ? "Adding..." : "Add Sales Record"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
