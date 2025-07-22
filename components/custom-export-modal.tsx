"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Download, Settings } from "lucide-react"
import { format } from "date-fns"
import type { Sales } from "@/types/sales"
import * as XLSX from "xlsx"

interface CustomExportModalProps {
  sales: Sales[]
  userArea?: string
}

interface ExportField {
  key: string
  label: string
  selected: boolean
}

export function CustomExportModal({ sales, userArea }: CustomExportModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [exportFields, setExportFields] = useState<ExportField[]>([
    { key: "tax_month", label: "Tax Month", selected: true },
    { key: "tin", label: "TIN", selected: true },
    { key: "name", label: "Name", selected: true },
    { key: "address", label: "Address", selected: true },
    { key: "tax_type", label: "Tax Type", selected: true },
    { key: "sale_type", label: "Sale Type", selected: true },
    { key: "gross_taxable", label: "Gross Taxable", selected: true },
    { key: "total_actual_amount", label: "Total Actual Amount", selected: false },
    { key: "invoice_number", label: "Invoice Number", selected: true },
    { key: "pickup_date", label: "Pickup Date", selected: true },
    { key: "area", label: "Area", selected: false },
    { key: "files_count", label: "Files Count", selected: false },
    { key: "cheque_files", label: "Cheque Files", selected: false },
    { key: "voucher_files", label: "Voucher Files", selected: false },
    { key: "invoice_files", label: "Invoice Files", selected: false },
    { key: "doc_2307_files", label: "2307 Files", selected: false },
    { key: "deposit_files", label: "Deposit Files", selected: false },
  ])

  const toggleField = (key: string) => {
    setExportFields((prev) =>
      prev.map((field) => (field.key === key ? { ...field, selected: !field.selected } : field)),
    )
  }

  const selectAll = () => {
    setExportFields((prev) => prev.map((field) => ({ ...field, selected: true })))
  }

  const selectNone = () => {
    setExportFields((prev) => prev.map((field) => ({ ...field, selected: false })))
  }

  const formatTin = (tin: string) => {
    const digits = tin.replace(/\D/g, "")
    return digits.replace(/(\d{3})(?=\d)/g, "$1-")
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount)
  }

  const handleExport = async () => {
    setLoading(true)
    try {
      const selectedFields = exportFields.filter((field) => field.selected)

      if (selectedFields.length === 0) {
        alert("Please select at least one field to export.")
        return
      }

      // Create workbook
      const wb = XLSX.utils.book_new()

      // Create header row
      const headers = selectedFields.map((field) => field.label)

      // Create data rows
      const dataRows = sales.map((sale) => {
        const row: (string | number)[] = []

        selectedFields.forEach((field) => {
          switch (field.key) {
            case "tax_month":
              row.push(format(new Date(sale.tax_month), "MMM yyyy"))
              break
            case "tin":
              row.push(formatTin(sale.tin))
              break
            case "name":
              row.push(sale.name)
              break
            case "address":
              row.push(sale.substreet_street_brgy || "")
              break
            case "tax_type":
              row.push(sale.tax_type?.toUpperCase() || "")
              break
            case "sale_type":
              row.push(sale.sale_type?.toUpperCase() || "INVOICE")
              break
            case "gross_taxable":
              row.push(sale.gross_taxable || 0)
              break
            case "total_actual_amount":
              row.push(sale.total_actual_amount || 0)
              break
            case "invoice_number":
              row.push(sale.invoice_number || "")
              break
            case "pickup_date":
              row.push(sale.pickup_date ? format(new Date(sale.pickup_date), "MMM dd, yyyy") : "")
              break
            case "area":
              row.push((sale as any).user_assigned_area || userArea || "N/A")
              break
            case "files_count":
              const filesCount = [
                ...(sale.cheque || []),
                ...(sale.voucher || []),
                ...(sale.invoice || []),
                ...(sale.doc_2307 || []),
                ...(sale.deposit_slip || []),
              ].length
              row.push(filesCount)
              break
            case "cheque_files":
              row.push(sale.cheque?.join(", ") || "")
              break
            case "voucher_files":
              row.push(sale.voucher?.join(", ") || "")
              break
            case "invoice_files":
              row.push(sale.invoice?.join(", ") || "")
              break
            case "doc_2307_files":
              row.push(sale.doc_2307?.join(", ") || "")
              break
            case "deposit_files":
              row.push(sale.deposit_slip?.join(", ") || "")
              break
            default:
              row.push("")
          }
        })

        return row
      })

      // Create summary data
      const summaryData = [
        [`CUSTOM SALES EXPORT${userArea ? ` - ${userArea}` : ""}`],
        [
          "Generated on:",
          new Date().toLocaleDateString("en-PH", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
        ],
        ["Total Records:", sales.length],
        ["Selected Fields:", selectedFields.length],
        [""],
        headers,
        ...dataRows,
      ]

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(summaryData)

      // Set column widths
      const colWidths = selectedFields.map((field) => {
        switch (field.key) {
          case "name":
          case "address":
            return { width: 30 }
          case "cheque_files":
          case "voucher_files":
          case "invoice_files":
          case "doc_2307_files":
          case "deposit_files":
            return { width: 35 }
          default:
            return { width: 15 }
        }
      })
      ws["!cols"] = colWidths

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Custom Sales Export")

      // Generate filename
      const filename = `Custom_Sales_Export${userArea ? `_${userArea.replace(/\s+/g, "_")}` : ""}_${new Date().toISOString().split("T")[0]}.xlsx`

      // Download file
      XLSX.writeFile(wb, filename)

      setOpen(false)
    } catch (error) {
      console.error("Export error:", error)
      alert("Error exporting data. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 bg-transparent"
        >
          <Settings className="h-4 w-4 mr-2" />
          Custom Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-white text-[#001f3f]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#001f3f]">Custom Export Settings</DialogTitle>
          <DialogDescription className="text-[#001f3f]/80">
            Select the fields you want to include in your export file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll} className="text-xs bg-transparent text-[#001f3f] border-[#001f3f] hover:bg-[#001f3f]/10">
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={selectNone} className="text-xs bg-transparent text-[#001f3f] border-[#001f3f] hover:bg-[#001f3f]/10">
              Select None
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
            {exportFields.map((field) => (
              <div key={field.key} className="flex items-center space-x-2">
                <Checkbox id={field.key} checked={field.selected} onCheckedChange={() => toggleField(field.key)} />
                <Label htmlFor={field.key} className="text-sm font-medium text-[#001f3f] cursor-pointer">
                  {field.label}
                </Label>
              </div>
            ))}
          </div>

          <div className="text-sm text-[#001f3f] bg-[#f8fafc] p-3 rounded-md">
            <strong>Export Summary:</strong>
            <br />• Total records: {sales.length}
            <br />• Selected fields: {exportFields.filter((f) => f.selected).length}
            <br />• File format: Excel (.xlsx)
          </div>
        </div>

        <DialogFooter className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="border-[#001f3f] text-white hover:bg-[#001f3f]/10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={loading || exportFields.filter((f) => f.selected).length === 0}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
