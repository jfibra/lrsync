"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { logNotification } from "@/utils/logNotification"
import { formatS3Url } from "@/utils/s3-url"
import { PHILIPPINE_BANKS } from "@/lib/philippine-banks"
import type { ChequeStatus, CollectorTransaction, CollectorWorkflowStatus } from "@/types/collector"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertTriangle,
  ArrowRightCircle,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileText,
  Fingerprint,
  Loader2,
  MapPin,
  Paperclip,
  RotateCcw,
  RotateCw,
  Save,
  Search,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
  UserCheck,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { toast } from "sonner"

type BucketKey =
  | "invoice_photo_urls"
  | "cheque_photo_urls"
  | "deposit_slip_urls"
  | "doc_2307_photo_urls"
  | "voucher_photo_urls"

interface BucketConfig {
  key: BucketKey
  label: string
  docType: string
  badgeClass: string
}

const BUCKETS: BucketConfig[] = [
  { key: "invoice_photo_urls", label: "Invoice", docType: "invoice", badgeClass: "bg-slate-100 text-slate-800 border-slate-300" },
  { key: "cheque_photo_urls", label: "Cheque", docType: "cheque", badgeClass: "bg-amber-100 text-amber-900 border-amber-300" },
  { key: "deposit_slip_urls", label: "Deposit Slip", docType: "deposit_slip", badgeClass: "bg-blue-100 text-blue-900 border-blue-300" },
  { key: "doc_2307_photo_urls", label: "BIR 2307", docType: "doc_2307", badgeClass: "bg-purple-100 text-purple-900 border-purple-300" },
  { key: "voucher_photo_urls", label: "Check Voucher", docType: "voucher", badgeClass: "bg-emerald-100 text-emerald-900 border-emerald-300" },
]

interface DeveloperOption {
  id: string
  tin: string
  registered_name: string | null
  substreet_street_brgy: string | null
  district_city_zip: string | null
}

interface CollectorReviewEditModalProps {
  transaction: CollectorTransaction | null
  open: boolean
  role: "super_admin" | "admin" | "secretary"
  onClose: () => void
  onUpdated: (updatedTx?: CollectorTransaction) => void
  onOpenConvertToSale: (tx: CollectorTransaction) => void
}

function formatPHP(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return "—"
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(Number(amount))
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatNumberInput(raw: string): string {
  if (!raw) return ""
  const clean = raw.replace(/,/g, "")
  const parts = clean.split(".")
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return parts.length > 1 ? `${intPart}.${parts[1].slice(0, 2)}` : intPart
}

function parseNumberInput(raw: string): number | null {
  const clean = raw.replace(/,/g, "").trim()
  if (!clean) return null
  const n = Number.parseFloat(clean)
  return Number.isFinite(n) ? n : null
}

function getWorkflowBadge(status: CollectorWorkflowStatus) {
  switch (status) {
    case "invoice_issued":
      return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 border border-slate-200">Draft / Invoice Only</Badge>
    case "cheque_collected":
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border border-amber-200">Cheque Collected</Badge>
    case "deposited":
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border border-blue-200">Deposited — Needs Verification</Badge>
    case "verified":
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border border-emerald-200">Verified — Ready for Sale</Badge>
    case "converted_to_sale":
      return <Badge className="bg-teal-100 text-teal-800 hover:bg-teal-100 border border-teal-200">Converted to Sale</Badge>
    case "returned":
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border border-red-200">Returned to Collector</Badge>
  }
}

export function CollectorReviewEditModal({
  transaction,
  open,
  role,
  onClose,
  onUpdated,
  onOpenConvertToSale,
}: CollectorReviewEditModalProps) {
  const { user, profile } = useAuth()
  const [tx, setTx] = useState<CollectorTransaction | null>(transaction)

  // Editable form state
  const [developerTinId, setDeveloperTinId] = useState<string | null>(null)
  const [developerName, setDeveloperName] = useState("")
  const [developerTin, setDeveloperTin] = useState("")
  const [developerBrgy, setDeveloperBrgy] = useState("")
  const [developerCity, setDeveloperCity] = useState("")
  const [invoiceDate, setInvoiceDate] = useState("")
  const [commissionAmount, setCommissionAmount] = useState("")
  const [invoiceRemarks, setInvoiceRemarks] = useState("")

  const [voucherNumber, setVoucherNumber] = useState("")
  const [chequeNumber, setChequeNumber] = useState("")
  const [chequeBank, setChequeBank] = useState("")
  const [chequeBranch, setChequeBranch] = useState("")
  const [chequeDate, setChequeDate] = useState("")
  const [chequeAmount, setChequeAmount] = useState("")
  const [chequeDateCollected, setChequeDateCollected] = useState("")
  const [chequeStatus, setChequeStatus] = useState<ChequeStatus>("pending")
  const [receivedFromName, setReceivedFromName] = useState("")
  const [chequeRemarks, setChequeRemarks] = useState("")

  const [depositBank, setDepositBank] = useState("")
  const [depositRefNo, setDepositRefNo] = useState("")
  const [depositAmount, setDepositAmount] = useState("")
  const [depositDate, setDepositDate] = useState("")
  const [depositRemarks, setDepositRemarks] = useState("")

  const [accountingRemarks, setAccountingRemarks] = useState("")

  // Developer searchable picker state
  const [devSearch, setDevSearch] = useState("")
  const [devResults, setDevResults] = useState<DeveloperOption[]>([])
  const [devSearchOpen, setDevSearchOpen] = useState(false)

  // Duplicate warnings
  const [dupVoucherCount, setDupVoucherCount] = useState(0)
  const [dupChequeCount, setDupChequeCount] = useState(0)
  const [dupDepositRefCount, setDupDepositRefCount] = useState(0)

  // Attachment management state
  const [uploadBucket, setUploadBucket] = useState<BucketKey>("deposit_slip_urls")
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [mutatingAttachment, setMutatingAttachment] = useState(false)

  // Lightbox Zoom/Rotate viewer
  const [zoomItem, setZoomItem] = useState<{ url: string; label: string; isPdf: boolean } | null>(null)
  const [zoomScale, setZoomScale] = useState(1)
  const [zoomRotate, setZoomRotate] = useState(0)

  // Collapsible silent audit panel
  const [showAuditTrail, setShowAuditTrail] = useState(false)

  // Save/action states
  const [savingEdits, setSavingEdits] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const roleSlug = role.replace("_", "-")
  const canManageVoucherNo = role === "super_admin" || role === "admin"
  const isLocked = Boolean(tx?.workflow_status === "converted_to_sale" && role !== "super_admin")

  // Sync local state whenever transaction changes
  useEffect(() => {
    if (!transaction || !open) return
    setTx(transaction)
    setDeveloperTinId(transaction.developer_tin_id || null)
    setDeveloperName(transaction.developer_name || "")
    setDeveloperTin(transaction.developer_tin || "")
    setDeveloperBrgy(transaction.developer_substreet_street_brgy || "")
    setDeveloperCity(transaction.developer_district_city_zip || "")
    setInvoiceDate(transaction.invoice_date || "")
    setCommissionAmount(
      transaction.commission_amount !== null && transaction.commission_amount !== undefined
        ? String(transaction.commission_amount)
        : ""
    )
    setInvoiceRemarks(transaction.invoice_remarks || "")

    setVoucherNumber(transaction.voucher_number || "")
    setChequeNumber(transaction.cheque_number || "")
    setChequeBank(transaction.cheque_bank || "")
    setChequeBranch(transaction.cheque_branch || "")
    setChequeDate(transaction.cheque_date || "")
    setChequeAmount(
      transaction.cheque_amount !== null && transaction.cheque_amount !== undefined
        ? String(transaction.cheque_amount)
        : ""
    )
    setChequeDateCollected(transaction.cheque_date_collected || "")
    setChequeStatus(transaction.cheque_status || "pending")
    setReceivedFromName(transaction.received_from_name || "")
    setChequeRemarks(transaction.cheque_remarks || "")

    setDepositBank(transaction.deposit_bank || "")
    setDepositRefNo(transaction.deposit_reference_no || "")
    setDepositAmount(
      transaction.deposit_amount !== null && transaction.deposit_amount !== undefined
        ? String(transaction.deposit_amount)
        : ""
    )
    setDepositDate(transaction.deposit_date || "")
    setDepositRemarks(transaction.deposit_remarks || "")
    setAccountingRemarks(transaction.accounting_remarks || "")
    setDevSearch("")
    setDevResults([])
    setDevSearchOpen(false)
    setShowAuditTrail(false)
  }, [transaction, open])

  // Debounced developer search from taxpayer_listings (type = 'sales')
  useEffect(() => {
    if (!devSearchOpen) return
    const t = setTimeout(async () => {
      try {
        let q = supabase
          .from("taxpayer_listings")
          .select("id, tin, registered_name, substreet_street_brgy, district_city_zip")
          .eq("type", "sales")
          .order("registered_name", { ascending: true })
          .limit(25)

        if (devSearch.trim()) {
          const term = devSearch.trim().replace(/,/g, "")
          q = q.or(`registered_name.ilike.%${term}%,tin.ilike.%${term}%`)
        }
        const { data } = await q
        setDevResults((data || []) as DeveloperOption[])
      } catch (err) {
        console.error("Developer lookup failed:", err)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [devSearch, devSearchOpen])

  // Live duplicate check for voucher_number, cheque_number, and deposit_reference_no
  useEffect(() => {
    if (!tx?.id) return
    const checkDups = async () => {
      const cleanVoucher = voucherNumber.trim()
      if (cleanVoucher) {
        const { count } = await supabase
          .from("collector_transactions")
          .select("id", { count: "exact", head: true })
          .eq("is_deleted", false)
          .neq("id", tx.id)
          .eq("voucher_number", cleanVoucher)
        setDupVoucherCount(count || 0)
      } else {
        setDupVoucherCount(0)
      }

      const cleanCheque = chequeNumber.trim()
      if (cleanCheque) {
        const { count } = await supabase
          .from("collector_transactions")
          .select("id", { count: "exact", head: true })
          .eq("is_deleted", false)
          .neq("id", tx.id)
          .eq("cheque_number", cleanCheque)
        setDupChequeCount(count || 0)
      } else {
        setDupChequeCount(0)
      }

      const cleanRef = depositRefNo.trim()
      if (cleanRef) {
        const { count } = await supabase
          .from("collector_transactions")
          .select("id", { count: "exact", head: true })
          .eq("is_deleted", false)
          .neq("id", tx.id)
          .eq("deposit_reference_no", cleanRef)
        setDupDepositRefCount(count || 0)
      } else {
        setDupDepositRefCount(0)
      }
    }
    const timer = setTimeout(checkDups, 350)
    return () => clearTimeout(timer)
  }, [tx?.id, voucherNumber, chequeNumber, depositRefNo])

  if (!tx) return null

  const updateAttachmentsInDb = async (
    patch: Partial<Record<BucketKey, string[]>>,
    auditDesc: string
  ) => {
    if (isLocked) return
    setMutatingAttachment(true)
    try {
      const { data: updated, error } = await supabase
        .from("collector_transactions")
        .update({
          ...patch,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tx.id)
        .select("*")
        .single()

      if (error) throw error
      const nextTx = updated as CollectorTransaction
      setTx(nextTx)
      onUpdated(nextTx)

      if (user) {
        await logNotification(supabase, {
          action: "collector_attachments_updated",
          description: auditDesc,
          user_email: profile?.email || user.email || "",
          user_name: profile?.full_name || profile?.email || "Accounting",
          user_uuid: user.id,
          meta: JSON.stringify({ collection_id: tx.id }),
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
        })
      }
    } catch (err: any) {
      console.error("Attachment update error:", err)
      toast.error(err?.message || "Failed to update attachments")
    } finally {
      setMutatingAttachment(false)
    }
  }

  const handleUploadAttachments = async (files: FileList | null) => {
    if (isLocked || !files || files.length === 0) return
    const bucketCfg = BUCKETS.find((b) => b.key === uploadBucket)!
    setUploadingFiles(true)
    try {
      const uploadedUrls: string[] = []
      for (const file of Array.from(files)) {
        const presignedRes = await fetch("/api/get-s3-upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type || "application/octet-stream",
            category: "collector",
            attachmentType: bucketCfg.docType,
          }),
        })
        if (!presignedRes.ok) throw new Error(`Failed to authorize upload for ${file.name}`)
        const { uploadUrl, publicUrl } = await presignedRes.json()
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        })
        if (!putRes.ok) throw new Error(`S3 upload failed for ${file.name} (${putRes.status})`)
        uploadedUrls.push(formatS3Url(publicUrl))
      }

      const currentArr = Array.isArray(tx[uploadBucket]) ? tx[uploadBucket] : []
      await updateAttachmentsInDb(
        { [uploadBucket]: [...currentArr, ...uploadedUrls] },
        `Added ${uploadedUrls.length} ${bucketCfg.label} attachment(s) to collector record (${tx.developer_name || "Draft"})`
      )
      toast.success(`Uploaded ${uploadedUrls.length} file(s) to ${bucketCfg.label}`)
    } catch (err: any) {
      console.error("Upload collector attachments error:", err)
      toast.error(err?.message || "Upload failed")
    } finally {
      setUploadingFiles(false)
    }
  }

  const handleRemoveAttachment = async (bucket: BucketKey, index: number) => {
    if (isLocked) return
    const bucketCfg = BUCKETS.find((b) => b.key === bucket)!
    if (!confirm(`Remove this ${bucketCfg.label} attachment from this record?`)) return
    const currentArr = Array.isArray(tx[bucket]) ? tx[bucket] : []
    const nextArr = currentArr.filter((_, idx) => idx !== index)
    await updateAttachmentsInDb(
      { [bucket]: nextArr },
      `Removed a ${bucketCfg.label} attachment from collector record (${tx.developer_name || "Draft"})`
    )
    toast.success(`Removed attachment from ${bucketCfg.label}`)
  }

  const handleRetagAttachment = async (fromBucket: BucketKey, index: number, toBucket: BucketKey) => {
    if (isLocked || fromBucket === toBucket) return
    const fromArr = Array.isArray(tx[fromBucket]) ? tx[fromBucket] : []
    const toArr = Array.isArray(tx[toBucket]) ? tx[toBucket] : []
    const targetUrl = fromArr[index]
    if (!targetUrl) return

    const fromLabel = BUCKETS.find((b) => b.key === fromBucket)?.label || fromBucket
    const toLabel = BUCKETS.find((b) => b.key === toBucket)?.label || toBucket

    await updateAttachmentsInDb(
      {
        [fromBucket]: fromArr.filter((_, idx) => idx !== index),
        [toBucket]: [...toArr, targetUrl],
      },
      `Moved attachment from ${fromLabel} to ${toLabel} on collector record (${tx.developer_name || "Draft"})`
    )
    toast.success(`Moved file to ${toLabel}`)
  }

  const handleSaveDetails = async () => {
    if (isLocked || !user) return
    setSavingEdits(true)
    try {
      const parsedComm = parseNumberInput(commissionAmount)
      const parsedCheque = parseNumberInput(chequeAmount)
      const parsedDeposit = parseNumberInput(depositAmount)

      const discrepancy =
        parsedComm !== null &&
        parsedCheque !== null &&
        Math.abs(parsedCheque - parsedComm) > 0.01

      const updatePayload: Record<string, any> = {
        developer_tin_id: developerTinId,
        developer_name: developerName.trim() || null,
        developer_tin: developerTin.trim() || null,
        developer_substreet_street_brgy: developerBrgy.trim() || null,
        developer_district_city_zip: developerCity.trim() || null,
        invoice_date: invoiceDate || tx.invoice_date,
        commission_amount: parsedComm,
        invoice_remarks: invoiceRemarks.trim() || null,

        ...(canManageVoucherNo ? { voucher_number: voucherNumber.trim() || null } : {}),
        cheque_number: chequeNumber.trim() || null,
        cheque_bank: chequeBank.trim() || null,
        cheque_branch: chequeBranch.trim() || null,
        cheque_date: chequeDate || null,
        cheque_amount: parsedCheque,
        cheque_date_collected: chequeDateCollected || null,
        cheque_status: chequeStatus,
        received_from_name: receivedFromName.trim() || null,
        cheque_remarks: chequeRemarks.trim() || null,
        amount_discrepancy: discrepancy,

        deposit_bank: depositBank.trim() || null,
        deposit_reference_no: depositRefNo.trim() || null,
        deposit_amount: parsedDeposit,
        deposit_date: depositDate || null,
        deposit_remarks: depositRemarks.trim() || null,
        accounting_remarks: accountingRemarks.trim() || null,
        updated_at: new Date().toISOString(),
      }

      const { data: updated, error } = await supabase
        .from("collector_transactions")
        .update(updatePayload)
        .eq("id", tx.id)
        .select("*")
        .single()

      if (error) throw error
      const nextTx = updated as CollectorTransaction
      setTx(nextTx)
      onUpdated(nextTx)

      await logNotification(supabase, {
        action: "collector_transaction_edited",
        description: `Accounting edited collector record for ${developerName.trim() || "Draft"} (Voucher #${voucherNumber.trim() || "N/A"}, Cheque #${chequeNumber.trim() || "N/A"})`,
        user_email: profile?.email || user.email || "",
        user_name: profile?.full_name || profile?.email || "Accounting",
        user_uuid: user.id,
        meta: JSON.stringify({
          collection_id: tx.id,
          developer_name: developerName.trim(),
          voucher_number: voucherNumber.trim(),
          cheque_number: chequeNumber.trim(),
          commission_amount: parsedComm,
          cheque_amount: parsedCheque,
          deposit_amount: parsedDeposit,
          amount_discrepancy: discrepancy,
        }),
        user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
      })

      toast.success("Collector transaction details saved!")
    } catch (err: any) {
      console.error("Save collector edits error:", err)
      toast.error(err?.message || "Failed to save changes")
    } finally {
      setSavingEdits(false)
    }
  }

  const handleVerifyCheque = async (openConvertAfter = false) => {
    if (!user) return
    setActionLoading(true)
    try {
      const verifierName = profile?.full_name || profile?.email || "Accounting"
      const verifiedAt = new Date().toISOString()

      const { data: updated, error } = await supabase
        .from("collector_transactions")
        .update({
          ...(canManageVoucherNo ? { voucher_number: voucherNumber.trim() || null } : {}),
          cheque_status: "verified",
          workflow_status: "verified",
          verified_by_uuid: user.id,
          verified_by_name: verifierName,
          verified_at: verifiedAt,
          accounting_remarks: accountingRemarks.trim() || null,
          updated_at: verifiedAt,
        })
        .eq("id", tx.id)
        .select("*")
        .single()

      if (error) throw error
      const nextTx = updated as CollectorTransaction
      setTx(nextTx)
      onUpdated(nextTx)

      await logNotification(supabase, {
        action: "cheque_verified",
        description: `Verified deposited cheque #${nextTx.cheque_number || "N/A"}${nextTx.voucher_number ? ` (Voucher #${nextTx.voucher_number})` : ""} for ${nextTx.developer_name || "Developer"} (${formatPHP(nextTx.deposit_amount ?? nextTx.cheque_amount)})`,
        user_email: profile?.email || user.email || "",
        user_name: verifierName,
        user_uuid: user.id,
        meta: JSON.stringify({
          collection_id: nextTx.id,
          collector_user_id:
            nextTx.deposited_by_uuid ||
            nextTx.cheque_collected_by_uuid ||
            nextTx.invoice_collected_by_uuid,
          voucher_number: nextTx.voucher_number,
          cheque_number: nextTx.cheque_number,
          developer_name: nextTx.developer_name,
        }),
        user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
      })

      toast.success("Deposited cheque verified!")
      if (openConvertAfter) {
        onClose()
        onOpenConvertToSale(nextTx)
      }
    } catch (err: any) {
      console.error("Verify cheque error:", err)
      toast.error(err?.message || "Failed to verify cheque")
    } finally {
      setActionLoading(false)
    }
  }

  const handleReturnToCollector = async () => {
    if (!user) return
    if (!accountingRemarks.trim()) {
      toast.error("Accounting remarks are required when returning a transaction to the collector.")
      return
    }
    setActionLoading(true)
    try {
      const verifierName = profile?.full_name || profile?.email || "Accounting"
      const { data: updated, error } = await supabase
        .from("collector_transactions")
        .update({
          workflow_status: "returned",
          cheque_status: "pending",
          accounting_remarks: accountingRemarks.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", tx.id)
        .select("*")
        .single()

      if (error) throw error
      const nextTx = updated as CollectorTransaction
      setTx(nextTx)
      onUpdated(nextTx)

      await logNotification(supabase, {
        action: "cheque_returned_to_collector",
        description: `Returned transaction (${nextTx.developer_name || "Draft"}) to collector: ${accountingRemarks.trim()}`,
        user_email: profile?.email || user.email || "",
        user_name: verifierName,
        user_uuid: user.id,
        meta: JSON.stringify({
          collection_id: nextTx.id,
          collector_user_id:
            nextTx.deposited_by_uuid ||
            nextTx.cheque_collected_by_uuid ||
            nextTx.invoice_collected_by_uuid,
          remarks: accountingRemarks.trim(),
        }),
        user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
      })

      toast.success("Returned to collector — pinned in their Needs Attention banner.")
      onClose()
    } catch (err: any) {
      console.error("Return transaction error:", err)
      toast.error(err?.message || "Failed to return transaction")
    } finally {
      setActionLoading(false)
    }
  }

  const totalAttachmentsCount = BUCKETS.reduce(
    (sum, b) => sum + (Array.isArray(tx[b.key]) ? tx[b.key].length : 0),
    0
  )

  const liveComm = parseNumberInput(commissionAmount)
  const liveCheque = parseNumberInput(chequeAmount)
  const hasLiveDiscrepancy =
    liveComm !== null && liveCheque !== null && Math.abs(liveCheque - liveComm) > 0.01

  const canReturn =
    tx.workflow_status === "invoice_issued" ||
    tx.workflow_status === "cheque_collected" ||
    tx.workflow_status === "deposited"

  const invoiceSelfie = tx.invoice_ocr_data?.selfie_verification
  const chequeSelfie = tx.cheque_ocr_data?.selfie_verification

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-6xl max-h-[94vh] overflow-y-auto bg-white text-slate-900">
          <DialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
              <div>
                <DialogTitle className="text-xl flex items-center gap-2 text-[#001f3f]">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  {developerName || "Draft / Unassigned Developer"}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  TIN: {developerTin || "—"}
                  {voucherNumber.trim() ? ` · Voucher #: ${voucherNumber.trim()}` : ""}
                  {" · "}Date: {invoiceDate || "—"} · {totalAttachmentsCount}{" "}
                  Attachment{totalAttachmentsCount === 1 ? "" : "s"}
                  {isLocked && " · Locked (Converted to Sale)"}
                </DialogDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {getWorkflowBadge(tx.workflow_status)}
                <Badge variant="outline" className="capitalize">
                  Cheque: {tx.cheque_status}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          {/* Discrepancy & Duplicate Alerts */}
          {(hasLiveDiscrepancy || dupVoucherCount > 0 || dupChequeCount > 0 || dupDepositRefCount > 0) && (
            <div className="space-y-2">
              {hasLiveDiscrepancy && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Amount Discrepancy:</strong> Commission ({formatPHP(liveComm)}) ≠ Cheque (
                    {formatPHP(liveCheque)}).
                  </span>
                </div>
              )}
              {dupVoucherCount > 0 && (
                <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                  <span>
                    <strong>Duplicate Voucher #:</strong> {dupVoucherCount} other active record(s)
                    share Voucher #{voucherNumber}.
                  </span>
                </div>
              )}
              {dupChequeCount > 0 && (
                <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                  <span>
                    <strong>Duplicate Cheque #:</strong> {dupChequeCount} other active record(s)
                    share Cheque #{chequeNumber}.
                  </span>
                </div>
              )}
              {dupDepositRefCount > 0 && (
                <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                  <span>
                    <strong>Duplicate Deposit Ref #:</strong> {dupDepositRefCount} other active
                    record(s) share Reference #{depositRefNo}.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* SIDE-BY-SIDE: LEFT ATTACHMENTS MANAGER | RIGHT EDITABLE DETAILS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* LEFT COLUMN: ATTACHMENTS GALLERY & MANAGER */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#001f3f] flex items-center gap-1.5">
                    <Paperclip className="h-4 w-4 text-sky-600" />
                    Attachments ({totalAttachmentsCount})
                  </h3>
                  {(uploadingFiles || mutatingAttachment) && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-sky-700 font-medium">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Syncing...
                    </span>
                  )}
                </div>

                {/* + Add Attachments Uploader */}
                {!isLocked && (
                  <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-lg p-2.5">
                    <Select
                      value={uploadBucket}
                      onValueChange={(v) => setUploadBucket(v as BucketKey)}
                    >
                      <SelectTrigger className="h-8 text-xs flex-1 min-w-[130px] bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BUCKETS.map((b) => (
                          <SelectItem key={b.key} value={b.key}>
                            {b.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <label className="cursor-pointer inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#001f3f] hover:bg-[#001f3f]/90 text-white text-xs font-semibold">
                      {uploadingFiles ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      <span>+ Add Files</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*,application/pdf"
                        className="hidden"
                        disabled={uploadingFiles || mutatingAttachment}
                        onChange={(e) => {
                          handleUploadAttachments(e.target.files)
                          e.target.value = ""
                        }}
                      />
                    </label>
                  </div>
                )}

                {/* Grouped Buckets */}
                <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
                  {BUCKETS.map((bucket) => {
                    const urls = Array.isArray(tx[bucket.key]) ? tx[bucket.key] : []
                    return (
                      <div key={bucket.key} className="rounded-lg border bg-white p-2.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className={`text-[11px] font-semibold ${bucket.badgeClass}`}>
                            {bucket.label} ({urls.length})
                          </Badge>
                        </div>

                        {urls.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic px-1">None uploaded</p>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            {urls.map((rawUrl, idx) => {
                              const url = formatS3Url(rawUrl)
                              const isPdf = url.toLowerCase().split("?")[0].endsWith(".pdf")
                              const label = `${bucket.label} #${idx + 1}`
                              return (
                                <div
                                  key={`${bucket.key}-${idx}`}
                                  className="rounded-md border border-slate-200 overflow-hidden bg-slate-50 flex flex-col"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setZoomItem({ url, label, isPdf })
                                      setZoomScale(1)
                                      setZoomRotate(0)
                                    }}
                                    className="relative h-24 w-full bg-slate-100 flex items-center justify-center overflow-hidden group"
                                  >
                                    {isPdf ? (
                                      <div className="flex flex-col items-center gap-1 text-sky-700">
                                        <FileText className="h-7 w-7" />
                                        <span className="text-[10px] font-semibold">PDF #{idx + 1}</span>
                                      </div>
                                    ) : (
                                      <img
                                        src={url}
                                        alt={label}
                                        className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                                      />
                                    )}
                                    <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white flex items-center gap-0.5">
                                      <ZoomIn className="h-2.5 w-2.5" /> View
                                    </span>
                                  </button>

                                  {!isLocked && (
                                    <div className="p-1.5 flex items-center gap-1 bg-white border-t">
                                      <Select
                                        value={bucket.key}
                                        onValueChange={(target) =>
                                          handleRetagAttachment(bucket.key, idx, target as BucketKey)
                                        }
                                        disabled={mutatingAttachment}
                                      >
                                        <SelectTrigger className="h-6 text-[10px] px-1.5 flex-1">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {BUCKETS.map((opt) => (
                                            <SelectItem
                                              key={opt.key}
                                              value={opt.key}
                                              className="text-xs"
                                            >
                                              {opt.key === bucket.key
                                                ? opt.label
                                                : `Move → ${opt.label}`}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveAttachment(bucket.key, idx)}
                                        disabled={mutatingAttachment}
                                        className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"
                                        title="Remove attachment"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: EDITABLE RECORD DETAILS + AUDIT TRAIL */}
            <div className="lg:col-span-7 space-y-4">
              {/* 1. Developer & Invoice Details */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-white">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#001f3f]">
                    1. Developer &amp; Invoice Details
                  </h4>
                  {developerTinId ? (
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                      Linked to TIN Library
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200">
                      Unlinked Developer
                    </Badge>
                  )}
                </div>

                {/* Searchable Developer Picker */}
                {!isLocked && (
                  <div className="relative">
                    <div className="relative">
                      <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <Input
                        value={devSearch}
                        onFocus={() => setDevSearchOpen(true)}
                        onChange={(e) => {
                          setDevSearch(e.target.value)
                          setDevSearchOpen(true)
                        }}
                        placeholder="Search & link developer from TIN Library (type = sales)..."
                        className="pl-8 h-8 text-xs bg-slate-50"
                      />
                    </div>
                    {devSearchOpen && (
                      <div className="absolute z-30 mt-1 w-full rounded-lg border bg-white shadow-lg max-h-48 overflow-y-auto">
                        <div className="flex items-center justify-between px-2.5 py-1.5 border-b bg-slate-50 text-[10px] font-semibold text-slate-500">
                          <span>TIN Library (Sales Developers)</span>
                          <button
                            type="button"
                            onClick={() => setDevSearchOpen(false)}
                            className="text-slate-500 hover:text-slate-900"
                          >
                            Close
                          </button>
                        </div>
                        {devResults.length === 0 ? (
                          <div className="p-3 text-xs text-slate-400 text-center">No matching developers</div>
                        ) : (
                          devResults.map((dev) => (
                            <button
                              key={dev.id}
                              type="button"
                              onClick={() => {
                                setDeveloperTinId(dev.id)
                                setDeveloperName(dev.registered_name || "")
                                setDeveloperTin(dev.tin || "")
                                setDeveloperBrgy(dev.substreet_street_brgy || "")
                                setDeveloperCity(dev.district_city_zip || "")
                                setDevSearchOpen(false)
                                setDevSearch("")
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-sky-50 border-b last:border-b-0 text-xs"
                            >
                              <div className="font-semibold text-slate-900">
                                {dev.registered_name || "Unnamed"}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                TIN: {dev.tin} {dev.district_city_zip ? `· ${dev.district_city_zip}` : ""}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Developer Name</Label>
                    <Input
                      value={developerName}
                      onChange={(e) => setDeveloperName(e.target.value)}
                      disabled={isLocked}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Developer TIN</Label>
                    <Input
                      value={developerTin}
                      onChange={(e) => setDeveloperTin(e.target.value)}
                      disabled={isLocked}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Invoice / Batch Date</Label>
                    <Input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      disabled={isLocked}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Commission Amount (PHP)</Label>
                    <Input
                      value={formatNumberInput(commissionAmount)}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/,/g, "")
                        if (raw === "" || /^\d*\.?\d*$/.test(raw)) setCommissionAmount(raw)
                      }}
                      disabled={isLocked}
                      placeholder="0.00"
                      className="h-8 text-xs font-semibold"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Invoice / AI Fast-Track Remarks</Label>
                    <Textarea
                      rows={2}
                      value={invoiceRemarks}
                      onChange={(e) => setInvoiceRemarks(e.target.value)}
                      disabled={isLocked}
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Cheque Details */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#001f3f]">
                    2. Cheque Details
                  </h4>
                  {canManageVoucherNo && (
                    <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
                      Accounting Tracking Enabled
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-3">
                    <Label className="text-xs font-semibold text-[#001f3f] flex items-center justify-between">
                      <span>Voucher No. (Accounting Tracking)</span>
                      {!canManageVoucherNo && (
                        <span className="text-[10px] font-normal text-slate-400">
                          Super Admin / Admin only
                        </span>
                      )}
                    </Label>
                    <Input
                      value={voucherNumber}
                      onChange={(e) => setVoucherNumber(e.target.value)}
                      disabled={isLocked || !canManageVoucherNo}
                      placeholder={
                        canManageVoucherNo
                          ? "Enter Voucher No. for cheque verification & tracking..."
                          : "Assigned by Accounting (Admin / Super Admin)"
                      }
                      className={`h-8 text-xs font-semibold ${
                        canManageVoucherNo ? "border-emerald-300 focus-visible:ring-emerald-500 bg-emerald-50/30" : "bg-slate-50"
                      }`}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Cheque Number</Label>
                    <Input
                      value={chequeNumber}
                      onChange={(e) => setChequeNumber(e.target.value)}
                      disabled={isLocked}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Cheque Bank</Label>
                    <Input
                      value={chequeBank}
                      onChange={(e) => setChequeBank(e.target.value)}
                      disabled={isLocked}
                      list="ph-banks-list"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Bank Branch</Label>
                    <Input
                      value={chequeBranch}
                      onChange={(e) => setChequeBranch(e.target.value)}
                      disabled={isLocked}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Cheque Date (PDC)</Label>
                    <Input
                      type="date"
                      value={chequeDate}
                      onChange={(e) => setChequeDate(e.target.value)}
                      disabled={isLocked}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Cheque Amount (PHP)</Label>
                    <Input
                      value={formatNumberInput(chequeAmount)}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/,/g, "")
                        if (raw === "" || /^\d*\.?\d*$/.test(raw)) setChequeAmount(raw)
                      }}
                      disabled={isLocked}
                      placeholder="0.00"
                      className="h-8 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Pickup Date</Label>
                    <Input
                      type="date"
                      value={chequeDateCollected}
                      onChange={(e) => setChequeDateCollected(e.target.value)}
                      disabled={isLocked}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Cheque Status</Label>
                    <Select
                      value={chequeStatus}
                      onValueChange={(v) => setChequeStatus(v as ChequeStatus)}
                      disabled={isLocked}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="deposited">Deposited</SelectItem>
                        <SelectItem value="verified">Verified</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Received From (Developer Rep)</Label>
                    <Input
                      value={receivedFromName}
                      onChange={(e) => setReceivedFromName(e.target.value)}
                      disabled={isLocked}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Label className="text-xs">Cheque Remarks</Label>
                    <Input
                      value={chequeRemarks}
                      onChange={(e) => setChequeRemarks(e.target.value)}
                      disabled={isLocked}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Deposit Details */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-white">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#001f3f]">
                  3. Bank Deposit Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Deposit Bank</Label>
                    <Input
                      value={depositBank}
                      onChange={(e) => setDepositBank(e.target.value)}
                      disabled={isLocked}
                      list="ph-banks-list"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Deposit Reference #</Label>
                    <Input
                      value={depositRefNo}
                      onChange={(e) => setDepositRefNo(e.target.value)}
                      disabled={isLocked}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Deposit Amount (PHP)</Label>
                    <Input
                      value={formatNumberInput(depositAmount)}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/,/g, "")
                        if (raw === "" || /^\d*\.?\d*$/.test(raw)) setDepositAmount(raw)
                      }}
                      disabled={isLocked}
                      placeholder="0.00"
                      className="h-8 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Deposit Date</Label>
                    <Input
                      type="date"
                      value={depositDate}
                      onChange={(e) => setDepositDate(e.target.value)}
                      disabled={isLocked}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Deposit Remarks</Label>
                    <Input
                      value={depositRemarks}
                      onChange={(e) => setDepositRemarks(e.target.value)}
                      disabled={isLocked}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {!isLocked && (
                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveDetails}
                      disabled={savingEdits}
                      className="bg-[#001f3f] hover:bg-[#001f3f]/90 text-white"
                    >
                      {savingEdits ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Save Details Changes
                    </Button>
                  </div>
                )}
              </div>

              {/* 4. Collapsible Silent Field Verification & Audit Trail (Read-Only) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAuditTrail((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-indigo-600" />
                    Silent Field Telemetry &amp; Biometric Audit Trail (Admin/Accounting Only)
                  </span>
                  {showAuditTrail ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showAuditTrail && (
                  <div className="px-4 pb-3 pt-1 space-y-2.5 border-t text-xs text-slate-600">
                    {[
                      {
                        label: "Invoice / Batch Capture",
                        who: tx.invoice_collected_by_name,
                        at: tx.invoice_captured_at,
                        loc: tx.invoice_location,
                        lat: tx.invoice_latitude,
                        lng: tx.invoice_longitude,
                        device: tx.invoice_device_used,
                        clarity: tx.invoice_clarity_score,
                        proof: invoiceSelfie,
                      },
                      {
                        label: "Cheque Capture",
                        who: tx.cheque_collected_by_name,
                        at: tx.cheque_captured_at,
                        loc: tx.cheque_location,
                        lat: tx.cheque_latitude,
                        lng: tx.cheque_longitude,
                        device: tx.cheque_device_used,
                        clarity: tx.cheque_clarity_score,
                        proof: chequeSelfie,
                      },
                      {
                        label: "Deposit Capture",
                        who: tx.deposited_by_name,
                        at: tx.deposited_at,
                        loc: tx.deposit_location,
                        lat: tx.deposit_latitude,
                        lng: tx.deposit_longitude,
                        device: tx.deposit_device_used,
                        clarity: tx.deposit_clarity_score,
                        proof: null,
                      },
                    ]
                      .filter((step) => step.who || step.at || step.loc)
                      .map((step) => (
                        <div key={step.label} className="rounded-md border bg-white p-2.5 space-y-1">
                          <div className="font-semibold text-slate-800 flex items-center justify-between">
                            <span>{step.label}</span>
                            {step.clarity !== null && step.clarity !== undefined && (
                              <Badge variant="outline" className="text-[10px]">
                                Clarity: {step.clarity}%
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                            <span className="inline-flex items-center gap-1">
                              <UserCheck className="h-3 w-3" /> {step.who || "—"}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> {formatDateTime(step.at)}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {step.loc || "Location not recorded"}
                            </span>
                            {step.lat !== null && step.lat !== undefined && step.lng !== null && step.lng !== undefined && (
                              <a
                                href={`https://www.google.com/maps?q=${step.lat},${step.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
                              >
                                Map <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </div>
                          {step.device && (
                            <div className="text-[10px] text-slate-400 inline-flex items-center gap-1 truncate max-w-full">
                              <Smartphone className="h-3 w-3 shrink-0" /> {step.device}
                            </div>
                          )}
                          {step.proof && typeof step.proof === "object" && (
                            <div className="mt-1 inline-flex items-center gap-1.5 rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] text-indigo-800 font-medium">
                              <Fingerprint className="h-3 w-3" />
                              Biometric/Face:{" "}
                              {step.proof.method ||
                                (step.proof.webauthn ? "WebAuthn Device" : "Face Match")}{" "}
                              ({step.proof.verified === false ? "Unverified" : "Verified"})
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* 5. Accounting Verification Remarks */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-xs font-bold text-[#001f3f]">
                    Accounting Verification Remarks
                  </Label>
                  {tx.verified_at && (
                    <span className="text-[11px] text-emerald-700 inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Verified by {tx.verified_by_name} on {formatDateTime(tx.verified_at)}
                    </span>
                  )}
                </div>
                <Textarea
                  rows={2}
                  value={accountingRemarks}
                  onChange={(e) => setAccountingRemarks(e.target.value)}
                  placeholder="Clearing notes, or mandatory reason if returning to collector..."
                  disabled={tx.workflow_status === "converted_to_sale"}
                  className="bg-white text-xs"
                />
              </div>
            </div>
          </div>

          <datalist id="ph-banks-list">
            {PHILIPPINE_BANKS.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>

          {/* FOOTER ACTIONS */}
          <DialogFooter className="flex-wrap gap-2 sm:justify-between border-t pt-3">
            <div>
              {canReturn && (
                <Button
                  type="button"
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={handleReturnToCollector}
                  disabled={actionLoading}
                >
                  <RotateCcw className="h-4 w-4 mr-1.5" />
                  Return to Collector
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={actionLoading}>
                Close
              </Button>

              {tx.workflow_status === "deposited" && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleVerifyCheque(false)}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-600" />
                    )}
                    Verify Deposited Cheque
                  </Button>
                  <Button
                    type="button"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handleVerifyCheque(true)}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <Banknote className="h-4 w-4 mr-1.5" />
                    )}
                    Verify &amp; Convert to Sale
                  </Button>
                </>
              )}

              {tx.workflow_status === "verified" && !tx.sales_id && (
                <Button
                  type="button"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => {
                    onClose()
                    onOpenConvertToSale(tx)
                  }}
                >
                  <ArrowRightCircle className="h-4 w-4 mr-1.5" />
                  Convert to Sale (Pre-filled)
                </Button>
              )}

              {tx.workflow_status === "converted_to_sale" && (
                <Link href={`/dashboard/${roleSlug}/sales`}>
                  <Badge className="bg-teal-100 text-teal-800 hover:bg-teal-200 border border-teal-200 px-3 py-1.5 cursor-pointer">
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    Converted to Sale · View Sales
                    <ExternalLink className="h-3 w-3 ml-1.5" />
                  </Badge>
                </Link>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* In-App Lightbox Zoom & Rotate Viewer (Images + Inline PDF Preview) */}
      <Dialog open={!!zoomItem} onOpenChange={(o) => !o && setZoomItem(null)}>
        <DialogContent className="max-w-5xl max-h-[95vh] flex flex-col bg-white">
          {zoomItem && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
                  <DialogTitle className="text-base">{zoomItem.label}</DialogTitle>
                  <div className="flex items-center gap-1.5">
                    {!zoomItem.isPdf && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setZoomScale((s) => Math.max(0.5, Number((s - 0.25).toFixed(2))))}
                        >
                          <ZoomOut className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setZoomScale(1)}>
                          {Math.round(zoomScale * 100)}%
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setZoomScale((s) => Math.min(3, Number((s + 0.25).toFixed(2))))}
                        >
                          <ZoomIn className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setZoomRotate((r) => (r + 90) % 360)}
                          title="Rotate 90°"
                        >
                          <RotateCw className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <a
                      href={zoomItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-slate-50"
                    >
                      Open Original <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </DialogHeader>
              <div className="flex-1 overflow-auto rounded-md bg-slate-900/95 p-4 flex items-center justify-center min-h-[65vh]">
                {zoomItem.isPdf ? (
                  <iframe
                    src={zoomItem.url}
                    title={zoomItem.label}
                    className="w-full h-[75vh] rounded bg-white"
                  />
                ) : (
                  <img
                    src={zoomItem.url}
                    alt={zoomItem.label}
                    style={{
                      transform: `scale(${zoomScale}) rotate(${zoomRotate}deg)`,
                      transformOrigin: "center center",
                    }}
                    className="max-h-[75vh] w-auto object-contain transition-transform duration-150"
                  />
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
