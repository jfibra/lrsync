"use client"

import React, { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { logNotification } from "@/utils/logNotification"
import { formatS3Url } from "@/utils/s3-url"
import type { CollectorTransaction, CollectorWorkflowStatus } from "@/types/collector"
import { ConvertCollectorToSaleModal } from "@/components/convert-collector-to-sale-modal"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertTriangle,
  ArrowDown,
  ArrowRightCircle,
  ArrowUp,
  ArrowUpDown,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  FileCheck2,
  FileImage,
  Filter,
  Fingerprint,
  Landmark,
  Loader2,
  MapPin,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Smartphone,
  UserCheck,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { toast } from "sonner"

interface ChequeVerificationManagerProps {
  role: "super_admin" | "admin" | "secretary"
}

type FilterTab =
  | "deposited"
  | "invoice_issued"
  | "cheque_collected"
  | "verified"
  | "converted_to_sale"
  | "returned"
  | "all"

type SortField = "updated_at" | "invoice_date" | "commission_amount" | "deposit_amount" | "workflow_status"

interface CollectorOption {
  auth_user_id: string
  full_name: string
  assigned_area: string | null
}

interface StatusCounts {
  invoice_issued: number
  cheque_collected: number
  deposited: number
  verified: number
  converted_to_sale: number
  returned: number
  all: number
}

const PAGE_SIZE = 15

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

function getWorkflowBadge(status: CollectorWorkflowStatus) {
  switch (status) {
    case "invoice_issued":
      return (
        <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 border border-slate-200">
          Invoice Issued
        </Badge>
      )
    case "cheque_collected":
      return (
        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border border-amber-200">
          Cheque Collected
        </Badge>
      )
    case "deposited":
      return (
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border border-blue-200">
          Deposited — For Checking
        </Badge>
      )
    case "verified":
      return (
        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border border-emerald-200">
          Verified
        </Badge>
      )
    case "converted_to_sale":
      return (
        <Badge className="bg-teal-100 text-teal-800 hover:bg-teal-100 border border-teal-200">
          Converted to Sale
        </Badge>
      )
    case "returned":
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border border-red-200">
          Returned
        </Badge>
      )
  }
}

function getChequeStatusBadge(status: string) {
  switch (status) {
    case "verified":
      return (
        <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
          Verified
        </Badge>
      )
    case "deposited":
      return (
        <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700">
          Deposited
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
          Pending
        </Badge>
      )
  }
}

function PhotoGallery({
  title,
  urls,
  onZoom,
}: {
  title: string
  urls: string[] | null | undefined
  onZoom: (url: string, label: string) => void
}) {
  const list = urls || []
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        {title} ({list.length})
      </div>
      {list.length === 0 ? (
        <div className="rounded-md border border-dashed bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
          No {title.toLowerCase()} uploaded
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {list.map((rawUrl, i) => {
            const url = formatS3Url(rawUrl)
            const isPdf = url.toLowerCase().includes(".pdf")
            const label = `${title} #${i + 1}`
            return isPdf ? (
              <a
                key={`${title}-${i}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex h-28 flex-col items-center justify-center gap-1 rounded-md border bg-slate-100 p-2 text-slate-600 hover:ring-2 hover:ring-blue-500 transition"
              >
                <FileImage className="h-6 w-6 text-blue-600" />
                <span className="text-xs font-medium">PDF #{i + 1}</span>
                <div className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white flex items-center gap-1">
                  Open <ExternalLink className="h-2.5 w-2.5" />
                </div>
              </a>
            ) : (
              <button
                key={`${title}-${i}`}
                type="button"
                onClick={() => onZoom(url, label)}
                className="group relative block overflow-hidden rounded-md border bg-slate-100 hover:ring-2 hover:ring-blue-500 transition text-left"
              >
                <img
                  src={url}
                  alt={label}
                  className="h-28 w-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white flex items-center gap-1">
                  <ZoomIn className="h-2.5 w-2.5" /> Zoom
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SelfieVerificationCard({
  ocrData,
  onZoom,
}: {
  ocrData: Record<string, any> | null | undefined
  onZoom: (url: string, label: string) => void
}) {
  const proof = ocrData?.selfie_verification
  if (!proof || typeof proof !== "object") return null

  const method =
    proof.method ||
    proof.verification_method ||
    (proof.webauthn ? "Device Biometrics (WebAuthn)" : "1-to-1 Face Match")
  const verified = proof.verified ?? proof.passed ?? proof.matched ?? true
  const confidence = proof.confidence ?? proof.score ?? proof.similarity ?? null
  const verifiedAt = proof.verified_at || proof.timestamp || null
  const selfieUrl = proof.selfie_url || proof.photo_url || proof.image_url || null

  return (
    <div className="rounded-md border border-indigo-200 bg-indigo-50/60 p-3 text-xs space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-semibold text-indigo-900">
          <Fingerprint className="h-4 w-4 text-indigo-600" />
          Identity Verification Proof
        </div>
        <Badge
          className={
            verified
              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
              : "bg-red-100 text-red-800 hover:bg-red-100 border border-red-200"
          }
        >
          <ShieldCheck className="h-3 w-3 mr-1" />
          {verified ? "Verified" : "Unverified"}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-700">
        <span>
          <strong>Method:</strong> {String(method)}
        </span>
        {confidence !== null && (
          <span>
            <strong>Match Score:</strong>{" "}
            {Number(confidence) <= 1
              ? `${Math.round(Number(confidence) * 100)}%`
              : `${Math.round(Number(confidence))}%`}
          </span>
        )}
        {verifiedAt && (
          <span>
            <strong>Verified At:</strong> {formatDateTime(String(verifiedAt))}
          </span>
        )}
      </div>
      {selfieUrl && (
        <div>
          <button
            type="button"
            onClick={() => onZoom(formatS3Url(String(selfieUrl)), "Identity Verification Selfie")}
            className="inline-flex items-center gap-2 rounded border bg-white px-2 py-1 text-indigo-700 hover:bg-indigo-50"
          >
            <img
              src={formatS3Url(String(selfieUrl))}
              alt="Collector verification selfie"
              className="h-8 w-8 rounded object-cover"
            />
            <span className="font-medium">View Verification Selfie</span>
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

function TelemetryBox({
  who,
  date,
  time,
  capturedAt,
  location,
  lat,
  lng,
  accuracy,
  device,
  clarityScore,
}: {
  who?: string | null
  date?: string | null
  time?: string | null
  capturedAt?: string | null
  location?: string | null
  lat?: number | null
  lng?: number | null
  accuracy?: number | null
  device?: string | null
  clarityScore?: number | null
}) {
  const hasCoords = lat !== null && lat !== undefined && lng !== null && lng !== undefined
  return (
    <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-600 space-y-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        Silent Anti-Fraud Audit Trail
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1 font-medium text-slate-800">
          <UserCheck className="h-3.5 w-3.5 text-slate-500" />
          {who || "—"}
        </span>
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5 text-slate-500" />
          {date || "—"} {time ? `at ${time}` : capturedAt ? `(${formatDateTime(capturedAt)})` : ""}
        </span>
        {clarityScore !== null && clarityScore !== undefined && (
          <Badge variant="outline" className="text-[10px] py-0">
            Clarity: {clarityScore}%
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          {location || (hasCoords ? `${lat}, ${lng}` : "Location not recorded")}
          {accuracy ? ` (±${Math.round(accuracy)}m)` : ""}
        </span>
        {hasCoords && (
          <a
            href={`https://www.google.com/maps?q=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium"
          >
            View on Map <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      {device && (
        <div className="inline-flex items-center gap-1 text-slate-500">
          <Smartphone className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate max-w-full">{device}</span>
        </div>
      )}
    </div>
  )
}

export function ChequeVerificationManager({ role }: ChequeVerificationManagerProps) {
  const { user, profile } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [records, setRecords] = useState<CollectorTransaction[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [counts, setCounts] = useState<StatusCounts>({
    invoice_issued: 0,
    cheque_collected: 0,
    deposited: 0,
    verified: 0,
    converted_to_sale: 0,
    returned: 0,
    all: 0,
  })
  const [loading, setLoading] = useState(true)

  // Filters, sorting, pagination
  const [activeTab, setActiveTab] = useState<FilterTab>("deposited")
  const [searchInput, setSearchInput] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [collectorFilter, setCollectorFilter] = useState<string>("all")
  const [areaFilter, setAreaFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [onlyDiscrepancies, setOnlyDiscrepancies] = useState(false)
  const [sortField, setSortField] = useState<SortField>("updated_at")
  const [sortAsc, setSortAsc] = useState(false)
  const [page, setPage] = useState(1)

  // Filter options
  const [collectors, setCollectors] = useState<CollectorOption[]>([])
  const [areas, setAreas] = useState<string[]>([])

  // Inspect / Verification drawer state
  const [selectedTx, setSelectedTx] = useState<CollectorTransaction | null>(null)
  const [accountingRemarks, setAccountingRemarks] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  // Lightbox Zoom Viewer state
  const [zoomImage, setZoomImage] = useState<{ url: string; label: string } | null>(null)
  const [zoomLevel, setZoomLevel] = useState(1)

  // Convert-to-Sale modal state
  const [convertTx, setConvertTx] = useState<CollectorTransaction | null>(null)
  const [convertOpen, setConvertOpen] = useState(false)

  const roleSlug = role.replace("_", "-")

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Fetch collector list & areas for filter dropdowns
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        let query = supabase
          .from("user_profiles")
          .select("auth_user_id, full_name, email, assigned_area")
          .eq("role", "collector")
          .order("full_name", { ascending: true })

        if (role !== "super_admin" && profile?.assigned_area) {
          query = query.eq("assigned_area", profile.assigned_area)
        }

        const { data } = await query
        if (data) {
          const opts: CollectorOption[] = data
            .filter((u: any) => u.auth_user_id)
            .map((u: any) => ({
              auth_user_id: u.auth_user_id,
              full_name: u.full_name || u.email || "Collector",
              assigned_area: u.assigned_area || null,
            }))
          setCollectors(opts)

          const distinctAreas = Array.from(
            new Set(opts.map((o) => o.assigned_area).filter(Boolean) as string[])
          ).sort()
          setAreas(distinctAreas)
        }
      } catch (err) {
        console.error("Failed to fetch collector filter options:", err)
      }
    }
    fetchFilterOptions()
  }, [role, profile?.assigned_area])

  // Fetch KPI counts (scoped by area for non-super_admin)
  const fetchStatusCounts = useCallback(async () => {
    try {
      let query = supabase
        .from("collector_transactions")
        .select("workflow_status")
        .eq("is_deleted", false)

      if (role !== "super_admin" && profile?.assigned_area) {
        query = query.eq("assigned_area", profile.assigned_area)
      }

      const { data, error } = await query
      if (error) throw error

      const next: StatusCounts = {
        invoice_issued: 0,
        cheque_collected: 0,
        deposited: 0,
        verified: 0,
        converted_to_sale: 0,
        returned: 0,
        all: (data || []).length,
      }
      for (const row of data || []) {
        const s = row.workflow_status as CollectorWorkflowStatus
        if (s in next) {
          next[s] += 1
        }
      }
      setCounts(next)
    } catch (err) {
      console.error("Failed to fetch status counts:", err)
    }
  }, [role, profile?.assigned_area])

  // Fetch paginated, sorted, filtered table rows from Supabase
  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from("collector_transactions")
        .select("*", { count: "exact" })
        .eq("is_deleted", false)

      if (role !== "super_admin" && profile?.assigned_area) {
        query = query.eq("assigned_area", profile.assigned_area)
      } else if (areaFilter !== "all") {
        query = query.eq("assigned_area", areaFilter)
      }

      if (activeTab !== "all") {
        query = query.eq("workflow_status", activeTab)
      }

      if (collectorFilter !== "all") {
        query = query.or(
          `invoice_collected_by_uuid.eq.${collectorFilter},cheque_collected_by_uuid.eq.${collectorFilter},deposited_by_uuid.eq.${collectorFilter}`
        )
      }

      if (dateFrom) {
        query = query.gte("invoice_date", dateFrom)
      }
      if (dateTo) {
        query = query.lte("invoice_date", dateTo)
      }

      if (onlyDiscrepancies) {
        query = query.eq("amount_discrepancy", true)
      }

      if (debouncedSearch) {
        const q = debouncedSearch.replace(/,/g, "")
        query = query.or(
          `developer_name.ilike.%${q}%,developer_tin.ilike.%${q}%,cheque_number.ilike.%${q}%,deposit_reference_no.ilike.%${q}%,invoice_collected_by_name.ilike.%${q}%,cheque_collected_by_name.ilike.%${q}%`
        )
      }

      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      query = query.order(sortField, { ascending: sortAsc }).range(from, to)

      const { data, count, error } = await query
      if (error) throw error

      setRecords((data || []) as CollectorTransaction[])
      setTotalCount(count || 0)
    } catch (err) {
      console.error("Failed to fetch collector transactions:", err)
      toast.error("Failed to load collector submissions")
    } finally {
      setLoading(false)
    }
  }, [
    role,
    profile?.assigned_area,
    areaFilter,
    activeTab,
    collectorFilter,
    dateFrom,
    dateTo,
    onlyDiscrepancies,
    debouncedSearch,
    sortField,
    sortAsc,
    page,
  ])

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchStatusCounts(), fetchTransactions()])
  }, [fetchStatusCounts, fetchTransactions])

  useEffect(() => {
    fetchStatusCounts()
  }, [fetchStatusCounts])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  // Deep-link support: ?collection_id=<uuid> opens that transaction directly
  useEffect(() => {
    const collectionId = searchParams.get("collection_id")
    if (!collectionId) return

    const loadDeepLinked = async () => {
      const { data, error } = await supabase
        .from("collector_transactions")
        .select("*")
        .eq("id", collectionId)
        .eq("is_deleted", false)
        .maybeSingle()

      if (!error && data) {
        const tx = data as CollectorTransaction
        setSelectedTx(tx)
        setAccountingRemarks(tx.accounting_remarks || "")
      } else {
        toast.error("Linked collector transaction was not found.")
      }
    }
    loadDeepLinked()
  }, [searchParams])

  const closeInspect = () => {
    setSelectedTx(null)
    if (searchParams.get("collection_id")) {
      router.replace(pathname, { scroll: false })
    }
  }

  const openInspect = (tx: CollectorTransaction) => {
    setSelectedTx(tx)
    setAccountingRemarks(tx.accounting_remarks || "")
  }

  const handleZoom = (url: string, label: string) => {
    setZoomImage({ url, label })
    setZoomLevel(1)
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev)
    } else {
      setSortField(field)
      setSortAsc(false)
    }
    setPage(1)
  }

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 text-slate-400" />
    return sortAsc ? (
      <ArrowUp className="h-3.5 w-3.5 ml-1 text-blue-600" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 ml-1 text-blue-600" />
    )
  }

  const handleVerifyCheque = async (openConvertAfter = false) => {
    if (!selectedTx || !user) return
    if (selectedTx.workflow_status !== "deposited") {
      toast.error("Only deposited cheques can be verified.")
      return
    }
    setActionLoading(true)
    try {
      const verifierName = profile?.full_name || profile?.email || "Accounting"
      const verifiedAt = new Date().toISOString()

      const { data: updated, error } = await supabase
        .from("collector_transactions")
        .update({
          cheque_status: "verified",
          workflow_status: "verified",
          verified_by_uuid: user.id,
          verified_by_name: verifierName,
          verified_at: verifiedAt,
          accounting_remarks: accountingRemarks.trim() || null,
        })
        .eq("id", selectedTx.id)
        .eq("workflow_status", "deposited")
        .select("*")
        .single()

      if (error) throw error

      await logNotification(supabase, {
        action: "cheque_verified",
        description: `Verified deposited cheque #${selectedTx.cheque_number || "N/A"} for ${selectedTx.developer_name || "Developer"} (${formatPHP(selectedTx.deposit_amount ?? selectedTx.cheque_amount)})`,
        user_email: profile?.email || user.email || "",
        user_name: verifierName,
        user_uuid: user.id,
        meta: JSON.stringify({
          collection_id: selectedTx.id,
          collector_user_id:
            selectedTx.deposited_by_uuid ||
            selectedTx.cheque_collected_by_uuid ||
            selectedTx.invoice_collected_by_uuid,
          cheque_number: selectedTx.cheque_number,
          developer_name: selectedTx.developer_name,
        }),
        user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
      })

      toast.success("Deposited cheque verified!")
      await refreshAll()
      closeInspect()

      if (openConvertAfter && updated) {
        setConvertTx(updated as CollectorTransaction)
        setConvertOpen(true)
      }
    } catch (err) {
      console.error("Verify cheque error:", err)
      toast.error(err instanceof Error ? err.message : "Failed to verify cheque")
    } finally {
      setActionLoading(false)
    }
  }

  const handleReturnToCollector = async () => {
    if (!selectedTx || !user) return
    if (!accountingRemarks.trim()) {
      toast.error("Accounting remarks are required when returning a transaction to the collector.")
      return
    }
    setActionLoading(true)
    try {
      const verifierName = profile?.full_name || profile?.email || "Accounting"
      const { error } = await supabase
        .from("collector_transactions")
        .update({
          workflow_status: "returned",
          cheque_status: "pending",
          accounting_remarks: accountingRemarks.trim(),
        })
        .eq("id", selectedTx.id)

      if (error) throw error

      await logNotification(supabase, {
        action: "cheque_returned_to_collector",
        description: `Returned transaction (${selectedTx.developer_name || "Developer"}) to collector: ${accountingRemarks.trim()}`,
        user_email: profile?.email || user.email || "",
        user_name: verifierName,
        user_uuid: user.id,
        meta: JSON.stringify({
          collection_id: selectedTx.id,
          collector_user_id:
            selectedTx.deposited_by_uuid ||
            selectedTx.cheque_collected_by_uuid ||
            selectedTx.invoice_collected_by_uuid,
          remarks: accountingRemarks.trim(),
        }),
        user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
      })

      toast.success("Returned to collector — pinned in their Needs Attention banner.")
      closeInspect()
      await refreshAll()
    } catch (err) {
      console.error("Return transaction error:", err)
      toast.error(err instanceof Error ? err.message : "Failed to return transaction")
    } finally {
      setActionLoading(false)
    }
  }

  const clearFilters = () => {
    setSearchInput("")
    setDebouncedSearch("")
    setCollectorFilter("all")
    setAreaFilter("all")
    setDateFrom("")
    setDateTo("")
    setOnlyDiscrepancies(false)
    setPage(1)
  }

  const hasActiveFilters =
    Boolean(debouncedSearch) ||
    collectorFilter !== "all" ||
    areaFilter !== "all" ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    onlyDiscrepancies

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const canReturnSelected =
    selectedTx &&
    (selectedTx.workflow_status === "invoice_issued" ||
      selectedTx.workflow_status === "cheque_collected" ||
      selectedTx.workflow_status === "deposited")

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2.5">
            <FileCheck2 className="h-7 w-7 text-emerald-600" />
            Collector Activities &amp; Cheque Verification
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Monitor field collector invoices, cheques, and bank deposits, review silent audit
            proofs, verify deposits, and convert verified transactions into official Sales.
          </p>
        </div>
        <Button onClick={refreshAll} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* 6 Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {(
          [
            {
              key: "deposited" as FilterTab,
              title: "Deposited — For Check",
              value: counts.deposited,
              ring: "ring-blue-500",
              labelColor: "text-blue-700",
              numColor: "text-blue-900",
              sub: "Ready for verification",
            },
            {
              key: "verified" as FilterTab,
              title: "Verified",
              value: counts.verified,
              ring: "ring-emerald-500",
              labelColor: "text-emerald-700",
              numColor: "text-emerald-900",
              sub: "Ready to convert",
            },
            {
              key: "converted_to_sale" as FilterTab,
              title: "Converted to Sale",
              value: counts.converted_to_sale,
              ring: "ring-teal-500",
              labelColor: "text-teal-700",
              numColor: "text-teal-900",
              sub: "Posted in Sales",
            },
            {
              key: "invoice_issued" as FilterTab,
              title: "Invoices Issued",
              value: counts.invoice_issued,
              ring: "ring-slate-500",
              labelColor: "text-slate-600",
              numColor: "text-slate-900",
              sub: "Awaiting cheque",
            },
            {
              key: "cheque_collected" as FilterTab,
              title: "Cheques Collected",
              value: counts.cheque_collected,
              ring: "ring-amber-500",
              labelColor: "text-amber-700",
              numColor: "text-amber-900",
              sub: "Pending deposit",
            },
            {
              key: "returned" as FilterTab,
              title: "Returned",
              value: counts.returned,
              ring: "ring-red-500",
              labelColor: "text-red-700",
              numColor: "text-red-900",
              sub: "Needs collector fix",
            },
          ] as const
        ).map((kpi) => (
          <Card
            key={kpi.key}
            className={`cursor-pointer transition hover:shadow-md ${
              activeTab === kpi.key ? `ring-2 ${kpi.ring}` : ""
            }`}
            onClick={() => {
              setActiveTab(kpi.key)
              setPage(1)
            }}
          >
            <CardHeader className="pb-1 pt-4 px-4">
              <CardDescription className={`text-[11px] font-semibold uppercase ${kpi.labelColor}`}>
                {kpi.title}
              </CardDescription>
              <CardTitle className={`text-2xl font-bold ${kpi.numColor}`}>{kpi.value}</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-4 text-[11px] text-slate-500">{kpi.sub}</CardContent>
          </Card>
        ))}
      </div>

      {/* Filters & Data Table */}
      <Card>
        <CardHeader className="space-y-3 pb-4">
          {/* Status Filter Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: "deposited", label: `Deposited (${counts.deposited})` },
                { id: "verified", label: `Verified (${counts.verified})` },
                { id: "converted_to_sale", label: `Converted (${counts.converted_to_sale})` },
                { id: "invoice_issued", label: `Invoices Issued (${counts.invoice_issued})` },
                { id: "cheque_collected", label: `Cheques Collected (${counts.cheque_collected})` },
                { id: "returned", label: `Returned (${counts.returned})` },
                { id: "all", label: `All (${counts.all})` },
              ] as { id: FilterTab; label: string }[]
            ).map((tab) => (
              <Button
                key={tab.id}
                size="sm"
                variant={activeTab === tab.id ? "default" : "outline"}
                onClick={() => {
                  setActiveTab(tab.id)
                  setPage(1)
                }}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {/* Search & Structured Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 pt-1">
            <div className="relative lg:col-span-2">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search developer, TIN, cheque #, deposit ref..."
                className="pl-9"
              />
            </div>

            <Select
              value={collectorFilter}
              onValueChange={(v) => {
                setCollectorFilter(v)
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Collectors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Collectors</SelectItem>
                {collectors.map((c) => (
                  <SelectItem key={c.auth_user_id} value={c.auth_user_id}>
                    {c.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {role === "super_admin" ? (
              <Select
                value={areaFilter}
                onValueChange={(v) => {
                  setAreaFilter(v)
                  setPage(1)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Areas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Areas</SelectItem>
                  {areas.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center px-3 rounded-md border bg-slate-50 text-xs text-slate-600">
                Area: <strong className="ml-1">{profile?.assigned_area || "All"}</strong>
              </div>
            )}

            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setPage(1)
              }}
              title="Invoice Date From"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setPage(1)
              }}
              title="Invoice Date To"
            />
          </div>

          {/* Secondary Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={onlyDiscrepancies ? "default" : "outline"}
                className={
                  onlyDiscrepancies
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "border-amber-300 text-amber-800 hover:bg-amber-50"
                }
                onClick={() => {
                  setOnlyDiscrepancies((prev) => !prev)
                  setPage(1)
                }}
              >
                <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                Amount Discrepancies Only
              </Button>
              {hasActiveFilters && (
                <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
                  <Filter className="h-3.5 w-3.5 mr-1" />
                  Reset Filters
                </Button>
              )}
            </div>
            <div className="text-xs text-slate-500">
              Showing <strong>{records.length}</strong> of <strong>{totalCount}</strong> records
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading collector activities...
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-14 text-slate-500">
              <FileCheck2 className="h-10 w-10 mx-auto text-slate-300 mb-2" />
              <p className="font-medium text-slate-700">No collector transactions match this view</p>
              <p className="text-xs text-slate-500 mt-1">
                Try switching status tabs or clearing your active filters.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Developer</TableHead>
                      <TableHead>
                        <button
                          type="button"
                          onClick={() => toggleSort("commission_amount")}
                          className="inline-flex items-center font-medium hover:text-slate-900"
                        >
                          Invoice &amp; Comm
                          {renderSortIcon("commission_amount")}
                        </button>
                      </TableHead>
                      <TableHead>Cheque</TableHead>
                      <TableHead>
                        <button
                          type="button"
                          onClick={() => toggleSort("deposit_amount")}
                          className="inline-flex items-center font-medium hover:text-slate-900"
                        >
                          Deposit
                          {renderSortIcon("deposit_amount")}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          type="button"
                          onClick={() => toggleSort("updated_at")}
                          className="inline-flex items-center font-medium hover:text-slate-900"
                        >
                          Collector &amp; Updated
                          {renderSortIcon("updated_at")}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          type="button"
                          onClick={() => toggleSort("workflow_status")}
                          className="inline-flex items-center font-medium hover:text-slate-900"
                        >
                          Status / Sale
                          {renderSortIcon("workflow_status")}
                        </button>
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((tx) => {
                      const hasInvoicePhoto = (tx.invoice_photo_urls || []).length > 0
                      const hasChequePhoto = (tx.cheque_photo_urls || []).length > 0
                      return (
                        <TableRow key={tx.id}>
                          <TableCell>
                            <div className="font-medium text-slate-900">
                              {tx.developer_name || "Unnamed Developer"}
                            </div>
                            <div className="text-xs text-slate-500">
                              TIN: {tx.developer_tin || "—"}
                              {tx.assigned_area ? ` · ${tx.assigned_area}` : ""}
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="font-semibold text-slate-800">
                              {formatPHP(tx.commission_amount)}
                            </div>
                            <div className="text-xs text-slate-500">
                              {tx.invoice_date || tx.invoice_date_collected || "—"}
                            </div>
                            <div className="mt-0.5">
                              {hasInvoicePhoto ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] py-0 border-emerald-200 bg-emerald-50 text-emerald-700"
                                >
                                  Invoice Photo ({tx.invoice_photo_urls.length})
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] py-0 text-slate-400">
                                  No Invoice Photo
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          <TableCell>
                            {tx.cheque_number || tx.cheque_amount || hasChequePhoto ? (
                              <div className="space-y-1">
                                <div className="text-sm font-medium text-slate-800">
                                  {tx.cheque_bank ? `${tx.cheque_bank} ` : ""}#
                                  {tx.cheque_number || "—"}
                                </div>
                                <div className="text-xs text-slate-700 flex flex-wrap items-center gap-1.5">
                                  <span>{formatPHP(tx.cheque_amount)}</span>
                                  {tx.amount_discrepancy && (
                                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px] px-1.5 py-0">
                                      <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                                      Mismatch
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-1">
                                  {getChequeStatusBadge(tx.cheque_status)}
                                  {hasChequePhoto && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] py-0 border-blue-200 bg-blue-50 text-blue-700"
                                    >
                                      Photo ({tx.cheque_photo_urls.length})
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">Awaiting cheque</span>
                            )}
                          </TableCell>

                          <TableCell>
                            {tx.deposited_at || tx.deposit_date ? (
                              <div className="space-y-0.5">
                                <div className="text-sm font-medium text-slate-800">
                                  {tx.deposit_bank || "Bank Deposited"}
                                </div>
                                <div className="text-xs text-slate-700">
                                  {formatPHP(tx.deposit_amount ?? tx.cheque_amount)}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  Ref: {tx.deposit_reference_no || "—"} ·{" "}
                                  {(tx.deposit_slip_urls || []).length} slip(s)
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">Not deposited</span>
                            )}
                          </TableCell>

                          <TableCell>
                            <div className="text-sm text-slate-800">
                              {tx.deposited_by_name ||
                                tx.cheque_collected_by_name ||
                                tx.invoice_collected_by_name ||
                                "—"}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {formatDateTime(tx.updated_at)}
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="space-y-1">
                              {getWorkflowBadge(tx.workflow_status)}
                              {tx.sales_id && (
                                <div>
                                  <Link
                                    href={`/dashboard/${roleSlug}/sales`}
                                    className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 hover:underline"
                                  >
                                    Sale Linked <ExternalLink className="h-3 w-3" />
                                  </Link>
                                </div>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button size="sm" variant="outline" onClick={() => openInspect(tx)}>
                                <Eye className="h-3.5 w-3.5 mr-1" />
                                Review
                              </Button>
                              {tx.workflow_status === "verified" && !tx.sales_id && (
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => {
                                    setConvertTx(tx)
                                    setConvertOpen(true)
                                  }}
                                >
                                  <ArrowRightCircle className="h-3.5 w-3.5 mr-1" />
                                  Convert
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between pt-4 border-t mt-4 text-xs text-slate-600">
                <div>
                  Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} total)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Transaction Review & Silent Audit Drawer/Dialog */}
      <Dialog open={!!selectedTx} onOpenChange={(open) => !open && closeInspect()}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          {selectedTx && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
                  <div>
                    <DialogTitle className="text-xl flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-blue-600" />
                      {selectedTx.developer_name || "Developer Collection"}
                    </DialogTitle>
                    <DialogDescription className="mt-1">
                      TIN: {selectedTx.developer_tin || "—"} · Issued{" "}
                      {selectedTx.invoice_date || "—"} · Cheque #
                      {selectedTx.cheque_number || "N/A"}
                    </DialogDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {getWorkflowBadge(selectedTx.workflow_status)}
                    {getChequeStatusBadge(selectedTx.cheque_status)}
                  </div>
                </div>
              </DialogHeader>

              {selectedTx.amount_discrepancy && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex items-start gap-2.5 text-sm text-amber-900">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Amount Discrepancy Flagged:</span> Invoice
                    commission ({formatPHP(selectedTx.commission_amount)}) does not match collected
                    cheque amount ({formatPHP(selectedTx.cheque_amount)}). Review collector override
                    remarks before verifying.
                  </div>
                </div>
              )}

              <Tabs
                defaultValue={
                  selectedTx.workflow_status === "invoice_issued"
                    ? "invoice"
                    : selectedTx.workflow_status === "cheque_collected"
                      ? "cheque"
                      : "deposit"
                }
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="invoice">1. Invoice Issued</TabsTrigger>
                  <TabsTrigger value="cheque">2. Cheque Collected</TabsTrigger>
                  <TabsTrigger value="deposit">3. Bank Deposit</TabsTrigger>
                </TabsList>

                {/* Tab 1: Invoice */}
                <TabsContent value="invoice" className="space-y-4 pt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg border bg-white p-3 text-sm">
                    <div>
                      <div className="text-xs text-slate-500">Invoice Date (Auto)</div>
                      <div className="font-semibold">{selectedTx.invoice_date || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Commission Amount</div>
                      <div className="font-semibold text-emerald-700">
                        {formatPHP(selectedTx.commission_amount)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Developer TIN</div>
                      <div className="font-semibold">{selectedTx.developer_tin || "—"}</div>
                    </div>
                  </div>

                  {selectedTx.invoice_remarks && (
                    <div className="text-xs bg-slate-50 border rounded p-2.5">
                      <span className="font-semibold text-slate-700">Invoice Remarks: </span>
                      {selectedTx.invoice_remarks}
                    </div>
                  )}

                  <SelfieVerificationCard
                    ocrData={selectedTx.invoice_ocr_data}
                    onZoom={handleZoom}
                  />

                  <TelemetryBox
                    who={selectedTx.invoice_collected_by_name}
                    date={selectedTx.invoice_date_collected}
                    time={selectedTx.invoice_time_collected}
                    capturedAt={selectedTx.invoice_captured_at}
                    location={selectedTx.invoice_location}
                    lat={selectedTx.invoice_latitude}
                    lng={selectedTx.invoice_longitude}
                    accuracy={selectedTx.invoice_gps_accuracy}
                    device={selectedTx.invoice_device_used}
                    clarityScore={selectedTx.invoice_clarity_score}
                  />

                  <PhotoGallery
                    title="Invoice Photos"
                    urls={selectedTx.invoice_photo_urls}
                    onZoom={handleZoom}
                  />
                </TabsContent>

                {/* Tab 2: Cheque */}
                <TabsContent value="cheque" className="space-y-4 pt-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg border bg-white p-3 text-sm">
                    <div>
                      <div className="text-xs text-slate-500">Cheque #</div>
                      <div className="font-semibold">{selectedTx.cheque_number || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Bank / Branch</div>
                      <div className="font-semibold">
                        {selectedTx.cheque_bank || "—"}
                        {selectedTx.cheque_branch ? ` (${selectedTx.cheque_branch})` : ""}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Cheque Amount</div>
                      <div className="font-semibold text-emerald-700">
                        {formatPHP(selectedTx.cheque_amount)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Cheque Date / Pickup</div>
                      <div className="font-semibold">
                        {selectedTx.cheque_date || "—"}
                        {selectedTx.cheque_date_collected
                          ? ` (Picked up ${selectedTx.cheque_date_collected})`
                          : ""}
                      </div>
                    </div>
                  </div>

                  {(selectedTx.received_from_name || selectedTx.cheque_remarks) && (
                    <div className="text-xs bg-slate-50 border rounded p-2.5 space-y-1">
                      {selectedTx.received_from_name && (
                        <div>
                          <span className="font-semibold text-slate-700">Received From: </span>
                          {selectedTx.received_from_name}
                        </div>
                      )}
                      {selectedTx.cheque_remarks && (
                        <div>
                          <span className="font-semibold text-slate-700">Cheque Remarks: </span>
                          {selectedTx.cheque_remarks}
                        </div>
                      )}
                    </div>
                  )}

                  <SelfieVerificationCard
                    ocrData={selectedTx.cheque_ocr_data}
                    onZoom={handleZoom}
                  />

                  <TelemetryBox
                    who={selectedTx.cheque_collected_by_name}
                    date={selectedTx.cheque_date_collected}
                    time={selectedTx.cheque_time_collected}
                    capturedAt={selectedTx.cheque_captured_at}
                    location={selectedTx.cheque_location}
                    lat={selectedTx.cheque_latitude}
                    lng={selectedTx.cheque_longitude}
                    accuracy={selectedTx.cheque_gps_accuracy}
                    device={selectedTx.cheque_device_used}
                    clarityScore={selectedTx.cheque_clarity_score}
                  />

                  <PhotoGallery
                    title="Cheque Photos"
                    urls={selectedTx.cheque_photo_urls}
                    onZoom={handleZoom}
                  />
                  <PhotoGallery
                    title="BIR 2307 Photos"
                    urls={selectedTx.doc_2307_photo_urls}
                    onZoom={handleZoom}
                  />
                  <PhotoGallery
                    title="Voucher Photos"
                    urls={selectedTx.voucher_photo_urls}
                    onZoom={handleZoom}
                  />
                </TabsContent>

                {/* Tab 3: Deposit */}
                <TabsContent value="deposit" className="space-y-4 pt-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg border bg-white p-3 text-sm">
                    <div>
                      <div className="text-xs text-slate-500">Deposit Bank</div>
                      <div className="font-semibold flex items-center gap-1">
                        <Landmark className="h-3.5 w-3.5 text-blue-600" />
                        {selectedTx.deposit_bank || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Reference #</div>
                      <div className="font-semibold">{selectedTx.deposit_reference_no || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Deposited Amount</div>
                      <div className="font-semibold text-emerald-700">
                        {formatPHP(selectedTx.deposit_amount ?? selectedTx.cheque_amount)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Deposit Date</div>
                      <div className="font-semibold">{selectedTx.deposit_date || "—"}</div>
                    </div>
                  </div>

                  {selectedTx.deposit_remarks && (
                    <div className="text-xs bg-slate-50 border rounded p-2.5">
                      <span className="font-semibold text-slate-700">Deposit Remarks: </span>
                      {selectedTx.deposit_remarks}
                    </div>
                  )}

                  <TelemetryBox
                    who={selectedTx.deposited_by_name}
                    date={selectedTx.deposit_date}
                    time={selectedTx.deposit_time}
                    capturedAt={selectedTx.deposited_at}
                    location={selectedTx.deposit_location}
                    lat={selectedTx.deposit_latitude}
                    lng={selectedTx.deposit_longitude}
                    accuracy={selectedTx.deposit_gps_accuracy}
                    device={selectedTx.deposit_device_used}
                    clarityScore={selectedTx.deposit_clarity_score}
                  />

                  <PhotoGallery
                    title="Deposit Slip Photos"
                    urls={selectedTx.deposit_slip_urls}
                    onZoom={handleZoom}
                  />
                </TabsContent>
              </Tabs>

              {/* Accounting Verification Controls */}
              <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="acct-remarks" className="text-sm font-semibold text-slate-800">
                    Accounting Verification &amp; Remarks
                  </Label>
                  {selectedTx.verified_at && (
                    <span className="text-xs text-emerald-700 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      Verified by {selectedTx.verified_by_name} on{" "}
                      {formatDateTime(selectedTx.verified_at)}
                    </span>
                  )}
                </div>

                <Textarea
                  id="acct-remarks"
                  rows={2}
                  value={accountingRemarks}
                  onChange={(e) => setAccountingRemarks(e.target.value)}
                  placeholder="Enter bank clearing notes, discrepancy explanation, or mandatory reason if returning to collector..."
                  disabled={selectedTx.workflow_status === "converted_to_sale"}
                />
              </div>

              <DialogFooter className="flex-wrap gap-2 sm:justify-between">
                <div>
                  {canReturnSelected && (
                    <Button
                      type="button"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={handleReturnToCollector}
                      disabled={actionLoading}
                    >
                      <RotateCcw className="h-4 w-4 mr-1.5" />
                      Return / Needs Attention
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeInspect}
                    disabled={actionLoading}
                  >
                    Close
                  </Button>

                  {selectedTx.workflow_status === "deposited" && (
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

                  {selectedTx.workflow_status === "verified" && !selectedTx.sales_id && (
                    <Button
                      type="button"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => {
                        const target = selectedTx
                        closeInspect()
                        setConvertTx(target)
                        setConvertOpen(true)
                      }}
                    >
                      <ArrowRightCircle className="h-4 w-4 mr-1.5" />
                      Convert to Sale (Pre-filled)
                    </Button>
                  )}

                  {selectedTx.workflow_status === "converted_to_sale" && (
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
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* In-App Lightbox Photo Zoom Viewer */}
      <Dialog open={!!zoomImage} onOpenChange={(open) => !open && setZoomImage(null)}>
        <DialogContent className="max-w-5xl max-h-[95vh] flex flex-col">
          {zoomImage && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
                  <DialogTitle className="text-base">{zoomImage.label}</DialogTitle>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setZoomLevel((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setZoomLevel(1)}>
                      {Math.round(zoomLevel * 100)}%
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setZoomLevel((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <a
                      href={zoomImage.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-slate-50"
                    >
                      Open Original <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </DialogHeader>
              <div className="flex-1 overflow-auto rounded-md bg-slate-900/95 p-4 flex items-center justify-center min-h-[60vh]">
                <img
                  src={zoomImage.url}
                  alt={zoomImage.label}
                  style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center center" }}
                  className="max-h-[75vh] w-auto object-contain transition-transform duration-150"
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Convert to Sale Modal (Idempotent) */}
      <ConvertCollectorToSaleModal
        transaction={convertTx}
        open={convertOpen}
        onOpenChange={setConvertOpen}
        onConverted={refreshAll}
      />
    </div>
  )
}
