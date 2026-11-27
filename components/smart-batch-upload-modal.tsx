"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { logNotification } from "@/utils/logNotification"
import { formatS3Url } from "@/utils/s3-url"
import { PHILIPPINE_BANKS } from "@/lib/philippine-banks"
import {
  prepareFileForBatchUpload,
  rotateImageBlob,
  rotatePdfBlob,
  dataUrlToCompressedImage,
} from "@/lib/image-compress"
import {
  VoucherDocumentCropper,
  type CroppedAttachmentResult,
} from "@/components/voucher-document-cropper"
import type { AnalyzeBatchResponse } from "@/app/api/analyze-batch/route"
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
  Building2,
  CheckCircle2,
  Crop,
  FileText,
  Loader2,
  Plus,
  RotateCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  UploadCloud,
} from "lucide-react"
import { toast } from "sonner"

type StagedTag = "auto" | "invoice" | "cheque" | "deposit_slip" | "doc_2307" | "voucher"
type ResolvedTag = Exclude<StagedTag, "auto">

interface StagedAttachment {
  id: string
  fileName: string
  blob: Blob
  base64: string | null
  mimeType: string
  previewUrl: string | null
  sizeKb: number
  isPdf: boolean
  tag: StagedTag
}

interface DeveloperOption {
  id: string
  tin: string
  registered_name: string | null
  substreet_street_brgy: string | null
  district_city_zip: string | null
}

interface SmartBatchUploadModalProps {
  open: boolean
  onClose: () => void
  role: "super_admin" | "admin" | "secretary"
  existingTransaction?: CollectorTransaction | null
  onSaved: (tx?: CollectorTransaction) => void
}

const MAX_FILES_PER_BATCH = 10
const MAX_VISION_IMAGES = 8

const TAG_PILLS: Array<{ key: StagedTag; label: string; activeClass: string }> = [
  { key: "invoice", label: "Invoice", activeClass: "bg-slate-800 text-white border-slate-800" },
  { key: "cheque", label: "Cheque", activeClass: "bg-amber-600 text-white border-amber-600" },
  { key: "deposit_slip", label: "Deposit", activeClass: "bg-blue-600 text-white border-blue-600" },
  { key: "doc_2307", label: "2307", activeClass: "bg-purple-600 text-white border-purple-600" },
  { key: "voucher", label: "Voucher", activeClass: "bg-emerald-600 text-white border-emerald-600" },
  { key: "auto", label: "Auto (AI)", activeClass: "bg-indigo-600 text-white border-indigo-600" },
]

function todayIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
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

function formatPHP(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return "—"
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(Number(amount))
}

function digitsOnly(val: string): string {
  return val.replace(/\D/g, "")
}

export function SmartBatchUploadModal({
  open,
  onClose,
  role,
  existingTransaction = null,
  onSaved,
}: SmartBatchUploadModalProps) {
  const { user, profile } = useAuth()
  const isEditExisting = Boolean(existingTransaction?.id)
  const canManageVoucherNo = role === "super_admin" || role === "admin"

  // Staged attachments state
  const [stagedFiles, setStagedFiles] = useState<StagedAttachment[]>([])
  const [compressing, setCompressing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [hasAnalyzedCurrentBatch, setHasAnalyzedCurrentBatch] = useState(false)
  const [lastAiResult, setLastAiResult] = useState<AnalyzeBatchResponse | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Form fields
  const [developerTinId, setDeveloperTinId] = useState<string | null>(null)
  const [developerName, setDeveloperName] = useState("")
  const [developerTin, setDeveloperTin] = useState("")
  const [developerBrgy, setDeveloperBrgy] = useState("")
  const [developerCity, setDeveloperCity] = useState("")

  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [invoiceDate, setInvoiceDate] = useState(todayIso())
  const [commissionAmount, setCommissionAmount] = useState("")

  const [voucherNumber, setVoucherNumber] = useState("")
  const [chequeNumber, setChequeNumber] = useState("")
  const [chequeBank, setChequeBank] = useState("")
  const [chequeDate, setChequeDate] = useState("")
  const [chequeAmount, setChequeAmount] = useState("")

  const [depositBank, setDepositBank] = useState("")
  const [depositRefNo, setDepositRefNo] = useState("")
  const [depositAmount, setDepositAmount] = useState("")
  const [depositDate, setDepositDate] = useState("")

  const [remarks, setRemarks] = useState("")
  const [statusOverride, setStatusOverride] = useState<"auto" | CollectorWorkflowStatus>("auto")

  // Developer searchable picker
  const [devSearch, setDevSearch] = useState("")
  const [devResults, setDevResults] = useState<DeveloperOption[]>([])
  const [devSearchOpen, setDevSearchOpen] = useState(false)

  // Duplicate warnings
  const [dupChequeCount, setDupChequeCount] = useState(0)
  const [dupDepositRefCount, setDupDepositRefCount] = useState(0)

  // Saving state
  const [saving, setSaving] = useState(false)
  const [saveStatusText, setSaveStatusText] = useState("")

  // Interactive Cropper state for any staged file (image or PDF)
  const [cropTargetId, setCropTargetId] = useState<string | null>(null)
  const [cropTargetFile, setCropTargetFile] = useState<File | null>(null)
  const [rotatingId, setRotatingId] = useState<string | null>(null)

  const clearStagedPreviews = useCallback((files: StagedAttachment[]) => {
    for (const f of files) {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl)
    }
  }, [])

  const resetForm = useCallback(
    (tx?: CollectorTransaction | null) => {
      setStagedFiles((prev) => {
        clearStagedPreviews(prev)
        return []
      })
      setHasAnalyzedCurrentBatch(false)
      setLastAiResult(null)
      setDevSearch("")
      setDevResults([])
      setDevSearchOpen(false)
      setDupChequeCount(0)
      setDupDepositRefCount(0)
      setStatusOverride("auto")

      if (tx) {
        setDeveloperTinId(tx.developer_tin_id || null)
        setDeveloperName(tx.developer_name || "")
        setDeveloperTin(tx.developer_tin || "")
        setDeveloperBrgy(tx.developer_substreet_street_brgy || "")
        setDeveloperCity(tx.developer_district_city_zip || "")
        setInvoiceNumber("")
        setInvoiceDate(tx.invoice_date || todayIso())
        setCommissionAmount(
          tx.commission_amount !== null && tx.commission_amount !== undefined
            ? String(tx.commission_amount)
            : ""
        )
        setVoucherNumber(tx.voucher_number || "")
        setChequeNumber(tx.cheque_number || "")
        setChequeBank(tx.cheque_bank || "")
        setChequeDate(tx.cheque_date || "")
        setChequeAmount(
          tx.cheque_amount !== null && tx.cheque_amount !== undefined
            ? String(tx.cheque_amount)
            : ""
        )
        setDepositBank(tx.deposit_bank || "")
        setDepositRefNo(tx.deposit_reference_no || "")
        setDepositAmount(
          tx.deposit_amount !== null && tx.deposit_amount !== undefined
            ? String(tx.deposit_amount)
            : ""
        )
        setDepositDate(tx.deposit_date || "")
        setRemarks(tx.invoice_remarks || "")
      } else {
        setDeveloperTinId(null)
        setDeveloperName("")
        setDeveloperTin("")
        setDeveloperBrgy("")
        setDeveloperCity("")
        setInvoiceNumber("")
        setInvoiceDate(todayIso())
        setCommissionAmount("")
        setVoucherNumber("")
        setChequeNumber("")
        setChequeBank("")
        setChequeDate("")
        setChequeAmount("")
        setDepositBank("")
        setDepositRefNo("")
        setDepositAmount("")
        setDepositDate("")
        setRemarks("")
      }
    },
    [clearStagedPreviews]
  )

  useEffect(() => {
    if (open) {
      resetForm(existingTransaction)
    }
  }, [open, existingTransaction, resetForm])

  // Debounced developer picker search
  useEffect(() => {
    if (!devSearchOpen) return
    const timer = setTimeout(async () => {
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
        console.error("Developer lookup error:", err)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [devSearch, devSearchOpen])

  // Live duplicate check for cheque_number and deposit_reference_no
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(async () => {
      const cleanCheque = chequeNumber.trim()
      if (cleanCheque) {
        let q = supabase
          .from("collector_transactions")
          .select("id", { count: "exact", head: true })
          .eq("is_deleted", false)
          .eq("cheque_number", cleanCheque)
        if (existingTransaction?.id) q = q.neq("id", existingTransaction.id)
        const { count } = await q
        setDupChequeCount(count || 0)
      } else {
        setDupChequeCount(0)
      }

      const cleanRef = depositRefNo.trim()
      if (cleanRef) {
        let q = supabase
          .from("collector_transactions")
          .select("id", { count: "exact", head: true })
          .eq("is_deleted", false)
          .eq("deposit_reference_no", cleanRef)
        if (existingTransaction?.id) q = q.neq("id", existingTransaction.id)
        const { count } = await q
        setDupDepositRefCount(count || 0)
      } else {
        setDupDepositRefCount(0)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [open, chequeNumber, depositRefNo, existingTransaction?.id])

  const handleFilesSelected = async (fileList: FileList | File[] | null) => {
    if (!fileList || fileList.length === 0) return
    const incoming = Array.from(fileList)
    const remainingSlots = MAX_FILES_PER_BATCH - stagedFiles.length
    if (remainingSlots <= 0) {
      toast.error(`Maximum of ${MAX_FILES_PER_BATCH} files per batch reached.`)
      return
    }
    const toProcess = incoming.slice(0, remainingSlots)
    if (incoming.length > remainingSlots) {
      toast.warning(`Only the first ${remainingSlots} file(s) were added (max ${MAX_FILES_PER_BATCH} per batch).`)
    }

    setCompressing(true)
    try {
      const prepared = await Promise.all(
        toProcess.map(async (file, idx) => {
          const result = await prepareFileForBatchUpload(file)
          return {
            id: `file_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
            fileName: result.fileName,
            blob: result.blob,
            base64: result.base64,
            mimeType: result.mimeType,
            previewUrl: result.previewUrl,
            sizeKb: result.sizeKb,
            isPdf: result.isPdf,
            tag: (result.base64 ? "auto" : "invoice") as StagedTag,
          }
        })
      )
      setStagedFiles((prev) => [...prev, ...prepared])
      setHasAnalyzedCurrentBatch(false)
    } catch (err: any) {
      console.error("Error preparing files:", err)
      toast.error(err?.message || "Failed to process selected files.")
    } finally {
      setCompressing(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const removeStagedFile = (id: string) => {
    setStagedFiles((prev) => {
      const target = prev.find((f) => f.id === id)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((f) => f.id !== id)
    })
  }

  const updateStagedTag = (id: string, tag: StagedTag) => {
    setStagedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, tag } : f)))
  }

  const handleManualRotate = async (id: string) => {
    const target = stagedFiles.find((f) => f.id === id)
    if (!target) return
    setRotatingId(id)
    try {
      if (target.isPdf) {
        const rotatedPdf = await rotatePdfBlob(target.blob, 90)
        setStagedFiles((prev) =>
          prev.map((f) => {
            if (f.id !== id) return f
            if (f.previewUrl) URL.revokeObjectURL(f.previewUrl)
            return {
              ...f,
              blob: rotatedPdf.pdfBlob,
              base64: rotatedPdf.base64,
              previewUrl: rotatedPdf.previewUrl,
              sizeKb: rotatedPdf.sizeKb,
            }
          })
        )
      } else {
        const rotated = await rotateImageBlob(target.blob, 90, 0.85)
        setStagedFiles((prev) =>
          prev.map((f) => {
            if (f.id !== id) return f
            if (f.previewUrl) URL.revokeObjectURL(f.previewUrl)
            return {
              ...f,
              blob: rotated.blob,
              base64: rotated.base64,
              mimeType: rotated.mimeType,
              previewUrl: rotated.previewUrl,
              sizeKb: rotated.sizeKb,
            }
          })
        )
      }
    } catch (err: any) {
      console.error("Manual rotate failed:", err)
      toast.error(err?.message || "Failed to rotate file")
    } finally {
      setRotatingId(null)
    }
  }

  const handleOpenCropperForStaged = (item: StagedAttachment) => {
    const fileForCropper = new File([item.blob], item.fileName, {
      type: item.mimeType || (item.isPdf ? "application/pdf" : "image/jpeg"),
    })
    setCropTargetId(item.id)
    setCropTargetFile(fileForCropper)
  }

  const handleStagedCropComplete = async (result: CroppedAttachmentResult) => {
    if (!cropTargetId) return
    const targetId = cropTargetId
    setCropTargetId(null)
    setCropTargetFile(null)
    try {
      const compressed = await dataUrlToCompressedImage(result.dataUrl, 0.85)
      setStagedFiles((prev) =>
        prev.map((f) => {
          if (f.id !== targetId) return f
          if (f.previewUrl) URL.revokeObjectURL(f.previewUrl)
          const baseName = f.fileName.replace(/\.[^.]+$/, "")
          return {
            ...f,
            fileName: `${baseName}_cropped.jpg`,
            blob: compressed.blob,
            base64: compressed.base64,
            mimeType: "image/jpeg",
            previewUrl: compressed.previewUrl,
            sizeKb: compressed.sizeKb,
            isPdf: false,
          }
        })
      )
      setHasAnalyzedCurrentBatch(false)
      toast.success("File cropped and updated in batch!")
    } catch (err: any) {
      console.error("Staged crop apply failed:", err)
      toast.error(err?.message || "Failed to apply crop")
    }
  }

  const autoMatchDeveloper = async (aiTin: string | null, aiName: string | null) => {
    if (developerTinId) return // already linked
    try {
      const { data: candidates } = await supabase
        .from("taxpayer_listings")
        .select("id, tin, registered_name, substreet_street_brgy, district_city_zip")
        .eq("type", "sales")
        .limit(1000)

      if (!candidates || candidates.length === 0) return

      let matched: DeveloperOption | undefined
      const cleanAiTin = aiTin ? digitsOnly(aiTin) : ""
      if (cleanAiTin.length >= 6) {
        matched = (candidates as DeveloperOption[]).find((c) => {
          const cDigits = digitsOnly(c.tin || "")
          return cDigits && (cDigits === cleanAiTin || cDigits.startsWith(cleanAiTin) || cleanAiTin.startsWith(cDigits))
        })
      }

      if (!matched && aiName && aiName.trim().length >= 3) {
        const needle = aiName.trim().toLowerCase()
        matched =
          (candidates as DeveloperOption[]).find(
            (c) => (c.registered_name || "").trim().toLowerCase() === needle
          ) ||
          (candidates as DeveloperOption[]).find((c) => {
            const name = (c.registered_name || "").trim().toLowerCase()
            return name && (name.includes(needle) || needle.includes(name))
          })
      }

      if (matched) {
        setDeveloperTinId(matched.id)
        if (!developerName.trim()) setDeveloperName(matched.registered_name || "")
        if (!developerTin.trim()) setDeveloperTin(matched.tin || "")
        setDeveloperBrgy(matched.substreet_street_brgy || "")
        setDeveloperCity(matched.district_city_zip || "")
        toast.success(`Matched developer in TIN Library: ${matched.registered_name}`)
      }
    } catch (err) {
      console.error("Developer auto-match error:", err)
    }
  }

  const runAiAnalysis = async (
    currentFiles: StagedAttachment[]
  ): Promise<{ updatedFiles: StagedAttachment[]; aiData: AnalyzeBatchResponse | null }> => {
    const visionItems = currentFiles
      .filter((f) => Boolean(f.base64))
      .slice(0, MAX_VISION_IMAGES)

    if (visionItems.length === 0) {
      return { updatedFiles: currentFiles, aiData: null }
    }

    setAnalyzing(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const res = await fetch("/api/analyze-batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          items: visionItems.map((f) => ({
            id: f.id,
            tag: f.tag,
            imageBase64: f.base64!,
            mimeType: "image/jpeg",
            fileName: f.fileName,
          })),
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson?.error || `AI analysis failed (${res.status})`)
      }

      const data = (await res.json()) as AnalyzeBatchResponse
      setLastAiResult(data)
      setHasAnalyzedCurrentBatch(true)

      // 1. Update every attachment whose tag is "auto" to data.detected_tags[item.id]
      //    AND auto-rotate any image whose detected_rotations[id] is 90, 180, or 270
      let autoRotatedCount = 0
      const updatedFiles: StagedAttachment[] = await Promise.all(
        currentFiles.map(async (f) => {
          let nextItem: StagedAttachment =
            f.tag === "auto" && data.detected_tags && data.detected_tags[f.id]
              ? { ...f, tag: data.detected_tags[f.id] }
              : f

          const rotDeg = data.detected_rotations?.[f.id]
          if (rotDeg === 90 || rotDeg === 180 || rotDeg === 270) {
            try {
              if (nextItem.isPdf) {
                const rotatedPdf = await rotatePdfBlob(nextItem.blob, rotDeg)
                if (nextItem.previewUrl) URL.revokeObjectURL(nextItem.previewUrl)
                autoRotatedCount += 1
                nextItem = {
                  ...nextItem,
                  blob: rotatedPdf.pdfBlob,
                  base64: rotatedPdf.base64,
                  previewUrl: rotatedPdf.previewUrl,
                  sizeKb: rotatedPdf.sizeKb,
                }
              } else {
                const rotated = await rotateImageBlob(nextItem.blob, rotDeg, 0.85)
                if (nextItem.previewUrl) URL.revokeObjectURL(nextItem.previewUrl)
                autoRotatedCount += 1
                nextItem = {
                  ...nextItem,
                  blob: rotated.blob,
                  base64: rotated.base64,
                  mimeType: rotated.mimeType,
                  previewUrl: rotated.previewUrl,
                  sizeKb: rotated.sizeKb,
                }
              }
            } catch (rotErr) {
              console.warn(`Auto-rotate failed for ${nextItem.fileName}:`, rotErr)
            }
          }
          return nextItem
        })
      )
      setStagedFiles(updatedFiles)

      // 2. Auto-match Developer in taxpayer_listings
      await autoMatchDeveloper(data.developer_tin, data.developer_name)

      // 3. Auto-fill EMPTY form fields only (never overwrite user-typed values)
      if (!developerName.trim() && data.developer_name) setDeveloperName(data.developer_name)
      if (!developerTin.trim() && data.developer_tin) setDeveloperTin(data.developer_tin)
      if (!invoiceNumber.trim() && data.invoice_number) setInvoiceNumber(data.invoice_number)
      if (!invoiceDate.trim() && data.invoice_date) setInvoiceDate(data.invoice_date)
      if (!commissionAmount.trim() && data.commission_amount) {
        setCommissionAmount(String(data.commission_amount))
      }
      if (!chequeNumber.trim() && data.cheque_number) setChequeNumber(data.cheque_number)
      if (!chequeBank.trim() && data.cheque_bank) setChequeBank(data.cheque_bank)
      if (!chequeDate.trim() && data.cheque_date) setChequeDate(data.cheque_date)
      if (!chequeAmount.trim() && data.cheque_amount) setChequeAmount(String(data.cheque_amount))
      if (!depositBank.trim() && data.deposit_bank) setDepositBank(data.deposit_bank)
      if (!depositRefNo.trim() && data.deposit_reference_no) setDepositRefNo(data.deposit_reference_no)
      if (!depositAmount.trim() && data.deposit_amount) setDepositAmount(String(data.deposit_amount))
      if (!depositDate.trim() && data.deposit_date) setDepositDate(data.deposit_date)
      if (!remarks.trim() && data.ai_summary_remark) setRemarks(data.ai_summary_remark)

      if (data.fallback) {
        toast.warning("AI Vision returned fallback tags. You can adjust tags and save normally.")
      } else if (autoRotatedCount > 0) {
        toast.success(
          `AI Auto-Read & Tag complete! Auto-rotated ${autoRotatedCount} photo(s) upright.`
        )
      } else {
        toast.success("AI Auto-Read & Tag complete! Review the pre-filled details below.")
      }

      return { updatedFiles, aiData: data }
    } catch (err: any) {
      console.error("AI analyze-batch error:", err)
      toast.warning(err?.message || "AI analysis unavailable — you can still tag and save manually.")
      return { updatedFiles: currentFiles, aiData: null }
    } finally {
      setAnalyzing(false)
    }
  }

  const handleManualAiClick = async () => {
    const hasReadableFiles = stagedFiles.some((f) => Boolean(f.base64))
    if (!hasReadableFiles) {
      toast.error("Add at least one image or PDF file to run AI Auto-Read & Tag.")
      return
    }
    await runAiAnalysis(stagedFiles)
  }

  const handleSave = async (uploadNextAfter = false) => {
    if (!user) {
      toast.error("You must be signed in to save.")
      return
    }
    if (stagedFiles.length === 0 && !isEditExisting) {
      toast.error("Please add at least one file before saving.")
      return
    }

    setSaving(true)
    try {
      let workingFiles = stagedFiles
      let aiData = lastAiResult

      // Auto-run AI analysis if user clicked Save without running it first on staged images/PDFs
      const hasUnanalyzedImages =
        !hasAnalyzedCurrentBatch &&
        workingFiles.some((f) => Boolean(f.base64))
      if (hasUnanalyzedImages) {
        setSaveStatusText("Running AI Auto-Read & Tag...")
        const res = await runAiAnalysis(workingFiles)
        workingFiles = res.updatedFiles
        aiData = res.aiData || aiData
      }

      // Parallel S3 upload of all staged files grouped by final tag
      setSaveStatusText(`Uploading ${workingFiles.length} file(s) to S3...`)
      const uploadedByBucket: Record<ResolvedTag, string[]> = {
        invoice: [],
        cheque: [],
        deposit_slip: [],
        doc_2307: [],
        voucher: [],
      }

      if (workingFiles.length > 0) {
        const uploadResults = await Promise.all(
          workingFiles.map(async (item) => {
            const finalTag: ResolvedTag = item.tag === "auto" ? "invoice" : item.tag
            const presignedRes = await fetch("/api/get-s3-upload-url", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fileName: item.fileName,
                fileType: item.mimeType || "application/octet-stream",
                category: "collector",
                attachmentType: finalTag,
              }),
            })
            if (!presignedRes.ok) {
              throw new Error(`Failed to authorize S3 upload for ${item.fileName}`)
            }
            const { uploadUrl, publicUrl } = await presignedRes.json()
            const putRes = await fetch(uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": item.mimeType || "application/octet-stream" },
              body: item.blob,
            })
            if (!putRes.ok) {
              throw new Error(`S3 upload failed for ${item.fileName} (${putRes.status})`)
            }
            return { tag: finalTag, url: formatS3Url(publicUrl) }
          })
        )

        for (const r of uploadResults) {
          uploadedByBucket[r.tag].push(r.url)
        }
      }

      setSaveStatusText("Saving record to database...")

      const finalDevName = (developerName.trim() || aiData?.developer_name || "").trim() || null
      const finalDevTin = (developerTin.trim() || aiData?.developer_tin || "").trim() || null
      const finalInvDate = invoiceDate || aiData?.invoice_date || todayIso()
      const finalComm = parseNumberInput(commissionAmount) ?? aiData?.commission_amount ?? null

      const finalChequeNo = (chequeNumber.trim() || aiData?.cheque_number || "").trim() || null
      const finalChequeBank = (chequeBank.trim() || aiData?.cheque_bank || "").trim() || null
      const finalChequeDate = chequeDate || aiData?.cheque_date || null
      const finalChequeAmt = parseNumberInput(chequeAmount) ?? aiData?.cheque_amount ?? null

      const finalDepBank = (depositBank.trim() || aiData?.deposit_bank || "").trim() || null
      const finalDepRef = (depositRefNo.trim() || aiData?.deposit_reference_no || "").trim() || null
      const finalDepAmt = parseNumberInput(depositAmount) ?? aiData?.deposit_amount ?? null
      const finalDepDate = depositDate || aiData?.deposit_date || null

      const invNoPrefix = (invoiceNumber.trim() || aiData?.invoice_number || "").trim()
      const baseRemarks = (remarks.trim() || aiData?.ai_summary_remark || "").trim()
      const finalRemarks =
        invNoPrefix && !baseRemarks.toLowerCase().includes(invNoPrefix.toLowerCase())
          ? `Invoice #${invNoPrefix}${baseRemarks ? ` · ${baseRemarks}` : ""}`
          : baseRemarks || null

      const discrepancy =
        finalComm !== null &&
        finalChequeAmt !== null &&
        Math.abs(finalChequeAmt - finalComm) > 0.01

      const mergedInvoiceUrls = [
        ...(existingTransaction?.invoice_photo_urls || []),
        ...uploadedByBucket.invoice,
      ]
      const mergedChequeUrls = [
        ...(existingTransaction?.cheque_photo_urls || []),
        ...uploadedByBucket.cheque,
      ]
      const mergedDepositUrls = [
        ...(existingTransaction?.deposit_slip_urls || []),
        ...uploadedByBucket.deposit_slip,
      ]
      const merged2307Urls = [
        ...(existingTransaction?.doc_2307_photo_urls || []),
        ...uploadedByBucket.doc_2307,
      ]
      const mergedVoucherUrls = [
        ...(existingTransaction?.voucher_photo_urls || []),
        ...uploadedByBucket.voucher,
      ]

      // Determine workflow_status and cheque_status based on attached documents (or explicit override)
      const hasDepositEvidence =
        mergedDepositUrls.length > 0 || Boolean(finalDepBank) || Boolean(finalDepRef) || finalDepAmt !== null
      const hasChequeEvidence =
        mergedChequeUrls.length > 0 || Boolean(finalChequeNo) || finalChequeAmt !== null

      let computedWorkflowStatus: CollectorWorkflowStatus
      if (statusOverride !== "auto") {
        computedWorkflowStatus = statusOverride
      } else if (existingTransaction?.workflow_status === "converted_to_sale") {
        computedWorkflowStatus = "converted_to_sale"
      } else if (existingTransaction?.workflow_status === "verified") {
        computedWorkflowStatus = "verified"
      } else if (hasDepositEvidence) {
        computedWorkflowStatus = "deposited"
      } else if (hasChequeEvidence) {
        computedWorkflowStatus = "cheque_collected"
      } else {
        computedWorkflowStatus = "invoice_issued"
      }

      const computedChequeStatus: ChequeStatus =
        computedWorkflowStatus === "verified" || computedWorkflowStatus === "converted_to_sale"
          ? "verified"
          : computedWorkflowStatus === "deposited"
          ? "deposited"
          : "pending"

      const nowIso = new Date().toISOString()
      const actorName = profile?.full_name || profile?.email || user.email || "Accounting"

      let savedRecord: CollectorTransaction

      if (isEditExisting && existingTransaction?.id) {
        const updatePayload: Record<string, any> = {
          workflow_status: computedWorkflowStatus,
          cheque_status: computedChequeStatus,
          developer_tin_id: developerTinId,
          developer_name: finalDevName,
          developer_tin: finalDevTin,
          developer_substreet_street_brgy: developerBrgy.trim() || null,
          developer_district_city_zip: developerCity.trim() || null,
          invoice_date: finalInvDate,
          commission_amount: finalComm,
          invoice_remarks: finalRemarks,
          ...(canManageVoucherNo ? { voucher_number: voucherNumber.trim() || null } : {}),
          cheque_number: finalChequeNo,
          cheque_bank: finalChequeBank,
          cheque_date: finalChequeDate,
          cheque_amount: finalChequeAmt,
          amount_discrepancy: discrepancy,
          deposit_bank: finalDepBank,
          deposit_reference_no: finalDepRef,
          deposit_amount: finalDepAmt,
          deposit_date: finalDepDate,
          invoice_photo_urls: mergedInvoiceUrls,
          cheque_photo_urls: mergedChequeUrls,
          deposit_slip_urls: mergedDepositUrls,
          doc_2307_photo_urls: merged2307Urls,
          voucher_photo_urls: mergedVoucherUrls,
          ...(aiData ? { invoice_ocr_data: { ...(existingTransaction.invoice_ocr_data || {}), ai_batch: aiData } } : {}),
          updated_at: nowIso,
        }

        const { data, error } = await supabase
          .from("collector_transactions")
          .update(updatePayload)
          .eq("id", existingTransaction.id)
          .select("*")
          .single()

        if (error) throw error
        savedRecord = data as CollectorTransaction

        await logNotification(supabase, {
          action: "smart_batch_attachments_added",
          description: `Accounting added ${workingFiles.length} smart AI-tagged file(s) to record for ${finalDevName || "Draft"} (Cheque #${finalChequeNo || "N/A"})`,
          user_email: profile?.email || user.email || "",
          user_name: actorName,
          user_uuid: user.id,
          meta: JSON.stringify({
            collection_id: savedRecord.id,
            uploaded_count: workingFiles.length,
            ai_used: Boolean(aiData && !aiData.fallback),
            developer_name: finalDevName,
            cheque_number: finalChequeNo,
          }),
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
        })

        toast.success(`Added ${workingFiles.length} file(s) and updated record!`)
      } else {
        const insertPayload: Record<string, any> = {
          workflow_status: computedWorkflowStatus,
          cheque_status: computedChequeStatus,
          assigned_area: profile?.assigned_area || null,
          developer_tin_id: developerTinId,
          developer_name: finalDevName,
          developer_tin: finalDevTin,
          developer_substreet_street_brgy: developerBrgy.trim() || null,
          developer_district_city_zip: developerCity.trim() || null,
          invoice_photo_urls: mergedInvoiceUrls,
          invoice_date: finalInvDate,
          commission_amount: finalComm,
          invoice_remarks: finalRemarks,
          invoice_ocr_data: aiData ? { ai_batch: aiData } : null,
          invoice_collected_by_uuid: user.id,
          invoice_collected_by_name: actorName,
          invoice_date_collected: finalInvDate,
          invoice_captured_at: nowIso,
          ...(canManageVoucherNo ? { voucher_number: voucherNumber.trim() || null } : {}),
          cheque_photo_urls: mergedChequeUrls,
          doc_2307_photo_urls: merged2307Urls,
          voucher_photo_urls: mergedVoucherUrls,
          cheque_number: finalChequeNo,
          cheque_bank: finalChequeBank,
          cheque_date: finalChequeDate,
          cheque_amount: finalChequeAmt,
          amount_discrepancy: discrepancy,
          ...(hasChequeEvidence
            ? {
                cheque_collected_by_uuid: user.id,
                cheque_collected_by_name: actorName,
                cheque_captured_at: nowIso,
              }
            : {}),
          deposit_slip_urls: mergedDepositUrls,
          deposit_bank: finalDepBank,
          deposit_reference_no: finalDepRef,
          deposit_amount: finalDepAmt,
          deposit_date: finalDepDate,
          ...(hasDepositEvidence
            ? {
                deposited_by_uuid: user.id,
                deposited_by_name: actorName,
                deposited_at: nowIso,
              }
            : {}),
          ...(computedWorkflowStatus === "verified"
            ? {
                verified_by_uuid: user.id,
                verified_by_name: actorName,
                verified_at: nowIso,
              }
            : {}),
          is_deleted: false,
        }

        const { data, error } = await supabase
          .from("collector_transactions")
          .insert([insertPayload])
          .select("*")
          .single()

        if (error) throw error
        savedRecord = data as CollectorTransaction

        await logNotification(supabase, {
          action: "smart_batch_record_created",
          description: `Accounting created Cheque Verification record via Smart AI Upload for ${finalDevName || "Draft"} (${workingFiles.length} file(s), Cheque #${finalChequeNo || "N/A"})`,
          user_email: profile?.email || user.email || "",
          user_name: actorName,
          user_uuid: user.id,
          meta: JSON.stringify({
            collection_id: savedRecord.id,
            uploaded_count: workingFiles.length,
            ai_used: Boolean(aiData && !aiData.fallback),
            workflow_status: computedWorkflowStatus,
            developer_name: finalDevName,
            cheque_number: finalChequeNo,
            commission_amount: finalComm,
            cheque_amount: finalChequeAmt,
          }),
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
        })

        toast.success("Smart batch record saved!")
      }

      onSaved(savedRecord)
      if (uploadNextAfter && !isEditExisting) {
        resetForm(null)
      } else {
        onClose()
      }
    } catch (err: any) {
      console.error("Smart batch save error:", err)
      toast.error(err?.message || "Failed to save batch upload")
    } finally {
      setSaving(false)
      setSaveStatusText("")
    }
  }

  const liveComm = parseNumberInput(commissionAmount)
  const liveCheque = parseNumberInput(chequeAmount)
  const hasLiveDiscrepancy =
    liveComm !== null && liveCheque !== null && Math.abs(liveCheque - liveComm) > 0.01

  const readableCount = stagedFiles.filter((f) => Boolean(f.base64)).length

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-5xl max-h-[94vh] overflow-y-auto bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2 text-[#001f3f]">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            {isEditExisting
              ? `Smart AI Multi-File Upload — Add to ${existingTransaction?.developer_name || "Record"}`
              : "Smart Multi-File Upload (Perplexity Vision AI)"}
          </DialogTitle>
          <DialogDescription>
            Drop or select up to {MAX_FILES_PER_BATCH} photos/PDFs. Perplexity Vision AI automatically
            tags each image (Invoice, Cheque, Deposit Slip, BIR 2307, Check Voucher) and pre-fills the form.
          </DialogDescription>
        </DialogHeader>

        {/* Discrepancy & Duplicate Warnings */}
        {(hasLiveDiscrepancy || dupChequeCount > 0 || dupDepositRefCount > 0) && (
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
            {dupChequeCount > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Duplicate Cheque #:</strong> {dupChequeCount} other active record(s) already
                  use Cheque #{chequeNumber}.
                </span>
              </div>
            )}
            {dupDepositRefCount > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Duplicate Deposit Ref #:</strong> {dupDepositRefCount} other active record(s)
                  already use Reference #{depositRefNo}.
                </span>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT COLUMN: DROPZONE + STAGED FILES + AI BUTTON */}
          <div className="lg:col-span-5 space-y-3">
            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragging(false)
                handleFilesSelected(e.dataTransfer.files)
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
                isDragging
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/40"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                disabled={compressing || saving}
                onChange={(e) => handleFilesSelected(e.target.files)}
              />
              {compressing ? (
                <div className="flex flex-col items-center gap-2 text-indigo-700">
                  <Loader2 className="h-7 w-7 animate-spin" />
                  <p className="text-xs font-semibold">Compressing images...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5">
                  <UploadCloud className="h-8 w-8 text-indigo-600" />
                  <p className="text-sm font-semibold text-[#001f3f]">
                    Drop photos/PDFs here or click to browse
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Up to {MAX_FILES_PER_BATCH} files · Images auto-compressed (JPEG 1600px) · PDFs kept original
                  </p>
                </div>
              )}
            </div>

            {/* AI Auto-Read & Tag Trigger */}
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-[#001f3f]">
                Staged Attachments ({stagedFiles.length}/{MAX_FILES_PER_BATCH})
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleManualAiClick}
                disabled={analyzing || saving || readableCount === 0}
                className="bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white font-semibold h-8 text-xs shadow-sm"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Analyzing {Math.min(readableCount, MAX_VISION_IMAGES)} file(s)...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    AI Auto-Read &amp; Tag
                  </>
                )}
              </Button>
            </div>

            {/* Staged Attachments List */}
            <div className="space-y-2.5 max-h-[430px] overflow-y-auto pr-1">
              {stagedFiles.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-xs text-slate-400">
                  No files staged yet. Add invoice, cheque, deposit slip, BIR 2307, or voucher files above.
                </div>
              ) : (
                stagedFiles.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-2 shadow-xs"
                  >
                    <div className="flex items-start gap-2.5">
                      {item.previewUrl ? (
                        <div className="relative h-12 w-12 shrink-0">
                          <img
                            src={item.previewUrl}
                            alt={item.fileName}
                            className="h-12 w-12 rounded-md object-cover border border-slate-200"
                          />
                          {item.isPdf && (
                            <span className="absolute -bottom-1 -right-1 rounded bg-sky-700 px-1 py-0 text-[8px] font-bold text-white shadow">
                              PDF
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="h-12 w-12 rounded-md bg-sky-50 border border-sky-200 flex flex-col items-center justify-center text-sky-700 shrink-0">
                          <FileText className="h-5 w-5" />
                          <span className="text-[9px] font-bold">PDF</span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-slate-900 truncate" title={item.fileName}>
                          {item.fileName}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>{item.sizeKb} KB</span>
                          {item.isPdf && (
                            <Badge variant="outline" className="text-[9px] py-0 px-1 border-sky-300 text-sky-700">
                              PDF · AI Ready
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenCropperForStaged(item)}
                          disabled={saving || analyzing || rotatingId === item.id}
                          className="p-1 text-slate-500 hover:text-sky-700 rounded hover:bg-sky-50"
                          title="Crop / Edit attachment"
                        >
                          <Crop className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleManualRotate(item.id)}
                          disabled={saving || analyzing || rotatingId === item.id}
                          className="p-1 text-slate-500 hover:text-indigo-700 rounded hover:bg-indigo-50"
                          title="Rotate 90° clockwise"
                        >
                          {rotatingId === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCw className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeStagedFile(item.id)}
                          disabled={saving || analyzing}
                          className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"
                          title="Remove file"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* 1-Tap Category Pills */}
                    <div className="flex flex-wrap gap-1">
                      {TAG_PILLS.filter((p) => !(p.key === "auto" && !item.base64)).map((pill) => {
                        const isActive = item.tag === pill.key
                        return (
                          <button
                            key={pill.key}
                            type="button"
                            disabled={saving || analyzing}
                            onClick={() => updateStagedTag(item.id, pill.key)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors ${
                              isActive
                                ? pill.activeClass
                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {pill.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: EDITABLE PRE-FILLED FORM */}
          <div className="lg:col-span-7 space-y-4">
            {/* 1. Developer & Invoice Details */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-white">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#001f3f] flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-blue-600" />
                  1. Developer &amp; Invoice Details
                </h4>
                {developerTinId ? (
                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Linked to TIN Library
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500 border-slate-200">
                    Unlinked
                  </Badge>
                )}
              </div>

              {/* Searchable Developer Picker */}
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
                          <div className="font-semibold text-slate-900">{dev.registered_name || "Unnamed"}</div>
                          <div className="text-[11px] text-slate-500">
                            TIN: {dev.tin} {dev.district_city_zip ? `· ${dev.district_city_zip}` : ""}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Developer Name</Label>
                  <Input
                    value={developerName}
                    onChange={(e) => setDeveloperName(e.target.value)}
                    placeholder="Auto-filled by AI or type..."
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Developer TIN</Label>
                  <Input
                    value={developerTin}
                    onChange={(e) => setDeveloperTin(e.target.value)}
                    placeholder="000-000-000-000"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Invoice # (Optional)</Label>
                  <Input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="e.g. SI-001234"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Invoice / Batch Date</Label>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Commission Amount (PHP)</Label>
                  <Input
                    value={formatNumberInput(commissionAmount)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/,/g, "")
                      if (raw === "" || /^\d*\.?\d*$/.test(raw)) setCommissionAmount(raw)
                    }}
                    placeholder="0.00"
                    className="h-8 text-xs font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* 2. Cheque Details */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-white">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#001f3f]">
                2. Cheque Details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {canManageVoucherNo && (
                  <div className="sm:col-span-2">
                    <Label className="text-xs font-semibold text-[#001f3f]">
                      Voucher No. (Accounting Tracking)
                    </Label>
                    <Input
                      value={voucherNumber}
                      onChange={(e) => setVoucherNumber(e.target.value)}
                      placeholder="Enter Voucher No. for cheque verification & tracking..."
                      className="h-8 text-xs font-semibold border-emerald-300 bg-emerald-50/30"
                    />
                  </div>
                )}
                <div>
                  <Label className="text-xs">Cheque Number</Label>
                  <Input
                    value={chequeNumber}
                    onChange={(e) => setChequeNumber(e.target.value)}
                    placeholder="Auto-filled by AI..."
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Cheque Bank</Label>
                  <Input
                    value={chequeBank}
                    onChange={(e) => setChequeBank(e.target.value)}
                    list="smart-ph-banks-list"
                    placeholder="e.g. BDO, Metrobank, BPI..."
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Cheque Date (PDC)</Label>
                  <Input
                    type="date"
                    value={chequeDate}
                    onChange={(e) => setChequeDate(e.target.value)}
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
                    placeholder="0.00"
                    className="h-8 text-xs font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* 3. Bank Deposit Details & Remarks */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#001f3f]">
                  3. Bank Deposit &amp; Summary Remarks
                </h4>
                <Select
                  value={statusOverride}
                  onValueChange={(v) => setStatusOverride(v as "auto" | CollectorWorkflowStatus)}
                >
                  <SelectTrigger className="h-7 text-[11px] w-[195px] bg-slate-50">
                    <SelectValue placeholder="Status: Auto-detect" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Status: Auto-detect from files</SelectItem>
                    <SelectItem value="invoice_issued">Draft / Invoice Only</SelectItem>
                    <SelectItem value="cheque_collected">Cheque Collected</SelectItem>
                    <SelectItem value="deposited">Deposited — For Check</SelectItem>
                    <SelectItem value="verified">Verified — Ready for Sale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Deposit Bank</Label>
                  <Input
                    value={depositBank}
                    onChange={(e) => setDepositBank(e.target.value)}
                    list="smart-ph-banks-list"
                    placeholder="Auto-filled by AI..."
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Deposit Reference #</Label>
                  <Input
                    value={depositRefNo}
                    onChange={(e) => setDepositRefNo(e.target.value)}
                    placeholder="Auto-filled by AI..."
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
                    className="h-8 text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Remarks / AI Fast-Track Summary</Label>
                  <Textarea
                    rows={2}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Auto-generated by AI or enter accounting remarks..."
                    className="text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <datalist id="smart-ph-banks-list">
          {PHILIPPINE_BANKS.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between border-t pt-3">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            {saving && saveStatusText && (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                <span className="font-medium text-indigo-700">{saveStatusText}</span>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving || analyzing}>
              Cancel
            </Button>
            {!isEditExisting && (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSave(true)}
                disabled={saving || analyzing || stagedFiles.length === 0}
                className="border-indigo-300 text-indigo-800 hover:bg-indigo-50 font-semibold"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Save &amp; Upload Next
              </Button>
            )}
            <Button
              type="button"
              onClick={() => handleSave(false)}
              disabled={saving || analyzing || (stagedFiles.length === 0 && !isEditExisting)}
              className="bg-[#001f3f] hover:bg-[#001f3f]/90 text-white font-semibold"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1.5" />
              )}
              {isEditExisting ? "Upload & Update Record" : "Save Record"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Interactive Crop & Rotate Modal for Staged Files (Images & PDFs) */}
      <VoucherDocumentCropper
        open={Boolean(cropTargetFile)}
        onOpenChange={(o) => {
          if (!o) {
            setCropTargetId(null)
            setCropTargetFile(null)
          }
        }}
        file={cropTargetFile}
        title="Crop / Rotate Staged Attachment"
        onCropComplete={handleStagedCropComplete}
      />
    </Dialog>
  )
}
