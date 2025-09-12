"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, Download, RefreshCw } from "lucide-react"
import { format } from "date-fns"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  rate: number
  amount: number
}

export default function DubaiCommissionsPage() {
  const [invoiceNumber, setInvoiceNumber] = useState("1")
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [paymentTerms, setPaymentTerms] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [poNumber, setPoNumber] = useState("")

  // Company details (defaults from PDF)
  const [companyName, setCompanyName] = useState("FHI GLOBAL PROPERTY LLC")
  const [tradeLicense, setTradeLicense] = useState("1463743")
  const [tdn, setTdn] = useState("105088815300001")
  const [companyAddress, setCompanyAddress] = useState(
    "Office no 98-3001, Owned by Arenco Marlin Investment LLC, Al Muraqqabat",
  )
  const [companyEmail, setCompanyEmail] = useState("mindworth@gmail.com")
  const [companyPhone, setCompanyPhone] = useState("+971504126408")

  // Client details
  const [clientName, setClientName] = useState("JOTUN MEIA FZLLC")
  const [shipTo, setShipTo] = useState("")

  const [showDiscount, setShowDiscount] = useState(false)
  const [showShipping, setShowShipping] = useState(false)
  const [showTax, setShowTax] = useState(true)

  // Invoice items
  const [items, setItems] = useState<InvoiceItem[]>([])

  // Tax and totals
  const [taxRate, setTaxRate] = useState(5)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [shippingAmount, setShippingAmount] = useState(0)
  const [amountPaid, setAmountPaid] = useState(0)

  // Notes and terms
  const [notedBy, setNotedBy] = useState("ANTHONY GERARD LEUTERIO")
  const [terms, setTerms] = useState(`Payment Details: Bank Transfer
Bank Name: WIO
Bank Account Name: FHI Global Property LLC
Account Number: 9185994189
IBAN:AE900860000009185994189
SWIFT: WIOBAEADXXX`)

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0)
  const taxAmount = (subtotal * taxRate) / 100
  const total = subtotal + taxAmount - discountAmount + shippingAmount
  const balanceDue = total - amountPaid

  const addItem = () => {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      description: "",
      quantity: 1,
      rate: 0,
      amount: 0,
    }
    setItems([...items, newItem])
  }

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id))
  }

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value }
          if (field === "quantity" || field === "rate") {
            updatedItem.amount = updatedItem.quantity * updatedItem.rate
          }
          return updatedItem
        }
        return item
      }),
    )
  }

  const generatePDF = async () => {
    const printInvoice = document.getElementById("print-invoice")
    if (!printInvoice) return

    printInvoice.style.display = "block"
    await new Promise((resolve) => setTimeout(resolve, 100))

    const canvas = await html2canvas(printInvoice, { scale: 2 })
    const imgData = canvas.toDataURL("image/png")
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "px",
      format: [canvas.width, canvas.height],
    })
    pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height)
    pdf.save(`invoice-${invoiceNumber}.pdf`)

    printInvoice.style.display = "none"
  }

  return (
    <div className="min-h-screen bg-[#f4f8fb] text-[#001f3f]">
      <div className="bg-[#001f3f] border-b px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-[#3c8dbc] text-white px-4 py-2 rounded font-bold text-lg shadow">
              FHI Global Property
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Button onClick={generatePDF} className="bg-green-600 hover:bg-green-700 text-white">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white border border-[#e0e7ef] rounded-lg shadow p-8">
          {/* Invoice Header */}
          <div className="flex justify-between items-start mb-8">
            <div className="space-y-2">
              <Textarea
                value={`${companyName}\nTRADE LICENSE: ${tradeLicense}\nTDN:${tdn}\nADDRESS: ${companyAddress}\nEmail Address: ${companyEmail}\nPhone: ${companyPhone}`}
                onChange={(e) => {
                  const lines = e.target.value.split("\n")
                  setCompanyName(lines[0] || "")
                  setTradeLicense(lines[1]?.replace("TRADE LICENSE: ", "") || "")
                  setTdn(lines[2]?.replace("TDN:", "") || "")
                  setCompanyAddress(lines[3]?.replace("ADDRESS: ", "") || "")
                  setCompanyEmail(lines[4]?.replace("Email Address: ", "") || "")
                  setCompanyPhone(lines[5]?.replace("Phone: ", "") || "")
                }}
                className="w-96 h-32 border-gray-300 text-sm resize-none bg-[#f4f8fb] text-[#001f3f]"
              />
            </div>
            <div className="flex flex-col items-end w-full max-w-xl ml-8">
              <div className="flex items-center mb-4">
                <span className="text-3xl font-bold text-[#001f3f] mr-4">INVOICE</span>
                <span className="text-lg text-[#3c8dbc] mr-1">#</span>
                <Input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-24 text-center border-[#3c8dbc] text-[#001f3f] bg-[#f4f8fb] font-bold text-lg"
                />
              </div>
              <div className="grid grid-cols-4 gap-4 w-full">
                <div>
                  <Label className="text-xs text-[#3c8dbc]">Date</Label>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full bg-[#f4f8fb] text-[#001f3f] text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-[#3c8dbc]">Payment Terms</Label>
                  <Input
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full bg-[#f4f8fb] text-[#001f3f] text-sm"
                    placeholder="Net 30"
                  />
                </div>
                <div>
                  <Label className="text-xs text-[#3c8dbc]">Due Date</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-[#f4f8fb] text-[#001f3f] text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-[#3c8dbc]">PO Number</Label>
                  <Input
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    className="w-full bg-[#f4f8fb] text-[#001f3f] text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* To and Ship To Section */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <Label className="text-sm font-medium text-[#3c8dbc] mb-2 block">To</Label>
              <Textarea
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full h-24 resize-none bg-[#f4f8fb] text-[#001f3f]"
                placeholder="Who is this invoice to?"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-[#3c8dbc] mb-2 block">Ship To</Label>
              <Textarea
                value={shipTo}
                onChange={(e) => setShipTo(e.target.value)}
                className="w-full h-24 resize-none bg-[#f4f8fb] text-[#001f3f]"
                placeholder="(optional)"
              />
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-8">
            <div className="bg-[#3c8dbc] text-white px-4 py-3 grid grid-cols-12 gap-4 rounded-t">
              <div className="col-span-6 font-medium">Item</div>
              <div className="col-span-2 font-medium text-center">Quantity</div>
              <div className="col-span-2 font-medium text-center">Rate</div>
              <div className="col-span-2 font-medium text-right">Amount</div>
            </div>
            <div className="border-l border-r border-b bg-[#f9fbfd]">
              {items.map((item, index) => (
                <div key={item.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-b-0 items-center">
                  <div className="col-span-6">
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(item.id, "description", e.target.value)}
                      placeholder="Description of service or product..."
                      className="border-0 shadow-none p-0 h-auto bg-transparent text-[#001f3f]"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, "quantity", Number.parseFloat(e.target.value) || 0)}
                      className="text-center border-0 shadow-none p-0 h-auto bg-transparent text-[#001f3f]"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="col-span-2 flex items-center">
                    <span className="text-sm mr-1 text-[#3c8dbc]">AED</span>
                    <Input
                      type="number"
                      value={item.rate}
                      onChange={(e) => updateItem(item.id, "rate", Number.parseFloat(e.target.value) || 0)}
                      className="border-0 shadow-none p-0 h-auto bg-transparent text-[#001f3f]"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="font-medium text-[#001f3f]">AED {item.amount.toFixed(2)}</span>
                    {items.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(item.id)}
                        className="ml-2 h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Button
              onClick={addItem}
              variant="outline"
              className="mt-4 text-green-700 border-green-700 hover:bg-green-50 bg-transparent"
            >
              <Plus className="w-4 h-4 mr-2" />
              Line Item
            </Button>
          </div>

          {/* Bottom Section */}
          <div className="grid grid-cols-2 gap-8">
            {/* Left Side - Notes and Terms */}
            <div className="space-y-6">
              <div>
                <Label className="text-sm font-medium text-[#3c8dbc] mb-2 block">Noted By:</Label>
                <Input value={notedBy} onChange={(e) => setNotedBy(e.target.value)} className="w-full bg-[#f4f8fb] text-[#001f3f]" />
              </div>
              <div>
                <Label className="text-sm font-medium text-[#3c8dbc] mb-2 block">Terms</Label>
                <Textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="w-full h-32 resize-none text-sm bg-[#f4f8fb] text-[#001f3f]"
                  placeholder="Terms and conditions - late fees, payment methods, delivery schedule"
                />
              </div>
            </div>

            {/* Right Side - Totals */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[#3c8dbc]">Subtotal</span>
                <span className="font-medium text-[#001f3f]">AED {subtotal.toFixed(2)}</span>
              </div>
              {/* Tax */}
              {showTax ? (
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <span className="text-[#3c8dbc]">Tax</span>
                    <Input
                      type="number"
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number.parseFloat(e.target.value) || 0)}
                      className="w-16 h-8 text-center bg-[#f4f8fb] text-[#001f3f]"
                      min="0"
                      max="100"
                      step="0.01"
                    />
                    <span className="text-[#3c8dbc]">%</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 p-0 h-auto"
                      onClick={() => setShowTax(false)}
                      title="Remove Tax"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <span className="font-medium text-[#001f3f]">AED {taxAmount.toFixed(2)}</span>
                </div>
              ) : (
                <div className="flex justify-between items-center text-green-700">
                  <Button
                    variant="ghost"
                    className="text-green-700 p-0 h-auto"
                    onClick={() => setShowTax(true)}
                  >
                    + Tax
                  </Button>
                </div>
              )}
              {/* Discount */}
              {showDiscount ? (
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <span className="text-[#3c8dbc]">Discount</span>
                    <Input
                      type="number"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(Number.parseFloat(e.target.value) || 0)}
                      className="w-20 h-8 text-right bg-[#f4f8fb] text-[#001f3f]"
                      min="0"
                      step="0.01"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 p-0 h-auto"
                      onClick={() => setShowDiscount(false)}
                      title="Remove Discount"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <span className="font-medium text-[#001f3f]">- AED {discountAmount.toFixed(2)}</span>
                </div>
              ) : (
                <div className="flex justify-between items-center text-green-700">
                  <Button
                    variant="ghost"
                    className="text-green-700 p-0 h-auto"
                    onClick={() => setShowDiscount(true)}
                  >
                    + Discount
                  </Button>
                </div>
              )}

              {/* Shipping */}
              {showShipping ? (
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <span className="text-[#3c8dbc]">Shipping</span>
                    <Input
                      type="number"
                      value={shippingAmount}
                      onChange={(e) => setShippingAmount(Number.parseFloat(e.target.value) || 0)}
                      className="w-20 h-8 text-right bg-[#f4f8fb] text-[#001f3f]"
                      min="0"
                      step="0.01"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 p-0 h-auto"
                      onClick={() => setShowShipping(false)}
                      title="Remove Shipping"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <span className="font-medium text-[#001f3f]">+ AED {shippingAmount.toFixed(2)}</span>
                </div>
              ) : (
                <div className="flex justify-between items-center text-green-700">
                  <Button
                    variant="ghost"
                    className="text-green-700 p-0 h-auto"
                    onClick={() => setShowShipping(true)}
                  >
                    + Shipping
                  </Button>
                </div>
              )}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span className="text-[#001f3f]">Total</span>
                  <span className="text-[#001f3f]">AED {total.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <span className="text-[#3c8dbc]">Amount Paid</span>
                  <span className="text-sm text-[#3c8dbc]">AED</span>
                </div>
                <Input
                  type="number"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(Number.parseFloat(e.target.value) || 0)}
                  className="w-24 text-right bg-[#f4f8fb] text-[#001f3f]"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span className="text-[#001f3f]">Balance Due</span>
                  <span className="text-[#001f3f]">AED {balanceDue.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Hidden Printable Invoice for PDF */}
      <div
        id="print-invoice"
        style={{
          width: 800,
          margin: "0 auto",
          padding: 32,
          background: "#fff",
          color: "#222",
          fontFamily: "Arial, sans-serif",
          display: "none",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <div style={{ fontWeight: "bold", fontSize: 22 }}>{companyName}</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>{companyAddress}</div>
            <div style={{ fontSize: 13 }}>{companyEmail}</div>
            <div style={{ fontSize: 13 }}>{companyPhone}</div>
            <div style={{ fontSize: 13 }}>TRADE LICENSE: {tradeLicense}</div>
            <div style={{ fontSize: 13 }}>TDN: {tdn}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: "bold", fontSize: 32, color: "#3c8dbc" }}>INVOICE</div>
            <div style={{ fontSize: 15, marginTop: 16 }}>
              <span style={{ fontWeight: "bold" }}>#</span> {invoiceNumber}
            </div>
            <div style={{ fontSize: 13, marginTop: 8 }}>Date: {invoiceDate}</div>
            <div style={{ fontSize: 13 }}>Payment Terms: {paymentTerms}</div>
            <div style={{ fontSize: 13 }}>Due Date: {dueDate}</div>
            <div style={{ fontSize: 13 }}>PO Number: {poNumber}</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <div style={{ fontWeight: "bold", fontSize: 15, color: "#3c8dbc" }}>Bill To</div>
            <div style={{ fontSize: 13, marginTop: 8, whiteSpace: "pre-line" }}>{clientName}</div>
          </div>
          <div>
            <div style={{ fontWeight: "bold", fontSize: 15, color: "#3c8dbc" }}>Ship To</div>
            <div style={{ fontSize: 13, marginTop: 8, whiteSpace: "pre-line" }}>{shipTo}</div>
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
          <thead>
            <tr style={{ background: "#3c8dbc", color: "#fff" }}>
              <th style={{ padding: 8, textAlign: "left" }}>Item</th>
              <th style={{ padding: 8, textAlign: "center" }}>Quantity</th>
              <th style={{ padding: 8, textAlign: "center" }}>Rate</th>
              <th style={{ padding: 8, textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: 8 }}>{item.description}</td>
                <td style={{ padding: 8, textAlign: "center" }}>{item.quantity}</td>
                <td style={{ padding: 8, textAlign: "center" }}>AED {item.rate.toFixed(2)}</td>
                <td style={{ padding: 8, textAlign: "right" }}>AED {item.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <table style={{ width: 320, fontSize: 14 }}>
            <tbody>
              <tr>
                <td style={{ padding: "4px 8px" }}>Subtotal</td>
                <td style={{ padding: "4px 8px", textAlign: "right" }}>AED {subtotal.toFixed(2)}</td>
              </tr>
              {showTax && (
                <tr>
                  <td style={{ padding: "4px 8px" }}>Tax ({taxRate}%)</td>
                  <td style={{ padding: "4px 8px", textAlign: "right" }}>AED {taxAmount.toFixed(2)}</td>
                </tr>
              )}
              {showDiscount && (
                <tr>
                  <td style={{ padding: "4px 8px" }}>Discount</td>
                  <td style={{ padding: "4px 8px", textAlign: "right" }}>- AED {discountAmount.toFixed(2)}</td>
                </tr>
              )}
              {showShipping && (
                <tr>
                  <td style={{ padding: "4px 8px" }}>Shipping</td>
                  <td style={{ padding: "4px 8px", textAlign: "right" }}>+ AED {shippingAmount.toFixed(2)}</td>
                </tr>
              )}
              <tr style={{ fontWeight: "bold", fontSize: 16 }}>
                <td style={{ padding: "8px 8px", borderTop: "2px solid #3c8dbc" }}>Total</td>
                <td style={{ padding: "8px 8px", textAlign: "right", borderTop: "2px solid #3c8dbc" }}>AED {total.toFixed(2)}</td>
              </tr>
              <tr>
                <td style={{ padding: "4px 8px" }}>Amount Paid</td>
                <td style={{ padding: "4px 8px", textAlign: "right" }}>AED {amountPaid.toFixed(2)}</td>
              </tr>
              <tr style={{ fontWeight: "bold" }}>
                <td style={{ padding: "8px 8px", borderTop: "2px solid #3c8dbc" }}>Balance Due</td>
                <td style={{ padding: "8px 8px", textAlign: "right", borderTop: "2px solid #3c8dbc" }}>AED {balanceDue.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 32 }}>
          <div style={{ fontWeight: "bold", color: "#3c8dbc", marginBottom: 8 }}>Terms</div>
          <div style={{ fontSize: 13, whiteSpace: "pre-line" }}>{terms}</div>
        </div>
        <div style={{ marginTop: 32 }}>
          <div style={{ fontWeight: "bold", color: "#3c8dbc", marginBottom: 8 }}>Noted By</div>
          <div style={{ fontSize: 13 }}>{notedBy}</div>
        </div>
      </div>
    </div>
  )
}