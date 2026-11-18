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
  const hasAttachments = hasHeader || hasVoucher

  const projectWithUnit = [
    voucher.project_name || "",
    voucher.unit_number ? `(Unit: ${voucher.unit_number})` : "",
  ]
    .filter(Boolean)
    .join(" ")

  const docDate = (() => {
    const d = voucher.created_at ? new Date(voucher.created_at) : new Date()
    if (Number.isNaN(d.getTime())) return new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
  })()

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
            <div
              style={{
                width: 390,
                backgroundColor: "#ffffff",
                border: "1px solid #cbd5e1",
                borderTop: "5px solid #c62828",
                borderBottom: "5px solid #c62828",
                padding: "14px 18px 12px 18px",
                position: "relative",
                boxSizing: "border-box",
                backgroundImage:
                  "repeating-linear-gradient(135deg, rgba(226,232,240,0.22) 0px, rgba(226,232,240,0.22) 10px, transparent 10px, transparent 20px)",
              }}
            >
              {/* Slip Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 900,
                    color: "#001f3f",
                    lineHeight: 1.05,
                    letterSpacing: "0.3px",
                  }}
                >
                  <div>COMMISSION</div>
                  <div>SLIP</div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 11, color: "#1e293b", fontWeight: 600 }}>
                    Voucher No :
                  </span>
                  <div
                    style={{
                      backgroundColor: "#e2e8f0",
                      padding: "2px 10px",
                      minWidth: 64,
                      fontSize: 12,
                      fontWeight: 800,
                      color: "#000000",
                    }}
                  >
                    {voucher.voucher_number || "N/A"}
                  </div>
                </div>
              </div>

              {/* Info Rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "baseline", fontSize: 10.5 }}>
                  <span style={{ fontStyle: "italic", fontWeight: 700, color: "#111827", whiteSpace: "nowrap", marginRight: 6 }}>
                    Name of Developer:
                  </span>
                  <div style={{ flex: 1, borderBottom: "1px solid #6b7280", fontWeight: 800, color: "#000000", paddingBottom: 1 }}>
                    {voucher.developer_name || ""}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "baseline", fontSize: 10.5 }}>
                  <span style={{ fontStyle: "italic", fontWeight: 700, color: "#111827", whiteSpace: "nowrap", marginRight: 6 }}>
                    Agent:
                  </span>
                  <div style={{ flex: 1, borderBottom: "1px solid #6b7280", fontWeight: 800, color: "#000000", paddingBottom: 1 }}>
                    {voucher.agent_name || ""}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "baseline", fontSize: 10.5 }}>
                  <span style={{ fontStyle: "italic", fontWeight: 700, color: "#111827", whiteSpace: "nowrap", marginRight: 6 }}>
                    Project:
                  </span>
                  <div style={{ flex: 1, borderBottom: "1px solid #6b7280", fontWeight: 800, color: "#000000", paddingBottom: 1 }}>
                    {projectWithUnit}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "baseline", fontSize: 10.5 }}>
                  <span style={{ fontStyle: "italic", fontWeight: 700, color: "#111827", whiteSpace: "nowrap", marginRight: 6 }}>
                    Client Name:
                  </span>
                  <div style={{ flex: 1, borderBottom: "1px solid #6b7280", fontWeight: 800, color: "#000000", paddingBottom: 1 }}>
                    {voucher.client_name || ""}
                  </div>
                </div>

                {voucher.reservation_date ? (
                  <div style={{ display: "flex", alignItems: "baseline", fontSize: 10.5 }}>
                    <span style={{ fontStyle: "italic", fontWeight: 700, color: "#111827", whiteSpace: "nowrap", marginRight: 6 }}>
                      Reservation Date:
                    </span>
                    <div style={{ flex: 1, borderBottom: "1px solid #6b7280", fontWeight: 800, color: "#000000", paddingBottom: 1 }}>
                      {voucher.reservation_date}
                    </div>
                  </div>
                ) : null}

                {voucher.commission_status && (
                  <div style={{ display: "flex", alignItems: "baseline", fontSize: 10.5 }}>
                    <span style={{ fontStyle: "italic", fontWeight: 700, color: "#111827", whiteSpace: "nowrap", marginRight: 6 }}>
                      Commission Status:
                    </span>
                    <div style={{ flex: 1, borderBottom: "1px solid #6b7280", fontWeight: 700, color: "#000000", paddingBottom: 1 }}>
                      {voucher.commission_status}
                    </div>
                  </div>
                )}
              </div>

              {/* Financial Calculation Rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14, paddingLeft: 12 }}>
                <div style={{ display: "flex", alignItems: "baseline", fontSize: 10.5 }}>
                  <span style={{ width: 145, textAlign: "right", fontStyle: "italic", color: "#111827", paddingRight: 10 }}>
                    Released from Developer:
                  </span>
                  <div style={{ flex: 1, borderBottom: "1px solid #6b7280", fontWeight: 800, color: "#000000", paddingBottom: 1 }}>
                    {fmt(voucher.amount_released)}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "baseline", fontSize: 10.5 }}>
                  <span style={{ width: 145, textAlign: "right", fontStyle: "italic", color: "#111827", paddingRight: 10 }}>
                    Rate (%):
                  </span>
                  <div style={{ flex: 1, borderBottom: "1px solid #6b7280", fontWeight: 800, color: "#000000", paddingBottom: 1 }}>
                    {fmt(voucher.agent_rate)}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "baseline", fontSize: 10.5 }}>
                  <span style={{ width: 145, textAlign: "right", fontStyle: "italic", color: "#111827", paddingRight: 10 }}>
                    Total for Release:
                  </span>
                  <div style={{ flex: 1, borderBottom: "1px solid #6b7280", fontWeight: 800, color: "#000000", paddingBottom: 1 }}>
                    {fmt(voucher.total_amount)}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "baseline", fontSize: 10.5 }}>
                  <span style={{ width: 145, textAlign: "right", fontStyle: "italic", color: "#111827", paddingRight: 10 }}>
                    Exclusive of Vat:
                  </span>
                  <div style={{ flex: 1, borderBottom: "1px solid #6b7280", fontWeight: 800, color: "#000000", paddingBottom: 1 }}>
                    {fmt(voucher.exclusive_of_vat)}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "baseline", fontSize: 10.5 }}>
                  <span style={{ width: 145, textAlign: "right", fontStyle: "italic", color: "#111827", paddingRight: 10 }}>
                    For BIR 2307:
                  </span>
                  <div style={{ flex: 1, borderBottom: "1px solid #6b7280", fontWeight: 800, color: "#000000", paddingBottom: 1 }}>
                    {fmt(voucher.withholding_tax)}
                  </div>
                </div>
              </div>

              {/* Signature & Date Row */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, fontSize: 10, paddingLeft: 6 }}>
                <span style={{ fontStyle: "italic", color: "#111827" }}>Signature:</span>
                <div style={{ flex: 1.4, borderBottom: "1px solid #6b7280", height: 12 }} />
                <span style={{ fontStyle: "italic", color: "#111827" }}>Date:</span>
                <div style={{ flex: 1, borderBottom: "1px solid #6b7280", height: 12 }} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* NO ATTACHMENTS: FULL-PAGE EXECUTIVE COMMISSION SLIP LAYOUT */
        <div
          style={{
            flex: 1,
            padding: "26px 36px 20px 36px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            overflow: "hidden",
          }}
        >
          {/* Title Banner */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 18,
              }}
            >
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#001f3f", letterSpacing: "0.4px" }}>
                  COMMISSION RELEASE SLIP
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                  Official Accounting Disbursement &amp; Tax Breakdown Summary
                </div>
              </div>
              <div
                style={{
                  border: "1.5px solid #001f3f",
                  borderRadius: 6,
                  padding: "6px 14px",
                  textAlign: "right",
                  backgroundColor: "#f8fafc",
                }}
              >
                <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Calculation Formula
                </div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#001f3f" }}>
                  {voucher.slip_type}
                </div>
              </div>
            </div>

            {/* Section 1: Transaction & Property Details */}
            <div
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                overflow: "hidden",
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  backgroundColor: "#001f3f",
                  color: "#ffffff",
                  padding: "8px 14px",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.6px",
                  textTransform: "uppercase",
                }}
              >
                1. Transaction &amp; Property Details
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px 24px",
                  padding: "16px 18px",
                  backgroundColor: "#ffffff",
                }}
              >
                <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: 6 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Name of Developer
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>
                    {voucher.developer_name || "N/A"}
                  </div>
                </div>

                <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: 6 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Developer Rate (%)
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>
                    {fmt(voucher.developer_rate)}%
                  </div>
                </div>

                <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: 6 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Salesperson / Agent
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#001f3f", marginTop: 2 }}>
                    {voucher.agent_name || "N/A"}
                  </div>
                </div>

                <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: 6 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Agent Commission Rate (%)
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>
                    {fmt(voucher.agent_rate)}%
                  </div>
                </div>

                <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: 6 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Project &amp; Unit No.
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>
                    {projectWithUnit || "N/A"}
                  </div>
                </div>

                <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: 6 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Client Name
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>
                    {voucher.client_name || "N/A"}
                  </div>
                </div>

                <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: 6 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Reservation Date
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>
                    {voucher.reservation_date || "N/A"}
                  </div>
                </div>

                <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: 6 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Commission Status / Remarks
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a", marginTop: 2 }}>
                    {voucher.commission_status || "Standard Release"}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Financial Computation Breakdown */}
            <div
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  backgroundColor: "#001f3f",
                  color: "#ffffff",
                  padding: "8px 14px",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.6px",
                  textTransform: "uppercase",
                }}
              >
                2. Commission Computation Breakdown
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ backgroundColor: "#f1f5f9", borderBottom: "1px solid #cbd5e1" }}>
                    <th style={{ textAlign: "left", padding: "9px 16px", color: "#334155", fontWeight: 700 }}>
                      Particulars
                    </th>
                    <th style={{ textAlign: "center", padding: "9px 16px", color: "#334155", fontWeight: 700 }}>
                      Basis / Rate
                    </th>
                    <th style={{ textAlign: "right", padding: "9px 16px", color: "#334155", fontWeight: 700 }}>
                      Amount (PHP)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "10px 16px", fontWeight: 600 }}>Released from Developer</td>
                    <td style={{ padding: "10px 16px", textAlign: "center", color: "#475569" }}>
                      {fmt(voucher.developer_rate)}% Dev Rate
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700 }}>
                      ₱{fmt(voucher.amount_released)}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "10px 16px", fontWeight: 600 }}>Agent Rate Applied</td>
                    <td style={{ padding: "10px 16px", textAlign: "center", color: "#475569" }}>
                      {fmt(voucher.agent_rate)}% / {fmt(voucher.developer_rate)}%
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700 }}>
                      {fmt(voucher.agent_rate)}%
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "10px 16px", fontWeight: 600 }}>Exclusive of VAT</td>
                    <td style={{ padding: "10px 16px", textAlign: "center", color: "#475569" }}>
                      Tax Base
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700 }}>
                      ₱{fmt(voucher.exclusive_of_vat)}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "10px 16px", fontWeight: 600 }}>Withholding Tax (For BIR 2307)</td>
                    <td style={{ padding: "10px 16px", textAlign: "center", color: "#475569" }}>
                      {voucher.ewt_rate ? `${voucher.ewt_rate}% EWT` : "10% EWT"}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: "#c62828" }}>
                      ₱{fmt(voucher.withholding_tax)}
                    </td>
                  </tr>
                  <tr style={{ backgroundColor: "#ecfdf5", borderTop: "2px solid #001f3f" }}>
                    <td style={{ padding: "13px 16px", fontWeight: 900, fontSize: 13.5, color: "#001f3f" }}>
                      TOTAL FOR RELEASE (NET COMMISSION)
                    </td>
                    <td style={{ padding: "13px 16px", textAlign: "center", fontWeight: 700, color: "#047857" }}>
                      {voucher.slip_type}
                    </td>
                    <td style={{ padding: "13px 16px", textAlign: "right", fontWeight: 900, fontSize: 16, color: "#047857" }}>
                      ₱{fmt(voucher.total_amount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Signatories & Approval Block */}
          <div
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "14px 18px",
              backgroundColor: "#f8fafc",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: "#001f3f",
                textTransform: "uppercase",
                letterSpacing: "0.6px",
                marginBottom: 22,
              }}
            >
              3. Authorization &amp; Acknowledgment of Receipt
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 1fr",
                gap: 18,
                fontSize: 10,
                color: "#334155",
              }}
            >
              <div>
                <div style={{ borderBottom: "1px solid #475569", height: 24, marginBottom: 4 }} />
                <div style={{ fontWeight: 800, color: "#0f172a" }}>Prepared By</div>
                <div style={{ fontSize: 9, color: "#64748b" }}>
                  {voucher.created_by_name || "Accounting Staff"}
                </div>
              </div>
              <div>
                <div style={{ borderBottom: "1px solid #475569", height: 24, marginBottom: 4 }} />
                <div style={{ fontWeight: 800, color: "#0f172a" }}>Checked / Verified By</div>
                <div style={{ fontSize: 9, color: "#64748b" }}>Finance Supervisor</div>
              </div>
              <div>
                <div style={{ borderBottom: "1px solid #475569", height: 24, marginBottom: 4 }} />
                <div style={{ fontWeight: 800, color: "#0f172a" }}>Approved By</div>
                <div style={{ fontSize: 9, color: "#64748b" }}>Authorized Signatory</div>
              </div>
              <div>
                <div style={{ borderBottom: "1px solid #475569", height: 24, marginBottom: 4 }} />
                <div style={{ fontWeight: 800, color: "#0f172a" }}>Received By (Agent)</div>
                <div style={{ fontSize: 9, color: "#64748b" }}>Signature &amp; Date</div>
              </div>
            </div>
          </div>
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
