"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, Download } from "lucide-react"
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
  const [dueDate, setDueDate] = useState("")

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
  const [clientAddress, setClientAddress] = useState("")
  const [clientEmail, setClientEmail] = useState("")
  const [clientPhone, setClientPhone] = useState("")

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
  const [currency, setCurrency] = useState("AED")

  // Payment details (defaults from PDF)
  const [paymentDetails, setPaymentDetails] = useState("Bank Transfer")
  const [bankName, setBankName] = useState("WIO")
  const [accountName, setAccountName] = useState("FHI Global Property LLC")
  const [accountNumber, setAccountNumber] = useState("9185994189")
  const [iban, setIban] = useState("AE900860000009185994189")
  const [swift, setSwift] = useState("WIOBAEADXXX")

  // Notes
  const [notes, setNotes] = useState("Noted By: ANTHONY GERARD LEUTERIO")
  const [terms, setTerms] = useState("")

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0)
  const taxAmount = (subtotal * taxRate) / 100
  const total = subtotal + taxAmount

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
    // For now, we'll just show an alert
    alert("PDF generation would be implemented here")
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dubai Commission Invoice Generator</h1>
          <p className="text-gray-600">Create professional invoices for Dubai commissions</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form Section */}
          <div className="space-y-6">
            {/* Invoice Details */}
            <Card>
              <CardHeader>
                <CardTitle>Invoice Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="invoiceNumber">Invoice Number</Label>
                    <Input
                      id="invoiceNumber"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="currency">Currency</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AED">AED</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="invoiceDate">Invoice Date</Label>
                    <Input
                      id="invoiceDate"
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Company Details */}
            <Card>
              <CardHeader>
                <CardTitle>From (Your Company)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tradeLicense">Trade License</Label>
                    <Input id="tradeLicense" value={tradeLicense} onChange={(e) => setTradeLicense(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="tdn">TDN</Label>
                    <Input id="tdn" value={tdn} onChange={(e) => setTdn(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="companyAddress">Address</Label>
                  <Textarea
                    id="companyAddress"
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="companyEmail">Email</Label>
                    <Input
                      id="companyEmail"
                      type="email"
                      value={companyEmail}
                      onChange={(e) => setCompanyEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="companyPhone">Phone</Label>
                    <Input id="companyPhone" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Client Details */}
            <Card>
              <CardHeader>
                <CardTitle>To (Client)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="clientName">Client Name</Label>
                  <Input id="clientName" value={clientName} onChange={(e) => setClientName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="clientAddress">Address</Label>
                  <Textarea
                    id="clientAddress"
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="clientEmail">Email</Label>
                    <Input
                      id="clientEmail"
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="clientPhone">Phone</Label>
                    <Input id="clientPhone" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Invoice Items */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Invoice Items
                  <Button onClick={addItem} size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Item
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {items.map((item, index) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        <Label>Description</Label>
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(item.id, "description", e.target.value)}
                          placeholder="Item description"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>Qty</Label>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, "quantity", Number.parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>Rate</Label>
                        <Input
                          type="number"
                          value={item.rate}
                          onChange={(e) => updateItem(item.id, "rate", Number.parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>Amount</Label>
                        <Input type="number" value={item.amount.toFixed(2)} readOnly className="bg-gray-50" />
                      </div>
                      <div className="col-span-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeItem(item.id)}
                          disabled={items.length === 1}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Tax and Payment Details */}
            <Card>
              <CardHeader>
                <CardTitle>Tax & Payment Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="taxRate">Tax Rate (%)</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number.parseFloat(e.target.value) || 0)}
                    min="0"
                    max="100"
                    step="0.01"
                  />
                </div>
                <div>
                  <Label htmlFor="paymentDetails">Payment Method</Label>
                  <Input
                    id="paymentDetails"
                    value={paymentDetails}
                    onChange={(e) => setPaymentDetails(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="bankName">Bank Name</Label>
                    <Input id="bankName" value={bankName} onChange={(e) => setBankName(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="accountName">Account Name</Label>
                    <Input id="accountName" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="accountNumber">Account Number</Label>
                    <Input
                      id="accountNumber"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="iban">IBAN</Label>
                    <Input id="iban" value={iban} onChange={(e) => setIban(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="swift">SWIFT Code</Label>
                  <Input id="swift" value={swift} onChange={(e) => setSwift(e.target.value)} />
                </div>
              </CardContent>
            </Card>

            {/* Notes and Terms */}
            <Card>
              <CardHeader>
                <CardTitle>Notes & Terms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                </div>
                <div>
                  <Label htmlFor="terms">Terms & Conditions</Label>
                  <Textarea id="terms" value={terms} onChange={(e) => setTerms(e.target.value)} rows={3} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview Section */}
          <div className="lg:sticky lg:top-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Invoice Preview
                  <Button onClick={generatePDF} className="bg-blue-600 hover:bg-blue-700">
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-white p-6 border rounded-lg shadow-sm">
                  {/* Invoice Header */}
                  <div className="mb-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">INVOICE</h2>
                        <p className="text-lg font-semibold">#{invoiceNumber}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Date: {format(new Date(invoiceDate), "MMM dd, yyyy")}</p>
                        {dueDate && (
                          <p className="text-sm text-gray-600">Due: {format(new Date(dueDate), "MMM dd, yyyy")}</p>
                        )}
                        <p className="text-lg font-semibold text-blue-600">
                          {currency} {total.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Company Details */}
                  <div className="mb-6">
                    <h3 className="font-semibold text-gray-900 mb-2">{companyName}</h3>
                    <p className="text-sm text-gray-600">TRADE LICENSE: {tradeLicense}</p>
                    <p className="text-sm text-gray-600">TDN: {tdn}</p>
                    <p className="text-sm text-gray-600">ADDRESS: {companyAddress}</p>
                    <p className="text-sm text-gray-600">Email: {companyEmail}</p>
                    <p className="text-sm text-gray-600">Phone: {companyPhone}</p>
                  </div>

                  {/* Client Details */}
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-900 mb-2">To:</h4>
                    <p className="text-sm text-gray-900 font-medium">{clientName}</p>
                    {clientAddress && <p className="text-sm text-gray-600">{clientAddress}</p>}
                    {clientEmail && <p className="text-sm text-gray-600">{clientEmail}</p>}
                    {clientPhone && <p className="text-sm text-gray-600">{clientPhone}</p>}
                  </div>

                  {/* Items Table */}
                  <div className="mb-6">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Item</th>
                          <th className="text-right py-2">Quantity</th>
                          <th className="text-right py-2">Rate</th>
                          <th className="text-right py-2">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id} className="border-b">
                            <td className="py-2">{item.description}</td>
                            <td className="text-right py-2">{item.quantity}</td>
                            <td className="text-right py-2">
                              {currency} {item.rate.toFixed(2)}
                            </td>
                            <td className="text-right py-2">
                              {currency} {item.amount.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="mb-6">
                    <div className="flex justify-end">
                      <div className="w-64">
                        <div className="flex justify-between py-1">
                          <span>Subtotal:</span>
                          <span>
                            {currency} {subtotal.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span>Tax ({taxRate}%):</span>
                          <span>
                            {currency} {taxAmount.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-t font-semibold">
                          <span>Total:</span>
                          <span>
                            {currency} {total.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {notes && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 whitespace-pre-line">{notes}</p>
                    </div>
                  )}

                  {/* Payment Details */}
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Payment Details:</h4>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Payment Method: {paymentDetails}</p>
                      <p>Bank Name: {bankName}</p>
                      <p>Bank Account Name: {accountName}</p>
                      <p>Account Number: {accountNumber}</p>
                      <p>IBAN: {iban}</p>
                      <p>SWIFT: {swift}</p>
                    </div>
                  </div>

                  {/* Terms */}
                  {terms && (
                    <div className="text-sm text-gray-600">
                      <h4 className="font-semibold text-gray-900 mb-2">Terms:</h4>
                      <p className="whitespace-pre-line">{terms}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
