"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  FileSpreadsheet,
  Calendar,
  MapPin,
  Plus,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import type { Sales } from "@/types/sales";
import * as XLSX from "xlsx";

interface CommissionGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSales: Sales[];
  userArea?: string;
  userFullName?: string;
}

interface SearchResult {
  id: number;
  name: string;
  clientfamilyname: string;
  clientAge: number;
  clientAddress: string;
  clientGender: string;
  clientEmail: string;
  clientMobile: string;
  clientCountry: string;
  unitnum: string;
  developer: string;
  devid: number;
  dev_rental_id: number | null;
  projectname: string;
  projid: number;
  prop_type_id: number;
  qty: number;
  tcprice: number;
  compercent: string;
  reservationdate: string;
  termofpayment: string;
  dateadded: string;
  agentid: number;
  statement_of_account: string | null;
  bir_form_2307: string | null;
  status: string;
  requirements: string | null;
  client_requirements: string | null;
  partialclaimed: string;
  remarks: string;
  broker_com: string;
  deleted: number;
  dateupdated: string;
  files: string;
  userupdate: number;
  unconfirm: number;
  request_file: string | null;
  validSale: string;
  agentuploadpot: number;
  logs: string;
  prop_details: string;
  comm_requested: number;
  comm_requests_history: string | null;
  file_uploaded_to: string | null;
  created_at: string;
  updated_at: string;
}

interface CommissionRecord {
  no: number;
  date: string;
  developer: string;
  agentName: string;
  client: string;
  calculationType: string;
  comm: string;
  netOfVat: string;
  status: string;
  agentsRate: string;
  developersRate: string;
  agent: string;
  vat: string;
  ewt: string;
  netComm: string;
  // UM fields
  umName: string;
  umCalculationType: string;
  umRate: string;
  umDevelopersRate: string;
  umAmount: string;
  umVat: string;
  umEwt: string;
  umNetComm: string;
  // TL fields
  tlName: string;
  tlCalculationType: string;
  tlRate: string;
  tlDevelopersRate: string;
  tlAmount: string;
  tlVat: string;
  tlEwt: string;
  tlNetComm: string;
}

export function CommissionGenerationModal({
  isOpen,
  onClose,
  selectedSales,
  userArea,
  userFullName,
}: CommissionGenerationModalProps) {
  const currentYear = new Date().getFullYear();
  const [searchData, setSearchData] = useState({
    agentName: "",
    developerName: "",
    year: currentYear.toString(),
  });
  const [activeTab, setActiveTab] = useState<string>("");
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
  // Set initial activeTab after groupedByDeveloperAndInvoice is available
  useEffect(() => {
    const firstTab = Object.keys(groupedByDeveloperAndInvoice)[0] || "";
    setActiveTab(firstTab);
  }, [selectedSales]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [commissionRecords, setCommissionRecords] = useState<
    Record<string, CommissionRecord[]>
  >({});
  // For debouncing COMM calculation
  const [commInputTimers, setCommInputTimers] = useState<
    Record<string, NodeJS.Timeout>
  >({});

  // Generate year options (20 years back from current year)
  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = 0; i < 20; i++) {
      years.push(currentYear - i);
    }
    return years;
  };

  const yearOptions = generateYearOptions();

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

  // Group selected sales by developer name and invoice number
  const groupedByDeveloperAndInvoice = selectedSales.reduce((acc, sale) => {
    const developerId = sale.user_uuid;
    const developerName = sale.name || "Unknown Developer";
    const invoiceNumber = sale.invoice_number || "N/A";
    const key = `${developerId}-${invoiceNumber}`;

    if (!acc[key]) {
      acc[key] = {
        developerId,
        developerName,
        invoiceNumber,
        sales: [],
      };
    }
    acc[key].sales.push(sale);
    return acc;
  }, {} as Record<string, { developerId: string; developerName: string; invoiceNumber: string; sales: Sales[] }>);

  // Handle search input changes
  const handleSearchChange = (field: string, value: string) => {
    setSearchData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Track active tab
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  // Perform search
  const handleSearch = async () => {
    if (!searchData.developerName) return;
    setIsSearching(true);
    try {
      const params = new URLSearchParams();
      if (searchData.agentName) params.append("name", searchData.agentName);
      if (searchData.year) params.append("year", searchData.year);
      if (searchData.developerName) {
        params.append("developer", searchData.developerName);
      }
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_NEXT_API_ROUTE_LR}/search-sales-report?${params}`
      );
      if (response.ok) {
        const results = await response.json();
        setSearchResults(results);
      } else {
        console.error("Search failed:", response.statusText);
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Add agent to commission table for specific tab
  const addAgentToTab = (tabKey: string, searchResult: SearchResult) => {
    const newRecord: CommissionRecord = {
      no: (commissionRecords[tabKey]?.length || 0) + 1,
      date: format(new Date(), "yyyy-MM-dd"),
      developer: searchResult.developer,
      agentName: searchResult.name,
      client: searchResult.clientfamilyname,
      calculationType: "nonvat with invoice",
      comm: "",
      netOfVat: "",
      status: "",
      agentsRate: "4.0", // Default to 4.0% as string
      developersRate: "5.0", // Default to 5.0% as string
      agent: "",
      vat: "",
      ewt: "",
      netComm: "",
      umName: "",
      umCalculationType: "nonvat with invoice",
      umRate: "4.0",
      umDevelopersRate: "5.0",
      umAmount: "",
      umVat: "",
      umEwt: "",
      umNetComm: "",
      tlName: "",
      tlCalculationType: "nonvat with invoice",
      tlRate: "4.0",
      tlDevelopersRate: "5.0",
      tlAmount: "",
      tlVat: "",
      tlEwt: "",
      tlNetComm: "",
    };
    setCommissionRecords((prev) => ({
      ...prev,
      [tabKey]: [...(prev[tabKey] || []), newRecord],
    }));
  };

  // Remove agent from commission table
  const removeAgentFromTab = (tabKey: string, index: number) => {
    setCommissionRecords((prev) => {
      const updated = { ...prev };
      updated[tabKey] = [...(updated[tabKey] || [])];
      updated[tabKey].splice(index, 1);
      return updated;
    });
  };

  // Handle commission record field change
  const handleCommissionRecordChange = (
    tabKey: string,
    index: number,
    field: keyof CommissionRecord,
    value: string
  ) => {
    // Debounce calculation for COMM field
    if (field === "comm") {
      setCommissionRecords((prev) => {
        const updated = { ...prev }
        const records = [...(updated[tabKey] || [])]
        records[index] = { ...records[index], [field]: value }
        updated[tabKey] = records
        return updated
      })
      // Clear previous timer
      if (commInputTimers[`${tabKey}-${index}`]) {
        clearTimeout(commInputTimers[`${tabKey}-${index}`])
      }
      const timer = setTimeout(() => {
        doCommissionCalculation(tabKey, index)
      }, 700)
      setCommInputTimers((prev) => ({ ...prev, [`${tabKey}-${index}`]: timer }))
      // Also trigger UM calculation immediately after agent COMM changes
      doCommissionCalculation(tabKey, index)
      return
    }
    setCommissionRecords((prev) => {
      const updated = { ...prev };
      const records = [...(updated[tabKey] || [])];
      records[index] = { ...records[index], [field]: value };
      // If agentsRate, calculationType, UM fields, or TL fields change, recalculate immediately now
      if ([
        "agentsRate",
        "calculationType",
        "umCalculationType",
        "umRate",
        "umDevelopersRate",
        "tlCalculationType",
        "tlRate",
        "tlDevelopersRate"
      ].includes(field)) {
        doCommissionCalculation(tabKey, index, records);
      }
      updated[tabKey] = records;
      return updated;
    });
  };

  // Actual calculation logic, can be called after debounce
  const doCommissionCalculation = (
    tabKey: string,
    index: number,
    recordsOverride?: CommissionRecord[]
  ) => {
    setCommissionRecords((prev) => {
      const updated = { ...prev };
      const records = recordsOverride
        ? [...recordsOverride]
        : [...(updated[tabKey] || [])];
      const record = { ...records[index] };
      const calcType = record.calculationType;
      const comm = Number.parseFloat(record.comm.replace(/,/g, "")) || 0;
      const agentsRate = Number.parseFloat(record.agentsRate) || 0;
      const developersRate = Number.parseFloat(record.developersRate) || 5;
      let netOfVat = "";
      let agent = "";
      let vat = "";
      let ewt = "";
      let netComm = "";
      if (calcType === "nonvat with invoice") {
        netOfVat = comm ? (comm / 1.02).toFixed(2) : "";
        agent =
          netOfVat && agentsRate && developersRate
            ? (
                (Number.parseFloat(netOfVat) * agentsRate) /
                developersRate
              ).toFixed(2)
            : "";
        ewt = agent ? (Number.parseFloat(agent) * 0.05).toFixed(2) : "";
        netComm =
          agent && ewt
            ? (Number.parseFloat(agent) - Number.parseFloat(ewt)).toFixed(2)
            : "";
        vat = "";
      } else if (calcType === "nonvat without invoice") {
        netOfVat = "";
        agent = "";
        vat = "";
        ewt = "";
        netComm =
          comm && agentsRate && developersRate
            ? ((comm * agentsRate) / developersRate).toFixed(2)
            : "";
      } else if (calcType === "vat with invoice") {
        netOfVat = comm ? (comm / 1.02).toFixed(2) : "";
        agent =
          netOfVat && agentsRate && developersRate
            ? (
                (Number.parseFloat(netOfVat) * agentsRate) /
                developersRate
              ).toFixed(2)
            : "";
        vat = agent ? (Number.parseFloat(agent) * 0.12).toFixed(2) : "";
        ewt = agent ? (Number.parseFloat(agent) * 0.1).toFixed(2) : "";
        netComm =
          agent && vat && ewt
            ? (
                Number.parseFloat(agent) +
                Number.parseFloat(vat) -
                Number.parseFloat(ewt)
              ).toFixed(2)
            : "";
      }
      record.netOfVat = netOfVat;
      record.agent = agent;
      record.vat = vat;
      record.ewt = ewt;
      record.netComm = netComm;

      // --- UM calculation ---
      if (record.umCalculationType && record.umRate && record.umDevelopersRate) {
        const umCalcType = record.umCalculationType;
        const umRate = Number.parseFloat(record.umRate) || 0;
        const umDevelopersRate = Number.parseFloat(record.umDevelopersRate) || 5;
        let umAmount = "";
        let umVat = "";
        let umEwt = "";
        let umNetComm = "";
        if (umCalcType === "nonvat with invoice") {
          umAmount = netOfVat && umRate && umDevelopersRate ? ((Number.parseFloat(netOfVat) * umRate) / umDevelopersRate).toFixed(2) : "";
          umEwt = umAmount ? (Number.parseFloat(umAmount) * 0.05).toFixed(2) : "";
          umNetComm = umAmount && umEwt ? (Number.parseFloat(umAmount) - Number.parseFloat(umEwt)).toFixed(2) : "";
          umVat = "";
        } else if (umCalcType === "nonvat without invoice") {
          umAmount = comm && umRate && umDevelopersRate ? ((comm * umRate) / umDevelopersRate).toFixed(2) : "";
          umVat = "";
          umEwt = "";
          umNetComm = umAmount || "";
        } else if (umCalcType === "vat with invoice") {
          umAmount = netOfVat && umRate && umDevelopersRate ? ((Number.parseFloat(netOfVat) * umRate) / umDevelopersRate).toFixed(2) : "";
          umVat = umAmount ? (Number.parseFloat(umAmount) * 0.12).toFixed(2) : "";
          umEwt = umAmount ? (Number.parseFloat(umAmount) * 0.1).toFixed(2) : "";
          umNetComm = umAmount && umVat && umEwt ? (Number.parseFloat(umAmount) + Number.parseFloat(umVat) - Number.parseFloat(umEwt)).toFixed(2) : "";
        }
        record.umAmount = umAmount;
        record.umVat = umVat;
        record.umEwt = umEwt;
        record.umNetComm = umNetComm;
      }

      // --- TL calculation ---
      if (record.tlCalculationType && record.tlRate && record.tlDevelopersRate) {
        const tlCalcType = record.tlCalculationType;
        const tlRate = Number.parseFloat(record.tlRate) || 0;
        const tlDevelopersRate = Number.parseFloat(record.tlDevelopersRate) || 5;
        let tlAmount = "";
        let tlVat = "";
        let tlEwt = "";
        let tlNetComm = "";
        if (tlCalcType === "nonvat with invoice") {
          tlAmount = netOfVat && tlRate && tlDevelopersRate ? ((Number.parseFloat(netOfVat) * tlRate) / tlDevelopersRate).toFixed(2) : "";
          tlEwt = tlAmount ? (Number.parseFloat(tlAmount) * 0.05).toFixed(2) : "";
          tlNetComm = tlAmount && tlEwt ? (Number.parseFloat(tlAmount) - Number.parseFloat(tlEwt)).toFixed(2) : "";
          tlVat = "";
        } else if (tlCalcType === "nonvat without invoice") {
          tlAmount = comm && tlRate && tlDevelopersRate ? ((comm * tlRate) / tlDevelopersRate).toFixed(2) : "";
          tlVat = "";
          tlEwt = "";
          tlNetComm = tlAmount || "";
        } else if (tlCalcType === "vat with invoice") {
          tlAmount = netOfVat && tlRate && tlDevelopersRate ? ((Number.parseFloat(netOfVat) * tlRate) / tlDevelopersRate).toFixed(2) : "";
          tlVat = tlAmount ? (Number.parseFloat(tlAmount) * 0.12).toFixed(2) : "";
          tlEwt = tlAmount ? (Number.parseFloat(tlAmount) * 0.1).toFixed(2) : "";
          tlNetComm = tlAmount && tlVat && tlEwt ? (Number.parseFloat(tlAmount) + Number.parseFloat(tlVat) - Number.parseFloat(tlEwt)).toFixed(2) : "";
        }
        record.tlAmount = tlAmount;
        record.tlVat = tlVat;
        record.tlEwt = tlEwt;
        record.tlNetComm = tlNetComm;
      }

      records[index] = record;
      updated[tabKey] = records;
      return updated;
    });
  };

  // Format number as currency with commas
  const formatNumberWithCommas = (value: string) => {
    const num = value.replace(/,/g, "");
    if (!num) return "";
    const parts = num.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  };

  // Get tax type badge color
  const getTaxTypeBadgeColor = (taxType: string) => {
    switch (taxType) {
      case "vat":
        return "bg-blue-50 text-blue-800 border border-blue-200";
      case "non-vat":
        return "bg-green-50 text-green-800 border border-green-200";
      default:
        return "bg-gray-50 text-gray-800 border border-gray-200";
    }
  };

  // Generate Excel report
  const generateExcelReport = async () => {
    setIsGeneratingExcel(true);
    try {
      // Create a new workbook
      const workbook = XLSX.utils.book_new();

      // Prepare data for the worksheet
      const worksheetData: any[][] = [];

      // Add title
      const title = `Generate Commission ${
        userArea ? `(${userArea})` : ""
      } - ${format(new Date(), "MMMM dd, yyyy")} - ${userFullName || "User"}`;
      worksheetData.push([title]);
      worksheetData.push([]); // Empty row

      // Process each tab (developer/invoice group)
      Object.entries(groupedByDeveloperAndInvoice).forEach(
        ([key, group], groupIndex) => {
          const firstSale = group.sales[0];
          const tabCommissionRecords = commissionRecords[key] || [];

          // Add section title
          worksheetData.push([
            `Sale Record Details - Invoice # ${group.invoiceNumber}`,
          ]);

          // Add sale record details
          worksheetData.push([
            "Tax Month:",
            format(new Date(firstSale.tax_month), "MMM yyyy"),
            "",
            "",
            "Tax Type:",
            firstSale.tax_type?.toUpperCase(),
            "",
            "",
            "Total Actual Amount:",
            firstSale.total_actual_amount || 0,
          ]);

          worksheetData.push([
            "TIN:",
            formatTin(firstSale.tin),
            "",
            "",
            "Sale Type:",
            firstSale.sale_type?.toUpperCase() || "INVOICE",
            "",
            "",
            "Invoice #:",
            firstSale.invoice_number || "N/A",
          ]);

          worksheetData.push([
            "Name:",
            firstSale.name,
            "",
            "",
            "Gross Taxable:",
            firstSale.gross_taxable || 0,
            "",
            "",
            "Pickup Date:",
            firstSale.pickup_date
              ? format(new Date(firstSale.pickup_date), "MMM dd, yyyy")
              : "N/A",
          ]);

          worksheetData.push(["Area:", firstSale.user_assigned_area || "N/A"]);

          worksheetData.push([]); // Empty row

          // Add Commission Records table header (excluding calculation type and developer's rate fields)
          worksheetData.push([
            "NO.",
            "DATE",
            "DEVELOPER",
            "AGENT NAME",
            "CLIENT",
            "COMM",
            "NET OF VAT",
            "STATUS",
            "AGENT'S RATE",
            "AGENT",
            "VAT",
            "EWT",
            "NET COMM",
            "UM NAME",
            "UM RATE",
            "UM AMOUNT",
            "UM VAT",
            "UM EWT",
            "UM NET COMM",
            "TL NAME",
            "TL RATE",
            "TL AMOUNT",
            "TL VAT",
            "TL EWT",
            "TL NET COMM",
          ]);

          // Add commission records
          if (tabCommissionRecords.length > 0) {
            tabCommissionRecords.forEach((record) => {
              worksheetData.push([
                record.no,
                format(new Date(record.date), "MMM dd, yyyy"),
                record.developer,
                record.agentName,
                record.client,
                record.comm,
                record.netOfVat,
                record.status,
                `${record.agentsRate}%`,
                record.agent,
                record.vat,
                record.ewt,
                record.netComm,
                record.umName,
                record.umRate,
                record.umAmount,
                record.umVat,
                record.umEwt,
                record.umNetComm,
                record.tlName,
                record.tlRate,
                record.tlAmount,
                record.tlVat,
                record.tlEwt,
                record.tlNetComm,
              ]);
            });

            // Add combined totals row for Agent, UM, TL
            worksheetData.push([
              "",
              "",
              "",
              "",
              "Totals:",
              // Agent totals
              tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.comm.replace(/,/g, "")) || 0), 0),
              tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.netOfVat) || 0), 0),
              "",
              "",
              tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.agent) || 0), 0),
              tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.vat) || 0), 0),
              tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.ewt) || 0), 0),
              tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.netComm) || 0), 0),
              // UM totals
              "",
              tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.umRate) || 0), 0),
              tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.umAmount) || 0), 0),
              tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.umVat) || 0), 0),
              tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.umEwt) || 0), 0),
              tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.umNetComm) || 0), 0),
              // TL totals
              "",
              tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.tlRate) || 0), 0),
              tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.tlAmount) || 0), 0),
              tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.tlVat) || 0), 0),
              tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.tlEwt) || 0), 0),
              tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.tlNetComm) || 0), 0),
            ]);
          } else {
            // No records message
            worksheetData.push(["No commission records added yet."]);
          }

          // Add blank rows between tabs (except for the last one)
          if (
            groupIndex <
            Object.keys(groupedByDeveloperAndInvoice).length - 1
          ) {
            worksheetData.push([]);
            worksheetData.push([]);
          }
        }
      );

      // Create worksheet from data
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      // Set column widths
      const colWidths = [
        { wch: 8 }, // NO.
        { wch: 12 }, // DATE
        { wch: 15 }, // DEVELOPER
        { wch: 20 }, // AGENT NAME
        { wch: 20 }, // CLIENT
        { wch: 15 }, // COMM
        { wch: 15 }, // NET OF VAT
        { wch: 12 }, // STATUS
        { wch: 12 }, // AGENT'S RATE
        { wch: 15 }, // AGENT
        { wch: 15 }, // VAT
        { wch: 15 }, // EWT
        { wch: 15 }, // NET COMM
      ];
      worksheet["!cols"] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, "Commission Report");

      // Generate Excel file and download
      const fileName = `Commission_Report_${format(
        new Date(),
        "yyyy-MM-dd"
      )}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error("Error generating Excel:", error);
      alert("Failed to generate Excel report. Please try again.");
    } finally {
      setIsGeneratingExcel(false);
    }
  };

  // Clear search results when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchResults([]);
      setCommissionRecords({});
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-hidden bg-white">
        <DialogHeader className="border-b border-gray-200 pb-4">
          <DialogTitle className="text-2xl font-bold text-[#001f3f]">
            Generate Commission {userArea && `(${userArea})`} -{" "}
            {format(new Date(), "MMMM dd, yyyy")} - {userFullName || "User"}
          </DialogTitle>
          <p className="text-[#001f3f] mt-1">
            Commission breakdown for selected developers
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto max-h-[calc(95vh-200px)]">
          {Object.keys(groupedByDeveloperAndInvoice).length === 0 ? (
            <div className="text-center py-12">
              <div className="text-[#001f3f] text-lg font-medium mb-2">
                No developers selected
              </div>
              <div className="text-[#001f3f] text-sm">
                Please select sales records to generate commission reports
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Search Card - Outside of Tabs */}
              <Card className="border border-gray-200 shadow-sm bg-white">
                <CardHeader className="bg-gray-50 border-b border-gray-200 py-3">
                  <CardTitle className="text-lg font-semibold text-[#001f3f] flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    Search Commission Records
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#001f3f] mb-1">
                        Agent Name
                      </label>
                      <Input
                        placeholder="Enter agent name..."
                        value={searchData.agentName}
                        onChange={(e) =>
                          handleSearchChange("agentName", e.target.value)
                        }
                        className="border-gray-300 focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#001f3f] mb-1">
                        Developer Name
                      </label>
                      <Input
                        placeholder="Enter developer name..."
                        value={searchData.developerName || ""}
                        onChange={(e) =>
                          handleSearchChange("developerName", e.target.value)
                        }
                        className="border-gray-300 focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#001f3f] mb-1">
                        Year
                      </label>
                      <Select
                        value={searchData.year}
                        onValueChange={(value) =>
                          handleSearchChange("year", value)
                        }
                      >
                        <SelectTrigger className="border-gray-300 focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] bg-white">
                          <SelectValue
                            placeholder="Select year..."
                            className="text-[#001f3f]"
                          />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="all" className="text-[#001f3f]">
                            All Years
                          </SelectItem>
                          {yearOptions.map((year) => (
                            <SelectItem
                              key={year}
                              value={year.toString()}
                              className="text-[#001f3f]"
                            >
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end gap-2">
                      <Button
                        className="bg-[#001f3f] text-white hover:bg-[#001f3f]/90 w-full"
                        onClick={handleSearch}
                        disabled={isSearching || !searchData.developerName}
                      >
                        {isSearching ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4 mr-2" />
                        )}
                        Search
                      </Button>
                      <Button
                        variant="outline"
                        className="border-[#001f3f] text-white w-full bg-[#001f3f]"
                        onClick={() => setSearchResults([])}
                        disabled={searchResults.length === 0}
                      >
                        Clear Results
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant="outline"
                      className="border-[#001f3f] text-white bg-[#001f3f]"
                      onClick={() =>
                        setSearchData({
                          agentName: "",
                          developerName: "",
                          year: currentYear.toString(),
                        })
                      }
                    >
                      Clear Filters
                    </Button>
                  </div>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="mt-4 border-t border-gray-200 pt-4">
                      <h4 className="text-sm font-medium text-[#001f3f] mb-3">
                        Search Results ({searchResults.length})
                      </h4>
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {searchResults.map((result) => (
                          <div
                            key={result.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-[#001f3f]">
                                  {result.name}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-xs text-[#001f3f]"
                                >
                                  Agent
                                </Badge>
                              </div>
                              <div className="text-sm text-[#001f3f] mt-1">
                                Client: {result.clientfamilyname} | Developer:{" "}
                                {result.developer}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                Project: {result.projectname} | Unit:{" "}
                                {result.unitnum} | TCP:{" "}
                                {formatCurrency(result.tcprice)}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {Object.keys(groupedByDeveloperAndInvoice).map(
                                (tabKey) => (
                                  <Button
                                    key={tabKey}
                                    size="sm"
                                    onClick={() =>
                                      addAgentToTab(tabKey, result)
                                    }
                                    className="bg-[#001f3f] text-white hover:bg-[#001f3f]/90"
                                  >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add to{" "}
                                    {
                                      groupedByDeveloperAndInvoice[tabKey]
                                        .invoiceNumber
                                    }
                                  </Button>
                                )
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isSearching && (
                    <div className="mt-4 text-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#001f3f]" />
                      <p className="text-sm text-[#001f3f] mt-2">
                        Searching...
                      </p>
                    </div>
                  )}

                  {searchResults.length === 0 &&
                    !isSearching &&
                    (searchData.agentName ||
                      searchData.clientName ||
                      searchData.year) && (
                      <div className="mt-4 text-center py-4">
                        <p className="text-sm text-gray-500">
                          No results found. Try adjusting your search criteria.
                        </p>
                      </div>
                    )}
                </CardContent>
              </Card>

              {/* Tabs for Developer/Invoice Combinations */}
              <Tabs
                defaultValue={Object.keys(groupedByDeveloperAndInvoice)[0]}
                className="bg-white"
                value={activeTab}
                onValueChange={handleTabChange}
              >
                <TabsList className="flex flex-row w-full overflow-x-auto bg-gray-50 border border-gray-200 mb-4">
                  {Object.entries(groupedByDeveloperAndInvoice).map(
                    ([key, group]) => (
                      <TabsTrigger
                        key={key}
                        value={key}
                        className="data-[state=active]:bg-[#001f3f] data-[state=active]:text-white text-[#001f3f] font-medium px-4 py-2 bg-white whitespace-nowrap"
                      >
                        Invoice # {group.invoiceNumber} - {group.developerName}
                      </TabsTrigger>
                    )
                  )}
                </TabsList>

                {Object.entries(groupedByDeveloperAndInvoice).map(
                  ([key, group]) => {
                    const tabCommissionRecords = commissionRecords[key] || [];
                    const firstSale = group.sales[0]; // Use first sale for display details

                    return (
                      <TabsContent
                        key={key}
                        value={key}
                        className="mt-0 space-y-4 bg-white"
                      >
                        {/* Sale Record Details Card */}
                        <Card className="border border-gray-200 shadow-sm bg-white">
                          <CardHeader className="bg-gray-50 border-b border-gray-200 py-3">
                            <CardTitle className="text-lg font-semibold text-[#001f3f]">
                              Sale Record Details - Invoice #{" "}
                              {group.invoiceNumber}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-4 bg-white">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-[#001f3f]" />
                                  <span className="text-sm font-medium text-[#001f3f]">
                                    Tax Month:
                                  </span>
                                  <span className="text-sm text-[#001f3f]">
                                    {format(
                                      new Date(firstSale.tax_month),
                                      "MMM yyyy"
                                    )}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-[#001f3f]">
                                    TIN:
                                  </span>
                                  <span className="text-sm font-mono text-[#001f3f]">
                                    {formatTin(firstSale.tin)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-[#001f3f]">
                                    Name:
                                  </span>
                                  <span className="text-sm text-[#001f3f]">
                                    {firstSale.name}
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-[#001f3f]">
                                    Tax Type:
                                  </span>
                                  <Badge
                                    className={getTaxTypeBadgeColor(
                                      firstSale.tax_type
                                    )}
                                  >
                                    {firstSale.tax_type?.toUpperCase()}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-[#001f3f]">
                                    Sale Type:
                                  </span>
                                  <Badge
                                    className={
                                      firstSale.sale_type === "invoice"
                                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                        : "bg-orange-50 text-orange-800 border border-orange-200"
                                    }
                                  >
                                    {firstSale.sale_type?.toUpperCase() ||
                                      "INVOICE"}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-[#001f3f]">
                                    Gross Taxable:
                                  </span>
                                  <span className="text-sm font-semibold text-[#001f3f]">
                                    {formatCurrency(
                                      firstSale.gross_taxable || 0
                                    )}
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-[#001f3f]">
                                    Total Actual Amount:
                                  </span>
                                  <span className="text-sm font-semibold text-[#001f3f]">
                                    {formatCurrency(
                                      firstSale.total_actual_amount || 0
                                    )}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-[#001f3f]">
                                    Invoice #:
                                  </span>
                                  <span className="text-sm text-[#001f3f]">
                                    {firstSale.invoice_number || "N/A"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-[#001f3f]">
                                    Pickup Date:
                                  </span>
                                  <span className="text-sm text-[#001f3f]">
                                    {firstSale.pickup_date
                                      ? format(
                                          new Date(firstSale.pickup_date),
                                          "MMM dd, yyyy"
                                        )
                                      : "N/A"}
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-2 md:col-span-2 lg:col-span-3">
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-[#001f3f]" />
                                  <span className="text-sm font-medium text-[#001f3f]">
                                    Area:
                                  </span>
                                  <span className="text-sm bg-gray-100 px-2 py-1 rounded text-[#001f3f]">
                                    {firstSale.user_assigned_area || "N/A"}
                                  </span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="text-sm font-medium text-[#001f3f]">
                                    Files:
                                  </span>
                                  <div className="flex flex-wrap gap-1">
                                    {firstSale.cheque &&
                                      firstSale.cheque.length > 0 && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 px-2 py-1 rounded-lg shadow-sm"
                                        >
                                          Cheque ({firstSale.cheque.length})
                                        </Badge>
                                      )}
                                    {firstSale.voucher &&
                                      firstSale.voucher.length > 0 && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs font-semibold bg-green-50 text-green-800 border border-green-200 px-2 py-1 rounded-lg shadow-sm"
                                        >
                                          Voucher ({firstSale.voucher.length})
                                        </Badge>
                                      )}
                                    {firstSale.invoice &&
                                      firstSale.invoice.length > 0 && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs font-semibold bg-green-50 text-green-800 border border-green-200 px-2 py-1 rounded-lg shadow-sm"
                                        >
                                          Invoice ({firstSale.invoice.length})
                                        </Badge>
                                      )}
                                    {firstSale.doc_2307 &&
                                      firstSale.doc_2307.length > 0 && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs font-semibold bg-gray-50 text-gray-800 border border-gray-200 px-2 py-1 rounded-lg shadow-sm"
                                        >
                                          2307 ({firstSale.doc_2307.length})
                                        </Badge>
                                      )}
                                    {firstSale.deposit_slip &&
                                      firstSale.deposit_slip.length > 0 && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs font-semibold bg-green-50 text-green-800 border border-green-200 px-2 py-1 rounded-lg shadow-sm"
                                        >
                                          Deposit (
                                          {firstSale.deposit_slip.length})
                                        </Badge>
                                      )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Commission Table */}
                        <Card className="border border-gray-200 shadow-sm bg-white">
                          <CardHeader className="bg-gray-50 border-b border-gray-200 py-3">
                            <CardTitle className="text-lg font-semibold text-[#001f3f]">
                              Commission Records - Invoice #{" "}
                              {group.invoiceNumber}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-0 bg-white">
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-gray-50 border-b border-gray-200">
                                    <TableHead className="font-semibold text-[#001f3f] text-center">
                                      NO.
                                    </TableHead>
                                    <TableHead className="font-semibold text-[#001f3f]">
                                      DATE
                                    </TableHead>
                                    <TableHead className="font-semibold text-[#001f3f]">
                                      DEVELOPER
                                    </TableHead>
                                    <TableHead className="font-semibold text-[#001f3f]">
                                      Agent Name
                                    </TableHead>
                                    <TableHead className="font-semibold text-[#001f3f]">
                                      CLIENT
                                    </TableHead>
                                    <TableHead className="font-semibold bg-[#001f3f] text-white text-center">
                                      Calculation Type
                                    </TableHead>
                                    <TableHead className="font-semibold bg-[#001f3f] text-white text-center">
                                      COMM
                                    </TableHead>
                                    <TableHead className="font-semibold bg-[#001f3f] text-white text-center">
                                      Net of VAT
                                    </TableHead>
                                    <TableHead className="font-semibold bg-[#001f3f] text-white text-center">
                                      STATUS
                                    </TableHead>
                                    <TableHead className="font-semibold bg-[#001f3f] text-white text-center">
                                      AGENT'S RATE
                                    </TableHead>
                                    <TableHead className="font-semibold bg-[#001f3f] text-white text-center">
                                      DEVELOPER'S RATE
                                    </TableHead>
                                    <TableHead className="font-semibold bg-[#001f3f] text-white text-center">
                                      Amount
                                    </TableHead>
                                    <TableHead className="font-semibold bg-[#001f3f] text-white text-center">
                                      VAT
                                    </TableHead>
                                    <TableHead className="font-semibold bg-[#001f3f] text-white text-center">
                                      EWT
                                    </TableHead>
                                    <TableHead className="font-semibold bg-[#001f3f] text-white text-center">
                                      NET COMM
                                    </TableHead>
                                    {/* UM FIELDS */}
                                    <TableHead
                                      className="font-semibold text-white text-center"
                                      style={{ background: "#E34A27" }}
                                    >
                                      Unit Manager Name
                                    </TableHead>
                                    <TableHead
                                      className="font-semibold text-white text-center"
                                      style={{ background: "#E34A27" }}
                                    >
                                      Calculation Type
                                    </TableHead>
                                    <TableHead
                                      className="font-semibold text-white text-center"
                                      style={{ background: "#E34A27" }}
                                    >
                                      UM Rate
                                    </TableHead>
                                    <TableHead
                                      className="font-semibold text-white text-center"
                                      style={{ background: "#E34A27" }}
                                    >
                                      Developers Rate
                                    </TableHead>
                                    <TableHead
                                      className="font-semibold text-white text-center"
                                      style={{ background: "#E34A27" }}
                                    >
                                      Amount
                                    </TableHead>
                                    <TableHead
                                      className="font-semibold text-white text-center"
                                      style={{ background: "#E34A27" }}
                                    >
                                      VAT
                                    </TableHead>
                                    <TableHead
                                      className="font-semibold text-white text-center"
                                      style={{ background: "#E34A27" }}
                                    >
                                      EWT
                                    </TableHead>
                                    <TableHead
                                      className="font-semibold text-white text-center"
                                      style={{ background: "#E34A27" }}
                                    >
                                      NET COMM
                                    </TableHead>
                                    {/* TL FIELDS */}
                                    <TableHead
                                      className="font-semibold text-[#001f3f] text-center"
                                      style={{ background: "#FEEFC6" }}
                                    >
                                      Team Leader Name
                                    </TableHead>
                                    <TableHead
                                      className="font-semibold text-[#001f3f] text-center"
                                      style={{ background: "#FEEFC6" }}
                                    >
                                      Calculation Type
                                    </TableHead>
                                    <TableHead
                                      className="font-semibold text-[#001f3f] text-center"
                                      style={{ background: "#FEEFC6" }}
                                    >
                                      UM Rate
                                    </TableHead>
                                    <TableHead
                                      className="font-semibold text-[#001f3f] text-center"
                                      style={{ background: "#FEEFC6" }}
                                    >
                                      Developers Rate
                                    </TableHead>
                                    <TableHead
                                      className="font-semibold text-[#001f3f] text-center"
                                      style={{ background: "#FEEFC6" }}
                                    >
                                      Amount
                                    </TableHead>
                                    <TableHead
                                      className="font-semibold text-[#001f3f] text-center"
                                      style={{ background: "#FEEFC6" }}
                                    >
                                      VAT
                                    </TableHead>
                                    <TableHead
                                      className="font-semibold text-[#001f3f] text-center"
                                      style={{ background: "#FEEFC6" }}
                                    >
                                      EWT
                                    </TableHead>
                                    <TableHead
                                      className="font-semibold text-[#001f3f] text-center"
                                      style={{ background: "#FEEFC6" }}
                                    >
                                      NET COMM
                                    </TableHead>
                                    <TableHead className="font-semibold text-[#ee3433] text-center">
                                      Actions
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody className="bg-white">
                                  {tabCommissionRecords.length > 0 ? (
                                    <>
                                      {tabCommissionRecords.map(
                                        (record, index) => (
                                          <TableRow
                                            key={index}
                                            className="border-b border-gray-100 hover:bg-gray-50"
                                          >
                                            <TableCell className="text-center font-medium text-[#001f3f]">
                                              {record.no}
                                            </TableCell>
                                            <TableCell className="text-[#001f3f]">
                                              {format(
                                                new Date(record.date),
                                                "MMM dd, yyyy"
                                              )}
                                            </TableCell>
                                            <TableCell className="font-medium text-[#001f3f]">
                                              {record.developer}
                                            </TableCell>
                                            <TableCell className="text-[#001f3f]">
                                              {record.agentName}
                                            </TableCell>
                                            <TableCell className="text-[#001f3f]">
                                              {record.client}
                                            </TableCell>
                                            {/* Calculation Type Dropdown */}
                                            <TableCell className="bg-[#a0d9ef]">
                                              <select
                                                className="border border-gray-300 rounded px-2 py-1 text-[#001f3f] bg-white"
                                                value={record.calculationType}
                                                onChange={(e) =>
                                                  handleCommissionRecordChange(
                                                    key,
                                                    index,
                                                    "calculationType",
                                                    e.target.value
                                                  )
                                                }
                                              >
                                                <option value="nonvat with invoice">
                                                  nonvat with invoice
                                                </option>
                                                <option value="nonvat without invoice">
                                                  nonvat without invoice
                                                </option>
                                                <option value="vat with invoice">
                                                  vat with invoice
                                                </option>
                                              </select>
                                            </TableCell>
                                            {/* COMM input */}
                                            <TableCell className="text-right font-semibold text-[#001f3f] bg-[#a0d9ef]">
                                              <input
                                                type="text"
                                                inputMode="decimal"
                                                className="border border-gray-300 rounded px-2 py-1 w-24 text-right text-[#001f3f] bg-white"
                                                value={record.comm}
                                                onChange={(e) => {
                                                  // Only allow numbers and commas
                                                  let val =
                                                    e.target.value.replace(
                                                      /[^\d.,]/g,
                                                      ""
                                                    );
                                                  // Format as currency
                                                  val =
                                                    formatNumberWithCommas(val);
                                                  handleCommissionRecordChange(
                                                    key,
                                                    index,
                                                    "comm",
                                                    val
                                                  );
                                                }}
                                                placeholder="0.00"
                                              />
                                            </TableCell>
                                            {/* Net of VAT */}
                                            <TableCell className="text-right font-semibold text-[#001f3f] bg-[#a0d9ef]">
                                              {record.netOfVat
                                                ? formatCurrency(
                                                    Number(record.netOfVat)
                                                  )
                                                : ""}
                                            </TableCell>
                                            {/* Status input */}
                                            <TableCell className="text-center bg-[#a0d9ef]">
                                              <input
                                                type="text"
                                                className="border border-gray-300 rounded px-2 py-1 w-20 text-center text-[#001f3f] bg-white"
                                                value={record.status}
                                                onChange={(e) =>
                                                  handleCommissionRecordChange(
                                                    key,
                                                    index,
                                                    "status",
                                                    e.target.value
                                                  )
                                                }
                                                placeholder="Status"
                                              />
                                            </TableCell>
                                            {/* Agent's Rate dropdown */}
                                            <TableCell className="text-center font-medium text-[#dee242] bg-[#a0d9ef]">
                                              <select
                                                className="border border-gray-300 rounded px-2 py-1 text-[#001f3f] bg-white"
                                                value={record.agentsRate}
                                                onChange={(e) => {
                                                  handleCommissionRecordChange(
                                                    key,
                                                    index,
                                                    "agentsRate",
                                                    e.target.value
                                                  );
                                                  // Trigger recalculation when agent's rate changes
                                                  doCommissionCalculation(
                                                    key,
                                                    index
                                                  );
                                                }}
                                              >
                                                {[...Array(14)].map((_, i) => {
                                                  const rate = (
                                                    0.5 +
                                                    i * 0.5
                                                  ).toFixed(1);
                                                  return (
                                                    <option
                                                      key={rate}
                                                      value={rate}
                                                    >
                                                      {rate}%
                                                    </option>
                                                  );
                                                })}
                                              </select>
                                            </TableCell>
                                            {/* Developer's Rate dropdown */}
                                            <TableCell className="text-center font-medium text-[#dee242] bg-[#a0d9ef]">
                                              <select
                                                className="border border-gray-300 rounded px-2 py-1 text-[#001f3f] bg-white"
                                                value={record.developersRate}
                                                onChange={(e) => {
                                                  handleCommissionRecordChange(
                                                    key,
                                                    index,
                                                    "developersRate",
                                                    e.target.value
                                                  );
                                                  // Trigger recalculation when developer's rate changes
                                                  doCommissionCalculation(
                                                    key,
                                                    index
                                                  );
                                                }}
                                              >
                                                {[...Array(17)].map((_, i) => {
                                                  const rate = (
                                                    1 +
                                                    i * 0.5
                                                  ).toFixed(1);
                                                  return (
                                                    <option
                                                      key={rate}
                                                      value={rate}
                                                    >
                                                      {rate}%
                                                    </option>
                                                  );
                                                })}
                                              </select>
                                            </TableCell>
                                            {/* AGENT */}
                                            <TableCell className="text-right font-semibold text-[#001f3f] bg-[#a0d9ef]">
                                              {record.agent
                                                ? formatCurrency(
                                                    Number(record.agent)
                                                  )
                                                : ""}
                                            </TableCell>
                                            {/* VAT */}
                                            <TableCell className="text-right font-semibold text-[#001f3f] bg-[#a0d9ef]">
                                              {record.vat
                                                ? formatCurrency(
                                                    Number(record.vat)
                                                  )
                                                : ""}
                                            </TableCell>
                                            {/* EWT */}
                                            <TableCell className="text-right font-semibold text-[#ee3433] bg-[#a0d9ef]">
                                              {record.ewt
                                                ? formatCurrency(
                                                    Number(record.ewt)
                                                  )
                                                : ""}
                                            </TableCell>
                                            {/* Net Comm */}
                                            <TableCell className="text-right font-bold text-white bg-[#a0d9ef]">
                                              {record.netComm
                                                ? formatCurrency(
                                                    Number(record.netComm)
                                                  )
                                                : ""}
                                            </TableCell>
                                            {/* UM FIELDS - #E34A27 */}
                                            <TableCell
                                              className="text-[#fff] font-semibold"
                                              style={{ background: "#E34A27" }}
                                            >
                                              <input
                                                type="text"
                                                className="border border-gray-300 rounded px-2 py-1 w-28 text-[#E34A27] bg-white font-bold"
                                                value={record.umName}
                                                onChange={(e) =>
                                                  handleCommissionRecordChange(
                                                    key,
                                                    index,
                                                    "umName",
                                                    e.target.value
                                                  )
                                                }
                                                placeholder="UM Name"
                                              />
                                            </TableCell>
                                            <TableCell
                                              className="text-center font-semibold"
                                              style={{ background: "#E34A27" }}
                                            >
                                              <select
                                                className="border border-gray-300 rounded px-2 py-1 text-[#E34A27] bg-white font-bold"
                                                value={record.umCalculationType}
                                                onChange={(e) =>
                                                  handleCommissionRecordChange(
                                                    key,
                                                    index,
                                                    "umCalculationType",
                                                    e.target.value
                                                  )
                                                }
                                              >
                                                <option value="nonvat with invoice">
                                                  nonvat with invoice
                                                </option>
                                                <option value="nonvat without invoice">
                                                  nonvat without invoice
                                                </option>
                                                <option value="vat with invoice">
                                                  vat with invoice
                                                </option>
                                              </select>
                                            </TableCell>
                                            <TableCell
                                              className="text-center font-semibold"
                                              style={{ background: "#E34A27" }}
                                            >
                                              <select
                                                className="border border-gray-300 rounded px-2 py-1 text-[#E34A27] bg-white font-bold"
                                                value={record.umRate}
                                                onChange={(e) =>
                                                  handleCommissionRecordChange(
                                                    key,
                                                    index,
                                                    "umRate",
                                                    e.target.value
                                                  )
                                                }
                                              >
                                                {[...Array(14)].map((_, i) => {
                                                  const rate = (
                                                    0.5 +
                                                    i * 0.5
                                                  ).toFixed(1);
                                                  return (
                                                    <option
                                                      key={rate}
                                                      value={rate}
                                                    >
                                                      {rate}%
                                                    </option>
                                                  );
                                                })}
                                              </select>
                                            </TableCell>
                                            <TableCell
                                              className="text-center font-semibold"
                                              style={{ background: "#E34A27" }}
                                            >
                                              <select
                                                className="border border-gray-300 rounded px-2 py-1 text-[#E34A27] bg-white font-bold"
                                                value={record.umDevelopersRate}
                                                onChange={(e) =>
                                                  handleCommissionRecordChange(
                                                    key,
                                                    index,
                                                    "umDevelopersRate",
                                                    e.target.value
                                                  )
                                                }
                                              >
                                                {[...Array(17)].map((_, i) => {
                                                  const rate = (
                                                    1 +
                                                    i * 0.5
                                                  ).toFixed(1);
                                                  return (
                                                    <option
                                                      key={rate}
                                                      value={rate}
                                                    >
                                                      {rate}%
                                                    </option>
                                                  );
                                                })}
                                              </select>
                                            </TableCell>
                                            <TableCell
                                              className="text-right font-semibold"
                                              style={{ background: "#E34A27" }}
                                            >
                                              {record.umAmount
                                                ? formatCurrency(
                                                    Number(record.umAmount)
                                                  )
                                                : ""}
                                            </TableCell>
                                            <TableCell
                                              className="text-right font-semibold"
                                              style={{ background: "#E34A27" }}
                                            >
                                              {record.umVat
                                                ? formatCurrency(
                                                    Number(record.umVat)
                                                  )
                                                : ""}
                                            </TableCell>
                                            <TableCell
                                              className="text-right font-semibold"
                                              style={{ background: "#E34A27" }}
                                            >
                                              {record.umEwt
                                                ? formatCurrency(
                                                    Number(record.umEwt)
                                                  )
                                                : ""}
                                            </TableCell>
                                            <TableCell
                                              className="text-right font-bold"
                                              style={{
                                                background: "#E34A27",
                                                color: "#fff",
                                              }}
                                            >
                                              {record.umNetComm
                                                ? formatCurrency(
                                                    Number(record.umNetComm)
                                                  )
                                                : ""}
                                            </TableCell>
                                            {/* TL FIELDS - #FEEFC6 */}
                                            <TableCell
                                              className="text-[#001f3f] font-semibold"
                                              style={{ background: "#FEEFC6" }}
                                            >
                                              <input
                                                type="text"
                                                className="border border-gray-300 rounded px-2 py-1 w-28 text-[#001f3f] bg-white font-bold"
                                                value={record.tlName}
                                                onChange={(e) =>
                                                  handleCommissionRecordChange(
                                                    key,
                                                    index,
                                                    "tlName",
                                                    e.target.value
                                                  )
                                                }
                                                placeholder="TL Name"
                                              />
                                            </TableCell>
                                            <TableCell
                                              className="text-center font-semibold"
                                              style={{ background: "#FEEFC6" }}
                                            >
                                              <select
                                                className="border border-gray-300 rounded px-2 py-1 text-[#001f3f] bg-white font-bold"
                                                value={record.tlCalculationType}
                                                onChange={(e) =>
                                                  handleCommissionRecordChange(
                                                    key,
                                                    index,
                                                    "tlCalculationType",
                                                    e.target.value
                                                  )
                                                }
                                              >
                                                <option value="nonvat with invoice">
                                                  nonvat with invoice
                                                </option>
                                                <option value="nonvat without invoice">
                                                  nonvat without invoice
                                                </option>
                                                <option value="vat with invoice">
                                                  vat with invoice
                                                </option>
                                              </select>
                                            </TableCell>
                                            <TableCell
                                              className="text-center font-semibold"
                                              style={{ background: "#FEEFC6" }}
                                            >
                                              <select
                                                className="border border-gray-300 rounded px-2 py-1 text-[#001f3f] bg-white font-bold"
                                                value={record.tlRate}
                                                onChange={(e) =>
                                                  handleCommissionRecordChange(
                                                    key,
                                                    index,
                                                    "tlRate",
                                                    e.target.value
                                                  )
                                                }
                                              >
                                                {[...Array(14)].map((_, i) => {
                                                  const rate = (
                                                    0.5 +
                                                    i * 0.5
                                                  ).toFixed(1);
                                                  return (
                                                    <option
                                                      key={rate}
                                                      value={rate}
                                                    >
                                                      {rate}%
                                                    </option>
                                                  );
                                                })}
                                              </select>
                                            </TableCell>
                                            <TableCell
                                              className="text-center font-semibold"
                                              style={{ background: "#FEEFC6" }}
                                            >
                                              <select
                                                className="border border-gray-300 rounded px-2 py-1 text-[#001f3f] bg-white font-bold"
                                                value={record.tlDevelopersRate}
                                                onChange={(e) =>
                                                  handleCommissionRecordChange(
                                                    key,
                                                    index,
                                                    "tlDevelopersRate",
                                                    e.target.value
                                                  )
                                                }
                                              >
                                                {[...Array(17)].map((_, i) => {
                                                  const rate = (
                                                    1 +
                                                    i * 0.5
                                                  ).toFixed(1);
                                                  return (
                                                    <option
                                                      key={rate}
                                                      value={rate}
                                                    >
                                                      {rate}%
                                                    </option>
                                                  );
                                                })}
                                              </select>
                                            </TableCell>
                                            <TableCell
                                              className="text-right font-semibold"
                                              style={{
                                                background: "#FEEFC6",
                                                color: "#001f3f",
                                              }}
                                            >
                                              {record.tlAmount
                                                ? formatCurrency(Number(record.tlAmount))
                                                : ""}
                                            </TableCell>
                                            <TableCell
                                              className="text-right font-semibold"
                                              style={{
                                                background: "#FEEFC6",
                                                color: "#001f3f",
                                              }}
                                            >
                                              {record.tlVat
                                                ? formatCurrency(Number(record.tlVat))
                                                : ""}
                                            </TableCell>
                                            <TableCell
                                              className="text-right font-semibold"
                                              style={{
                                                background: "#FEEFC6",
                                                color: "#001f3f",
                                              }}
                                            >
                                              {record.tlEwt
                                                ? formatCurrency(Number(record.tlEwt))
                                                : ""}
                                            </TableCell>
                                            <TableCell
                                              className="text-right font-bold"
                                              style={{
                                                background: "#FEEFC6",
                                                color: "#001f3f",
                                              }}
                                            >
                                              {record.tlNetComm
                                                ? formatCurrency(Number(record.tlNetComm))
                                                : ""}
                                            </TableCell>
                                            <TableCell className="text-center">
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="border-red-500 text-red-600 hover:bg-red-50 bg-transparent"
                                                onClick={() =>
                                                  removeAgentFromTab(key, index)
                                                }
                                              >
                                                Remove
                                              </Button>
                                            </TableCell>
                                          </TableRow>
                                        )
                                      )}
                                      {/* Combined Totals Row */}
                                      <TableRow className="bg-gray-100 font-bold">
                                        {/* Agent Totals */}
                                        <TableCell colSpan={6} className="text-right text-[#001f3f]">Totals:</TableCell>
                                        <TableCell className="text-right text-[#001f3f]">{formatCurrency(tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.comm.replace(/,/g, "")) || 0), 0))}</TableCell>
                                        <TableCell className="text-right text-[#001f3f]">{formatCurrency(tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.netOfVat) || 0), 0))}</TableCell>
                                        <TableCell />
                                        <TableCell />
                                        <TableCell />
                                        <TableCell className="text-right text-[#001f3f]">{formatCurrency(tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.agent) || 0), 0))}</TableCell>
                                        <TableCell className="text-right text-[#001f3f]">{formatCurrency(tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.vat) || 0), 0))}</TableCell>
                                        <TableCell className="text-right text-[#001f3f]">{formatCurrency(tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.ewt) || 0), 0))}</TableCell>
                                        <TableCell className="text-right text-[#001f3f]">{formatCurrency(tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.netComm) || 0), 0))}</TableCell>
                                        <TableCell />
                                        {/* UM Totals */}
                                        <TableCell />
                                        <TableCell />
                                        <TableCell />
                                        <TableCell className="text-right text-[#E34A27]">{formatCurrency(tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.umAmount) || 0), 0))}</TableCell>
                                        <TableCell className="text-right text-[#E34A27]">{formatCurrency(tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.umVat) || 0), 0))}</TableCell>
                                        <TableCell className="text-right text-[#E34A27]">{formatCurrency(tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.umEwt) || 0), 0))}</TableCell>
                                        <TableCell className="text-right text-[#E34A27]">{formatCurrency(tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.umNetComm) || 0), 0))}</TableCell>
                                        <TableCell />
                                        {/* TL Totals */}
                                        <TableCell />
                                        <TableCell />
                                        <TableCell className="text-right text-[#001f3f]">{formatCurrency(tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.tlAmount) || 0), 0))}</TableCell>
                                        <TableCell className="text-right text-[#001f3f]">{formatCurrency(tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.tlVat) || 0), 0))}</TableCell>
                                        <TableCell className="text-right text-[#001f3f]">{formatCurrency(tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.tlEwt) || 0), 0))}</TableCell>
                                        <TableCell className="text-right text-[#001f3f]">{formatCurrency(tabCommissionRecords.reduce((sum, r) => sum + (Number.parseFloat(r.tlNetComm) || 0), 0))}</TableCell>
                                        <TableCell />
                                      </TableRow>
                                    </>
                                  ) : (
                                    <TableRow>
                                      <TableCell
                                        colSpan={14}
                                        className="text-center text-gray-400 py-8"
                                      >
                                        No commission records added yet. Use the
                                        search above to add agents.
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Hidden inputs for storing sales record data */}
                        <div className="hidden">
                          {group.sales.map((sale, index) => (
                            <div key={`${key}-${index}`}>
                              <input
                                type="hidden"
                                name={`sales[${key}][${index}][id]`}
                                value={sale.id}
                              />
                              <input
                                type="hidden"
                                name={`sales[${key}][${index}][tin]`}
                                value={sale.tin}
                              />
                              <input
                                type="hidden"
                                name={`sales[${key}][${index}][name]`}
                                value={sale.name}
                              />
                              <input
                                type="hidden"
                                name={`sales[${key}][${index}][tax_type]`}
                                value={sale.tax_type}
                              />
                              <input
                                type="hidden"
                                name={`sales[${key}][${index}][gross_taxable]`}
                                value={sale.gross_taxable || 0}
                              />
                              <input
                                type="hidden"
                                name={`sales[${key}][${index}][total_actual_amount]`}
                                value={sale.total_actual_amount || 0}
                              />
                              <input
                                type="hidden"
                                name={`sales[${key}][${index}][invoice_number]`}
                                value={sale.invoice_number || ""}
                              />
                              <input
                                type="hidden"
                                name={`sales[${key}][${index}][tax_month]`}
                                value={sale.tax_month}
                              />
                              <input
                                type="hidden"
                                name={`sales[${key}][${index}][pickup_date]`}
                                value={sale.pickup_date || ""}
                              />
                              <input
                                type="hidden"
                                name={`sales[${key}][${index}][user_uuid]`}
                                value={sale.user_uuid}
                              />
                              <input
                                type="hidden"
                                name={`sales[${key}][${index}][user_assigned_area]`}
                                value={sale.user_assigned_area || ""}
                              />
                            </div>
                          ))}
                        </div>
                      </TabsContent>
                    );
                  }
                )}
              </Tabs>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 bg-white">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-[#001f3f] text-[#001f3f] hover:bg-[#001f3f] hover:text-white bg-white"
          >
            Close
          </Button>
          <Button
            className="bg-[#001f3f] text-white hover:bg-[#001f3f]/90"
            disabled={
              Object.keys(groupedByDeveloperAndInvoice).length === 0 ||
              isGeneratingExcel
            }
            onClick={generateExcelReport}
          >
            {isGeneratingExcel ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Generate Commission Report To Excel
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
