"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { X, FileText, User, Calendar, Hash, DollarSign, Users, TrendingUp } from "lucide-react"
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

interface CommissionBreakdown {
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
  const [commissionBreakdowns, setCommissionBreakdowns] = useState<CommissionBreakdown[]>([])
  const [loading, setLoading] = useState(false)

  const fetchCommissionBreakdowns = async () => {
    if (!report?.uuid) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("commission_breakdowns")
        .select("*")
        .eq("commission_report_uuid", report.uuid)
        .order("created_at", { ascending: true })

      if (error) throw error
      setCommissionBreakdowns(data || [])
    } catch (error) {
      console.error("Error fetching commission breakdowns:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && report) {
      fetchCommissionBreakdowns()
    }
  }, [isOpen, report])

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      new: { variant: "secondary" as const, label: "New", color: "bg-gray-100 text-gray-800" },
      hold: { variant: "secondary" as const, label: "Hold", color: "bg-yellow-100 text-yellow-800" },
      release: { variant: "default" as const, label: "Release", color: "bg-green-100 text-green-800" },
      "not approved": { variant: "destructive" as const, label: "Not Approved", color: "bg-red-100 text-red-800" },
      error: { variant: "destructive" as const, label: "Error", color: "bg-red-100 text-red-800" },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || {
      variant: "secondary" as const,
      label: status,
      color: "bg-gray-100 text-gray-800",
    }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const formatCurrency = (value: string | number) => {
    if (!value || value === "") return "₱0.00"
    const numValue = typeof value === "string" ? Number.parseFloat(value) : value
    return `₱${numValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  // Calculate totals
  const totalCommission = commissionBreakdowns.reduce(
    (sum, item) => sum + (typeof item.comm === "number" ? item.comm : Number.parseFloat(item.comm.toString()) || 0),
    0,
  )
  const totalAgentNet = commissionBreakdowns.reduce((sum, item) => {
    const netComm =
      typeof item.agent_net_comm === "number"
        ? item.agent_net_comm
        : Number.parseFloat(item.agent_net_comm.toString()) || 0
    return sum + netComm
  }, 0)
  const totalUmNet = commissionBreakdowns.reduce((sum, item) => {
    const netComm =
      typeof item.um_net_comm === "number" ? item.um_net_comm : Number.parseFloat(item.um_net_comm.toString()) || 0
    return sum + netComm
  }, 0)
  const totalTlNet = commissionBreakdowns.reduce((sum, item) => {
    const netComm =
      typeof item.tl_net_comm === "number" ? item.tl_net_comm : Number.parseFloat(item.tl_net_comm.toString()) || 0
    return sum + netComm
  }, 0)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-lg">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Commission Report #{report.report_number}</DialogTitle>
              <p className="text-sm text-gray-600">
                Created on {formatDate(report.created_at)} by {report.creator_name}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="space-y-6">
            {/* Report Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-sm text-gray-600">Report Number</p>
                      <p className="font-semibold">#{report.report_number}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-sm text-gray-600">Total Sales</p>
                      <p className="font-semibold">{commissionBreakdowns.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-orange-600" />
                    <div>
                      <p className="text-sm text-gray-600">Total Commission</p>
                      <p className="font-semibold">{formatCurrency(totalCommission)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-purple-600" />
                    <div>
                      <p className="text-sm text-gray-600">Status</p>
                      <div className="mt-1">{getStatusBadge(report.status)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Commission Breakdown Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Commission Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
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

                    <TabsContent value="overview" className="mt-4">
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
                            {commissionBreakdowns.map((breakdown) => (
                              <TableRow key={breakdown.uuid}>
                                <TableCell className="font-medium">{breakdown.agent_name}</TableCell>
                                <TableCell>{breakdown.client}</TableCell>
                                <TableCell>{breakdown.developer}</TableCell>
                                <TableCell>{formatDate(breakdown.reservation_date)}</TableCell>
                                <TableCell>{formatCurrency(breakdown.comm)}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{breakdown.comm_type}</Badge>
                                </TableCell>
                                <TableCell>{getStatusBadge(breakdown.status)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>

                    <TabsContent value="agent" className="mt-4">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-semibold">Agent Commission Details</h3>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">Total Agent Net Commission</p>
                            <p className="text-xl font-bold text-green-600">{formatCurrency(totalAgentNet)}</p>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Agent</TableHead>
                                <TableHead>Calculation Type</TableHead>
                                <TableHead>Rate</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>VAT</TableHead>
                                <TableHead>EWT</TableHead>
                                <TableHead>Net Commission</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {commissionBreakdowns.map((breakdown) => (
                                <TableRow key={breakdown.uuid}>
                                  <TableCell className="font-medium">{breakdown.agent_name}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{breakdown.calculation_type}</Badge>
                                  </TableCell>
                                  <TableCell>{breakdown.agents_rate}%</TableCell>
                                  <TableCell>{formatCurrency(breakdown.agent_amount)}</TableCell>
                                  <TableCell>{formatCurrency(breakdown.agent_vat)}</TableCell>
                                  <TableCell>{formatCurrency(breakdown.agent_ewt)}</TableCell>
                                  <TableCell className="font-semibold text-green-600">
                                    {formatCurrency(breakdown.agent_net_comm)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="um" className="mt-4">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-semibold">Unit Manager Commission Details</h3>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">Total UM Net Commission</p>
                            <p className="text-xl font-bold text-blue-600">{formatCurrency(totalUmNet)}</p>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>UM Name</TableHead>
                                <TableHead>Calculation Type</TableHead>
                                <TableHead>Rate</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>VAT</TableHead>
                                <TableHead>EWT</TableHead>
                                <TableHead>Net Commission</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {commissionBreakdowns.map((breakdown) => (
                                <TableRow key={breakdown.uuid}>
                                  <TableCell className="font-medium">{breakdown.um_name}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{breakdown.um_calculation_type}</Badge>
                                  </TableCell>
                                  <TableCell>{breakdown.um_rate}%</TableCell>
                                  <TableCell>{formatCurrency(breakdown.um_amount)}</TableCell>
                                  <TableCell>{formatCurrency(breakdown.um_vat)}</TableCell>
                                  <TableCell>{formatCurrency(breakdown.um_ewt)}</TableCell>
                                  <TableCell className="font-semibold text-blue-600">
                                    {formatCurrency(breakdown.um_net_comm)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="tl" className="mt-4">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-semibold">Team Leader Commission Details</h3>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">Total TL Net Commission</p>
                            <p className="text-xl font-bold text-purple-600">{formatCurrency(totalTlNet)}</p>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>TL Name</TableHead>
                                <TableHead>Calculation Type</TableHead>
                                <TableHead>Rate</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>VAT</TableHead>
                                <TableHead>EWT</TableHead>
                                <TableHead>Net Commission</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {commissionBreakdowns.map((breakdown) => (
                                <TableRow key={breakdown.uuid}>
                                  <TableCell className="font-medium">{breakdown.tl_name}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{breakdown.tl_calculation_type}</Badge>
                                  </TableCell>
                                  <TableCell>{breakdown.tl_rate}%</TableCell>
                                  <TableCell>{formatCurrency(breakdown.tl_amount)}</TableCell>
                                  <TableCell>{formatCurrency(breakdown.tl_vat)}</TableCell>
                                  <TableCell>{formatCurrency(breakdown.tl_ewt)}</TableCell>
                                  <TableCell className="font-semibold text-purple-600">
                                    {formatCurrency(breakdown.tl_net_comm)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>

            {/* Report History */}
            {report.history && report.history.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Report History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {report.history.map((entry, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="bg-blue-100 p-1 rounded-full">
                          <User className="h-3 w-3 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{entry.user_name}</span>
                            <Badge variant="outline" className="text-xs">
                              {entry.action}
                            </Badge>
                            <span className="text-xs text-gray-500">{new Date(entry.timestamp).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-gray-600">{entry.remarks}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
