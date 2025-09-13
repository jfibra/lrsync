"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { format } from "date-fns"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import { useRef } from "react"

interface InvoiceRecord {
    id: string
    invoice_number: string
    invoice_date: string
    client_name: string
    company_name: string
    total: number
    balance_due: number
    currency: string
    created_at: string
}

export default function InvoiceRecordsPage() {
    const [invoices, setInvoices] = useState<InvoiceRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null)

    useEffect(() => {
        const fetchInvoices = async () => {
            setLoading(true)
            const { data, error } = await supabase
                .from("invoices")
                .select("id, invoice_number, invoice_date, client_name, company_name, total, balance_due, currency, created_at")
                .order("created_at", { ascending: false })
            if (!error && data) setInvoices(data)
            setLoading(false)
        }
        fetchInvoices()
    }, [])

    // Filter invoices by invoice number or client name
    const filtered = invoices.filter(
        (inv) =>
            inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
            inv.client_name?.toLowerCase().includes(search.toLowerCase())
    )

    const printRef = useRef<HTMLDivElement>(null)

    const generatePDFForInvoice = async (invoice: InvoiceRecord) => {
        // Render a hidden printable invoice using the invoice data
        if (!printRef.current) return

        printRef.current.style.display = "block"
        await new Promise((resolve) => setTimeout(resolve, 100))

        const canvas = await html2canvas(printRef.current, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
        })
        const imgData = canvas.toDataURL("image/png")
        const pdf = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
        })

        const pdfWidth = pdf.internal.pageSize.getWidth()
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width

        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight)
        pdf.save(`invoice-${invoice.invoice_number}.pdf`)

        printRef.current.style.display = "none"
    }

    return (
        <div className="bg-white min-h-screen">
            <div className="max-w-6xl mx-auto p-4 sm:p-8">
                <h1 className="text-2xl font-bold mb-6 text-[#002244]">Invoice Records</h1>
                <div className="mb-4 flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center">
                    <input
                        type="text"
                        placeholder="Search by invoice # or client..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="border border-gray-300 rounded px-3 py-2 w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-[#3c8dbc] text-sm bg-[#f8fafc] text-[#002244]"
                    />
                    <span className="text-sm text-[#3c8dbc] font-medium">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="overflow-x-auto">
                    <div className="rounded-lg shadow border border-gray-200 bg-white">
                        <table className="min-w-full">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-[#e6f2fb] text-[#002244]">
                                    <th className="py-3 px-4 border-b text-left font-semibold">Invoice #</th>
                                    <th className="py-3 px-4 border-b text-left font-semibold">Date</th>
                                    <th className="py-3 px-4 border-b text-left font-semibold">Client</th>
                                    <th className="py-3 px-4 border-b text-left font-semibold">Company</th>
                                    <th className="py-3 px-4 border-b text-right font-semibold">Total</th>
                                    <th className="py-3 px-4 border-b text-right font-semibold">Balance Due</th>
                                    <th className="py-3 px-4 border-b text-left font-semibold">Currency</th>
                                    <th className="py-3 px-4 border-b text-left font-semibold">Created</th>
                                    <th className="py-3 px-4 border-b text-center font-semibold">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={9} className="py-6 text-center text-[#3c8dbc] bg-white">Loading...</td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="py-6 text-center text-[#3c8dbc] bg-white">No invoices found.</td>
                                    </tr>
                                ) : (
                                    filtered.map((inv, idx) => (
                                        <tr
                                            key={inv.id}
                                            className={`transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-[#f4f8fb]"} hover:bg-[#dbeafe]`}
                                        >
                                            <td className="py-2 px-4 border-b text-[#002244]">{inv.invoice_number}</td>
                                            <td className="py-2 px-4 border-b text-[#002244]">{inv.invoice_date ? format(new Date(inv.invoice_date), "MMM dd, yyyy") : "-"}</td>
                                            <td className="py-2 px-4 border-b text-[#002244]">{inv.client_name}</td>
                                            <td className="py-2 px-4 border-b text-[#002244]">{inv.company_name}</td>
                                            <td className="py-2 px-4 border-b text-right text-[#002244]">{inv.currency} {inv.total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            <td className="py-2 px-4 border-b text-right text-[#002244]">{inv.currency} {inv.balance_due?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            <td className="py-2 px-4 border-b text-[#002244]">{inv.currency}</td>
                                            <td className="py-2 px-4 border-b text-[#002244]">{inv.created_at ? format(new Date(inv.created_at), "MMM dd, yyyy HH:mm") : "-"}</td>
                                            <td className="py-2 px-4 border-b text-center">
                                                <button
                                                    className="text-[#3c8dbc] hover:underline text-sm font-medium"
                                                    onClick={() => {
                                                        setSelectedInvoice(inv)
                                                        setTimeout(() => generatePDFForInvoice(inv), 100)
                                                    }}
                                                >
                                                    Generate Again
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            {/* Hidden Printable Invoice */}
            <div
                id="print-invoice"
                ref={printRef}
                style={{
                    width: 800,
                    margin: "0 auto",
                    padding: 40,
                    background: "#fff",
                    color: "#222",
                    fontFamily: "Arial, sans-serif",
                    display: "none",
                }}
            >
                {selectedInvoice && (
                    <div>
                        {/* Header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40 }}>
                            {/* Left: Logo and Company Info */}
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 300 }}>
                                <img
                                    src="/invoice-fhi-logo.jpeg"
                                    alt="FHI Global Property Logo"
                                    style={{
                                        width: 80,
                                        height: 80,
                                        objectFit: "contain",
                                        marginBottom: 8,
                                    }}
                                />
                                <div style={{ fontWeight: "bold", fontSize: 18, marginBottom: 8 }}>{selectedInvoice.company_name}</div>
                                <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                                    {selectedInvoice.trade_license && <div>TRADE LICENSE: {selectedInvoice.trade_license}</div>}
                                    {selectedInvoice.tdn && <div>TDN: {selectedInvoice.tdn}</div>}
                                    {selectedInvoice.company_address && <div>ADDRESS: {selectedInvoice.company_address}</div>}
                                    {selectedInvoice.company_email && <div>Email Address: {selectedInvoice.company_email}</div>}
                                    {selectedInvoice.company_phone && <div>Phone: {selectedInvoice.company_phone}</div>}
                                </div>
                            </div>
                            {/* Right: Invoice Meta */}
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", minWidth: 220 }}>
                                <div style={{ fontWeight: "bold", fontSize: 36, marginBottom: 16, color: "#3c8dbc" }}>INVOICE</div>
                                <div
                                    style={{
                                        fontSize: 18,
                                        fontWeight: "bold",
                                        marginBottom: 16,
                                        background: "#f4f8fb",
                                        padding: "8px 0",
                                        borderRadius: 6,
                                        width: 120,
                                        textAlign: "right",
                                        letterSpacing: 1,
                                    }}
                                >
                                    # {selectedInvoice.invoice_number}
                                </div>
                                <div style={{ fontSize: 14, marginBottom: 4 }}>
                                    <span style={{ fontWeight: "bold" }}>Date:</span>{" "}
                                    {selectedInvoice.invoice_date ? format(new Date(selectedInvoice.invoice_date), "MMM dd, yyyy") : "-"}
                                </div>
                                {selectedInvoice.payment_terms && (
                                    <div style={{ fontSize: 14, marginBottom: 4 }}>
                                        <span style={{ fontWeight: "bold" }}>Payment Terms:</span> {selectedInvoice.payment_terms}
                                    </div>
                                )}
                                {selectedInvoice.due_date && (
                                    <div style={{ fontSize: 14, marginBottom: 4 }}>
                                        <span style={{ fontWeight: "bold" }}>Due Date:</span>{" "}
                                        {format(new Date(selectedInvoice.due_date), "MMM dd, yyyy")}
                                    </div>
                                )}
                                {selectedInvoice.po_number && (
                                    <div style={{ fontSize: 14, marginBottom: 12 }}>
                                        <span style={{ fontWeight: "bold" }}>PO Number:</span> {selectedInvoice.po_number}
                                    </div>
                                )}
                                <div
                                    style={{
                                        background: "#f4f8fb",
                                        fontWeight: "bold",
                                        fontSize: 16,
                                        padding: "10px",
                                        borderRadius: 6,
                                        marginTop: 8,
                                        width: "100%",
                                        textAlign: "right",
                                    }}
                                >
                                    Balance Due: {selectedInvoice.currency}{" "}
                                    {selectedInvoice.balance_due?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>

                        {/* To Section */}
                        <div style={{ marginBottom: 24 }}>
                            <div style={{ fontWeight: "bold", fontSize: 14, marginBottom: 8 }}>To:</div>
                            <div style={{ fontSize: 14, whiteSpace: "pre-line" }}>{selectedInvoice.client_name}</div>
                            {selectedInvoice.ship_to && (
                                <>
                                    <div style={{ fontWeight: "bold", fontSize: 14, marginTop: 16, marginBottom: 8 }}>Ship To:</div>
                                    <div style={{ fontSize: 14, whiteSpace: "pre-line" }}>{selectedInvoice.ship_to}</div>
                                </>
                            )}
                        </div>

                        {/* Items Table */}
                        {selectedInvoice.items && Array.isArray(selectedInvoice.items) && (
                            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32, border: "1px solid #ddd" }}>
                                <thead>
                                    <tr style={{ background: "#001f3f", color: "#fff" }}>
                                        <th style={{ padding: 6, textAlign: "left", border: "1px solid #ddd", fontWeight: "bold" }}>Item</th>
                                        <th style={{ padding: 6, textAlign: "center", border: "1px solid #ddd", fontWeight: "bold" }}>Quantity</th>
                                        <th style={{ padding: 6, textAlign: "center", border: "1px solid #ddd", fontWeight: "bold" }}>Rate</th>
                                        <th style={{ padding: 6, textAlign: "right", border: "1px solid #ddd", fontWeight: "bold" }}>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedInvoice.items.map((item: any, index: number) => (
                                        <tr key={index} style={{ borderBottom: index === selectedInvoice.items.length - 1 ? "none" : "1px solid #eee" }}>
                                            <td style={{ padding: 4, borderRight: "1px solid #eee" }}>{item.description}</td>
                                            <td style={{ padding: 4, textAlign: "center", borderRight: "1px solid #eee" }}>{item.quantity}</td>
                                            <td style={{ padding: 4, textAlign: "center", borderRight: "1px solid #eee" }}>
                                                {selectedInvoice.currency} {item.rate?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                            <td style={{ padding: 4, textAlign: "right" }}>
                                                {selectedInvoice.currency} {item.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {/* Totals Section */}
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <table style={{ width: 320, fontSize: 14 }}>
                                <tbody>
                                    <tr>
                                        <td style={{ padding: "4px 8px" }}>Subtotal</td>
                                        <td style={{ padding: "4px 8px", textAlign: "right" }}>
                                            {selectedInvoice.currency} {selectedInvoice.subtotal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                    {selectedInvoice.show_tax && (
                                        <tr>
                                            <td style={{ padding: "4px 8px" }}>
                                                Tax{selectedInvoice.tax_rate ? ` (${selectedInvoice.tax_rate}%)` : ""}
                                            </td>
                                            <td style={{ padding: "4px 8px", textAlign: "right" }}>
                                                {selectedInvoice.currency} {selectedInvoice.tax_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    )}
                                    {selectedInvoice.show_discount && selectedInvoice.discount_amount > 0 && (
                                        <tr>
                                            <td style={{ padding: "4px 8px" }}>Discount</td>
                                            <td style={{ padding: "4px 8px", textAlign: "right" }}>
                                                - {selectedInvoice.currency} {selectedInvoice.discount_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    )}
                                    {selectedInvoice.show_shipping && selectedInvoice.shipping_amount > 0 && (
                                        <tr>
                                            <td style={{ padding: "4px 8px" }}>Shipping</td>
                                            <td style={{ padding: "4px 8px", textAlign: "right" }}>
                                                + {selectedInvoice.currency} {selectedInvoice.shipping_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    )}
                                    <tr style={{ fontWeight: "bold", fontSize: 16 }}>
                                        <td style={{ padding: "8px 8px", borderTop: "2px solid #3c8dbc" }}>Total</td>
                                        <td style={{ padding: "8px 8px", textAlign: "right", borderTop: "2px solid #3c8dbc" }}>
                                            {selectedInvoice.currency} {selectedInvoice.total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: "4px 8px" }}>Amount Paid</td>
                                        <td style={{ padding: "4px 8px", textAlign: "right" }}>
                                            {selectedInvoice.currency} {selectedInvoice.amount_paid?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                    <tr style={{ fontWeight: "bold" }}>
                                        <td style={{ padding: "8px 8px", borderTop: "2px solid #3c8dbc" }}>Balance Due</td>
                                        <td style={{ padding: "8px 8px", textAlign: "right", borderTop: "2px solid #3c8dbc" }}>
                                            {selectedInvoice.currency} {selectedInvoice.balance_due?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Terms and Noted By */}
                        <div style={{ marginTop: 32, display: "flex", gap: 40 }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: "bold", color: "#3c8dbc", marginBottom: 8 }}>Terms</div>
                                <div style={{ fontSize: 13, whiteSpace: "pre-line" }}>{selectedInvoice.terms}</div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: "bold", color: "#3c8dbc", marginBottom: 8 }}>Noted By</div>
                                <div style={{ fontSize: 13 }}>{selectedInvoice.noted_by}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}