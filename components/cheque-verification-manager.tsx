"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import type { CollectorTransaction, CollectorWorkflowStatus } from "@/types/collector"
import { CollectorReviewEditModal } from "@/components/collector-review-edit-modal"
import { ConvertCollectorToSaleModal } from "@/components/convert-collector-to-sale-modal"
import { SmartBatchUploadModal } from "@/components/smart-batch-upload-modal"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  FileCheck2,
  FileWarning,
  Filter,
  LayoutList,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Users,
} from "lucide-react"
import { toast } from "sonner"

interface ChequeVerificationManagerProps {
  role: "super_admin" | "admin" | "secretary"
}

type ViewMode = "daily" | "queue"

type FilterTab =
  | "deposited"
  | "invoice_issued"
  | "cheque_collected"
  | "verified"
  | "converted_to_sale"
  | "returned"
  | "all"

type SortField =
  | "updated_at"
  | "invoice_date"
  | "commission_amount"
  | "deposit_amount"
  | "workflow_status"

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

function todayIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function shiftDateIso(iso: string, deltaDays: number): string {
  const parts = iso.split("-").map(Number)
  const d = new Date(parts[0], (parts[1] || 1) - 1, (parts[2] || 1) + deltaDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
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

function getWorkflowBadge(status: CollectorWorkflowStatus) {
  switch (status) {
    case "invoice_issued":
      return (
        <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 border border-slate-200">
          Draft / Invoice Only
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
          Deposited — For Check
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
        <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 text-[10px]">
          Verified
        </Badge>
      )
    case "deposited":
      return (
        <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700 text-[10px]">
          Deposited
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 text-[10px]">
          Pending
        </Badge>
      )
  }
}

function AttachmentCountPills({ tx }: { tx: CollectorTransaction }) {
  const inv = tx.invoice_photo_urls?.length || 0
  const chq = tx.cheque_photo_urls?.length || 0
  const dep = tx.deposit_slip_urls?.length || 0
  const d2307 = tx.doc_2307_photo_urls?.length || 0
  const vch = tx.voucher_photo_urls?.length || 0

  if (inv + chq + dep + d2307 + vch === 0) {
    return <span className="text-[11px] text-slate-400 italic">No files</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {inv > 0 && (
        <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-slate-50 border-slate-300 text-slate-700">
          Invoice ({inv})
        </Badge>
      )}
      {chq > 0 && (
        <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-amber-50 border-amber-300 text-amber-800">
          Cheque ({chq})
        </Badge>
      )}
      {dep > 0 && (
        <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-blue-50 border-blue-300 text-blue-800">
          Deposit ({dep})
        </Badge>
      )}
      {d2307 > 0 && (
        <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-purple-50 border-purple-300 text-purple-800">
          2307 ({d2307})
        </Badge>
      )}
      {vch > 0 && (
        <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-emerald-50 border-emerald-300 text-emerald-800">
          Voucher ({vch})
        </Badge>
      )}
    </div>
  )
}

export function ChequeVerificationManager({ role }: ChequeVerificationManagerProps) {
  const { profile } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [viewMode, setViewMode] = useState<ViewMode>("daily")
  const [selectedDay, setSelectedDay] = useState<string>(todayIso())
  const [allDatesMode, setAllDatesMode] = useState<boolean>(false)

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

  // Duplicate detection sets (across all non-deleted rows)
  const [dupVoucherNumbers, setDupVoucherNumbers] = useState<Set<string>>(new Set())
  const [dupChequeNumbers, setDupChequeNumbers] = useState<Set<string>>(new Set())
  const [dupDepositRefs, setDupDepositRefs] = useState<Set<string>>(new Set())

  // Filters, sorting, pagination
  const [activeTab, setActiveTab] = useState<FilterTab>("deposited")
  const [searchInput, setSearchInput] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [collectorFilter, setCollectorFilter] = useState<string>("all")
  const [areaFilter, setAreaFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [onlyDiscrepancies, setOnlyDiscrepancies] = useState(false)
  const [onlyMissingDetails, setOnlyMissingDetails] = useState(false)
  const [onlyMissingVoucherNo, setOnlyMissingVoucherNo] = useState(false)
  const [sortField, setSortField] = useState<SortField>("updated_at")
  const [sortAsc, setSortAsc] = useState(false)
  const [page, setPage] = useState(1)

  // Filter options
  const [collectors, setCollectors] = useState<CollectorOption[]>([])
  const [areas, setAreas] = useState<string[]>([])

  // Review / Edit modal, Convert modal & Smart AI Upload modal state
  const [selectedTx, setSelectedTx] = useState<CollectorTransaction | null>(null)
  const [convertTx, setConvertTx] = useState<CollectorTransaction | null>(null)
  const [convertOpen, setConvertOpen] = useState(false)
  const [smartUploadOpen, setSmartUploadOpen] = useState(false)

  const roleSlug = role.replace("_", "-")
  const canManageVoucherNo = role === "super_admin" || role === "admin"

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Load collector & area dropdown options
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

  // Fetch status counts + duplicate voucher/cheque/deposit_ref lookup sets
  const fetchCountsAndDuplicates = useCallback(async () => {
    try {
      let query = supabase
        .from("collector_transactions")
        .select("workflow_status, voucher_number, cheque_number, deposit_reference_no")
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
      const voucherFreq = new Map<string, number>()
      const chequeFreq = new Map<string, number>()
      const depRefFreq = new Map<string, number>()

      for (const row of data || []) {
        const s = row.workflow_status as CollectorWorkflowStatus
        if (s in next) next[s] += 1

        const vch = (row.voucher_number || "").trim().toLowerCase()
        if (vch) voucherFreq.set(vch, (voucherFreq.get(vch) || 0) + 1)

        const chq = (row.cheque_number || "").trim().toLowerCase()
        if (chq) chequeFreq.set(chq, (chequeFreq.get(chq) || 0) + 1)

        const ref = (row.deposit_reference_no || "").trim().toLowerCase()
        if (ref) depRefFreq.set(ref, (depRefFreq.get(ref) || 0) + 1)
      }

      setCounts(next)
      setDupVoucherNumbers(
        new Set(Array.from(voucherFreq.entries()).filter(([, c]) => c > 1).map(([k]) => k))
      )
      setDupChequeNumbers(
        new Set(Array.from(chequeFreq.entries()).filter(([, c]) => c > 1).map(([k]) => k))
      )
      setDupDepositRefs(
        new Set(Array.from(depRefFreq.entries()).filter(([, c]) => c > 1).map(([k]) => k))
      )
    } catch (err) {
      console.error("Failed to fetch counts/duplicates:", err)
    }
  }, [role, profile?.assigned_area])

  // Fetch records for Daily View or Queue View
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

      if (viewMode === "queue" && activeTab !== "all") {
        query = query.eq("workflow_status", activeTab)
      }

      if (viewMode === "daily" && !allDatesMode && selectedDay) {
        query = query.eq("invoice_date", selectedDay)
      }

      if (collectorFilter !== "all") {
        query = query.or(
          `invoice_collected_by_uuid.eq.${collectorFilter},cheque_collected_by_uuid.eq.${collectorFilter},deposited_by_uuid.eq.${collectorFilter}`
        )
      }

      if (viewMode === "queue") {
        if (dateFrom) query = query.gte("invoice_date", dateFrom)
        if (dateTo) query = query.lte("invoice_date", dateTo)
      }

      if (onlyDiscrepancies) {
        query = query.eq("amount_discrepancy", true)
      }

      if (onlyMissingDetails) {
        query = query.or("developer_name.is.null,commission_amount.is.null,developer_tin_id.is.null")
      }

      if (onlyMissingVoucherNo) {
        query = query.or("voucher_number.is.null,voucher_number.eq.")
      }

      if (debouncedSearch) {
        const q = debouncedSearch.replace(/,/g, "")
        query = query.or(
          `developer_name.ilike.%${q}%,developer_tin.ilike.%${q}%,voucher_number.ilike.%${q}%,cheque_number.ilike.%${q}%,deposit_reference_no.ilike.%${q}%,invoice_remarks.ilike.%${q}%,invoice_collected_by_name.ilike.%${q}%,cheque_collected_by_name.ilike.%${q}%`
        )
      }

      if (viewMode === "daily") {
        query = query.order("invoice_date", { ascending: false }).order("updated_at", { ascending: false }).limit(200)
      } else {
        const from = (page - 1) * PAGE_SIZE
        const to = from + PAGE_SIZE - 1
        query = query.order(sortField, { ascending: sortAsc }).range(from, to)
      }

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
    viewMode,
    activeTab,
    allDatesMode,
    selectedDay,
    collectorFilter,
    dateFrom,
    dateTo,
    onlyDiscrepancies,
    onlyMissingDetails,
    onlyMissingVoucherNo,
    debouncedSearch,
    sortField,
    sortAsc,
    page,
  ])

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchCountsAndDuplicates(), fetchTransactions()])
  }, [fetchCountsAndDuplicates, fetchTransactions])

  useEffect(() => {
    fetchCountsAndDuplicates()
  }, [fetchCountsAndDuplicates])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  // Real-time sync with Collector PWA
  useEffect(() => {
    const channel = supabase
      .channel("accounting-collector-transactions-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collector_transactions" },
        () => {
          refreshAll()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refreshAll])

  // Deep-link ?collection_id=<uuid>
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
        setSelectedTx(data as CollectorTransaction)
      } else {
        toast.error("Linked collector transaction was not found.")
      }
    }
    loadDeepLinked()
  }, [searchParams])

  const closeReview = () => {
    setSelectedTx(null)
    if (searchParams.get("collection_id")) {
      router.replace(pathname, { scroll: false })
    }
  }

  const isDuplicateRow = (
    tx: CollectorTransaction
  ): { voucher: boolean; cheque: boolean; depositRef: boolean } => {
    const vch = (tx.voucher_number || "").trim().toLowerCase()
    const chq = (tx.cheque_number || "").trim().toLowerCase()
    const ref = (tx.deposit_reference_no || "").trim().toLowerCase()
    return {
      voucher: Boolean(vch && dupVoucherNumbers.has(vch)),
      cheque: Boolean(chq && dupChequeNumbers.has(chq)),
      depositRef: Boolean(ref && dupDepositRefs.has(ref)),
    }
  }

  // Group records by Collector & Date for Daily View
  const dailyGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string
        date: string
        collectorName: string
        area: string | null
        items: CollectorTransaction[]
        invoiceTotal: number
        chequeTotal: number
        depositedTotal: number
      }
    >()

    for (const tx of records) {
      const dateKey = tx.invoice_date || "Undated"
      const collectorName =
        tx.deposited_by_name ||
        tx.cheque_collected_by_name ||
        tx.invoice_collected_by_name ||
        "Unassigned Collector"
      const groupKey = `${dateKey}__${collectorName}`

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          key: groupKey,
          date: dateKey,
          collectorName,
          area: tx.assigned_area,
          items: [],
          invoiceTotal: 0,
          chequeTotal: 0,
          depositedTotal: 0,
        })
      }
      const g = map.get(groupKey)!
      g.items.push(tx)
      g.invoiceTotal += Number(tx.commission_amount) || 0
      g.chequeTotal += Number(tx.cheque_amount) || 0
      if (tx.workflow_status === "deposited" || tx.workflow_status === "verified" || tx.workflow_status === "converted_to_sale") {
        g.depositedTotal += Number(tx.deposit_amount ?? tx.cheque_amount) || 0
      }
    }
    return Array.from(map.values())
  }, [records])

  const dailySummaryTotals = useMemo(() => {
    let invoices = 0
    let cheques = 0
    let deposited = 0
    for (const g of dailyGroups) {
      invoices += g.invoiceTotal
      cheques += g.chequeTotal
      deposited += g.depositedTotal
    }
    return { invoices, cheques, deposited, count: records.length }
  }, [dailyGroups, records.length])

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

  const clearFilters = () => {
    setSearchInput("")
    setDebouncedSearch("")
    setCollectorFilter("all")
    setAreaFilter("all")
    setDateFrom("")
    setDateTo("")
    setOnlyDiscrepancies(false)
    setOnlyMissingDetails(false)
    setOnlyMissingVoucherNo(false)
    setPage(1)
  }

  const hasActiveFilters =
    Boolean(debouncedSearch) ||
    collectorFilter !== "all" ||
    areaFilter !== "all" ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    onlyDiscrepancies ||
    onlyMissingDetails ||
    onlyMissingVoucherNo

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div className="space-y-6">
      {/* Page Header & View Toggle */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2.5">
            <FileCheck2 className="h-7 w-7 text-emerald-600" />
            Collector Daily Batches &amp; Cheque Verification
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Review daily collector uploads, edit fields &amp; manage attachments, verify deposited
            cheques, and convert verified batches into official Sales.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border bg-white p-1 shadow-sm">
            <Button
              type="button"
              size="sm"
              variant={viewMode === "daily" ? "default" : "ghost"}
              onClick={() => setViewMode("daily")}
              className={viewMode === "daily" ? "bg-[#001f3f] text-white" : "text-slate-700"}
            >
              <CalendarDays className="h-4 w-4 mr-1.5" />
              Daily View
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "queue" ? "default" : "ghost"}
              onClick={() => setViewMode("queue")}
              className={viewMode === "queue" ? "bg-[#001f3f] text-white" : "text-slate-700"}
            >
              <LayoutList className="h-4 w-4 mr-1.5" />
              Action Queues
            </Button>
          </div>

          <Button
            type="button"
            onClick={() => setSmartUploadOpen(true)}
            className="bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white font-semibold shadow-sm"
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            Smart AI Upload
          </Button>

          <Button onClick={refreshAll} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* 6 Summary KPI Cards (Click jumps straight to that Queue tab) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {(
          [
            {
              key: "deposited" as FilterTab,
              title: "Deposited — Needs Check",
              value: counts.deposited,
              ring: "ring-blue-500",
              labelColor: "text-blue-700",
              numColor: "text-blue-900",
              sub: "Ready for verification",
            },
            {
              key: "verified" as FilterTab,
              title: "Verified — Ready",
              value: counts.verified,
              ring: "ring-emerald-500",
              labelColor: "text-emerald-700",
              numColor: "text-emerald-900",
              sub: "Convert to Sale",
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
              title: "Draft / Invoice Only",
              value: counts.invoice_issued,
              ring: "ring-slate-500",
              labelColor: "text-slate-600",
              numColor: "text-slate-900",
              sub: "Awaiting cheque",
            },
            {
              key: "cheque_collected" as FilterTab,
              title: "Cheque Collected",
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
              viewMode === "queue" && activeTab === kpi.key ? `ring-2 ${kpi.ring}` : ""
            }`}
            onClick={() => {
              setViewMode("queue")
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

      {/* DAILY NAVIGATOR BAR (Daily View) */}
      {viewMode === "daily" && (
        <Card className="border-sky-200 bg-sky-50/40">
          <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="bg-white"
                onClick={() => {
                  setAllDatesMode(false)
                  setSelectedDay((d) => shiftDateIso(d, -1))
                }}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Prev Day
              </Button>
              <div className="flex items-center gap-1.5 bg-white border rounded-md px-2.5 py-1">
                <Calendar className="h-4 w-4 text-sky-700" />
                <input
                  type="date"
                  value={selectedDay}
                  onChange={(e) => {
                    setAllDatesMode(false)
                    setSelectedDay(e.target.value)
                  }}
                  className="text-xs font-semibold text-[#001f3f] outline-none bg-transparent"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="bg-white"
                onClick={() => {
                  setAllDatesMode(false)
                  setSelectedDay((d) => shiftDateIso(d, 1))
                }}
              >
                Next Day
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!allDatesMode && selectedDay === todayIso() ? "default" : "outline"}
                className={
                  !allDatesMode && selectedDay === todayIso() ? "bg-[#001f3f] text-white" : "bg-white"
                }
                onClick={() => {
                  setAllDatesMode(false)
                  setSelectedDay(todayIso())
                }}
              >
                Today
              </Button>
              <Button
                type="button"
                size="sm"
                variant={allDatesMode ? "default" : "outline"}
                className={allDatesMode ? "bg-[#001f3f] text-white" : "bg-white"}
                onClick={() => setAllDatesMode((v) => !v)}
              >
                All Dates
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div>
                <span className="text-slate-500">Invoices:</span>{" "}
                <strong className="text-slate-900">{formatPHP(dailySummaryTotals.invoices)}</strong>
              </div>
              <div>
                <span className="text-slate-500">Cheques:</span>{" "}
                <strong className="text-amber-800">{formatPHP(dailySummaryTotals.cheques)}</strong>
              </div>
              <div>
                <span className="text-slate-500">Deposited:</span>{" "}
                <strong className="text-emerald-700">{formatPHP(dailySummaryTotals.deposited)}</strong>
              </div>
              <Badge variant="outline" className="bg-white">
                {dailySummaryTotals.count} batch record(s)
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MAIN FILTERS + CONTENT CARD */}
      <Card>
        <CardHeader className="space-y-3 pb-4">
          {viewMode === "queue" && (
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: "all", label: `All (${counts.all})` },
                  { id: "invoice_issued", label: `Draft / Invoice (${counts.invoice_issued})` },
                  { id: "cheque_collected", label: `Cheque Collected (${counts.cheque_collected})` },
                  { id: "deposited", label: `Deposited — Check (${counts.deposited})` },
                  { id: "verified", label: `Verified (${counts.verified})` },
                  { id: "converted_to_sale", label: `Converted (${counts.converted_to_sale})` },
                  { id: "returned", label: `Returned (${counts.returned})` },
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
          )}

          {/* Search & Structured Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
            <div className="relative lg:col-span-2">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search developer, voucher #, cheque #, deposit ref, remarks..."
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

            {viewMode === "queue" && (
              <>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value)
                    setPage(1)
                  }}
                  title="Date From"
                />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value)
                    setPage(1)
                  }}
                  title="Date To"
                />
              </>
            )}
          </div>

          {/* Secondary Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={onlyMissingDetails ? "default" : "outline"}
                className={
                  onlyMissingDetails
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                    : "border-indigo-300 text-indigo-800 hover:bg-indigo-50"
                }
                onClick={() => {
                  setOnlyMissingDetails((prev) => !prev)
                  setPage(1)
                }}
              >
                <FileWarning className="h-3.5 w-3.5 mr-1.5" />
                Missing Details / Drafts
              </Button>

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
                Amount Discrepancies
              </Button>

              {canManageVoucherNo && (
                <Button
                  type="button"
                  size="sm"
                  variant={onlyMissingVoucherNo ? "default" : "outline"}
                  className={
                    onlyMissingVoucherNo
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                  }
                  onClick={() => {
                    setOnlyMissingVoucherNo((prev) => !prev)
                    setPage(1)
                  }}
                >
                  <FileWarning className="h-3.5 w-3.5 mr-1.5" />
                  Missing Voucher #
                </Button>
              )}

              {hasActiveFilters && (
                <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
                  <Filter className="h-3.5 w-3.5 mr-1" />
                  Reset Filters
                </Button>
              )}
            </div>

            <div className="text-xs text-slate-500">
              Showing <strong>{records.length}</strong> of <strong>{totalCount}</strong> record(s)
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
              <p className="font-medium text-slate-700">No collector records found</p>
              <p className="text-xs text-slate-500 mt-1">
                {viewMode === "daily" && !allDatesMode
                  ? `No batches recorded for ${selectedDay}. Try another date or click "All Dates".`
                  : "Try switching status tabs or clearing your active filters."}
              </p>
            </div>
          ) : viewMode === "daily" ? (
            /* DAILY VIEW: GROUPED BY COLLECTOR & DATE */
            <div className="space-y-5">
              {dailyGroups.map((group) => (
                <div key={group.key} className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="bg-[#001f3f] text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Users className="h-4 w-4 text-sky-300" />
                      <span className="font-bold text-sm">{group.collectorName}</span>
                      <Badge className="bg-white/15 text-white hover:bg-white/15 text-[11px]">
                        {group.date}
                      </Badge>
                      {group.area && (
                        <span className="text-xs text-sky-200">{group.area}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span>Inv: <strong>{formatPHP(group.invoiceTotal)}</strong></span>
                      <span>Chq: <strong>{formatPHP(group.chequeTotal)}</strong></span>
                      <span className="text-emerald-300">
                        Dep: <strong>{formatPHP(group.depositedTotal)}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100 bg-white">
                    {group.items.map((tx) => {
                      const dup = isDuplicateRow(tx)
                      return (
                        <div
                          key={tx.id}
                          onClick={() => setSelectedTx(tx)}
                          className="p-3.5 hover:bg-sky-50/50 cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-3 transition-colors"
                        >
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-sm text-slate-900">
                                {tx.developer_name || "Draft — No Developer Linked"}
                              </span>
                              {tx.voucher_number ? (
                                <Badge
                                  variant="outline"
                                  className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] font-semibold"
                                >
                                  Voucher #{tx.voucher_number}
                                </Badge>
                              ) : canManageVoucherNo ? (
                                <Badge
                                  variant="outline"
                                  className="bg-slate-50 text-slate-500 border-dashed border-slate-300 text-[10px]"
                                >
                                  No Voucher #
                                </Badge>
                              ) : null}
                              {getWorkflowBadge(tx.workflow_status)}
                              {getChequeStatusBadge(tx.cheque_status)}
                              {tx.amount_discrepancy && (
                                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px]">
                                  <AlertTriangle className="h-3 w-3 mr-0.5" /> Discrepancy
                                </Badge>
                              )}
                              {(dup.voucher || dup.cheque || dup.depositRef) && (
                                <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-[10px]">
                                  <AlertTriangle className="h-3 w-3 mr-0.5" /> Duplicate{" "}
                                  {dup.voucher
                                    ? "Voucher #"
                                    : dup.cheque
                                    ? "Cheque #"
                                    : "Deposit Ref"}
                                </Badge>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                              <span>Comm: <strong className="text-slate-900">{formatPHP(tx.commission_amount)}</strong></span>
                              {tx.cheque_number && (
                                <span>Cheque: <strong className="text-slate-900">#{tx.cheque_number}</strong> ({formatPHP(tx.cheque_amount)})</span>
                              )}
                              {tx.deposit_bank && (
                                <span>Deposit: <strong className="text-emerald-700">{tx.deposit_bank}</strong> {tx.deposit_reference_no ? `Ref #${tx.deposit_reference_no}` : ""}</span>
                              )}
                            </div>

                            {tx.invoice_remarks && (
                              <div className="text-xs text-slate-500 line-clamp-1 italic">
                                AI/Note: {tx.invoice_remarks}
                              </div>
                            )}

                            <AttachmentCountPills tx={tx} />
                          </div>

                          <div
                            className="flex items-center gap-2 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button size="sm" variant="outline" onClick={() => setSelectedTx(tx)}>
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              Review / Edit
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
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* QUEUE VIEW: PAGINATED TABLE */
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Developer &amp; AI Remarks</TableHead>
                      <TableHead>Attachments</TableHead>
                      <TableHead>
                        <button
                          type="button"
                          onClick={() => toggleSort("commission_amount")}
                          className="inline-flex items-center font-medium hover:text-slate-900"
                        >
                          Commission
                          {renderSortIcon("commission_amount")}
                        </button>
                      </TableHead>
                      <TableHead>Voucher, Cheque &amp; Deposit</TableHead>
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
                      const dup = isDuplicateRow(tx)
                      return (
                        <TableRow
                          key={tx.id}
                          className="cursor-pointer hover:bg-slate-50"
                          onClick={() => setSelectedTx(tx)}
                        >
                          <TableCell className="max-w-[240px]">
                            <div className="font-medium text-slate-900 truncate">
                              {tx.developer_name || "Draft / Unlinked"}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {tx.invoice_date || "—"}
                              {tx.developer_tin ? ` · TIN ${tx.developer_tin}` : ""}
                              {tx.assigned_area ? ` · ${tx.assigned_area}` : ""}
                            </div>
                            {tx.invoice_remarks && (
                              <div className="text-[11px] text-slate-500 truncate mt-0.5 italic">
                                {tx.invoice_remarks}
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="max-w-[200px]">
                            <AttachmentCountPills tx={tx} />
                          </TableCell>

                          <TableCell>
                            <div className="font-semibold text-slate-800">
                              {formatPHP(tx.commission_amount)}
                            </div>
                            {tx.amount_discrepancy && (
                              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px] mt-1">
                                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                                Mismatch
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell>
                            <div className="space-y-1 text-xs">
                              {tx.voucher_number ? (
                                <div>
                                  <Badge
                                    variant="outline"
                                    className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] py-0 font-semibold"
                                  >
                                    Voucher #{tx.voucher_number}
                                  </Badge>
                                </div>
                              ) : canManageVoucherNo ? (
                                <div className="text-[10px] text-slate-400 italic">No Voucher #</div>
                              ) : null}
                              {tx.cheque_number || tx.cheque_amount ? (
                                <div>
                                  <span className="font-semibold text-slate-800">
                                    #{tx.cheque_number || "—"}
                                  </span>{" "}
                                  ({formatPHP(tx.cheque_amount)})
                                </div>
                              ) : (
                                <span className="text-slate-400">No cheque yet</span>
                              )}
                              {tx.deposit_bank && (
                                <div className="text-[11px] text-emerald-700">
                                  {tx.deposit_bank}{" "}
                                  {tx.deposit_reference_no ? `· Ref #${tx.deposit_reference_no}` : ""}
                                </div>
                              )}
                              <div className="flex flex-wrap gap-1">
                                {getChequeStatusBadge(tx.cheque_status)}
                                {(dup.voucher || dup.cheque || dup.depositRef) && (
                                  <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-[10px] py-0">
                                    Duplicate {dup.voucher ? "Voucher" : dup.cheque ? "Cheque" : "Ref"}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="text-xs font-medium text-slate-800">
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
                                <div onClick={(e) => e.stopPropagation()}>
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

                          <TableCell
                            className="text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1.5">
                              <Button size="sm" variant="outline" onClick={() => setSelectedTx(tx)}>
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

      {/* Full Accounting Review, Edit & Attachment Manager Modal */}
      <CollectorReviewEditModal
        transaction={selectedTx}
        open={Boolean(selectedTx)}
        role={role}
        onClose={closeReview}
        onUpdated={() => refreshAll()}
        onOpenConvertToSale={(tx) => {
          setConvertTx(tx)
          setConvertOpen(true)
        }}
      />

      {/* Idempotent Convert to Sale Modal */}
      <ConvertCollectorToSaleModal
        transaction={convertTx}
        open={convertOpen}
        onOpenChange={setConvertOpen}
        onConverted={refreshAll}
      />

      {/* Smart Multi-File AI Upload Modal (New Record) */}
      <SmartBatchUploadModal
        open={smartUploadOpen}
        onClose={() => setSmartUploadOpen(false)}
        role={role}
        onSaved={() => refreshAll()}
      />
    </div>
  )
}
