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
import * as XLSX from "xlsx"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase/client"
import { logNotification } from "@/utils/logNotification"

interface CommissionReport {
  uuid: string
  report_number: number
  created_at: string
  status: string
  sales_uuids: string[]
  accounting_pot?: string
  secretary_pot?: string
  remarks?: string
  user_profiles?: {
    full_name: string
    assigned_area: string
  }
}

interface CommissionReportsExportModalProps {
  reports: CommissionReport[]
  userArea?: string
  onExport?: (exportedCount: number) => void
}

interface ExportField {
  key: string
  label: string
  selected: boolean
}

export function CommissionReportsExportModal({ reports, userArea, onExport }: CommissionReportsExportModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { profile } = useAuth()

  const [exportFields, setExportFields] = useState<ExportField[]>([
    { key: "report_number", label: "Report Number", selected: true },
    { key: "created_by", label: "Created By", selected: true },
    { key: "assigned_area", label: "Assigned Area", selected: true },
    { key: "created_date", label: "Created Date", selected: true },
    { key: "status", label: "Status", selected: true },
    { key: "sales_count", label: "Sales Count", selected: true },
    { key: "accounting_attachments", label: "Accounting Attachments", selected: false },
    { key: "secretary_attachments", label: "Secretary Attachments", selected: false },
    { key: "remarks", label: "Remarks", selected: true },
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
      const dataRows = reports.map((report) => {
        const row: (string | number)[] = []

        selectedFields.forEach((field) => {
          switch (field.key) {
            case "report_number":
              row.push(`#${report.report_number}`)
              break
            case "created_by":
              row.push(report.user_profiles?.full_name || "Unknown User")
              break
            case "assigned_area":
              row.push(report.user_profiles?.assigned_area || userArea || "N/A")
              break
            case "created_date":
              row.push(format(new Date(report.created_at), "MMM dd, yyyy HH:mm"))
              break
            case "status":
              row.push(report.status?.toUpperCase() || "UNKNOWN")
              break
            case "sales_count":
              row.push(report.sales_uuids?.length || 0)
              break
            case "accounting_attachments":
              const accountingAttachments = report.accounting_pot ? JSON.parse(report.accounting_pot) : []
              row.push(Array.isArray(accountingAttachments) ? accountingAttachments.length : 0)
              break
            case "secretary_attachments":
              const secretaryAttachments = report.secretary_pot ? JSON.parse(report.secretary_pot) : []
              row.push(Array.isArray(secretaryAttachments) ? secretaryAttachments.length : 0)
              break
            case "remarks":
              row.push(report.remarks || "")
              break
            default:
              row.push("")
          }
        })

        return row
      })

      // Create summary data
      const summaryData = [
        [`COMMISSION REPORTS EXPORT${userArea ? ` - ${userArea}` : ""}`],
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
        ["Total Records:", reports.length],
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
          case "created_by":
          case "assigned_area":
          case "remarks":
            return { width: 25 }
          case "created_date":
            return { width: 20 }
          default:
            return { width: 15 }
        }
      })
      ws["!cols"] = colWidths

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Commission Reports Export")

      // Generate filename
      const filename = `Commission_Reports_Export${userArea ? `_${userArea.replace(/\s+/g, "_")}` : ""}_${new Date().toISOString().split("T")[0]}.xlsx`

      // Download file
      XLSX.writeFile(wb, filename)

      setOpen(false)
      onExport?.(reports.length)

      // Log export action
      if (profile?.id) {
        await logNotification(supabase, {
          action: "export_commission_reports",
          user_uuid: profile.id,
          user_name: profile.full_name || profile.first_name || profile.id,
          user_email: profile.email,
          description: `Exported commission reports to Excel (${reports.length} records)`,
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
          meta: JSON.stringify({
            user_id: profile.id,
            role: profile.role || "unknown",
            dashboard: "commission_reports",
            export_type: "custom",
            record_count: reports.length,
            area: userArea,
            selected_fields: exportFields.filter((f) => f.selected).map((f) => f.key),
          }),
        })
      }
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
        <Button variant="outline" size="sm" className="border-blue-300 text-blue-700 hover:bg-blue-50 bg-transparent">
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
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              className="text-xs bg-transparent text-[#001f3f] border-[#001f3f] hover:bg-[#001f3f]/10"
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={selectNone}
              className="text-xs bg-transparent text-[#001f3f] border-[#001f3f] hover:bg-[#001f3f]/10"
            >
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
            <br />• Total records: {reports.length}
            <br />• Selected fields: {exportFields.filter((f) => f.selected).length}
            <br />• File format: Excel (.xlsx)
          </div>
        </div>

        <DialogFooter className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="border-[#001f3f] text-[#001f3f] hover:bg-[#001f3f]/10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={loading || exportFields.filter((f) => f.selected).length === 0}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
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
