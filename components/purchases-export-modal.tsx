"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Download, FileSpreadsheet } from "lucide-react"
import * as XLSX from "xlsx"
import { format } from "date-fns"
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
  is_deleted: boolean
  deleted_at: string | null
  updated_at: string
  created_at: string
  user_assigned_area?: string | null
}

interface PurchasesExportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  purchases: Purchase[]
  role?: string
}

export function PurchasesExportModal({ open, onOpenChange, purchases, role = "admin" }: PurchasesExportModalProps) {
  const { profile } = useAuth()
  const [selectedFields, setSelectedFields] = useState<string[]>([
    "tax_month",
    "tin",
    "name",
    "tax_type",
    "gross_taxable",
    "invoice_number",
  ])
  const [isExporting, setIsExporting] = useState(false)

  const availableFields = [
    { key: "tax_month", label: "Tax Month" },
    { key: "tin", label: "TIN" },
    { key: "name", label: "Name" },
    { key: "substreet_street_brgy", label: "Address (Street/Brgy)" },
    { key: "district_city_zip", label: "Address (City/District)" },
    { key: "tax_type", label: "Tax Type" },
    { key: "gross_taxable", label: "Gross Taxable Amount" },
    { key: "invoice_number", label: "Invoice Number" },
    { key: "official_receipt", label: "Official Receipt" },
    { key: "remarks", label: "Latest Remark" },
    { key: "user_assigned_area", label: "Area" },
    { key: "created_at", label: "Date Created" },
    { key: "updated_at", label: "Last Updated" },
  ]

  const handleFieldToggle = (fieldKey: string) => {
    setSelectedFields((prev) => (prev.includes(fieldKey) ? prev.filter((f) => f !== fieldKey) : [...prev, fieldKey]))
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount)
  }

  const formatTin = (tin: string) => {
    const digits = tin.replace(/\D/g, "")
    return digits.replace(/(\d{3})(?=\d)/g, "$1-")
  }

  const getMostRecentRemark = (remarksJson: string | null) => {
    if (!remarksJson) return ""
    try {
      const remarks = JSON.parse(remarksJson)
      if (Array.isArray(remarks) && remarks.length > 0) {
        const recent = remarks[remarks.length - 1]
        return `${recent.remark} (by ${recent.name} on ${format(new Date(recent.date), "MMM dd, yyyy")})`
      }
    } catch {
      return ""
    }
    return ""
  }

  const getOfficialReceiptFiles = (officialReceipt: string | null) => {
    if (!officialReceipt) return ""
    try {
      const parsed = JSON.parse(officialReceipt)
      if (Array.isArray(parsed)) {
        return parsed.map((url) => decodeURIComponent(url.split("/").pop() || "")).join(", ")
      }
    } catch {
      if (typeof officialReceipt === "string" && officialReceipt.startsWith("http")) {
        return decodeURIComponent(officialReceipt.split("/").pop() || "")
      }
    }
    return ""
  }

  const handleExport = async () => {
    if (selectedFields.length === 0) {
      alert("Please select at least one field to export.")
      return
    }

    setIsExporting(true)

    try {
      // Prepare data for export
      const exportData = purchases.map((purchase) => {
        const row: any = {}

        selectedFields.forEach((field) => {
          switch (field) {
            case "tax_month":
              row["Tax Month"] = format(new Date(purchase.tax_month), "MMMM yyyy")
              break
            case "tin":
              row["TIN"] = formatTin(purchase.tin)
              break
            case "name":
              row["Name"] = purchase.name
              break
            case "substreet_street_brgy":
              row["Address (Street/Brgy)"] = purchase.substreet_street_brgy || ""
              break
            case "district_city_zip":
              row["Address (City/District)"] = purchase.district_city_zip || ""
              break
            case "tax_type":
              row["Tax Type"] = purchase.tax_type?.toUpperCase() || ""
              break
            case "gross_taxable":
              row["Gross Taxable Amount"] = purchase.gross_taxable || 0
              break
            case "invoice_number":
              row["Invoice Number"] = purchase.invoice_number || ""
              break
            case "official_receipt":
              row["Official Receipt"] = getOfficialReceiptFiles(purchase.official_receipt)
              break
            case "remarks":
              row["Latest Remark"] = getMostRecentRemark(purchase.remarks)
              break
            case "user_assigned_area":
              row["Area"] = purchase.user_assigned_area || ""
              break
            case "created_at":
              row["Date Created"] = format(new Date(purchase.created_at), "MMM dd, yyyy HH:mm")
              break
            case "updated_at":
              row["Last Updated"] = format(new Date(purchase.updated_at), "MMM dd, yyyy HH:mm")
              break
          }
        })

        return row
      })

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(exportData)

      // Auto-size columns
      const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
        wch: Math.max(key.length, 15),
      }))
      ws["!cols"] = colWidths

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Purchases")

      // Add summary sheet
      const summaryData = [
        { Metric: "Total Records", Value: purchases.length },
        { Metric: "VAT Purchases", Value: purchases.filter((p) => p.tax_type === "vat").length },
        { Metric: "Non-VAT Purchases", Value: purchases.filter((p) => p.tax_type === "non-vat").length },
        {
          Metric: "Total Gross Taxable",
          Value: formatCurrency(purchases.reduce((sum, p) => sum + (p.gross_taxable || 0), 0)),
        },
        { Metric: "Export Date", Value: format(new Date(), "MMM dd, yyyy HH:mm") },
        { Metric: "Exported By", Value: profile?.full_name || profile?.email || "Unknown" },
        { Metric: "Role", Value: role },
      ]

      const summaryWs = XLSX.utils.json_to_sheet(summaryData)
      summaryWs["!cols"] = [{ wch: 20 }, { wch: 30 }]
      XLSX.utils.book_append_sheet(wb, summaryWs, "Summary")

      // Generate filename
      const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm")
      const filename = `purchases_export_${timestamp}.xlsx`

      // Save file
      XLSX.writeFile(wb, filename)

      // Log the export action
      if (profile?.id) {
        await logNotification(supabase, {
          action: "purchases_exported",
          description: `Purchases data exported to Excel (${purchases.length} records)`,
          ip_address: null,
          location: null,
          meta: JSON.stringify({
            recordCount: purchases.length,
            selectedFields,
            filename,
            role,
            exportedBy: profile?.full_name || "",
          }),
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
          user_email: profile.email,
          user_name: profile.full_name || profile.first_name || profile.id,
          user_uuid: profile.id,
        })
      }

      onOpenChange(false)
    } catch (error) {
      console.error("Error exporting purchases:", error)
      alert("Error exporting data. Please try again.")
    } finally {
      setIsExporting(false)
    }
  }

  const themeColors = {
    admin: {
      primary: "#001f3f",
      secondary: "#3c8dbc",
      accent: "#ffc107",
    },
    secretary: {
      primary: "#6366f1",
      secondary: "#8b5cf6",
      accent: "#06b6d4",
    },
  }

  const colors = themeColors[role as keyof typeof themeColors] || themeColors.admin

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: colors.primary }}>
            <FileSpreadsheet className="h-5 w-5" />
            Export Purchases to Excel
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Select the fields you want to include in your Excel export. {purchases.length} records will be exported.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <h4 className="font-medium mb-3" style={{ color: colors.primary }}>
              Select Fields to Export:
            </h4>
            <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto">
              {availableFields.map((field) => (
                <div key={field.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={field.key}
                    checked={selectedFields.includes(field.key)}
                    onCheckedChange={() => handleFieldToggle(field.key)}
                    style={{ borderColor: colors.primary }}
                  />
                  <Label htmlFor={field.key} className="text-sm text-gray-700 cursor-pointer">
                    {field.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-gray-600">
              <strong>{selectedFields.length}</strong> fields selected • <strong>{purchases.length}</strong> records
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
                Cancel
              </Button>
              <Button
                onClick={handleExport}
                disabled={isExporting || selectedFields.length === 0}
                className="text-white"
                style={{ backgroundColor: colors.primary }}
              >
                {isExporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export to Excel
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
