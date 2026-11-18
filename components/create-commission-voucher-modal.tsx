"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Search,
  Loader2,
  Paperclip,
  Eye,
  Save,
  X,
  CheckCircle2,
  Pencil,
  FileText,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase/client"
import { logNotification } from "@/utils/logNotification"
import { formatS3Url } from "@/utils/s3-url"
import {
  VoucherDocumentCropper,
  type CroppedAttachmentResult,
} from "@/components/voucher-document-cropper"
import {
  VoucherBondpaperDocument,
  generateVoucherBondpaperPdf,
  openVoucherBondpaperPdfPreview,
  type CommissionVoucherData,
} from "@/components/voucher-bondpaper-document"

interface SearchResult {
  id: number
  name: string
  clientfamilyname: string
  unitnum: string
  developer: string
  devid: number
  projectname: string
  projid: number
  tcprice: number
  compercent: string
  reservationdate: string
  agentid: number
}

export type SlipTypeOption =
  | "Non-VAT"
  | "VAT w/ Invoice"
  | "VAT w/o Invoice"
  | "W/o Invoice"
  | "Rate w/o Invoice"

interface CreateCommissionVoucherModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onVoucherSaved: () => void
  editVoucher?: CommissionVoucherData | null
}

export function CreateCommissionVoucherModal({
  open,
  onOpenChange,
  onVoucherSaved,
  editVoucher,
}: CreateCommissionVoucherModalProps) {
  const isEditMode = Boolean(editVoucher?.id)
  const { profile } = useAuth()
  const currentYear = new Date().getFullYear()

  // Search state (copied from CommissionGenerationModal)
  const [searchData, setSearchData] = useState({
    agentName: "",
    developerName: "",
    clientName: "",
    year: "all",
  })
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedSale, setSelectedSale] = useState<SearchResult | null>(null)

  // Commission Slip Details
  const [voucherNumber, setVoucherNumber] = useState("")
  const [slipType, setSlipType] = useState<SlipTypeOption>("VAT w/ Invoice")
  const [developerName, setDeveloperName] = useState("")
  const [developerRate, setDeveloperRate] = useState("5")
  const [agentName, setAgentName] = useState("")
  const [agentRate, setAgentRate] = useState("4")
  const [projectName, setProjectName] = useState("")
  const [editingProject, setEditingProject] = useState(false)
  const [unitNumber, setUnitNumber] = useState("")
  const [manualUnitMode, setManualUnitMode] = useState(false)
  const [clientName, setClientName] = useState("")
  const [reservationDate, setReservationDate] = useState("")
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null)
  const [amountReleased, setAmountReleased] = useState("0")
  const [commissionStatus, setCommissionStatus] = useState("")

  // Attachments & Cropping state
  const [voucherAttachment, setVoucherAttachment] = useState<CroppedAttachmentResult | null>(null)
  const [headerAttachment, setHeaderAttachment] = useState<CroppedAttachmentResult | null>(null)
  const [cropperOpen, setCropperOpen] = useState(false)
  const [cropperTarget, setCropperTarget] = useState<"voucher" | "header">("voucher")
  const [cropperFile, setCropperFile] = useState<File | null>(null)

  // Save & Preview states
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [showLiveBondpaper, setShowLiveBondpaper] = useState(false)

  const yearOptions = useMemo(() => {
    const years = []
    for (let i = 0; i < 20; i++) years.push(currentYear - i)
    return years
  }, [currentYear])

  // Unit options extracted from selectedSale (handles comma/slash separated or single unit)
  const availableUnitOptions = useMemo(() => {
    if (!selectedSale?.unitnum) return []
    const raw = String(selectedSale.unitnum).trim()
    if (!raw) return []
    return raw
      .split(/[,;/]+/)
      .map((u) => u.trim())
      .filter(Boolean)
  }, [selectedSale])

  // Unique agents extracted from searchResults for manual/unencoded sale selection
  const uniqueAgents = useMemo(() => {
    const map = new Map<string, { name: string; agentid: number }>()
    for (const r of searchResults) {
      const n = (r.name || "").trim()
      if (!n) continue
      const key = `${r.agentid || 0}-${n.toLowerCase()}`
      if (!map.has(key)) {
        map.set(key, { name: n, agentid: r.agentid })
      }
    }
    return Array.from(map.values())
  }, [searchResults])

  // Reset or populate form on open
  useEffect(() => {
    if (!open) return
    setSearchResults([])
    setHasSearched(false)
    setSelectedSale(null)
    setShowLiveBondpaper(false)

    if (editVoucher) {
      setSelectedAgentId(editVoucher.member_id || null)
      setVoucherNumber(editVoucher.voucher_number || "")
      setSlipType((editVoucher.slip_type as SlipTypeOption) || "VAT w/ Invoice")
      setDeveloperName(editVoucher.developer_name || "")
      setDeveloperRate(String(editVoucher.developer_rate ?? 5))
      setAgentName(editVoucher.agent_name || "")
      setAgentRate(String(editVoucher.agent_rate ?? 4))
      setProjectName(editVoucher.project_name || "")
      setEditingProject(true)
      setUnitNumber(editVoucher.unit_number || "")
      setManualUnitMode(true)
      setClientName(editVoucher.client_name || "")
      setReservationDate(normalizeDateForInput(editVoucher.reservation_date))
      setAmountReleased(String(editVoucher.amount_released ?? 0))
      setCommissionStatus(editVoucher.commission_status || "")
      setVoucherAttachment(
        editVoucher.voucher_attachment_url
          ? {
              dataUrl: formatS3Url(editVoucher.voucher_attachment_url),
              fileName: "Existing Voucher Attachment",
              fileSize: 0,
              width: 0,
              height: 0,
            }
          : null
      )
      setHeaderAttachment(
        editVoucher.header_attachment_url
          ? {
              dataUrl: formatS3Url(editVoucher.header_attachment_url),
              fileName: "Existing Header Attachment",
              fileSize: 0,
              width: 0,
              height: 0,
            }
          : null
      )
      return
    }

    setSelectedAgentId(null)
    setVoucherNumber("")
    setSlipType("VAT w/ Invoice")
    setDeveloperName("")
    setDeveloperRate("5")
    setAgentName("")
    setAgentRate("4")
    setProjectName("")
    setEditingProject(false)
    setUnitNumber("")
    setManualUnitMode(false)
    setClientName("")
    setReservationDate("")
    setAmountReleased("0")
    setCommissionStatus("")
    setVoucherAttachment(null)
    setHeaderAttachment(null)
  }, [open, editVoucher])

  // Search commission records using the exact same endpoint as CommissionGenerationModal
  const handleSearch = async () => {
    if (!searchData.developerName && !searchData.agentName && !searchData.clientName) {
      alert("Please enter at least a Developer Name, Agent Name, or Client Name to search.")
      return
    }
    setIsSearching(true)
    setHasSearched(true)
    try {
      const params = new URLSearchParams()
      if (searchData.agentName.trim()) params.append("name", searchData.agentName.trim())
      if (searchData.year && searchData.year !== "all") params.append("year", searchData.year)
      if (searchData.developerName.trim()) params.append("developer", searchData.developerName.trim())
      if (searchData.clientName.trim()) params.append("clientfamilyname", searchData.clientName.trim())

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_NEXT_API_ROUTE_LR}/search-sales-report?${params}`
      )
      if (response.ok) {
        const results = await response.json()
        setSearchResults(Array.isArray(results) ? results : [])
      } else {
        setSearchResults([])
      }
    } catch (error) {
      console.error("Search error:", error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const normalizeDateForInput = (raw?: string | null): string => {
    const trimmed = (raw || "").trim()
    if (!trimmed) return ""
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
    const parsed = new Date(trimmed)
    if (Number.isNaN(parsed.getTime())) return ""
    const y = parsed.getFullYear()
    const m = String(parsed.getMonth() + 1).padStart(2, "0")
    const d = String(parsed.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }

  const handleSelectSale = (sale: SearchResult) => {
    setSelectedSale(sale)
    setSelectedAgentId(sale.agentid || null)
    setDeveloperName(sale.developer || "")
    setAgentName(sale.name || "")
    setProjectName(sale.projectname || "")
    setClientName(sale.clientfamilyname || "")
    setReservationDate(normalizeDateForInput(sale.reservationdate))
    const saleUnit = (sale.unitnum || "").trim()
    if (saleUnit) {
      const firstUnit = saleUnit.split(/[,;/]+/)[0]?.trim() || saleUnit
      setUnitNumber(firstUnit)
      setManualUnitMode(false)
    } else {
      setUnitNumber("")
      setManualUnitMode(true)
    }
    if (sale.compercent && Number(sale.compercent) > 0) {
      setDeveloperRate(String(sale.compercent))
    } else {
      setDeveloperRate("5")
    }
  }

  const handleSelectAgentOnly = (agent: { name: string; agentid: number }) => {
    setSelectedSale(null)
    setSelectedAgentId(agent.agentid || null)
    setAgentName(agent.name)
    setDeveloperName("")
    setDeveloperRate("5")
    setProjectName("")
    setEditingProject(true)
    setUnitNumber("")
    setManualUnitMode(true)
    setClientName("")
    setReservationDate("")
    setAmountReleased("0")
    setCommissionStatus("")
  }

  const handleStartManualSale = () => {
    setSelectedSale(null)
    setSelectedAgentId(null)
    setAgentName("")
    setDeveloperName("")
    setDeveloperRate("5")
    setProjectName("")
    setEditingProject(true)
    setUnitNumber("")
    setManualUnitMode(true)
    setClientName("")
    setReservationDate("")
    setAmountReleased("0")
    setCommissionStatus("")
  }

  // Exact Commission Generator formulas applied to the slip
  const calculations = useMemo(() => {
    const comm = Number.parseFloat(amountReleased.replace(/,/g, "")) || 0
    const devRate = Number.parseFloat(developerRate) || 5
    const agRate = Number.parseFloat(agentRate) || 0

    let total = 0
    let exclusiveOfVat = 0
    let withholdingTax = 0
    let vatAmount = 0
    let ewtRate = 0

    if (comm > 0 && devRate > 0 && agRate > 0) {
      if (slipType === "VAT w/ Invoice") {
        // Matches CommissionGenerationModal "vat with invoice"
        const agentGross = (comm * agRate) / devRate
        total = agentGross
        exclusiveOfVat = total / 1.02
        withholdingTax = (total / 1.02) * 0.1
        ewtRate = 10
      } else if (slipType === "Non-VAT") {
        // Matches CommissionGenerationModal "nonvat with invoice"
        const netOfVat = comm / 1.02
        const agentGross = (netOfVat * agRate) / devRate
        ewtRate = 5
        withholdingTax = agentGross * 0.05
        total = agentGross - withholdingTax
        exclusiveOfVat = netOfVat
      } else if (slipType === "VAT w/o Invoice") {
        // Matches CommissionGenerationModal "vat deduction"
        const agentGross = (comm * agRate) / devRate
        total = agentGross / 1.12
        vatAmount = total * 0.12
        exclusiveOfVat = total
        withholdingTax = 0
        ewtRate = 0
      } else {
        // "W/o Invoice" or "Rate w/o Invoice" -> matches "nonvat without invoice"
        total = (comm * agRate) / devRate
        exclusiveOfVat = total
        withholdingTax = 0
        ewtRate = 0
      }
    }

    return {
      comm,
      total,
      exclusiveOfVat,
      withholdingTax,
      vatAmount,
      ewtRate,
    }
  }, [amountReleased, developerRate, agentRate, slipType])

  const formatNum = (n: number) =>
    new Intl.NumberFormat("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n || 0)

  const handleFilePick = (target: "voucher" | "header", files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setCropperTarget(target)
    setCropperFile(file)
    setCropperOpen(true)
  }

  const voucherModel: CommissionVoucherData = {
    voucher_number: voucherNumber,
    slip_type: slipType,
    lrsales_id: selectedSale?.id || null,
    member_id: selectedSale?.agentid || selectedAgentId || null,
    developer_name: developerName,
    developer_rate: Number.parseFloat(developerRate) || 5,
    agent_name: agentName,
    agent_rate: Number.parseFloat(agentRate) || 4,
    project_name: projectName,
    unit_number: unitNumber,
    client_name: clientName,
    reservation_date: reservationDate.trim() || null,
    amount_released: calculations.comm,
    total_amount: calculations.total,
    exclusive_of_vat: calculations.exclusiveOfVat,
    withholding_tax: calculations.withholdingTax,
    vat_amount: calculations.vatAmount,
    ewt_rate: calculations.ewtRate,
    commission_status: commissionStatus,
    voucher_attachment_url: voucherAttachment?.dataUrl || null,
    header_attachment_url: headerAttachment?.dataUrl || null,
  }

  const handlePreviewPdf = async () => {
    const el = document.getElementById("create-voucher-bondpaper-hidden")
    if (!el) return
    setPreviewing(true)
    try {
      await openVoucherBondpaperPdfPreview(el)
    } catch (err) {
      console.error("Preview PDF error:", err)
      alert("Error generating PDF preview.")
    } finally {
      setPreviewing(false)
    }
  }

  const uploadBlobToS3 = async (
    blob: Blob,
    fileName: string,
    contentType: string
  ): Promise<string> => {
    const presignedRes = await fetch("/api/get-s3-upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName,
        fileType: contentType,
        category: "voucher",
        reportNumber: voucherNumber || "Voucher",
        tinName: agentName || "Agent",
        assignedArea: profile?.assigned_area || "Cebu",
        userFullName: profile?.full_name || "Accounting",
      }),
    })

    if (!presignedRes.ok) {
      throw new Error("Failed to get S3 upload authorization")
    }

    const { uploadUrl, publicUrl } = await presignedRes.json()

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: blob,
    })

    if (!putRes.ok) {
      throw new Error(`S3 upload failed (${putRes.status})`)
    }

    return formatS3Url(publicUrl)
  }

  const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
    const res = await fetch(dataUrl)
    return res.blob()
  }

  const handleSaveVoucher = async () => {
    if (!agentName.trim() || !developerName.trim()) {
      alert("Please search and select a sale/agent record first (or enter Developer and Salesperson).")
      return
    }
    if (!voucherNumber.trim()) {
      alert("Please enter a Voucher No.")
      return
    }

    setSaving(true)
    try {
      // 1. Upload cropped voucher & header images to S3 (only if newly cropped data URL; preserve existing S3 URL)
      let voucherImgUrl: string | null = null
      let headerImgUrl: string | null = null

      if (voucherAttachment?.dataUrl) {
        if (voucherAttachment.dataUrl.startsWith("data:")) {
          const vBlob = await dataUrlToBlob(voucherAttachment.dataUrl)
          voucherImgUrl = await uploadBlobToS3(
            vBlob,
            `voucher-crop-${voucherNumber}.png`,
            "image/png"
          )
        } else {
          voucherImgUrl = voucherAttachment.dataUrl
        }
      }

      if (headerAttachment?.dataUrl) {
        if (headerAttachment.dataUrl.startsWith("data:")) {
          const hBlob = await dataUrlToBlob(headerAttachment.dataUrl)
          headerImgUrl = await uploadBlobToS3(
            hBlob,
            `header-crop-${voucherNumber}.png`,
            "image/png"
          )
        } else {
          headerImgUrl = headerAttachment.dataUrl
        }
      }

      // 2. Generate the A4 Bondpaper PDF and upload it to S3 as the voucher's PDF attachment
      let generatedPdfUrl: string | null = null
      const docEl = document.getElementById("create-voucher-bondpaper-hidden")
      if (docEl) {
        const { blob } = await generateVoucherBondpaperPdf(docEl)
        generatedPdfUrl = await uploadBlobToS3(
          blob,
          `Commission_Voucher_${voucherNumber}.pdf`,
          "application/pdf"
        )
      }

      const attachmentsList = [generatedPdfUrl, voucherImgUrl, headerImgUrl].filter(
        Boolean
      ) as string[]

      const insertPayload = {
        voucher_number: voucherNumber.trim(),
        slip_type: slipType,
        lrsales_id: selectedSale?.id ?? editVoucher?.lrsales_id ?? null,
        member_id: selectedSale?.agentid ?? selectedAgentId ?? editVoucher?.member_id ?? null,
        developer_name: developerName.trim(),
        developer_rate: Number.parseFloat(developerRate) || 5,
        agent_name: agentName.trim(),
        agent_rate: Number.parseFloat(agentRate) || 4,
        project_name: projectName.trim(),
        unit_number: unitNumber.trim(),
        client_name: clientName.trim(),
        reservation_date: reservationDate.trim() || null,
        amount_released: calculations.comm,
        total_amount: calculations.total,
        exclusive_of_vat: calculations.exclusiveOfVat,
        withholding_tax: calculations.withholdingTax,
        vat_amount: calculations.vatAmount,
        ewt_rate: calculations.ewtRate,
        commission_status: commissionStatus.trim() || null,
        voucher_attachment_url: voucherImgUrl,
        header_attachment_url: headerImgUrl,
        generated_pdf_url: generatedPdfUrl,
        attachments: attachmentsList,
        ...(isEditMode
          ? {}
          : {
              created_by_uuid: profile?.auth_user_id || profile?.id || null,
              created_by_name: profile?.full_name || null,
              created_by_email: profile?.email || null,
              assigned_area: profile?.assigned_area || null,
            }),
      }

      const executeMutation = async (payload: Record<string, any>) => {
        if (isEditMode && editVoucher?.id) {
          return supabase.from("commission_vouchers").update(payload).eq("id", editVoucher.id)
        }
        return supabase.from("commission_vouchers").insert([payload])
      }

      let { error } = await executeMutation(insertPayload)
      if (error && /reservation_date/i.test(error.message || "")) {
        const { reservation_date: _omitted, ...fallbackPayload } = insertPayload
        const retry = await executeMutation(fallbackPayload)
        error = retry.error
      }
      if (error) throw error

      if (profile?.id) {
        await logNotification(supabase, {
          action: isEditMode ? "commission_voucher_updated" : "commission_voucher_created",
          description: `Commission Voucher #${voucherNumber} ${isEditMode ? "updated" : "created"} for ${agentName} (${developerName} - ${clientName})`,
          ip_address: null,
          location: null,
          meta: JSON.stringify({
            voucherNumber,
            agentName,
            developerName,
            totalAmount: calculations.total,
          }),
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
          user_email: profile.email,
          user_name: profile.full_name || profile.first_name || profile.id,
          user_uuid: profile.id,
        })
      }

      alert(
        `Commission Voucher #${voucherNumber} ${isEditMode ? "updated" : "saved"} with generated PDF attachment!`
      )
      onOpenChange(false)
      onVoucherSaved()
    } catch (error: any) {
      console.error("Error saving commission voucher:", error)
      alert("Error saving voucher: " + (error?.message || "Please try again."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && cropperOpen) return
          onOpenChange(nextOpen)
        }}
      >
        <DialogContent
          className="max-w-6xl max-h-[94vh] overflow-y-auto bg-white text-[#001f3f]"
          onInteractOutside={(e) => {
            if (cropperOpen) e.preventDefault()
          }}
          onPointerDownOutside={(e) => {
            if (cropperOpen) e.preventDefault()
          }}
          onEscapeKeyDown={(e) => {
            if (cropperOpen) e.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#001f3f]">
              {isEditMode ? `Edit Commission Voucher #${editVoucher?.voucher_number}` : "Create Commission Voucher"}
            </DialogTitle>
            <p className="text-sm text-slate-600">
              Search for the agent &amp; sale record, configure the commission slip details, attach &amp; crop the voucher and header, and generate the single-page bondpaper PDF.
            </p>
          </DialogHeader>

          <div className="space-y-6">
            {/* 1. Search Commission Records (copied from CommissionGenerationModal) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[#001f3f] flex items-center gap-2">
                  <Search className="w-4 h-4 text-[#0284c7]" />
                  Search Commission Records (Agent &amp; Sale)
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedSale ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Selected: {selectedSale.name} &bull; {selectedSale.clientfamilyname}
                    </Badge>
                  ) : selectedAgentId && agentName ? (
                    <Badge className="bg-amber-100 text-amber-900 border border-amber-300">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Manual Sale for Agent: {agentName} (ID: {selectedAgentId})
                    </Badge>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleStartManualSale}
                    className="h-7 text-xs border-slate-300 text-[#001f3f] bg-white hover:bg-slate-100"
                  >
                    Manual / Unencoded Sale
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div>
                  <Label className="text-xs font-semibold text-[#001f3f]">Agent Name</Label>
                  <Input
                    placeholder="Enter agent name..."
                    value={searchData.agentName}
                    onChange={(e) => setSearchData({ ...searchData, agentName: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="bg-white text-[#001f3f] border-slate-300 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-[#001f3f]">Developer Name</Label>
                  <Input
                    placeholder="Enter developer name..."
                    value={searchData.developerName}
                    onChange={(e) => setSearchData({ ...searchData, developerName: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="bg-white text-[#001f3f] border-slate-300 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-[#001f3f]">Client Name</Label>
                  <Input
                    placeholder="Enter client name..."
                    value={searchData.clientName}
                    onChange={(e) => setSearchData({ ...searchData, clientName: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="bg-white text-[#001f3f] border-slate-300 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-[#001f3f]">Year</Label>
                  <Select
                    value={searchData.year}
                    onValueChange={(val) => setSearchData({ ...searchData, year: val })}
                  >
                    <SelectTrigger className="bg-white text-[#001f3f] border-slate-300 mt-1">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="all">All Years</SelectItem>
                      {yearOptions.map((yr) => (
                        <SelectItem key={yr} value={yr.toString()}>
                          {yr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={handleSearch}
                    disabled={isSearching}
                    className="bg-[#001f3f] hover:bg-[#001f3f]/90 text-white flex-1"
                  >
                    {isSearching ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    ) : (
                      <Search className="w-4 h-4 mr-1.5" />
                    )}
                    Search
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSearchResults([])
                      setHasSearched(false)
                      setSearchData({
                        agentName: "",
                        developerName: "",
                        clientName: "",
                        year: "all",
                      })
                    }}
                    className="border-slate-300 text-slate-700 bg-white"
                  >
                    Clear
                  </Button>
                </div>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="border-t border-slate-200 pt-3 space-y-3">
                  {uniqueAgents.length > 0 && (
                    <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-2.5 space-y-1.5">
                      <div className="text-[11px] font-semibold text-amber-900">
                        Select Agent Only (Encode Unencoded Sale Manually):
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {uniqueAgents.map((agent) => {
                          const isAgentOnly =
                            !selectedSale &&
                            selectedAgentId === agent.agentid &&
                            agentName.toLowerCase() === agent.name.toLowerCase()
                          return (
                            <Button
                              key={`${agent.agentid}-${agent.name}`}
                              type="button"
                              size="sm"
                              variant={isAgentOnly ? "default" : "outline"}
                              onClick={() => handleSelectAgentOnly(agent)}
                              className={
                                isAgentOnly
                                  ? "h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                                  : "h-7 text-xs bg-white border-amber-300 text-amber-900 hover:bg-amber-100"
                              }
                            >
                              {agent.name} (ID: {agent.agentid})
                            </Button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="text-xs font-semibold text-slate-600">
                    Search Results ({searchResults.length}) — Click a record to populate the Commission Slip:
                  </div>
                  <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                    {searchResults.map((res) => {
                      const isPicked = selectedSale?.id === res.id
                      return (
                        <div
                          key={res.id}
                          onClick={() => handleSelectSale(res)}
                          className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                            isPicked
                              ? "bg-sky-50 border-[#0284c7] shadow-sm"
                              : "bg-white border-slate-200 hover:bg-slate-100/70"
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-[#001f3f]">{res.name}</span>
                              <Badge variant="outline" className="text-[10px] text-slate-600">
                                Agent ID: {res.agentid}
                              </Badge>
                            </div>
                            <div className="text-xs text-slate-700">
                              <strong>Client:</strong> {res.clientfamilyname} &bull;{" "}
                              <strong>Developer:</strong> {res.developer}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              <strong>Project:</strong> {res.projectname || "N/A"} &bull;{" "}
                              <strong>Unit:</strong> {res.unitnum || "N/A"} &bull;{" "}
                              <strong>Reservation:</strong> {res.reservationdate || "N/A"}
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            className={
                              isPicked
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                : "bg-[#001f3f] hover:bg-[#001f3f]/90 text-white"
                            }
                          >
                            {isPicked ? "Selected" : "Select Sale"}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {hasSearched && !isSearching && searchResults.length === 0 && (
                <div className="border-t border-slate-200 pt-3 text-center text-xs text-slate-500">
                  No sales found matching your search criteria. Try setting <strong>Year</strong> to <strong>All Years</strong> or broadening your search.
                </div>
              )}
            </div>

            {/* 2. Commission Slip Details Card */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              {/* Card Header */}
              <div className="bg-[#001f3f] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-5 h-5 text-sky-300" />
                  <div>
                    <h3 className="text-base font-bold tracking-tight">Commission Slip Details</h3>
                    <p className="text-[11px] text-slate-300">
                      Configure rates, slip calculation type, unit number, and released amount
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-sky-200">Voucher No. *</span>
                  <Input
                    value={voucherNumber}
                    onChange={(e) => setVoucherNumber(e.target.value)}
                    placeholder="e.g. 123"
                    className="w-36 h-8 bg-white text-[#001f3f] border-0 font-bold text-center"
                  />
                </div>
              </div>

              <div className="p-5 space-y-5">
                {/* Row 1: Project, Unit No, Slip Type */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#001f3f]">Project</Label>
                    <Input
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="Enter or select project..."
                      className="bg-white text-[#001f3f] border-slate-300 font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-[#001f3f]">Unit No.</Label>
                      {availableUnitOptions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setManualUnitMode(!manualUnitMode)}
                          className="text-[11px] text-[#0284c7] hover:underline font-semibold"
                        >
                          {manualUnitMode ? "Select encoded unit" : "Manual input"}
                        </button>
                      )}
                    </div>
                    {!manualUnitMode && availableUnitOptions.length > 0 ? (
                      <Select value={unitNumber} onValueChange={setUnitNumber}>
                        <SelectTrigger className="bg-white text-[#001f3f] border-slate-300">
                          <SelectValue placeholder="Select Unit No." />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          {availableUnitOptions.map((u) => (
                            <SelectItem key={u} value={u}>
                              {u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={unitNumber}
                        onChange={(e) => setUnitNumber(e.target.value)}
                        placeholder="Enter Unit No."
                        className="bg-white text-[#001f3f] border-slate-300"
                      />
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#001f3f]">Slip Type (Formula) *</Label>
                    <Select
                      value={slipType}
                      onValueChange={(val) => setSlipType(val as SlipTypeOption)}
                    >
                      <SelectTrigger className="bg-white text-[#001f3f] border-slate-300 font-semibold">
                        <SelectValue placeholder="Select slip type..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="Non-VAT">Non-VAT</SelectItem>
                        <SelectItem value="VAT w/ Invoice">VAT w/ Invoice</SelectItem>
                        <SelectItem value="VAT w/o Invoice">VAT w/o Invoice</SelectItem>
                        <SelectItem value="W/o Invoice">W/o Invoice</SelectItem>
                        <SelectItem value="Rate w/o Invoice">Rate w/o Invoice</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 2: Developer + Rate | Agent + Rate */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-4 space-y-1.5">
                    <Label className="text-xs font-semibold text-[#001f3f]">Developer *</Label>
                    <Input
                      value={developerName}
                      onChange={(e) => setDeveloperName(e.target.value)}
                      placeholder="Developer Name"
                      className="bg-white text-[#001f3f] border-slate-300 font-medium"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs font-semibold text-[#001f3f]">Dev Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={developerRate}
                      onChange={(e) => setDeveloperRate(e.target.value)}
                      className="bg-white text-[#001f3f] border-slate-300 font-semibold"
                    />
                  </div>

                  <div className="md:col-span-4 space-y-1.5">
                    <Label className="text-xs font-semibold text-[#001f3f]">Salesperson / Agent *</Label>
                    <Input
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder="Agent Name"
                      className="bg-white text-[#001f3f] border-slate-300 font-medium"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs font-semibold text-[#001f3f]">Agent Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={agentRate}
                      onChange={(e) => setAgentRate(e.target.value)}
                      className="bg-white text-[#001f3f] border-slate-300 font-semibold"
                    />
                  </div>
                </div>

                {/* Row 3: Client Name, Reservation Date & Amount Released */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#001f3f]">Client Name</Label>
                    <Input
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Client Name"
                      className="bg-white text-[#001f3f] border-slate-300 font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#001f3f]">Reservation Date</Label>
                    <Input
                      type="date"
                      value={reservationDate}
                      onChange={(e) => setReservationDate(e.target.value)}
                      className="bg-white text-[#001f3f] border-slate-300 font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#001f3f]">
                      Amount Released from Developer *
                    </Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={amountReleased}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/[^\d.]/g, "")
                        setAmountReleased(cleaned)
                      }}
                      placeholder="0.00"
                      className="bg-white text-[#001f3f] border-[#0284c7] font-extrabold text-base"
                    />
                  </div>
                </div>

                {/* Row 4: Computed Commission Breakdown Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">
                      Total for Release
                    </span>
                    <div className="text-xl font-extrabold text-emerald-700 mt-0.5">
                      ₱{formatNum(calculations.total)}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                      Exclusive of VAT
                    </span>
                    <div className="text-lg font-bold text-[#001f3f] mt-0.5">
                      ₱{formatNum(calculations.exclusiveOfVat)}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                      {slipType === "VAT w/ Invoice"
                        ? "Withholding Tax (10%) / BIR 2307"
                        : slipType === "Non-VAT"
                        ? "Withholding Tax (5%) / BIR 2307"
                        : slipType === "VAT w/o Invoice"
                        ? "VAT Deduction (12%)"
                        : "Withholding Tax (0%)"}
                    </span>
                    <div className="text-lg font-bold text-[#001f3f] mt-0.5">
                      ₱{formatNum(
                        slipType === "VAT w/o Invoice"
                          ? calculations.vatAmount
                          : calculations.withholdingTax
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 5: Commission Status */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#001f3f]">Commission Status / Remarks</Label>
                  <Textarea
                    value={commissionStatus}
                    onChange={(e) => setCommissionStatus(e.target.value)}
                    placeholder="Optional commission status, tranche, or remarks..."
                    className="bg-white text-[#001f3f] border-slate-300 h-16"
                  />
                </div>

                {/* Row 6: Document Attachments (Voucher & Header) with Cropping */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-[#001f3f] block">
                    Bondpaper Attachments (Upload PDF or PNG &amp; Crop)
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Voucher Attachment Card */}
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-3.5 bg-slate-50/60 flex flex-col justify-between gap-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-[#001f3f]">1. Voucher Document</div>
                          <div className="text-[11px] text-slate-500">
                            Placed on the upper section of the bondpaper
                          </div>
                        </div>
                        <label className="cursor-pointer inline-flex items-center gap-1.5 bg-[#001f3f] hover:bg-[#001f3f]/90 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm">
                          <Paperclip className="w-3.5 h-3.5" />
                          <span>{voucherAttachment ? "Replace" : "Upload & Crop"}</span>
                          <input
                            type="file"
                            accept="application/pdf,image/*"
                            className="hidden"
                            onChange={(e) => {
                              handleFilePick("voucher", e.target.files)
                              e.target.value = ""
                            }}
                          />
                        </label>
                      </div>
                      {voucherAttachment && (
                        <div className="flex items-center justify-between bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={voucherAttachment.dataUrl}
                              alt="Cropped Voucher"
                              className="h-10 w-14 object-contain rounded border bg-slate-50 shrink-0"
                            />
                            <div className="truncate">
                              <div className="font-semibold text-slate-800 truncate">
                                {voucherAttachment.fileName}
                              </div>
                              <div className="text-[10px] text-emerald-700 font-medium">
                                Cropped &bull; {(voucherAttachment.fileSize / 1024).toFixed(1)} KB
                              </div>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-slate-400 hover:text-red-600 shrink-0"
                            onClick={() => setVoucherAttachment(null)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Header Attachment Card */}
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-3.5 bg-slate-50/60 flex flex-col justify-between gap-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-[#001f3f]">2. Header Document</div>
                          <div className="text-[11px] text-slate-500">
                            Placed above the voucher on the bondpaper
                          </div>
                        </div>
                        <label className="cursor-pointer inline-flex items-center gap-1.5 bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm">
                          <Paperclip className="w-3.5 h-3.5" />
                          <span>{headerAttachment ? "Replace" : "Upload & Crop"}</span>
                          <input
                            type="file"
                            accept="application/pdf,image/*"
                            className="hidden"
                            onChange={(e) => {
                              handleFilePick("header", e.target.files)
                              e.target.value = ""
                            }}
                          />
                        </label>
                      </div>
                      {headerAttachment && (
                        <div className="flex items-center justify-between bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={headerAttachment.dataUrl}
                              alt="Cropped Header"
                              className="h-10 w-14 object-contain rounded border bg-slate-50 shrink-0"
                            />
                            <div className="truncate">
                              <div className="font-semibold text-slate-800 truncate">
                                {headerAttachment.fileName}
                              </div>
                              <div className="text-[10px] text-emerald-700 font-medium">
                                Cropped &bull; {(headerAttachment.fileSize / 1024).toFixed(1)} KB
                              </div>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-slate-400 hover:text-red-600 shrink-0"
                            onClick={() => setHeaderAttachment(null)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Live Inline Bondpaper Preview Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowLiveBondpaper(!showLiveBondpaper)}
                    className="text-xs text-[#0284c7] px-2"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1.5" />
                    {showLiveBondpaper ? "Hide Bondpaper Layout Preview" : "Show Bondpaper Layout Preview"}
                  </Button>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      disabled={saving || previewing}
                      className="border-slate-300 text-slate-700 bg-white"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePreviewPdf}
                      disabled={previewing || saving}
                      className="border-[#001f3f] text-[#001f3f] hover:bg-slate-100 bg-white font-semibold"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      {previewing ? "Generating PDF..." : "Preview PDF"}
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSaveVoucher}
                      disabled={saving || previewing}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {saving
                        ? isEditMode
                          ? "Updating & Regenerating PDF..."
                          : "Saving & Generating PDF..."
                        : isEditMode
                        ? "Update Voucher & Regenerate PDF"
                        : "Save Voucher & Attach PDF"}
                    </Button>
                  </div>
                </div>

                {showLiveBondpaper && (
                  <div className="bg-slate-200 p-4 rounded-xl overflow-x-auto border border-slate-300">
                    <VoucherBondpaperDocument
                      voucher={voucherModel}
                      containerId="create-voucher-bondpaper-inline-preview"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Offscreen Bondpaper Render Target for PDF Generation */}
          <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
            <VoucherBondpaperDocument
              voucher={voucherModel}
              containerId="create-voucher-bondpaper-hidden"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Cropper Modal */}
      <VoucherDocumentCropper
        open={cropperOpen}
        onOpenChange={setCropperOpen}
        file={cropperFile}
        title={
          cropperTarget === "voucher"
            ? "Crop Voucher Document (PDF / Image)"
            : "Crop Header Document (PDF / Image)"
        }
        onCropComplete={(result) => {
          if (cropperTarget === "voucher") {
            setVoucherAttachment(result)
          } else {
            setHeaderAttachment(result)
          }
        }}
      />
    </>
  )
}
