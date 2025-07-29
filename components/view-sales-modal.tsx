"use client"

import React from "react"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"
import { format } from "date-fns"
import type { Sales } from "@/types/sales"

interface ViewSalesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sale: Sales | null
}

export function ViewSalesModal({ open, onOpenChange, sale }: ViewSalesModalProps) {
  const { profile } = typeof window !== 'undefined' ? require('@/contexts/auth-context').useAuth() : { profile: null }
  // Format TIN display - add dash after every 3 digits
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
        return "bg-blue-100 text-blue-800"
      case "non-vat":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  // Log view action when modal opens
  React.useEffect(() => {
    if (open && sale) {
      (async () => {
        try {
          const { supabase } = await import('@/lib/supabase/client')
          await supabase.rpc('log_notification', {
            p_action: 'sales_viewed',
            p_description: `Sales record viewed for ${sale.name} (TIN: ${sale.tin})`,
            p_ip_address: '',
            p_location: null,
            p_user_agent: typeof window !== 'undefined' ? window.navigator.userAgent : '',
            p_meta: { saleId: sale.id, viewedBy: profile?.full_name || '', role: profile?.role || '' }
          })
        } catch (err) {
          // Silent fail for logging
        }
      })()
    }
  }, [open, sale])

  if (!sale) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white text-[#001f3f]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Sales Record Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#001f3f]">Tax Month</label>
                <div className="text-lg font-semibold">{format(new Date(sale.tax_month), "MMMM yyyy")}</div>
              </div>

              <div>
                <label className="text-sm font-medium text-[#001f3f]">TIN</label>
                <div className="text-lg font-mono">{formatTin(sale.tin)}</div>
              </div>

              <div>
                <label className="text-sm font-medium text-[#001f3f]">Name</label>
                <div className="text-lg font-semibold">{sale.name}</div>
              </div>

              <div>
                <label className="text-sm font-medium text-[#001f3f]">Tax Type</label>
                <div>
                  <Badge className={getTaxTypeBadgeColor(sale.tax_type)}>{sale.tax_type?.toUpperCase()}</Badge>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#001f3f]">Gross Taxable</label>
                <div className="text-lg font-semibold text-green-600">{formatCurrency(sale.gross_taxable || 0)}</div>
              </div>

              <div>
                <label className="text-sm font-medium text-[#001f3f]">Invoice Number</label>
                <div className="text-lg">{sale.invoice_number || "N/A"}</div>
              </div>

              <div>
                <label className="text-sm font-medium text-[#001f3f]">Pickup Date</label>
                <div className="text-lg">
                  {sale.pickup_date ? format(new Date(sale.pickup_date), "MMM dd, yyyy") : "N/A"}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-[#001f3f]">Date Added</label>
                <div className="text-lg">{format(new Date(sale.created_at), "MMM dd, yyyy")}</div>
              </div>
            </div>
          </div>

          {/* Address Information */}
          {(sale.substreet_street_brgy || sale.district_city_zip) && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[#001f3f]">Address Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sale.substreet_street_brgy && (
                  <div>
                    <label className="text-sm font-medium text-[#001f3f]">Substreet/Street/Barangay</label>
                    <div className="text-base">{sale.substreet_street_brgy}</div>
                  </div>
                )}
                {sale.district_city_zip && (
                  <div>
                    <label className="text-sm font-medium text-[#001f3f]">District/City/ZIP</label>
                    <div className="text-base">{sale.district_city_zip}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* File Attachments */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[#001f3f]">File Attachments</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Cheque Files */}
              {sale.cheque && sale.cheque.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#001f3f]">Cheque ({sale.cheque.length})</label>
                  <div className="space-y-1">
                    {sale.cheque.map((url, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start bg-white text-[#001f3f] border-[#001f3f]"
                        onClick={() => window.open(url, "_blank")}
                      >
                        <ExternalLink className="h-3 w-3 mr-2" />
                        Cheque {index + 1}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Voucher Files */}
              {sale.voucher && sale.voucher.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#001f3f]">Voucher ({sale.voucher.length})</label>
                  <div className="space-y-1">
                    {sale.voucher.map((url, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start bg-white text-[#001f3f] border-[#001f3f]"
                        onClick={() => window.open(url, "_blank")}
                      >
                        <ExternalLink className="h-3 w-3 mr-2" />
                        Voucher {index + 1}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Invoice Files */}
              {sale.invoice && sale.invoice.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#001f3f]">Invoice ({sale.invoice.length})</label>
                  <div className="space-y-1">
                    {sale.invoice.map((url, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start bg-white text-[#001f3f] border-[#001f3f]"
                        onClick={() => window.open(url, "_blank")}
                      >
                        <ExternalLink className="h-3 w-3 mr-2" />
                        Invoice {index + 1}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Doc 2307 Files */}
              {sale.doc_2307 && sale.doc_2307.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#001f3f]">Doc 2307 ({sale.doc_2307.length})</label>
                  <div className="space-y-1">
                    {sale.doc_2307.map((url, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start bg-white text-[#001f3f] border-[#001f3f]"
                        onClick={() => window.open(url, "_blank")}
                      >
                        <ExternalLink className="h-3 w-3 mr-2" />
                        Doc 2307 {index + 1}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Deposit Slip Files */}
              {sale.deposit_slip && sale.deposit_slip.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#001f3f]">Deposit Slip ({sale.deposit_slip.length})</label>
                  <div className="space-y-1">
                    {sale.deposit_slip.map((url, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start bg-white text-[#001f3f] border-[#001f3f]"
                        onClick={() => window.open(url, "_blank")}
                      >
                        <ExternalLink className="h-3 w-3 mr-2" />
                        Deposit Slip {index + 1}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* User Information */}
          {sale.user_full_name && (
            <div className="space-y-2 pt-4 border-t">
              <label className="text-sm font-medium text-[#001f3f]">Added by</label>
              <div className="text-base">{sale.user_full_name}</div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
