"use client"

import React, { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CheckCircle2, FileText, Loader2, Receipt } from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { logNotification } from "@/utils/logNotification"
import { formatS3Url } from "@/utils/s3-url"
import {
  VoucherBondpaperDocument,
  generateVoucherBondpaperPdf,
  type CommissionVoucherData,
} from "@/components/voucher-bondpaper-document"

interface CommissionReportSummary {
  uuid: string
  report_number: number
  assigned_area?: string | null
  remarks?: string | null
}

interface BreakdownRow {
  uuid: string
  commission_report_uuid: string
  commission_report_number: number
  agent_name: string
  developer: string
  client: string
  reservation_date?: string | null
  comm?: number | string | null
  net_of_vat?: number | string | null
  status?: string | null
  calculation_type?: string | null
  agents_rate?: number | string | null
  developers_rate?: number | string | null
  agent_amount?: number | string | null
  agent_vat?: number | string | null
  agent_ewt?: number | string | null
  agent_ewt_rate?: number | string | null
  agent_net_comm?: number | string | null
  tl_name?: string | null
  tl_rate?: number | string | null
  tl_developers_rate?: number | string | null
  tl_amount?: number | string | null
  tl_vat?: number | string | null
  tl_ewt?: number | string | null
  tl_ewt_rate?: number | string | null
  tl_net_comm?: number | string | null
  um_name?: string | null
  um_rate?: number | string | null
  um_developers_rate?: number | string | null
  um_amount?: number | string | null
  um_vat?: number | string | null
  um_ewt?: number | string | null
  um_ewt_rate?: number | string | null
  um_net_comm?: number | string | null
  lrsales_id?: number | null
  member_id?: number | null
  is_unencoded_sale?: boolean | null
}

interface ConvertReportToVouchersModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  report: CommissionReportSummary | null
  onConverted: () => void
}

function mapCalcTypeToSlipType(calcType?: string | null): string {
  const c = (calcType || "").toLowerCase()
  if (c.includes("non-vat") || c.includes("nonvat")) return "Non-VAT"
  if (c.includes("w/o") || c.includes("without")) return "VAT w/o Invoice"
  return "VAT w/ Invoice"
}

function num(v: any): number {
  const parsed = Number.parseFloat(String(v ?? "0").replace(/,/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

export function ConvertReportToVouchersModal({
  open,
  onOpenChange,
  report,
  onConverted,
}: ConvertReportToVouchersModalProps) {
  const { profile } = useAuth()
  const [rows, setRows] = useState<BreakdownRow[]>([])
  const [alreadyConvertedIds, setAlreadyConvertedIds] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [includeTlUm, setIncludeTlUm] = useState(true)
  const [defaultSlipType, setDefaultSlipType] = useState("auto")
  const [loading, setLoading] = useState(false)
  const [converting, setConverting] = useState(false)
  const [progressText, setProgressText] = useState("")
  const [renderVoucher, setRenderVoucher] = useState<CommissionVoucherData | null>(null)

  useEffect(() => {
    if (!open || !report?.uuid) return
    const load = async () => {
      setLoading(true)
      try {
        const [{ data: breakdowns, error: bErr }, { data: existingVouchers }] = await Promise.all([
          supabase
            .from("commission_agent_breakdown")
            .select("*")
            .eq("commission_report_uuid", report.uuid)
            .is("deleted_at", null),
          supabase
            .from("commission_vouchers")
            .select("source_agent_breakdown_uuid")
            .eq("source_commission_report_uuid", report.uuid)
            .eq("is_deleted", false),
        ])

        if (bErr) throw bErr
        const list = (breakdowns || []) as BreakdownRow[]
        const convertedSet = new Set<string>(
          (existingVouchers || [])
            .map((v: any) => v.source_agent_breakdown_uuid)
            .filter(Boolean)
        )
        setRows(list)
        setAlreadyConvertedIds(convertedSet)
        setSelectedIds(list.filter((r) => !convertedSet.has(r.uuid)).map((r) => r.uuid))
      } catch (err) {
        console.error("Failed to load breakdown rows:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open, report?.uuid])

  const toggleRow = (uuid: string) => {
    setSelectedIds((prev) =>
      prev.includes(uuid) ? prev.filter((id) => id !== uuid) : [...prev, uuid]
    )
  }

  const uploadVoucherPdfToS3 = async (voucher: CommissionVoucherData): Promise<string | null> => {
    // Render offscreen VoucherBondpaperDocument, wait two animation frames, then capture PDF
    setRenderVoucher(voucher)
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    await new Promise((resolve) => setTimeout(resolve, 80))

    const el = document.getElementById("convert-report-voucher-render")
    if (!el) return null

    const { blob } = await generateVoucherBondpaperPdf(el)
    const presignedRes = await fetch("/api/get-s3-upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: `Voucher_${voucher.voucher_number.replace(/[^\w\-]+/g, "_")}.pdf`,
        fileType: "application/pdf",
        category: "voucher",
        reportNumber: voucher.voucher_number,
        tinName: voucher.agent_name || "Agent",
        assignedArea: voucher.assigned_area || profile?.assigned_area || "Cebu",
        userFullName: profile?.full_name || "Accounting",
      }),
    })

    if (!presignedRes.ok) return null
    const { uploadUrl, publicUrl } = await presignedRes.json()
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: blob,
    })
    if (!putRes.ok) return null
    return formatS3Url(publicUrl)
  }

  const handleConvert = async () => {
    if (!report || selectedIds.length === 0) return
    setConverting(true)
    let createdCount = 0

    try {
      const targetRows = rows.filter((r) => selectedIds.includes(r.uuid))
      const basePrefix = `CR${report.report_number}`

      for (let i = 0; i < targetRows.length; i++) {
        const row = targetRows[i]
        setProgressText(`Generating slip PDF ${i + 1} of ${targetRows.length} (${row.agent_name})...`)

        const slipType =
          defaultSlipType === "auto" ? mapCalcTypeToSlipType(row.calculation_type) : defaultSlipType

        const agentVoucherNumber = `${basePrefix}-${String(i + 1).padStart(2, "0")}`
        const agentData: CommissionVoucherData = {
          voucher_number: agentVoucherNumber,
          slip_type: slipType,
          lrsales_id: row.lrsales_id || null,
          member_id: row.member_id || null,
          developer_name: row.developer || "",
          developer_rate: num(row.developers_rate) || 5,
          agent_name: row.agent_name || "",
          agent_rate: num(row.agents_rate) || 4,
          project_name: "",
          unit_number: "",
          client_name: row.client || "",
          reservation_date: row.reservation_date || null,
          amount_released: num(row.agent_amount) || num(row.comm),
          total_amount: num(row.agent_net_comm),
          exclusive_of_vat: num(row.net_of_vat),
          withholding_tax: num(row.agent_ewt),
          vat_amount: num(row.agent_vat),
          ewt_rate: num(row.agent_ewt_rate) || 10,
          commission_status: row.status || `Converted from Report #${report.report_number}`,
          source_commission_report_uuid: report.uuid,
          source_commission_report_number: report.report_number,
          source_agent_breakdown_uuid: row.uuid,
          is_converted_from_report: true,
          is_unencoded_sale: Boolean(row.is_unencoded_sale || !row.lrsales_id),
          recipient_role: "agent",
          assigned_area: report.assigned_area || profile?.assigned_area || null,
        }

        const agentPdfUrl = await uploadVoucherPdfToS3(agentData)

        const { data: insertedAgent, error: insertAgentErr } = await supabase
          .from("commission_vouchers")
          .insert([
            {
              voucher_number: agentData.voucher_number,
              slip_type: agentData.slip_type,
              lrsales_id: agentData.lrsales_id,
              member_id: agentData.member_id,
              developer_name: agentData.developer_name,
              developer_rate: agentData.developer_rate,
              agent_name: agentData.agent_name,
              agent_rate: agentData.agent_rate,
              project_name: agentData.project_name,
              unit_number: agentData.unit_number,
              client_name: agentData.client_name,
              reservation_date: agentData.reservation_date,
              amount_released: agentData.amount_released,
              total_amount: agentData.total_amount,
              exclusive_of_vat: agentData.exclusive_of_vat,
              withholding_tax: agentData.withholding_tax,
              vat_amount: agentData.vat_amount,
              ewt_rate: agentData.ewt_rate,
              commission_status: agentData.commission_status,
              generated_pdf_url: agentPdfUrl,
              attachments: [],
              source_commission_report_uuid: report.uuid,
              source_commission_report_number: report.report_number,
              source_agent_breakdown_uuid: row.uuid,
              is_converted_from_report: true,
              is_unencoded_sale: agentData.is_unencoded_sale,
              recipient_role: "agent",
              created_by_uuid: profile?.auth_user_id || profile?.id || null,
              created_by_name: profile?.full_name || null,
              created_by_email: profile?.email || null,
              assigned_area: agentData.assigned_area,
            },
          ])
          .select("id")
          .single()

        if (insertAgentErr) throw insertAgentErr
        createdCount++

        // Optional linked Team Leader voucher
        if (includeTlUm && row.tl_name && num(row.tl_net_comm) > 0) {
          const tlData: CommissionVoucherData = {
            ...agentData,
            voucher_number: `${agentVoucherNumber}-TL`,
            agent_name: row.tl_name,
            agent_rate: num(row.tl_rate) || 0,
            developer_rate: num(row.tl_developers_rate) || agentData.developer_rate,
            amount_released: num(row.tl_amount),
            total_amount: num(row.tl_net_comm),
            withholding_tax: num(row.tl_ewt),
            vat_amount: num(row.tl_vat),
            ewt_rate: num(row.tl_ewt_rate) || 10,
            commission_status: `Team Leader Share (Report #${report.report_number})`,
            recipient_role: "team_leader",
            parent_voucher_id: insertedAgent.id,
          }
          const tlPdfUrl = await uploadVoucherPdfToS3(tlData)
          await supabase.from("commission_vouchers").insert([
            {
              voucher_number: tlData.voucher_number,
              slip_type: tlData.slip_type,
              lrsales_id: tlData.lrsales_id,
              developer_name: tlData.developer_name,
              developer_rate: tlData.developer_rate,
              agent_name: tlData.agent_name,
              agent_rate: tlData.agent_rate,
              project_name: tlData.project_name,
              unit_number: tlData.unit_number,
              client_name: tlData.client_name,
              reservation_date: tlData.reservation_date,
              amount_released: tlData.amount_released,
              total_amount: tlData.total_amount,
              exclusive_of_vat: tlData.exclusive_of_vat,
              withholding_tax: tlData.withholding_tax,
              vat_amount: tlData.vat_amount,
              ewt_rate: tlData.ewt_rate,
              commission_status: tlData.commission_status,
              generated_pdf_url: tlPdfUrl,
              attachments: [],
              source_commission_report_uuid: report.uuid,
              source_commission_report_number: report.report_number,
              source_agent_breakdown_uuid: row.uuid,
              is_converted_from_report: true,
              is_unencoded_sale: tlData.is_unencoded_sale,
              recipient_role: "team_leader",
              parent_voucher_id: insertedAgent.id,
              created_by_uuid: profile?.auth_user_id || profile?.id || null,
              created_by_name: profile?.full_name || null,
              created_by_email: profile?.email || null,
              assigned_area: tlData.assigned_area,
            },
          ])
          createdCount++
        }

        // Optional linked Unit Manager voucher
        if (includeTlUm && row.um_name && num(row.um_net_comm) > 0) {
          const umData: CommissionVoucherData = {
            ...agentData,
            voucher_number: `${agentVoucherNumber}-UM`,
            agent_name: row.um_name,
            agent_rate: num(row.um_rate) || 0,
            developer_rate: num(row.um_developers_rate) || agentData.developer_rate,
            amount_released: num(row.um_amount),
            total_amount: num(row.um_net_comm),
            withholding_tax: num(row.um_ewt),
            vat_amount: num(row.um_vat),
            ewt_rate: num(row.um_ewt_rate) || 10,
            commission_status: `Unit Manager Share (Report #${report.report_number})`,
            recipient_role: "unit_manager",
            parent_voucher_id: insertedAgent.id,
          }
          const umPdfUrl = await uploadVoucherPdfToS3(umData)
          await supabase.from("commission_vouchers").insert([
            {
              voucher_number: umData.voucher_number,
              slip_type: umData.slip_type,
              lrsales_id: umData.lrsales_id,
              developer_name: umData.developer_name,
              developer_rate: umData.developer_rate,
              agent_name: umData.agent_name,
              agent_rate: umData.agent_rate,
              project_name: umData.project_name,
              unit_number: umData.unit_number,
              client_name: umData.client_name,
              reservation_date: umData.reservation_date,
              amount_released: umData.amount_released,
              total_amount: umData.total_amount,
              exclusive_of_vat: umData.exclusive_of_vat,
              withholding_tax: umData.withholding_tax,
              vat_amount: umData.vat_amount,
              ewt_rate: umData.ewt_rate,
              commission_status: umData.commission_status,
              generated_pdf_url: umPdfUrl,
              attachments: [],
              source_commission_report_uuid: report.uuid,
              source_commission_report_number: report.report_number,
              source_agent_breakdown_uuid: row.uuid,
              is_converted_from_report: true,
              is_unencoded_sale: umData.is_unencoded_sale,
              recipient_role: "unit_manager",
              parent_voucher_id: insertedAgent.id,
              created_by_uuid: profile?.auth_user_id || profile?.id || null,
              created_by_name: profile?.full_name || null,
              created_by_email: profile?.email || null,
              assigned_area: umData.assigned_area,
            },
          ])
          createdCount++
        }
      }

      if (profile?.id) {
        await logNotification(supabase, {
          action: "commission_report_converted_to_vouchers",
          description: `Converted Commission Report #${report.report_number} into ${createdCount} Commission Voucher slip(s)`,
          user_email: profile.email || "",
          user_name: profile.full_name || profile.first_name || profile.id,
          user_uuid: profile.id,
          meta: JSON.stringify({
            report_uuid: report.uuid,
            report_number: report.report_number,
            created_vouchers_count: createdCount,
          }),
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
        })
      }

      alert(
        `Converted Commission Report #${report.report_number} into ${createdCount} Commission Voucher record(s) with generated Bondpaper PDFs!`
      )
      onOpenChange(false)
      onConverted()
    } catch (err: any) {
      console.error("Error converting report to vouchers:", err)
      alert("Conversion failed: " + (err?.message || "Please try again."))
    } finally {
      setRenderVoucher(null)
      setProgressText("")
      setConverting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !converting && onOpenChange(o)}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white text-[#001f3f]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600" />
            Convert Commission Report #{report?.report_number} to Vouchers
          </DialogTitle>
          <DialogDescription>
            Automatically creates traceable Commission Voucher records and generates Bondpaper Slip
            PDFs. Converted vouchers are flagged with <code>is_converted_from_report = true</code>{" "}
            and linked to Report #{report?.report_number} so future statistics will never
            double-count them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-semibold">Slip Type:</Label>
              <Select value={defaultSlipType} onValueChange={setDefaultSlipType}>
                <SelectTrigger className="w-48 h-8 text-xs bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (from Breakdown)</SelectItem>
                  <SelectItem value="VAT w/ Invoice">VAT w/ Invoice</SelectItem>
                  <SelectItem value="VAT w/o Invoice">VAT w/o Invoice</SelectItem>
                  <SelectItem value="VAT without Rate">VAT without Rate</SelectItem>
                  <SelectItem value="Non-VAT">Non-VAT</SelectItem>
                  <SelectItem value="W/o Invoice">W/o Invoice</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <Checkbox
                checked={includeTlUm}
                onCheckedChange={(v) => setIncludeTlUm(Boolean(v))}
              />
              Also generate linked Team Leader &amp; Unit Manager vouchers (when present)
            </label>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
              Loading report breakdown...
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No agent breakdown rows found for this commission report.
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100">
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Developer / Client</TableHead>
                    <TableHead className="text-right">Agent Net</TableHead>
                    <TableHead>TL / UM Shares</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const converted = alreadyConvertedIds.has(r.uuid)
                    const checked = selectedIds.includes(r.uuid)
                    return (
                      <TableRow key={r.uuid} className={converted ? "bg-emerald-50/40" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleRow(r.uuid)}
                            disabled={converting}
                          />
                        </TableCell>
                        <TableCell className="text-xs font-semibold">
                          {r.agent_name}
                          <div className="text-[10px] text-slate-500 font-normal">
                            Rate: {r.agents_rate || 0}%
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="font-medium">{r.developer || "—"}</div>
                          <div className="text-[11px] text-slate-500">{r.client || "—"}</div>
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold text-emerald-700">
                          ₱{num(r.agent_net_comm).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-[11px] text-slate-600">
                          {r.tl_name && num(r.tl_net_comm) > 0 && (
                            <div>
                              TL: {r.tl_name} (₱{num(r.tl_net_comm).toLocaleString("en-PH", { minimumFractionDigits: 2 })})
                            </div>
                          )}
                          {r.um_name && num(r.um_net_comm) > 0 && (
                            <div>
                              UM: {r.um_name} (₱{num(r.um_net_comm).toLocaleString("en-PH", { minimumFractionDigits: 2 })})
                            </div>
                          )}
                          {(!r.tl_name || num(r.tl_net_comm) <= 0) &&
                            (!r.um_name || num(r.um_net_comm) <= 0) && <span className="text-slate-400">—</span>}
                        </TableCell>
                        <TableCell>
                          {converted ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px]">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Already Converted
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {progressText && (
            <div className="rounded-md bg-sky-50 border border-sky-200 px-3 py-2 text-xs text-sky-900 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
              {progressText}
            </div>
          )}
        </div>

        {/* Offscreen Bondpaper Renderer for PDF generation */}
        {renderVoucher && (
          <div style={{ position: "fixed", left: "-10000px", top: 0, width: "794px", background: "#fff" }}>
            <VoucherBondpaperDocument
              voucher={renderVoucher}
              containerId="convert-report-voucher-render"
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={converting}>
            Cancel
          </Button>
          <Button
            onClick={handleConvert}
            disabled={converting || selectedIds.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            {converting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Converting &amp; Generating PDFs...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Convert {selectedIds.length} Row(s) to Vouchers
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
