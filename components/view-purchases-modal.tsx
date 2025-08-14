"use client"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { useAuth } from "@/contexts/auth-context"

interface Purchase {
  id: string
  tax_month: string
  tin_id: string | null
  tin: string
  name: string
  substreet_street_brgy: string | null
  district_city_zip: string | null
  gross_taxable: number
  invoice_number: string | null
  tax_type: string
  official_receipt: string | null
  date_added: string | null
  user_uuid: string | null
  user_full_name: string | null
  remarks: string | null
  created_at: string
}

interface ViewPurchasesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  purchase: Purchase | null
}

export function ViewPurchasesModal({ open, onOpenChange, purchase }: ViewPurchasesModalProps) {
  const { profile } = useAuth()

  // Format TIN display
  const formatTin = (tin: string) => {
    const digits = tin.replace(/\D/g, "")
    return digits.replace(/(\d{3})(?=\d)/g, "$1-")
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount)
  }

  // Get tax type badge color
  const getTaxTypeBadgeColor = (taxType: string) => {
    switch (taxType) {
      case "vat":
        return "bg-[#3c8dbc]/20 text-[#3c8dbc] border border-[#3c8dbc]/30"
      case "non-vat":
        return "bg-[#ffc107]/20 text-[#ffc107] border border-[#ffc107]/30"
      default:
        return "bg-gray-100 text-gray-800 border border-gray-200"
    }
  }

  if (!purchase) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white text-[#001f3f]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#001f3f]">Purchase Record Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#001f3f]">Tax Month</label>
                <div className="text-lg font-semibold text-[#001f3f]">
                  {format(new Date(purchase.tax_month), "MMMM yyyy")}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-[#001f3f]">TIN</label>
                <div className="text-lg font-mono text-[#001f3f]">{formatTin(purchase.tin)}</div>
              </div>

              <div>
                <label className="text-sm font-medium text-[#001f3f]">Name</label>
                <div className="text-lg font-semibold text-[#001f3f]">{purchase.name}</div>
              </div>

              <div>
                <label className="text-sm font-medium text-[#001f3f]">Tax Type</label>
                <div>
                  <Badge className={getTaxTypeBadgeColor(purchase.tax_type)}>{purchase.tax_type?.toUpperCase()}</Badge>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#001f3f]">Gross Taxable</label>
                <div className="text-lg font-semibold text-[#dc3545]">
                  {formatCurrency(purchase.gross_taxable || 0)}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-[#001f3f]">Invoice Number</label>
                <div className="text-lg text-[#001f3f]">{purchase.invoice_number || "N/A"}</div>
              </div>

              <div>
                <label className="text-sm font-medium text-[#001f3f]">Official Receipt</label>
                <div className="text-lg text-[#001f3f]">{purchase.official_receipt || "N/A"}</div>
              </div>

              <div>
                <label className="text-sm font-medium text-[#001f3f]">Date Added</label>
                <div className="text-lg text-[#001f3f]">
                  {purchase.date_added ? format(new Date(purchase.date_added), "MMM dd, yyyy") : "N/A"}
                </div>
              </div>
            </div>
          </div>

          {/* Address Information */}
          {(purchase.substreet_street_brgy || purchase.district_city_zip) && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[#001f3f]">Address Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {purchase.substreet_street_brgy && (
                  <div>
                    <label className="text-sm font-medium text-[#001f3f]">Substreet/Street/Barangay</label>
                    <div className="text-base text-[#001f3f]">{purchase.substreet_street_brgy}</div>
                  </div>
                )}
                {purchase.district_city_zip && (
                  <div>
                    <label className="text-sm font-medium text-[#001f3f]">District/City/ZIP</label>
                    <div className="text-base text-[#001f3f]">{purchase.district_city_zip}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Remarks */}
          {purchase.remarks && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#001f3f]">Remarks</label>
              <div className="text-base text-[#001f3f] bg-[#001f3f]/5 p-3 rounded-md">{purchase.remarks}</div>
            </div>
          )}

          {/* User Information */}
          {purchase.user_full_name && (
            <div className="space-y-2 pt-4 border-t border-[#001f3f]/20">
              <label className="text-sm font-medium text-[#001f3f]">Added by</label>
              <div className="text-base text-[#001f3f]">{purchase.user_full_name}</div>
            </div>
          )}

          {/* Created At */}
          <div className="space-y-2 pt-4 border-t border-[#001f3f]/20">
            <label className="text-sm font-medium text-[#001f3f]">Created At</label>
            <div className="text-base text-[#001f3f]">
              {format(new Date(purchase.created_at), "MMM dd, yyyy 'at' hh:mm a")}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
