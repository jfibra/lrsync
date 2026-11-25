"use client"

import React from "react"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"

export interface CommissionVoucherData {
  id?: string
  voucher_number: string
  slip_type: string
  lrsales_id?: number | null
  member_id?: number | null
  developer_name: string
  developer_rate: number
  agent_name: string
  agent_rate: number
  project_name: string
  unit_number: string
  client_name: string
  reservation_date?: string | null
  amount_released: number
  total_amount: number
  exclusive_of_vat: number
  withholding_tax: number
  vat_amount?: number
  ewt_rate?: number
  commission_status: string
  voucher_attachment_url?: string | null
  header_attachment_url?: string | null
  voucher_attachment_urls?: string[] | null
  header_attachment_urls?: string[] | null
  generated_pdf_url?: string | null
  attachments?: string[]
  source_commission_report_uuid?: string | null
  source_commission_report_number?: number | null
  source_agent_breakdown_uuid?: string | null
  is_converted_from_report?: boolean
  is_unencoded_sale?: boolean
  recipient_role?: "agent" | "team_leader" | "unit_manager" | string
  parent_voucher_id?: string | null
  team_name?: string | null
  team_leader_name?: string | null
  subteam_name?: string | null
  unit_manager_name?: string | null
  created_by_uuid?: string | null
  created_by_name?: string | null
  created_by_email?: string | null
  assigned_area?: string | null
  created_at?: string
}

export function parseVoucherAttachmentUrls(
  singleUrl?: string | null,
  urlsArray?: string[] | null
): string[] {
  if (Array.isArray(urlsArray) && urlsArray.length > 0) {
    return urlsArray.map((u) => String(u || "").trim()).filter(Boolean)
  }
  const raw = (singleUrl || "").trim()
  if (!raw) return []
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.map((u) => String(u || "").trim()).filter(Boolean)
      }
    } catch {
      // Fall through to treat as single URL
    }
  }
  return [raw]
}

export function serializeVoucherAttachmentUrls(urls: string[]): string | null {
  const cleaned = urls.map((u) => String(u || "").trim()).filter(Boolean)
  if (cleaned.length === 0) return null
  if (cleaned.length === 1) return cleaned[0]
  return JSON.stringify(cleaned)
}

export async function generateVoucherBondpaperPdf(element: HTMLElement): Promise<{
  pdf: jsPDF
  blob: Blob
  dataUri: string
}> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
  })

  const imgData = canvas.toDataURL("image/png")
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = pdf.internal.pageSize.getHeight()

  // Fit the entire bondpaper element onto 1 single A4 page
  pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight)

  const blob = pdf.output("blob")
  const dataUri = pdf.output("datauristring")

  return { pdf, blob, dataUri }
}

export async function downloadVoucherBondpaperPdf(
  element: HTMLElement,
  voucherNumber: string
): Promise<void> {
  const { pdf } = await generateVoucherBondpaperPdf(element)
  pdf.save(`Commission-Voucher-${voucherNumber || "Slip"}.pdf`)
}

export async function openVoucherBondpaperPdfPreview(element: HTMLElement): Promise<void> {
  const { pdf } = await generateVoucherBondpaperPdf(element)
  window.open(pdf.output("bloburl"), "_blank")
}

interface VoucherBondpaperDocumentProps {
  voucher: CommissionVoucherData
  containerId?: string
}

export function VoucherBondpaperDocument({
  voucher,
  containerId = "voucher-bondpaper-printable",
}: VoucherBondpaperDocumentProps) {
  const fmt = (val: number | string | undefined) => {
    const n = Number(val) || 0
    return new Intl.NumberFormat("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)
  }

  const formatReadableDate = (raw?: string | null): string => {
    const trimmed = (raw || "").trim()
    if (!trimmed) return ""
    const MONTHS = [
      "Jan.",
      "Feb.",
      "Mar.",
      "Apr.",
      "May",
      "Jun.",
      "Jul.",
      "Aug.",
      "Sep.",
      "Oct.",
      "Nov.",
      "Dec.",
    ]
    // Parse YYYY-MM-DD without UTC timezone day-shift
    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (isoMatch) {
      const y = Number(isoMatch[1])
      const m = Number(isoMatch[2]) - 1
      const d = Number(isoMatch[3])
      if (m >= 0 && m < 12 && d >= 1 && d <= 31) {
        return `${MONTHS[m]} ${d}, ${y}`
      }
    }
    const parsed = new Date(trimmed)
    if (Number.isNaN(parsed.getTime())) return trimmed
    return `${MONTHS[parsed.getMonth()]} ${parsed.getDate()}, ${parsed.getFullYear()}`
  }

  const headerUrls = parseVoucherAttachmentUrls(
    voucher.header_attachment_url,
    voucher.header_attachment_urls
  ).slice(0, 5)
  const voucherUrls = parseVoucherAttachmentUrls(
    voucher.voucher_attachment_url,
    voucher.voucher_attachment_urls
  ).slice(0, 5)
  const hasHeader = headerUrls.length > 0
  const hasVoucher = voucherUrls.length > 0
  const hasAttachments = hasHeader || hasVoucher
  const totalAttachments = headerUrls.length + voucherUrls.length

  // Auto-adjust vertical space budget so 1..10 attachments + Commission Slip fit cleanly on 1 A4 page
  // while keeping every attachment as large and readable as possible.
  const isDenseLayout = totalAttachments >= 4
  const attachmentsMaxTotalHeight = isDenseLayout ? 575 : 515
  const sectionGap = isDenseLayout ? 6 : 10
  const sectionHeaderAndPad = isDenseLayout ? 22 : 28

  const { headerSectionMaxH, voucherSectionMaxH } = (() => {
    if (hasHeader && hasVoucher) {
      const usable = attachmentsMaxTotalHeight - sectionGap
      // For the classic 1 header + 1 voucher pair, keep voucher prominent (62%);
      // for multi-attachment combinations, allocate proportionally with a safe 26%-74% floor/ceiling.
      const headerRatio =
        headerUrls.length === 1 && voucherUrls.length === 1
          ? 0.38
          : Math.max(0.26, Math.min(0.74, headerUrls.length / totalAttachments))
      const hMax = Math.floor(usable * headerRatio)
      return { headerSectionMaxH: hMax, voucherSectionMaxH: usable - hMax }
    }
    if (hasHeader) {
      return { headerSectionMaxH: attachmentsMaxTotalHeight, voucherSectionMaxH: 0 }
    }
    return { headerSectionMaxH: 0, voucherSectionMaxH: attachmentsMaxTotalHeight }
  })()

  const computePerItemMaxH = (sectionMaxH: number, count: number) => {
    if (count <= 0) return 0
    const itemGap = count <= 2 ? 6 : 4
    const innerH = Math.max(44, sectionMaxH - sectionHeaderAndPad)
    return Math.max(42, Math.floor((innerH - itemGap * (count - 1)) / count))
  }

  const headerPerItemMaxH = computePerItemMaxH(headerSectionMaxH, headerUrls.length)
  const voucherPerItemMaxH = computePerItemMaxH(voucherSectionMaxH, voucherUrls.length)

  const projectWithUnit = [
    voucher.project_name || "",
    voucher.unit_number ? `(Unit: ${voucher.unit_number})` : "",
  ]
    .filter(Boolean)
    .join(" ")

  const formattedReservationDate = formatReadableDate(voucher.reservation_date)

  const docDate = (() => {
    const d = voucher.created_at ? new Date(voucher.created_at) : new Date()
    if (Number.isNaN(d.getTime())) return formatReadableDate(new Date().toISOString())
    return formatReadableDate(d.toISOString())
  })()

  // Reusable official red-bordered Commission Slip form (compact when paired with attachments; enlarged & top-aligned when standalone)
  const renderCommissionSlipCard = (enlarged: boolean) => {
    const dense = !enlarged && isDenseLayout
    const labelFontSize = enlarged ? 13 : dense ? 9.8 : 10.5
    const valueFontSize = enlarged ? 13.5 : dense ? 10 : 10.5
    const rowGap = enlarged ? 12 : dense ? 4.5 : 7
    const finLabelWidth = enlarged ? 200 : dense ? 142 : 148
    const valuePaddingBottom = enlarged ? 6 : dense ? 3.5 : 5

    const InfoRow = ({ label, value }: { label: string; value: string }) => (
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          fontSize: labelFontSize,
          lineHeight: 1.3,
        }}
      >
        <span
          style={{
            fontStyle: "italic",
            fontWeight: 700,
            color: "#111827",
            whiteSpace: "nowrap",
            marginRight: enlarged ? 10 : 7,
            paddingBottom: valuePaddingBottom,
          }}
        >
          {label}
        </span>
        <div
          style={{
            flex: 1,
            borderBottom: "1px solid #6b7280",
            fontSize: valueFontSize,
            fontWeight: 800,
            color: "#000000",
            paddingBottom: valuePaddingBottom,
            paddingLeft: 4,
            minHeight: enlarged ? 24 : 19,
            boxSizing: "border-box",
            lineHeight: 1.3,
          }}
        >
          <span style={{ display: "block" }}>{value || "\u00A0"}</span>
        </div>
      </div>
    )

    const FinRow = ({
      label,
      value,
      highlight = false,
    }: {
      label: string
      value: string
      highlight?: boolean
    }) => (
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          fontSize: labelFontSize,
          lineHeight: 1.3,
        }}
      >
        <span
          style={{
            width: finLabelWidth,
            textAlign: "right",
            fontStyle: "italic",
            fontWeight: highlight ? 700 : 600,
            color: "#111827",
            paddingRight: enlarged ? 14 : 10,
            paddingBottom: valuePaddingBottom,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
        <div
          style={{
            flex: 1,
            borderBottom: highlight ? "1.5px solid #001f3f" : "1px solid #6b7280",
            fontSize: highlight ? (enlarged ? 15 : 11.5) : valueFontSize,
            fontWeight: 800,
            color: highlight ? "#001f3f" : "#000000",
            paddingBottom: valuePaddingBottom,
            paddingLeft: 6,
            minHeight: enlarged ? 24 : 19,
            boxSizing: "border-box",
            lineHeight: 1.3,
          }}
        >
          <span style={{ display: "block" }}>{value || "\u00A0"}</span>
        </div>
      </div>
    )

    return (
      <div
        style={{
          width: enlarged ? 640 : 410,
          backgroundColor: "#ffffff",
          border: "1px solid #cbd5e1",
          borderTop: enlarged ? "6px solid #c62828" : "5px solid #c62828",
          borderBottom: enlarged ? "6px solid #c62828" : "5px solid #c62828",
          padding: enlarged ? "26px 32px 24px 32px" : "16px 20px 14px 20px",
          position: "relative",
          boxSizing: "border-box",
          overflow: "hidden",
          boxShadow: enlarged ? "0 4px 18px rgba(15, 23, 42, 0.08)" : "none",
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(226,232,240,0.18) 0px, rgba(226,232,240,0.18) 10px, transparent 10px, transparent 20px)",
        }}
      >
        {/* Company Logo Watermark centered behind slip content */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 0,
          }}
        >
          <img
            src="/leuteriorealty.svg"
            alt=""
            aria-hidden="true"
            style={{
              width: enlarged ? 380 : 240,
              height: "auto",
              opacity: 0.08,
              objectFit: "contain",
              transform: "rotate(-12deg)",
            }}
          />
        </div>

        {/* Slip Foreground Content */}
        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Slip Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: enlarged ? 22 : 14,
            }}
          >
            <div
              style={{
                fontSize: enlarged ? 24 : 16,
                fontWeight: 900,
                color: "#001f3f",
                lineHeight: 1.08,
                letterSpacing: "0.4px",
              }}
            >
              <div>COMMISSION</div>
              <div>SLIP</div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
              <span
                style={{
                  fontSize: enlarged ? 13 : 11,
                  color: "#1e293b",
                  fontWeight: 700,
                }}
              >
                Voucher No :
              </span>
              <div
                style={{
                  backgroundColor: "#e2e8f0",
                  padding: enlarged ? "5px 14px" : "3px 10px",
                  minWidth: enlarged ? 96 : 64,
                  fontSize: enlarged ? 14 : 11.5,
                  fontWeight: 800,
                  color: "#000000",
                  borderRadius: 3,
                  textAlign: "center",
                }}
              >
                {voucher.voucher_number || "N/A"}
              </div>
            </div>
          </div>

          {/* Info Rows */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: rowGap,
              marginBottom: enlarged ? 22 : 14,
            }}
          >
            <InfoRow label="Name of Developer:" value={voucher.developer_name || ""} />
            <InfoRow label="Agent:" value={voucher.agent_name || ""} />
            <InfoRow label="Project:" value={projectWithUnit} />
            <InfoRow label="Client Name:" value={voucher.client_name || ""} />
            <InfoRow label="Reservation Date:" value={formattedReservationDate || "N/A"} />
            {voucher.commission_status ? (
              <InfoRow label="Commission Status:" value={voucher.commission_status} />
            ) : null}
          </div>

          {/* Financial Calculation Rows — Per Slip Type Official Structure */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: rowGap,
              marginBottom: enlarged ? 24 : 14,
              paddingLeft: enlarged ? 24 : 8,
            }}
          >
            {(() => {
              const slip = (voucher.slip_type || "").trim()
              const released = Number(voucher.amount_released) || 0
              const agRate = Number(voucher.agent_rate) || 0
              const devRate = Number(voucher.developer_rate) || 5
              const netTotal = Number(voucher.total_amount) || 0
              const exclVat = Number(voucher.exclusive_of_vat) || 0
              const wtax = Number(voucher.withholding_tax) || 0
              const vatVal =
                Number(voucher.vat_amount) || (slip === "VAT w/o Invoice" ? netTotal * 0.12 : 0)

              if (slip === "VAT without Rate" || slip === "VAT w/o Rate") {
                const lessVat =
                  Number(voucher.vat_amount) > 0
                    ? Number(voucher.vat_amount)
                    : Math.max(0, released - netTotal)
                return (
                  <>
                    <FinRow label="Released from Developer:" value={fmt(released)} />
                    <FinRow label="Less VAT (12%):" value={fmt(lessVat)} />
                    <FinRow label="Net Comm.:" value={fmt(netTotal)} highlight />
                  </>
                )
              }

              if (slip === "VAT w/o Invoice") {
                const grossTotal =
                  netTotal + vatVal > 0
                    ? netTotal + vatVal
                    : devRate > 0
                      ? (released * agRate) / devRate
                      : 0
                return (
                  <>
                    <FinRow label="Released from Developer:" value={fmt(released)} />
                    <FinRow label="Rate (%):" value={fmt(agRate)} />
                    <FinRow label="Total:" value={fmt(grossTotal)} />
                    <FinRow label="VAT:" value={fmt(vatVal)} />
                    <FinRow label="Net Comm.:" value={fmt(netTotal)} highlight />
                  </>
                )
              }

              if (slip === "W/o Invoice" || slip === "Rate w/o Invoice") {
                return (
                  <>
                    <FinRow label="Released from Developer:" value={fmt(released)} />
                    <FinRow label="Rate (%):" value={fmt(agRate)} />
                    <FinRow label="Total:" value={fmt(netTotal)} highlight />
                  </>
                )
              }

              if (slip === "Non-VAT") {
                const grossBeforeTax =
                  netTotal + wtax > 0
                    ? netTotal + wtax
                    : devRate > 0
                      ? (exclVat * agRate) / devRate
                      : 0
                const ewtPct = voucher.ewt_rate ? Number(voucher.ewt_rate) : 5
                return (
                  <>
                    <FinRow label="Released from Developer:" value={fmt(released)} />
                    <FinRow label="Exclusive of VAT:" value={fmt(exclVat)} />
                    <FinRow label="Rate (%):" value={fmt(agRate)} />
                    <FinRow label="Total:" value={fmt(grossBeforeTax)} />
                    <FinRow label={`Withholding Tax (${ewtPct}%):`} value={fmt(wtax)} />
                    <FinRow label="Net Comm.:" value={fmt(netTotal)} highlight />
                  </>
                )
              }

              // Default: "VAT w/ Invoice"
              return (
                <>
                  <FinRow label="Released from Developer:" value={fmt(released)} />
                  <FinRow label="Rate (%):" value={fmt(agRate)} />
                  <FinRow label="Total for Release:" value={fmt(netTotal)} highlight />
                  <FinRow label="Exclusive of Vat:" value={fmt(exclVat)} />
                  <FinRow label="For BIR 2307:" value={fmt(wtax)} />
                </>
              )
            })()}
          </div>

          {/* Signature & Date Row */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 12,
              fontSize: enlarged ? 12.5 : 10,
              paddingLeft: enlarged ? 8 : 4,
              paddingTop: enlarged ? 10 : 4,
              marginBottom: enlarged ? 20 : 12,
            }}
          >
            <span style={{ fontStyle: "italic", fontWeight: 600, color: "#111827", paddingBottom: 3 }}>
              Signature:
            </span>
            <div style={{ flex: 1.5, borderBottom: "1px solid #6b7280", height: enlarged ? 22 : 14 }} />
            <span style={{ fontStyle: "italic", fontWeight: 600, color: "#111827", paddingBottom: 3 }}>
              Date:
            </span>
            <div style={{ flex: 1, borderBottom: "1px solid #6b7280", height: enlarged ? 22 : 14 }} />
          </div>

          {/* Slip Bottom Branding Footer (Matches Official Slip Template) */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: enlarged ? 10 : 6,
              borderTop: "1px solid #e2e8f0",
            }}
          >
            <img
              src="/leuteriorealty.svg"
              alt="Leuterio Realty & Brokerage"
              style={{
                height: enlarged ? 44 : 30,
                width: "auto",
                objectFit: "contain",
              }}
            />
            <div style={{ textAlign: "right", lineHeight: 1.35 }}>
              <div
                style={{
                  fontSize: enlarged ? 12 : 9.5,
                  fontWeight: 800,
                  color: "#0f172a",
                }}
              >
                Leuterio Realty &amp; Brokerage
              </div>
              <div style={{ fontSize: enlarged ? 10 : 8, color: "#475569" }}>
                133 F Aznar Road, Urgello St., Cebu City
              </div>
              <div style={{ fontSize: enlarged ? 10 : 8, color: "#475569" }}>
                (032) 254 8900 &bull; 0945 485 8330
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      id={containerId}
      style={{
        width: 794,
        height: 1123,
        margin: "0 auto",
        backgroundColor: "#ffffff",
        color: "#0f172a",
        fontFamily: "Arial, Helvetica, sans-serif",
        position: "relative",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        overflow: "hidden",
      }}
    >
      {/* TOP ACCENT BAR */}
      <div>
        <div style={{ display: "flex", height: 7, width: "100%" }}>
          <div style={{ flex: 3, backgroundColor: "#001f3f" }} />
          <div style={{ flex: 1, backgroundColor: "#c62828" }} />
        </div>

        {/* PROFESSIONAL DOCUMENT HEADER */}
        <div
          style={{
            padding: "16px 36px 12px 36px",
            borderBottom: "1.5px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#f8fafc",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img
              src="/leuteriorealty.svg"
              alt="Leuterio Realty & Brokerage"
              width={118}
              height={46}
              style={{ height: 46, width: "auto", objectFit: "contain" }}
            />
            <div style={{ borderLeft: "2px solid #cbd5e1", paddingLeft: 12 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  color: "#001f3f",
                  letterSpacing: "0.4px",
                }}
              >
                LEUTERIO REALTY &amp; BROKERAGE
              </div>
              <div style={{ fontSize: 9.5, color: "#475569", marginTop: 2 }}>
                133 F Aznar Road, Urgello St., Cebu City
              </div>
              <div style={{ fontSize: 9.5, color: "#475569" }}>
                Tel: (032) 254 8900 &bull; Mobile: 0945 485 8330
              </div>
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div
              style={{
                display: "inline-block",
                backgroundColor: "#001f3f",
                color: "#ffffff",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "1px",
                padding: "4px 10px",
                borderRadius: 4,
                marginBottom: 5,
              }}
            >
              COMMISSION VOUCHER
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#c62828" }}>
              Voucher No: #{voucher.voucher_number || "N/A"}
            </div>
            <div style={{ fontSize: 9.5, color: "#475569", marginTop: 1 }}>
              Type: <strong>{voucher.slip_type}</strong> &bull; Date: <strong>{docDate}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ADAPTIVE MIDDLE BODY */}
      {hasAttachments ? (
        <div
          style={{
            flex: 1,
            padding: "14px 36px 10px 36px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            overflow: "hidden",
          }}
        >
          {/* TOP ATTACHMENTS AREA (Auto-adjusted for up to 5 Header + 5 Voucher attachments) */}
          <div
            style={{
              width: "100%",
              maxHeight: attachmentsMaxTotalHeight,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: sectionGap,
              overflow: "hidden",
            }}
          >
            {hasHeader && (
              <div
                style={{
                  width: "100%",
                  maxHeight: headerSectionMaxH,
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  backgroundColor: "#f8fafc",
                  padding: isDenseLayout ? "4px 8px" : "6px 10px",
                  boxSizing: "border-box",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    fontSize: isDenseLayout ? 7.5 : 8.5,
                    fontWeight: 700,
                    color: "#64748b",
                    letterSpacing: "0.6px",
                    marginBottom: isDenseLayout ? 3 : 4,
                    textTransform: "uppercase",
                  }}
                >
                  Supporting Header Document{headerUrls.length > 1 ? `s (${headerUrls.length})` : ""}
                </div>
                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: headerUrls.length <= 2 ? 6 : 4,
                    overflow: "hidden",
                  }}
                >
                  {headerUrls.map((url, idx) => (
                    <div
                      key={`header-att-${idx}`}
                      style={{
                        width: "100%",
                        maxHeight: headerPerItemMaxH,
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        overflow: "hidden",
                      }}
                    >
                      <img
                        src={url}
                        alt={`Attached Header ${idx + 1}`}
                        crossOrigin="anonymous"
                        style={{
                          maxWidth: "98%",
                          maxHeight: headerPerItemMaxH,
                          width: "auto",
                          height: "auto",
                          objectFit: "contain",
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasVoucher && (
              <div
                style={{
                  width: "100%",
                  maxHeight: voucherSectionMaxH,
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  backgroundColor: "#f8fafc",
                  padding: isDenseLayout ? "4px 8px" : "6px 10px",
                  boxSizing: "border-box",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    fontSize: isDenseLayout ? 7.5 : 8.5,
                    fontWeight: 700,
                    color: "#64748b",
                    letterSpacing: "0.6px",
                    marginBottom: isDenseLayout ? 3 : 4,
                    textTransform: "uppercase",
                  }}
                >
                  Official Voucher Attachment{voucherUrls.length > 1 ? `s (${voucherUrls.length})` : ""}
                </div>
                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: voucherUrls.length <= 2 ? 6 : 4,
                    overflow: "hidden",
                  }}
                >
                  {voucherUrls.map((url, idx) => (
                    <div
                      key={`voucher-att-${idx}`}
                      style={{
                        width: "100%",
                        maxHeight: voucherPerItemMaxH,
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        overflow: "hidden",
                      }}
                    >
                      <img
                        src={url}
                        alt={`Attached Voucher ${idx + 1}`}
                        crossOrigin="anonymous"
                        style={{
                          maxWidth: "98%",
                          maxHeight: voucherPerItemMaxH,
                          width: "auto",
                          height: "auto",
                          objectFit: "contain",
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* BOTTOM-RIGHT COMMISSION SLIP CARD */}
          <div
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "flex-end",
              paddingTop: 8,
            }}
          >
            {renderCommissionSlipCard(false)}
          </div>
        </div>
      ) : (
        /* NO ATTACHMENTS: ENLARGED FORMAL COMMISSION SLIP PLACED AT THE TOP */
        <div
          style={{
            flex: 1,
            padding: "32px 36px 24px 36px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            overflow: "hidden",
          }}
        >
          {renderCommissionSlipCard(true)}
        </div>
      )}

      {/* PROFESSIONAL DOCUMENT FOOTER */}
      <div>
        <div
          style={{
            padding: "8px 36px",
            borderTop: "1px solid #cbd5e1",
            backgroundColor: "#f8fafc",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 9,
            color: "#64748b",
          }}
        >
          <div>
            <strong>LR Accounting &amp; BIR Compliance System</strong> &bull; Official Commission Release Document
          </div>
          <div>
            Voucher #{voucher.voucher_number || "N/A"} &bull; Page 1 of 1
          </div>
        </div>
        <div style={{ display: "flex", height: 5, width: "100%" }}>
          <div style={{ flex: 3, backgroundColor: "#001f3f" }} />
          <div style={{ flex: 1, backgroundColor: "#c62828" }} />
        </div>
      </div>
    </div>
  )
}
