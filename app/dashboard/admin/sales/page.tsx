"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  FileText,
  Calendar,
  MapPin,
  TrendingUp,
  DollarSign,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase/client";
import { ProtectedRoute } from "@/components/protected-route";
import { DashboardHeader } from "@/components/dashboard-header";
import { AddSalesModal } from "@/components/add-sales-modal";
import { ViewSalesModal } from "@/components/view-sales-modal";
import { EditSalesModal } from "@/components/edit-sales-modal";
import { CustomExportModal } from "@/components/custom-export-modal";
import { ColumnVisibilityControl } from "@/components/column-visibility-control";
import type { Sales } from "@/types/sales";
import * as XLSX from "xlsx";
import { logNotification } from "@/utils/logNotification";
import { formatS3Url } from "@/utils/s3-url";
import { applyTaxMonthFilter, formatDatePeriodLabel } from "@/lib/date-filter";
import { YearSelect, MonthMultiSelect } from "@/components/date-period-filter";

export default function AdminSalesPage() {
  const { profile } = useAuth();
  const [sales, setSales] = useState<Sales[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [filterTaxType, setFilterTaxType] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [filterMonths, setFilterMonths] = useState<string[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [stats, setStats] = useState({
    totalSales: 0,
    vatSales: 0,
    nonVatSales: 0,
    totalAmount: 0,
    totalActualAmount: 0,
  });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sales | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<{ url: string; label: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const isImageFile = (url: string) => {
    const cleanUrl = url.split("?")[0].toLowerCase();
    return [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"].some((ext) => cleanUrl.endsWith(ext));
  };

  const isPdfFile = (url: string) => {
    const cleanUrl = url.split("?")[0].toLowerCase();
    return cleanUrl.endsWith(".pdf");
  };

  function LightboxModal({
    images,
    index,
    onClose,
  }: {
    images: { url: string; label: string }[];
    index: number;
    onClose: () => void;
  }) {
    const [current, setCurrent] = useState(index);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [start, setStart] = useState<{ x: number; y: number } | null>(null);

    const currentImage = images[current];

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "ArrowLeft") {
          setCurrent((prev) => (prev === 0 ? images.length - 1 : prev - 1));
        } else if (e.key === "ArrowRight") {
          setCurrent((prev) => (prev === images.length - 1 ? 0 : prev + 1));
        } else if (e.key === "Escape") {
          onClose();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [images.length, onClose]);

    useEffect(() => {
      setZoom(1);
      setRotation(0);
      setOffset({ x: 0, y: 0 });
    }, [current, index, images]);

    const handleMouseDown = (e: React.MouseEvent) => {
      if (zoom === 1) return;
      setDragging(true);
      setStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    };
    const handleMouseMove = (e: React.MouseEvent) => {
      if (!dragging || zoom === 1) return;
      setOffset({
        x: e.clientX - (start?.x ?? 0),
        y: e.clientY - (start?.y ?? 0),
      });
    };
    const handleMouseUp = () => setDragging(false);

    const handlePrev = () => setCurrent((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    const handleNext = () => setCurrent((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 3));
    const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 1));
    const handleRotate = () => setRotation((r) => r + 90);
    const handleReset = () => {
      setZoom(1);
      setRotation(0);
      setOffset({ x: 0, y: 0 });
    };

    if (!currentImage) return null;

    return (
      <div
        className="fixed inset-0 z-[9999] bg-black bg-opacity-95 overflow-hidden flex items-center justify-center"
        style={{ touchAction: "none" }}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      >
        <button
          className="absolute top-6 right-6 text-white text-3xl z-20"
          onClick={onClose}
          aria-label="Close"
          style={{ lineHeight: 1 }}
        >
          ×
        </button>

        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex gap-2 bg-black bg-opacity-60 rounded-lg px-4 py-2">
          {images.length > 1 && (
            <>
              <button onClick={handlePrev} className="text-white px-2 py-1 rounded hover:bg-gray-700">&lt;</button>
              <button onClick={handleNext} className="text-white px-2 py-1 rounded hover:bg-gray-700">&gt;</button>
            </>
          )}
          <button onClick={handleZoomIn} className="text-white px-2 py-1 rounded hover:bg-gray-700">Zoom In</button>
          <button onClick={handleZoomOut} className="text-white px-2 py-1 rounded hover:bg-gray-700">Zoom Out</button>
          <button onClick={handleRotate} className="text-white px-2 py-1 rounded hover:bg-gray-700">Rotate</button>
          <button onClick={handleReset} className="text-white px-2 py-1 rounded hover:bg-gray-700">Reset</button>
          <a
            href={currentImage.url}
            download
            className="text-white px-2 py-1 rounded hover:bg-gray-700"
            target="_blank"
            rel="noopener noreferrer"
          >
            Download
          </a>
        </div>

        <div className="absolute inset-0 flex items-center justify-center select-none">
          <img
            src={currentImage.url}
            alt={currentImage.label}
            className="max-w-[90vw] max-h-[80vh] object-contain"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              transition: dragging ? "none" : "transform 0.2s",
              cursor: zoom > 1 ? "grab" : "default",
              userSelect: "none",
            }}
            draggable={false}
            onMouseDown={handleMouseDown}
          />
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white bg-black bg-opacity-60 rounded px-3 py-1 z-20 text-sm">
            {currentImage.label} {images.length > 1 && `(${current + 1} of ${images.length})`}
          </div>
        </div>
      </div>
    );
  }

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState([
    { key: "tax_month", label: "Tax Month", visible: true },
    { key: "tin", label: "TIN", visible: true },
    { key: "name", label: "Name", visible: true },
    { key: "tax_type", label: "Tax Type", visible: true },
    { key: "sale_type", label: "Sale Type", visible: true },
    { key: "gross_taxable", label: "Gross Taxable", visible: true },
    {
      key: "total_actual_amount",
      label: "Total Actual Amount",
      visible: false,
    },
    { key: "invoice_number", label: "Invoice #", visible: true },
    { key: "pickup_date", label: "Pickup Date", visible: true },
    { key: "files", label: "Files", visible: true },
    { key: "actions", label: "Actions", visible: true },
  ]);

  // Toggle column visibility
  const toggleColumnVisibility = (key: string) => {
    setColumnVisibility((prev) =>
      prev.map((col) =>
        col.key === key ? { ...col, visible: !col.visible } : col
      )
    );
  };

  // Fetch sales data (server-side range pagination & parallel stats)
  const fetchSales = async () => {
    try {
      setLoading(true);

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      // Get paginated sales data
      let salesQuery = supabase
        .from("sales")
        .select(
          `
          *,
          taxpayer_listings (
            registered_name,
            substreet_street_brgy,
            district_city_zip
          )
        `,
          { count: "exact" }
        )
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .range(from, to);

      // Lightweight stats query
      let statsQuery = supabase
        .from("sales")
        .select("tax_type, gross_taxable, total_actual_amount")
        .eq("is_deleted", false);

      // Apply filters
      if (debouncedSearchTerm) {
        salesQuery = salesQuery.or(
          `name.ilike.%${debouncedSearchTerm}%,tin.ilike.%${debouncedSearchTerm}%,invoice_number.ilike.%${debouncedSearchTerm}%`
        );
        statsQuery = statsQuery.or(
          `name.ilike.%${debouncedSearchTerm}%,tin.ilike.%${debouncedSearchTerm}%,invoice_number.ilike.%${debouncedSearchTerm}%`
        );
      }

      if (filterTaxType !== "all") {
        salesQuery = salesQuery.eq("tax_type", filterTaxType);
        statsQuery = statsQuery.eq("tax_type", filterTaxType);
      }

      // Apply Year & Multi-Month filter
      salesQuery = applyTaxMonthFilter(salesQuery, filterYear, filterMonths);
      statsQuery = applyTaxMonthFilter(statsQuery, filterYear, filterMonths);

      const [salesResult, statsResult] = await Promise.all([
        salesQuery,
        statsQuery,
      ]);

      if (salesResult.error) throw salesResult.error;
      if (statsResult.error) throw statsResult.error;

      const salesData = salesResult.data || [];
      const total = salesResult.count || 0;
      setTotalCount(total);
      setSales(salesData);

      // Calculate stats from lightweight projection
      const statsData = statsResult.data || [];
      let vat = 0;
      let nonVat = 0;
      let amount = 0;
      let actualAmount = 0;
      for (let i = 0; i < statsData.length; i++) {
        const s = statsData[i];
        if (s.tax_type === "vat") vat++;
        else if (s.tax_type === "non-vat") nonVat++;
        amount += s.gross_taxable || 0;
        actualAmount += s.total_actual_amount || 0;
      }
      setStats({
        totalSales: total,
        vatSales: vat,
        nonVatSales: nonVat,
        totalAmount: amount,
        totalActualAmount: actualAmount,
      });
    } catch (error) {
      console.error("Error fetching sales:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [debouncedSearchTerm, filterTaxType, filterYear, filterMonths, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, filterTaxType, filterYear, filterMonths]);

  const totalPages = Math.ceil(totalCount / pageSize);
  const startRecord = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalCount);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }
    return pages;
  };
  const pageNumbers = getPageNumbers();

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount);
  };

  // Format TIN display - add dash after every 3 digits
  const formatTin = (tin: string) => {
    const digits = tin.replace(/\D/g, "");
    return digits.replace(/(\d{3})(?=\d)/g, "$1-");
  };

  // Get tax type badge color
  const getTaxTypeBadgeColor = (taxType: string) => {
    switch (taxType) {
      case "vat":
        return "bg-blue-100 text-blue-800 border border-blue-200";
      case "non-vat":
        return "bg-green-100 text-green-800 border border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border border-gray-200";
    }
  };

  // Handle view sale
  const handleViewSale = (sale: Sales) => {
    setSelectedSale(sale);
    setViewModalOpen(true);
  };

  // Handle edit sale
  const handleEditSale = (sale: Sales) => {
    setSelectedSale(sale);
    setEditModalOpen(true);
  };

  // Handle soft delete
  const handleSoftDelete = async (sale: Sales) => {
    if (
      !confirm(
        `Are you sure you want to delete the sales record for ${sale.name}?`
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase
        .from("sales")
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        })
        .eq("id", sale.id);

      if (error) throw error;

      // Log delete action
      if (profile?.id) {
        logNotification(supabase, {
          action: "delete_sale",
          user_uuid: profile.id,
          user_name: profile.full_name || profile.first_name || profile.id,
          user_email: profile.email,
          description: `Deleted sales record for ${sale.name} (ID: ${sale.id})`,
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
          meta: JSON.stringify({
            user_id: profile.id,
            role: profile.role || "unknown",
            dashboard: "admin_sales",
            sale_id: sale.id,
            sale_name: sale.name,
          }),
        });
      }

      // Refresh the data
      fetchSales();
    } catch (error) {
      console.error("Error deleting sales record:", error);
      alert("Error deleting sales record. Please try again.");
    }
  };

  // Helper to fetch all filtered sales on-demand for export
  const fetchAllFilteredSalesForExport = async () => {
    try {
      let query = supabase
        .from("sales")
        .select(
          `
          *,
          taxpayer_listings (
            registered_name,
            substreet_street_brgy,
            district_city_zip
          )
        `
        )
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(10000);

      if (debouncedSearchTerm) {
        query = query.or(
          `name.ilike.%${debouncedSearchTerm}%,tin.ilike.%${debouncedSearchTerm}%,invoice_number.ilike.%${debouncedSearchTerm}%`
        );
      }
      if (filterTaxType !== "all") {
        query = query.eq("tax_type", filterTaxType);
      }
      query = applyTaxMonthFilter(query, filterYear, filterMonths);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching sales for export:", error);
      return [];
    }
  };

  // Export to Excel function
  const exportToExcel = async () => {
    try {
      setIsExporting(true);
      const exportSales = await fetchAllFilteredSalesForExport();

      // Filter out non-invoice sales for export
      const invoiceSales = exportSales.filter((sale) => sale.sale_type === "invoice");

      // Calculate statistics for invoice sales only
      const totalSales = invoiceSales.length;
      const vatSales = invoiceSales.filter((s) => s.tax_type === "vat").length;
      const nonVatSales = invoiceSales.filter(
        (s) => s.tax_type === "non-vat"
      ).length;
      const totalAmount = invoiceSales.reduce(
        (sum, sale) => sum + (sale.gross_taxable || 0),
        0
      );
      const totalActualAmount = invoiceSales.reduce(
        (sum, sale) => sum + (sale.total_actual_amount || 0),
        0
      );

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Create summary data
      const periodLabel = formatDatePeriodLabel(filterYear, filterMonths);
      const summaryData = [
        [
          `SALES MANAGEMENT REPORT - ${profile?.assigned_area || "Unknown Area"} (${periodLabel}) (Invoice Sales Only)`,
        ],
        [
          "Generated on:",
          new Date().toLocaleDateString("en-PH", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
        ],
        [""],
        ["SUMMARY STATISTICS"],
        ["Total Invoice Sales", totalSales, "Total invoice records"],
        ["VAT Sales", vatSales, "VAT registered"],
        ["Non-VAT Sales", nonVatSales, "Non-VAT registered"],
        [
          "Total Gross Taxable",
          formatCurrency(totalAmount),
          "Gross taxable amount",
        ],
        [
          "Total Actual Amount",
          formatCurrency(totalActualAmount),
          "Total actual amount",
        ],
        [""],
        ["DETAILED SALES RECORDS"],
        [
          "Tax Month",
          "TIN",
          "Name",
          "Address",
          "Tax Type",
          "Sale Type",
          "Gross Taxable",
          "Total Actual Amount",
          "Invoice #",
          "Pickup Date",
          "Files Count",
          "Cheque Files",
          "Voucher Files",
          "Invoice Files",
          "2307 Files",
          "Deposit Files",
        ],
      ];

      // Add invoice sales data only
      invoiceSales.forEach((sale) => {
        const filesCount = [
          ...(sale.cheque || []),
          ...(sale.voucher || []),
          ...(sale.invoice || []),
          ...(sale.doc_2307 || []),
          ...(sale.deposit_slip || []),
        ].length;

        summaryData.push([
          format(new Date(sale.tax_month), "MMM yyyy"),
          formatTin(sale.tin),
          sale.name,
          sale.substreet_street_brgy || "",
          sale.tax_type?.toUpperCase(),
          sale.sale_type?.toUpperCase() || "INVOICE",
          sale.gross_taxable || 0,
          sale.total_actual_amount || 0,
          sale.invoice_number || "",
          sale.pickup_date
            ? format(new Date(sale.pickup_date), "MMM dd, yyyy")
            : "",
          filesCount,
          sale.cheque?.join(", ") || "",
          sale.voucher?.join(", ") || "",
          sale.invoice?.join(", ") || "",
          sale.doc_2307?.join(", ") || "",
          sale.deposit_slip?.join(", ") || "",
        ]);
      });

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(summaryData);

      // Set column widths
      ws["!cols"] = [
        { width: 15 }, // Tax Month
        { width: 15 }, // TIN
        { width: 30 }, // Name
        { width: 25 }, // Address
        { width: 12 }, // Tax Type
        { width: 12 }, // Sale Type
        { width: 15 }, // Gross Taxable
        { width: 15 }, // Total Actual Amount
        { width: 15 }, // Invoice #
        { width: 15 }, // Pickup Date
        { width: 12 }, // Files Count
        { width: 30 }, // Cheque Files
        { width: 30 }, // Voucher Files
        { width: 30 }, // Invoice Files
        { width: 30 }, // 2307 Files
        { width: 30 }, // Deposit Files
      ];

      // Style the header rows
      const headerStyle = {
        font: { bold: true, size: 14 },
        fill: { fgColor: { rgb: "366092" } },
        alignment: { horizontal: "center" },
      };

      const summaryHeaderStyle = {
        font: { bold: true, size: 12 },
        fill: { fgColor: { rgb: "D9E2F3" } },
      };

      // Apply styles to specific cells
      if (ws["A1"])
        ws["A1"].s = {
          font: { bold: true, size: 16 },
          alignment: { horizontal: "center" },
        };
      if (ws["A4"]) ws["A4"].s = summaryHeaderStyle;
      if (ws["A11"]) ws["A11"].s = summaryHeaderStyle;

      // Style the data header row
      for (let col = 0; col < 16; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: 11, c: col });
        if (ws[cellRef]) {
          ws[cellRef].s = {
            font: { bold: true },
            fill: { fgColor: { rgb: "E7E6E6" } },
            alignment: { horizontal: "center" },
          };
        }
      }

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Invoice Sales Report");

      // Generate filename with current date and area
      const filename = `Invoice_Sales_Report_${profile?.assigned_area?.replace(
        /\s+/g,
        "_"
      )}_${new Date().toISOString().split("T")[0]}.xlsx`;

      /* ---- browser-safe download ---- */
      const wbArray = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbArray], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Log export action
      if (profile?.id) {
        logNotification(supabase, {
          action: "export_invoice_sales",
          user_uuid: profile.id,
          user_name: profile.full_name || profile.first_name || profile.id,
          user_email: profile.email,
          description: `Exported invoice sales to Excel (${invoiceSales.length} records)`,
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
          meta: JSON.stringify({
            user_id: profile.id,
            role: profile.role || "unknown",
            dashboard: "admin_sales",
            export_type: "invoice_only",
            record_count: invoiceSales.length,
          }),
        });
      }
    } catch (error) {
      console.error("Export error:", error);
      alert("Error exporting data. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // Summary statistics from server query
  const { totalSales, vatSales, nonVatSales, totalAmount, totalActualAmount } = stats;

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />

        <div className="pt-20 px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                  <BarChart3 className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-gray-900">
                    Sales Management
                  </h1>
                  <p className="text-gray-600 mt-1">
                    Area:{" "}
                    <span className="font-semibold text-indigo-600">
                      {profile?.assigned_area}
                    </span>
                  </p>
                </div>
              </div>
              <div className="mt-4 sm:mt-0">
                <AddSalesModal onSalesAdded={fetchSales} />
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="bg-gradient-to-r from-indigo-500 to-indigo-600 border-0 shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-indigo-100">
                  Total Sales
                </CardTitle>
                <FileText className="h-8 w-8 text-indigo-200" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">
                  {totalSales}
                </div>
                <p className="text-xs text-indigo-100">Total records</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-blue-500 to-blue-600 border-0 shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-100">
                  VAT Sales
                </CardTitle>
                <TrendingUp className="h-8 w-8 text-blue-200" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{vatSales}</div>
                <p className="text-xs text-blue-100">VAT registered</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-green-500 to-green-600 border-0 shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-green-100">
                  Non-VAT Sales
                </CardTitle>
                <BarChart3 className="h-8 w-8 text-green-200" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">
                  {nonVatSales}
                </div>
                <p className="text-xs text-green-100">Non-VAT registered</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-purple-500 to-purple-600 border-0 shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-purple-100">
                  Total Amount
                </CardTitle>
                <DollarSign className="h-8 w-8 text-purple-200" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {formatCurrency(totalAmount)}
                </div>
                <p className="text-xs text-purple-100">Gross taxable</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6 shadow-lg border border-gray-200 bg-white">
            <CardHeader className="bg-gray-50 border-b border-gray-200">
              <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Filter className="h-5 w-5 text-indigo-600" />
                Advanced Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="relative col-span-full sm:col-span-1 lg:col-span-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by name, TIN, or invoice..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900"
                  />
                </div>
                <Select value={filterTaxType} onValueChange={setFilterTaxType}>
                  <SelectTrigger className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900">
                    <SelectValue placeholder="Filter by tax type" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200">
                    <SelectItem
                      value="all"
                      className="text-gray-900 hover:bg-gray-100"
                    >
                      All Tax Types
                    </SelectItem>
                    <SelectItem
                      value="vat"
                      className="text-gray-900 hover:bg-gray-100"
                    >
                      VAT
                    </SelectItem>
                    <SelectItem
                      value="non-vat"
                      className="text-gray-900 hover:bg-gray-100"
                    >
                      Non-VAT
                    </SelectItem>
                  </SelectContent>
                </Select>
                <YearSelect value={filterYear} onValueChange={setFilterYear} />
                <MonthMultiSelect selectedMonths={filterMonths} onMonthsChange={setFilterMonths} selectedYear={filterYear} />
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm("");
                    setFilterTaxType("all");
                    setFilterYear("all");
                    setFilterMonths([]);
                  }}
                  className="w-full border-0 bg-gradient-to-r from-red-500 to-pink-500 text-white font-semibold shadow-md hover:from-red-600 hover:to-pink-600 transition-all duration-150 flex items-center justify-center gap-2"
                >
                  <Filter className="h-4 w-4 mr-1" />
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sales Table */}
          <Card className="shadow-lg border border-gray-200 bg-white">
            <CardHeader className="bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <BarChart3 className="h-6 w-6 text-indigo-600" />
                    Sales Records
                  </CardTitle>
                  <CardDescription className="text-gray-600 mt-1">
                    {loading ? "Loading..." : `${totalCount} records found`}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <ColumnVisibilityControl
                    columns={columnVisibility}
                    onColumnToggle={toggleColumnVisibility}
                  />
                  <CustomExportModal
                    sales={sales}
                    fetchSales={fetchAllFilteredSalesForExport}
                    userArea={profile?.assigned_area}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToExcel}
                    disabled={isExporting}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white border-0 shadow-lg disabled:opacity-50"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {isExporting ? "Exporting..." : "Export (Invoice Only)"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 border-b border-gray-200">
                      {columnVisibility.find((col) => col.key === "tax_month")
                        ?.visible && (
                          <TableHead className="min-w-[120px] font-semibold text-gray-900">
                            Tax Month
                          </TableHead>
                        )}
                      {columnVisibility.find((col) => col.key === "tin")
                        ?.visible && (
                          <TableHead className="min-w-[120px] font-semibold text-gray-900">
                            TIN
                          </TableHead>
                        )}
                      {columnVisibility.find((col) => col.key === "name")
                        ?.visible && (
                          <TableHead className="min-w-[180px] font-semibold text-gray-900">
                            Name
                          </TableHead>
                        )}
                      {columnVisibility.find((col) => col.key === "tax_type")
                        ?.visible && (
                          <TableHead className="min-w-[100px] font-semibold text-gray-900">
                            Tax Type
                          </TableHead>
                        )}
                      {columnVisibility.find((col) => col.key === "sale_type")
                        ?.visible && (
                          <TableHead className="min-w-[100px] font-semibold text-gray-900">
                            Sale Type
                          </TableHead>
                        )}
                      {columnVisibility.find(
                        (col) => col.key === "gross_taxable"
                      )?.visible && (
                          <TableHead className="min-w-[120px] font-semibold text-gray-900">
                            Gross Taxable
                          </TableHead>
                        )}
                      {columnVisibility.find(
                        (col) => col.key === "total_actual_amount"
                      )?.visible && (
                          <TableHead className="min-w-[140px] font-semibold text-gray-900">
                            Total Actual Amount
                          </TableHead>
                        )}
                      {columnVisibility.find(
                        (col) => col.key === "invoice_number"
                      )?.visible && (
                          <TableHead className="min-w-[120px] font-semibold text-gray-900">
                            Invoice #
                          </TableHead>
                        )}
                      {columnVisibility.find((col) => col.key === "pickup_date")
                        ?.visible && (
                          <TableHead className="min-w-[120px] font-semibold text-gray-900">
                            Pickup Date
                          </TableHead>
                        )}
                      {columnVisibility.find((col) => col.key === "files")
                        ?.visible && (
                          <TableHead className="min-w-[150px] font-semibold text-gray-900">
                            Files
                          </TableHead>
                        )}
                      {columnVisibility.find((col) => col.key === "actions")
                        ?.visible && (
                          <TableHead className="min-w-[120px] font-semibold text-gray-900">
                            Actions
                          </TableHead>
                        )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-12">
                          <div className="flex flex-col items-center justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                            <span className="text-gray-600 font-medium">
                              Loading sales records...
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : sales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-12">
                          <BarChart3 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">
                            No sales records found
                          </h3>
                          <p className="text-gray-500">
                            Create your first sales record to get started!
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      sales.map((sale) => (
                        <TableRow
                          key={sale.id}
                          className="hover:bg-gray-50 transition-colors border-b border-gray-100"
                        >
                          {columnVisibility.find(
                            (col) => col.key === "tax_month"
                          )?.visible && (
                              <TableCell className="text-gray-900 font-medium">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-indigo-500" />
                                  {format(new Date(sale.tax_month), "MMM yyyy")}
                                </div>
                              </TableCell>
                            )}
                          {columnVisibility.find((col) => col.key === "tin")
                            ?.visible && (
                              <TableCell className="font-mono text-gray-900">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                                  {formatTin(sale.tin)}
                                </div>
                              </TableCell>
                            )}
                          {columnVisibility.find((col) => col.key === "name")
                            ?.visible && (
                              <TableCell className="text-gray-900">
                                <div>
                                  <div className="font-medium">{sale.name}</div>
                                  {sale.substreet_street_brgy && (
                                    <div className="text-sm text-gray-500 flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {sale.substreet_street_brgy}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            )}
                          {columnVisibility.find(
                            (col) => col.key === "tax_type"
                          )?.visible && (
                              <TableCell>
                                <Badge
                                  className={getTaxTypeBadgeColor(sale.tax_type)}
                                >
                                  {sale.tax_type?.toUpperCase()}
                                </Badge>
                              </TableCell>
                            )}
                          {columnVisibility.find(
                            (col) => col.key === "sale_type"
                          )?.visible && (
                              <TableCell>
                                <Badge
                                  className={
                                    sale.sale_type === "invoice"
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                      : "bg-orange-100 text-orange-800 border border-orange-200"
                                  }
                                >
                                  {sale.sale_type?.toUpperCase() || "INVOICE"}
                                </Badge>
                              </TableCell>
                            )}
                          {columnVisibility.find(
                            (col) => col.key === "gross_taxable"
                          )?.visible && (
                              <TableCell className="text-gray-900 font-semibold">
                                {formatCurrency(sale.gross_taxable || 0)}
                              </TableCell>
                            )}
                          {columnVisibility.find(
                            (col) => col.key === "total_actual_amount"
                          )?.visible && (
                              <TableCell className="text-gray-900 font-semibold">
                                {formatCurrency(sale.total_actual_amount || 0)}
                              </TableCell>
                            )}
                          {columnVisibility.find(
                            (col) => col.key === "invoice_number"
                          )?.visible && (
                              <TableCell className="text-gray-600">
                                {sale.invoice_number || "-"}
                              </TableCell>
                            )}
                          {columnVisibility.find(
                            (col) => col.key === "pickup_date"
                          )?.visible && (
                              <TableCell className="text-gray-600">
                                {sale.pickup_date
                                  ? format(
                                    new Date(sale.pickup_date),
                                    "MMM dd, yyyy"
                                  )
                                  : "-"}
                              </TableCell>
                            )}
                          {columnVisibility.find((col) => col.key === "files")
                            ?.visible && (
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {["cheque", "voucher", "invoice", "doc_2307", "deposit_slip"].map((type) => {
                                    const rawFiles = sale[type as keyof Sales] as any;
                                    let files: string[] = [];
                                    if (Array.isArray(rawFiles)) {
                                      files = rawFiles.filter(Boolean);
                                    } else if (typeof rawFiles === "string" && rawFiles.trim() !== "") {
                                      try {
                                        const parsed = JSON.parse(rawFiles);
                                        files = Array.isArray(parsed) ? parsed.filter(Boolean) : [rawFiles];
                                      } catch {
                                        files = [rawFiles];
                                      }
                                    }
                                    files = files.map((u) => formatS3Url(u));

                                    if (files.length === 0) return null;

                                    const imageFiles = files
                                      .filter(isImageFile)
                                      .map((url, i) => ({
                                        url,
                                        label: `${type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())} ${files.length > 1 ? i + 1 : ""}`.trim(),
                                      }));
                                    const pdfFiles = files.filter(isPdfFile);
                                    const otherFiles = files.filter((url) => !isImageFile(url) && !isPdfFile(url));

                                    return (
                                      <span key={type} className="flex items-center gap-1">
                                        {imageFiles.length > 0 && (
                                          <Badge
                                            variant="outline"
                                            className="text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 px-2 py-1 rounded-lg shadow-sm cursor-pointer hover:bg-blue-100"
                                            onClick={() => {
                                              setLightboxImages(imageFiles);
                                              setLightboxIndex(0);
                                              setLightboxOpen(true);
                                            }}
                                          >
                                            {type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())} ({imageFiles.length})
                                          </Badge>
                                        )}
                                        {pdfFiles.length > 0 && (
                                          <Badge
                                            variant="outline"
                                            className="text-xs font-semibold bg-gray-50 text-gray-800 border border-gray-200 px-2 py-1 rounded-lg shadow-sm cursor-pointer hover:bg-gray-100"
                                            onClick={() => {
                                              pdfFiles.forEach((url) => window.open(url, "_blank"));
                                            }}
                                          >
                                            {type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())} PDF ({pdfFiles.length})
                                          </Badge>
                                        )}
                                        {otherFiles.length > 0 && (
                                          <Badge
                                            variant="outline"
                                            className="text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200 px-2 py-1 rounded-lg shadow-sm cursor-pointer hover:bg-purple-100"
                                            onClick={() => {
                                              otherFiles.forEach((url) => window.open(url, "_blank"));
                                            }}
                                          >
                                            {type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())} ({otherFiles.length})
                                          </Badge>
                                        )}
                                      </span>
                                    );
                                  })}
                                </div>
                              </TableCell>
                            )}
                          {columnVisibility.find((col) => col.key === "actions")
                            ?.visible && (
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleViewSale(sale)}
                                    className="h-8 w-8 p-0 hover:bg-blue-100"
                                  >
                                    <Eye className="h-4 w-4 text-blue-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditSale(sale)}
                                    className="h-8 w-8 p-0 hover:bg-green-100"
                                  >
                                    <Edit className="h-4 w-4 text-green-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSoftDelete(sale)}
                                    className="h-8 w-8 p-0 hover:bg-red-100"
                                  >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6 shadow-lg border border-gray-200 bg-white">
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                {/* Left side - Page size selector and record count */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Show:</span>
                    <Select
                      value={pageSize.toString()}
                      onValueChange={(value) => {
                        setPageSize(Number(value));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-20 h-8 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200">
                        <SelectItem value="10" className="text-gray-900 hover:bg-gray-100">
                          10
                        </SelectItem>
                        <SelectItem value="25" className="text-gray-900 hover:bg-gray-100">
                          25
                        </SelectItem>
                        <SelectItem value="50" className="text-gray-900 hover:bg-gray-100">
                          50
                        </SelectItem>
                        <SelectItem value="100" className="text-gray-900 hover:bg-gray-100">
                          100
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-gray-700">records per page</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Showing {startRecord} to {endRecord} of {totalCount} records
                    {(searchTerm || filterTaxType !== "all" || filterYear !== "all" || filterMonths.length > 0) && ` (filtered)`}
                  </div>
                </div>

                {/* Right side - Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="h-8 px-2 border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="First page"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="h-8 px-2 border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {getPageNumbers().map((pageNum) => (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`h-8 px-3 min-w-[32px] ${
                          currentPage === pageNum
                            ? "bg-indigo-600 text-white hover:bg-indigo-700 border-indigo-600"
                            : "border-gray-300 hover:text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {pageNum}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 px-2 border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="h-8 px-2 border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Last page"
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Modals */}
        {selectedSale && (
          <>
            <ViewSalesModal
              sale={selectedSale}
              open={viewModalOpen}
              onOpenChange={setViewModalOpen}
            />
            <EditSalesModal
              sale={selectedSale}
              open={editModalOpen}
              onOpenChange={setEditModalOpen}
              onSaleUpdated={fetchSales}
            />
          </>
        )}

        {/* Lightbox Modal */}
        {lightboxOpen && (
          <LightboxModal
            images={lightboxImages}
            index={lightboxIndex}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
