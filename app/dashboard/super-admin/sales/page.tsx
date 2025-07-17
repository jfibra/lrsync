"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, TrendingUp, FileText, DollarSign, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react'
import { AddSalesModal } from "@/components/add-sales-modal"
import { supabase } from "@/lib/supabase/client"

interface SalesRecord {
  id: string
  tax_month: string
  tin: string
  name: string
  type: string
  substreet_street_brgy?: string
  district_city_zip?: string
  gross_taxable: number
  invoice_number?: string
  tax_type: string
  pickup_date?: string
  created_at: string
  user_full_name: string
}

interface MonthOption {
  label: string
  value: string
}

export default function SuperAdminSalesPage() {
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [entriesPerPage, setEntriesPerPage] = useState(25)

  // Generate month options (36 months from today backward)
  const generateMonthOptions = (): MonthOption[] => {
    const options: MonthOption[] = []
    const currentDate = new Date()

    for (let i = 0; i < 36; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
      const year = date.getFullYear()
      const month = date.getMonth()

      // Get last day of the month
      const lastDay = new Date(year, month + 1, 0).getDate()
      const monthName = date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      const value = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`

      options.push({
        label: monthName,
        value: value,
      })
    }

    return options
  }

  const monthOptions = generateMonthOptions()

  // Format TIN number to 000-000-000
  const formatTinNumber = (tin: string): string => {
    if (!tin) return ""
    
    // Remove any existing dashes and non-digits
    const digits = tin.replace(/\D/g, "")
    
    // Apply formatting
    if (digits.length <= 3) {
      return digits
    } else if (digits.length <= 6) {
      return `${digits.slice(0, 3)}-${digits.slice(3)}`
    } else {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
    }
  }

  // Fetch sales records
  const fetchSalesRecords = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from("sales")
        .select("*")
        .eq("type", "sales")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })

      // Apply month filter if selected
      if (selectedMonths.length > 0) {
        query = query.in("tax_month", selectedMonths)
      }

      const { data, error } = await query

      if (error) throw error
      setSalesRecords(data || [])
    } catch (error) {
      console.error("Error fetching sales records:", error)
      setSalesRecords([])
    } finally {
      setLoading(false)
    }
  }

  // Filter records based on search term
  const filteredRecords = useMemo(() => {
    if (!searchTerm) return salesRecords

    return salesRecords.filter(record =>
      record.tin?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.substreet_street_brgy?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.district_city_zip?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [salesRecords, searchTerm])

  // Pagination calculations
  const totalRecords = filteredRecords.length
  const totalPages = Math.ceil(totalRecords / entriesPerPage)
  const startIndex = (currentPage - 1) * entriesPerPage
  const endIndex = Math.min(startIndex + entriesPerPage, totalRecords)
  const currentRecords = filteredRecords.slice(startIndex, endIndex)

  // Reset to page 1 when search or entries per page changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, entriesPerPage])

  // Statistics calculations
  const statistics = useMemo(() => {
    const totalSales = filteredRecords.reduce((sum, record) => sum + (record.gross_taxable || 0), 0)
    const totalRecordsCount = filteredRecords.length
    const averageSale = totalRecordsCount > 0 ? totalSales / totalRecordsCount : 0
    
    const vatRecords = filteredRecords.filter(record => record.tax_type === 'vat')
    const nonVatRecords = filteredRecords.filter(record => record.tax_type === 'non-vat')
    const vatTotal = vatRecords.reduce((sum, record) => sum + (record.gross_taxable || 0), 0)
    const nonVatTotal = nonVatRecords.reduce((sum, record) => sum + (record.gross_taxable || 0), 0)

    return {
      totalSales,
      totalRecords: totalRecordsCount,
      averageSale,
      vatTotal,
      nonVatTotal,
      vatCount: vatRecords.length,
      nonVatCount: nonVatRecords.length
    }
  }, [filteredRecords])

  // Handle month selection
  const handleMonthToggle = (monthValue: string) => {
    setSelectedMonths(prev => 
      prev.includes(monthValue)
        ? prev.filter(m => m !== monthValue)
        : [...prev, monthValue]
    )
  }

  const clearAllMonths = () => {
    setSelectedMonths([])
  }

  // Pagination handlers
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  const renderPaginationButtons = () => {
    const buttons = []
    const maxVisiblePages = 5
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <Button
          key={i}
          variant={currentPage === i ? "default" : "outline"}
          size="sm"
          onClick={() => goToPage(i)}
          className="mx-1"
        >
          {i}
        </Button>
      )
    }

    return buttons
  }

  useEffect(() => {
    fetchSalesRecords()
  }, [selectedMonths])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Sales Management
            </h1>
            <p className="text-gray-600 mt-2">Manage and track all sales records</p>
          </div>
          <AddSalesModal onSalesAdded={fetchSalesRecords} />
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Sales</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ₱{statistics.totalSales.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-gray-500 mt-1">Current view total</p>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Records</CardTitle>
              <FileText className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{statistics.totalRecords.toLocaleString()}</div>
              <p className="text-xs text-gray-500 mt-1">Sales records found</p>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Average Sale</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                ₱{statistics.averageSale.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-gray-500 mt-1">Per transaction</p>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">VAT vs Non-VAT</CardTitle>
              <BarChart3 className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {statistics.vatCount}:{statistics.nonVatCount}
              </div>
              <p className="text-xs text-gray-500 mt-1">VAT to Non-VAT ratio</p>
            </CardContent>
          </Card>
        </div>

        {/* Month Selection */}
        <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl font-semibold text-gray-800">Filter by Month</CardTitle>
              {selectedMonths.length > 0 && (
                <Button variant="outline" size="sm" onClick={clearAllMonths}>
                  Clear All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {monthOptions.map((month) => (
                <Button
                  key={month.value}
                  variant={selectedMonths.includes(month.value) ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleMonthToggle(month.value)}
                  className={`text-sm ${
                    selectedMonths.includes(month.value)
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                      : "hover:bg-blue-50"
                  }`}
                >
                  {month.label}
                </Button>
              ))}
            </div>
            {selectedMonths.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Label className="text-sm font-medium text-gray-600">Selected:</Label>
                {selectedMonths.map((monthValue) => {
                  const monthLabel = monthOptions.find(m => m.value === monthValue)?.label
                  return (
                    <Badge key={monthValue} variant="secondary" className="bg-blue-100 text-blue-800">
                      {monthLabel}
                    </Badge>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sales Records Table */}
        <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="text-xl font-semibold text-gray-800">Sales Records</CardTitle>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search TIN, company, or location..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <Select value={entriesPerPage.toString()} onValueChange={(value) => setEntriesPerPage(Number(value))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 entries</SelectItem>
                    <SelectItem value="25">25 entries</SelectItem>
                    <SelectItem value="50">50 entries</SelectItem>
                    <SelectItem value="100">100 entries</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading sales records...</span>
              </div>
            ) : currentRecords.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No sales records found</p>
                <p className="text-sm">Try adjusting your search or month filters</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">TIN #</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Company Name</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Location</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Amount</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Tax Type</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Sales Month</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Date Added</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentRecords.map((record) => (
                        <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 font-mono text-sm">{formatTinNumber(record.tin)}</td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-gray-900">{record.name}</div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            <div>{record.substreet_street_brgy}</div>
                            <div className="text-xs text-gray-500">{record.district_city_zip}</div>
                          </td>
                          <td className="py-3 px-4 text-right font-medium">
                            ₱{record.gross_taxable?.toLocaleString('en-PH', { minimumFractionDigits: 2 }) || '0.00'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge variant={record.tax_type === 'vat' ? 'default' : 'secondary'}>
                              {record.tax_type?.toUpperCase() || 'N/A'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-center text-sm">
                            {record.tax_month ? new Date(record.tax_month).toLocaleDateString('en-US', { 
                              month: 'short', 
                              year: 'numeric' 
                            }) : 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-center text-sm text-gray-500">
                            {new Date(record.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
                  <div className="text-sm text-gray-600">
                    Showing {startIndex + 1} to {endIndex} of {totalRecords} entries
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    
                    {renderPaginationButtons()}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Summary Section */}
        <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-gray-800">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  ₱{statistics.totalSales.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-sm text-green-700 mt-1">Total Sales (Current View)</div>
              </div>
              
              <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  ₱{statistics.vatTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-sm text-blue-700 mt-1">VAT Sales Total</div>
              </div>
              
              <div className="text-center p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  ₱{statistics.nonVatTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-sm text-purple-700 mt-1">Non-VAT Sales Total</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
