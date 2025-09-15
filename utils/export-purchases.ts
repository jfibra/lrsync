import * as XLSX from "xlsx";
import { format } from "date-fns";

// Helper: Format currency
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    amount
  );

// Helper: Format TIN
const formatTin = (tin: string) => {
  const digits = tin.replace(/\D/g, "");
  return digits.replace(/(\d{3})(?=\d)/g, "$1-");
};

// Purchases export function
export const exportPurchasesToExcel = (purchases: any[], profile?: any) => {
  // --- Summary Calculations ---
  const totalPurchases = purchases.length;
  const vatPurchases = purchases.filter((p) => p.tax_type === "vat").length;
  const nonVatPurchases = purchases.filter(
    (p) => p.tax_type === "non-vat"
  ).length;
  const totalGrossTaxable = purchases.reduce(
    (sum, p) => sum + (p.gross_taxable || 0),
    0
  );
  const totalActualAmount = purchases.reduce(
    (sum, p) => sum + (p.total_actual_amount || 0),
    0
  );

  // --- Header & Summary Section ---
  const summaryData = [
    ["PURCHASES MANAGEMENT REPORT"],
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
    [
      "Exported by:",
      profile?.name || profile?.full_name || "Unknown User",
      profile?.email || "",
      profile?.assigned_area || "",
    ],
    [""],
    ["SUMMARY STATISTICS"],
    ["Total Purchases", totalPurchases],
    ["VAT Purchases", vatPurchases],
    ["Non-VAT Purchases", nonVatPurchases],
    ["Total Gross Taxable", formatCurrency(totalGrossTaxable)],
    ["Total Actual Amount", formatCurrency(totalActualAmount)],
    [""],
    ["DETAILED PURCHASE RECORDS"],
    [
      "Tax Month",
      "TIN",
      "Name",
      "Address",
      "Tax Type",
      "Gross Taxable",
      "Total Actual Amount",
      "Invoice #",
      "Category",
      "Files Count",
      "Remark",
      "Date Created",
    ],
  ];

  // --- Detailed Records Section ---
  purchases.forEach((purchase) => {
    const filesCount = Array.isArray(purchase.official_receipt)
      ? purchase.official_receipt.length
      : purchase.official_receipt
      ? 1
      : 0;

    summaryData.push([
      purchase.tax_month
        ? format(new Date(purchase.tax_month), "MMM yyyy")
        : "",
      formatTin(purchase.tin || ""),
      purchase.name || "",
      purchase.substreet_street_brgy || "",
      purchase.tax_type?.toUpperCase() || "",
      purchase.gross_taxable || 0,
      purchase.total_actual_amount || 0,
      purchase.invoice_number || "",
      purchase.category_name || "",
      filesCount,
      purchase.remark || "",
      purchase.created_at
        ? format(new Date(purchase.created_at), "MMM dd, yyyy HH:mm")
        : "",
    ]);
  });

  // --- Create Worksheet & Workbook ---
  const ws = XLSX.utils.aoa_to_sheet(summaryData);

  // --- Set Column Widths ---
  ws["!cols"] = [
    { width: 15 }, // Tax Month
    { width: 15 }, // TIN
    { width: 30 }, // Name
    { width: 25 }, // Address
    { width: 12 }, // Tax Type
    { width: 15 }, // Gross Taxable
    { width: 18 }, // Total Actual Amount
    { width: 15 }, // Invoice #
    { width: 18 }, // Category
    { width: 12 }, // Files Count
    { width: 30 }, // Remark
    { width: 20 }, // Date Created
  ];

  // --- Export File ---
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Purchases Report");
  const filename = `Purchases_Report_${
    new Date().toISOString().split("T")[0]
  }.xlsx`;
  XLSX.writeFile(wb, filename);
};
