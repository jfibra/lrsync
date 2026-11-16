"use client"

import React from "react"
import { format } from "date-fns"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"

export interface ExpenseInvoiceItem {
  expense_request_id?: string
  item_name: string
  description?: string
  tin?: string
  supplier_name?: string
  substreet_street_brgy?: string
  district_city_zip?: string
  tax_type?: string
  tax_month?: string
  category_id?: string
  category_name?: string
  invoice_number?: string
  quantity: number
  rate: number
  amount: number
  gross_taxable?: number
  total_actual_amount?: number
  official_receipt?: string[]
}

export interface ExpenseInvoiceRecord {
  id?: string
  invoice_number: string
  invoice_date: string
  due_date?: string | null
  payment_terms?: string | null
  po_number?: string | null
  company_name?: string | null
  company_tin?: string | null
  company_address?: string | null
  company_email?: string | null
  company_phone?: string | null
  requested_by_uuid?: string | null
  requested_by_name?: string | null
  requested_by_email?: string | null
  assigned_area?: string | null
  payee_name?: string | null
  payee_tin?: string | null
  payee_substreet_street_brgy?: string | null
  payee_district_city_zip?: string | null
  purpose?: string | null
  notes?: string | null
  terms?: string | null
  items: ExpenseInvoiceItem[]
  expense_request_ids?: string[]
  subtotal: number
  tax_rate?: number
  show_tax?: boolean
  tax_amount?: number
  discount_amount?: number
  show_discount?: boolean
  total: number
  currency?: string
  status?: string
  approval_token?: string | null
  sent_to_email?: string | null
  email_sent_at?: string | null
  approved_by_name?: string | null
  approved_by_email?: string | null
  signature_data?: string | null
  signed_at?: string | null
  signed_via?: string | null
  signed_pdf_url?: string | null
  converted_purchase_id?: string | null
  converted_at?: string | null
  converted_by_name?: string | null
  rejection_reason?: string | null
  created_at?: string
}

export async function generateExpenseInvoicePdfData(element: HTMLElement): Promise<{
  pdf: jsPDF
  base64: string
  blob: Blob
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
  const pageHeight = pdf.internal.pageSize.getHeight()
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width

  let heightLeft = pdfHeight
  let position = 0

  pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight)
  heightLeft -= pageHeight

  while (heightLeft > 5) {
    position = heightLeft - pdfHeight
    pdf.addPage()
    pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight)
    heightLeft -= pageHeight
  }

  const dataUri = pdf.output("datauristring")
  const base64 = dataUri.split(",")[1] || ""
  const blob = pdf.output("blob")

  return { pdf, base64, blob }
}

export async function downloadExpenseInvoicePdf(
  element: HTMLElement,
  invoiceNumber: string
): Promise<void> {
  const { pdf } = await generateExpenseInvoicePdfData(element)
  pdf.save(`Expense-Invoice-${invoiceNumber}.pdf`)
}

interface ExpenseInvoiceDocumentProps {
  invoice: ExpenseInvoiceRecord
  containerId?: string
}

export function ExpenseInvoiceDocument({
  invoice,
  containerId = "expense-invoice-printable",
}: ExpenseInvoiceDocumentProps) {
  const currency = invoice.currency || "PHP"
  const formatAmount = (val: number | string | undefined) => {
    const num = Number(val) || 0
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: currency === "AED" ? "AED" : "PHP",
      minimumFractionDigits: 2,
    }).format(num)
  }

  const formatTin = (tin?: string | null) => {
    if (!tin) return ""
    const digits = tin.replace(/\D/g, "")
    if (!digits || digits === "0") return tin
    return digits.replace(/(\d{3})(?=\d)/g, "$1-")
  }

  const items = Array.isArray(invoice.items) ? invoice.items : []
  const isApproved = invoice.status === "approved" || invoice.status === "converted"
  const isRejected = invoice.status === "rejected"

  const formattedInvoiceDate = invoice.invoice_date
    ? format(new Date(invoice.invoice_date), "MMMM dd, yyyy")
    : format(new Date(), "MMMM dd, yyyy")

  const formattedSignedDate = invoice.signed_at
    ? format(new Date(invoice.signed_at), "MMMM dd, yyyy 'at' hh:mm a")
    : null

  return (
    <div
      id={containerId}
      style={{
        width: "100%",
        maxWidth: 820,
        margin: "0 auto",
        backgroundColor: "#ffffff",
        color: "#0f172a",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
        border: "1px solid #cbd5e1",
        borderRadius: 8,
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Top Executive Accent Bar */}
      <div
        style={{
          height: 8,
          background: "linear-gradient(90deg, #001f3f 0%, #0284c7 60%, #10b981 100%)",
        }}
      />

      <div style={{ padding: "36px 40px" }}>
        {/* Header Row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 24,
            paddingBottom: 24,
            borderBottom: "2px solid #e2e8f0",
          }}
        >
          {/* Left: Company Branding */}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
              <img
                src="/invoice-fhi-logo.jpeg"
                alt="Company Logo"
                style={{
                  height: 54,
                  width: "auto",
                  objectFit: "contain",
                  borderRadius: 6,
                }}
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).style.display = "none"
                }}
              />
              <div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: "#001f3f",
                    letterSpacing: "-0.3px",
                    lineHeight: 1.2,
                  }}
                >
                  {invoice.company_name || "LEUTERIO REALTY & BROKERAGE"}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#0284c7",
                    textTransform: "uppercase",
                    letterSpacing: "1.2px",
                    marginTop: 2,
                  }}
                >
                  Official Expense Request &amp; Disbursement Voucher
                </div>
              </div>
            </div>

            <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5, marginTop: 8 }}>
              {invoice.company_address && <div>Address: {invoice.company_address}</div>}
              {invoice.company_email && <div>Email: {invoice.company_email}</div>}
              {invoice.company_phone && <div>Contact: {invoice.company_phone}</div>}
              {invoice.company_tin && <div>TIN / Reg No.: {invoice.company_tin}</div>}
            </div>
          </div>

          {/* Right: Invoice Badge & Meta */}
          <div style={{ textAlign: "right", minWidth: 240 }}>
            <div
              style={{
                fontSize: 26,
                fontWeight: 900,
                color: "#001f3f",
                letterSpacing: "0.5px",
                lineHeight: 1,
              }}
            >
              EXPENSE INVOICE
            </div>
            <div
              style={{
                display: "inline-block",
                marginTop: 8,
                padding: "6px 14px",
                backgroundColor: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                fontSize: 15,
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              # {invoice.invoice_number}
            </div>

            {/* Status Pill */}
            <div style={{ marginTop: 10 }}>
              {isApproved ? (
                <span
                  style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    borderRadius: 999,
                    backgroundColor: "#dcfce7",
                    color: "#15803d",
                    border: "1px solid #86efac",
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.6px",
                  }}
                >
                  ✓ {invoice.status === "converted" ? "APPROVED & CONVERTED TO PURCHASE" : "APPROVED & SIGNED"}
                </span>
              ) : isRejected ? (
                <span
                  style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    borderRadius: 999,
                    backgroundColor: "#fee2e2",
                    color: "#b91c1c",
                    border: "1px solid #fca5a5",
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.6px",
                  }}
                >
                  ✕ REJECTED
                </span>
              ) : (
                <span
                  style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    borderRadius: 999,
                    backgroundColor: "#fef3c7",
                    color: "#b45309",
                    border: "1px solid #fcd34d",
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.6px",
                  }}
                >
                  ● PENDING SIGNATURE APPROVAL
                </span>
              )}
            </div>

            <div style={{ fontSize: 12, color: "#475569", marginTop: 12, lineHeight: 1.6 }}>
              <div>
                <strong>Invoice Date:</strong> {formattedInvoiceDate}
              </div>
              {invoice.due_date && (
                <div>
                  <strong>Due Date:</strong> {format(new Date(invoice.due_date), "MMM dd, yyyy")}
                </div>
              )}
              {invoice.po_number && (
                <div>
                  <strong>Ref / PO #:</strong> {invoice.po_number}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info Grid: Payee/Supplier & Requested By */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
            marginTop: 24,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "14px 18px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                color: "#0284c7",
                marginBottom: 6,
              }}
            >
              Payee / Vendor Details
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
              {invoice.payee_name || items[0]?.supplier_name || items[0]?.item_name || "Various Payees / Internal Expense"}
            </div>
            {(invoice.payee_tin || items[0]?.tin) && (
              <div style={{ fontSize: 12, color: "#475569", marginTop: 3 }}>
                <strong>TIN:</strong> {formatTin(invoice.payee_tin || items[0]?.tin)}
              </div>
            )}
            {(invoice.payee_substreet_street_brgy || invoice.payee_district_city_zip) && (
              <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                {[invoice.payee_substreet_street_brgy, invoice.payee_district_city_zip]
                  .filter(Boolean)
                  .join(", ")}
              </div>
            )}
          </div>

          <div
            style={{
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "14px 18px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                color: "#0284c7",
                marginBottom: 6,
              }}
            >
              Requisition Details
            </div>
            <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
              <div>
                <strong>Requested By:</strong> {invoice.requested_by_name || "Accounting / Secretary"}
              </div>
              {invoice.assigned_area && (
                <div>
                  <strong>Branch / Area:</strong> {invoice.assigned_area}
                </div>
              )}
              {invoice.requested_by_email && (
                <div>
                  <strong>Email:</strong> {invoice.requested_by_email}
                </div>
              )}
              {invoice.purpose && (
                <div>
                  <strong>Purpose:</strong> {invoice.purpose}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Itemized Expense Table */}
        <div style={{ marginBottom: 24 }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              border: "1px solid #cbd5e1",
              fontSize: 13,
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#001f3f", color: "#ffffff" }}>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "center",
                    fontWeight: 700,
                    width: 42,
                    borderRight: "1px solid #1e3a5f",
                  }}
                >
                  #
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontWeight: 700,
                    borderRight: "1px solid #1e3a5f",
                  }}
                >
                  Itemized Particulars &amp; Payee Details
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "center",
                    fontWeight: 700,
                    width: 120,
                    borderRight: "1px solid #1e3a5f",
                  }}
                >
                  Category
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "center",
                    fontWeight: 700,
                    width: 85,
                    borderRight: "1px solid #1e3a5f",
                  }}
                >
                  Tax Type
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                    width: 125,
                    borderRight: "1px solid #1e3a5f",
                  }}
                >
                  Gross Taxable
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                    width: 135,
                  }}
                >
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const itemAmount = Number(item.amount ?? item.total_actual_amount ?? item.gross_taxable ?? 0)
                const itemGross = Number(item.gross_taxable ?? itemAmount)
                return (
                  <tr
                    key={item.expense_request_id || idx}
                    style={{
                      backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    <td
                      style={{
                        padding: "10px 12px",
                        textAlign: "center",
                        color: "#64748b",
                        fontWeight: 600,
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      {idx + 1}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 13.5 }}>
                        {item.item_name || item.description || "Expense Item"}
                      </div>
                      {(item.supplier_name || item.tin || item.invoice_number) && (
                        <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                          {[
                            item.supplier_name ? `Vendor: ${item.supplier_name}` : null,
                            item.tin && item.tin !== "0" ? `TIN: ${formatTin(item.tin)}` : null,
                            item.invoice_number && item.invoice_number !== "0"
                              ? `OR/Inv #: ${item.invoice_number}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" • ")}
                        </div>
                      )}
                      {item.description && item.description !== item.item_name && (
                        <div style={{ fontSize: 11.5, color: "#475569", marginTop: 2 }}>
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        textAlign: "center",
                        color: "#334155",
                        fontSize: 12,
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      {item.category_name || "General"}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        textAlign: "center",
                        fontSize: 11.5,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        color: item.tax_type === "vat" ? "#0284c7" : "#b45309",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      {item.tax_type || "NON-VAT"}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        textAlign: "right",
                        color: "#334155",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      {formatAmount(itemGross)}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        textAlign: "right",
                        fontWeight: 700,
                        color: "#0f172a",
                      }}
                    >
                      {formatAmount(itemAmount)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom Notes & Totals Row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 28,
            marginBottom: 32,
          }}
        >
          {/* Left: Notes & Terms */}
          <div style={{ flex: 1 }}>
            {(invoice.notes || invoice.terms) && (
              <div
                style={{
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "12px 16px",
                  fontSize: 12,
                  color: "#475569",
                  lineHeight: 1.5,
                }}
              >
                {invoice.notes && (
                  <div style={{ marginBottom: invoice.terms ? 8 : 0 }}>
                    <strong style={{ color: "#0f172a", display: "block", marginBottom: 2 }}>
                      Notes / Remarks:
                    </strong>
                    <div style={{ whiteSpace: "pre-line" }}>{invoice.notes}</div>
                  </div>
                )}
                {invoice.terms && (
                  <div>
                    <strong style={{ color: "#0f172a", display: "block", marginBottom: 2 }}>
                      Payment / Disbursement Instructions:
                    </strong>
                    <div style={{ whiteSpace: "pre-line" }}>{invoice.terms}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Totals Box */}
          <div
            style={{
              width: 300,
              backgroundColor: "#f8fafc",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "14px 18px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                color: "#475569",
                padding: "4px 0",
              }}
            >
              <span>Subtotal ({items.length} items):</span>
              <span style={{ fontWeight: 600, color: "#0f172a" }}>
                {formatAmount(invoice.subtotal || invoice.total)}
              </span>
            </div>

            {invoice.show_tax && Number(invoice.tax_amount) > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  color: "#475569",
                  padding: "4px 0",
                }}
              >
                <span>Tax ({invoice.tax_rate}%):</span>
                <span style={{ fontWeight: 600, color: "#0f172a" }}>
                  {formatAmount(invoice.tax_amount)}
                </span>
              </div>
            )}

            {invoice.show_discount && Number(invoice.discount_amount) > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  color: "#475569",
                  padding: "4px 0",
                }}
              >
                <span>Discount:</span>
                <span style={{ fontWeight: 600, color: "#dc2626" }}>
                  - {formatAmount(invoice.discount_amount)}
                </span>
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "2px solid #001f3f",
                marginTop: 8,
                paddingTop: 10,
                fontSize: 16,
                fontWeight: 800,
                color: "#001f3f",
              }}
            >
              <span>TOTAL AMOUNT:</span>
              <span style={{ fontSize: 18, color: "#0284c7" }}>{formatAmount(invoice.total)}</span>
            </div>
          </div>
        </div>

        {/* Signatures Block */}
        <div
          style={{
            borderTop: "2px dashed #cbd5e1",
            paddingTop: 24,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 40,
            alignItems: "end",
          }}
        >
          {/* Prepared By */}
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                color: "#64748b",
                marginBottom: 28,
              }}
            >
              Prepared &amp; Requested By:
            </div>
            <div
              style={{
                borderBottom: "1.5px solid #334155",
                paddingBottom: 6,
                fontSize: 14,
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              {invoice.requested_by_name || "Accounting / Secretary"}
            </div>
            <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4 }}>
              {invoice.assigned_area ? `${invoice.assigned_area} Office` : "Accounting Department"} &bull;{" "}
              {formattedInvoiceDate}
            </div>
          </div>

          {/* Approved & Signed By */}
          <div style={{ position: "relative" }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                color: "#64748b",
                marginBottom: 8,
              }}
            >
              Approved &amp; Signed By:
            </div>

            {/* Signature Image Box */}
            <div
              style={{
                minHeight: 72,
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "flex-start",
                position: "relative",
              }}
            >
              {invoice.signature_data ? (
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <img
                    src={invoice.signature_data}
                    alt="Executive Signature"
                    style={{
                      maxHeight: 68,
                      maxWidth: 220,
                      objectFit: "contain",
                    }}
                  />
                  <div
                    style={{
                      border: "2px solid #16a34a",
                      borderRadius: 6,
                      padding: "3px 8px",
                      color: "#15803d",
                      backgroundColor: "#f0fdf4",
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      lineHeight: 1.3,
                    }}
                  >
                    <div>DIGITALLY SIGNED</div>
                    {invoice.signed_at && (
                      <div style={{ fontSize: 9, fontWeight: 600 }}>
                        {format(new Date(invoice.signed_at), "yyyy-MM-dd HH:mm")}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    fontSize: 12,
                    fontStyle: "italic",
                    color: "#94a3b8",
                    paddingBottom: 8,
                  }}
                >
                  Awaiting Official Signature
                </div>
              )}
            </div>

            <div
              style={{
                borderBottom: "1.5px solid #334155",
                paddingBottom: 6,
                fontSize: 14,
                fontWeight: 800,
                color: "#001f3f",
              }}
            >
              {invoice.approved_by_name || "ANTHONY GERARD LEUTERIO"}
            </div>
            <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4 }}>
              President / CEO ({invoice.approved_by_email || "mindworth@gmail.com"})
              {formattedSignedDate && (
                <div style={{ color: "#15803d", fontWeight: 600, marginTop: 2 }}>
                  Signed Date: {formattedSignedDate}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
