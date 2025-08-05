"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useRef } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
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
    status?: string // Added for status update actions
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
  // Removed status update modal and related state

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

  // Status badge color mapping
  const getStatusBadge = (status: string) => {
    const colorMap: Record<string, { color: string; bg: string; label: string }> = {
      new: { color: '#fff', bg: '#6c757d', label: 'New' },
      ongoing_verification: { color: '#fff', bg: '#0074d9', label: 'Ongoing Verification' },
      for_approval: { color: '#fff', bg: '#ff851b', label: 'For Approval' },
      approved: { color: '#fff', bg: '#2ecc40', label: 'Approved' },
      cancelled: { color: '#fff', bg: '#ee3433', label: 'Cancelled' },
      for_testing: { color: '#fff', bg: '#b10dc9', label: 'For Testing' },
    }
    const key = (status || '').toLowerCase().replace(/ /g, '_')
    const config = colorMap[key] || { color: '#fff', bg: '#6c757d', label: status }
    return <span style={{ background: config.bg, color: config.color, borderRadius: 6, padding: '2px 10px', fontWeight: 500, fontSize: 13 }}>{config.label}</span>
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
      <DialogContent
        className="max-w-7xl max-h-[90vh] overflow-y-auto bg-white"
        style={{ background: '#fff', color: '#001f3f' }}
      >
        <DialogHeader>
          <div className="flex items-center justify-between" style={{ color: '#001f3f' }}>
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-lg">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl" style={{ color: '#001f3f' }}>Commission Report #{report.report_number}</DialogTitle>
                <p className="text-sm" style={{ color: '#001f3f', opacity: 0.7 }}>View commission breakdown details</p>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Report Summary */}
        <Card className="mb-6 bg-white" style={{ color: '#001f3f', backgroundColor: '#e0e0e0' }}>
          <CardHeader>
            <CardTitle className="text-lg" style={{ color: '#001f3f' }}>Report Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3">
                <Hash className="h-5 w-5" style={{ color: '#001f3f', opacity: 0.5 }} />
                <div>
                  <p className="text-sm" style={{ color: '#001f3f', opacity: 0.7 }}>Report Number</p>
                  <p className="font-semibold" style={{ color: '#001f3f' }}>#{report.report_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center">
                  {getStatusBadge(report.status)}
                </span>
              </div>
      {/* Removed Update Status Modal */}
              <div className="flex items-center gap-3">
                <User className="h-5 w-5" style={{ color: '#001f3f', opacity: 0.5 }} />
                <div>
                  <p className="text-sm" style={{ color: '#001f3f', opacity: 0.7 }}>Created By</p>
                  <p className="font-semibold" style={{ color: '#001f3f' }}>{report.creator_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5" style={{ color: '#001f3f', opacity: 0.5 }} />
                <div>
                  <p className="text-sm" style={{ color: '#001f3f', opacity: 0.7 }}>Created Date</p>
                  <p className="font-semibold" style={{ color: '#001f3f' }}>
                    {new Date(report.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5" style={{ color: '#001f3f', opacity: 0.5 }} />
                <div>
                  <p className="text-sm" style={{ color: '#001f3f', opacity: 0.7 }}>Sales Count</p>
                  <p className="font-semibold" style={{ color: '#001f3f' }}>{report.sales_uuids?.length || 0} sales</p>
                </div>
              </div>
            </div>
            {report.remarks && (
              <>
                <Separator className="my-4" />
                <div>
                  <p className="text-sm mb-1" style={{ color: '#001f3f', opacity: 0.7 }}>Remarks</p>
                  <p className="text-sm" style={{ color: '#001f3f' }}>{report.remarks}</p>
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
            <TabsList
              className="grid w-full grid-cols-4"
              style={{ background: '#e0e0e0', color: '#001f3f' }}
            >
              <TabsTrigger
                value="overview"
                style={{
                  color: '#001f3f',
                  '--tw-bg-opacity': '1',
                  background: 'var(--tab-active-overview, transparent)'
                } as React.CSSProperties}
                className="data-[state=active]:!bg-[#ee3433] data-[state=active]:!text-white"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="agent"
                style={{
                  color: '#001f3f',
                  '--tw-bg-opacity': '1',
                  background: 'var(--tab-active-agent, transparent)'
                } as React.CSSProperties}
                className="data-[state=active]:!bg-[#ee3433] data-[state=active]:!text-white"
              >
                Agent Details
              </TabsTrigger>
              <TabsTrigger
                value="um"
                style={{
                  color: '#001f3f',
                  '--tw-bg-opacity': '1',
                  background: 'var(--tab-active-um, transparent)'
                } as React.CSSProperties}
                className="data-[state=active]:!bg-[#ee3433] data-[state=active]:!text-white"
              >
                UM Details
              </TabsTrigger>
              <TabsTrigger
                value="tl"
                style={{
                  color: '#001f3f',
                  '--tw-bg-opacity': '1',
                  background: 'var(--tab-active-tl, transparent)'
                } as React.CSSProperties}
                className="data-[state=active]:!bg-[#ee3433] data-[state=active]:!text-white"
              >
                TL Details
              </TabsTrigger>
            </TabsList>

            {/* ...existing code... (TabsContent, Cards, Tables, etc.) */}
            <TabsContent value="overview" className="space-y-4">
              <Card className="bg-white" style={{ color: '#001f3f' }}>
                <CardHeader>
                  <CardTitle style={{ color: '#001f3f' }}>Sales Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow style={{ backgroundColor: '#001f3f' }}>
                          <TableHead style={{ color: 'white', textAlign:'center' }}>Agent</TableHead>
                          <TableHead style={{ color: 'white', textAlign:'center' }}>Client</TableHead>
                          <TableHead style={{ color: 'white', textAlign:'center' }}>Developer</TableHead>
                          <TableHead style={{ color: 'white', textAlign:'center' }}>Reservation Date</TableHead>
                          <TableHead style={{ color: 'white', textAlign:'center' }}>Commission</TableHead>
                          <TableHead style={{ color: 'white', textAlign:'center' }}>Type</TableHead>
                          <TableHead style={{ color: 'white', textAlign:'center' }}>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {commissionDetails.map((detail) => (
                          <TableRow key={detail.uuid}>
                            <TableCell className="font-medium" style={{ color: '#001f3f' }}>{detail.agent_name}</TableCell>
                            <TableCell style={{ color: '#001f3f' }}>{detail.client}</TableCell>
                            <TableCell style={{ color: '#001f3f' }}>{detail.developer}</TableCell>
                            <TableCell style={{ color: '#001f3f' }}>
                              {new Date(detail.reservation_date).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </TableCell>
                            <TableCell style={{ color: '#001f3f' }}>{formatCurrency(detail.comm)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" style={{ color: '#001f3f' }}>{detail.comm_type}</Badge>
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
              <Card className="bg-white" style={{ color: '#001f3f' }}>
                <CardHeader>
                  <CardTitle style={{ color: '#001f3f' }}>Agent Commission Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow style={{ backgroundColor: '#001f3f' }}>
                          <TableHead style={{ color: 'white', textAlign:'center' }}>Agent</TableHead>
                          <TableHead style={{ color: 'white', textAlign:'center' }}>Client</TableHead>
                          <TableHead style={{ color: 'white', textAlign:'center' }}>Calculation Type</TableHead>
                          <TableHead style={{ color: 'white', textAlign:'center' }}>Amount</TableHead>
                          <TableHead style={{ color: 'white', textAlign:'center' }}>VAT</TableHead>
                          <TableHead style={{ color: 'white', textAlign:'center' }}>EWT</TableHead>
                          <TableHead style={{ color: 'white', textAlign:'center' }}>Net Commission</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {commissionDetails.map((detail) => (
                          <TableRow key={detail.uuid}>
                            <TableCell className="font-medium" style={{ color: '#001f3f' }}>{detail.agent_name}</TableCell>
                            <TableCell style={{ color: '#001f3f' }}>{detail.client}</TableCell>
                            <TableCell>
                              <Badge variant="outline" style={{ color: '#001f3f' }}>{detail.calculation_type}</Badge>
                            </TableCell>
                            <TableCell style={{ color: '#001f3f' }}>{formatCurrency(detail.agent_amount)}</TableCell>
                            <TableCell style={{ color: '#001f3f' }}>{formatCurrency(detail.agent_vat)}</TableCell>
                            <TableCell style={{ color: '#001f3f' }}>{formatCurrency(detail.agent_ewt)}</TableCell>
                            <TableCell className="font-semibold" style={{ color: '#001f3f' }}>{formatCurrency(detail.agent_net_comm)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-gray-50 font-semibold">
                          <TableCell colSpan={3} style={{ color: '#001f3f' }}>Total</TableCell>
                          <TableCell style={{ color: '#001f3f' }}>{formatCurrency(agentTotals.amount)}</TableCell>
                          <TableCell style={{ color: '#001f3f' }}>{formatCurrency(agentTotals.vat)}</TableCell>
                          <TableCell style={{ color: '#001f3f' }}>{formatCurrency(agentTotals.ewt)}</TableCell>
                          <TableCell style={{ color: '#001f3f' }}>{formatCurrency(agentTotals.netComm)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="um" className="space-y-4">
              <Card className="bg-white" style={{ color: '#001f3f' }}>
                <CardHeader>
                  <CardTitle style={{ color: '#001f3f' }}>Unit Manager Commission Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow style={{ backgroundColor: '#001f3f' }}>
                          <TableHead style={{ color: 'white', textAlign:'center' }}>UM Name</TableHead>
                          <TableHead style={{ color: 'white', textAlign:'center' }}>Client</TableHead>
                          <TableHead style={{ color: 'white', textAlign:'center' }}>Calculation Type</TableHead>
                          <TableHead style={{ color: 'white', textAlign:'center' }}>Amount</TableHead>
                          <TableHead style={{ color: 'white', textAlign:'center' }}>VAT</TableHead>
                          <TableHead style={{ color: 'white', textAlign:'center' }}>EWT</TableHead>
                          <TableHead style={{ color: 'white', textAlign:'center' }}>Net Commission</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {commissionDetails.map((detail) => (
                          <TableRow key={detail.uuid}>
                            <TableCell className="font-medium" style={{ color: '#001f3f' }}>{detail.um_name}</TableCell>
                            <TableCell style={{ color: '#001f3f' }}>{detail.client}</TableCell>
                            <TableCell>
                              <Badge variant="outline" style={{ color: '#001f3f' }}>{detail.um_calculation_type}</Badge>
                            </TableCell>
                            <TableCell style={{ color: '#001f3f' }}>{formatCurrency(detail.um_amount)}</TableCell>
                            <TableCell style={{ color: '#001f3f' }}>{formatCurrency(detail.um_vat)}</TableCell>
                            <TableCell style={{ color: '#001f3f' }}>{formatCurrency(detail.um_ewt)}</TableCell>
                            <TableCell className="font-semibold" style={{ color: '#001f3f' }}>{formatCurrency(detail.um_net_comm)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-gray-50 font-semibold">
                          <TableCell colSpan={3} style={{ color: '#001f3f' }}>Total</TableCell>
                          <TableCell style={{ color: '#001f3f' }}>{formatCurrency(umTotals.amount)}</TableCell>
                          <TableCell style={{ color: '#001f3f' }}>{formatCurrency(umTotals.vat)}</TableCell>
                          <TableCell style={{ color: '#001f3f' }}>{formatCurrency(umTotals.ewt)}</TableCell>
                          <TableCell style={{ color: '#001f3f' }}>{formatCurrency(umTotals.netComm)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tl" className="space-y-4">
              <Card className="bg-white" style={{ color: '#001f3f' }}>
                <CardHeader>
                  <CardTitle style={{ color: '#001f3f' }}>Team Leader Commission Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow style={{ backgroundColor: '#001f3f' }}>
                          <TableHead style={{ color: 'white', textAlign:'center' }}>TL Name</TableHead>
                          <TableHead style={{ color: 'white', textAlign:'center' }}>Client</TableHead>
                          <TableHead style={{ color: 'white', textAlign:'center' }}>Calculation Type</TableHead>
                          <TableHead style={{ color: 'white', textAlign:'center' }}>Amount</TableHead>
                          <TableHead style={{ color: 'white', textAlign:'center' }}>VAT</TableHead>
                          <TableHead style={{ color: 'white', textAlign:'center' }}>EWT</TableHead>
                          <TableHead style={{ color: 'white', textAlign:'center' }}>Net Commission</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {commissionDetails.map((detail) => (
                          <TableRow key={detail.uuid}>
                            <TableCell className="font-medium" style={{ color: '#001f3f' }}>{detail.tl_name}</TableCell>
                            <TableCell style={{ color: '#001f3f' }}>{detail.client}</TableCell>
                            <TableCell>
                              <Badge variant="outline" style={{ color: '#001f3f' }}>{detail.tl_calculation_type}</Badge>
                            </TableCell>
                            <TableCell style={{ color: '#001f3f' }}>{formatCurrency(detail.tl_amount)}</TableCell>
                            <TableCell style={{ color: '#001f3f' }}>{formatCurrency(detail.tl_vat)}</TableCell>
                            <TableCell style={{ color: '#001f3f' }}>{formatCurrency(detail.tl_ewt)}</TableCell>
                            <TableCell className="font-semibold" style={{ color: '#001f3f' }}>{formatCurrency(detail.tl_net_comm)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-gray-50 font-semibold">
                          <TableCell colSpan={3} style={{ color: '#001f3f' }}>Total</TableCell>
                          <TableCell style={{ color: '#001f3f' }}>{formatCurrency(tlTotals.amount)}</TableCell>
                          <TableCell style={{ color: '#001f3f' }}>{formatCurrency(tlTotals.vat)}</TableCell>
                          <TableCell style={{ color: '#001f3f' }}>{formatCurrency(tlTotals.ewt)}</TableCell>
                          <TableCell style={{ color: '#001f3f' }}>{formatCurrency(tlTotals.netComm)}</TableCell>
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
