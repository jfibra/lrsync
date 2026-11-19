"use client"

import { useState, useEffect, useCallback } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Filter,
} from "lucide-react"
import { format } from "date-fns"
import type { Sales } from "@/types/sales"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase/client"
import { logNotification } from "@/utils/logNotification"
import { applyTaxMonthFilter, formatDatePeriodLabel } from "@/lib/date-filter"
import { YearSelect, MonthMultiSelect } from "@/components/date-period-filter"
import {
  exportSalesTaxReportPDF,
  exportSalesTaxReportExcel,
  type TaxExportType,
  type SaleTypeExportFilter,
} from "@/utils/export-sales-tax"

type DateFilterMode = "period" | "range"
type DateFieldOption = "tax_month" | "pickup_date" | "date_added"
type ExportFormat = "pdf" | "excel"

interface ProfileSummary {
  id?: string
  auth_user_id?: string
  assigned_area?: string | null
  full_name?: string | null
}

interface SalesTaxExportModalProps {
  defaultTaxType?: string
  defaultYear?: string
  defaultMonths?: string[]
  availableAreas?: string[]
  defaultArea?: string
  allProfiles?: ProfileSummary[]
  scopedUserIds?: string[] | null
  userArea?: string | null
  dashboardName?: string
}

function getNextMonthFirstDay(yyyyMm: string): string {
  const [yStr, mStr] = yyyyMm.split("-")
  const y = Number(yStr)
  const m = Number(mStr)
  if (!y || !m) return `${yyyyMm}-31`
  const nextM = m === 12 ? 1 : m + 1
  const nextY = m === 12 ? y + 1 : y
  return `${nextY}-${String(nextM).padStart(2, "0")}-01`
}

function formatMonthInputLabel(yyyyMm: string): string {
  if (!yyyyMm) return ""
  const d = new Date(`${yyyyMm}-01T00:00:00`)
  if (Number.isNaN(d.getTime())) return yyyyMm
  return format(d, "MMM yyyy")
}

function formatDateInputLabel(yyyyMmDd: string): string {
  if (!yyyyMmDd) return ""
  const d = new Date(`${yyyyMmDd}T00:00:00`)
  if (Number.isNaN(d.getTime())) return yyyyMmDd
  return format(d, "MMM dd, yyyy")
}

export function SalesTaxExportModal({
  defaultTaxType,
  defaultYear = "all",
  defaultMonths = [],
  availableAreas,
  defaultArea = "all",
  allProfiles = [],
  scopedUserIds = null,
  userArea = null,
  dashboardName = "sales",
}: SalesTaxExportModalProps) {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)

  // Filter states
  const [taxType, setTaxType] = useState<TaxExportType>("vat")
  const [dateMode, setDateMode] = useState<DateFilterMode>("period")
  const [selectedYear, setSelectedYear] = useState<string>(defaultYear)
  const [selectedMonths, setSelectedMonths] = useState<string[]>(defaultMonths)
  const [dateField, setDateField] = useState<DateFieldOption>("tax_month")
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [saleTypeFilter, setSaleTypeFilter] = useState<SaleTypeExportFilter>("all")
  const [selectedArea, setSelectedArea] = useState<string>(defaultArea)
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf")

  // Preview & export state
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewStats, setPreviewStats] = useState({
    count: 0,
    grossTaxable: 0,
    actualAmount: 0,
    invoiceCount: 0,
    nonInvoiceCount: 0,
  })
  const [exporting, setExporting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Sync defaults when modal opens
  useEffect(() => {
    if (open) {
      if (defaultTaxType === "vat" || defaultTaxType === "non-vat") {
        setTaxType(defaultTaxType)
      }
      setSelectedYear(defaultYear || "all")
      setSelectedMonths(Array.isArray(defaultMonths) ? [...defaultMonths] : [])
      setSelectedArea(defaultArea || "all")
      setErrorMsg(null)
    }
  }, [open, defaultTaxType, defaultYear, defaultMonths, defaultArea])

  // Clear range inputs when switching between month-based and day-based fields
  const handleDateFieldChange = (val: DateFieldOption) => {
    setDateField(val)
    setDateFrom("")
    setDateTo("")
  }

  const isInvalidRange = Boolean(dateMode === "range" && dateFrom && dateTo && dateFrom > dateTo)

  // Build period label for UI & exported report header
  const getPeriodLabel = useCallback(() => {
    if (dateMode === "period") {
      return formatDatePeriodLabel(selectedYear, selectedMonths)
    }
    const fmtFn = dateField === "tax_month" ? formatMonthInputLabel : formatDateInputLabel
    if (dateFrom && dateTo) return `${fmtFn(dateFrom)} – ${fmtFn(dateTo)}`
    if (dateFrom) return `From ${fmtFn(dateFrom)}`
    if (dateTo) return `Up to ${fmtFn(dateTo)}`
    return "All Dates"
  }, [dateMode, selectedYear, selectedMonths, dateField, dateFrom, dateTo])

  const getDateFieldLabel = () => {
    if (dateMode === "period") return "Tax Month"
    if (dateField === "pickup_date") return "Pickup Date"
    if (dateField === "date_added") return "Date Added"
    return "Tax Month"
  }

  // Apply shared filters to any Supabase sales query
  const applyCommonFilters = useCallback(
    (baseQuery: any) => {
      let query = baseQuery.eq("is_deleted", false).eq("tax_type", taxType)

      // Date filter
      if (dateMode === "period") {
        query = applyTaxMonthFilter(query, selectedYear, selectedMonths)
      } else {
        if (dateField === "tax_month") {
          if (dateFrom) query = query.gte("tax_month", `${dateFrom}-01`)
          if (dateTo) query = query.lt("tax_month", getNextMonthFirstDay(dateTo))
        } else if (dateField === "pickup_date") {
          if (dateFrom) query = query.gte("pickup_date", dateFrom)
          if (dateTo) query = query.lte("pickup_date", dateTo)
        } else if (dateField === "date_added") {
          if (dateFrom) query = query.gte("date_added", dateFrom)
          if (dateTo) query = query.lte("date_added", `${dateTo}T23:59:59.999Z`)
        }
      }

      // Sale type filter
      if (saleTypeFilter !== "all") {
        query = query.eq("sale_type", saleTypeFilter)
      }

      // Role / area scoping
      if (scopedUserIds && scopedUserIds.length > 0) {
        query = query.in("user_uuid", scopedUserIds)
      } else if (availableAreas && selectedArea !== "all") {
        const areaUserIds = allProfiles
          .filter((p) => p.assigned_area === selectedArea)
          .map((p) => p.auth_user_id)
          .filter(Boolean) as string[]

        if (areaUserIds.length > 0) {
          query = query.in("user_uuid", areaUserIds)
        } else {
          query = query.in("user_uuid", ["00000000-0000-0000-0000-000000000000"])
        }
      }

      return query
    },
    [
      taxType,
      dateMode,
      selectedYear,
      selectedMonths,
      dateField,
      dateFrom,
      dateTo,
      saleTypeFilter,
      scopedUserIds,
      availableAreas,
      selectedArea,
      allProfiles,
    ],
  )

  // Live preview of matching count & totals whenever filters change while modal is open
  useEffect(() => {
    if (!open || isInvalidRange) return

    let cancelled = false
    const loadPreview = async () => {
      setPreviewLoading(true)
      setErrorMsg(null)
      try {
        // Guard for secretary with empty scopedUserIds
        if (scopedUserIds !== null && scopedUserIds.length === 0) {
          if (!cancelled) {
            setPreviewStats({
              count: 0,
              grossTaxable: 0,
              actualAmount: 0,
              invoiceCount: 0,
              nonInvoiceCount: 0,
            })
          }
          return
        }

        const baseQuery = supabase
          .from("sales")
          .select("gross_taxable, total_actual_amount, sale_type", { count: "exact" })
          .limit(10000)

        const { data, count, error } = await applyCommonFilters(baseQuery)
        if (error) throw error

        if (!cancelled) {
          const rows = data || []
          let grossTaxable = 0
          let actualAmount = 0
          let invoiceCount = 0
          let nonInvoiceCount = 0

          for (const row of rows) {
            grossTaxable += Number(row.gross_taxable) || 0
            actualAmount += Number(row.total_actual_amount) || 0
            if ((row.sale_type || "invoice").toLowerCase() === "invoice") {
              invoiceCount += 1
            } else {
              nonInvoiceCount += 1
            }
          }

          setPreviewStats({
            count: count ?? rows.length,
            grossTaxable,
            actualAmount,
            invoiceCount,
            nonInvoiceCount,
          })
        }
      } catch (err) {
        console.error("Error loading tax export preview:", err)
        if (!cancelled) {
          setErrorMsg("Unable to load preview counts. Please check your filters.")
        }
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    }

    const timer = setTimeout(loadPreview, 150)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, isInvalidRange, applyCommonFilters, scopedUserIds])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount || 0)

  const handleExport = async () => {
    if (isInvalidRange) return
    setExporting(true)
    setErrorMsg(null)

    try {
      const baseQuery = supabase
        .from("sales")
        .select(
          `
          *,
          taxpayer_listings (
            registered_name,
            substreet_street_brgy,
            district_city_zip
          )
        `,
        )
        .order("tax_month", { ascending: true })
        .order("invoice_number", { ascending: true })
        .limit(10000)

      const { data, error } = await applyCommonFilters(baseQuery)
      if (error) throw error

      const profileMap = new Map(allProfiles.map((p) => [p.auth_user_id, p]))
      const records: Sales[] = (data || []).map((sale: any) => ({
        ...sale,
        user_assigned_area: profileMap.get(sale.user_uuid)?.assigned_area || userArea || null,
      }))

      if (records.length === 0) {
        setErrorMsg("No matching records found for the selected filters.")
        return
      }

      const areaLabel =
        availableAreas && selectedArea !== "all"
          ? selectedArea
          : userArea || "All Areas"

      const exportOptions = {
        taxType,
        periodLabel: getPeriodLabel(),
        dateFieldLabel: getDateFieldLabel(),
        saleTypeFilter,
        areaLabel,
        exportedBy: profile?.full_name || profile?.first_name || profile?.email || "System User",
        exportedByEmail: profile?.email || "",
      }

      const filename =
        exportFormat === "pdf"
          ? exportSalesTaxReportPDF(records, exportOptions)
          : exportSalesTaxReportExcel(records, exportOptions)

      // Audit log
      if (profile?.id) {
        await logNotification(supabase, {
          action: `export_${taxType}_sales_report`,
          description: `Exported ${taxType.toUpperCase()} sales report (${exportFormat.toUpperCase()}, ${records.length} records, ${exportOptions.periodLabel})`,
          ip_address: null,
          location: null,
          meta: JSON.stringify({
            user_id: profile.id,
            role: profile.role || "unknown",
            dashboard: dashboardName,
            tax_type: taxType,
            export_format: exportFormat,
            date_mode: dateMode,
            date_field: getDateFieldLabel(),
            period: exportOptions.periodLabel,
            sale_type: saleTypeFilter,
            area: areaLabel,
            record_count: records.length,
            filename,
          }),
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
          user_email: profile.email,
          user_name: profile.full_name || profile.first_name || profile.id,
          user_uuid: profile.id,
        })
      }

      setOpen(false)
    } catch (err) {
      console.error("Error exporting VAT/Non-VAT sales report:", err)
      setErrorMsg("Failed to generate report. Please try again.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-emerald-300 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 bg-white font-medium"
        >
          <FileText className="h-4 w-4 mr-2" />
          <span>VAT / Non-VAT Report</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white text-[#001f3f]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#001f3f] flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            Export VAT / Non-VAT Sales Report
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Generate a formatted report containing strictly VAT-only or Non-VAT-only sales records for your chosen date range.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* 1. Tax Type Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              1. Tax Classification (Required)
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTaxType("vat")}
                className={`p-3.5 rounded-lg border-2 text-left transition-all ${
                  taxType === "vat"
                    ? "border-blue-600 bg-blue-50/70 shadow-sm"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-blue-900">VAT Only</span>
                  {taxType === "vat" && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Export only VAT-registered sales records
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTaxType("non-vat")}
                className={`p-3.5 rounded-lg border-2 text-left transition-all ${
                  taxType === "non-vat"
                    ? "border-emerald-600 bg-emerald-50/70 shadow-sm"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-emerald-900">Non-VAT Only</span>
                  {taxType === "non-vat" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Export only Non-VAT sales records
                </p>
              </button>
            </div>
          </div>

          {/* 2. Date Filter */}
          <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-50/70">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                2. Date Filter
              </Label>

              <div className="inline-flex rounded-md bg-white border border-gray-200 p-0.5">
                <button
                  type="button"
                  onClick={() => setDateMode("period")}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    dateMode === "period"
                      ? "bg-[#001f3f] text-white"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Tax Period (Year / Month)
                </button>
                <button
                  type="button"
                  onClick={() => setDateMode("range")}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    dateMode === "range"
                      ? "bg-[#001f3f] text-white"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Custom Date Range
                </button>
              </div>
            </div>

            {dateMode === "period" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Year</Label>
                  <YearSelect value={selectedYear} onValueChange={setSelectedYear} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Months / Quarter</Label>
                  <MonthMultiSelect
                    selectedMonths={selectedMonths}
                    onMonthsChange={setSelectedMonths}
                    selectedYear={selectedYear}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Filter Date Field</Label>
                  <Select
                    value={dateField}
                    onValueChange={(v) => handleDateFieldChange(v as DateFieldOption)}
                  >
                    <SelectTrigger className="w-full bg-white border-gray-300 text-gray-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-200">
                      <SelectItem value="tax_month" className="text-gray-900">
                        Tax Month (Month Range)
                      </SelectItem>
                      <SelectItem value="pickup_date" className="text-gray-900">
                        Pickup Date (Exact Dates)
                      </SelectItem>
                      <SelectItem value="date_added" className="text-gray-900">
                        Date Added (Exact Dates)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">
                      From {dateField === "tax_month" ? "(Month)" : "(Date)"}
                    </Label>
                    <Input
                      type={dateField === "tax_month" ? "month" : "date"}
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="bg-white border-gray-300 text-gray-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">
                      To {dateField === "tax_month" ? "(Month)" : "(Date)"}
                    </Label>
                    <Input
                      type={dateField === "tax_month" ? "month" : "date"}
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="bg-white border-gray-300 text-gray-900"
                    />
                  </div>
                </div>

                {isInvalidRange && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Start date cannot be later than end date.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 3. Additional Scope Filters */}
          <div className={`grid grid-cols-1 ${availableAreas && availableAreas.length > 0 ? "sm:grid-cols-2" : ""} gap-3`}>
            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-gray-400" />
                Sale Type
              </Label>
              <Select
                value={saleTypeFilter}
                onValueChange={(v) => setSaleTypeFilter(v as SaleTypeExportFilter)}
              >
                <SelectTrigger className="w-full bg-white border-gray-300 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200">
                  <SelectItem value="all" className="text-gray-900">
                    All Sale Types (Invoice & Non-Invoice)
                  </SelectItem>
                  <SelectItem value="invoice" className="text-gray-900">
                    Invoice Sales Only
                  </SelectItem>
                  <SelectItem value="non-invoice" className="text-gray-900">
                    Non-Invoice Sales Only
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {availableAreas && availableAreas.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Assigned Area
                </Label>
                <Select value={selectedArea} onValueChange={setSelectedArea}>
                  <SelectTrigger className="w-full bg-white border-gray-300 text-gray-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200">
                    <SelectItem value="all" className="text-gray-900">
                      All Areas
                    </SelectItem>
                    {availableAreas.map((area) => (
                      <SelectItem key={area} value={area} className="text-gray-900">
                        {area}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* 4. Output Format */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              3. Report Format
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setExportFormat("pdf")}
                className={`p-3 rounded-lg border-2 text-left transition-all flex items-start gap-3 ${
                  exportFormat === "pdf"
                    ? "border-[#001f3f] bg-slate-50 shadow-sm"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <div className="p-2 rounded-md bg-red-50 text-red-600 shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-[#001f3f] flex items-center gap-1.5">
                    Professional PDF Report
                    {exportFormat === "pdf" && <CheckCircle2 className="h-3.5 w-3.5 text-[#001f3f]" />}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Print-ready A4 landscape schedule with KPIs, monthly breakdown & signatory lines
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setExportFormat("excel")}
                className={`p-3 rounded-lg border-2 text-left transition-all flex items-start gap-3 ${
                  exportFormat === "excel"
                    ? "border-[#001f3f] bg-slate-50 shadow-sm"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <div className="p-2 rounded-md bg-emerald-50 text-emerald-600 shrink-0">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-[#001f3f] flex items-center gap-1.5">
                    Excel Workbook (.xlsx)
                    {exportFormat === "excel" && <CheckCircle2 className="h-3.5 w-3.5 text-[#001f3f]" />}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Multi-sheet workbook with Executive Summary, Monthly Breakdown & SUM formulas
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Live Summary Preview */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#001f3f]">
                Report Preview
              </span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  taxType === "vat"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {taxType === "vat" ? "VAT ONLY" : "NON-VAT ONLY"} • {getPeriodLabel()}
              </span>
            </div>

            {previewLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-600 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                Calculating matching records...
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="bg-white rounded-md p-2.5 border border-gray-200">
                  <div className="text-[11px] text-gray-500 uppercase font-medium">Records</div>
                  <div className="text-lg font-bold text-[#001f3f]">
                    {previewStats.count.toLocaleString("en-PH")}
                  </div>
                </div>
                <div className="bg-white rounded-md p-2.5 border border-gray-200">
                  <div className="text-[11px] text-gray-500 uppercase font-medium">Gross Taxable</div>
                  <div className="text-sm sm:text-base font-bold text-indigo-700 truncate">
                    {formatCurrency(previewStats.grossTaxable)}
                  </div>
                </div>
                <div className="bg-white rounded-md p-2.5 border border-gray-200">
                  <div className="text-[11px] text-gray-500 uppercase font-medium">Actual Amount</div>
                  <div className="text-sm sm:text-base font-bold text-gray-800 truncate">
                    {formatCurrency(previewStats.actualAmount)}
                  </div>
                </div>
              </div>
            )}

            {errorMsg && (
              <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {errorMsg}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-3 pt-2 border-t border-gray-100">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={exporting}
            className="border-gray-300 text-gray-700 hover:bg-gray-100 bg-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={exporting || previewLoading || isInvalidRange || previewStats.count === 0}
            className="bg-[#001f3f] hover:bg-[#002f5f] text-white font-medium"
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating {exportFormat === "pdf" ? "PDF" : "Excel"}...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export {taxType === "vat" ? "VAT" : "Non-VAT"} {exportFormat === "pdf" ? "PDF" : "Excel"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
