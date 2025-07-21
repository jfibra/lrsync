"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { BarChart3, Download, Edit, Eye, Filter, FileText, Search, Trash2, TrendingUp, DollarSign } from "lucide-react"
import { format } from "date-fns"
import * as XLSX from "xlsx"

/* ----------------------------- shadcn/ui ----------------------------- */
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardHeader } from "@/components/dashboard-header"
import { AddSalesModal } from "@/components/add-sales-modal"
import { ViewSalesModal } from "@/components/view-sales-modal"
import { EditSalesModal } from "@/components/edit-sales-modal"
import { CustomExportModal } from "@/components/custom-export-modal"
import { ColumnVisibilityControl } from "@/components/column-visibility-control"

import type { Sales } from "@/types/sales"

export default function AdminSalesPage() {
  /* -------------------------------------------------------------------------- */
  /*                                   STATE                                    */
  /* -------------------------------------------------------------------------- */
  const { profile } = useAuth()
  const [sales, setSales] = useState<Sales[]>([])
  const [loading, setLoading] = useState(true)

  const [searchTerm, setSearchTerm] = useState("")
  const [filterTaxType, setFilterTaxType] = useState("all")
  const [filterMonth, setFilterMonth] = useState("all")

  /* Column visibility (toggleable) */
  const [columns, setColumns] = useState([
    { key: "tax_month", label: "Tax Month", visible: true },
    { key: "tin", label: "TIN", visible: true },
    { key: "name", label: "Name", visible: true },
    { key: "tax_type", label: "Tax Type", visible: true },
    { key: "sale_type", label: "Sale Type", visible: true },
    { key: "gross_taxable", label: "Gross Taxable", visible: true },
    { key: "total_actual_amount", label: "Total Actual", visible: false },
    { key: "invoice_number", label: "Invoice #", visible: true },
    { key: "pickup_date", label: "Pickup Date", visible: true },
    { key: "files", label: "Files", visible: true },
    { key: "actions", label: "Actions", visible: true },
  ])

  const toggleColumn = (key: string) =>
    setColumns((prev) => prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)))

  /* Modals */
  const [selectedSale, setSelectedSale] = useState<Sales | null>(null)
  const [viewOpen, setViewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  /* -------------------------------------------------------------------------- */
  /*                             DATA / SIDE-EFFECTS                            */
  /* -------------------------------------------------------------------------- */
  const monthOptions = Array.from({ length: 24 }).map((_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i, 1)
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    }
  })

  const fetchSales = async () => {
    if (!profile?.assigned_area) return
    setLoading(true)
    try {
      let q = supabase
        .from("sales")
        .select(
          `
        *,
        taxpayer_listings(
          registered_name,
          substreet_street_brgy,
          district_city_zip
        )`,
        )
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })

      if (searchTerm) {
        q = q.or(`name.ilike.%${searchTerm}%,tin.ilike.%${searchTerm}%,invoice_number.ilike.%${searchTerm}%`)
      }
      if (filterTaxType !== "all") q = q.eq("tax_type", filterTaxType)
      if (filterMonth !== "all") {
        const [y, m] = filterMonth.split("-")
        q = q
          .gte("tax_month", `${y}-${m}-01`)
          .lt(
            "tax_month",
            `${Number(m) === 12 ? Number(y) + 1 : y}-${String(Number(m) === 12 ? 1 : Number(m) + 1).padStart(
              2,
              "0",
            )}-01`,
          )
      }

      const { data, error } = await q
      if (error) throw error
      setSales(data)
    } catch (err) {
      console.error("Fetch sales error", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSales()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterTaxType, filterMonth, profile?.assigned_area])

  /* -------------------------------------------------------------------------- */
  /*                               HELPERS / UI                                */
  /* -------------------------------------------------------------------------- */
  const fmtCurr = (n: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n)

  const fmtTin = (tin: string) => tin.replace(/\D/g, "").replace(/(\d{3})(?=\d)/g, "$1-")

  const badgeColor = (t: string) =>
    t === "vat"
      ? "bg-blue-100 text-blue-800 border border-blue-200"
      : t === "non-vat"
        ? "bg-green-100 text-green-800 border border-green-200"
        : "bg-gray-100 text-gray-800 border"

  /* -------------------------------------------------------------------------- */
  /*                                EXPORT XLSX                                */
  /* -------------------------------------------------------------------------- */
  const quickExport = () => {
    const invoiceSales = sales.filter((s) => s.sale_type === "invoice")
    const wb = XLSX.utils.book_new()
    const wsData: (string | number)[][] = [
      [`SALES REPORT – ${profile?.assigned_area || "Area"}`],
      [
        "Generated:",
        new Date().toLocaleString("en-PH", {
          dateStyle: "medium",
          timeStyle: "short",
        }),
      ],
      [],
      ["Tax Month", "TIN", "Name", "Tax Type", "Sale Type", "Gross Taxable", "Total Actual"],
      ...invoiceSales.map((s) => [
        format(new Date(s.tax_month), "MMM yyyy"),
        fmtTin(s.tin),
        s.name,
        s.tax_type?.toUpperCase(),
        s.sale_type?.toUpperCase(),
        s.gross_taxable,
        s.total_actual_amount,
      ]),
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsData), "Invoice Sales")
    XLSX.writeFile(
      wb,
      `Invoice_Sales_${profile?.assigned_area?.replace(/\s+/g, "_") || "Area"}_${
        new Date().toISOString().split("T")[0]
      }.xlsx`,
    )
  }

  /* -------------------------------------------------------------------------- */
  /*                                    JSX                                    */
  /* -------------------------------------------------------------------------- */
  const visible = (key: string) => columns.find((c) => c.key === key)?.visible

  /* Stats */
  const vatCount = sales.filter((s) => s.tax_type === "vat").length
  const nonVatCount = sales.filter((s) => s.tax_type === "non-vat").length
  const grossTotal = sales.reduce((n, s) => n + (s.gross_taxable || 0), 0)

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <DashboardHeader />

        <div className="pt-20 px-4 sm:px-6 lg:px-8 py-8">
          {/* Heading */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600">
                  Sales Management
                </h1>
                <p className="text-gray-600 mt-1">
                  Area: <span className="font-semibold text-indigo-600">{profile?.assigned_area}</span>
                </p>
              </div>
            </div>
            <AddSalesModal onSalesAdded={fetchSales} />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Total Sales"
              value={sales.length}
              icon={FileText}
              gradient="from-indigo-500 to-indigo-600"
            />
            <StatCard title="VAT Sales" value={vatCount} icon={TrendingUp} gradient="from-blue-500 to-blue-600" />
            <StatCard
              title="Non-VAT Sales"
              value={nonVatCount}
              icon={BarChart3}
              gradient="from-green-500 to-green-600"
            />
            <StatCard
              title="Gross Total"
              value={fmtCurr(grossTotal)}
              icon={DollarSign}
              gradient="from-purple-500 to-purple-600"
            />
          </div>

          {/* Filters */}
          <Card className="mb-6 shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Filter className="h-5 w-5 text-indigo-600" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search name / TIN / invoice"
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={filterTaxType} onValueChange={setFilterTaxType}>
                <SelectTrigger>
                  <SelectValue placeholder="Tax Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="vat">VAT</SelectItem>
                  <SelectItem value="non-vat">Non-VAT</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {monthOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("")
                  setFilterTaxType("all")
                  setFilterMonth("all")
                }}
              >
                Clear
              </Button>
            </CardContent>
          </Card>

          {/* Table & Controls */}
          <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-2xl font-bold text-gray-900">
                  <BarChart3 className="h-6 w-6 text-indigo-600" />
                  Sales Records
                </CardTitle>
                <CardDescription>{loading ? "Loading…" : `${sales.length} record(s)`}</CardDescription>
              </div>
              <div className="flex gap-2">
                <ColumnVisibilityControl columns={columns} onColumnToggle={toggleColumn} />
                <CustomExportModal sales={sales} userArea={profile?.assigned_area} />
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                  onClick={quickExport}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export (Invoice Only)
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    {columns
                      .filter((c) => c.visible)
                      .map((c) => (
                        <TableHead key={c.key} className="whitespace-nowrap font-semibold">
                          {c.label}
                        </TableHead>
                      ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={columns.filter((c) => c.visible).length} className="text-center py-12">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : sales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns.filter((c) => c.visible).length} className="text-center py-12">
                        No records
                      </TableCell>
                    </TableRow>
                  ) : (
                    sales.map((sale) => (
                      <TableRow key={sale.id} className="hover:bg-gray-50">
                        {visible("tax_month") && <TableCell>{format(new Date(sale.tax_month), "MMM yyyy")}</TableCell>}
                        {visible("tin") && <TableCell className="font-mono">{fmtTin(sale.tin)}</TableCell>}
                        {visible("name") && <TableCell>{sale.name}</TableCell>}
                        {visible("tax_type") && (
                          <TableCell>
                            <Badge className={badgeColor(sale.tax_type)}>{sale.tax_type?.toUpperCase()}</Badge>
                          </TableCell>
                        )}
                        {visible("sale_type") && (
                          <TableCell>
                            <Badge
                              className={
                                sale.sale_type === "invoice"
                                  ? "bg-emerald-100 text-emerald-800 border"
                                  : "bg-orange-100 text-orange-800 border"
                              }
                            >
                              {sale.sale_type?.toUpperCase()}
                            </Badge>
                          </TableCell>
                        )}
                        {visible("gross_taxable") && (
                          <TableCell className="font-semibold">{fmtCurr(sale.gross_taxable || 0)}</TableCell>
                        )}
                        {visible("total_actual_amount") && (
                          <TableCell className="font-semibold">{fmtCurr(sale.total_actual_amount || 0)}</TableCell>
                        )}
                        {visible("invoice_number") && <TableCell>{sale.invoice_number || "-"}</TableCell>}
                        {visible("pickup_date") && (
                          <TableCell>
                            {sale.pickup_date ? format(new Date(sale.pickup_date), "dd MMM yyyy") : "-"}
                          </TableCell>
                        )}
                        {visible("files") && (
                          <TableCell>
                            {["cheque", "voucher", "invoice", "doc_2307", "deposit_slip"].map((k) => {
                              const arr = (sale as any)[k] as string[] | null
                              return (
                                arr &&
                                arr.length > 0 && (
                                  <Badge key={k} variant="outline" className="mr-1 text-xs">
                                    {k.replace("_", " ")} ({arr.length})
                                  </Badge>
                                )
                              )
                            })}
                          </TableCell>
                        )}
                        {visible("actions") && (
                          <TableCell>
                            <div className="flex gap-1">
                              <IconBtn
                                title="View"
                                icon={Eye}
                                onClick={() => {
                                  setSelectedSale(sale)
                                  setViewOpen(true)
                                }}
                              />
                              <IconBtn
                                title="Edit"
                                icon={Edit}
                                onClick={() => {
                                  setSelectedSale(sale)
                                  setEditOpen(true)
                                }}
                              />
                              <IconBtn
                                title="Delete"
                                icon={Trash2}
                                className="text-red-600 hover:bg-red-100"
                                onClick={async () => {
                                  if (confirm("Delete this record?")) {
                                    await supabase.from("sales").update({ is_deleted: true }).eq("id", sale.id)
                                    fetchSales()
                                  }
                                }}
                              />
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Modals */}
        {selectedSale && (
          <>
            <ViewSalesModal sale={selectedSale} open={viewOpen} onOpenChange={setViewOpen} />
            <EditSalesModal
              sale={selectedSale}
              open={editOpen}
              onOpenChange={setEditOpen}
              onSalesUpdated={fetchSales}
            />
          </>
        )}
      </div>
    </ProtectedRoute>
  )
}

/* -------------------------------------------------------------------------- */
/*                               REUSABLE PARTS                               */
/* -------------------------------------------------------------------------- */
function StatCard({
  title,
  value,
  icon: Icon,
  gradient,
}: {
  title: string
  value: string | number
  icon: typeof FileText
  gradient: string
}) {
  return (
    <Card className={`bg-gradient-to-r ${gradient} border-0 shadow-xl`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-white/80">{title}</CardTitle>
        <Icon className="h-8 w-8 text-white/60" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-white">{value}</div>
      </CardContent>
    </Card>
  )
}

function IconBtn({
  title,
  icon: Icon,
  className = "",
  ...props
}: React.ComponentProps<"button"> & { icon: typeof Eye; title: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={title}
      title={title}
      className={`h-8 w-8 p-0 hover:bg-blue-100 ${className}`}
      {...props}
    >
      <Icon className="h-4 w-4" />
    </Button>
  )
}
