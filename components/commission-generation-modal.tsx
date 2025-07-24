"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import type { Sales } from "@/types/sales"

interface CommissionGenerationModalProps {
  isOpen: boolean
  onClose: () => void
  selectedSales: Sales[]
  userArea?: string
}

export function CommissionGenerationModal({
  isOpen,
  onClose,
  selectedSales,
  userArea,
}: CommissionGenerationModalProps) {
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader className="border-b border-gray-200 pb-4">
          <DialogTitle className="text-2xl font-bold text-[#001f3f]">
            Generate Commission {userArea && `(${userArea})`} - {format(new Date(), "MMMM dd, yyyy")}
          </DialogTitle>
          <p className="text-[#555555] mt-1">Commission breakdown for selected developers</p>
        </DialogHeader>

        <div className="space-y-8 mt-6">
          {Object.entries(groupedByDeveloper).map(([developerId, developerSales]) => {
            const totalGrossTaxable = developerSales.reduce((sum, sale) => sum + (sale.gross_taxable || 0), 0)
            const totalActualAmount = developerSales.reduce((sum, sale) => sum + (sale.total_actual_amount || 0), 0)
            const totalCommission = totalActualAmount * 0.05

            return (
              <div key={developerId} className="border border-gray-200 rounded-lg bg-white shadow-sm">
                {/* Developer Information Header */}
                <div className="p-6 bg-[#f9f9f9] border-b border-gray-200 rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold text-[#001f3f]">Developer: {developerId}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-[#555555]">Invoice #:</span>
                          <span className="ml-2 font-medium text-[#001f3f]">
                            {developerSales[0]?.invoice_number || "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#555555]">Area:</span>
                          <span className="ml-2 font-medium text-[#001f3f]">
                            {developerSales[0]?.user_assigned_area || "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#555555]">Records:</span>
                          <span className="ml-2 font-medium text-[#001f3f]">{developerSales.length}</span>
                        </div>
                        <div>
                          <span className="text-[#555555]">Commission Rate:</span>
                          <span className="ml-2 font-bold text-[#dee242]">5%</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mt-3">
                        <div>
                          <span className="text-[#555555]">Total Gross:</span>
                          <span className="ml-2 font-semibold text-[#001f3f]">{formatCurrency(totalGrossTaxable)}</span>
                        </div>
                        <div>
                          <span className="text-[#555555]">Total Actual:</span>
                          <span className="ml-2 font-semibold text-[#001f3f]">{formatCurrency(totalActualAmount)}</span>
                        </div>
                        <div>
                          <span className="text-[#555555]">Total Commission:</span>
                          <span className="ml-2 font-bold text-[#dee242] text-lg">
                            {formatCurrency(totalCommission)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Developer Sales Table - Empty for now as requested */}
                <div className="p-6">
                  <div className="text-center py-12 bg-[#f9f9f9] rounded-lg border-2 border-dashed border-gray-300">
                    <div className="text-[#555555] text-lg font-medium mb-2">Sales Records Table</div>
                    <div className="text-[#555555] text-sm">Detailed sales breakdown will be displayed here</div>
                    <div className="mt-4 text-xs text-[#555555]">
                      {developerSales.length} sales records for this developer
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {Object.keys(groupedByDeveloper).length === 0 && (
            <div className="text-center py-12">
              <div className="text-[#555555] text-lg font-medium mb-2">No developers selected</div>
              <div className="text-[#555555] text-sm">Please select sales records to generate commission reports</div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
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
          >
            Export Commission Report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
