"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, FileSpreadsheet, Calendar, MapPin } from "lucide-react"
import { format } from "date-fns"
import type { Sales } from "@/types/sales"

interface CommissionGenerationModalProps {
  isOpen: boolean
  onClose: () => void
  selectedSales: Sales[]
  userArea?: string
  userFullName?: string
}

export function CommissionGenerationModal({
  isOpen,
  onClose,
  selectedSales,
  userArea,
  userFullName,
}: CommissionGenerationModalProps) {
  const [searchData, setSearchData] = useState({ agentName: "", clientName: "", year: "" })

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount)
  }

  // Format TIN display - add dash after every 3 digits
  const formatTin = (tin: string) => {
    const digits = tin.replace(/\D/g, "")
    return digits.replace(/(\d{3})(?=\d)/g, "$1-")
  }

  // Group selected sales by developer name and invoice number
  const groupedByDeveloperAndInvoice = selectedSales.reduce(
    (acc, sale) => {
      const developerId = sale.user_uuid
      const developerName = sale.name || "Unknown Developer"
      const invoiceNumber = sale.invoice_number || "N/A"
      const key = `${developerId}-${invoiceNumber}`

      if (!acc[key]) {
        acc[key] = {
          developerId,
          developerName,
          invoiceNumber,
          sales: [],
        }
      }
      acc[key].sales.push(sale)
      return acc
    },
    {} as Record<string, { developerId: string; developerName: string; invoiceNumber: string; sales: Sales[] }>,
  )

  // Generate mock commission data for each developer/invoice combination
  const generateMockData = (developerId: string, invoiceNumber: string, salesRecords: Sales[]) => {
    const mockData = [
      {
        no: 1,
        date: "2025-01-15",
        developer: `Developer ${developerId.slice(-4)}`,
        agent: "Maria Santos",
        client: "ABC Corporation",
        comm: 15000,
        netOfVat: 13392.86,
        status: "Paid",
        agentsRate: "5%",
        agentVat: 1607.14,
        ewt: 1800,
        netComm: 11592.86,
      },
      {
        no: 2,
        date: "2025-01-18",
        developer: `Developer ${developerId.slice(-4)}`,
        agent: "Carlos Rodriguez",
        client: "XYZ Industries",
        comm: 22000,
        netOfVat: 19642.86,
        status: "Pending",
        agentsRate: "5%",
        agentVat: 2357.14,
        ewt: 2640,
        netComm: 17002.86,
      },
      {
        no: 3,
        date: "2025-01-20",
        developer: `Developer ${developerId.slice(-4)}`,
        agent: "Ana Reyes",
        client: "Global Tech Solutions",
        comm: 18500,
        netOfVat: 16517.86,
        status: "Paid",
        agentsRate: "5%",
        agentVat: 1982.14,
        ewt: 2220,
        netComm: 14297.86,
      },
    ]

    return mockData
  }

  // Handle search input changes
  const handleSearchChange = (field: string, value: string) => {
    setSearchData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  // Get tax type badge color
  const getTaxTypeBadgeColor = (taxType: string) => {
    switch (taxType) {
      case "vat":
        return "bg-blue-50 text-blue-800 border border-blue-200"
      case "non-vat":
        return "bg-green-50 text-green-800 border border-green-200"
      default:
        return "bg-gray-50 text-gray-800 border border-gray-200"
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-hidden bg-white">
        <DialogHeader className="border-b border-gray-200 pb-4">
          <DialogTitle className="text-2xl font-bold text-[#001f3f]">
            Generate Commission {userArea && `(${userArea})`} - {format(new Date(), "MMMM dd, yyyy")} -{" "}
            {userFullName || "User"}
          </DialogTitle>
          <p className="text-[#001f3f] mt-1">Commission breakdown for selected developers</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto max-h-[calc(95vh-200px)]">
          {Object.keys(groupedByDeveloperAndInvoice).length === 0 ? (
            <div className="text-center py-12">
              <div className="text-[#001f3f] text-lg font-medium mb-2">No developers selected</div>
              <div className="text-[#001f3f] text-sm">Please select sales records to generate commission reports</div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Search Card - Outside of Tabs */}
              <Card className="border border-gray-200 shadow-sm bg-white">
                <CardHeader className="bg-gray-50 border-b border-gray-200 py-3">
                  <CardTitle className="text-lg font-semibold text-[#001f3f] flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    Search Commission Records
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#001f3f] mb-1">Agent Name</label>
                      <Input
                        placeholder="Enter agent name..."
                        value={searchData.agentName}
                        onChange={(e) => handleSearchChange("agentName", e.target.value)}
                        className="border-gray-300 focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#001f3f] mb-1">Client Name</label>
                      <Input
                        placeholder="Enter client name..."
                        value={searchData.clientName}
                        onChange={(e) => handleSearchChange("clientName", e.target.value)}
                        className="border-gray-300 focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#001f3f] mb-1">Year</label>
                      <Input
                        placeholder="Enter year..."
                        value={searchData.year}
                        onChange={(e) => handleSearchChange("year", e.target.value)}
                        className="border-gray-300 focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] bg-white"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        className="bg-[#001f3f] text-white hover:bg-[#001f3f]/90 w-full"
                        onClick={() => {
                          // Search functionality will be implemented later
                          console.log("Search clicked:", searchData)
                        }}
                      >
                        <Search className="h-4 w-4 mr-2" />
                        Search
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tabs for Developer/Invoice Combinations */}
              <Tabs defaultValue={Object.keys(groupedByDeveloperAndInvoice)[0]} className="bg-white">
                <TabsList className="flex flex-row w-full overflow-x-auto bg-gray-50 border border-gray-200 mb-4">
                  {Object.entries(groupedByDeveloperAndInvoice).map(([key, group]) => (
                    <TabsTrigger
                      key={key}
                      value={key}
                      className="data-[state=active]:bg-[#001f3f] data-[state=active]:text-white text-[#001f3f] font-medium px-4 py-2 bg-white whitespace-nowrap"
                    >
                      Invoice # {group.invoiceNumber} - {group.developerName}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {Object.entries(groupedByDeveloperAndInvoice).map(([key, group]) => {
                  const mockData = generateMockData(group.developerId, group.invoiceNumber, group.sales)
                  const firstSale = group.sales[0] // Use first sale for display details

                  return (
                    <TabsContent key={key} value={key} className="mt-0 space-y-4 bg-white">
                      {/* Sale Record Details Card */}
                      <Card className="border border-gray-200 shadow-sm bg-white">
                        <CardHeader className="bg-gray-50 border-b border-gray-200 py-3">
                          <CardTitle className="text-lg font-semibold text-[#001f3f]">
                            Sale Record Details - Invoice # {group.invoiceNumber}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 bg-white">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-[#001f3f]" />
                                <span className="text-sm font-medium text-[#001f3f]">Tax Month:</span>
                                <span className="text-sm text-[#001f3f]">
                                  {format(new Date(firstSale.tax_month), "MMM yyyy")}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-[#001f3f]">TIN:</span>
                                <span className="text-sm font-mono text-[#001f3f]">{formatTin(firstSale.tin)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-[#001f3f]">Name:</span>
                                <span className="text-sm text-[#001f3f]">{firstSale.name}</span>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-[#001f3f]">Tax Type:</span>
                                <Badge className={getTaxTypeBadgeColor(firstSale.tax_type)}>
                                  {firstSale.tax_type?.toUpperCase()}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-[#001f3f]">Sale Type:</span>
                                <Badge
                                  className={
                                    firstSale.sale_type === "invoice"
                                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                      : "bg-orange-50 text-orange-800 border border-orange-200"
                                  }
                                >
                                  {firstSale.sale_type?.toUpperCase() || "INVOICE"}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-[#001f3f]">Gross Taxable:</span>
                                <span className="text-sm font-semibold text-[#001f3f]">
                                  {formatCurrency(firstSale.gross_taxable || 0)}
                                </span>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-[#001f3f]">Total Actual Amount:</span>
                                <span className="text-sm font-semibold text-[#001f3f]">
                                  {formatCurrency(firstSale.total_actual_amount || 0)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-[#001f3f]">Invoice #:</span>
                                <span className="text-sm text-[#001f3f]">{firstSale.invoice_number || "N/A"}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-[#001f3f]">Pickup Date:</span>
                                <span className="text-sm text-[#001f3f]">
                                  {firstSale.pickup_date
                                    ? format(new Date(firstSale.pickup_date), "MMM dd, yyyy")
                                    : "N/A"}
                                </span>
                              </div>
                            </div>

                            <div className="space-y-2 md:col-span-2 lg:col-span-3">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-[#001f3f]" />
                                <span className="text-sm font-medium text-[#001f3f]">Area:</span>
                                <span className="text-sm bg-gray-100 px-2 py-1 rounded text-[#001f3f]">
                                  {firstSale.user_assigned_area || "N/A"}
                                </span>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="text-sm font-medium text-[#001f3f]">Files:</span>
                                <div className="flex flex-wrap gap-1">
                                  {firstSale.cheque && firstSale.cheque.length > 0 && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 px-2 py-1 rounded-lg shadow-sm"
                                    >
                                      Cheque ({firstSale.cheque.length})
                                    </Badge>
                                  )}
                                  {firstSale.voucher && firstSale.voucher.length > 0 && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs font-semibold bg-green-50 text-green-800 border border-green-200 px-2 py-1 rounded-lg shadow-sm"
                                    >
                                      Voucher ({firstSale.voucher.length})
                                    </Badge>
                                  )}
                                  {firstSale.invoice && firstSale.invoice.length > 0 && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs font-semibold bg-green-50 text-green-800 border border-green-200 px-2 py-1 rounded-lg shadow-sm"
                                    >
                                      Invoice ({firstSale.invoice.length})
                                    </Badge>
                                  )}
                                  {firstSale.doc_2307 && firstSale.doc_2307.length > 0 && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs font-semibold bg-gray-50 text-gray-800 border border-gray-200 px-2 py-1 rounded-lg shadow-sm"
                                    >
                                      2307 ({firstSale.doc_2307.length})
                                    </Badge>
                                  )}
                                  {firstSale.deposit_slip && firstSale.deposit_slip.length > 0 && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs font-semibold bg-green-50 text-green-800 border border-green-200 px-2 py-1 rounded-lg shadow-sm"
                                    >
                                      Deposit ({firstSale.deposit_slip.length})
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Commission Table */}
                      <Card className="border border-gray-200 shadow-sm bg-white">
                        <CardHeader className="bg-gray-50 border-b border-gray-200 py-3">
                          <CardTitle className="text-lg font-semibold text-[#001f3f]">
                            Commission Records - Invoice # {group.invoiceNumber}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 bg-white">
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-gray-50 border-b border-gray-200">
                                  <TableHead className="font-semibold text-[#001f3f] text-center">NO.</TableHead>
                                  <TableHead className="font-semibold text-[#001f3f]">DATE</TableHead>
                                  <TableHead className="font-semibold text-[#001f3f]">DEVELOPER</TableHead>
                                  <TableHead className="font-semibold text-[#001f3f]">AGENT</TableHead>
                                  <TableHead className="font-semibold text-[#001f3f]">CLIENT</TableHead>
                                  <TableHead className="font-semibold text-[#001f3f] text-right">COMM</TableHead>
                                  <TableHead className="font-semibold text-[#001f3f] text-right">Net of VAT</TableHead>
                                  <TableHead className="font-semibold text-[#001f3f] text-center">STATUS</TableHead>
                                  <TableHead className="font-semibold text-[#001f3f] text-center">
                                    AGENT'S RATE
                                  </TableHead>
                                  <TableHead className="font-semibold text-[#001f3f] text-right">AGENT VAT</TableHead>
                                  <TableHead className="font-semibold text-[#001f3f] text-right">EWT</TableHead>
                                  <TableHead className="font-semibold text-[#001f3f] text-right">NET COMM</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody className="bg-white">
                                {/* Empty table body for now, keep all columns */}
                                <TableRow>
                                  <TableCell colSpan={12} className="text-center text-gray-400 py-8">
                                    No commission records available.
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Hidden inputs for storing sales record data */}
                      <div className="hidden">
                        {group.sales.map((sale, index) => (
                          <div key={`${key}-${index}`}>
                            <input type="hidden" name={`sales[${key}][${index}][id]`} value={sale.id} />
                            <input type="hidden" name={`sales[${key}][${index}][tin]`} value={sale.tin} />
                            <input type="hidden" name={`sales[${key}][${index}][name]`} value={sale.name} />
                            <input type="hidden" name={`sales[${key}][${index}][tax_type]`} value={sale.tax_type} />
                            <input
                              type="hidden"
                              name={`sales[${key}][${index}][gross_taxable]`}
                              value={sale.gross_taxable || 0}
                            />
                            <input
                              type="hidden"
                              name={`sales[${key}][${index}][total_actual_amount]`}
                              value={sale.total_actual_amount || 0}
                            />
                            <input
                              type="hidden"
                              name={`sales[${key}][${index}][invoice_number]`}
                              value={sale.invoice_number || ""}
                            />
                            <input type="hidden" name={`sales[${key}][${index}][tax_month]`} value={sale.tax_month} />
                            <input
                              type="hidden"
                              name={`sales[${key}][${index}][pickup_date]`}
                              value={sale.pickup_date || ""}
                            />
                            <input type="hidden" name={`sales[${key}][${index}][user_uuid]`} value={sale.user_uuid} />
                            <input
                              type="hidden"
                              name={`sales[${key}][${index}][user_assigned_area]`}
                              value={sale.user_assigned_area || ""}
                            />
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  )
                })}
              </Tabs>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 bg-white">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-[#001f3f] text-[#001f3f] hover:bg-[#001f3f] hover:text-white bg-white"
          >
            Close
          </Button>
          <Button
            className="bg-[#001f3f] text-white hover:bg-[#001f3f]/90"
            disabled={Object.keys(groupedByDeveloperAndInvoice).length === 0}
            onClick={() => {
              // Excel generation functionality will be implemented later
              console.log("Generate Commission Report To Excel clicked")
            }}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Generate Commission Report To Excel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
