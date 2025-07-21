"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
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
  enabled: boolean
}

export function CustomExportModal({ sales, userArea }: CustomExportModalProps) {
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Available export fields
  const [exportFields, setExportFields] = useState<ExportField[]>([
    { key: "tax_month", label: "Tax Month", enabled: true },
    { key: "tin", label: "TIN", enabled: true },
    { key: "name", label: "Name", enabled: true },
    { key: "substreet_street_brgy", label: "Address", enabled: true },
    { key: "tax_type", label: "Tax Type", enabled: true },
    { key: "sale_type", label: "Sale Type", enabled: true },
    { key: "gross_taxable", label: "Gross Taxable", enabled: true },
    { key: "total_actual_amount", label: "Total Actual Amount", enabled: false },
    { key: "invoice_number", label: "Invoice Number", enabled: false },
    { key: "pickup_date", label: "Pickup Date", enabled: false },
    { key: "user_assigned_area", label: "Area", enabled: false },
    { key: "files_count", label: "Files Count", enabled: false },
    { key: "cheque_files", label: "Cheque Files", enabled: false },
    { key: "voucher_files", label: "Voucher Files", enabled: false },
    { key: "invoice_files", label: "Invoice Files", enabled: false },
    { key: "doc_2307_files", label: "2307 Files", enabled: false },
    { key: "deposit_files", label: "Deposit Files", enabled: false },
  ])

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount)
  }

  // Format TIN display
  const formatTin = (tin: string) => {
    const digits = tin.replace(/\D/g, "")
    return digits.replace(/(\d{3})(?=\d)/g, "$1-")
  }

  // Toggle field selection
  const toggleField = (key: string) => {
    setExportFields((prev) => prev.map((field) => (field.key === key ? { ...field, enabled: !field.enabled } : field)))
  }

  // Select all fields
  const selectAll = () => {
    setExportFields((prev) => prev.map((field) => ({ ...field, enabled: true })))
  }

  // Deselect all fields
  const deselectAll = () => {
    setExportFields((prev) => prev.map((field) => ({ ...field, enabled: false })))
  }

  // Handle custom export
  const handleCustomExport = async () => {
    const enabledFields = exportFields.filter((field) => field.enabled)

    if (enabledFields.length === 0) {
      alert("Please select at least one field to export.")
      return
    }

    setExporting(true)

    try {
      // Filter out non-invoice sales for export
      const invoiceSales = sales.filter((sale) => sale.sale_type === "invoice")

      // Calculate statistics for invoice sales only
      const totalSales = invoiceSales.length
      const vatSales = invoiceSales.filter((s) => s.tax_type === "vat").length
      const nonVatSales = invoiceSales.filter((s) => s.tax_type === "non-vat").length
      const totalAmount = invoiceSales.reduce((sum, sale) => sum + (sale.gross_taxable || 0), 0)
      const totalActualAmount = invoiceSales.reduce((sum, sale) => sum + (sale.total_actual_amount || 0), 0)

      // Create workbook
      const wb = XLSX.utils.book_new()

      // Create summary data
      const summaryData = [
        [
          userArea
            ? `CUSTOM SALES REPORT - ${userArea} (Invoice Sales Only)`
            : "CUSTOM SALES REPORT (Invoice Sales Only)",
        ],
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
        [""],
        ["SUMMARY STATISTICS"],
        ["Total Invoice Sales", totalSales, "Total invoice records"],
        ["VAT Sales", vatSales, "VAT registered"],
        ["Non-VAT Sales", nonVatSales, "Non-VAT registered"],
        ["Total Gross Taxable", formatCurrency(totalAmount), "Gross taxable amount"],
        ["Total Actual Amount", formatCurrency(totalActualAmount), "Total actual amount"],
        [""],
        ["SELECTED FIELDS FOR EXPORT"],
        [enabledFields.map((field) => field.label).join(", ")],
        [""],
        ["DETAILED SALES RECORDS"],
        enabledFields.map((field) => field.label),
      ]

      // Add invoice sales data with selected fields only
      invoiceSales.forEach((sale) => {
        const rowData = enabledFields.map((field) => {
          switch (field.key) {
            case "tax_month":
              return format(new Date(sale.tax_month), "MMM yyyy")
            case "tin":
              return formatTin(sale.tin)
            case "name":
              return sale.name
            case "substreet_street_brgy":
              return sale.substreet_street_brgy || ""
            case "tax_type":
              return sale.tax_type?.toUpperCase()
            case "sale_type":
              return sale.sale_type?.toUpperCase() || "INVOICE"
            case "gross_taxable":
              return sale.gross_taxable || 0
            case "total_actual_amount":
              return sale.total_actual_amount || 0
            case "invoice_number":
              return sale.invoice_number || ""
            case "pickup_date":
              return sale.pickup_date ? format(new Date(sale.pickup_date), "MMM dd, yyyy") : ""
            case "user_assigned_area":
              return sale.user_assigned_area || "N/A"
            case "files_count":
              return [
                ...(sale.cheque || []),
                ...(sale.voucher || []),
                ...(sale.invoice || []),
                ...(sale.doc_2307 || []),
                ...(sale.deposit_slip || []),
              ].length
            case "cheque_files":
              return sale.cheque?.join(", ") || ""
            case "voucher_files":
              return sale.voucher?.join(", ") || ""
            case "invoice_files":
              return sale.invoice?.join(", ") || ""
            case "doc_2307_files":
              return sale.doc_2307?.join(", ") || ""
            case "deposit_files":
              return sale.deposit_slip?.join(", ") || ""
            default:
              return ""
          }
        })
        summaryData.push(rowData)
      })

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(summaryData)

      // Set column widths based on selected fields
      const colWidths = enabledFields.map((field) => {
        switch (field.key) {
          case "name":
            return { width: 30 }
          case "substreet_street_brgy":
            return { width: 25 }
          case "cheque_files":
          case "voucher_files":
          case "invoice_files":
          case "doc_2307_files":
          case "deposit_files":
            return { width: 30 }
          default:
            return { width: 15 }
        }
      })
      ws["!cols"] = colWidths

      // Style the header rows
      const summaryHeaderStyle = {
        font: { bold: true, size: 12 },
        fill: { fgColor: { rgb: "D9E2F3" } },
      }

      // Apply styles to specific cells
      if (ws["A1"]) ws["A1"].s = { font: { bold: true, size: 16 }, alignment: { horizontal: "center" } }
      if (ws["A4"]) ws["A4"].s = summaryHeaderStyle
      if (ws["A11"]) ws["A11"].s = summaryHeaderStyle
      if (ws["A14"]) ws["A14"].s = summaryHeaderStyle

      // Style the data header row
      const headerRowIndex = 14
      for (let col = 0; col < enabledFields.length; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: headerRowIndex, c: col })
        if (ws[cellRef]) {
          ws[cellRef].s = {
            font: { bold: true },
            fill: { fgColor: { rgb: "E7E6E6" } },
            alignment: { horizontal: "center" },
          }
        }
      }

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Custom Sales Report")

      // Generate filename with current date and area
      const areaPrefix = userArea ? `${userArea.replace(/\s+/g, "_")}_` : ""
      const filename = `Custom_Sales_Report_${areaPrefix}${new Date().toISOString().split("T")[0]}.xlsx`

      /* ---- browser-safe download ---- */
      const wbArray = XLSX.write(wb, { bookType: "xlsx", type: "array" })
      const blob = new Blob([wbArray], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setOpen(false)
    } catch (error) {
      console.error("Error exporting custom report:", error)
      alert("Error generating custom export. Please try again.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-white text-blue-600 border border-blue-600 hover:bg-blue-50">
          <Settings className="h-4 w-4 mr-2" />
          Custom Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-white text-gray-900 border border-gray-300 shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900">Custom Export Settings</DialogTitle>
          <p className="text-sm text-gray-600 mt-2">
            Select the fields you want to include in your export. Only invoice sales will be exported.
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Field Selection Controls */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="bg-white text-[#001f3f] border border-[#001f3f] hover:bg-[#f0f4f8]"
              onClick={selectAll}
            >
              Select All
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="bg-white text-[#001f3f] border border-[#001f3f] hover:bg-[#f0f4f8]"
              onClick={deselectAll}
            >
              Deselect All
            </Button>
          </div>

          {/* Field Selection Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto border rounded-lg p-4">
            {exportFields.map((field) => (
              <div key={field.key} className="flex items-center space-x-2">
                <Checkbox id={field.key} checked={field.enabled} onCheckedChange={() => toggleField(field.key)} />
                <Label htmlFor={field.key} className="text-sm font-medium text-gray-700 cursor-pointer">
                  {field.label}
                </Label>
              </div>
            ))}
          </div>

          {/* Export Summary */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">Export Summary</h4>
            <p className="text-sm text-blue-800">
              <strong>{exportFields.filter((f) => f.enabled).length}</strong> fields selected from{" "}
              <strong>{sales.filter((s) => s.sale_type === "invoice").length}</strong> invoice sales records
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={exporting}
              className="bg-white text-[#001f3f] border border-[#001f3f] hover:bg-[#f0f4f8]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCustomExport}
              disabled={exporting || exportFields.filter((f) => f.enabled).length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {exporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export Selected Fields
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
