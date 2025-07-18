"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Filter, Download, Eye, Edit, Trash2, FileText, Calendar } from "lucide-react"
import { format } from "date-fns"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase/client"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardHeader } from "@/components/dashboard-header"
import { AddSalesModal } from "@/components/add-sales-modal"
import type { Sales } from "@/types/sales"

export default function SuperAdminSalesPage() {
  const { profile } = useAuth()
  const [sales, setSales] = useState<Sales[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterTaxType, setFilterTaxType] = useState("all") // Updated default value
  const [filterMonth, setFilterMonth] = useState("all") // Updated default value

  // Fetch sales data
  const fetchSales = async () => {
    try {
      setLoading(true)
      let query = supabase
        .from("sales")
        .select(`
          *,
          taxpayer_listings (
            registered_name,
            substreet_street_brgy,
            district_city_zip
          )
        `)
        .order("created_at", { ascending: false })

      // Apply filters
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,tin.ilike.%${searchTerm}%,invoice_number.ilike.%${searchTerm}%`)
      }

      if (filterTaxType !== "all") {
        query = query.eq("tax_type", filterTaxType)
      }

      if (filterMonth !== "all") {
        // Get the start and end of the selected month
        const [year, month] = filterMonth.split("-")
        const startDate = `${year}-${month}-01`
        const endDate = new Date(Number.parseInt(year), Number.parseInt(month), 0).toISOString().split("T")[0] // Last day of month

        query = query.gte("tax_month", startDate).lte("tax_month", endDate)
      }

      const { data, error } = await query

      if (error) throw error
      setSales(data || [])
    } catch (error) {
      console.error("Error fetching sales:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSales()
  }, [searchTerm, filterTaxType, filterMonth])

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount)
  }

  // Format TIN display
  const formatTin = (tin: string) => {
    if (tin.length === 9) {
      return `${tin.slice(0, 3)}-${tin.slice(3, 6)}-${tin.slice(6)}`
    }
    return tin
  }

  // Get tax type badge color
  const getTaxTypeBadgeColor = (taxType: string) => {
    switch (taxType) {
      case "vat":
        return "bg-blue-100 text-blue-800"
      case "non-vat":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  // Generate month options for filter
  const generateMonthOptions = () => {
    const options = []
    const currentDate = new Date()

    for (let i = 0; i < 24; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, "0")
      const monthName = date.toLocaleDateString("en-US", { month: "long", year: "numeric" })

      options.push({
        value: `${year}-${month}`,
        label: monthName,
      })
    }

    return options
  }

  const monthOptions = generateMonthOptions()

  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <div className="min-h-screen bg-gray-50 pt-20">
        <DashboardHeader />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Sales Management</h1>
                <p className="mt-2 text-gray-600">Manage and track sales records and tax filings</p>
              </div>
              <div className="mt-4 sm:mt-0">
                <AddSalesModal onSalesAdded={fetchSales} />
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{sales.length}</div>
                <p className="text-xs text-muted-foreground">Total records</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">VAT Sales</CardTitle>
                <Badge className="bg-blue-100 text-blue-800">VAT</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{sales.filter((s) => s.tax_type === "vat").length}</div>
                <p className="text-xs text-muted-foreground">VAT registered</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Non-VAT Sales</CardTitle>
                <Badge className="bg-green-100 text-green-800">Non-VAT</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{sales.filter((s) => s.tax_type === "non-vat").length}</div>
                <p className="text-xs text-muted-foreground">Non-VAT registered</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(sales.reduce((sum, sale) => sum + (sale.gross_taxable || 0), 0))}
                </div>
                <p className="text-xs text-muted-foreground">Gross taxable</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by name, TIN, or invoice..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={filterTaxType} onValueChange={setFilterTaxType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by tax type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tax Types</SelectItem>
                    <SelectItem value="vat">VAT</SelectItem>
                    <SelectItem value="non-vat">Non-VAT</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {monthOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
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
                  <Filter className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sales Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Sales Records</CardTitle>
                  <CardDescription>{loading ? "Loading..." : `${sales.length} records found`}</CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tax Month</TableHead>
                      <TableHead>TIN</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Tax Type</TableHead>
                      <TableHead>Gross Taxable</TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Pickup Date</TableHead>
                      <TableHead>Files</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                            <span className="ml-2">Loading sales records...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : sales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                          No sales records found
                        </TableCell>
                      </TableRow>
                    ) : (
                      sales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell>{format(new Date(sale.tax_month), "MMM yyyy")}</TableCell>
                          <TableCell className="font-mono">{formatTin(sale.tin)}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{sale.name}</div>
                              {sale.substreet_street_brgy && (
                                <div className="text-sm text-gray-500">{sale.substreet_street_brgy}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getTaxTypeBadgeColor(sale.tax_type)}>
                              {sale.tax_type?.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(sale.gross_taxable || 0)}</TableCell>
                          <TableCell>{sale.invoice_number || "-"}</TableCell>
                          <TableCell>
                            {sale.pickup_date ? format(new Date(sale.pickup_date), "MMM dd, yyyy") : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {sale.cheque && sale.cheque.length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  Cheque ({sale.cheque.length})
                                </Badge>
                              )}
                              {sale.voucher && sale.voucher.length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  Voucher ({sale.voucher.length})
                                </Badge>
                              )}
                              {sale.invoice && sale.invoice.length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  Invoice ({sale.invoice.length})
                                </Badge>
                              )}
                              {sale.doc_2307 && sale.doc_2307.length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  2307 ({sale.doc_2307.length})
                                </Badge>
                              )}
                              {sale.deposit_slip && sale.deposit_slip.length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  Deposit ({sale.deposit_slip.length})
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  )
}
