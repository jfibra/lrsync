"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, FileSpreadsheet, Calendar, MapPin, Plus, Loader2 } from "lucide-react"
import { format } from "date-fns"
import type { Sales } from "@/types/sales"

interface CommissionGenerationModalProps {
  isOpen: boolean
  onClose: () => void
  selectedSales: Sales[]
  userArea?: string
  userFullName?: string
}

interface SearchResult {
  id: number
  name: string
  clientfamilyname: string
  clientAge: number
  clientAddress: string
  clientGender: string
  clientEmail: string
  clientMobile: string
  clientCountry: string
  unitnum: string
  developer: string
  devid: number
  dev_rental_id: number | null
  projectname: string
  projid: number
  prop_type_id: number
  qty: number
  tcprice: number
  compercent: string
  reservationdate: string
  termofpayment: string
  dateadded: string
  agentid: number
  statement_of_account: string | null
  bir_form_2307: string | null
  status: string
  requirements: string | null
  client_requirements: string | null
  partialclaimed: string
  remarks: string
  broker_com: string
  deleted: number
  dateupdated: string
  files: string
  userupdate: number
  unconfirm: number
  request_file: string | null
  validSale: string
  agentuploadpot: number
  logs: string
  prop_details: string
  comm_requested: number
  comm_requests_history: string | null
  file_uploaded_to: string | null
  created_at: string
  updated_at: string
}

interface CommissionRecord {
  no: number
  date: string
  developer: string
  agent: string
  client: string
  comm: number
  netOfVat: number
  status: string
  agentsRate: string
  agentVat: number
  ewt: number
  netComm: number
}

export function CommissionGenerationModal({
  isOpen,
  onClose,
  selectedSales,
  userArea,
  userFullName,
}: CommissionGenerationModalProps) {
  const [searchData, setSearchData] = useState({ agentName: "", clientName: "", year: "" })
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [commissionRecords, setCommissionRecords] = useState<Record<string, CommissionRecord[]>>({})

  // Generate year options (20 years back from current year)
  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear()
    const years = []
    for (let i = 0; i < 20; i++) {
      years.push(currentYear - i)
    }
    return years
  }

  const yearOptions = generateYearOptions()

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

  // Handle search input changes
  const handleSearchChange = (field: string, value: string) => {
    setSearchData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  // Perform search
  const handleSearch = async () => {
    setIsSearching(true)
    try {
      const params = new URLSearchParams()
      if (searchData.agentName) params.append("name", searchData.agentName)
      if (searchData.clientName) params.append("developer", searchData.clientName)
      if (searchData.year) params.append("year", searchData.year)

      const response = await fetch(`${process.env.NEXT_PUBLIC_NEXT_API_ROUTE_LR}/search-sales-report?${params}`)
      if (response.ok) {
        const results = await response.json()
        setSearchResults(results)
      } else {
        console.error("Search failed:", response.statusText)
        setSearchResults([])
      }
    } catch (error) {
      console.error("Search error:", error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // Add agent to commission table for specific tab
  const addAgentToTab = (tabKey: string, searchResult: SearchResult) => {
    const newRecord: CommissionRecord = {
      no: (commissionRecords[tabKey]?.length || 0) + 1,
      date: format(new Date(), "yyyy-MM-dd"),
      developer: searchResult.developer,
      agent: searchResult.name,
      client: searchResult.clientfamilyname,
      comm: searchResult.tcprice * 0.05, // 5% commission example
      netOfVat: (searchResult.tcprice * 0.05) / 1.12, // Net of VAT
      status: "Pending",
      agentsRate: "5%",
      agentVat: searchResult.tcprice * 0.05 * 0.12, // 12% VAT
      ewt: searchResult.tcprice * 0.05 * 0.12, // 12% EWT example
      netComm: (searchResult.tcprice * 0.05) / 1.12 - searchResult.tcprice * 0.05 * 0.12,
    }

    setCommissionRecords((prev) => ({
      ...prev,
      [tabKey]: [...(prev[tabKey] || []), newRecord],
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

  // Clear search results when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchResults([])
      setCommissionRecords({})
    }
  }, [isOpen])

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
                      <Select value={searchData.year} onValueChange={(value) => handleSearchChange("year", value)}>
                        <SelectTrigger className="border-gray-300 focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] bg-white">
                          <SelectValue placeholder="Select year..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="all">All Years</SelectItem>
                          {yearOptions.map((year) => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button
                        className="bg-[#001f3f] text-white hover:bg-[#001f3f]/90 w-full"
                        onClick={handleSearch}
                        disabled={isSearching}
                      >
                        {isSearching ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4 mr-2" />
                        )}
                        Search
                      </Button>
                    </div>
                  </div>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="mt-4 border-t border-gray-200 pt-4">
                      <h4 className="text-sm font-medium text-[#001f3f] mb-3">
                        Search Results ({searchResults.length})
                      </h4>
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {searchResults.map((result) => (
                          <div
                            key={result.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-[#001f3f]">{result.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  Agent
                                </Badge>
                              </div>
                              <div className="text-sm text-[#001f3f] mt-1">
                                Client: {result.clientfamilyname} | Developer: {result.developer}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                Project: {result.projectname} | Unit: {result.unitnum} | TCP:{" "}
                                {formatCurrency(result.tcprice)}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {Object.keys(groupedByDeveloperAndInvoice).map((tabKey) => (
                                <Button
                                  key={tabKey}
                                  size="sm"
                                  onClick={() => addAgentToTab(tabKey, result)}
                                  className="bg-[#001f3f] text-white hover:bg-[#001f3f]/90"
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add to {groupedByDeveloperAndInvoice[tabKey].invoiceNumber}
                                </Button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isSearching && (
                    <div className="mt-4 text-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#001f3f]" />
                      <p className="text-sm text-[#001f3f] mt-2">Searching...</p>
                    </div>
                  )}

                  {searchResults.length === 0 &&
                    !isSearching &&
                    (searchData.agentName || searchData.clientName || searchData.year) && (
                      <div className="mt-4 text-center py-4">
                        <p className="text-sm text-gray-500">No results found. Try adjusting your search criteria.</p>
                      </div>
                    )}
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
                  const tabCommissionRecords = commissionRecords[key] || []
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
                                {tabCommissionRecords.length > 0 ? (
                                  tabCommissionRecords.map((record, index) => (
                                    <TableRow key={index} className="border-b border-gray-100 hover:bg-gray-50">
                                      <TableCell className="text-center font-medium text-[#001f3f]">
                                        {record.no}
                                      </TableCell>
                                      <TableCell className="text-[#001f3f]">
                                        {format(new Date(record.date), "MMM dd, yyyy")}
                                      </TableCell>
                                      <TableCell className="font-medium text-[#001f3f]">{record.developer}</TableCell>
                                      <TableCell className="text-[#001f3f]">{record.agent}</TableCell>
                                      <TableCell className="text-[#001f3f]">{record.client}</TableCell>
                                      <TableCell className="text-right font-semibold text-[#001f3f]">
                                        {formatCurrency(record.comm)}
                                      </TableCell>
                                      <TableCell className="text-right font-semibold text-[#001f3f]">
                                        {formatCurrency(record.netOfVat)}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <span
                                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            record.status === "Paid"
                                              ? "bg-green-100 text-green-800"
                                              : "bg-yellow-100 text-yellow-800"
                                          }`}
                                        >
                                          {record.status}
                                        </span>
                                      </TableCell>
                                      <TableCell className="text-center font-medium text-[#dee242]">
                                        {record.agentsRate}
                                      </TableCell>
                                      <TableCell className="text-right font-semibold text-[#001f3f]">
                                        {formatCurrency(record.agentVat)}
                                      </TableCell>
                                      <TableCell className="text-right font-semibold text-[#ee3433]">
                                        {formatCurrency(record.ewt)}
                                      </TableCell>
                                      <TableCell className="text-right font-bold text-[#dee242]">
                                        {formatCurrency(record.netComm)}
                                      </TableCell>
                                    </TableRow>
                                  ))
                                ) : (
                                  <TableRow>
                                    <TableCell colSpan={12} className="text-center text-gray-400 py-8">
                                      No commission records added yet. Use the search above to add agents.
                                    </TableCell>
                                  </TableRow>
                                )}
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
