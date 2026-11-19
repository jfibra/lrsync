import jsPDF from "jspdf"
import * as XLSX from "xlsx"
import { format } from "date-fns"
import type { Sales } from "@/types/sales"

export type TaxExportType = "vat" | "non-vat"
export type SaleTypeExportFilter = "all" | "invoice" | "non-invoice"

export interface SalesTaxExportOptions {
  taxType: TaxExportType
  periodLabel: string
  dateFieldLabel: string
  saleTypeFilter: SaleTypeExportFilter
  areaLabel?: string
  exportedBy?: string
  exportedByEmail?: string
  companyName?: string
}

const DEFAULT_COMPANY_NAME = "LEUTERIO REALTY & BROKERAGE"

function formatTin(tin?: string | null): string {
  if (!tin) return "-"
  const digits = tin.replace(/\D/g, "")
  if (!digits) return tin
  return digits.replace(/(\d{3})(?=\d)/g, "$1-")
}

function formatNumber(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0)
}

function formatPhpText(amount: number): string {
  return `PHP ${formatNumber(amount)}`
}

function safeFormatDate(dateStr?: string | null, pattern = "MMM dd, yyyy"): string {
  if (!dateStr) return "-"
  const parsed = new Date(dateStr)
  if (Number.isNaN(parsed.getTime())) return String(dateStr)
  return format(parsed, pattern)
}

function getFullAddress(sale: Sales): string {
  const street = sale.substreet_street_brgy?.trim() || sale.taxpayer_listings?.substreet_street_brgy?.trim() || ""
  const city = sale.district_city_zip?.trim() || sale.taxpayer_listings?.district_city_zip?.trim() || ""
  if (street && city) return `${street}, ${city}`
  return street || city || "-"
}

function getLatestRemark(remarks: any): string {
  if (!remarks) return ""
  try {
    const list = Array.isArray(remarks) ? remarks : JSON.parse(remarks)
    if (!Array.isArray(list) || list.length === 0) return ""
    const sorted = [...list].sort((a, b) => {
      const ta = a?.date ? new Date(a.date).getTime() : 0
      const tb = b?.date ? new Date(b.date).getTime() : 0
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta)
    })
    return sorted[0]?.remark || ""
  } catch {
    return typeof remarks === "string" ? remarks : ""
  }
}

function getSaleTypeLabel(filter: SaleTypeExportFilter): string {
  if (filter === "invoice") return "Invoice Sales Only"
  if (filter === "non-invoice") return "Non-Invoice Sales Only"
  return "All Sale Types"
}

function buildMonthlyBreakdown(records: Sales[]) {
  const map = new Map<
    string,
    { sortKey: string; label: string; count: number; grossTaxable: number; actualAmount: number }
  >()

  for (const sale of records) {
    const d = sale.tax_month ? new Date(sale.tax_month) : null
    const valid = d && !Number.isNaN(d.getTime())
    const sortKey = valid ? format(d, "yyyy-MM") : "0000-00"
    const label = valid ? format(d, "MMMM yyyy") : "Unspecified"

    const existing = map.get(sortKey) || {
      sortKey,
      label,
      count: 0,
      grossTaxable: 0,
      actualAmount: 0,
    }
    existing.count += 1
    existing.grossTaxable += Number(sale.gross_taxable) || 0
    existing.actualAmount += Number(sale.total_actual_amount) || 0
    map.set(sortKey, existing)
  }

  return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey))
}

function buildSafeFilename(
  taxType: TaxExportType,
  periodLabel: string,
  ext: "pdf" | "xlsx",
): string {
  const taxSlug = taxType === "vat" ? "VAT_Only" : "Non-VAT_Only"
  const periodSlug = periodLabel
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
  const dateStamp = format(new Date(), "yyyy-MM-dd")
  return `Sales_Report_${taxSlug}_${periodSlug || "Filtered"}_${dateStamp}.${ext}`
}

/**
 * Generate and download a professional Landscape A4 PDF report for VAT-only or Non-VAT-only sales.
 */
export function exportSalesTaxReportPDF(records: Sales[], options: SalesTaxExportOptions): string {
  const {
    taxType,
    periodLabel,
    dateFieldLabel,
    saleTypeFilter,
    areaLabel = "All Areas",
    exportedBy = "System User",
    companyName = DEFAULT_COMPANY_NAME,
  } = options

  const isVat = taxType === "vat"
  const reportTitle = isVat ? "VAT SALES REPORT" : "NON-VAT SALES REPORT"
  const taxClassLabel = isVat ? "VAT Registered Sales Only" : "Non-VAT Registered Sales Only"

  // Corporate palette
  const NAVY: [number, number, number] = [0, 31, 63]
  const ACCENT: [number, number, number] = isVat ? [29, 78, 216] : [5, 150, 105]
  const ACCENT_LIGHT: [number, number, number] = isVat ? [239, 246, 255] : [236, 253, 245]
  const GOLD: [number, number, number] = [217, 165, 32]
  const TEXT_DARK: [number, number, number] = [17, 24, 39]
  const TEXT_MUTED: [number, number, number] = [100, 116, 139]
  const BORDER: [number, number, number] = [203, 213, 225]
  const ZEBRA: [number, number, number] = [248, 250, 252]

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  })

  const pageWidth = pdf.internal.pageSize.getWidth() // 297mm
  const pageHeight = pdf.internal.pageSize.getHeight() // 210mm
  const marginX = 12
  const contentWidth = pageWidth - marginX * 2 // 273mm
  const footerReservedHeight = 14
  const maxBodyY = pageHeight - footerReservedHeight

  const generatedTimestamp = format(new Date(), "MMMM dd, yyyy hh:mm a")

  // Compute totals
  const totalRecords = records.length
  const totalGrossTaxable = records.reduce((sum, s) => sum + (Number(s.gross_taxable) || 0), 0)
  const totalActualAmount = records.reduce((sum, s) => sum + (Number(s.total_actual_amount) || 0), 0)
  const invoiceCount = records.filter((s) => (s.sale_type || "invoice").toLowerCase() === "invoice").length
  const nonInvoiceCount = totalRecords - invoiceCount
  const monthlyBreakdown = buildMonthlyBreakdown(records)

  // --- Helper: Draw Top Corporate Header on Page 1 ---
  let y = 0

  // Navy header bar
  pdf.setFillColor(...NAVY)
  pdf.rect(0, 0, pageWidth, 24, "F")

  // Gold accent strip
  pdf.setFillColor(...GOLD)
  pdf.rect(0, 24, pageWidth, 1.4, "F")

  // Company Title (Left)
  pdf.setTextColor(255, 255, 255)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(14)
  pdf.text(companyName, marginX, 11)

  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(8.5)
  pdf.setTextColor(203, 213, 225)
  pdf.text("Sales & Tax Compliance Schedule", marginX, 17.5)

  // Report Badge & Title (Right)
  pdf.setFillColor(...ACCENT)
  pdf.roundedRect(pageWidth - marginX - 66, 5.5, 66, 13, 2, 2, "F")
  pdf.setTextColor(255, 255, 255)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(11)
  pdf.text(reportTitle, pageWidth - marginX - 33, 13.3, { align: "center" })

  y = 30

  // --- Metadata Info Box ---
  pdf.setFillColor(248, 250, 252)
  pdf.setDrawColor(...BORDER)
  pdf.setLineWidth(0.25)
  pdf.roundedRect(marginX, y, contentWidth, 18, 1.5, 1.5, "FD")

  const metaCol1 = marginX + 4
  const metaCol2 = marginX + 96
  const metaCol3 = marginX + 188

  const drawMetaPair = (x: number, rowY: number, label: string, value: string) => {
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(7.5)
    pdf.setTextColor(...TEXT_MUTED)
    pdf.text(label.toUpperCase(), x, rowY)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(8.5)
    pdf.setTextColor(...TEXT_DARK)
    const truncated = pdf.splitTextToSize(value, 85)[0] || value
    pdf.text(truncated, x, rowY + 4)
  }

  drawMetaPair(metaCol1, y + 5, "Tax Classification", taxClassLabel)
  drawMetaPair(metaCol2, y + 5, `Date Filter (${dateFieldLabel})`, periodLabel)
  drawMetaPair(metaCol3, y + 5, "Sale Type / Area", `${getSaleTypeLabel(saleTypeFilter)} • ${areaLabel}`)

  // Second subtle line inside metadata box
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(7.2)
  pdf.setTextColor(...TEXT_MUTED)
  pdf.text(`Prepared by: ${exportedBy}`, metaCol1, y + 15)
  pdf.text(`Generated on: ${generatedTimestamp}`, metaCol3, y + 15)

  y += 22

  // --- Executive KPI Cards ---
  const cardGap = 4
  const cardWidth = (contentWidth - cardGap * 3) / 4
  const cardHeight = 16

  const kpiCards = [
    {
      label: "TOTAL RECORDS",
      value: `${totalRecords.toLocaleString("en-PH")}`,
      sub: isVat ? "VAT-registered entries" : "Non-VAT entries",
      highlight: false,
    },
    {
      label: "TOTAL GROSS TAXABLE",
      value: formatPhpText(totalGrossTaxable),
      sub: "Aggregate gross taxable sales",
      highlight: true,
    },
    {
      label: "TOTAL ACTUAL AMOUNT",
      value: formatPhpText(totalActualAmount),
      sub: "Aggregate actual amount",
      highlight: false,
    },
    {
      label: "SALE TYPE BREAKDOWN",
      value: `${invoiceCount} Inv / ${nonInvoiceCount} Non-Inv`,
      sub: `${monthlyBreakdown.length} tax month(s) covered`,
      highlight: false,
    },
  ]

  kpiCards.forEach((card, idx) => {
    const cx = marginX + idx * (cardWidth + cardGap)
    if (card.highlight) {
      pdf.setFillColor(...ACCENT_LIGHT)
      pdf.setDrawColor(...ACCENT)
    } else {
      pdf.setFillColor(255, 255, 255)
      pdf.setDrawColor(...BORDER)
    }
    pdf.setLineWidth(0.3)
    pdf.roundedRect(cx, y, cardWidth, cardHeight, 1.5, 1.5, "FD")

    // Left accent bar
    pdf.setFillColor(...(card.highlight ? ACCENT : NAVY))
    pdf.rect(cx, y + 1.5, 1.2, cardHeight - 3, "F")

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(6.8)
    pdf.setTextColor(...TEXT_MUTED)
    pdf.text(card.label, cx + 4, y + 4.8)

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(10.5)
    pdf.setTextColor(...(card.highlight ? ACCENT : TEXT_DARK))
    pdf.text(card.value, cx + 4, y + 10.5)

    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(6.8)
    pdf.setTextColor(...TEXT_MUTED)
    pdf.text(card.sub, cx + 4, y + 14.2)
  })

  y += cardHeight + 6

  // --- Section Title: Detailed Sales Schedule ---
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(9.5)
  pdf.setTextColor(...NAVY)
  pdf.text(`DETAILED ${isVat ? "VAT" : "NON-VAT"} SALES SCHEDULE`, marginX, y)
  y += 3

  // --- Table Column Definitions (Total = 273mm) ---
  const columns = [
    { key: "idx", label: "#", width: 9, align: "center" as const },
    { key: "tax_month", label: "Tax Month", width: 21, align: "left" as const },
    { key: "tin", label: "TIN", width: 27, align: "left" as const },
    { key: "name", label: "Registered Name / Client", width: 54, align: "left" as const },
    { key: "address", label: "Address", width: 47, align: "left" as const },
    { key: "invoice_number", label: "Invoice #", width: 25, align: "left" as const },
    { key: "sale_type", label: "Sale Type", width: 18, align: "center" as const },
    { key: "pickup_date", label: "Pickup Date", width: 22, align: "center" as const },
    { key: "gross_taxable", label: "Gross Taxable", width: 25, align: "right" as const },
    { key: "total_actual_amount", label: "Actual Amount", width: 25, align: "right" as const },
  ]

  const headerHeight = 8
  const lineHeight = 3.6
  const cellPadX = 1.6
  const cellPadY = 2.1

  const drawContinuationHeader = () => {
    pdf.setFillColor(...NAVY)
    pdf.rect(0, 0, pageWidth, 11, "F")
    pdf.setFillColor(...GOLD)
    pdf.rect(0, 11, pageWidth, 0.8, "F")

    pdf.setTextColor(255, 255, 255)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(9)
    pdf.text(`${companyName}  —  ${reportTitle}`, marginX, 7.2)

    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(8)
    pdf.setTextColor(203, 213, 225)
    pdf.text(`Period: ${periodLabel}`, pageWidth - marginX, 7.2, { align: "right" })

    y = 16
  }

  const drawTableHeader = () => {
    pdf.setFillColor(...NAVY)
    pdf.rect(marginX, y, contentWidth, headerHeight, "F")

    pdf.setTextColor(255, 255, 255)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(7.5)

    let cx = marginX
    for (const col of columns) {
      const tx =
        col.align === "right"
          ? cx + col.width - cellPadX
          : col.align === "center"
            ? cx + col.width / 2
            : cx + cellPadX
      pdf.text(col.label, tx, y + 5.2, { align: col.align })
      cx += col.width
    }
    y += headerHeight
  }

  drawTableHeader()

  // --- Render Rows ---
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(7.5)

  records.forEach((sale, idx) => {
    const rowValues: Record<string, string> = {
      idx: String(idx + 1),
      tax_month: safeFormatDate(sale.tax_month, "MMM yyyy"),
      tin: formatTin(sale.tin),
      name: sale.name || "-",
      address: getFullAddress(sale),
      invoice_number: sale.invoice_number || "-",
      sale_type: (sale.sale_type || "INVOICE").toUpperCase(),
      pickup_date: safeFormatDate(sale.pickup_date, "MMM dd, yyyy"),
      gross_taxable: formatNumber(Number(sale.gross_taxable) || 0),
      total_actual_amount: formatNumber(Number(sale.total_actual_amount) || 0),
    }

    // Wrap text per cell and compute row height
    const wrappedCells: string[][] = columns.map((col) => {
      const text = rowValues[col.key] || ""
      return pdf.splitTextToSize(text, col.width - cellPadX * 2)
    })

    const maxLines = Math.max(1, ...wrappedCells.map((lines) => lines.length))
    const rowHeight = Math.max(6.8, maxLines * lineHeight + cellPadY * 2 - 0.6)

    // Page break if needed
    if (y + rowHeight > maxBodyY) {
      pdf.addPage()
      drawContinuationHeader()
      drawTableHeader()
    }

    // Zebra background
    if (idx % 2 === 1) {
      pdf.setFillColor(...ZEBRA)
      pdf.rect(marginX, y, contentWidth, rowHeight, "F")
    }

    // Horizontal bottom border
    pdf.setDrawColor(226, 232, 240)
    pdf.setLineWidth(0.15)
    pdf.line(marginX, y + rowHeight, marginX + contentWidth, y + rowHeight)

    // Render cell text
    let cx = marginX
    columns.forEach((col, cIdx) => {
      const lines = wrappedCells[cIdx]
      const isAmount = col.key === "gross_taxable" || col.key === "total_actual_amount"
      pdf.setFont("helvetica", isAmount || col.key === "name" ? "bold" : "normal")
      pdf.setFontSize(7.4)
      pdf.setTextColor(...(col.key === "idx" ? TEXT_MUTED : TEXT_DARK))

      const tx =
        col.align === "right"
          ? cx + col.width - cellPadX
          : col.align === "center"
            ? cx + col.width / 2
            : cx + cellPadX

      lines.forEach((line, lineIdx) => {
        pdf.text(line, tx, y + cellPadY + 2.5 + lineIdx * lineHeight, { align: col.align })
      })

      cx += col.width
    })

    y += rowHeight
  })

  // --- Grand Total Row ---
  const totalRowHeight = 9
  if (y + totalRowHeight > maxBodyY) {
    pdf.addPage()
    drawContinuationHeader()
    drawTableHeader()
  }

  pdf.setFillColor(...ACCENT_LIGHT)
  pdf.rect(marginX, y, contentWidth, totalRowHeight, "F")
  pdf.setDrawColor(...NAVY)
  pdf.setLineWidth(0.45)
  pdf.line(marginX, y, marginX + contentWidth, y)
  pdf.line(marginX, y + totalRowHeight, marginX + contentWidth, y + totalRowHeight)

  const grossColX = marginX + columns.slice(0, 8).reduce((s, c) => s + c.width, 0)
  const actualColX = grossColX + columns[8].width

  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(8.2)
  pdf.setTextColor(...NAVY)
  pdf.text(
    `GRAND TOTAL (${totalRecords} ${isVat ? "VAT" : "NON-VAT"} RECORD${totalRecords === 1 ? "" : "S"})`,
    marginX + 3,
    y + 5.8,
  )

  pdf.setTextColor(...ACCENT)
  pdf.text(formatNumber(totalGrossTaxable), grossColX + columns[8].width - cellPadX, y + 5.8, {
    align: "right",
  })
  pdf.setTextColor(...NAVY)
  pdf.text(formatNumber(totalActualAmount), actualColX + columns[9].width - cellPadX, y + 5.8, {
    align: "right",
  })

  y += totalRowHeight + 8

  // --- Monthly Breakdown Table (if more than 1 month) ---
  if (monthlyBreakdown.length > 1) {
    const neededHeight = 14 + monthlyBreakdown.length * 6.5
    if (y + Math.min(neededHeight, 36) > maxBodyY) {
      pdf.addPage()
      drawContinuationHeader()
    }

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(9)
    pdf.setTextColor(...NAVY)
    pdf.text("MONTHLY SUMMARY BREAKDOWN", marginX, y)
    y += 3

    const mCols = [
      { label: "Tax Month", width: 55, align: "left" as const },
      { label: "Record Count", width: 32, align: "center" as const },
      { label: "Gross Taxable (PHP)", width: 48, align: "right" as const },
      { label: "Actual Amount (PHP)", width: 48, align: "right" as const },
    ]
    const mTotalWidth = mCols.reduce((s, c) => s + c.width, 0)

    const drawMonthlyHeader = () => {
      pdf.setFillColor(...NAVY)
      pdf.rect(marginX, y, mTotalWidth, 7, "F")
      pdf.setTextColor(255, 255, 255)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(7.5)
      let mx = marginX
      mCols.forEach((c) => {
        const tx =
          c.align === "right" ? mx + c.width - 2 : c.align === "center" ? mx + c.width / 2 : mx + 2
        pdf.text(c.label, tx, y + 4.7, { align: c.align })
        mx += c.width
      })
      y += 7
    }

    drawMonthlyHeader()

    monthlyBreakdown.forEach((m, idx) => {
      if (y + 6.5 > maxBodyY) {
        pdf.addPage()
        drawContinuationHeader()
        drawMonthlyHeader()
      }

      if (idx % 2 === 1) {
        pdf.setFillColor(...ZEBRA)
        pdf.rect(marginX, y, mTotalWidth, 6.2, "F")
      }

      pdf.setDrawColor(226, 232, 240)
      pdf.setLineWidth(0.15)
      pdf.line(marginX, y + 6.2, marginX + mTotalWidth, y + 6.2)

      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(7.6)
      pdf.setTextColor(...TEXT_DARK)

      let mx = marginX
      pdf.text(m.label, mx + 2, y + 4.2)
      mx += mCols[0].width
      pdf.text(String(m.count), mx + mCols[1].width / 2, y + 4.2, { align: "center" })
      mx += mCols[1].width
      pdf.text(formatNumber(m.grossTaxable), mx + mCols[2].width - 2, y + 4.2, { align: "right" })
      mx += mCols[2].width
      pdf.text(formatNumber(m.actualAmount), mx + mCols[3].width - 2, y + 4.2, { align: "right" })

      y += 6.2
    })

    y += 8
  }

  // --- Signatory Block ---
  const sigBlockHeight = 24
  if (y + sigBlockHeight > maxBodyY) {
    pdf.addPage()
    drawContinuationHeader()
  }

  const sigCols = [
    { role: "Prepared By:", name: exportedBy },
    { role: "Checked / Reviewed By:", name: "Accounting / Finance" },
    { role: "Approved By:", name: "Management" },
  ]
  const sigWidth = (contentWidth - 20) / 3

  sigCols.forEach((sig, idx) => {
    const sx = marginX + idx * (sigWidth + 10)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(7.5)
    pdf.setTextColor(...TEXT_MUTED)
    pdf.text(sig.role, sx, y + 4)

    pdf.setDrawColor(...TEXT_DARK)
    pdf.setLineWidth(0.3)
    pdf.line(sx, y + 15, sx + sigWidth - 8, y + 15)

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(8)
    pdf.setTextColor(...TEXT_DARK)
    pdf.text(sig.name, sx, y + 19.2)

    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(7)
    pdf.setTextColor(...TEXT_MUTED)
    pdf.text("Signature over Printed Name / Date", sx, y + 22.8)
  })

  // --- Page Footers on Every Page ---
  const pageCount = pdf.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    pdf.setPage(p)
    pdf.setDrawColor(...BORDER)
    pdf.setLineWidth(0.2)
    pdf.line(marginX, pageHeight - 10, pageWidth - marginX, pageHeight - 10)

    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(7.2)
    pdf.setTextColor(...TEXT_MUTED)
    pdf.text(
      `Confidential — ${companyName} | ${reportTitle} (${periodLabel})`,
      marginX,
      pageHeight - 6,
    )
    pdf.text(`Page ${p} of ${pageCount}`, pageWidth - marginX, pageHeight - 6, { align: "right" })
  }

  const filename = buildSafeFilename(taxType, periodLabel, "pdf")
  pdf.save(filename)
  return filename
}

/**
 * Generate and download a professional multi-sheet Excel (.xlsx) workbook for VAT-only or Non-VAT-only sales.
 */
export function exportSalesTaxReportExcel(records: Sales[], options: SalesTaxExportOptions): string {
  const {
    taxType,
    periodLabel,
    dateFieldLabel,
    saleTypeFilter,
    areaLabel = "All Areas",
    exportedBy = "System User",
    exportedByEmail = "",
    companyName = DEFAULT_COMPANY_NAME,
  } = options

  const isVat = taxType === "vat"
  const reportTitle = isVat ? "VAT SALES REPORT" : "NON-VAT SALES REPORT"
  const taxClassLabel = isVat ? "VAT Registered Sales Only" : "Non-VAT Registered Sales Only"
  const generatedTimestamp = format(new Date(), "MMMM dd, yyyy hh:mm a")

  const totalRecords = records.length
  const totalGrossTaxable = records.reduce((sum, s) => sum + (Number(s.gross_taxable) || 0), 0)
  const totalActualAmount = records.reduce((sum, s) => sum + (Number(s.total_actual_amount) || 0), 0)
  const invoiceCount = records.filter((s) => (s.sale_type || "invoice").toLowerCase() === "invoice").length
  const nonInvoiceCount = totalRecords - invoiceCount
  const monthlyBreakdown = buildMonthlyBreakdown(records)

  const wb = XLSX.utils.book_new()

  // =========================================================================
  // SHEET 1: Executive Summary
  // =========================================================================
  const summaryRows: (string | number)[][] = [
    [companyName],
    [`${reportTitle} — EXECUTIVE SUMMARY`],
    [""],
    ["REPORT PARAMETERS", ""],
    ["Tax Classification", taxClassLabel],
    [`Date Filter (${dateFieldLabel})`, periodLabel],
    ["Sale Type Filter", getSaleTypeLabel(saleTypeFilter)],
    ["Area / Scope", areaLabel],
    ["Prepared By", exportedByEmail ? `${exportedBy} (${exportedByEmail})` : exportedBy],
    ["Generated On", generatedTimestamp],
    [""],
    ["FINANCIAL & RECORD SUMMARY", ""],
    ["Total Records", totalRecords],
    ["Invoice Sales Count", invoiceCount],
    ["Non-Invoice Sales Count", nonInvoiceCount],
    ["Total Gross Taxable (PHP)", totalGrossTaxable],
    ["Total Actual Amount (PHP)", totalActualAmount],
    [""],
    ["MONTHLY BREAKDOWN BY TAX MONTH", "", "", ""],
    ["Tax Month", "Record Count", "Gross Taxable (PHP)", "Total Actual Amount (PHP)"],
  ]

  const monthlyStartRow = summaryRows.length + 1 // 1-indexed Excel row of first monthly entry
  monthlyBreakdown.forEach((m) => {
    summaryRows.push([m.label, m.count, m.grossTaxable, m.actualAmount])
  })
  const monthlyEndRow = summaryRows.length // 1-indexed Excel row of last monthly entry

  // Monthly Total row placeholder (formulas injected below)
  summaryRows.push(["TOTAL", totalRecords, totalGrossTaxable, totalActualAmount])
  const monthlyTotalExcelRow = summaryRows.length

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows)

  // Format KPI currency cells on Summary Sheet (rows 16 & 17 -> B16, B17)
  if (summaryWs["B16"]) summaryWs["B16"].z = "#,##0.00"
  if (summaryWs["B17"]) summaryWs["B17"].z = "#,##0.00"

  // Format monthly breakdown numeric cells and add SUM formulas on Total row
  for (let r = monthlyStartRow; r <= monthlyEndRow; r++) {
    const cCell = summaryWs[`C${r}`]
    const dCell = summaryWs[`D${r}`]
    if (cCell) cCell.z = "#,##0.00"
    if (dCell) dCell.z = "#,##0.00"
  }
  if (monthlyBreakdown.length > 0) {
    summaryWs[`B${monthlyTotalExcelRow}`] = {
      t: "n",
      f: `SUM(B${monthlyStartRow}:B${monthlyEndRow})`,
      z: "#,##0",
    }
    summaryWs[`C${monthlyTotalExcelRow}`] = {
      t: "n",
      f: `SUM(C${monthlyStartRow}:C${monthlyEndRow})`,
      z: "#,##0.00",
    }
    summaryWs[`D${monthlyTotalExcelRow}`] = {
      t: "n",
      f: `SUM(D${monthlyStartRow}:D${monthlyEndRow})`,
      z: "#,##0.00",
    }
  }

  summaryWs["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 3 } },
    { s: { r: 11, c: 0 }, e: { r: 11, c: 3 } },
    { s: { r: 18, c: 0 }, e: { r: 18, c: 3 } },
  ]

  summaryWs["!cols"] = [
    { wch: 30 },
    { wch: 36 },
    { wch: 24 },
    { wch: 26 },
  ]

  XLSX.utils.book_append_sheet(wb, summaryWs, "Executive Summary")

  // =========================================================================
  // SHEET 2: Detailed Sales Schedule
  // =========================================================================
  const headers = [
    "#",
    "Tax Month",
    "TIN",
    "Registered Name / Client",
    "Street / Barangay",
    "City / District / ZIP",
    "Tax Type",
    "Sale Type",
    "Invoice Number",
    "Pickup Date",
    "Gross Taxable (PHP)",
    "Total Actual Amount (PHP)",
    "Area",
    "Latest Remark",
  ]

  const detailRows: (string | number)[][] = [
    [`${companyName} — ${reportTitle}`],
    [`Period: ${periodLabel} (${dateFieldLabel})  |  Classification: ${taxClassLabel}  |  Sale Type: ${getSaleTypeLabel(saleTypeFilter)}  |  Area: ${areaLabel}`],
    [`Generated on: ${generatedTimestamp}  |  Prepared by: ${exportedBy}`],
    [""],
    headers,
  ]

  const dataStartExcelRow = detailRows.length + 1 // Row 6 (1-indexed)

  records.forEach((sale, idx) => {
    const street = sale.substreet_street_brgy || sale.taxpayer_listings?.substreet_street_brgy || ""
    const city = sale.district_city_zip || sale.taxpayer_listings?.district_city_zip || ""
    detailRows.push([
      idx + 1,
      safeFormatDate(sale.tax_month, "MMM yyyy"),
      formatTin(sale.tin),
      sale.name || "",
      street,
      city,
      (sale.tax_type || taxType).toUpperCase(),
      (sale.sale_type || "INVOICE").toUpperCase(),
      sale.invoice_number || "",
      sale.pickup_date ? safeFormatDate(sale.pickup_date, "MMM dd, yyyy") : "",
      Number(sale.gross_taxable) || 0,
      Number(sale.total_actual_amount) || 0,
      sale.user_assigned_area || areaLabel || "N/A",
      getLatestRemark(sale.remarks),
    ])
  })

  const dataEndExcelRow = detailRows.length
  detailRows.push([
    "",
    "GRAND TOTAL",
    "",
    `${totalRecords} Record${totalRecords === 1 ? "" : "s"}`,
    "",
    "",
    isVat ? "VAT" : "NON-VAT",
    "",
    "",
    "",
    totalGrossTaxable,
    totalActualAmount,
    "",
    "",
  ])
  const grandTotalExcelRow = detailRows.length

  const detailWs = XLSX.utils.aoa_to_sheet(detailRows)

  // Format numeric currency columns K (Gross Taxable) & L (Total Actual Amount)
  for (let r = dataStartExcelRow; r <= dataEndExcelRow; r++) {
    const kCell = detailWs[`K${r}`]
    const lCell = detailWs[`L${r}`]
    if (kCell) kCell.z = "#,##0.00"
    if (lCell) lCell.z = "#,##0.00"
  }

  // Real SUM formulas for Grand Total row
  if (records.length > 0) {
    detailWs[`K${grandTotalExcelRow}`] = {
      t: "n",
      f: `SUM(K${dataStartExcelRow}:K${dataEndExcelRow})`,
      z: "#,##0.00",
    }
    detailWs[`L${grandTotalExcelRow}`] = {
      t: "n",
      f: `SUM(L${dataStartExcelRow}:L${dataEndExcelRow})`,
      z: "#,##0.00",
    }
  }

  detailWs["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } },
  ]

  detailWs["!autofilter"] = {
    ref: `A5:N${Math.max(5, dataEndExcelRow)}`,
  }

  detailWs["!cols"] = [
    { wch: 6 },  // #
    { wch: 14 }, // Tax Month
    { wch: 18 }, // TIN
    { wch: 34 }, // Name
    { wch: 28 }, // Street
    { wch: 24 }, // City
    { wch: 12 }, // Tax Type
    { wch: 14 }, // Sale Type
    { wch: 18 }, // Invoice #
    { wch: 15 }, // Pickup Date
    { wch: 20 }, // Gross Taxable
    { wch: 22 }, // Total Actual Amount
    { wch: 16 }, // Area
    { wch: 30 }, // Latest Remark
  ]

  const detailSheetName = isVat ? "VAT Sales Schedule" : "Non-VAT Sales Schedule"
  XLSX.utils.book_append_sheet(wb, detailWs, detailSheetName)

  // Browser-safe download
  const filename = buildSafeFilename(taxType, periodLabel, "xlsx")
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

  return filename
}
