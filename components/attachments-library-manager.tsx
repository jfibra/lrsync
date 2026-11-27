"use client"

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Search,
  RefreshCw,
  FileText,
  Image as ImageIcon,
  Trash2,
  ExternalLink,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  User,
  Calendar,
  MapPin,
  FolderOpen,
  Loader2,
  Copy,
  Check,
  Crop,
  Sparkles,
  FileCheck2,
  Receipt,
  Layers,
  ShoppingCart,
  PhilippinePeso,
  AlertCircle,
} from "lucide-react"
import { format } from "date-fns"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { formatS3Url, getThumbnailUrl } from "@/utils/s3-url"
import { safeParseArray } from "@/lib/safe-parse"
import { logNotification } from "@/utils/logNotification"
import { parseVoucherAttachmentUrls, serializeVoucherAttachmentUrls } from "@/components/voucher-bondpaper-document"
import {
  VoucherDocumentCropper,
  type CroppedAttachmentResult,
} from "@/components/voucher-document-cropper"
import {
  rotateImageBlob,
  rotatePdfBlob,
  dataUrlToCompressedImage,
} from "@/lib/image-compress"

export type AttachmentSourceModule =
  | "sales"
  | "purchases"
  | "expense_requests"
  | "commission_reports"
  | "commission_vouchers"
  | "commission_releases"
  | "collector_transactions"

export interface LibraryAttachmentItem {
  uid: string
  url: string
  rawUrl: string
  fileName: string
  fileKind: "image" | "pdf" | "other"
  sourceModule: AttachmentSourceModule
  sourceLabel: string
  categoryLabel: string
  recordId: string
  recordTitle: string
  recordSubtitle: string
  recordHref: string
  uploadedBy: string
  assignedArea?: string | null
  createdAt: string
  amount?: number | null
  status?: string | null
  extraDetails: { label: string; value: string }[]
  // Delete coordinates
  deleteMeta: {
    table: string
    idColumn: "id" | "uuid"
    idValue: string
    column: string
    mode:
      | "array_or_json" // sales, purchases, expense_requests
      | "text_array" // collector_transactions, commission_vouchers.attachments
      | "json_object_array" // commission_report.accounting_pot / secretary_pot
      | "pot_object_array" // commission_releases.pot_files
      | "single_nullable" // commission_vouchers.generated_pdf_url, commission_releases.combined_pdf_url
      | "voucher_multi" // commission_vouchers.voucher_attachment_url / header_attachment_url
    matchUrl: string
    potId?: string
    isSecretaryPot?: boolean
    arrayColumn?: string
  }
}

interface AttachmentsLibraryManagerProps {
  role: "super_admin" | "admin"
}

const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg", ".heic"]

function detectFileKind(url: string, mimeOrName?: string): "image" | "pdf" | "other" {
  const cleanUrl = (url || "").split("?")[0].toLowerCase()
  const hint = (mimeOrName || "").toLowerCase()
  if (cleanUrl.endsWith(".pdf") || hint.endsWith(".pdf") || hint.includes("pdf")) {
    return "pdf"
  }
  if (
    IMAGE_EXTS.some((ext) => cleanUrl.endsWith(ext) || hint.endsWith(ext)) ||
    hint.startsWith("image/")
  ) {
    return "image"
  }
  return "other"
}

function extractFileName(url: string, fallback?: string): string {
  if (fallback && !fallback.startsWith("http")) return fallback
  try {
    const clean = (url || "").split("?")[0]
    const last = clean.split("/").pop() || "Attachment"
    return decodeURIComponent(last)
  } catch {
    return fallback || "Attachment"
  }
}

function parseFlexibleUrlList(val: any): string[] {
  if (!val) return []
  if (Array.isArray(val)) return val.map((v) => String(v || "").trim()).filter(Boolean)
  if (typeof val === "string" && val.trim() !== "") {
    const trimmed = val.trim()
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          return parsed.map((v) => String(v || "").trim()).filter(Boolean)
        }
      } catch {
        return [trimmed]
      }
    }
    return [trimmed]
  }
  return []
}

function formatPeso(amount?: number | null): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return ""
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(amount))
}

function safeFormatDate(raw?: string | null): string {
  if (!raw) return "Unknown date"
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return format(d, "MMM dd, yyyy hh:mm a")
}

// Optional PDF.js CDN loader for crisp page-1 PDF thumbnails (gracefully falls back if S3 CORS blocks)
let pdfJsLibPromise: Promise<any> | null = null
function loadPdfJs(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject("no window")
  if ((window as any).pdfjsLib) return Promise.resolve((window as any).pdfjsLib)
  if (pdfJsLibPromise) return pdfJsLibPromise
  pdfJsLibPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
    script.async = true
    script.onload = () => {
      const lib = (window as any).pdfjsLib
      if (lib) {
        lib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
        resolve(lib)
      } else {
        reject(new Error("pdfjsLib unavailable"))
      }
    }
    script.onerror = () => reject(new Error("Failed to load PDF.js"))
    document.head.appendChild(script)
  })
  return pdfJsLibPromise
}

const pdfThumbCache = new Map<string, string | "failed">()

function PdfMasonryPreview({ item }: { item: LibraryAttachmentItem }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [thumbUrl, setThumbUrl] = useState<string | null>(() => {
    const cached = pdfThumbCache.get(item.url)
    return cached && cached !== "failed" ? cached : null
  })
  const [failed, setFailed] = useState<boolean>(() => pdfThumbCache.get(item.url) === "failed")

  useEffect(() => {
    if (thumbUrl || failed) return
    const el = containerRef.current
    if (!el) return

    let cancelled = false
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        observer.disconnect()

        ;(async () => {
          try {
            const pdfjs = await loadPdfJs()
            const loadingTask = pdfjs.getDocument({ url: item.url, withCredentials: false })
            const pdf = await loadingTask.promise
            if (cancelled) return
            const page = await pdf.getPage(1)
            const viewport = page.getViewport({ scale: 0.75 })
            const canvas = document.createElement("canvas")
            canvas.width = viewport.width
            canvas.height = viewport.height
            const ctx = canvas.getContext("2d")
            if (ctx) {
              ctx.fillStyle = "#ffffff"
              ctx.fillRect(0, 0, canvas.width, canvas.height)
              await page.render({ canvasContext: ctx, viewport }).promise
              const dataUrl = canvas.toDataURL("image/jpeg", 0.8)
              pdfThumbCache.set(item.url, dataUrl)
              if (!cancelled) setThumbUrl(dataUrl)
            }
          } catch {
            pdfThumbCache.set(item.url, "failed")
            if (!cancelled) setFailed(true)
          }
        })()
      },
      { rootMargin: "200px" }
    )

    observer.observe(el)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [item.url, thumbUrl, failed])

  if (thumbUrl) {
    return (
      <div className="relative w-full bg-white">
        <img
          src={thumbUrl}
          alt={item.fileName}
          className="w-full h-auto block"
          loading="lazy"
        />
        <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-red-600/90 text-white text-[10px] font-bold px-2 py-0.5 shadow-sm backdrop-blur-sm">
          <FileText className="w-2.5 h-2.5" />
          PDF
        </span>
      </div>
    )
  }

  // Crisp auto-proportioned fallback PDF document preview card
  return (
    <div
      ref={containerRef}
      className="w-full aspect-[3/4] bg-gradient-to-b from-slate-50 via-white to-red-50/40 flex flex-col justify-between p-4 border-b border-slate-100"
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5">
          <FileText className="w-3 h-3" />
          PDF
        </span>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          {item.categoryLabel}
        </span>
      </div>

      <div className="my-auto flex flex-col items-center text-center px-1">
        <div className="w-12 h-14 rounded-lg bg-white border border-red-200 shadow-sm flex flex-col items-center justify-center mb-3 relative">
          <div className="absolute top-0 right-0 w-3 h-3 bg-red-100 rounded-bl-md" />
          <FileText className="w-6 h-6 text-red-500" />
          <span className="text-[8px] font-extrabold text-red-600 mt-0.5">PDF</span>
        </div>
        <p className="text-xs font-bold text-[#001f3f] line-clamp-2 leading-snug">
          {item.recordTitle}
        </p>
        <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 break-all">
          {item.fileName}
        </p>
      </div>

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
        <span className="truncate max-w-[65%]">{item.uploadedBy}</span>
        <span className="font-semibold text-sky-700">Preview</span>
      </div>
    </div>
  )
}

const SOURCE_BADGE_STYLES: Record<AttachmentSourceModule, string> = {
  sales: "bg-emerald-100 text-emerald-800 border-emerald-200",
  purchases: "bg-amber-100 text-amber-800 border-amber-200",
  expense_requests: "bg-orange-100 text-orange-800 border-orange-200",
  commission_reports: "bg-indigo-100 text-indigo-800 border-indigo-200",
  commission_vouchers: "bg-sky-100 text-sky-800 border-sky-200",
  commission_releases: "bg-purple-100 text-purple-800 border-purple-200",
  collector_transactions: "bg-teal-100 text-teal-800 border-teal-200",
}

export function AttachmentsLibraryManager({ role }: AttachmentsLibraryManagerProps) {
  const { profile } = useAuth()
  const roleSlug = role === "super_admin" ? "super-admin" : "admin"

  const [items, setItems] = useState<LibraryAttachmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filters
  const [typeTab, setTypeTab] = useState<"all" | "image" | "pdf">("all")
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [uploaderFilter, setUploaderFilter] = useState<string>("all")
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest")
  const [searchTerm, setSearchTerm] = useState("")
  const [visibleCount, setVisibleCount] = useState(24)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  // Broken image tracker
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({})

  // Detail Modal state
  const [selectedItem, setSelectedItem] = useState<LibraryAttachmentItem | null>(null)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null)
  const [deletingUid, setDeletingUid] = useState<string | null>(null)
  const [copiedUrl, setCopiedUrl] = useState(false)

  const fetchAllAttachments = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const [
        salesRes,
        purchasesRes,
        expensesRes,
        reportsRes,
        vouchersRes,
        releasesRes,
        collectorRes,
      ] = await Promise.all([
        supabase
          .from("sales")
          .select(
            "id, name, tin, tax_month, invoice_number, gross_taxable, tax_type, user_full_name, cheque, voucher, invoice, doc_2307, deposit_slip, created_at"
          )
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(300),
        supabase
          .from("purchases")
          .select(
            "id, name, tin, tax_month, invoice_number, gross_taxable, tax_type, user_full_name, official_receipt, created_at"
          )
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(300),
        supabase
          .from("expense_requests")
          .select(
            "id, item_name, name, tax_month, gross_taxable, amount, total_actual_amount, status, user_full_name, user_assigned_area, official_receipt, created_at"
          )
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(250),
        supabase
          .from("commission_report")
          .select("uuid, report_number, status, remarks, accounting_pot, secretary_pot, created_at")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(250),
        supabase
          .from("commission_vouchers")
          .select(
            "id, voucher_number, slip_type, developer_name, agent_name, client_name, total_amount, created_by_name, assigned_area, generated_pdf_url, voucher_attachment_url, header_attachment_url, attachments, created_at"
          )
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(250),
        supabase
          .from("commission_releases")
          .select(
            "id, title, remarks, total_net_comm, created_by_name, assigned_area, combined_pdf_url, pot_files, created_at"
          )
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("collector_transactions")
          .select(
            "id, developer_name, cheque_number, commission_amount, cheque_amount, workflow_status, assigned_area, invoice_collected_by_name, cheque_collected_by_name, invoice_photo_urls, cheque_photo_urls, deposit_slip_urls, doc_2307_photo_urls, voucher_photo_urls, created_at"
          )
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(250),
      ])

      const collected: LibraryAttachmentItem[] = []

      // 1. Sales
      for (const s of (salesRes.data || []) as any[]) {
        const categories: { col: string; label: string }[] = [
          { col: "cheque", label: "Cheque" },
          { col: "voucher", label: "Voucher" },
          { col: "invoice", label: "Invoice" },
          { col: "doc_2307", label: "BIR 2307" },
          { col: "deposit_slip", label: "Deposit Slip" },
        ]
        for (const cat of categories) {
          const urls = parseFlexibleUrlList(s[cat.col])
          urls.forEach((rawUrl, idx) => {
            const url = formatS3Url(rawUrl)
            collected.push({
              uid: `sales-${s.id}-${cat.col}-${idx}`,
              url,
              rawUrl,
              fileName: extractFileName(url),
              fileKind: detectFileKind(url),
              sourceModule: "sales",
              sourceLabel: "Sales",
              categoryLabel: cat.label,
              recordId: String(s.id),
              recordTitle: s.name || "Sales Record",
              recordSubtitle: [
                s.invoice_number ? `Inv #${s.invoice_number}` : "",
                s.tax_month ? `Tax Month: ${s.tax_month.slice(0, 7)}` : "",
              ]
                .filter(Boolean)
                .join(" • "),
              recordHref: `/dashboard/${roleSlug}/sales`,
              uploadedBy: s.user_full_name || "Accounting",
              createdAt: s.created_at || "",
              amount: Number(s.gross_taxable) || null,
              status: s.tax_type ? String(s.tax_type).toUpperCase() : null,
              extraDetails: [
                { label: "Payee / Developer", value: s.name || "N/A" },
                { label: "TIN", value: s.tin || "N/A" },
                { label: "Invoice #", value: s.invoice_number || "N/A" },
                { label: "Tax Month", value: s.tax_month || "N/A" },
                { label: "Tax Type", value: (s.tax_type || "N/A").toUpperCase() },
                { label: "Gross Taxable", value: formatPeso(s.gross_taxable) || "N/A" },
              ],
              deleteMeta: {
                table: "sales",
                idColumn: "id",
                idValue: String(s.id),
                column: cat.col,
                mode: "array_or_json",
                matchUrl: rawUrl,
              },
            })
          })
        }
      }

      // 2. Purchases
      for (const p of (purchasesRes.data || []) as any[]) {
        const urls = parseFlexibleUrlList(p.official_receipt)
        urls.forEach((rawUrl, idx) => {
          const url = formatS3Url(rawUrl)
          collected.push({
            uid: `purchases-${p.id}-${idx}`,
            url,
            rawUrl,
            fileName: extractFileName(url),
            fileKind: detectFileKind(url),
            sourceModule: "purchases",
            sourceLabel: "Purchases",
            categoryLabel: "Official Receipt",
            recordId: String(p.id),
            recordTitle: p.name || "Purchase Record",
            recordSubtitle: [
              p.invoice_number ? `Inv #${p.invoice_number}` : "",
              p.tax_month ? `Tax Month: ${p.tax_month.slice(0, 7)}` : "",
            ]
              .filter(Boolean)
              .join(" • "),
            recordHref: `/dashboard/super-admin/purchases`,
            uploadedBy: p.user_full_name || "Accounting",
            createdAt: p.created_at || "",
            amount: Number(p.gross_taxable) || null,
            status: p.tax_type ? String(p.tax_type).toUpperCase() : null,
            extraDetails: [
              { label: "Supplier", value: p.name || "N/A" },
              { label: "TIN", value: p.tin || "N/A" },
              { label: "Invoice #", value: p.invoice_number || "N/A" },
              { label: "Tax Month", value: p.tax_month || "N/A" },
              { label: "Gross Taxable", value: formatPeso(p.gross_taxable) || "N/A" },
            ],
            deleteMeta: {
              table: "purchases",
              idColumn: "id",
              idValue: String(p.id),
              column: "official_receipt",
              mode: "array_or_json",
              matchUrl: rawUrl,
            },
          })
        })
      }

      // 3. Expense Requests
      for (const e of (expensesRes.data || []) as any[]) {
        const urls = parseFlexibleUrlList(e.official_receipt)
        urls.forEach((rawUrl, idx) => {
          const url = formatS3Url(rawUrl)
          const amt = Number(e.total_actual_amount ?? e.amount ?? e.gross_taxable) || null
          collected.push({
            uid: `expense-${e.id}-${idx}`,
            url,
            rawUrl,
            fileName: extractFileName(url),
            fileKind: detectFileKind(url),
            sourceModule: "expense_requests",
            sourceLabel: "Expense Request",
            categoryLabel: "Receipt / Proof",
            recordId: String(e.id),
            recordTitle: e.item_name || e.name || "Expense Request",
            recordSubtitle: e.name && e.item_name ? e.name : e.tax_month || "",
            recordHref: `/dashboard/super-admin/expense-request`,
            uploadedBy: e.user_full_name || "Staff",
            assignedArea: e.user_assigned_area || null,
            createdAt: e.created_at || "",
            amount: amt,
            status: e.status || null,
            extraDetails: [
              { label: "Item", value: e.item_name || "N/A" },
              { label: "Payee / Supplier", value: e.name || "N/A" },
              { label: "Tax Month", value: e.tax_month || "N/A" },
              { label: "Amount", value: formatPeso(amt) || "N/A" },
              { label: "Status", value: e.status || "N/A" },
            ],
            deleteMeta: {
              table: "expense_requests",
              idColumn: "id",
              idValue: String(e.id),
              column: "official_receipt",
              mode: "array_or_json",
              matchUrl: rawUrl,
            },
          })
        })
      }

      // 4. Commission Reports (accounting_pot & secretary_pot)
      for (const r of (reportsRes.data || []) as any[]) {
        const pots: { col: "accounting_pot" | "secretary_pot"; label: string; isSec: boolean }[] = [
          { col: "accounting_pot", label: "Accounting POT", isSec: false },
          { col: "secretary_pot", label: "Secretary POT", isSec: true },
        ]
        for (const pot of pots) {
          const arr = safeParseArray<any>(r[pot.col])
          arr.forEach((entry, idx) => {
            if (!entry?.url) return
            const url = formatS3Url(entry.url)
            collected.push({
              uid: `report-${r.uuid}-${pot.col}-${idx}`,
              url,
              rawUrl: entry.url,
              fileName: entry.name || extractFileName(url),
              fileKind: detectFileKind(url, entry.type || entry.name),
              sourceModule: "commission_reports",
              sourceLabel: "Commission Report",
              categoryLabel: pot.label,
              recordId: String(r.uuid),
              recordTitle: `Report #${r.report_number}`,
              recordSubtitle: r.remarks || r.status || "",
              recordHref: `/dashboard/super-admin/commission-reports`,
              uploadedBy: pot.isSec ? "Secretary" : "Accounting",
              createdAt: entry.uploadedAt || r.created_at || "",
              status: r.status || null,
              extraDetails: [
                { label: "Report Number", value: `#${r.report_number}` },
                { label: "POT Bucket", value: pot.label },
                { label: "Report Status", value: r.status || "N/A" },
                { label: "Remarks", value: r.remarks || "—" },
              ],
              deleteMeta: {
                table: "commission_report",
                idColumn: "uuid",
                idValue: String(r.uuid),
                column: pot.col,
                mode: "json_object_array",
                matchUrl: entry.url,
                isSecretaryPot: pot.isSec,
              },
            })
          })
        }
      }

      // 5. Commission Vouchers
      for (const v of (vouchersRes.data || []) as any[]) {
        const baseDetails = [
          { label: "Voucher #", value: `#${v.voucher_number || "N/A"}` },
          { label: "Slip Type", value: v.slip_type || "N/A" },
          { label: "Developer", value: v.developer_name || "N/A" },
          { label: "Agent", value: v.agent_name || "N/A" },
          { label: "Client", value: v.client_name || "N/A" },
          { label: "Net Release", value: formatPeso(v.total_amount) || "N/A" },
        ]

        if (v.generated_pdf_url) {
          const url = formatS3Url(v.generated_pdf_url)
          collected.push({
            uid: `voucher-${v.id}-pdf`,
            url,
            rawUrl: v.generated_pdf_url,
            fileName: extractFileName(url, `Commission_Voucher_${v.voucher_number}.pdf`),
            fileKind: "pdf",
            sourceModule: "commission_vouchers",
            sourceLabel: "Commission Voucher",
            categoryLabel: "Generated Slip PDF",
            recordId: String(v.id),
            recordTitle: `Voucher #${v.voucher_number || "N/A"} — ${v.agent_name || ""}`.trim(),
            recordSubtitle: `${v.developer_name || ""} • ${v.slip_type || ""}`.trim(),
            recordHref: `/dashboard/super-admin/vouchers`,
            uploadedBy: v.created_by_name || "Accounting",
            assignedArea: v.assigned_area || null,
            createdAt: v.created_at || "",
            amount: Number(v.total_amount) || null,
            status: v.slip_type || null,
            extraDetails: baseDetails,
            deleteMeta: {
              table: "commission_vouchers",
              idColumn: "id",
              idValue: String(v.id),
              column: "generated_pdf_url",
              mode: "single_nullable",
              matchUrl: v.generated_pdf_url,
            },
          })
        }

        const vCrops = parseVoucherAttachmentUrls(v.voucher_attachment_url, v.voucher_attachment_urls)
        vCrops.forEach((rawUrl, idx) => {
          const url = formatS3Url(rawUrl)
          collected.push({
            uid: `voucher-${v.id}-vcrop-${idx}`,
            url,
            rawUrl,
            fileName: extractFileName(url, `Voucher_Crop_${idx + 1}.png`),
            fileKind: detectFileKind(url),
            sourceModule: "commission_vouchers",
            sourceLabel: "Commission Voucher",
            categoryLabel: "Voucher Crop",
            recordId: String(v.id),
            recordTitle: `Voucher #${v.voucher_number || "N/A"} — ${v.agent_name || ""}`.trim(),
            recordSubtitle: v.developer_name || "",
            recordHref: `/dashboard/super-admin/vouchers`,
            uploadedBy: v.created_by_name || "Accounting",
            assignedArea: v.assigned_area || null,
            createdAt: v.created_at || "",
            amount: Number(v.total_amount) || null,
            status: v.slip_type || null,
            extraDetails: baseDetails,
            deleteMeta: {
              table: "commission_vouchers",
              idColumn: "id",
              idValue: String(v.id),
              column: "voucher_attachment_url",
              arrayColumn: "voucher_attachment_urls",
              mode: "voucher_multi",
              matchUrl: rawUrl,
            },
          })
        })

        const hCrops = parseVoucherAttachmentUrls(v.header_attachment_url, v.header_attachment_urls)
        hCrops.forEach((rawUrl, idx) => {
          const url = formatS3Url(rawUrl)
          collected.push({
            uid: `voucher-${v.id}-hcrop-${idx}`,
            url,
            rawUrl,
            fileName: extractFileName(url, `Header_Crop_${idx + 1}.png`),
            fileKind: detectFileKind(url),
            sourceModule: "commission_vouchers",
            sourceLabel: "Commission Voucher",
            categoryLabel: "Header Crop",
            recordId: String(v.id),
            recordTitle: `Voucher #${v.voucher_number || "N/A"} — ${v.agent_name || ""}`.trim(),
            recordSubtitle: v.developer_name || "",
            recordHref: `/dashboard/super-admin/vouchers`,
            uploadedBy: v.created_by_name || "Accounting",
            assignedArea: v.assigned_area || null,
            createdAt: v.created_at || "",
            amount: Number(v.total_amount) || null,
            status: v.slip_type || null,
            extraDetails: baseDetails,
            deleteMeta: {
              table: "commission_vouchers",
              idColumn: "id",
              idValue: String(v.id),
              column: "header_attachment_url",
              arrayColumn: "header_attachment_urls",
              mode: "voucher_multi",
              matchUrl: rawUrl,
            },
          })
        })

        const extraArr = parseFlexibleUrlList(v.attachments)
        extraArr.forEach((rawUrl, idx) => {
          const url = formatS3Url(rawUrl)
          collected.push({
            uid: `voucher-${v.id}-extra-${idx}`,
            url,
            rawUrl,
            fileName: extractFileName(url),
            fileKind: detectFileKind(url),
            sourceModule: "commission_vouchers",
            sourceLabel: "Commission Voucher",
            categoryLabel: "Supporting File",
            recordId: String(v.id),
            recordTitle: `Voucher #${v.voucher_number || "N/A"} — ${v.agent_name || ""}`.trim(),
            recordSubtitle: v.developer_name || "",
            recordHref: `/dashboard/super-admin/vouchers`,
            uploadedBy: v.created_by_name || "Accounting",
            assignedArea: v.assigned_area || null,
            createdAt: v.created_at || "",
            amount: Number(v.total_amount) || null,
            status: v.slip_type || null,
            extraDetails: baseDetails,
            deleteMeta: {
              table: "commission_vouchers",
              idColumn: "id",
              idValue: String(v.id),
              column: "attachments",
              mode: "text_array",
              matchUrl: rawUrl,
            },
          })
        })
      }

      // 6. Commission Releases
      for (const rel of (releasesRes.data || []) as any[]) {
        const baseDetails = [
          { label: "Release Title", value: rel.title || "N/A" },
          { label: "Total Net Comm.", value: formatPeso(rel.total_net_comm) || "N/A" },
          { label: "Remarks", value: rel.remarks || "—" },
        ]
        if (rel.combined_pdf_url) {
          const url = formatS3Url(rel.combined_pdf_url)
          collected.push({
            uid: `release-${rel.id}-pdf`,
            url,
            rawUrl: rel.combined_pdf_url,
            fileName: extractFileName(url, `${rel.title || "Release"}.pdf`),
            fileKind: "pdf",
            sourceModule: "commission_releases",
            sourceLabel: "Commission Release",
            categoryLabel: "Merged Release PDF",
            recordId: String(rel.id),
            recordTitle: rel.title || "Commission Release",
            recordSubtitle: rel.remarks || "",
            recordHref: `/dashboard/super-admin/releases`,
            uploadedBy: rel.created_by_name || "Accounting",
            assignedArea: rel.assigned_area || null,
            createdAt: rel.created_at || "",
            amount: Number(rel.total_net_comm) || null,
            extraDetails: baseDetails,
            deleteMeta: {
              table: "commission_releases",
              idColumn: "id",
              idValue: String(rel.id),
              column: "combined_pdf_url",
              mode: "single_nullable",
              matchUrl: rel.combined_pdf_url,
            },
          })
        }
        const potFiles = Array.isArray(rel.pot_files) ? rel.pot_files : []
        potFiles.forEach((pf: any, idx: number) => {
          if (!pf?.url) return
          const url = formatS3Url(pf.url)
          collected.push({
            uid: `release-${rel.id}-pot-${pf.id || idx}`,
            url,
            rawUrl: pf.url,
            fileName: extractFileName(url, pf.filename),
            fileKind: detectFileKind(url, pf.filename),
            sourceModule: "commission_releases",
            sourceLabel: "Commission Release",
            categoryLabel: "Proof of Transaction",
            recordId: String(rel.id),
            recordTitle: rel.title || "Commission Release",
            recordSubtitle: rel.remarks || "",
            recordHref: `/dashboard/super-admin/releases`,
            uploadedBy: pf.admin_name || rel.created_by_name || "Accounting",
            assignedArea: rel.assigned_area || null,
            createdAt: pf.uploaded_at || rel.created_at || "",
            amount: Number(rel.total_net_comm) || null,
            extraDetails: baseDetails,
            deleteMeta: {
              table: "commission_releases",
              idColumn: "id",
              idValue: String(rel.id),
              column: "pot_files",
              mode: "pot_object_array",
              matchUrl: pf.url,
              potId: pf.id,
            },
          })
        })
      }

      // 7. Collector Transactions
      for (const ct of (collectorRes.data || []) as any[]) {
        const buckets: { col: string; label: string }[] = [
          { col: "invoice_photo_urls", label: "Invoice" },
          { col: "cheque_photo_urls", label: "Cheque" },
          { col: "deposit_slip_urls", label: "Deposit Slip" },
          { col: "doc_2307_photo_urls", label: "BIR 2307" },
          { col: "voucher_photo_urls", label: "Check Voucher" },
        ]
        const collectorName =
          ct.cheque_collected_by_name || ct.invoice_collected_by_name || "Field Collector"
        for (const b of buckets) {
          const urls = parseFlexibleUrlList(ct[b.col])
          urls.forEach((rawUrl, idx) => {
            const url = formatS3Url(rawUrl)
            collected.push({
              uid: `collector-${ct.id}-${b.col}-${idx}`,
              url,
              rawUrl,
              fileName: extractFileName(url),
              fileKind: detectFileKind(url),
              sourceModule: "collector_transactions",
              sourceLabel: "Collector Batch",
              categoryLabel: b.label,
              recordId: String(ct.id),
              recordTitle: ct.developer_name || "Collector Transaction",
              recordSubtitle: [
                ct.cheque_number ? `Cheque #${ct.cheque_number}` : "",
                ct.workflow_status ? ct.workflow_status.replace(/_/g, " ") : "",
              ]
                .filter(Boolean)
                .join(" • "),
              recordHref: `/dashboard/${roleSlug}/cheque-verification`,
              uploadedBy: collectorName,
              assignedArea: ct.assigned_area || null,
              createdAt: ct.created_at || "",
              amount: Number(ct.cheque_amount || ct.commission_amount) || null,
              status: ct.workflow_status || null,
              extraDetails: [
                { label: "Developer", value: ct.developer_name || "N/A" },
                { label: "Cheque #", value: ct.cheque_number || "N/A" },
                { label: "Commission Amount", value: formatPeso(ct.commission_amount) || "N/A" },
                { label: "Cheque Amount", value: formatPeso(ct.cheque_amount) || "N/A" },
                { label: "Workflow Status", value: (ct.workflow_status || "N/A").replace(/_/g, " ") },
              ],
              deleteMeta: {
                table: "collector_transactions",
                idColumn: "id",
                idValue: String(ct.id),
                column: b.col,
                mode: "text_array",
                matchUrl: rawUrl,
              },
            })
          })
        }
      }

      // Sort newest first by default
      collected.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return tb - ta
      })

      setItems(collected)
    } catch (err) {
      console.error("Error loading attachments library:", err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [roleSlug])

  useEffect(() => {
    fetchAllAttachments(false)
  }, [fetchAllAttachments])

  const uploaders = useMemo(() => {
    const set = new Set<string>()
    items.forEach((it) => {
      if (it.uploadedBy) set.add(it.uploadedBy)
    })
    return Array.from(set).sort()
  }, [items])

  const counts = useMemo(() => {
    let images = 0
    let pdfs = 0
    for (const it of items) {
      if (it.fileKind === "image") images++
      else if (it.fileKind === "pdf") pdfs++
    }
    return { all: items.length, images, pdfs }
  }, [items])

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    const list = items.filter((it) => {
      if (typeTab === "image" && it.fileKind !== "image") return false
      if (typeTab === "pdf" && it.fileKind !== "pdf") return false
      if (sourceFilter !== "all" && it.sourceModule !== sourceFilter) return false
      if (uploaderFilter !== "all" && it.uploadedBy !== uploaderFilter) return false
      if (q) {
        const haystack = [
          it.fileName,
          it.recordTitle,
          it.recordSubtitle,
          it.sourceLabel,
          it.categoryLabel,
          it.uploadedBy,
          it.assignedArea || "",
          ...it.extraDetails.map((d) => d.value),
        ]
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })

    if (sortOrder === "oldest") {
      return [...list].reverse()
    }
    return list
  }, [items, typeTab, sourceFilter, uploaderFilter, searchTerm, sortOrder])

  const displayedItems = useMemo(
    () => filteredItems.slice(0, visibleCount),
    [filteredItems, visibleCount]
  )

  // Auto-load next 24 cards as user scrolls near bottom
  useEffect(() => {
    const el = loadMoreRef.current
    if (!el || visibleCount >= filteredItems.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((c) => Math.min(filteredItems.length, c + 24))
        }
      },
      { rootMargin: "300px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visibleCount, filteredItems.length])

  const selectedIndex = useMemo(() => {
    if (!selectedItem) return -1
    return filteredItems.findIndex((i) => i.uid === selectedItem.uid)
  }, [filteredItems, selectedItem])

  const openItem = (item: LibraryAttachmentItem) => {
    setSelectedItem(item)
    setZoom(1)
    setRotation(0)
    setNaturalSize(null)
    setCopiedUrl(false)
  }

  const navigateSelected = (dir: -1 | 1) => {
    if (selectedIndex < 0 || filteredItems.length <= 1) return
    const nextIdx = (selectedIndex + dir + filteredItems.length) % filteredItems.length
    openItem(filteredItems[nextIdx])
  }

  useEffect(() => {
    if (!selectedItem) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") navigateSelected(-1)
      else if (e.key === "ArrowRight") navigateSelected(1)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  })

  const handleDeleteAttachment = async (item: LibraryAttachmentItem) => {
    if (
      !window.confirm(
        `Permanently remove "${item.fileName}" from ${item.sourceLabel} (${item.recordTitle})?`
      )
    ) {
      return
    }

    setDeletingUid(item.uid)
    try {
      const m = item.deleteMeta
      const { data: row, error: fetchErr } = await supabase
        .from(m.table)
        .select("*")
        .eq(m.idColumn, m.idValue)
        .single()

      if (fetchErr || !row) {
        throw new Error(fetchErr?.message || "Could not locate source record.")
      }

      let updatePayload: Record<string, any> = {}

      if (m.mode === "single_nullable") {
        updatePayload[m.column] = null
      } else if (m.mode === "array_or_json") {
        const list = parseFlexibleUrlList(row[m.column])
        const next = list.filter((u) => u !== m.matchUrl && formatS3Url(u) !== item.url)
        updatePayload[m.column] = next.length > 0 ? next : null
      } else if (m.mode === "text_array") {
        const list = parseFlexibleUrlList(row[m.column])
        const next = list.filter((u) => u !== m.matchUrl && formatS3Url(u) !== item.url)
        updatePayload[m.column] = next
      } else if (m.mode === "json_object_array") {
        const arr = safeParseArray<any>(row[m.column])
        const next = arr.filter(
          (entry) => entry && entry.url !== m.matchUrl && formatS3Url(entry.url) !== item.url
        )
        updatePayload[m.column] = JSON.stringify(next)
      } else if (m.mode === "pot_object_array") {
        const arr = Array.isArray(row[m.column]) ? row[m.column] : []
        const next = arr.filter((pf: any) =>
          m.potId ? pf.id !== m.potId : pf.url !== m.matchUrl && formatS3Url(pf.url) !== item.url
        )
        updatePayload[m.column] = next
      } else if (m.mode === "voucher_multi") {
        const list = parseVoucherAttachmentUrls(
          row[m.column],
          m.arrayColumn ? row[m.arrayColumn] : null
        )
        const next = list.filter((u) => u !== m.matchUrl && formatS3Url(u) !== item.url)
        updatePayload[m.column] = serializeVoucherAttachmentUrls(next)
        if (m.arrayColumn && Object.prototype.hasOwnProperty.call(row, m.arrayColumn)) {
          updatePayload[m.arrayColumn] = next
        }
      }

      const { error: updateErr } = await supabase
        .from(m.table)
        .update(updatePayload)
        .eq(m.idColumn, m.idValue)

      if (updateErr) throw updateErr

      if (profile?.id) {
        await logNotification(supabase, {
          action: "library_attachment_deleted",
          description: `Deleted attachment "${item.fileName}" from ${item.sourceLabel} (${item.recordTitle}) via File Library`,
          ip_address: null,
          location: null,
          meta: JSON.stringify({
            sourceModule: item.sourceModule,
            recordId: item.recordId,
            category: item.categoryLabel,
            url: item.url,
          }),
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
          user_email: profile.email || "",
          user_name: profile.full_name || profile.first_name || profile.id,
          user_uuid: profile.id,
        })
      }

      // Update local list & advance or close modal
      const nextFiltered = filteredItems.filter((i) => i.uid !== item.uid)
      setItems((prev) => prev.filter((i) => i.uid !== item.uid))
      if (nextFiltered.length === 0) {
        setSelectedItem(null)
      } else {
        const nextIdx = Math.min(selectedIndex, nextFiltered.length - 1)
        openItem(nextFiltered[nextIdx])
      }
    } catch (err: any) {
      console.error("Error deleting attachment from library:", err)
      alert("Error deleting attachment: " + (err?.message || "Please try again."))
    } finally {
      setDeletingUid(null)
    }
  }

  // In-place Rotate 90° & Crop/Re-upload for ANY attachment across all modules (Super Admin & Admin)
  const [editingUid, setEditingUid] = useState<string | null>(null)
  const [cropLibTarget, setCropLibTarget] = useState<{
    item: LibraryAttachmentItem
    file: File
  } | null>(null)

  const fetchLibraryProxiedBlob = async (url: string): Promise<{ blob: Blob; contentType: string }> => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const res = await fetch(`/api/proxy-file?url=${encodeURIComponent(url)}`, {
      headers: session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : undefined,
    })
    if (!res.ok) throw new Error(`Failed to fetch attachment (${res.status})`)
    const blob = await res.blob()
    const contentType = res.headers.get("content-type") || blob.type || "application/octet-stream"
    return { blob, contentType }
  }

  const replaceLibraryAttachmentInPlace = async (
    item: LibraryAttachmentItem,
    newBlob: Blob,
    fileName: string,
    mimeType: string,
    actionLabel: string
  ) => {
    setEditingUid(item.uid)
    try {
      // 1. Upload edited file to S3 FIRST so existing attachment is never lost
      const presignedRes = await fetch("/api/get-s3-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName,
          fileType: mimeType,
          category: item.sourceModule,
          attachmentType: item.categoryLabel,
        }),
      })
      if (!presignedRes.ok) throw new Error(`Failed to authorize upload for ${fileName}`)
      const { uploadUrl, publicUrl } = await presignedRes.json()
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": mimeType },
        body: newBlob,
      })
      if (!putRes.ok) throw new Error(`S3 upload failed (${putRes.status})`)
      const newUrl = formatS3Url(publicUrl)

      // 2. Replace exact URL in-place in the source table/column
      const m = item.deleteMeta
      const { data: row, error: fetchErr } = await supabase
        .from(m.table)
        .select("*")
        .eq(m.idColumn, m.idValue)
        .single()
      if (fetchErr || !row) throw new Error(fetchErr?.message || "Could not locate source record.")

      const isMatch = (u: string) => u === m.matchUrl || formatS3Url(u) === item.url
      const updatePayload: Record<string, any> = {}

      if (m.mode === "single_nullable") {
        updatePayload[m.column] = newUrl
      } else if (m.mode === "array_or_json" || m.mode === "text_array") {
        const list = parseFlexibleUrlList(row[m.column])
        const next = list.map((u) => (isMatch(u) ? newUrl : u))
        updatePayload[m.column] = next
      } else if (m.mode === "json_object_array") {
        const arr = safeParseArray<any>(row[m.column])
        const next = arr.map((entry) =>
          entry && isMatch(entry.url || "") ? { ...entry, url: newUrl, name: fileName } : entry
        )
        updatePayload[m.column] = JSON.stringify(next)
      } else if (m.mode === "pot_object_array") {
        const arr = Array.isArray(row[m.column]) ? row[m.column] : []
        const next = arr.map((pf: any) =>
          (m.potId ? pf.id === m.potId : isMatch(pf.url || ""))
            ? { ...pf, url: newUrl, filename: newUrl }
            : pf
        )
        updatePayload[m.column] = next
      } else if (m.mode === "voucher_multi") {
        const list = parseVoucherAttachmentUrls(
          row[m.column],
          m.arrayColumn ? row[m.arrayColumn] : null
        )
        const next = list.map((u) => (isMatch(u) ? newUrl : u))
        updatePayload[m.column] = serializeVoucherAttachmentUrls(next)
        if (m.arrayColumn && Object.prototype.hasOwnProperty.call(row, m.arrayColumn)) {
          updatePayload[m.arrayColumn] = next
        }
      }

      const { error: updateErr } = await supabase
        .from(m.table)
        .update(updatePayload)
        .eq(m.idColumn, m.idValue)
      if (updateErr) throw updateErr

      if (profile?.id) {
        await logNotification(supabase, {
          action: "library_attachment_edited",
          description: `${actionLabel} attachment "${item.fileName}" in ${item.sourceLabel} (${item.recordTitle}) via File Library`,
          ip_address: null,
          location: null,
          meta: JSON.stringify({
            sourceModule: item.sourceModule,
            recordId: item.recordId,
            category: item.categoryLabel,
            oldUrl: item.url,
            newUrl,
          }),
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
          user_email: profile.email || "",
          user_name: profile.full_name || profile.first_name || profile.id,
          user_uuid: profile.id,
        })
      }

      const updatedItem: LibraryAttachmentItem = {
        ...item,
        url: newUrl,
        fileName,
        fileType: mimeType === "application/pdf" ? "pdf" : "image",
        deleteMeta: { ...item.deleteMeta, matchUrl: newUrl },
      }
      setItems((prev) => prev.map((i) => (i.uid === item.uid ? updatedItem : i)))
      setSelectedItem(updatedItem)
    } catch (err: any) {
      console.error("Error updating attachment in File Library:", err)
      alert("Error updating attachment: " + (err?.message || "Please try again."))
    } finally {
      setEditingUid(null)
    }
  }

  const handleRotateLibraryItem = async (item: LibraryAttachmentItem) => {
    if (editingUid) return
    setEditingUid(item.uid)
    try {
      const { blob, contentType } = await fetchLibraryProxiedBlob(item.url)
      const isPdf = contentType.includes("pdf") || item.fileType === "pdf"
      const baseName = item.fileName.replace(/\.[^.]+$/, "")
      if (isPdf) {
        const rotated = await rotatePdfBlob(blob, 90)
        await replaceLibraryAttachmentInPlace(
          item,
          rotated.pdfBlob,
          `${baseName}_rot.pdf`,
          "application/pdf",
          "Rotated 90°"
        )
      } else {
        const rotated = await rotateImageBlob(blob, 90, 0.85)
        await replaceLibraryAttachmentInPlace(
          item,
          rotated.blob,
          `${baseName}_rot.jpg`,
          "image/jpeg",
          "Rotated 90°"
        )
      }
    } catch (err: any) {
      console.error("Rotate library item failed:", err)
      alert("Error rotating attachment: " + (err?.message || "Failed"))
      setEditingUid(null)
    }
  }

  const handleOpenCropLibraryItem = async (item: LibraryAttachmentItem) => {
    if (editingUid) return
    setEditingUid(item.uid)
    try {
      const { blob, contentType } = await fetchLibraryProxiedBlob(item.url)
      const isPdf = contentType.includes("pdf") || item.fileType === "pdf"
      const file = new File([blob], item.fileName, {
        type: isPdf ? "application/pdf" : contentType || "image/jpeg",
      })
      setCropLibTarget({ item, file })
    } catch (err: any) {
      console.error("Load library item for crop failed:", err)
      alert("Could not load file for cropping: " + (err?.message || "Failed"))
    } finally {
      setEditingUid(null)
    }
  }

  const handleCropLibraryConfirmed = async (result: CroppedAttachmentResult) => {
    if (!cropLibTarget) return
    const { item } = cropLibTarget
    setCropLibTarget(null)
    try {
      const compressed = await dataUrlToCompressedImage(result.dataUrl, 0.85)
      const baseName = item.fileName.replace(/\.[^.]+$/, "")
      await replaceLibraryAttachmentInPlace(
        item,
        compressed.blob,
        `${baseName}_cropped.jpg`,
        "image/jpeg",
        "Cropped"
      )
    } catch (err: any) {
      console.error("Save cropped library item failed:", err)
      alert("Failed to save cropped attachment: " + (err?.message || "Failed"))
    }
  }

  return (
    <div className="space-y-5">
      {/* Top ChatGPT-style Clean Library Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#001f3f] to-[#0284c7] text-white flex items-center justify-center shadow-sm">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-[#001f3f]">
                  Attachments Library
                </h1>
                <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 border border-slate-200 font-semibold">
                  {filteredItems.length.toLocaleString()} file{filteredItems.length === 1 ? "" : "s"}
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Browse every uploaded image &amp; PDF across Sales, Purchases, Expenses, Commission Reports, Vouchers, Releases, and Collector Batches.
              </p>
            </div>
          </div>

          {/* Search & Refresh */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setVisibleCount(24)
                }}
                placeholder="Search library (record, uploader, cheque, file...)"
                className="pl-10 rounded-full bg-slate-50 border-slate-200 focus:bg-white text-sm text-[#001f3f]"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => fetchAllAttachments(true)}
              disabled={refreshing || loading}
              className="rounded-full border-slate-200 text-[#001f3f] hover:bg-slate-100 shrink-0"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Clean Pill Tabs + Secondary Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          {/* Type Tabs (All / Images / PDFs) */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { key: "all", label: "All", count: counts.all },
                { key: "image", label: "Images", count: counts.images },
                { key: "pdf", label: "PDFs", count: counts.pdfs },
              ] as const
            ).map((tab) => {
              const active = typeTab === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setTypeTab(tab.key)
                    setVisibleCount(24)
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
                    active
                      ? "bg-[#001f3f] text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`ml-1.5 text-[11px] ${
                      active ? "text-sky-200" : "text-slate-400"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Module / Uploader / Sort Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={sourceFilter}
              onValueChange={(val) => {
                setSourceFilter(val)
                setVisibleCount(24)
              }}
            >
              <SelectTrigger className="h-9 w-44 rounded-full bg-white border-slate-200 text-xs text-[#001f3f]">
                <SelectValue placeholder="All Modules" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Modules</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="purchases">Purchases</SelectItem>
                <SelectItem value="expense_requests">Expense Requests</SelectItem>
                <SelectItem value="commission_reports">Commission Reports</SelectItem>
                <SelectItem value="commission_vouchers">Commission Vouchers</SelectItem>
                <SelectItem value="commission_releases">Commission Releases</SelectItem>
                <SelectItem value="collector_transactions">Collector Batches</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={uploaderFilter}
              onValueChange={(val) => {
                setUploaderFilter(val)
                setVisibleCount(24)
              }}
            >
              <SelectTrigger className="h-9 w-44 rounded-full bg-white border-slate-200 text-xs text-[#001f3f]">
                <SelectValue placeholder="All Uploaders" />
              </SelectTrigger>
              <SelectContent className="bg-white max-h-72">
                <SelectItem value="all">All Uploaders</SelectItem>
                {uploaders.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={sortOrder}
              onValueChange={(val) => setSortOrder(val as "newest" | "oldest")}
            >
              <SelectTrigger className="h-9 w-36 rounded-full bg-white border-slate-200 text-xs text-[#001f3f]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Masonry Media Grid */}
      {loading ? (
        <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-4 space-y-4">
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className={`break-inside-avoid rounded-2xl bg-slate-200/70 animate-pulse ${
                i % 3 === 0 ? "h-64" : i % 3 === 1 ? "h-44" : "h-80"
              }`}
            />
          ))}
        </div>
      ) : displayedItems.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl py-20 text-center space-y-2">
          <FolderOpen className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-base font-semibold text-slate-700">No matching attachments found</p>
          <p className="text-xs text-slate-500">
            Try clearing your search or switching the module/file type filter.
          </p>
        </div>
      ) : (
        <>
          <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 gap-4 space-y-4">
            {displayedItems.map((item) => {
              const isBroken = brokenImages[item.uid]
              return (
                <div
                  key={item.uid}
                  onClick={() => openItem(item)}
                  className="break-inside-avoid group relative rounded-2xl overflow-hidden bg-white border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-sky-300 transition-all duration-200 cursor-pointer"
                >
                  {/* Auto-fitting Media Preview preserving natural aspect ratio */}
                  {item.fileKind === "image" && !isBroken ? (
                    <div className="relative w-full bg-slate-100">
                      <img
                        src={getThumbnailUrl(item.url, 640, 75)}
                        alt={item.fileName}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          const img = e.currentTarget
                          if (!img.dataset.fallbackUsed && img.src !== item.url) {
                            img.dataset.fallbackUsed = "1"
                            img.src = item.url
                          } else {
                            setBrokenImages((prev) => ({ ...prev, [item.uid]: true }))
                          }
                        }}
                        className="w-full h-auto block object-contain group-hover:scale-[1.02] transition-transform duration-300"
                      />
                    </div>
                  ) : item.fileKind === "pdf" ? (
                    <PdfMasonryPreview item={item} />
                  ) : (
                    <div className="w-full aspect-[4/3] bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
                      {isBroken ? (
                        <AlertCircle className="w-7 h-7 text-amber-500 mb-2" />
                      ) : (
                        <FileText className="w-7 h-7 text-slate-400 mb-2" />
                      )}
                      <p className="text-xs font-semibold text-slate-700 line-clamp-2 break-all">
                        {item.fileName}
                      </p>
                      <span className="text-[10px] text-slate-400 mt-1">
                        {isBroken ? "Preview unavailable" : "File Attachment"}
                      </span>
                    </div>
                  )}

                  {/* Subtle Hover Info Overlay */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/45 to-transparent p-3 pt-8 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/20 text-white backdrop-blur-sm">
                        {item.sourceLabel}
                      </span>
                      <span className="text-[10px] font-medium text-sky-200 truncate">
                        {item.categoryLabel}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-white truncate">
                      {item.recordTitle}
                    </p>
                    <p className="text-[10px] text-slate-300 truncate">
                      By {item.uploadedBy}
                    </p>
                  </div>

                  {/* Compact Footer Strip for quick scanning */}
                  <div className="px-2.5 py-2 bg-white border-t border-slate-100 flex items-center justify-between gap-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-[#001f3f] truncate">
                        {item.recordTitle}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {item.sourceLabel} &bull; {item.categoryLabel}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                        item.fileKind === "pdf"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-sky-50 text-sky-700 border-sky-200"
                      }`}
                    >
                      {item.fileKind === "pdf" ? "PDF" : "IMG"}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Auto Load More Sentinel + Button */}
          {visibleCount < filteredItems.length && (
            <div ref={loadMoreRef} className="flex justify-center pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setVisibleCount((c) => c + 24)}
                className="rounded-full px-6 border-[#001f3f] text-[#001f3f] bg-white hover:bg-slate-100 font-semibold"
              >
                Load More ({filteredItems.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </>
      )}

      {/* Rich Attachment Inspector Modal */}
      <Dialog open={Boolean(selectedItem)} onOpenChange={(o) => !o && setSelectedItem(null)}>
        <DialogContent className="max-w-6xl max-h-[94vh] p-0 overflow-hidden bg-white text-[#001f3f] flex flex-col">
          {selectedItem && (
            <div className="grid grid-cols-1 lg:grid-cols-12 h-[88vh] max-h-[860px]">
              {/* Left: Full Image / PDF Viewer */}
              <div className="lg:col-span-8 bg-slate-950 relative flex flex-col overflow-hidden min-h-[360px]">
                {/* Top Viewer Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-900/95 border-b border-white/10 text-white z-10">
                  <div className="flex items-center gap-2 min-w-0">
                    {selectedItem.fileKind === "pdf" ? (
                      <FileText className="w-4 h-4 text-red-400 shrink-0" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-sky-400 shrink-0" />
                    )}
                    <span className="text-xs font-semibold truncate max-w-[220px] sm:max-w-xs">
                      {selectedItem.fileName}
                    </span>
                    {naturalSize && (
                      <span className="hidden sm:inline text-[10px] text-slate-400 bg-white/10 px-2 py-0.5 rounded-full">
                        {naturalSize.w} &times; {naturalSize.h}px
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {selectedItem.fileKind === "image" && (
                      <>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-slate-200 hover:bg-white/10 hover:text-white"
                          onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.25).toFixed(2))))}
                          title="Zoom Out"
                        >
                          <ZoomOut className="w-3.5 h-3.5" />
                        </Button>
                        <span className="text-[11px] text-slate-300 w-10 text-center">
                          {Math.round(zoom * 100)}%
                        </span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-slate-200 hover:bg-white/10 hover:text-white"
                          onClick={() => setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                          title="Zoom In"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-slate-200 hover:bg-white/10 hover:text-white"
                          onClick={() => setRotation((r) => (r + 90) % 360)}
                          title="Rotate 90°"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-slate-200 hover:bg-white/10 hover:text-white"
                          onClick={() => {
                            setZoom(1)
                            setRotation(0)
                          }}
                          title="Reset View"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                    <a
                      href={selectedItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-xs font-medium text-white ml-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open
                    </a>
                    <a
                      href={selectedItem.url}
                      download={selectedItem.fileName}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-xs font-medium text-white"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </a>
                  </div>
                </div>

                {/* Media Canvas */}
                <div className="flex-1 relative flex items-center justify-center overflow-auto p-4">
                  {filteredItems.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => navigateSelected(-1)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition"
                        title="Previous attachment"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateSelected(1)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition"
                        title="Next attachment"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}

                  {selectedItem.fileKind === "pdf" ? (
                    <iframe
                      src={`${selectedItem.url}#toolbar=1&view=FitH`}
                      title={selectedItem.fileName}
                      className="w-full h-full rounded-lg bg-white border-0"
                    />
                  ) : selectedItem.fileKind === "image" ? (
                    <img
                      src={selectedItem.url}
                      alt={selectedItem.fileName}
                      onLoad={(e) => {
                        const img = e.currentTarget
                        setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
                      }}
                      className="max-w-full max-h-full object-contain transition-transform duration-200 select-none"
                      style={{
                        transform: `scale(${zoom}) rotate(${rotation}deg)`,
                      }}
                    />
                  ) : (
                    <div className="text-center text-slate-300 space-y-3">
                      <FileText className="w-12 h-12 mx-auto text-slate-500" />
                      <p className="text-sm font-medium">{selectedItem.fileName}</p>
                      <a
                        href={selectedItem.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open File in New Tab
                      </a>
                    </div>
                  )}
                </div>

                {/* Bottom Counter */}
                {filteredItems.length > 1 && (
                  <div className="px-4 py-1.5 bg-slate-900/90 border-t border-white/10 text-center text-[11px] text-slate-400">
                    {selectedIndex + 1} of {filteredItems.length} attachments
                  </div>
                )}
              </div>

              {/* Right: Record Details & Admin Actions */}
              <div className="lg:col-span-4 bg-white border-l border-slate-200 flex flex-col overflow-y-auto">
                <div className="p-5 space-y-5 flex-1">
                  <DialogHeader className="text-left space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-semibold ${
                          SOURCE_BADGE_STYLES[selectedItem.sourceModule]
                        }`}
                      >
                        {selectedItem.sourceLabel}
                      </Badge>
                      <Badge variant="outline" className="text-[11px] border-slate-200 text-slate-700">
                        {selectedItem.categoryLabel}
                      </Badge>
                    </div>
                    <DialogTitle className="text-lg font-bold text-[#001f3f] leading-snug">
                      {selectedItem.recordTitle}
                    </DialogTitle>
                    {selectedItem.recordSubtitle && (
                      <p className="text-xs text-slate-500">{selectedItem.recordSubtitle}</p>
                    )}
                  </DialogHeader>

                  {/* Uploader & Timestamp Card */}
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2.5 text-xs">
                    <div className="flex items-center gap-2 text-slate-700">
                      <User className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span className="text-slate-500">Uploaded by:</span>
                      <strong className="text-[#001f3f] truncate">{selectedItem.uploadedBy}</strong>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      <Calendar className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span className="text-slate-500">Date:</span>
                      <strong className="text-[#001f3f]">{safeFormatDate(selectedItem.createdAt)}</strong>
                    </div>
                    {selectedItem.assignedArea && (
                      <div className="flex items-center gap-2 text-slate-700">
                        <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        <span className="text-slate-500">Area:</span>
                        <strong className="text-[#001f3f]">{selectedItem.assignedArea}</strong>
                      </div>
                    )}
                  </div>

                  {/* Source Record Details */}
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Source Record Details
                    </h4>
                    <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                      {selectedItem.extraDetails.map((d, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                        >
                          <span className="text-slate-500 shrink-0">{d.label}</span>
                          <span className="font-semibold text-[#001f3f] text-right truncate">
                            {d.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* File URL & Copy */}
                  <div className="space-y-1.5">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      File Info
                    </h4>
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs">
                      <span className="truncate text-slate-600 font-mono text-[11px]">
                        {selectedItem.fileName}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs text-sky-700 hover:bg-sky-50 shrink-0"
                        onClick={() => {
                          navigator.clipboard?.writeText(selectedItem.url)
                          setCopiedUrl(true)
                          setTimeout(() => setCopiedUrl(false), 1800)
                        }}
                      >
                        {copiedUrl ? (
                          <>
                            <Check className="w-3 h-3 mr-1 text-emerald-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 mr-1" />
                            Copy URL
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="p-4 border-t border-slate-200 bg-slate-50/80 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={editingUid === selectedItem.uid || deletingUid === selectedItem.uid}
                      onClick={() => handleRotateLibraryItem(selectedItem)}
                      className="border-indigo-300 text-indigo-800 hover:bg-indigo-50 bg-white font-semibold text-xs"
                      title="Rotate 90° clockwise and re-upload in-place"
                    >
                      {editingUid === selectedItem.uid ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : (
                        <RotateCw className="w-3.5 h-3.5 mr-1" />
                      )}
                      Rotate 90°
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={editingUid === selectedItem.uid || deletingUid === selectedItem.uid}
                      onClick={() => handleOpenCropLibraryItem(selectedItem)}
                      className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 bg-white font-semibold text-xs"
                      title="Crop / Rotate and re-upload in-place"
                    >
                      <Crop className="w-3.5 h-3.5 mr-1" />
                      Crop &amp; Save
                    </Button>
                  </div>
                  {(role === "super_admin" ||
                    selectedItem.sourceModule === "sales" ||
                    selectedItem.sourceModule === "collector_transactions") && (
                    <Link href={selectedItem.recordHref} className="block">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full border-[#001f3f] text-[#001f3f] hover:bg-slate-100 bg-white font-semibold text-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                        Go to {selectedItem.sourceLabel} Page
                      </Button>
                    </Link>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={deletingUid === selectedItem.uid}
                    onClick={() => handleDeleteAttachment(selectedItem)}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold text-xs"
                  >
                    {deletingUid === selectedItem.uid ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Deleting Attachment...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        Delete Attachment from Record
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Crop / Rotate Attachment Modal (All Modules, In-Place Re-upload) */}
      <VoucherDocumentCropper
        open={Boolean(cropLibTarget)}
        onOpenChange={(o) => {
          if (!o) setCropLibTarget(null)
        }}
        file={cropLibTarget?.file || null}
        title={
          cropLibTarget
            ? `Crop / Rotate ${cropLibTarget.item.fileName}`
            : "Crop / Rotate Attachment"
        }
        onCropComplete={handleCropLibraryConfirmed}
      />
    </div>
  )
}
