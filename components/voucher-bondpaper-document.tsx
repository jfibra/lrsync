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

  const hasHeader = Boolean(voucher.header_attachment_url)
  const hasVoucher = Boolean(voucher.voucher_attachment_url)
  const hasAttachments = hasHeader || hasVoucher

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
    const labelFontSize = enlarged ? 13 : 10.5
    const valueFontSize = enlarged ? 13.5 : 10.5
    const rowGap = enlarged ? 12 : 7
    const finLabelWidth = enlarged ? 200 : 148
    const valuePaddingBottom = enlarged ? 6 : 5

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
            {formattedReservationDate ? (
              <InfoRow label="Reservation Date:" value={formattedReservationDate} />
            ) : null}
            {voucher.commission_status ? (
              <InfoRow label="Commission Status:" value={voucher.commission_status} />
            ) : null}
          </div>

          {/* Financial Calculation Rows */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: rowGap,
              marginBottom: enlarged ? 28 : 16,
              paddingLeft: enlarged ? 24 : 8,
            }}
          >
            <FinRow label="Released from Developer:" value={fmt(voucher.amount_released)} />
            <FinRow label="Rate (%):" value={fmt(voucher.agent_rate)} />
            <FinRow label="Total for Release:" value={fmt(voucher.total_amount)} highlight />
            <FinRow label="Exclusive of Vat:" value={fmt(voucher.exclusive_of_vat)} />
            <FinRow label="For BIR 2307:" value={fmt(voucher.withholding_tax)} />
          </div>

          {/* Signature & Date Row */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 12,
              fontSize: enlarged ? 12.5 : 10,
              paddingLeft: enlarged ? 8 : 4,
              paddingTop: enlarged ? 12 : 4,
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
          {/* TOP ATTACHMENTS AREA */}
          <div
            style={{
              width: "100%",
              maxHeight: 430,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: 10,
              overflow: "hidden",
            }}
          >
            {hasHeader && (
              <div
                style={{
                  width: "100%",
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  backgroundColor: "#f8fafc",
                  padding: "6px 10px",
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    fontSize: 8.5,
                    fontWeight: 700,
                    color: "#64748b",
                    letterSpacing: "0.6px",
                    marginBottom: 4,
                    textTransform: "uppercase",
                  }}
                >
                  Supporting Header Document
                </div>
                <div
                  style={{
                    width: "100%",
                    maxHeight: hasVoucher ? 140 : 385,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={voucher.header_attachment_url!}
                    alt="Attached Header"
                    crossOrigin="anonymous"
                    style={{
                      maxWidth: "96%",
                      maxHeight: hasVoucher ? 136 : 380,
                      objectFit: "contain",
                    }}
                  />
                </div>
              </div>
            )}

            {hasVoucher && (
              <div
                style={{
                  width: "100%",
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  backgroundColor: "#f8fafc",
                  padding: "6px 10px",
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    fontSize: 8.5,
                    fontWeight: 700,
                    color: "#64748b",
                    letterSpacing: "0.6px",
                    marginBottom: 4,
                    textTransform: "uppercase",
                  }}
                >
                  Official Voucher Attachment
                </div>
                <div
                  style={{
                    width: "100%",
                    maxHeight: hasHeader ? 235 : 395,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={voucher.voucher_attachment_url!}
                    alt="Attached Voucher"
                    crossOrigin="anonymous"
                    style={{
                      maxWidth: "96%",
                      maxHeight: hasHeader ? 230 : 390,
                      objectFit: "contain",
                    }}
                  />
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
