"use client";

import { useState, useEffect } from "react";
import Swal from "sweetalert2";
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
import { Search, Eye, FileText, Calendar, User, Hash, Upload, X, CheckCircle } from 'lucide-react';
import { CommissionReportViewModal } from "@/components/commission-report-view-modal";

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
}

interface UploadedFile {
  id?: string;
  name: string;
  webViewLink?: string;
  webContentLink?: string;
  originalName: string;
  error?: string;
}

export default function CommissionReportsPage() {
  const [reports, setReports] = useState<CommissionReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [selectedReport, setSelectedReport] = useState<CommissionReport | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);

  // State for update status modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusUpdateReport, setStatusUpdateReport] = useState<CommissionReport | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [statusRemark, setStatusRemark] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState("");

  // For Upload Attachments modal
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadReport, setUploadReport] = useState<CommissionReport | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [assignedAreas, setAssignedAreas] = useState<string[]>([]);
  const [assignedAreaFilter, setAssignedAreaFilter] = useState("all");
  const [attachmentsModalOpen, setAttachmentsModalOpen] = useState(false);
  const [selectedAttachmentsReport, setSelectedAttachmentsReport] = useState<CommissionReport | null>(null);

  const statusOptions = [
    { value: "new", label: "New" },
    { value: "ongoing_verification", label: "Ongoing Verification" },
    { value: "for_approval", label: "For Approval" },
    { value: "approved", label: "Approved" },
    { value: "cancelled", label: "Cancelled" },
    { value: "for_testing", label: "For Testing" },
  ];

  const handleOpenUploadModal = (report: CommissionReport) => {
    setUploadReport(report);
    setSelectedFiles([]);
    setUploadError(null);
    setUploadModalOpen(true);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFiles = (files: File[]) => {
    const allowed = files.filter(
      (file) =>
        file.type.startsWith("image/") || file.type === "application/pdf"
    );
    if (allowed.length !== files.length) {
      setUploadError("Only image and PDF files are allowed.");
    } else {
      setUploadError(null);
    }
    setSelectedFiles((prev) => [...prev, ...allowed]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleRemoveFile = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    if (!uploadReport || selectedFiles.length === 0) return;

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });
      formData.append('reportId', uploadReport.uuid);
      formData.append('assigned_area', uploadReport.user_profiles?.assigned_area || 'Unknown');
      formData.append('created_date', uploadReport.created_at);
      formData.append('report_number', uploadReport.report_number?.toString() || '');
      const existingData = uploadReport.accounting_pot ? JSON.parse(uploadReport.accounting_pot) : [];
      formData.append('existing_count', Array.isArray(existingData) ? existingData.length.toString() : '0');

      const response = await fetch('/api/upload-to-s3', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      const successfulUploads = result.files.filter((file: any) => file.url);
      const failedUploads = result.files.filter((file: any) => !file.url);

      if (failedUploads.length > 0) {
        console.warn('Some files failed to upload:', failedUploads);
      }

      if (successfulUploads.length > 0) {
        const fileData = successfulUploads.map((file: any) => ({
          name: file.name,
          url: file.url,
          uploadedAt: new Date().toISOString(),
        }));

        const existingData = uploadReport.accounting_pot
          ? JSON.parse(uploadReport.accounting_pot)
          : [];

        const updatedData = Array.isArray(existingData)
          ? [...existingData, ...fileData]
          : fileData;

        const { error: dbError } = await supabase
          .from('commission_report')
          .update({
            accounting_pot: JSON.stringify(updatedData),
            updated_at: new Date().toISOString()
          })
          .eq('uuid', uploadReport.uuid);

        if (dbError) {
          throw new Error(`Database update failed: ${dbError.message}`);
        }

        setReports(prev => prev.map(report =>
          report.uuid === uploadReport.uuid
            ? { ...report, accounting_pot: JSON.stringify(updatedData) }
            : report
        ));

        await Swal.fire({
          title: 'Success!',
          text: `${successfulUploads.length} file(s) uploaded successfully${failedUploads.length > 0 ? `. ${failedUploads.length} file(s) failed.` : '.'}`,
          icon: 'success',
          confirmButtonColor: '#4284f2',
        });

        setUploadModalOpen(false);
        setSelectedFiles([]);
        setUploadReport(null);
      } else {
        throw new Error('All files failed to upload');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Upload failed');

      await Swal.fire({
        title: 'Upload Failed',
        text: error instanceof Error ? error.message : 'An unknown error occurred',
        icon: 'error',
        confirmButtonColor: '#ee3433',
      });
    } finally {
      setUploading(false);
    }
  };

  // Map frontend value to DB enum value (with spaces, lowercase)
  const statusValueToEnum = (val: string) => {
    switch (val) {
      case "new":
        return "new";
      case "ongoing_verification":
        return "ongoing verification";
      case "for_approval":
        return "for approval";
      case "approved":
        return "approved";
      case "cancelled":
        return "cancelled";
      case "for_testing":
        return "for testing";
      default:
        return val;
    }
  };

  function AttachmentsModal({ report, onClose, onDeleteAttachment }) {
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(5);

    const attachments = report.accounting_pot
      ? JSON.parse(report.accounting_pot)
      : [];
    const total = attachments.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const paged = attachments.slice((page - 1) * perPage, page * perPage);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
        <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6 relative max-h-[90vh] overflow-y-auto border-2 border-blue-200">
          <button
            className="absolute top-3 right-3 text-gray-400 hover:text-red-500"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-lg text-[#001f3f] font-semibold mb-4">
            Attachments By Accounting Department for Report <span className="text-blue-700">#{report.report_number}</span>
          </h2>
          <div className="mb-4 flex justify-between items-center">
            <span className="text-sm text-gray-700">
              Showing <span className="font-semibold text-[#001f3f]">{Math.min((page - 1) * perPage + 1, total)}</span> to <span className="font-semibold text-[#001f3f]">{Math.min(page * perPage, total)}</span> of <span className="font-semibold text-[#001f3f]">{total}</span> files
            </span>
            <div>
              <label className="mr-2 text-sm text-[#001f3f]">Show</label>
              <select
                value={perPage}
                onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
                className="border border-blue-200 rounded px-2 py-1 text-sm text-[#001f3f] bg-white"
              >
                {[5, 10, 25, 50].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span className="ml-2 text-sm text-[#001f3f]">per page</span>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-blue-50 border-b border-blue-200">
                <TableHead className="text-blue-700 font-semibold">#</TableHead>
                <TableHead className="text-blue-700 font-semibold">File Name</TableHead>
                <TableHead className="text-blue-700 font-semibold">Uploaded At</TableHead>
                <TableHead className="text-blue-700 font-semibold text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-400 py-6">
                    No attachments found.
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((file, idx) => (
                  <TableRow
                    key={idx}
                    className="hover:bg-blue-50 transition-colors"
                  >
                    <TableCell className="text-[#001f3f] font-medium">{(page - 1) * perPage + idx + 1}</TableCell>
                    <TableCell className="truncate max-w-xs text-[#001f3f]">{file.name}</TableCell>
                    <TableCell className="text-[#001f3f]">
                      {file.uploadedAt
                        ? new Date(file.uploadedAt).toLocaleString()
                        : ""}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="mr-2 border-blue-400 bg-white text-blue-700 hover:bg-blue-100 hover:text-blue-900"
                        onClick={() => window.open(file.url, "_blank")}
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="border-red-400 text-white hover:bg-red-100 hover:text-red-900"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Are you sure you want to delete this attachment?"
                            )
                          ) {
                            onDeleteAttachment((page - 1) * perPage + idx);
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="flex justify-between items-center mt-4">
            <div className="text-[#001f3f]">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-blue-400 text-blue-700"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-blue-400 text-blue-700"
                disabled={page === totalPages || totalPages === 0}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleOpenStatusModal = (report: CommissionReport) => {
    setStatusUpdateReport(report);
    setNewStatus(report.status);
    setStatusRemark("");
    setStatusModalOpen(true);
    setStatusError("");
  };

  const handleUpdateStatus = async () => {
    if (!statusUpdateReport) return;
    setStatusSaving(true);
    setStatusError("");
    try {
      // Fetch user info (simulate, replace with actual user context if available)
      const user_id =
        (typeof window !== "undefined" && localStorage.getItem("user_id")) ||
        "system";
      const user_name =
        (typeof window !== "undefined" && localStorage.getItem("user_name")) ||
        "System";
      // Prepare new history entry
      const newHistory = Array.isArray(statusUpdateReport.history)
        ? [...statusUpdateReport.history]
        : [];
      newHistory.push({
        action: "status_update",
        remarks: statusRemark,
        user_id,
        user_name,
        timestamp: new Date().toISOString(),
        status: newStatus,
      });
      // Map to DB enum value
      const dbStatus = statusValueToEnum(newStatus);
      // Update status, remarks, and history in DB
      const { error } = await supabase
        .from("commission_report")
        .update({
          status: dbStatus,
          remarks: statusRemark,
          history: newHistory,
        })
        .eq("uuid", statusUpdateReport.uuid);
      if (error) throw error;
      setStatusModalOpen(false);
      // Update local state
      setReports((prev) =>
        prev.map((r) =>
          r.uuid === statusUpdateReport.uuid
            ? {
              ...r,
              status: dbStatus,
              remarks: statusRemark,
              history: newHistory,
            }
            : r
        )
      );
    } catch (err: any) {
      setStatusError("Failed to update status. Please try again.");
    } finally {
      setStatusSaving(false);
    }
  };

  // Fetch commission reports from Supabase
  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);

      let query = supabase
        .from("commission_report")
        .select("*, user_profiles:created_by(full_name,assigned_area)", { count: "exact" })
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      // Filtering
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      // Assigned area filter
      if (assignedAreaFilter !== "all") {
        query = query
          .eq("user_profiles.assigned_area", assignedAreaFilter)
          .neq("user_profiles.assigned_area", null)
          .neq("user_profiles.assigned_area", "");
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
          .select("*, user_profiles:created_by(full_name,assigned_area)")
          .ilike("report_number", `%${searchTerm}%`)
          .is("deleted_at", null);
        const { data: reportsByRemarks } = await supabase
          .from("commission_report")
          .select("*, user_profiles:created_by(full_name,assigned_area)")
          .ilike("remarks", `%${searchTerm}%`)
          .is("deleted_at", null);
        let merged = [...(reportsByNumber || []), ...(reportsByRemarks || [])];
        // Remove duplicates
        merged = merged.filter(
          (v, i, a) => a.findIndex((t) => t.uuid === v.uuid) === i
        );
        // Apply status filter if needed
        if (statusFilter !== "all") {
          merged = merged.filter((r) => r.status === statusFilter);
        }
        // Apply assigned area filter if needed
        if (assignedAreaFilter !== "all") {
          merged = merged.filter(
            (r) =>
              r.user_profiles && // must have a user profile
              r.user_profiles.assigned_area === assignedAreaFilter
          );
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
          assigned_area: r.user_profiles?.assigned_area || "",
        }))
      );

      setLoading(false);
    };

    const fetchAllAreas = async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("assigned_area")
        .neq("assigned_area", null);

      if (!error && data) {
        const allAreas = data
          .map((r: any) => r.assigned_area)
          .filter((v: string | undefined) => v && v.trim() !== "");
        setAssignedAreas(Array.from(new Set(allAreas)));
      }
    };
    fetchAllAreas();
    fetchReports();
  }, [currentPage, recordsPerPage, searchTerm, statusFilter, assignedAreaFilter]);

  // Status badge helper (updated for new statuses)
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

  // Soft delete: set deleted_at to now in the database and remove from visible list after confirmation
  const handleDeleteReport = async (uuid: string) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "This will mark the report as deleted. You can recover it from the database if needed.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return;

    const { error } = await supabase
      .from("commission_report")
      .update({ deleted_at: new Date().toISOString() })
      .eq("uuid", uuid);

    if (error) {
      Swal.fire(
        "Error",
        "Failed to delete the report. Please try again.",
        "error"
      );
      return;
    }

    setReports((prev) => prev.filter((r) => r.uuid !== uuid));
    setTotalRecords((prev) => prev - 1);
    Swal.fire("Deleted!", "The commission report has been deleted.", "success");
  };

  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const startRecord = (currentPage - 1) * recordsPerPage + 1;
  const endRecord = Math.min(currentPage * recordsPerPage, totalRecords);

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
                <h1 className="text-3xl font-bold text-[#001f3f]">
                  Commission Reports
                </h1>
                <p className="text-gray-600">
                  View and manage all commission reports
                </p>
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
                    <SelectItem value="ongoing_verification">
                      Ongoing Verification
                    </SelectItem>
                    <SelectItem value="for_approval">For Approval</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="for_testing">For Testing</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={assignedAreaFilter} onValueChange={setAssignedAreaFilter}>
                  <SelectTrigger className="w-full sm:w-48 border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white text-[#001f3f]">
                    <SelectValue placeholder="Filter by area" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-blue-200 text-[#001f3f]">
                    <SelectItem value="all">All Areas</SelectItem>
                    {assignedAreas.map((area) => (
                      <SelectItem key={area} value={area}>
                        {area}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Data Table */}
          <Card className="bg-white border-2 border-blue-200">
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
                              <Hash className="h-4 w-4" />
                              Report #
                            </div>
                          </TableHead>
                          <TableHead className="text-blue-700 font-semibold border-b border-blue-200">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              Created By
                            </div>
                          </TableHead>
                          <TableHead className="text-blue-700 font-semibold border-b border-blue-200">
                            Assigned Area
                          </TableHead>
                          <TableHead className="text-blue-700 font-semibold border-b border-blue-200">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              Created Date
                            </div>
                          </TableHead>
                          <TableHead className="text-blue-700 font-semibold border-b border-blue-200">
                            Status
                          </TableHead>
                          <TableHead className="text-blue-700 font-semibold border-b border-blue-200">
                            Sales Count
                          </TableHead>
                          <TableHead className="text-blue-700 font-semibold border-b border-blue-200">
                            Attachments (Accounting)
                          </TableHead>
                          <TableHead className="text-blue-700 font-semibold border-b border-blue-200">
                            Remarks
                          </TableHead>
                          <TableHead className="text-center text-blue-700 font-semibold border-b border-blue-200">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reports.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={8}
                              className="text-center py-8 text-gray-400"
                            >
                              No commission reports found
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
                                className="hover:bg-blue-50 border-b border-blue-200"
                              >
                                <TableCell className="text-[#001f3f] font-medium">
                                  #{report.report_number}
                                </TableCell>
                                <TableCell className="text-[#001f3f]">
                                  {report.creator_name}
                                </TableCell>
                                <TableCell className="text-[#001f3f]">
                                  {report.user_profiles?.assigned_area || <span className="text-gray-400">N/A</span>}
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
                                  {getStatusBadge(report.status)}
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
                                      className={attachmentCount > 0 ? "bg-green-600 cursor-pointer hover:bg-green-700" : ""}
                                      onClick={() => {
                                        if (attachmentCount > 0) {
                                          setSelectedAttachmentsReport(report);
                                          setAttachmentsModalOpen(true);
                                        }
                                      }}
                                      style={{ pointerEvents: attachmentCount > 0 ? "auto" : "none" }}
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
                                  <div className="flex gap-1 justify-end flex-wrap">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleViewReport(report)}
                                      className="gap-1 bg-white border-blue-500 text-blue-700 hover:bg-blue-100 hover:border-blue-600 hover:text-blue-900 text-xs px-2 py-1"
                                    >
                                      <Eye className="h-3 w-3" />
                                      View
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="gap-1 bg-white border-blue-500 text-blue-700 hover:bg-blue-100 hover:border-blue-600 hover:text-blue-900 text-xs px-2 py-1"
                                      onClick={() => handleOpenStatusModal(report)}
                                    >
                                      Status
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="gap-1 bg-white border-green-500 text-green-700 hover:bg-green-100 hover:border-green-600 hover:text-green-900 text-xs px-2 py-1"
                                      onClick={() => handleOpenUploadModal(report)}
                                    >
                                      <Upload className="h-3 w-3" />
                                      Upload
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handleDeleteReport(report.uuid)
                                      }
                                      className="gap-1 bg-white border-red-400 text-red-600 hover:bg-red-50 hover:border-red-600 hover:text-red-800 text-xs px-2 py-1"
                                    >
                                      Delete
                                    </Button>
                                  </div>
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
                                  : "cursor-pointer text-blue-700 hover:text-blue-900"
                              }
                            />
                          </PaginationItem>

                          {/* First page */}
                          {currentPage > 2 && (
                            <>
                              <PaginationItem>
                                <PaginationLink
                                  onClick={() => setCurrentPage(1)}
                                  className="cursor-pointer text-blue-700 hover:text-blue-900"
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
                                        ? "cursor-pointer text-blue-900 font-bold"
                                        : "cursor-pointer text-blue-700 hover:text-blue-900"
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
                                  className="cursor-pointer text-blue-700 hover:text-blue-900"
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

      {/* Update Status Modal */}
      {statusUpdateReport && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 ${statusModalOpen ? "" : "hidden"
            }`}
        >
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h2 className="text-lg text-[#001f3f] font-semibold mb-4">
              Update Status
            </h2>
            <div className="mb-4">
              <label className="block text-sm text-[#001f3f] font-medium mb-1">
                Status
              </label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger
                  className="w-full border border-blue-500 focus:border-[#ee3433] focus:ring-2 focus:ring-[#ee3433] bg-white text-[#001f3f] font-semibold rounded shadow-sm"
                  style={{ minHeight: 40 }}
                >
                  <SelectValue
                    className="text-[#001f3f]"
                    placeholder="Select status..."
                  />
                </SelectTrigger>
                <SelectContent className="bg-white border border-blue-500 text-[#001f3f] rounded shadow-lg">
                  {statusOptions.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      className="data-[state=checked]:!bg-[#ee3433] data-[state=checked]:!text-white hover:bg-blue-100 hover:text-[#001f3f] px-3 py-2 cursor-pointer font-medium rounded"
                      style={{ transition: "background 0.2s, color 0.2s" }}
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mb-4">
              <label className="block text-sm text-[#001f3f] font-medium mb-1">
                Remarks
              </label>
              <textarea
                className="w-full text-[#001f3f] border border-gray-300 bg-white rounded p-2"
                rows={3}
                value={statusRemark}
                onChange={(e) => setStatusRemark(e.target.value)}
                placeholder="Enter remarks for this status update..."
              />
            </div>
            {statusError && (
              <div className="text-red-600 text-sm mb-2">{statusError}</div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setStatusModalOpen(false)}
                disabled={statusSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateStatus}
                className="bg-[#4284f2] hover:bg-[#357ae8] text-white"
                disabled={statusSaving || !newStatus}
              >
                {statusSaving ? "Saving..." : "Update Status"}
              </Button>
            </div>
          </div>
        </div>
      )}

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

      {/* Upload Attachments Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-red-500"
              onClick={() => setUploadModalOpen(false)}
              disabled={uploading}
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-lg text-[#001f3f] font-semibold mb-4">
              Upload Attachments
            </h2>

            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-[#001f3f]">
                <strong>Report #{uploadReport?.report_number}</strong>
              </p>
              <p className="text-xs text-gray-600">
                Files will be uploaded to our server and made publicly viewable
              </p>
            </div>

            <div
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 mb-4 transition cursor-pointer ${uploading
                ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
                : 'border-blue-400 bg-blue-50 hover:bg-blue-100'
                }`}
              onDrop={uploading ? undefined : handleDrop}
              onDragOver={uploading ? undefined : (e) => e.preventDefault()}
              onClick={uploading ? undefined : () =>
                document.getElementById("file-upload-input")?.click()
              }
            >
              <Upload className={`h-10 w-10 mb-2 ${uploading ? 'text-gray-400' : 'text-blue-400'}`} />
              <p className={`font-medium mb-1 ${uploading ? 'text-gray-500' : 'text-[#001f3f]'}`}>
                {uploading ? 'Uploading...' : 'Click to select files or drag and drop here'}
              </p>
              <p className="text-xs text-gray-500">
                Only image or PDF files are allowed.
              </p>
              <input
                id="file-upload-input"
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={handleFileInput}
                disabled={uploading}
              />
            </div>

            {uploadError && (
              <div className="text-red-600 text-sm mb-4 p-3 bg-red-50 rounded-lg">
                {uploadError}
              </div>
            )}

            {selectedFiles.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-[#001f3f] font-medium mb-2">
                  Selected Files ({selectedFiles.length}):
                </p>
                <div className="max-h-32 overflow-y-auto">
                  <ul className="space-y-1">
                    {selectedFiles.map((file, idx) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between bg-blue-100 rounded px-3 py-2"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          <span className="truncate text-sm text-[#001f3f]">
                            {file.name}
                          </span>
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            ({(file.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </div>
                        {!uploading && (
                          <button
                            className="ml-2 text-red-500 hover:text-red-700 flex-shrink-0"
                            onClick={() => handleRemoveFile(idx)}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setUploadModalOpen(false)}
                className="border-[#001f3f] bg-white text-[#001f3f]"
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                className="bg-[#4284f2] hover:bg-[#357ae8] text-white"
                disabled={uploading || selectedFiles.length === 0}
              >
                {uploading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Uploading...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Upload Attachments
                  </div>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
      {attachmentsModalOpen && selectedAttachmentsReport && (
        <AttachmentsModal
          report={selectedAttachmentsReport}
          onClose={() => setAttachmentsModalOpen(false)}
          onDeleteAttachment={async (fileIdx) => {
            const attachments = selectedAttachmentsReport.accounting_pot
              ? JSON.parse(selectedAttachmentsReport.accounting_pot)
              : [];
            const fileToDelete = attachments[fileIdx];

            // Extract S3 key from the file URL
            const s3Url = fileToDelete.url;
            const s3Key = s3Url.split(".amazonaws.com/")[1]; // everything after the bucket domain

            // Call API to delete from S3
            await fetch("/api/delete-from-s3", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key: s3Key }),
            });

            // Remove from DB
            const updated = attachments.filter((_, idx) => idx !== fileIdx);
            const { error } = await supabase
              .from("commission_report")
              .update({ accounting_pot: JSON.stringify(updated) })
              .eq("uuid", selectedAttachmentsReport.uuid);

            if (!error) {
              setReports((prev) =>
                prev.map((r) =>
                  r.uuid === selectedAttachmentsReport.uuid
                    ? { ...r, accounting_pot: JSON.stringify(updated) }
                    : r
                )
              );
              setSelectedAttachmentsReport((prev) =>
                prev
                  ? { ...prev, accounting_pot: JSON.stringify(updated) }
                  : prev
              );
            }
          }}
        />
      )}
    </ProtectedRoute>
  );
}
