"use client"

import type React from "react"

import { useState } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DollarSign, FileText, TrendingUp, Users, X, Calendar } from "lucide-react"
import type { SalesRecord, SalesStats, MonthOption } from "@/types/sales"

export default function AdminSalesPage() {
  // Generate 3 years of months from July 2025 backwards
  const generateMonthOptions = (): MonthOption[] => {
    const months = []
    const startDate = new Date(2025, 6, 1) // July 2025 (month is 0-indexed)

    for (let i = 0; i < 36; i++) {
      const date = new Date(startDate.getFullYear(), startDate.getMonth() - i, 1)
      const monthName = date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      const value = date.toISOString().slice(0, 7) // YYYY-MM format

      months.push({
        value,
        label: monthName,
        date,
      })
    }

    return months
  }

  const monthOptions = generateMonthOptions()
  const [selectedMonths, setSelectedMonths] = useState<string[]>(["2025-07"]) // Default to July 2025

  // Mock sales data for Philippine real estate developers
  const mockSalesData: SalesRecord[] = [
    // July 2025
    {
      id: "1",
      tin_number: "123-456-789-000",
      company_name: "Ayala Land Inc.",
      barangay: "Bel-Air",
      city: "Makati City",
      total_sales: 15750000,
      tax_type: "VAT",
      sales_month: "2025-07-01",
      created_at: "2025-07-01T00:00:00Z",
      updated_at: "2025-07-01T00:00:00Z",
    },
    {
      id: "2",
      tin_number: "234-567-890-000",
      company_name: "SM Development Corporation",
      barangay: "Bagumbayan",
      city: "Quezon City",
      total_sales: 12500000,
      tax_type: "VAT",
      sales_month: "2025-07-01",
      created_at: "2025-07-01T00:00:00Z",
      updated_at: "2025-07-01T00:00:00Z",
    },
    {
      id: "3",
      tin_number: "345-678-901-000",
      company_name: "Megaworld Corporation",
      barangay: "Fort Bonifacio",
      city: "Taguig City",
      total_sales: 18900000,
      tax_type: "VAT",
      sales_month: "2025-07-01",
      created_at: "2025-07-01T00:00:00Z",
      updated_at: "2025-07-01T00:00:00Z",
    },
    {
      id: "4",
      tin_number: "456-789-012-000",
      company_name: "Vista Land & Lifescapes Inc.",
      barangay: "Alabang",
      city: "Muntinlupa City",
      total_sales: 8750000,
      tax_type: "Non-VAT",
      sales_month: "2025-07-01",
      created_at: "2025-07-01T00:00:00Z",
      updated_at: "2025-07-01T00:00:00Z",
    },
    {
      id: "5",
      tin_number: "567-890-123-000",
      company_name: "Robinsons Land Corporation",
      barangay: "Ortigas Center",
      city: "Pasig City",
      total_sales: 14200000,
      tax_type: "VAT",
      sales_month: "2025-07-01",
      created_at: "2025-07-01T00:00:00Z",
      updated_at: "2025-07-01T00:00:00Z",
    },

    // June 2025
    {
      id: "6",
      tin_number: "123-456-789-000",
      company_name: "Ayala Land Inc.",
      barangay: "Bel-Air",
      city: "Makati City",
      total_sales: 16200000,
      tax_type: "VAT",
      sales_month: "2025-06-01",
      created_at: "2025-06-01T00:00:00Z",
      updated_at: "2025-06-01T00:00:00Z",
    },
    {
      id: "7",
      tin_number: "234-567-890-000",
      company_name: "SM Development Corporation",
      barangay: "Bagumbayan",
      city: "Quezon City",
      total_sales: 11800000,
      tax_type: "VAT",
      sales_month: "2025-06-01",
      created_at: "2025-06-01T00:00:00Z",
      updated_at: "2025-06-01T00:00:00Z",
    },
    {
      id: "8",
      tin_number: "678-901-234-000",
      company_name: "Federal Land Inc.",
      barangay: "Binondo",
      city: "Manila City",
      total_sales: 9500000,
      tax_type: "Non-VAT",
      sales_month: "2025-06-01",
      created_at: "2025-06-01T00:00:00Z",
      updated_at: "2025-06-01T00:00:00Z",
    },
    {
      id: "9",
      tin_number: "789-012-345-000",
      company_name: "Century Properties Group Inc.",
      barangay: "Poblacion",
      city: "Makati City",
      total_sales: 13400000,
      tax_type: "VAT",
      sales_month: "2025-06-01",
      created_at: "2025-06-01T00:00:00Z",
      updated_at: "2025-06-01T00:00:00Z",
    },
    {
      id: "10",
      tin_number: "890-123-456-000",
      company_name: "Filinvest Land Inc.",
      barangay: "Filinvest",
      city: "Alabang",
      total_sales: 7800000,
      tax_type: "Non-VAT",
      sales_month: "2025-06-01",
      created_at: "2025-06-01T00:00:00Z",
      updated_at: "2025-06-01T00:00:00Z",
    },

    // May 2025
    {
      id: "11",
      tin_number: "345-678-901-000",
      company_name: "Megaworld Corporation",
      barangay: "Fort Bonifacio",
      city: "Taguig City",
      total_sales: 17500000,
      tax_type: "VAT",
      sales_month: "2025-05-01",
      created_at: "2025-05-01T00:00:00Z",
      updated_at: "2025-05-01T00:00:00Z",
    },
    {
      id: "12",
      tin_number: "456-789-012-000",
      company_name: "Vista Land & Lifescapes Inc.",
      barangay: "Alabang",
      city: "Muntinlupa City",
      total_sales: 9200000,
      tax_type: "Non-VAT",
      sales_month: "2025-05-01",
      created_at: "2025-05-01T00:00:00Z",
      updated_at: "2025-05-01T00:00:00Z",
    },
    {
      id: "13",
      tin_number: "567-890-123-000",
      company_name: "Robinsons Land Corporation",
      barangay: "Ortigas Center",
      city: "Pasig City",
      total_sales: 15600000,
      tax_type: "VAT",
      sales_month: "2025-05-01",
      created_at: "2025-05-01T00:00:00Z",
      updated_at: "2025-05-01T00:00:00Z",
    },
    {
      id: "14",
      tin_number: "901-234-567-000",
      company_name: "DMCI Homes",
      barangay: "Acacia Estates",
      city: "Taguig City",
      total_sales: 6900000,
      tax_type: "Non-VAT",
      sales_month: "2025-05-01",
      created_at: "2025-05-01T00:00:00Z",
      updated_at: "2025-05-01T00:00:00Z",
    },
    {
      id: "15",
      tin_number: "012-345-678-000",
      company_name: "Rockwell Land Corporation",
      barangay: "Rockwell Center",
      city: "Makati City",
      total_sales: 21500000,
      tax_type: "VAT",
      sales_month: "2025-05-01",
      created_at: "2025-05-01T00:00:00Z",
      updated_at: "2025-05-01T00:00:00Z",
    },
  ]

  // Filter data based on selected months
  const filteredData = mockSalesData.filter((record) => {
    const recordMonth = record.sales_month.slice(0, 7) // Extract YYYY-MM
    return selectedMonths.includes(recordMonth)
  })

  // Calculate statistics
  const calculateStats = (): SalesStats => {
    const totalGrossTaxable = filteredData.reduce((sum, record) => sum + record.total_sales, 0)
    const totalRecords = filteredData.length
    const vatRecords = filteredData.filter((record) => record.tax_type === "VAT").length
    const nonVatRecords = filteredData.filter((record) => record.tax_type === "Non-VAT").length

    return {
      totalGrossTaxable,
      totalRecords,
      vatRecords,
      nonVatRecords,
    }
  }

  const stats = calculateStats()

  const handleMonthSelect = (monthValue: string) => {
    if (!selectedMonths.includes(monthValue)) {
      setSelectedMonths([...selectedMonths, monthValue])
    }
  }

  const removeMonth = (monthValue: string) => {
    setSelectedMonths(selectedMonths.filter((month) => month !== monthValue))
  }

  const getMonthLabel = (monthValue: string) => {
    const option = monthOptions.find((opt) => opt.value === monthValue)
    return option ? option.label : monthValue
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const StatCard = ({
    icon,
    title,
    value,
    subtitle,
    color,
  }: {
    icon: React.ReactNode
    title: string
    value: string | number
    subtitle: string
    color: "blue" | "green" | "purple" | "orange"
  }) => {
    const colorClasses = {
      blue: "bg-blue-600",
      green: "bg-green-600",
      purple: "bg-purple-600",
      orange: "bg-orange-600",
    }

    const bgColorClasses = {
      blue: "bg-blue-50 border-blue-200",
      green: "bg-green-50 border-green-200",
      purple: "bg-purple-50 border-purple-200",
      orange: "bg-orange-50 border-orange-200",
    }

    return (
      <Card className={`${bgColorClasses[color]} border-2 hover:shadow-md transition-all duration-300 hover:scale-105`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
              <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
              <p className="text-xs text-gray-500">{subtitle}</p>
            </div>
            <div className={`${colorClasses[color]} p-3 rounded-xl text-white shadow-md`}>{icon}</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />

        <div className="pt-20 px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Sales Management</h1>
            <p className="text-gray-600">Track and manage monthly sales records with comprehensive reporting tools.</p>
          </div>

          {/* Month Selection */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Select Months to Display
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-start">
                <Select onValueChange={handleMonthSelect}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select a month..." />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        disabled={selectedMonths.includes(option.value)}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Selected Months */}
                <div className="flex flex-wrap gap-2">
                  {selectedMonths.map((month) => (
                    <Badge key={month} variant="secondary" className="flex items-center gap-1">
                      {getMonthLabel(month)}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-transparent"
                        onClick={() => removeMonth(month)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              icon={<DollarSign className="h-6 w-6" />}
              title="Total Gross Taxable"
              value={formatCurrency(stats.totalGrossTaxable)}
              subtitle="Selected months"
              color="green"
            />
            <StatCard
              icon={<FileText className="h-6 w-6" />}
              title="Total Records"
              value={stats.totalRecords}
              subtitle="Sales entries"
              color="blue"
            />
            <StatCard
              icon={<TrendingUp className="h-6 w-6" />}
              title="VAT Records"
              value={stats.vatRecords}
              subtitle="Taxable sales"
              color="purple"
            />
            <StatCard
              icon={<Users className="h-6 w-6" />}
              title="Non-VAT Records"
              value={stats.nonVatRecords}
              subtitle="Non-taxable sales"
              color="orange"
            />
          </div>

          {/* Sales Table */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>TIN #</TableHead>
                      <TableHead>Company Name</TableHead>
                      <TableHead>Barangay</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead className="text-right">Total Sales</TableHead>
                      <TableHead>Tax Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.length > 0 ? (
                      filteredData.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-mono text-sm">{record.tin_number}</TableCell>
                          <TableCell className="font-medium">{record.company_name}</TableCell>
                          <TableCell>{record.barangay}</TableCell>
                          <TableCell>{record.city}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(record.total_sales)}</TableCell>
                          <TableCell>
                            <Badge
                              variant={record.tax_type === "VAT" ? "default" : "secondary"}
                              className={
                                record.tax_type === "VAT" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                              }
                            >
                              {record.tax_type}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                          No sales records found for the selected months.
                        </TableCell>
                      </TableRow>
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
