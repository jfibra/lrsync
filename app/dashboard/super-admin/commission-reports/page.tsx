"use client"

import { useState, useEffect } from "react"
import Swal from "sweetalert2"
import { supabase } from "@/lib/supabase/client"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Search, Eye, FileText, Calendar, User, Hash } from "lucide-react"
// import { supabase } from "@/lib/supabase/client"
import { CommissionReportViewModal } from "@/components/commission-report-view-modal"

interface CommissionReport {
  uuid: string
  report_number: number
  sales_uuids: string[]
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string
  remarks: string
  status: string
  history: Array<{
    action: string
    remarks: string
    user_id: string
    timestamp: string
    user_name: string
  }>
  creator_name?: string
}

export default function CommissionReportsPage() {
  // Demo/test: use static data
  const [reports, setReports] = useState<CommissionReport[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [recordsPerPage, setRecordsPerPage] = useState(10)
  const [totalRecords, setTotalRecords] = useState(0)
  const [selectedReport, setSelectedReport] = useState<CommissionReport | null>(null)
  const [viewModalOpen, setViewModalOpen] = useState(false)


  // Fetch commission reports from Supabase
  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);

      let query = supabase
        .from("commission_report")
        .select("*, user_profiles:created_by(full_name)", { count: "exact" })
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      // Filtering
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      // Pagination
      const from = (currentPage - 1) * recordsPerPage;
      const to = from + recordsPerPage - 1;
      query = query.range(from, to);

      let data: any[] = [];
      let count = 0;
      let error = null;

      if (searchTerm) {
        // Only filter by report_number or remarks, and deleted_at IS NULL
        const { data: reportsByNumber } = await supabase
          .from("commission_report")
          .select("*, user_profiles:created_by(full_name)")
          .ilike("report_number", `%${searchTerm}%`)
          .is("deleted_at", null);
        const { data: reportsByRemarks } = await supabase
          .from("commission_report")
          .select("*, user_profiles:created_by(full_name)")
          .ilike("remarks", `%${searchTerm}%`)
          .is("deleted_at", null);
        let merged = [...(reportsByNumber || []), ...(reportsByRemarks || [])];
        // Remove duplicates
        merged = merged.filter((v,i,a)=>a.findIndex(t=>(t.uuid === v.uuid))===i);
        // Apply status filter if needed
        if (statusFilter !== "all") {
          merged = merged.filter(r => r.status === statusFilter);
        }
        count = merged.length;
        data = merged.slice(from, from + recordsPerPage);
      } else {
        const result = await query;
        data = result.data || [];
        count = result.count || 0;
        error = result.error;
      }

      if (error) {
        setReports([]);
        setTotalRecords(0);
        setLoading(false);
        return;
      }
      setTotalRecords(count);
      setReports((data || []).map((r: any) => ({
        ...r,
        creator_name: r.user_profiles?.full_name || "",
      })));
      setLoading(false);
    };
    fetchReports();
  }, [currentPage, recordsPerPage, searchTerm, statusFilter]);

  // Status badge helper
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      new: { variant: "secondary" as const, label: "New" },
      processing: { variant: "default" as const, label: "Processing" },
      completed: { variant: "default" as const, label: "Completed" },
      cancelled: { variant: "destructive" as const, label: "Cancelled" },
    }
    const config = statusConfig[status as keyof typeof statusConfig] || { variant: "secondary" as const, label: status }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }


  const handleViewReport = (report: CommissionReport) => {
    setSelectedReport(report)
    setViewModalOpen(true)
  }

  // Soft delete: set deleted_at to now in the database and remove from visible list after confirmation
  const handleDeleteReport = async (uuid: string) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'This will mark the report as deleted. You can recover it from the database if needed.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
    });
    if (!result.isConfirmed) return;

    const { error } = await supabase
      .from("commission_report")
      .update({ deleted_at: new Date().toISOString() })
      .eq("uuid", uuid);

    if (error) {
      Swal.fire('Error', 'Failed to delete the report. Please try again.', 'error');
      return;
    }

    setReports((prev) => prev.filter((r) => r.uuid !== uuid));
    setTotalRecords((prev) => prev - 1);
    Swal.fire('Deleted!', 'The commission report has been deleted.', 'success');
  }

  const totalPages = Math.ceil(totalRecords / recordsPerPage)
  const startRecord = (currentPage - 1) * recordsPerPage + 1
  const endRecord = Math.min(currentPage * recordsPerPage, totalRecords)

  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <div className="min-h-screen bg-white">
        <DashboardHeader />

        <div className="pt-20 px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-2 rounded-lg">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-[#001f3f]">Commission Reports</h1>
                <p className="text-gray-600">View and manage all commission reports</p>
              </div>
            </div>
          </div>

          {/* Filters and Search */}
          <Card className="mb-6 bg-white border-2 border-blue-200">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-500 h-4 w-4" />
                    <Input
                      placeholder="Search by report number or remarks..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white text-[#001f3f] placeholder-gray-400"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48 border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white text-[#001f3f]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-blue-200 text-[#001f3f]">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Data Table */}
          <Card className="bg-white border-2 border-blue-200">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-[#001f3f]">Commission Reports</CardTitle>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Show</span>
                    <Select
                      value={recordsPerPage.toString()}
                      onValueChange={(value) => setRecordsPerPage(Number(value))}
                    >
                      <SelectTrigger className="w-20 border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white text-[#001f3f]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-blue-200 text-[#001f3f]">
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-gray-600">entries</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-blue-50 border-b border-blue-200">
                          <TableHead className="text-blue-700 font-semibold border-b border-blue-200">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              Created By
                            </div>
                          </TableHead>
                          <TableHead className="text-blue-700 font-semibold border-b border-blue-200">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              Created Date
                            </div>
                          </TableHead>
                          <TableHead className="text-blue-700 font-semibold border-b border-blue-200">Status</TableHead>
                          <TableHead className="text-blue-700 font-semibold border-b border-blue-200">Sales Count</TableHead>
                          <TableHead className="text-blue-700 font-semibold border-b border-blue-200">Remarks</TableHead>
                          <TableHead className="text-right text-blue-700 font-semibold border-b border-blue-200">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reports.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                              No commission reports found
                            </TableCell>
                          </TableRow>
                        ) : (
                          reports.map((report) => (
                            <TableRow key={report.uuid} className="hover:bg-blue-50 border-b border-blue-200">
                              <TableCell className="text-[#001f3f]">{report.creator_name}</TableCell>
                              <TableCell className="text-[#001f3f]">
                                {new Date(report.created_at).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </TableCell>
                              <TableCell>{getStatusBadge(report.status)}</TableCell>
                              <TableCell>
                                <Badge className="text-[#001f3f]" variant="outline">{report.sales_uuids?.length || 0} sales</Badge>
                              </TableCell>
                              <TableCell className="max-w-xs truncate text-[#001f3f]">{report.remarks || "No remarks"}</TableCell>
                              <TableCell className="text-right flex gap-2 justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewReport(report)}
                                  className="gap-2 bg-white border-blue-500 text-blue-700 hover:bg-blue-100 hover:border-blue-600 hover:text-blue-900"
                                >
                                  <Eye className="h-4 w-4" />
                                  View
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteReport(report.uuid)}
                                  className="gap-2 bg-white border-red-400 text-red-600 hover:bg-red-50 hover:border-red-600 hover:text-red-800"
                                >
                                  Delete
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination and Record Info */}
                  <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
                    <div className="text-sm text-gray-600">
                      Showing {startRecord} to {endRecord} of {totalRecords} records
                    </div>

                    {totalPages > 1 && (
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                              className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer text-blue-700 hover:text-blue-900"}
                            />
                          </PaginationItem>

                          {/* First page */}
                          {currentPage > 2 && (
                            <>
                              <PaginationItem>
                                <PaginationLink onClick={() => setCurrentPage(1)} className="cursor-pointer text-blue-700 hover:text-blue-900">
                                  1
                                </PaginationLink>
                              </PaginationItem>
                              {currentPage > 3 && <span className="px-2">...</span>}
                            </>
                          )}

                          {/* Current page and neighbors */}
                          {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                            const pageNum = Math.max(1, Math.min(totalPages - 2, currentPage - 1)) + i
                            if (pageNum > totalPages) return null

                            return (
                              <PaginationItem key={pageNum}>
                                <PaginationLink
                                  onClick={() => setCurrentPage(pageNum)}
                                  isActive={pageNum === currentPage}
                                  className={
                                    pageNum === currentPage
                                      ? "cursor-pointer text-blue-900 font-bold"
                                      : "cursor-pointer text-blue-700 hover:text-blue-900"
                                  }
                                >
                                  {pageNum}
                                </PaginationLink>
                              </PaginationItem>
                            )
                          })}

                          {/* Last page */}
                          {currentPage < totalPages - 1 && (
                            <>
                              {currentPage < totalPages - 2 && <span className="px-2">...</span>}
                              <PaginationItem>
                                <PaginationLink onClick={() => setCurrentPage(totalPages)} className="cursor-pointer text-blue-700 hover:text-blue-900">
                                  {totalPages}
                                </PaginationLink>
                              </PaginationItem>
                            </>
                          )}

                          <PaginationItem>
                            <PaginationNext
                              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                              className={
                                currentPage === totalPages
                                  ? "pointer-events-none opacity-50"
                                  : "cursor-pointer text-blue-700 hover:text-blue-900"
                              }
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* View Modal */}
      {selectedReport && (
        <CommissionReportViewModal
          isOpen={viewModalOpen}
          onClose={() => {
            setViewModalOpen(false)
            setSelectedReport(null)
          }}
          report={selectedReport}
        />
      )}
    </ProtectedRoute>
  )
}
