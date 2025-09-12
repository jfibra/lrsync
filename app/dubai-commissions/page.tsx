"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, Download, RefreshCw } from "lucide-react"
import { format } from "date-fns"

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

  // Invoice items
  const [items, setItems] = useState<InvoiceItem[]>([
    {
      id: "1",
      description: "COMMISSION",
      quantity: 1,
      rate: 8500,
      amount: 8500,
    },
  ])

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

  const generatePDF = () => {
    // This would integrate with a PDF generation library
    alert("PDF generation would be implemented here")
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gray-50 border-b px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-blue-900 text-white px-4 py-2 rounded font-bold text-lg">FHI Global Property</div>
          </div>
          <div className="flex items-center space-x-4">
            <Button onClick={generatePDF} className="bg-green-600 hover:bg-green-700">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white border rounded-lg shadow-sm p-8">
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
                className="w-96 h-32 border-gray-300 text-sm resize-none"
              />
            </div>
            <div className="text-right space-y-4">
              <div className="flex items-center space-x-2">
                <span className="text-3xl font-bold">INVOICE</span>
                <div className="flex items-center space-x-2">
                  <span className="text-lg">#</span>
                  <Input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-20 text-center"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <Label className="text-sm text-gray-600">Date</Label>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div>
                  <Label className="text-sm text-gray-600">Payment Terms</Label>
                  <Input
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-40"
                    placeholder="Net 30"
                  />
                </div>
                <div>
                  <Label className="text-sm text-gray-600">Due Date</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-40" />
                </div>
                <div>
                  <Label className="text-sm text-gray-600">PO Number</Label>
                  <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className="w-40" />
                </div>
              </div>
            </div>
          </div>

          {/* To and Ship To Section */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">To</Label>
              <Textarea
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full h-24 resize-none"
                placeholder="Who is this invoice to?"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">Ship To</Label>
              <Textarea
                value={shipTo}
                onChange={(e) => setShipTo(e.target.value)}
                className="w-full h-24 resize-none"
                placeholder="(optional)"
              />
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-8">
            <div className="bg-blue-900 text-white px-4 py-3 grid grid-cols-12 gap-4 rounded-t">
              <div className="col-span-6 font-medium">Item</div>
              <div className="col-span-2 font-medium text-center">Quantity</div>
              <div className="col-span-2 font-medium text-center">Rate</div>
              <div className="col-span-2 font-medium text-right">Amount</div>
            </div>
            <div className="border-l border-r border-b">
              {items.map((item, index) => (
                <div key={item.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-b-0 items-center">
                  <div className="col-span-6">
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(item.id, "description", e.target.value)}
                      placeholder="Description of service or product..."
                      className="border-0 shadow-none p-0 h-auto"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, "quantity", Number.parseFloat(e.target.value) || 0)}
                      className="text-center border-0 shadow-none p-0 h-auto"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="col-span-2 flex items-center">
                    <span className="text-sm mr-1">AED</span>
                    <Input
                      type="number"
                      value={item.rate}
                      onChange={(e) => updateItem(item.id, "rate", Number.parseFloat(e.target.value) || 0)}
                      className="border-0 shadow-none p-0 h-auto"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="font-medium">AED {item.amount.toFixed(2)}</span>
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
              className="mt-4 text-green-600 border-green-600 hover:bg-green-50 bg-transparent"
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
                <Label className="text-sm font-medium text-gray-700 mb-2 block">Noted By:</Label>
                <Input value={notedBy} onChange={(e) => setNotedBy(e.target.value)} className="w-full" />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">Terms</Label>
                <Textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="w-full h-32 resize-none text-sm"
                  placeholder="Terms and conditions - late fees, payment methods, delivery schedule"
                />
              </div>
            </div>

            {/* Right Side - Totals */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>Subtotal</span>
                <span className="font-medium">AED {subtotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <span>Tax</span>
                  <Input
                    type="number"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number.parseFloat(e.target.value) || 0)}
                    className="w-16 h-8 text-center"
                    min="0"
                    max="100"
                    step="0.01"
                  />
                  <span>%</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </div>
                <span className="font-medium">AED {taxAmount.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center text-green-600">
                <Button variant="ghost" className="text-green-600 p-0 h-auto">
                  + Discount
                </Button>
              </div>

              <div className="flex justify-between items-center text-green-600">
                <Button variant="ghost" className="text-green-600 p-0 h-auto">
                  + Shipping
                </Button>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Total</span>
                  <span>AED {total.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <span>Amount Paid</span>
                  <span className="text-sm">AED</span>
                </div>
                <Input
                  type="number"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(Number.parseFloat(e.target.value) || 0)}
                  className="w-24 text-right"
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Balance Due</span>
                  <span>AED {balanceDue.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
