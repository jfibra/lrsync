"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, FileSpreadsheet } from "lucide-react"
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
  const [searchData, setSearchData] = useState<Record<string, { agentName: string; clientName: string; year: string }>>(
    {},
  )

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount)
  }

  // Group selected sales by developer (user_uuid)
  const groupedByDeveloper = selectedSales.reduce(
    (acc, sale) => {
      const developerId = sale.user_uuid
      if (!acc[developerId]) {
        acc[developerId] = []
      }
      acc[developerId].push(sale)
      return acc
    },
    {} as Record<string, Sales[]>,
  )

  // Generate mock commission data for each developer
  const generateMockData = (developerId: string, salesRecords: Sales[]) => {
    const mockData = [
      {
        no: 1,
        date: "2025-01-15",
        developer: "John Smith",
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
        developer: "John Smith",
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
        developer: "John Smith",
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

    return mockData.map((item, index) => ({
      ...item,
      no: index + 1,
      developer: `Developer ${developerId.slice(-4)}`, // Use last 4 chars of developer ID
    }))
  }

  // Handle search input changes
  const handleSearchChange = (developerId: string, field: string, value: string) => {
    setSearchData((prev) => ({
      ...prev,
      [developerId]: {
        ...prev[developerId],
        [field]: value,
      },
    }))
  }

  // Get search data for a developer
  const getSearchData = (developerId: string) => {
    return searchData[developerId] || { agentName: "", clientName: "", year: "" }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-hidden bg-white">
        <DialogHeader className="border-b border-gray-200 pb-4">
          <DialogTitle className="text-2xl font-bold text-[#001f3f]">
            Generate Commission {userArea && `(${userArea})`} - {format(new Date(), "MMMM dd, yyyy")} -{" "}
            {userFullName || "User"}
          </DialogTitle>
          <p className="text-[#555555] mt-1">Commission breakdown for selected developers</p>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {Object.keys(groupedByDeveloper).length === 0 ? (
            <div className="text-center py-12">
              <div className="text-[#555555] text-lg font-medium mb-2">No developers selected</div>
              <div className="text-[#555555] text-sm">Please select sales records to generate commission reports</div>
            </div>
          ) : (
            <Tabs defaultValue={Object.keys(groupedByDeveloper)[0]} className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-auto bg-[#f9f9f9] border border-gray-200 mb-4">
                {Object.entries(groupedByDeveloper).map(([developerId, developerSales]) => (
                  <TabsTrigger
                    key={developerId}
                    value={developerId}
                    className="data-[state=active]:bg-[#001f3f] data-[state=active]:text-white text-[#001f3f] font-medium px-4 py-2"
                  >
                    Developer {developerId.slice(-4)}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="flex-1 overflow-auto">
                {Object.entries(groupedByDeveloper).map(([developerId, developerSales]) => {
                  const mockData = generateMockData(developerId, developerSales)
                  const searchValues = getSearchData(developerId)

                  return (
                    <TabsContent key={developerId} value={developerId} className="mt-0 space-y-4">
                      {/* Search Card */}
                      <Card className="border border-gray-200 shadow-sm">
                        <CardHeader className="bg-[#f9f9f9] border-b border-gray-200 py-3">
                          <CardTitle className="text-lg font-semibold text-[#001f3f] flex items-center gap-2">
                            <Search className="h-5 w-5" />
                            Search Commission Records
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-[#001f3f] mb-1">Agent Name</label>
                              <Input
                                placeholder="Enter agent name..."
                                value={searchValues.agentName}
                                onChange={(e) => handleSearchChange(developerId, "agentName", e.target.value)}
                                className="border-gray-300 focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f]"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-[#001f3f] mb-1">Client Name</label>
                              <Input
                                placeholder="Enter client name..."
                                value={searchValues.clientName}
                                onChange={(e) => handleSearchChange(developerId, "clientName", e.target.value)}
                                className="border-gray-300 focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f]"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-[#001f3f] mb-1">Year</label>
                              <Input
                                placeholder="Enter year..."
                                value={searchValues.year}
                                onChange={(e) => handleSearchChange(developerId, "year", e.target.value)}
                                className="border-gray-300 focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f]"
                              />
                            </div>
                            <div className="flex items-end">
                              <Button
                                className="bg-[#001f3f] text-white hover:bg-[#001f3f]/90 w-full"
                                onClick={() => {
                                  // Search functionality will be implemented later
                                  console.log("Search clicked for developer:", developerId, searchValues)
                                }}
                              >
                                <Search className="h-4 w-4 mr-2" />
                                Search
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Commission Table */}
                      <Card className="border border-gray-200 shadow-sm">
                        <CardHeader className="bg-[#f9f9f9] border-b border-gray-200 py-3">
                          <CardTitle className="text-lg font-semibold text-[#001f3f]">
                            Commission Records - Developer {developerId.slice(-4)}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-[#f9f9f9] border-b border-gray-200">
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
                              <TableBody>
                                {mockData.map((record, index) => (
                                  <TableRow key={index} className="border-b border-gray-100 hover:bg-gray-50">
                                    <TableCell className="text-center font-medium text-[#001f3f]">
                                      {record.no}
                                    </TableCell>
                                    <TableCell className="text-[#555555]">
                                      {format(new Date(record.date), "MMM dd, yyyy")}
                                    </TableCell>
                                    <TableCell className="font-medium text-[#001f3f]">{record.developer}</TableCell>
                                    <TableCell className="text-[#555555]">{record.agent}</TableCell>
                                    <TableCell className="text-[#555555]">{record.client}</TableCell>
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
                                    <TableCell className="text-right font-semibold text-[#555555]">
                                      {formatCurrency(record.agentVat)}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold text-[#ee3433]">
                                      {formatCurrency(record.ewt)}
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-[#dee242]">
                                      {formatCurrency(record.netComm)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Hidden inputs for storing sales record data */}
                      <div className="hidden">
                        {developerSales.map((sale, index) => (
                          <div key={`${developerId}-${index}`}>
                            <input type="hidden" name={`sales[${developerId}][${index}][id]`} value={sale.id} />
                            <input type="hidden" name={`sales[${developerId}][${index}][tin]`} value={sale.tin} />
                            <input type="hidden" name={`sales[${developerId}][${index}][name]`} value={sale.name} />
                            <input
                              type="hidden"
                              name={`sales[${developerId}][${index}][tax_type]`}
                              value={sale.tax_type}
                            />
                            <input
                              type="hidden"
                              name={`sales[${developerId}][${index}][gross_taxable]`}
                              value={sale.gross_taxable || 0}
                            />
                            <input
                              type="hidden"
                              name={`sales[${developerId}][${index}][total_actual_amount]`}
                              value={sale.total_actual_amount || 0}
                            />
                            <input
                              type="hidden"
                              name={`sales[${developerId}][${index}][invoice_number]`}
                              value={sale.invoice_number || ""}
                            />
                            <input
                              type="hidden"
                              name={`sales[${developerId}][${index}][tax_month]`}
                              value={sale.tax_month}
                            />
                            <input
                              type="hidden"
                              name={`sales[${developerId}][${index}][pickup_date]`}
                              value={sale.pickup_date || ""}
                            />
                            <input
                              type="hidden"
                              name={`sales[${developerId}][${index}][user_uuid]`}
                              value={sale.user_uuid}
                            />
                            <input
                              type="hidden"
                              name={`sales[${developerId}][${index}][user_assigned_area]`}
                              value={sale.user_assigned_area || ""}
                            />
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  )
                })}
              </div>
            </Tabs>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-[#001f3f] text-[#001f3f] hover:bg-[#001f3f] hover:text-white bg-transparent"
          >
            Close
          </Button>
          <Button
            className="bg-[#001f3f] text-white hover:bg-[#001f3f]/90"
            disabled={Object.keys(groupedByDeveloper).length === 0}
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
