"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Plus,
  Search,
  FileText,
  Mail,
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  Eye,
  Edit,
  Trash2,
  Receipt,
  Send,
  PenTool,
  ShieldCheck,
  ExternalLink,
} from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase/client"
import { logNotification } from "@/utils/logNotification"
import { formatS3Url } from "@/utils/s3-url"
import { applyTaxMonthFilter } from "@/lib/date-filter"
import { YearSelect, MonthMultiSelect } from "@/components/date-period-filter"
import {
  AddExpenseRequestModal,
  type ExpenseRequestRecord,
} from "@/components/add-expense-request-modal"
import { CreateExpenseInvoiceModal } from "@/components/create-expense-invoice-modal"
import { ConvertExpenseToPurchaseModal } from "@/components/convert-expense-to-purchase-modal"
import { ViewExpenseInvoiceModal } from "@/components/view-expense-invoice-modal"
import { ViewPurchasesModal } from "@/components/view-purchases-modal"
import type { ExpenseInvoiceRecord } from "@/components/expense-invoice-document"

interface ExpenseRequestManagerProps {
  role: "super_admin" | "secretary"
}

export function ExpenseRequestManager({ role }: ExpenseRequestManagerProps) {
  const { user, profile } = useAuth()
  const [activeTab, setActiveTab] = useState("items")
  const [requests, setRequests] = useState<ExpenseRequestRecord[]>([])
  const [invoices, setInvoices] = useState<ExpenseInvoiceRecord[]>([])
  const [categories, setCategories] = useState<{ id: string; category: string }[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterTaxType, setFilterTaxType] = useState("all")
  const [filterCategory, setFilterCategory] = useState("all")
  const [filterYear, setFilterYear] = useState("all")
  const [filterMonths, setFilterMonths] = useState<string[]>([])
  const [filterArea, setFilterArea] = useState("all")
  const [viewScope, setViewScope] = useState<"me" | "area">("area")

  // Selection for invoice creation
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([])

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<ExpenseRequestRecord | null>(null)
  const [createInvoiceModalOpen, setCreateInvoiceModalOpen] = useState(false)
  const [viewInvoiceModalOpen, setViewInvoiceModalOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<ExpenseInvoiceRecord | null>(null)
  const [convertModalOpen, setConvertModalOpen] = useState(false)
  const [invoiceToConvert, setInvoiceToConvert] = useState<ExpenseInvoiceRecord | null>(null)
  const [viewItemModalOpen, setViewItemModalOpen] = useState(false)
  const [selectedItemForView, setSelectedItemForView] = useState<ExpenseRequestRecord | null>(null)

  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null)

  const isAnthonyLeuterio =
    user?.email?.toLowerCase() === "mindworth@gmail.com" ||
    profile?.email?.toLowerCase() === "mindworth@gmail.com"

  const categoriesMap = useMemo(() => {
    const map: Record<string, string> = {}
    categories.forEach((c) => {
      map[c.id] = c.category
    })
    return map
  }, [categories])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [catsRes, reqsRes, invsRes] = await Promise.all([
        supabase
          .from("purchases_categories")
          .select("id, category")
          .eq("is_deleted", false)
          .order("category", { ascending: true }),
        supabase
          .from("expense_requests")
          .select("*")
          .eq("is_deleted", false)
          .order("created_at", { ascending: false }),
        supabase
          .from("expense_request_invoices")
          .select("*")
          .eq("is_deleted", false)
          .order("created_at", { ascending: false }),
      ])

      if (!catsRes.error && catsRes.data) setCategories(catsRes.data)

      let rawReqs = (reqsRes.data || []) as ExpenseRequestRecord[]
      let rawInvs = (invsRes.data || []) as ExpenseInvoiceRecord[]

      if (role === "secretary" && profile) {
        if (viewScope === "me") {
          const myIds = [profile.auth_user_id, profile.id].filter(Boolean)
          rawReqs = rawReqs.filter(
            (r) =>
              (r.user_uuid && myIds.includes(r.user_uuid)) ||
              r.user_full_name === profile.full_name
          )
          rawInvs = rawInvs.filter(
            (inv) =>
              (inv.requested_by_uuid && myIds.includes(inv.requested_by_uuid)) ||
              inv.requested_by_name === profile.full_name
          )
        } else if (profile.assigned_area) {
          const areaLower = profile.assigned_area.toLowerCase()
          rawReqs = rawReqs.filter(
            (r) =>
              (r.user_assigned_area || "").toLowerCase() === areaLower ||
              r.user_uuid === profile.auth_user_id ||
              r.user_uuid === profile.id
          )
          rawInvs = rawInvs.filter(
            (inv) =>
              (inv.assigned_area || "").toLowerCase() === areaLower ||
              inv.requested_by_uuid === profile.auth_user_id ||
              inv.requested_by_uuid === profile.id
          )
        }
      }

      setRequests(rawReqs)
      setInvoices(rawInvs)
    } catch (error) {
      console.error("Error fetching expense requests data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [profile?.id, viewScope])

  const availableAreas = useMemo(() => {
    const set = new Set<string>()
    requests.forEach((r) => {
      if (r.user_assigned_area) set.add(r.user_assigned_area)
    })
    return Array.from(set).sort()
  }, [requests])

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (filterStatus !== "all" && req.status !== filterStatus) return false
      if (filterTaxType !== "all" && req.tax_type !== filterTaxType) return false
      if (filterCategory !== "all" && req.category_id !== filterCategory) return false
      if (role === "super_admin" && filterArea !== "all" && req.user_assigned_area !== filterArea) {
        return false
      }
      if (!applyTaxMonthFilter(req.tax_month, filterYear, filterMonths)) return false

      if (searchTerm.trim() !== "") {
        const q = searchTerm.toLowerCase()
        const matchItem = (req.item_name || "").toLowerCase().includes(q)
        const matchName = (req.name || "").toLowerCase().includes(q)
        const matchTin = (req.tin || "").toLowerCase().includes(q)
        const matchInv = (req.expense_invoice_number || req.invoice_number || "").toLowerCase().includes(q)
        const matchUser = (req.user_full_name || "").toLowerCase().includes(q)
        if (!matchItem && !matchName && !matchTin && !matchInv && !matchUser) return false
      }
      return true
    })
  }, [requests, filterStatus, filterTaxType, filterCategory, filterArea, filterYear, filterMonths, searchTerm, role])

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (filterStatus !== "all") {
        if (filterStatus === "invoiced" && inv.status !== "pending_approval") return false
        if (filterStatus === "pending" && inv.status !== "pending_approval") return false
        if (filterStatus === "approved" && inv.status !== "approved") return false
        if (filterStatus === "converted" && inv.status !== "converted") return false
        if (filterStatus === "rejected" && inv.status !== "rejected") return false
      }
      if (role === "super_admin" && filterArea !== "all" && inv.assigned_area !== filterArea) {
        return false
      }
      if (searchTerm.trim() !== "") {
        const q = searchTerm.toLowerCase()
        const matchNo = (inv.invoice_number || "").toLowerCase().includes(q)
        const matchPayee = (inv.payee_name || "").toLowerCase().includes(q)
        const matchReqBy = (inv.requested_by_name || "").toLowerCase().includes(q)
        const matchItems = (inv.items || []).some((it) =>
          (it.item_name || "").toLowerCase().includes(q)
        )
        if (!matchNo && !matchPayee && !matchReqBy && !matchItems) return false
      }
      return true
    })
  }, [invoices, filterStatus, filterArea, searchTerm, role])

  // Selectable pending requests
  const selectablePendingIds = useMemo(
    () => filteredRequests.filter((r) => r.status === "pending").map((r) => r.id),
    [filteredRequests]
  )

  const selectedRequestObjects = useMemo(
    () => requests.filter((r) => selectedRequestIds.includes(r.id)),
    [requests, selectedRequestIds]
  )

  const selectedTotalAmount = useMemo(
    () =>
      selectedRequestObjects.reduce(
        (sum, r) => sum + (Number(r.total_actual_amount ?? r.amount ?? r.gross_taxable) || 0),
        0
      ),
    [selectedRequestObjects]
  )

  const toggleSelectRequest = (id: string) => {
    setSelectedRequestIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const toggleSelectAllPending = () => {
    if (
      selectablePendingIds.length > 0 &&
      selectablePendingIds.every((id) => selectedRequestIds.includes(id))
    ) {
      setSelectedRequestIds([])
    } else {
      setSelectedRequestIds(selectablePendingIds)
    }
  }

  const handleDeleteRequest = async (req: ExpenseRequestRecord) => {
    if (!confirm(`Are you sure you want to delete itemized expense "${req.item_name}"?`)) return
    try {
      const { error } = await supabase
        .from("expense_requests")
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq("id", req.id)
      if (error) throw error
      setSelectedRequestIds((prev) => prev.filter((id) => id !== req.id))
      fetchData()
    } catch (err: any) {
      alert("Error deleting expense request: " + (err?.message || "Failed"))
    }
  }

  const handleSendInvoiceEmail = async (invoice: ExpenseInvoiceRecord) => {
    if (!invoice.id) return
    setSendingEmailId(invoice.id)
    try {
      const res = await fetch("/api/send-expense-invoice-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice.id,
          baseUrl: typeof window !== "undefined" ? window.location.origin : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send email")
      alert(
        `Expense Invoice #${invoice.invoice_number} sent to ${data.sentTo}! The boss can click the link in the email to view and sign without logging in.`
      )
      fetchData()
    } catch (err: any) {
      alert("Failed to send email: " + (err?.message || "Unknown error"))
    } finally {
      setSendingEmailId(null)
    }
  }

  const openConvertModalForInvoice = (inv: ExpenseInvoiceRecord) => {
    setInvoiceToConvert(inv)
    setConvertModalOpen(true)
  }

  const openConvertModalForRequest = (req: ExpenseRequestRecord) => {
    const foundInv = invoices.find((inv) => inv.id === req.expense_invoice_id)
    if (foundInv) {
      openConvertModalForInvoice(foundInv)
    } else {
      // Fallback synthetic invoice if approved directly
      const amt = Number(req.total_actual_amount ?? req.amount ?? req.gross_taxable ?? 0)
      const fallbackInv: ExpenseInvoiceRecord = {
        id: req.expense_invoice_id || undefined,
        invoice_number: req.expense_invoice_number || req.invoice_number || `EXP-${req.id.slice(0, 6)}`,
        invoice_date: req.date_added || format(new Date(), "yyyy-MM-dd"),
        payee_name: req.name,
        payee_tin: req.tin,
        payee_substreet_street_brgy: req.substreet_street_brgy,
        payee_district_city_zip: req.district_city_zip,
        requested_by_uuid: req.user_uuid,
        requested_by_name: req.user_full_name,
        assigned_area: req.user_assigned_area,
        items: [
          {
            expense_request_id: req.id,
            item_name: req.item_name,
            supplier_name: req.name,
            tin: req.tin,
            tax_type: req.tax_type,
            tax_month: req.tax_month,
            category_id: req.category_id || "",
            category_name: req.category_id ? categoriesMap[req.category_id] : "General",
            quantity: 1,
            rate: amt,
            amount: amt,
            gross_taxable: req.gross_taxable,
            total_actual_amount: amt,
          },
        ],
        subtotal: amt,
        total: amt,
        status: "approved",
        signed_at: req.approved_at,
        approved_by_name: req.approved_by || "ANTHONY GERARD LEUTERIO",
      }
      setInvoiceToConvert(fallbackInv)
      setConvertModalOpen(true)
    }
  }

  const stats = useMemo(() => {
    const totalAmount = requests.reduce(
      (s, r) => s + (Number(r.total_actual_amount ?? r.amount ?? r.gross_taxable) || 0),
      0
    )
    const pendingCount = requests.filter((r) => r.status === "pending").length
    const invoicedCount = requests.filter((r) => r.status === "invoiced").length
    const approvedCount = requests.filter((r) => r.status === "approved").length
    const convertedCount = requests.filter((r) => r.status === "converted").length
    const approvedInvoicesReady = invoices.filter((i) => i.status === "approved").length

    return {
      totalItems: requests.length,
      totalAmount,
      pendingCount,
      invoicedCount,
      approvedCount,
      convertedCount,
      approvedInvoicesReady,
    }
  }, [requests, invoices])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(Number(val) || 0)

  const formatTin = (tin: string) => {
    const digits = (tin || "").replace(/\D/g, "")
    if (!digits || digits === "0") return tin || "0"
    return digits.replace(/(\d{3})(?=\d)/g, "$1-")
  }

  const renderStatusBadge = (status: string, invNo?: string | null, signedAt?: string | null) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3 h-3 mr-1" />
            Pending (Select for Invoice)
          </Badge>
        )
      case "invoiced":
      case "pending_approval":
        return (
          <div className="flex flex-col gap-0.5">
            <Badge className="bg-sky-100 text-sky-800 border border-sky-300 w-fit">
              <FileText className="w-3 h-3 mr-1" />
              Invoiced {invNo ? `#${invNo}` : "(Awaiting Signature)"}
            </Badge>
          </div>
        )
      case "approved":
        return (
          <div className="flex flex-col gap-0.5">
            <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 w-fit">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Approved &amp; Signed
            </Badge>
            {signedAt && (
              <span className="text-[10px] text-emerald-700 font-medium">
                Signed: {format(new Date(signedAt), "MMM dd, yyyy hh:mm a")}
              </span>
            )}
          </div>
        )
      case "converted":
        return (
          <Badge className="bg-purple-100 text-purple-800 border border-purple-300">
            <ArrowRightLeft className="w-3 h-3 mr-1" />
            Converted to Purchases
          </Badge>
        )
      case "rejected":
        return (
          <Badge className="bg-red-100 text-red-800 border border-red-300">
            Rejected
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient-to-r from-[#001f3f] to-[#0284c7] p-2.5 rounded-xl text-white shadow">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#001f3f]">
                Expense Request &amp; Invoice Approval
              </h1>
              <p className="text-sm text-slate-600">
                Encode itemized expense requests, bundle selected items into a professional invoice, send via email for signature approval, and convert approved invoices into a Purchases record.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isAnthonyLeuterio && (
            <Link href="/dashboard/super-admin/expense-approvals">
              <Button className="bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow">
                <ShieldCheck className="w-4 h-4 mr-2" />
                My Exclusive Approval Portal
              </Button>
            </Link>
          )}

          {selectedRequestIds.length > 0 && (
            <Button
              onClick={() => setCreateInvoiceModalOpen(true)}
              className="bg-gradient-to-r from-sky-600 to-blue-700 hover:opacity-95 text-white font-bold shadow-md animate-in fade-in-50"
            >
              <Send className="w-4 h-4 mr-2" />
              Create Invoice from Selected ({selectedRequestIds.length}) &bull;{" "}
              {formatCurrency(selectedTotalAmount)}
            </Button>
          )}

          <Button
            onClick={() => {
              setEditRecord(null)
              setAddModalOpen(true)
            }}
            className="bg-[#001f3f] hover:bg-[#001f3f]/90 text-white font-semibold shadow"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Expense Request Item(s)
          </Button>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Total Itemized Requests</p>
            <p className="text-2xl font-extrabold text-[#001f3f] mt-1">{stats.totalItems}</p>
            <p className="text-xs text-slate-600 mt-0.5 font-medium">
              {formatCurrency(stats.totalAmount)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-amber-50/60 border-amber-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase text-amber-800">1. Pending Items</p>
            <p className="text-2xl font-extrabold text-amber-900 mt-1">{stats.pendingCount}</p>
            <p className="text-xs text-amber-700 mt-0.5">Select items to create invoice</p>
          </CardContent>
        </Card>

        <Card className="bg-sky-50/60 border-sky-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase text-sky-800">2. Invoiced (For Signature)</p>
            <p className="text-2xl font-extrabold text-sky-900 mt-1">{stats.invoicedCount}</p>
            <p className="text-xs text-sky-700 mt-0.5">Awaiting boss signature</p>
          </CardContent>
        </Card>

        <Card className="bg-emerald-50/70 border-emerald-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase text-emerald-800">3. Approved &amp; Signed</p>
            <p className="text-2xl font-extrabold text-emerald-900 mt-1">
              {stats.approvedCount}{" "}
              <span className="text-xs font-semibold">
                ({stats.approvedInvoicesReady} Invoice{stats.approvedInvoicesReady === 1 ? "" : "s"})
              </span>
            </p>
            <p className="text-xs text-emerald-700 mt-0.5 font-medium">
              Ready to convert to Purchases!
            </p>
          </CardContent>
        </Card>

        <Card className="bg-purple-50/60 border-purple-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase text-purple-800">4. Converted to Purchases</p>
            <p className="text-2xl font-extrabold text-purple-900 mt-1">{stats.convertedCount}</p>
            <p className="text-xs text-purple-700 mt-0.5">Recorded in Purchases page</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-center">
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search item, payee, TIN, or invoice #..."
                className="pl-9 bg-white text-[#001f3f] border-slate-300"
              />
            </div>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="bg-white text-[#001f3f] border-slate-300">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending (Not Invoiced)</SelectItem>
                <SelectItem value="invoiced">Invoiced (Awaiting Signature)</SelectItem>
                <SelectItem value="approved">Approved &amp; Signed</SelectItem>
                <SelectItem value="converted">Converted to Purchases</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="bg-white text-[#001f3f] border-slate-300">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <YearSelect value={filterYear} onValueChange={setFilterYear} />
            <MonthMultiSelect selectedMonths={filterMonths} onMonthsChange={setFilterMonths} selectedYear={filterYear} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-3">
              {role === "super_admin" && availableAreas.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-600">Area:</span>
                  <Select value={filterArea} onValueChange={setFilterArea}>
                    <SelectTrigger className="w-40 h-8 text-xs bg-white text-[#001f3f] border-slate-300">
                      <SelectValue placeholder="All Areas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Areas</SelectItem>
                      {availableAreas.map((area) => (
                        <SelectItem key={area} value={area}>
                          {area}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {role === "secretary" && (
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                  <Button
                    type="button"
                    size="sm"
                    variant={viewScope === "me" ? "default" : "ghost"}
                    onClick={() => setViewScope("me")}
                    className={`h-7 text-xs ${
                      viewScope === "me" ? "bg-[#001f3f] text-white" : "text-slate-700"
                    }`}
                  >
                    My Requests
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={viewScope === "area" ? "default" : "ghost"}
                    onClick={() => setViewScope("area")}
                    className={`h-7 text-xs ${
                      viewScope === "area" ? "bg-[#001f3f] text-white" : "text-slate-700"
                    }`}
                  >
                    All {profile?.assigned_area || "Area"} Requests
                  </Button>
                </div>
              )}
            </div>

            {selectedRequestIds.length > 0 && (
              <div className="flex items-center gap-3 bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-lg">
                <span className="text-xs font-semibold text-sky-900">
                  {selectedRequestIds.length} item(s) selected ({formatCurrency(selectedTotalAmount)})
                </span>
                <Button
                  size="sm"
                  onClick={() => setCreateInvoiceModalOpen(true)}
                  className="h-7 text-xs bg-sky-600 hover:bg-sky-700 text-white"
                >
                  Create Invoice &amp; Send Email
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedRequestIds([])}
                  className="h-7 text-xs text-slate-600"
                >
                  Clear
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-200/80 p-1 rounded-xl">
          <TabsTrigger
            value="items"
            className="data-[state=active]:bg-[#001f3f] data-[state=active]:text-white font-semibold px-5 py-2 rounded-lg"
          >
            Itemized Expense Requests ({filteredRequests.length})
          </TabsTrigger>
          <TabsTrigger
            value="invoices"
            className="data-[state=active]:bg-[#001f3f] data-[state=active]:text-white font-semibold px-5 py-2 rounded-lg"
          >
            Expense Invoices &amp; Signatures ({filteredInvoices.length})
            {stats.approvedInvoicesReady > 0 && (
              <span className="ml-2 bg-emerald-500 text-white text-[11px] px-2 py-0.5 rounded-full">
                {stats.approvedInvoicesReady} Approved
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: ITEMIZED EXPENSE REQUESTS */}
        <TabsContent value="items">
          <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg font-bold text-[#001f3f]">
                    Itemized Expense Requests
                  </CardTitle>
                  <CardDescription>
                    Check one or more pending items below and click &ldquo;Create Invoice from Selected&rdquo; to generate an invoice for approval.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#001f3f] hover:bg-[#001f3f]">
                      <TableHead className="w-10 text-center text-white">
                        <input
                          type="checkbox"
                          checked={
                            selectablePendingIds.length > 0 &&
                            selectablePendingIds.every((id) => selectedRequestIds.includes(id))
                          }
                          onChange={toggleSelectAllPending}
                          disabled={selectablePendingIds.length === 0}
                          className="rounded border-white/50 cursor-pointer"
                          title="Select all pending items"
                        />
                      </TableHead>
                      <TableHead className="text-white font-semibold">Item / Particulars</TableHead>
                      <TableHead className="text-white font-semibold text-right">Amount</TableHead>
                      <TableHead className="text-white font-semibold">Status &amp; Approval</TableHead>
                      <TableHead className="text-white font-semibold">Tax Month</TableHead>
                      <TableHead className="text-white font-semibold">Payee / TIN</TableHead>
                      <TableHead className="text-white font-semibold">Category</TableHead>
                      <TableHead className="text-white font-semibold">Tax Type</TableHead>
                      <TableHead className="text-white font-semibold">Requested By</TableHead>
                      <TableHead className="text-white font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-12 text-slate-500">
                          Loading itemized expense requests...
                        </TableCell>
                      </TableRow>
                    ) : filteredRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-12 text-slate-500">
                          No itemized expense requests found. Click &ldquo;Add Expense Request Item(s)&rdquo; to add items like Petty Cash, Birthday Celebration, or Event Venue.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRequests.map((req) => {
                        const isSelectable = req.status === "pending"
                        const isSelected = selectedRequestIds.includes(req.id)
                        const linkedInvoice = invoices.find((inv) => inv.id === req.expense_invoice_id)
                        const amountVal = Number(
                          req.total_actual_amount ?? req.amount ?? req.gross_taxable ?? 0
                        )

                        return (
                          <TableRow
                            key={req.id}
                            className={
                              isSelected
                                ? "bg-sky-50/90 hover:bg-sky-100/70"
                                : "hover:bg-slate-50"
                            }
                          >
                            <TableCell className="text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={!isSelectable}
                                onChange={() => toggleSelectRequest(req.id)}
                                className={`rounded ${
                                  isSelectable ? "cursor-pointer" : "opacity-30 cursor-not-allowed"
                                }`}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="font-bold text-[#001f3f]">{req.item_name}</div>
                              {req.invoice_number && req.invoice_number !== "0" && (
                                <div className="text-xs text-slate-500">
                                  OR/Inv #: {req.invoice_number}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-extrabold text-[#001f3f]">
                              {formatCurrency(amountVal)}
                              {req.gross_taxable && req.gross_taxable !== amountVal && (
                                <div className="text-[11px] text-slate-500 font-normal">
                                  Gross: {formatCurrency(req.gross_taxable)}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {renderStatusBadge(
                                req.status,
                                req.expense_invoice_number || linkedInvoice?.invoice_number,
                                req.approved_at || linkedInvoice?.signed_at
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-slate-700">
                              {req.tax_month
                                ? format(new Date(req.tax_month), "MMM yyyy")
                                : "-"}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm font-medium text-slate-900">
                                {req.name || req.item_name}
                              </div>
                              <div className="text-xs text-slate-500">
                                TIN: {formatTin(req.tin)}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-slate-700">
                              {req.category_id
                                ? categoriesMap[req.category_id] || "Uncategorized"
                                : "Uncategorized"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  req.tax_type === "vat"
                                    ? "border-sky-300 text-sky-700 bg-sky-50 uppercase text-[10px]"
                                    : "border-amber-300 text-amber-700 bg-amber-50 uppercase text-[10px]"
                                }
                              >
                                {req.tax_type || "non-vat"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs font-medium text-slate-800">
                                {req.user_full_name || "User"}
                              </div>
                              {req.user_assigned_area && (
                                <div className="text-[11px] text-slate-500">
                                  {req.user_assigned_area}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {req.status === "approved" && (
                                  <Button
                                    size="sm"
                                    onClick={() => openConvertModalForRequest(req)}
                                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                                  >
                                    <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />
                                    Convert to Purchase
                                  </Button>
                                )}

                                {linkedInvoice && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedInvoice(linkedInvoice)
                                      setViewInvoiceModalOpen(true)
                                    }}
                                    className="h-7 text-xs border-sky-300 text-sky-700 hover:bg-sky-50 bg-white"
                                    title="View Expense Invoice"
                                  >
                                    <FileText className="w-3.5 h-3.5 mr-1" />
                                    Invoice
                                  </Button>
                                )}

                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedItemForView(req)
                                    setViewItemModalOpen(true)
                                  }}
                                  className="h-7 w-7 text-slate-600 hover:text-[#001f3f]"
                                  title="View Item Details"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>

                                {req.status === "pending" && (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => {
                                        setEditRecord(req)
                                        setAddModalOpen(true)
                                      }}
                                      className="h-7 w-7 text-blue-600 hover:text-blue-800"
                                      title="Edit Item"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => handleDeleteRequest(req)}
                                      className="h-7 w-7 text-red-500 hover:text-red-700"
                                      title="Delete Item"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: EXPENSE INVOICES & SIGNATURES */}
        <TabsContent value="invoices">
          <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-lg font-bold text-[#001f3f]">
                Expense Request Invoices &amp; Approval Status
              </CardTitle>
              <CardDescription>
                View generated expense invoices, send/resend email to <strong>johnryfibra2@gmail.com</strong>, verify Sir Anthony Leuterio&apos;s signature &amp; signed date, and convert approved invoices into a single Purchase record.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#001f3f] hover:bg-[#001f3f]">
                      <TableHead className="text-white font-semibold">Invoice #</TableHead>
                      <TableHead className="text-white font-semibold">Date</TableHead>
                      <TableHead className="text-white font-semibold">Itemized Breakdown</TableHead>
                      <TableHead className="text-white font-semibold text-right">Total Amount</TableHead>
                      <TableHead className="text-white font-semibold">Requested By</TableHead>
                      <TableHead className="text-white font-semibold">Email Status</TableHead>
                      <TableHead className="text-white font-semibold">Approval &amp; Signed Date</TableHead>
                      <TableHead className="text-white font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                          Loading expense invoices...
                        </TableCell>
                      </TableRow>
                    ) : filteredInvoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                          No expense invoices created yet. Select itemized requests in the first tab and click &ldquo;Create Invoice from Selected&rdquo;.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredInvoices.map((inv) => {
                        const items = Array.isArray(inv.items) ? inv.items : []
                        const isApproved = inv.status === "approved"
                        const isConverted = inv.status === "converted"

                        return (
                          <TableRow key={inv.id} className="hover:bg-slate-50">
                            <TableCell className="font-extrabold text-[#001f3f]">
                              #{inv.invoice_number}
                            </TableCell>
                            <TableCell className="text-xs text-slate-700">
                              {inv.invoice_date
                                ? format(new Date(inv.invoice_date), "MMM dd, yyyy")
                                : "-"}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1 max-w-md">
                                {items.map((it, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-xs text-slate-800"
                                  >
                                    <span className="font-medium">{it.item_name}:</span>
                                    <span className="font-bold text-[#001f3f]">
                                      ₱{Number(it.amount || 0).toLocaleString()}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-extrabold text-[#0284c7] text-base">
                              {formatCurrency(inv.total || 0)}
                            </TableCell>
                            <TableCell>
                              <div className="text-xs font-semibold text-slate-900">
                                {inv.requested_by_name || "Accounting"}
                              </div>
                              {inv.assigned_area && (
                                <div className="text-[11px] text-slate-500">{inv.assigned_area}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              {inv.email_sent_at ? (
                                <div className="text-xs text-sky-800">
                                  <div className="font-semibold flex items-center gap-1">
                                    <Mail className="w-3 h-3 text-sky-600" />
                                    Sent to {inv.sent_to_email || "johnryfibra2@gmail.com"}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    {format(new Date(inv.email_sent_at), "MMM dd, yyyy hh:mm a")}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">Not emailed yet</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {renderStatusBadge(inv.status || "pending_approval", null, inv.signed_at)}
                                {inv.signature_data && (
                                  <div className="flex items-center gap-2 pt-1">
                                    <img
                                      src={inv.signature_data}
                                      alt="Signature"
                                      className="h-7 w-auto bg-white border border-slate-200 rounded px-1 object-contain"
                                    />
                                    <span className="text-[10px] text-slate-500">
                                      by {inv.approved_by_name || "Sir Anthony"}
                                    </span>
                                  </div>
                                )}
                                {isConverted && inv.converted_at && (
                                  <div className="text-[10px] text-purple-700 font-medium">
                                    Converted on {format(new Date(inv.converted_at), "MMM dd, yyyy")}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                {isApproved && (
                                  <Button
                                    size="sm"
                                    onClick={() => openConvertModalForInvoice(inv)}
                                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
                                  >
                                    <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
                                    Convert to Purchases Record
                                  </Button>
                                )}

                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedInvoice(inv)
                                    setViewInvoiceModalOpen(true)
                                  }}
                                  className="h-8 text-xs border-[#001f3f] text-[#001f3f] bg-white hover:bg-slate-100"
                                >
                                  <Eye className="w-3.5 h-3.5 mr-1" />
                                  {isAnthonyLeuterio && inv.status === "pending_approval"
                                    ? "View & Sign"
                                    : "View / PDF"}
                                </Button>

                                {!isConverted && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={sendingEmailId === inv.id}
                                    onClick={() => handleSendInvoiceEmail(inv)}
                                    className="h-8 text-xs border-sky-600 text-sky-700 hover:bg-sky-50 bg-white"
                                  >
                                    <Mail className="w-3.5 h-3.5 mr-1" />
                                    {sendingEmailId === inv.id
                                      ? "Sending..."
                                      : inv.email_sent_at
                                      ? "Resend Email"
                                      : "Send Email"}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add / Edit Itemized Expense Request Modal */}
      <AddExpenseRequestModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        editRecord={editRecord}
        onSaved={() => {
          setEditRecord(null)
          fetchData()
        }}
      />

      {/* Create Expense Invoice Modal */}
      <CreateExpenseInvoiceModal
        open={createInvoiceModalOpen}
        onOpenChange={setCreateInvoiceModalOpen}
        selectedRequests={selectedRequestObjects}
        categoriesMap={categoriesMap}
        onInvoiceCreated={() => {
          setSelectedRequestIds([])
          setActiveTab("invoices")
          fetchData()
        }}
      />

      {/* View Expense Invoice Modal */}
      <ViewExpenseInvoiceModal
        open={viewInvoiceModalOpen}
        onOpenChange={setViewInvoiceModalOpen}
        invoice={selectedInvoice}
        canApprove={isAnthonyLeuterio}
        onConvertClick={(inv) => openConvertModalForInvoice(inv)}
        onUpdated={fetchData}
      />

      {/* Convert Approved Invoice to Purchases Modal */}
      <ConvertExpenseToPurchaseModal
        open={convertModalOpen}
        onOpenChange={setConvertModalOpen}
        invoice={invoiceToConvert}
        linkedRequests={
          invoiceToConvert
            ? requests.filter(
                (r) =>
                  r.expense_invoice_id === invoiceToConvert.id ||
                  (invoiceToConvert.expense_request_ids || []).includes(r.id)
              )
            : []
        }
        onConverted={fetchData}
      />

      {/* View Individual Expense Item Details Modal */}
      <ViewPurchasesModal
        open={viewItemModalOpen}
        onOpenChange={setViewItemModalOpen}
        purchase={selectedItemForView as any}
      />
    </div>
  )
}
