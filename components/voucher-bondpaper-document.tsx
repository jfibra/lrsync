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

  const hasHeader = Boolean(voucher.header_attachment_url)
  const hasVoucher = Boolean(voucher.voucher_attachment_url)

  const projectWithUnit = [
    voucher.project_name || "",
    voucher.unit_number ? `(Unit: ${voucher.unit_number})` : "",
  ]
    .filter(Boolean)
    .join(" ")

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
        padding: "32px 40px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        overflow: "hidden",
      }}
    >
      {/* TOP HALF: Cropped Header & Cropped Voucher Attachments */}
      <div
        style={{
          width: "100%",
          height: 510,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 12,
          overflow: "hidden",
        }}
      >
        {hasHeader && (
          <div
            style={{
              width: "100%",
              maxHeight: hasVoucher ? 180 : 490,
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
                maxWidth: "92%",
                maxHeight: hasVoucher ? 175 : 480,
                objectFit: "contain",
              }}
            />
          </div>
        )}

        {hasVoucher && (
          <div
            style={{
              width: "100%",
              maxHeight: hasHeader ? 310 : 495,
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
                maxWidth: "92%",
                maxHeight: hasHeader ? 305 : 490,
                objectFit: "contain",
              }}
            />
          </div>
        )}
      </div>

      {/* BOTTOM HALF: Commission Slip in Bottom-Right (matching sample PDF layout) */}
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "flex-end",
          paddingTop: 10,
        }}
      >
        {/* COMMISSION SLIP CARD */}
        <div
          style={{
            width: 365,
            backgroundColor: "#ffffff",
            borderTop: "6px solid #c62828",
            borderBottom: "6px solid #c62828",
            padding: "16px 18px 14px 18px",
            position: "relative",
            boxSizing: "border-box",
            backgroundImage:
              "repeating-linear-gradient(135deg, rgba(226,232,240,0.22) 0px, rgba(226,232,240,0.22) 10px, transparent 10px, transparent 20px)",
          }}
        >
          {/* Slip Header: COMMISSION SLIP & Voucher No */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: "#000000",
                lineHeight: 1.05,
                letterSpacing: "0.3px",
              }}
            >
              <div>COMMISSION</div>
              <div>SLIP</div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 12, color: "#1e293b", fontWeight: 500 }}>
                Voucher No :
              </span>
              <div
                style={{
                  backgroundColor: "#e5e7eb",
                  padding: "3px 10px",
                  minWidth: 68,
                  fontSize: 12.5,
                  fontWeight: 800,
                  color: "#000000",
                }}
              >
                {voucher.voucher_number || "N/A"}
              </div>
            </div>
          </div>

          {/* Info Rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
            {/* Name of Developer */}
            <div style={{ display: "flex", alignItems: "baseline", fontSize: 10.5 }}>
              <span
                style={{
                  fontStyle: "italic",
                  fontWeight: 700,
                  color: "#111827",
                  whiteSpace: "nowrap",
                  marginRight: 6,
                }}
              >
                Name of Developer:
              </span>
              <div
                style={{
                  flex: 1,
                  borderBottom: "1px solid #6b7280",
                  fontWeight: 800,
                  color: "#000000",
                  paddingBottom: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {voucher.developer_name || ""}
              </div>
            </div>

            {/* Agent */}
            <div style={{ display: "flex", alignItems: "baseline", fontSize: 10.5 }}>
              <span
                style={{
                  fontStyle: "italic",
                  fontWeight: 700,
                  color: "#111827",
                  whiteSpace: "nowrap",
                  marginRight: 6,
                }}
              >
                Agent:
              </span>
              <div
                style={{
                  flex: 1,
                  borderBottom: "1px solid #6b7280",
                  fontWeight: 800,
                  color: "#000000",
                  paddingBottom: 1,
                }}
              >
                {voucher.agent_name || ""}
              </div>
            </div>

            {/* Project */}
            <div style={{ display: "flex", alignItems: "baseline", fontSize: 10.5 }}>
              <span
                style={{
                  fontStyle: "italic",
                  fontWeight: 700,
                  color: "#111827",
                  whiteSpace: "nowrap",
                  marginRight: 6,
                }}
              >
                Project:
              </span>
              <div
                style={{
                  flex: 1,
                  borderBottom: "1px solid #6b7280",
                  fontWeight: 800,
                  color: "#000000",
                  paddingBottom: 1,
                }}
              >
                {projectWithUnit}
              </div>
            </div>

            {/* Client Name */}
            <div style={{ display: "flex", alignItems: "baseline", fontSize: 10.5 }}>
              <span
                style={{
                  fontStyle: "italic",
                  fontWeight: 700,
                  color: "#111827",
                  whiteSpace: "nowrap",
                  marginRight: 6,
                }}
              >
                Client Name:
              </span>
              <div
                style={{
                  flex: 1,
                  borderBottom: "1px solid #6b7280",
                  fontWeight: 800,
                  color: "#000000",
                  paddingBottom: 1,
                }}
              >
                {voucher.client_name || ""}
              </div>
            </div>

            {voucher.reservation_date ? (
              <div style={{ display: "flex", alignItems: "baseline", marginBottom: 4 }}>
                <span
                  style={{
                    fontStyle: "italic",
                    fontWeight: 700,
                    color: "#111827",
                    whiteSpace: "nowrap",
                    marginRight: 6,
                  }}
                >
                  Reservation Date:
                </span>
                <div
                  style={{
                    flex: 1,
                    borderBottom: "1px solid #6b7280",
                    fontWeight: 800,
                    color: "#000000",
                    paddingBottom: 1,
                  }}
                >
                  {voucher.reservation_date}
                </div>
              </div>
            ) : null}

            {/* Optional Commission Status row */}
            {voucher.commission_status && (
              <div style={{ display: "flex", alignItems: "baseline", fontSize: 10.5 }}>
                <span
                  style={{
                    fontStyle: "italic",
                    fontWeight: 700,
                    color: "#111827",
                    whiteSpace: "nowrap",
                    marginRight: 6,
                  }}
                >
                  Commission Status:
                </span>
                <div
                  style={{
                    flex: 1,
                    borderBottom: "1px solid #6b7280",
                    fontWeight: 700,
                    color: "#000000",
                    paddingBottom: 1,
                  }}
                >
                  {voucher.commission_status}
                </div>
              </div>
            )}
          </div>

          {/* Financial Calculation Rows */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              marginBottom: 22,
              paddingLeft: 16,
            }}
          >
            {/* Released from Developer */}
            <div style={{ display: "flex", alignItems: "baseline", fontSize: 10.5 }}>
              <span
                style={{
                  width: 145,
                  textAlign: "right",
                  fontStyle: "italic",
                  color: "#111827",
                  paddingRight: 10,
                }}
              >
                Released from Developer:
              </span>
              <div
                style={{
                  flex: 1,
                  borderBottom: "1px solid #6b7280",
                  fontWeight: 800,
                  color: "#000000",
                  paddingBottom: 1,
                }}
              >
                {fmt(voucher.amount_released)}
              </div>
            </div>

            {/* Rate (%) */}
            <div style={{ display: "flex", alignItems: "baseline", fontSize: 10.5 }}>
              <span
                style={{
                  width: 145,
                  textAlign: "right",
                  fontStyle: "italic",
                  color: "#111827",
                  paddingRight: 10,
                }}
              >
                Rate (%):
              </span>
              <div
                style={{
                  flex: 1,
                  borderBottom: "1px solid #6b7280",
                  fontWeight: 800,
                  color: "#000000",
                  paddingBottom: 1,
                }}
              >
                {fmt(voucher.agent_rate)}
              </div>
            </div>

            {/* Total for Release */}
            <div style={{ display: "flex", alignItems: "baseline", fontSize: 10.5 }}>
              <span
                style={{
                  width: 145,
                  textAlign: "right",
                  fontStyle: "italic",
                  color: "#111827",
                  paddingRight: 10,
                }}
              >
                Total for Release:
              </span>
              <div
                style={{
                  flex: 1,
                  borderBottom: "1px solid #6b7280",
                  fontWeight: 800,
                  color: "#000000",
                  paddingBottom: 1,
                }}
              >
                {fmt(voucher.total_amount)}
              </div>
            </div>

            {/* Exclusive of Vat */}
            <div style={{ display: "flex", alignItems: "baseline", fontSize: 10.5 }}>
              <span
                style={{
                  width: 145,
                  textAlign: "right",
                  fontStyle: "italic",
                  color: "#111827",
                  paddingRight: 10,
                }}
              >
                Exclusive of Vat:
              </span>
              <div
                style={{
                  flex: 1,
                  borderBottom: "1px solid #6b7280",
                  fontWeight: 800,
                  color: "#000000",
                  paddingBottom: 1,
                }}
              >
                {fmt(voucher.exclusive_of_vat)}
              </div>
            </div>

            {/* For BIR 2307 */}
            <div style={{ display: "flex", alignItems: "baseline", fontSize: 10.5 }}>
              <span
                style={{
                  width: 145,
                  textAlign: "right",
                  fontStyle: "italic",
                  color: "#111827",
                  paddingRight: 10,
                }}
              >
                For BIR 2307:
              </span>
              <div
                style={{
                  flex: 1,
                  borderBottom: "1px solid #6b7280",
                  fontWeight: 800,
                  color: "#000000",
                  paddingBottom: 1,
                }}
              >
                {fmt(voucher.withholding_tax)}
              </div>
            </div>
          </div>

          {/* Signature & Date Row */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              fontSize: 10,
              marginBottom: 16,
              paddingLeft: 8,
            }}
          >
            <span style={{ fontStyle: "italic", color: "#111827" }}>Signature:</span>
            <div style={{ flex: 1.4, borderBottom: "1px solid #6b7280", height: 12 }} />
            <span style={{ fontStyle: "italic", color: "#111827" }}>Date:</span>
            <div style={{ flex: 1, borderBottom: "1px solid #6b7280", height: 12 }} />
          </div>

          {/* Footer Branding Row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              paddingTop: 4,
            }}
          >
            <img
              src="/leuteriorealty.svg"
              alt="Leuterio Realty & Brokerage"
              width={105}
              height={42}
              style={{
                height: 42,
                width: "auto",
                objectFit: "contain",
              }}
            />

            <div style={{ textAlign: "right", fontSize: 8.5, color: "#111827", lineHeight: 1.35 }}>
              <div style={{ fontWeight: 800, fontSize: 9.5 }}>Leuterio Realty &amp; Brokerage</div>
              <div>133 F Aznar Road, Urgello St., Cebu City</div>
              <div>Tel: (032) 254 8900 &bull; Mobile: 0945 485 8330</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
