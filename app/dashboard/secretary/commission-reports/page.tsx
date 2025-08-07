"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { ProtectedRoute } from "@/components/protected-route";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, Eye, FileText, Calendar, User, Hash, CheckCircle } from 'lucide-react';
import { CommissionReportViewModal } from "@/components/commission-report-view-modal";
import { useAuth } from "@/contexts/auth-context";

interface CommissionReport {
  uuid: string;
  report_number: number;
  sales_uuids: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string;
  remarks: string;
  status: string;
  accounting_pot: string | null;
  history: Array<{
    action: string;
    remarks: string;
    user_id: string;
    timestamp: string;
    user_name: string;
  }>;
  creator_name?: string;
  user_profiles?: {
    full_name: string;
    assigned_area: string;
  };
}

export default function SecretaryCommissionReportsPage() {
  const { profile } = useAuth();
  const [reports, setReports] = useState<CommissionReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [selectedReport, setSelectedReport] = useState<CommissionReport | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);

  const statusOptions = [
    { value: "new", label: "New" },
    { value: "ongoing_verification", label: "Ongoing Verification" },
    { value: "for_approval", label: "For Approval" },
    { value: "approved", label: "Approved" },
    { value: "cancelled", label: "Cancelled" },
    { value: "for_testing", label: "For Testing" },
  ];

  // Fetch commission reports from Supabase - filtered by secretary's assigned area
  useEffect(() => {
    const fetchReports = async () => {
      if (!profile?.assigned_area) {
        setReports([]);
        setTotalRecords(0);
        setLoading(false);
        return;
      }

      setLoading(true);

      let query = supabase
        .from("commission_report")
        .select("*, user_profiles:created_by(full_name,assigned_area)", { count: "exact" })
        .is("deleted_at", null)
        .eq("user_profiles.assigned_area", profile.assigned_area) // Filter by secretary's assigned area
        .order("created_at", { ascending: false });

      // Status filtering
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
        // Search by report_number or remarks, filtered by assigned area
        const { data: reportsByNumber } = await supabase
          .from("commission_report")
          .select("*, user_profiles:created_by(full_name,assigned_area)")
          .ilike("report_number", `%${searchTerm}%`)
          .is("deleted_at", null)
          .eq("user_profiles.assigned_area", profile.assigned_area);
        
        const { data: reportsByRemarks } = await supabase
          .from("commission_report")
          .select("*, user_profiles:created_by(full_name,assigned_area)")
          .ilike("remarks", `%${searchTerm}%`)
          .is("deleted_at", null)
          .eq("user_profiles.assigned_area", profile.assigned_area);
        
        let merged = [...(reportsByNumber || []), ...(reportsByRemarks || [])];
        // Remove duplicates
        merged = merged.filter(
          (v, i, a) => a.findIndex((t) => t.uuid === v.uuid) === i
        );
        
        // Apply status filter if needed
        if (statusFilter !== "all") {
          merged = merged.filter((r) => r.status === statusFilter);
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
      setReports(
        (data || []).map((r: any) => ({
          ...r,
          creator_name: r.user_profiles?.full_name || "",
        }))
      );

      setLoading(false);
    };

    if (profile) {
      fetchReports();
    }
  }, [currentPage, recordsPerPage, searchTerm, statusFilter, profile]);

  // Status badge helper
  const getStatusBadge = (status: string) => {
    const colorMap: Record<
      string,
      { color: string; bg: string; label: string }
    > = {
      new: { color: "#fff", bg: "#6c757d", label: "New" },
      ongoing_verification: {
        color: "#fff",
        bg: "#0074d9",
        label: "Ongoing Verification",
      },
      for_approval: { color: "#fff", bg: "#ff851b", label: "For Approval" },
      approved: { color: "#fff", bg: "#2ecc40", label: "Approved" },
      cancelled: { color: "#fff", bg: "#ee3433", label: "Cancelled" },
      for_testing: { color: "#fff", bg: "#b10dc9", label: "For Testing" },
    };
    const key = (status || "").toLowerCase().replace(/ /g, "_");
    const config = colorMap[key] || {
      color: "#fff",
      bg: "#6c757d",
      label: status,
    };
    return (
      <span
        style={{
          background: config.bg,
          color: config.color,
          borderRadius: 6,
          padding: "2px 10px",
          fontWeight: 500,
          fontSize: 13,
        }}
      >
        {config.label}
      </span>
    );
  };

  const handleViewReport = (report: CommissionReport) => {
    setSelectedReport(report);
    setViewModalOpen(true);
  };

  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const startRecord = (currentPage - 1) * recordsPerPage + 1;
  const endRecord = Math.min(currentPage * recordsPerPage, totalRecords);

  return (
    <ProtectedRoute allowedRoles={["secretary"]}>
      <div className="min-h-screen bg-white">
        <DashboardHeader />

        <div className="pt-20 px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-2 rounded-lg">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-[#001f3f]">
                  Commission Reports - {profile?.assigned_area || "No Area"}
                </h1>
                <p className="text-gray-600">
                  View commission reports from your assigned area
                </p>
              </div>
            </div>
          </div>

          {/* Filters and Search */}
          <Card className="mb-6 bg-white border-2 border-purple-200">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-500 h-4 w-4" />
                    <Input
                      placeholder="Search by report number or remarks..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 border-purple-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 bg-white text-[#001f3f] placeholder-gray-400"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48 border-purple-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 bg-white text-[#001f3f]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-purple-200 text-[#001f3f]">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="ongoing_verification">
                      Ongoing Verification
                    </SelectItem>
                    <SelectItem value="for_approval">For Approval</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="for_testing">For Testing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Data Table */}
          <Card className="bg-white border-2 border-purple-200">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-[#001f3f]">
                  Commission Reports
                </CardTitle>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Show</span>
                    <Select
                      value={recordsPerPage.toString()}
                      onValueChange={(value) =>
                        setRecordsPerPage(Number(value))
                      }
                    >
                      <SelectTrigger className="w-20 border-purple-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 bg-white text-[#001f3f]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-purple-200 text-[#001f3f]">
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
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                </div>
              ) : !profile?.assigned_area ? (
                <div className="text-center py-8">
                  <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No assigned area</h3>
                  <p className="text-gray-500">
                    Please contact your administrator to assign an area to your account.
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-purple-50 border-b border-purple-200">
                          <TableHead className="text-purple-700 font-semibold border-b border-purple-200">
                            <div className="flex items-center gap-2">
                              <Hash className="h-4 w-4" />
                              Report #
                            </div>
                          </TableHead>
                          <TableHead className="text-purple-700 font-semibold border-b border-purple-200">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              Created By
                            </div>
                          </TableHead>
                          <TableHead className="text-purple-700 font-semibold border-b border-purple-200">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              Created Date
                            </div>
                          </TableHead>
                          <TableHead className="text-purple-700 font-semibold border-b border-purple-200">
                            Sales Count
                          </TableHead>
                          <TableHead className="text-purple-700 font-semibold border-b border-purple-200">
                            Attachments (Accounting)
                          </TableHead>
                          <TableHead className="text-purple-700 font-semibold border-b border-purple-200">
                            Remarks
                          </TableHead>
                          <TableHead className="text-center text-purple-700 font-semibold border-b border-purple-200">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reports.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={7}
                              className="text-center py-8 text-gray-400"
                            >
                              No commission reports found for your assigned area: {profile?.assigned_area}
                            </TableCell>
                          </TableRow>
                        ) : (
                          reports.map((report) => {
                            const attachments = report.accounting_pot
                              ? JSON.parse(report.accounting_pot)
                              : [];
                            const attachmentCount = Array.isArray(attachments) ? attachments.length : 0;

                            return (
                              <TableRow
                                key={report.uuid}
                                className="hover:bg-purple-50 border-b border-purple-200"
                              >
                                <TableCell className="text-[#001f3f] font-medium">
                                  #{report.report_number}
                                </TableCell>
                                <TableCell className="text-[#001f3f]">
                                  {report.creator_name}
                                </TableCell>
                                <TableCell className="text-[#001f3f]">
                                  {new Date(report.created_at).toLocaleDateString(
                                    "en-US",
                                    {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    }
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className="text-[#001f3f]"
                                    variant="outline"
                                  >
                                    {report.sales_uuids?.length || 0} sales
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant={attachmentCount > 0 ? "default" : "secondary"}
                                      className={attachmentCount > 0 ? "bg-green-600" : ""}
                                    >
                                      {attachmentCount} files
                                    </Badge>
                                    {attachmentCount > 0 && (
                                      <CheckCircle className="h-4 w-4 text-green-600" />
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="max-w-xs truncate text-[#001f3f]">
                                  {report.remarks || "No remarks"}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleViewReport(report)}
                                    className="gap-1 bg-white border-purple-500 text-purple-700 hover:bg-purple-100 hover:border-purple-600 hover:text-purple-900 text-xs px-2 py-1"
                                  >
                                    <Eye className="h-3 w-3" />
                                    View
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination and Record Info */}
                  <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
                    <div className="text-sm text-gray-600">
                      Showing {startRecord} to {endRecord} of {totalRecords}{" "}
                      records
                    </div>

                    {totalPages > 1 && (
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() =>
                                setCurrentPage(Math.max(1, currentPage - 1))
                              }
                              className={
                                currentPage === 1
                                  ? "pointer-events-none opacity-50"
                                  : "cursor-pointer text-purple-700 hover:text-purple-900"
                              }
                            />
                          </PaginationItem>

                          {/* First page */}
                          {currentPage > 2 && (
                            <>
                              <PaginationItem>
                                <PaginationLink
                                  onClick={() => setCurrentPage(1)}
                                  className="cursor-pointer text-purple-700 hover:text-purple-900"
                                >
                                  1
                                </PaginationLink>
                              </PaginationItem>
                              {currentPage > 3 && (
                                <span className="px-2">...</span>
                              )}
                            </>
                          )}

                          {/* Current page and neighbors */}
                          {Array.from(
                            { length: Math.min(3, totalPages) },
                            (_, i) => {
                              const pageNum =
                                Math.max(
                                  1,
                                  Math.min(totalPages - 2, currentPage - 1)
                                ) + i;
                              if (pageNum > totalPages) return null;

                              return (
                                <PaginationItem key={pageNum}>
                                  <PaginationLink
                                    onClick={() => setCurrentPage(pageNum)}
                                    isActive={pageNum === currentPage}
                                    className={
                                      pageNum === currentPage
                                        ? "cursor-pointer text-purple-900 font-bold"
                                        : "cursor-pointer text-purple-700 hover:text-purple-900"
                                    }
                                  >
                                    {pageNum}
                                  </PaginationLink>
                                </PaginationItem>
                              );
                            }
                          )}

                          {/* Last page */}
                          {currentPage < totalPages - 1 && (
                            <>
                              {currentPage < totalPages - 2 && (
                                <span className="px-2">...</span>
                              )}
                              <PaginationItem>
                                <PaginationLink
                                  onClick={() => setCurrentPage(totalPages)}
                                  className="cursor-pointer text-purple-700 hover:text-purple-900"
                                >
                                  {totalPages}
                                </PaginationLink>
                              </PaginationItem>
                            </>
                          )}

                          <PaginationItem>
                            <PaginationNext
                              onClick={() =>
                                setCurrentPage(
                                  Math.min(totalPages, currentPage + 1)
                                )
                              }
                              className={
                                currentPage === totalPages
                                  ? "pointer-events-none opacity-50"
                                  : "cursor-pointer text-purple-700 hover:text-purple-900"
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
            setViewModalOpen(false);
            setSelectedReport(null);
          }}
          report={selectedReport}
        />
      )}
    </ProtectedRoute>
  );
}
