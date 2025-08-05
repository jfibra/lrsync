"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { X, FileText, User, Calendar, Hash, DollarSign } from "lucide-react"
import { supabase } from "@/lib/supabase/client"

interface CommissionReport {
  uuid: string
  report_number: number
  sales_uuids: string[]
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string
  remarks: string
  status: string
  history: Array<{
    action: string
    remarks: string
    user_id: string
    timestamp: string
    user_name: string
  }>
  creator_name?: string
}

interface CommissionDetail {
  uuid: string
  commission_report_uuid: string
  commission_report_number: number
  agent_uuid: string
  agent_name: string
  developer: string
  client: string
  reservation_date: string
  comm: number
  comm_type: string
  bdo_account: string | number
  net_of_vat: string | number
  status: string
  calculation_type: string
  agents_rate: number
  developers_rate: number
  agent_amount: string | number
  agent_vat: string | number
  agent_ewt: string | number
  agent_ewt_rate: string | number
  agent_net_comm: string | number
  um_name: string
  um_calculation_type: string
  um_rate: number
  um_developers_rate: number
  um_amount: string | number
  um_vat: string | number
  um_ewt: string | number
  um_ewt_rate: string | number
  um_net_comm: string | number
  tl_name: string
  tl_calculation_type: string
  tl_rate: number
  tl_developers_rate: number
  tl_amount: string | number
  tl_vat: string | number
  tl_ewt: string | number
  tl_ewt_rate: string | number
  tl_net_comm: string | number
  created_at: string
  updated_at: string
  deleted_at: string
}

interface CommissionReportViewModalProps {
  isOpen: boolean
  onClose: () => void
  report: CommissionReport
}

export function CommissionReportViewModal({ isOpen, onClose, report }: CommissionReportViewModalProps) {
  const [commissionDetails, setCommissionDetails] = useState<CommissionDetail[]>([])
  const [loading, setLoading] = useState(false)

  const fetchCommissionDetails = async () => {
    if (!report.uuid) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("commission_agent_breakdown")
        .select("*")
        .eq("commission_report_uuid", report.uuid)
        .order("created_at", { ascending: true })

      if (error) throw error

      setCommissionDetails(data || [])
    } catch (error) {
      console.error("Error fetching commission details:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && report.uuid) {
      fetchCommissionDetails()
    }
  }, [isOpen, report.uuid])

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? Number.parseFloat(value) || 0 : value || 0
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(num)
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      hold: { variant: "secondary" as const, label: "Hold" },
      release: { variant: "default" as const, label: "Release" },
      "not approved": { variant: "destructive" as const, label: "Not Approved" },
      error: { variant: "destructive" as const, label: "Error" },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || { variant: "secondary" as const, label: status }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  // Calculate totals
  const agentTotals = commissionDetails.reduce(
    (acc, detail) => ({
      amount: acc.amount + (Number.parseFloat(detail.agent_amount?.toString() || "0") || 0),
      vat: acc.vat + (Number.parseFloat(detail.agent_vat?.toString() || "0") || 0),
      ewt: acc.ewt + (Number.parseFloat(detail.agent_ewt?.toString() || "0") || 0),
      netComm: acc.netComm + (Number.parseFloat(detail.agent_net_comm?.toString() || "0") || 0),
    }),
    { amount: 0, vat: 0, ewt: 0, netComm: 0 },
  )

  const umTotals = commissionDetails.reduce(
    (acc, detail) => ({
      amount: acc.amount + (Number.parseFloat(detail.um_amount?.toString() || "0") || 0),
      vat: acc.vat + (Number.parseFloat(detail.um_vat?.toString() || "0") || 0),
      ewt: acc.ewt + (Number.parseFloat(detail.um_ewt?.toString() || "0") || 0),
      netComm: acc.netComm + (Number.parseFloat(detail.um_net_comm?.toString() || "0") || 0),
    }),
    { amount: 0, vat: 0, ewt: 0, netComm: 0 },
  )

  const tlTotals = commissionDetails.reduce(
    (acc, detail) => ({
      amount: acc.amount + (Number.parseFloat(detail.tl_amount?.toString() || "0") || 0),
      vat: acc.vat + (Number.parseFloat(detail.tl_vat?.toString() || "0") || 0),
      ewt: acc.ewt + (Number.parseFloat(detail.tl_ewt?.toString() || "0") || 0),
      netComm: acc.netComm + (Number.parseFloat(detail.tl_net_comm?.toString() || "0") || 0),
    }),
    { amount: 0, vat: 0, ewt: 0, netComm: 0 },
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-lg">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl">Commission Report #{report.report_number}</DialogTitle>
                <p className="text-sm text-gray-600">View commission breakdown details</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Report Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Report Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3">
                <Hash className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Report Number</p>
                  <p className="font-semibold">#{report.report_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Created By</p>
                  <p className="font-semibold">{report.creator_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Created Date</p>
                  <p className="font-semibold">
                    {new Date(report.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Sales Count</p>
                  <p className="font-semibold">{report.sales_uuids?.length || 0} sales</p>
                </div>
              </div>
            </div>
            {report.remarks && (
              <>
                <Separator className="my-4" />
                <div>
                  <p className="text-sm text-gray-600 mb-1">Remarks</p>
                  <p className="text-sm">{report.remarks}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="agent">Agent Details</TabsTrigger>
              <TabsTrigger value="um">UM Details</TabsTrigger>
              <TabsTrigger value="tl">TL Details</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Sales Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Agent</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Developer</TableHead>
                          <TableHead>Reservation Date</TableHead>
                          <TableHead>Commission</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {commissionDetails.map((detail) => (
                          <TableRow key={detail.uuid}>
                            <TableCell className="font-medium">{detail.agent_name}</TableCell>
                            <TableCell>{detail.client}</TableCell>
                            <TableCell>{detail.developer}</TableCell>
                            <TableCell>
                              {new Date(detail.reservation_date).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </TableCell>
                            <TableCell>{formatCurrency(detail.comm)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{detail.comm_type}</Badge>
                            </TableCell>
                            <TableCell>{getStatusBadge(detail.status)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="agent" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Agent Commission Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Agent</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Calculation Type</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>VAT</TableHead>
                          <TableHead>EWT</TableHead>
                          <TableHead>Net Commission</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {commissionDetails.map((detail) => (
                          <TableRow key={detail.uuid}>
                            <TableCell className="font-medium">{detail.agent_name}</TableCell>
                            <TableCell>{detail.client}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{detail.calculation_type}</Badge>
                            </TableCell>
                            <TableCell>{formatCurrency(detail.agent_amount)}</TableCell>
                            <TableCell>{formatCurrency(detail.agent_vat)}</TableCell>
                            <TableCell>{formatCurrency(detail.agent_ewt)}</TableCell>
                            <TableCell className="font-semibold">{formatCurrency(detail.agent_net_comm)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-gray-50 font-semibold">
                          <TableCell colSpan={3}>Total</TableCell>
                          <TableCell>{formatCurrency(agentTotals.amount)}</TableCell>
                          <TableCell>{formatCurrency(agentTotals.vat)}</TableCell>
                          <TableCell>{formatCurrency(agentTotals.ewt)}</TableCell>
                          <TableCell>{formatCurrency(agentTotals.netComm)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="um" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Unit Manager Commission Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>UM Name</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Calculation Type</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>VAT</TableHead>
                          <TableHead>EWT</TableHead>
                          <TableHead>Net Commission</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {commissionDetails.map((detail) => (
                          <TableRow key={detail.uuid}>
                            <TableCell className="font-medium">{detail.um_name}</TableCell>
                            <TableCell>{detail.client}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{detail.um_calculation_type}</Badge>
                            </TableCell>
                            <TableCell>{formatCurrency(detail.um_amount)}</TableCell>
                            <TableCell>{formatCurrency(detail.um_vat)}</TableCell>
                            <TableCell>{formatCurrency(detail.um_ewt)}</TableCell>
                            <TableCell className="font-semibold">{formatCurrency(detail.um_net_comm)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-gray-50 font-semibold">
                          <TableCell colSpan={3}>Total</TableCell>
                          <TableCell>{formatCurrency(umTotals.amount)}</TableCell>
                          <TableCell>{formatCurrency(umTotals.vat)}</TableCell>
                          <TableCell>{formatCurrency(umTotals.ewt)}</TableCell>
                          <TableCell>{formatCurrency(umTotals.netComm)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tl" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Team Leader Commission Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>TL Name</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Calculation Type</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>VAT</TableHead>
                          <TableHead>EWT</TableHead>
                          <TableHead>Net Commission</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {commissionDetails.map((detail) => (
                          <TableRow key={detail.uuid}>
                            <TableCell className="font-medium">{detail.tl_name}</TableCell>
                            <TableCell>{detail.client}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{detail.tl_calculation_type}</Badge>
                            </TableCell>
                            <TableCell>{formatCurrency(detail.tl_amount)}</TableCell>
                            <TableCell>{formatCurrency(detail.tl_vat)}</TableCell>
                            <TableCell>{formatCurrency(detail.tl_ewt)}</TableCell>
                            <TableCell className="font-semibold">{formatCurrency(detail.tl_net_comm)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-gray-50 font-semibold">
                          <TableCell colSpan={3}>Total</TableCell>
                          <TableCell>{formatCurrency(tlTotals.amount)}</TableCell>
                          <TableCell>{formatCurrency(tlTotals.vat)}</TableCell>
                          <TableCell>{formatCurrency(tlTotals.ewt)}</TableCell>
                          <TableCell>{formatCurrency(tlTotals.netComm)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
