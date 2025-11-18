"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase/client"
import { format } from "date-fns"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"

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

    // optional/full fields that may exist on saved invoices
    payment_terms?: string | null
    due_date?: string | null
    po_number?: string | null
    trade_license?: string | null
    tdn?: string | null
    company_address?: string | null
    company_email?: string | null
    company_phone?: string | null
    ship_to?: string | null
    items?: any[]
    tax_rate?: number
    show_tax?: boolean
    discount_amount?: number
    show_discount?: boolean
    shipping_amount?: number
    show_shipping?: boolean
    subtotal?: number
    amount_paid?: number
    noted_by?: string | null
    terms?: string | null
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

    // Helper that does the html2canvas + jsPDF generation from printRef
    const generatePDFFromRef = async (fileName: string) => {
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
        pdf.save(fileName)

        printRef.current.style.display = "none"
    }

    // Fetch full invoice record from Supabase and generate PDF (same structure as the main page)
    const handleGenerateAgain = async (invoiceId: string) => {
        setLoading(true)
        const { data, error } = await supabase
            .from("invoices")
            .select("*")
            .eq("id", invoiceId)
            .single()
        setLoading(false)

        if (error || !data) {
            alert("Failed to fetch invoice: " + (error?.message ?? "Not found"))
            return
        }

        setSelectedInvoice(data)

        // Wait for selectedInvoice to render into the hidden print area
        await new Promise((resolve) => setTimeout(resolve, 150))

        const fileName = `invoice-${data.invoice_number || data.id}.pdf`
        await generatePDFFromRef(fileName)

        // Clear selected after generation to keep DOM tidy
        setSelectedInvoice(null)
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
                                                    onClick={() => handleGenerateAgain(inv.id)}
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

            {/* Hidden Printable Invoice - using same structure as the main invoice page */}
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
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40, }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", width: 400, gap: 16 }}>
                                <img
                                    src="/invoice-fhi-logo.jpeg"
                                    alt="FHI Global Property Logo"
                                    style={{
                                        width: "auto",
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

                                <div style={{ marginTop: 20 }}>
                                    <div style={{ fontWeight: "bold", fontSize: 14, marginBottom: 8 }}>To:</div>
                                    <div style={{ fontSize: 14, whiteSpace: "pre-line" }}>{selectedInvoice.client_name}</div>
                                    {selectedInvoice.ship_to && (
                                        <div style={{ marginTop: 12 }}>
                                            <div style={{ fontWeight: "bold", fontSize: 14, marginBottom: 8 }}>Ship To:</div>
                                            <div style={{ fontSize: 14, whiteSpace: "pre-line" }}>{selectedInvoice.ship_to}</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", width: 360 }}>
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
                                <div style={{ fontSize: 14, marginTop: 8, marginBottom: 4 }}>
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
                                {selectedInvoice.items && Array.isArray(selectedInvoice.items) ? (
                                    selectedInvoice.items.map((item: any, index: number) => (
                                        <tr key={index} style={{ borderBottom: index === selectedInvoice.items!.length - 1 ? "none" : "1px solid #eee" }}>
                                            <td style={{ padding: 4, borderRight: "1px solid #eee" }}>{item.description}</td>
                                            <td style={{ padding: 4, textAlign: "center", borderRight: "1px solid #eee" }}>{item.quantity}</td>
                                            <td style={{ padding: 4, textAlign: "center", borderRight: "1px solid #eee" }}>
                                                {selectedInvoice.currency} {Number(item.rate || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                            <td style={{ padding: 4, textAlign: "right" }}>
                                                {selectedInvoice.currency} {Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} style={{ padding: 8, textAlign: "center" }}>No items</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div style={{ width: "48%" }}>
                                <div style={{ fontWeight: "bold", color: "#3c8dbc", marginBottom: 8 }}>Terms</div>
                                <div style={{ fontSize: 13, whiteSpace: "pre-line" }}>{selectedInvoice.terms}</div>
                            </div>

                            <div style={{ width: "48%" }}>
                                <table style={{ width: "100%", fontSize: 14, marginLeft: "auto" }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ padding: "8px 0", textAlign: "right", paddingRight: 20 }}>Subtotal:</td>
                                            <td style={{ padding: "8px 0", textAlign: "right", fontWeight: "bold" }}>
                                                {selectedInvoice.currency} {Number(selectedInvoice.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                        {selectedInvoice.show_tax && (
                                            <tr>
                                                <td style={{ padding: "8px 0", textAlign: "right", paddingRight: 20 }}>Tax{selectedInvoice.tax_rate ? ` (${selectedInvoice.tax_rate}%)` : ""}:</td>
                                                <td style={{ padding: "8px 0", textAlign: "right", fontWeight: "bold" }}>
                                                    {selectedInvoice.currency} {Number(((selectedInvoice.subtotal || 0) * (selectedInvoice.tax_rate || 0)) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        )}
                                        {selectedInvoice.show_discount && (selectedInvoice.discount_amount || 0) > 0 && (
                                            <tr>
                                                <td style={{ padding: "8px 0", textAlign: "right", paddingRight: 20 }}>Discount:</td>
                                                <td style={{ padding: "8px 0", textAlign: "right", fontWeight: "bold" }}>
                                                    - {selectedInvoice.currency} {Number(selectedInvoice.discount_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        )}
                                        {selectedInvoice.show_shipping && (selectedInvoice.shipping_amount || 0) > 0 && (
                                            <tr>
                                                <td style={{ padding: "8px 0", textAlign: "right", paddingRight: 20 }}>Shipping:</td>
                                                <td style={{ padding: "8px 0", textAlign: "right", fontWeight: "bold" }}>
                                                    + {selectedInvoice.currency} {Number(selectedInvoice.shipping_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        )}
                                        <tr>
                                            <td
                                                style={{
                                                    padding: "12px 0",
                                                    textAlign: "right",
                                                    paddingRight: 20,
                                                    fontSize: 16,
                                                    fontWeight: "bold",
                                                }}
                                            >
                                                Total:
                                            </td>
                                            <td style={{ padding: "12px 0", textAlign: "right", fontSize: 16, fontWeight: "bold" }}>
                                                {selectedInvoice.currency} {Number(selectedInvoice.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style={{ padding: "8px 0", textAlign: "right", paddingRight: 20 }}>Amount Paid:</td>
                                            <td style={{ padding: "8px 0", textAlign: "right", fontWeight: "bold" }}>
                                                {selectedInvoice.currency} {Number(selectedInvoice.amount_paid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style={{ padding: "8px 0", textAlign: "right", paddingRight: 20, fontWeight: "bold" }}>Balance Due:</td>
                                            <td style={{ padding: "8px 0", textAlign: "right", fontWeight: "bold" }}>
                                                {selectedInvoice.currency} {Number(selectedInvoice.balance_due || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div style={{ marginTop: 24 }}>
                            <div style={{ fontWeight: "bold", color: "#3c8dbc", marginBottom: 8 }}>Noted By</div>
                            <div style={{ fontSize: 13 }}>{selectedInvoice.noted_by}</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
