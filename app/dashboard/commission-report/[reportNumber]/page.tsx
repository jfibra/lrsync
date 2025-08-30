"use client"

import * as XLSX from "xlsx";
import { format } from "date-fns";
import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, User, Calendar, Hash, FileText, PhilippinePeso, Users, Building2, MapPin } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { AgentEditModal } from "@/components/agent-edit-modal";
import { logNotification } from "@/utils/logNotification"; // Adjust path as needed

interface CommissionReport {
  uuid: string
  report_number: number
  sales_uuids: string[]
  created_by: string
  created_at: string
  updated_at: string
  remarks: string | null
  status: string
  history: any[]
  secretary_pot: any
  accounting_pot: any
  user_profiles: {
    full_name: string
    assigned_area: string
  }
}

interface AgentBreakdown {
  uuid: string
  commission_report_number: number
  agent_name: string
  developer: string
  client: string
  comm: number
  agents_rate: number
  calculationType: string
  agent_net_comm: number
  status: string
  secretary_remarks: string
  accounting_remarks: string

  // Additional fields for full Excel export:
  reservation_date?: string
  type?: string
  bdo_account?: string
  net_of_vat?: number
  agent?: number
  vat?: number
  ewt?: number
  net_comm?: number
  um_name?: string
  um_bdo_account?: string
  umCalculationType: string
  um_rate?: number
  um_amount?: number
  um_vat?: number
  um_ewt?: number
  um_net_comm?: number
  tl_name?: string
  tlCalculationType: string
  tl_bdo_account?: string
  tl_rate?: number
  tl_amount?: number
  tl_vat?: number
  tl_ewt?: number
  tl_net_comm?: number
  remarks?: string
  invoice_number?: string
}

interface SalesData {
  id: string
  tin: string
  name: string
  tax_month: string
  type: string
  substreet_street_brgy: string
  district_city_zip: string
  gross_taxable: number
  invoice_number: string
  tax_type: string
  pickup_date: string
  total_actual_amount: number
  sale_type: string
  is_complete: boolean
  remarks: string
  user_full_name: string
  created_at: string
}

export default function CommissionReportViewer() {
  const params = useParams()
  const router = useRouter()
  const reportNumber = params.reportNumber as string

  const [report, setReport] = useState<CommissionReport | null>(null)
  const [agentBreakdown, setAgentBreakdown] = useState<AgentBreakdown[]>([])
  const [salesData, setSalesData] = useState<SalesData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attachmentsModalOpen, setAttachmentsModalOpen] = useState(false);

  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const [profile, setProfile] = useState<any>(null);

  const handleAgentRowClick = (agent: any) => {
    setSelectedAgent(agent);
    setEditModalOpen(true);
  };

  const handleAgentModalClose = () => {
    setEditModalOpen(false);
    setSelectedAgent(null);
  };

  const handleAgentSave = (updatedAgent: any) => {
    // TODO: Save to backend here if needed
    setAgentBreakdown((prev) =>
      prev.map((a) => (a.uuid === updatedAgent.uuid ? { ...a, ...updatedAgent } : a))
    );
    setEditModalOpen(false);
    setSelectedAgent(null);
  };

  const [authUserId, setAuthUserId] = useState<string | null>(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setAuthUserId(user?.id || null)
    }
    getUser()
  }, [supabase])

  useEffect(() => {
    const fetchUserProfiles = async () => {
      if (!salesData.length) return;
      const userUuids = Array.from(new Set(salesData.map(sale => sale.user_uuid).filter(Boolean)));
      if (userUuids.length === 0) return;
      const { data, error } = await supabase
        .from("user_profiles")
        .select("auth_user_id, full_name")
        .in("auth_user_id", userUuids);
      if (!error && data) {
        const profiles: { [key: string]: string } = {};
        data.forEach((profile: any) => {
          profiles[profile.auth_user_id] = profile.full_name;
        });
        setUserProfiles(profiles);
      }
    };
    fetchUserProfiles();
  }, [salesData]);

  useEffect(() => {
    console.log("reportNumber:", reportNumber);
    if (reportNumber) {
      fetchReportData()
    }
  }, [reportNumber])

  useEffect(() => {
    const getUserProfile = async () => {
      if (!authUserId) return;
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("auth_user_id", authUserId)
        .single();
      if (!error && data) setProfile({ ...data, id: authUserId });
    };
    getUserProfile();
  }, [authUserId, supabase]);

  useEffect(() => {
    if (profile && report?.report_number) {
      logNotification(supabase, {
        action: "commission_report_viewed",
        description: `Commission report #${report.report_number} viewed by ${profile.full_name || profile.id}`,
        ip_address: null,
        location: null,
        meta: JSON.stringify({
          report_number: report.report_number,
          viewed_by: {
            user_id: profile.id,
            user_name: profile.full_name || profile.id,
            user_email: profile.email,
          },
        }),
        user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
        user_email: profile.email,
        user_name: profile.full_name || profile.id,
        user_uuid: profile.id,
      });
    }
  }, [profile, report, supabase]);

  const [userProfiles, setUserProfiles] = useState<{ [key: string]: string }>({})

  // Helper functions (copy from modal)
  function formatTaxMonth(taxMonth: string) {
    if (!taxMonth) return "N/A";
    const date = new Date(taxMonth);
    return date.toLocaleString("en-US", { month: "short", year: "numeric" });
  }
  function formatTin(tin: string) {
    if (!tin) return "N/A";
    return tin.replace(/\D/g, "").replace(/(\d{3})(?=\d)/g, "$1-");
  }
  function formatCurrency(amount: number | null | undefined) {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return "₱0.00";
    }
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount);
  }
  function formatPercentage(rate: number) {
    return `${Number(rate).toFixed(2)}%`;
  }

  const handleExportToExcel = () => {
    try {
      const workbook = XLSX.utils.book_new();
      const worksheetData: any[][] = [];

      // Title
      worksheetData.push([
        `Commission Report #${report.report_number} - ${report.user_profiles?.full_name || "User"} - ${format(new Date(), "yyyy-MM-dd HH-mm")}`,
      ]);
      worksheetData.push([]);

      // Report Info Section
      worksheetData.push(["Report Number:", report.report_number]);
      worksheetData.push(["Created By:", report.user_profiles?.full_name || ""]);
      worksheetData.push(["Area:", report.user_profiles?.assigned_area || ""]);
      worksheetData.push(["Status:", report.status]);
      worksheetData.push(["Created At:", report.created_at ? format(new Date(report.created_at), "MMM dd, yyyy") : ""]);
      worksheetData.push([]);

      // Loop through each sale
      salesData.forEach((sale) => {
        worksheetData.push([`Sale Record Details - Invoice # ${sale.invoice_number || "N/A"}`]);
        worksheetData.push([
          "Tax Month:",
          formatTaxMonth(sale.tax_month),
          "",
          "",
          "Tax Type:",
          sale.tax_type?.toUpperCase(),
          "",
          "",
          "Total Actual Amount:",
          formatCurrency(Number(sale.total_actual_amount) || 0),
        ]);
        worksheetData.push([
          "TIN:",
          formatTin(sale.tin),
          "",
          "",
          "Sale Type:",
          sale.sale_type?.toUpperCase() || "INVOICE",
          "",
          "",
          "Invoice #:",
          sale.invoice_number || "N/A",
        ]);
        worksheetData.push([
          "Name:",
          sale.name,
          "",
          "",
          "Gross Taxable:",
          formatCurrency(Number(sale.gross_taxable) || 0),
          "",
          "",
          "Pickup Date:",
          sale.pickup_date ? format(new Date(sale.pickup_date), "MMM dd, yyyy") : "N/A",
        ]);
        worksheetData.push(["Area:", report.user_profiles?.assigned_area || "N/A"]);
        worksheetData.push([]);

        // Agent Breakdown Table Header
        worksheetData.push([
          "RESERVATION DATE",
          "DEVELOPER",
          "AGENT NAME",
          "CLIENT",
          "TYPE",
          "BDO ACCOUNT #",
          "COMM",
          "NET OF VAT",
          "STATUS",
          "AGENT CALC TYPE", // <-- Added
          "AGENT'S RATE",
          "AGENT",
          "VAT",
          "EWT",
          "NET COMM",
          "UM NAME",
          "UM BDO ACCOUNT #",
          "UM CALC TYPE", // <-- Added
          "UM RATE",
          "UM AMOUNT",
          "UM VAT",
          "UM EWT",
          "UM NET COMM",
          "TL NAME",
          "TL BDO ACCOUNT #",
          "TL CALC TYPE", // <-- Added
          "TL RATE",
          "TL AMOUNT",
          "TL VAT",
          "TL EWT",
          "TL NET COMM",
          "REMARKS",
        ]);

        // Agent Breakdown Rows for this sale
        const saleAgents = agentBreakdown.filter(
          (agent) =>
            String(agent.commission_report_number) === String(report.report_number) &&
            String(agent.invoice_number) === String(sale.invoice_number)
        );
        console.log("sale.invoice_number:", sale.invoice_number, "saleAgents:", saleAgents);

        if (saleAgents.length > 0) {
          saleAgents.forEach((agent) => {
            worksheetData.push([
              agent.reservation_date ? format(new Date(agent.reservation_date), "MMM dd, yyyy") : "",
              agent.developer,
              agent.agent_name,
              agent.client,
              agent.type || "COMM",
              agent.bdo_account || "",
              Number(agent.comm) || 0, // raw number, no ₱
              Number(agent.net_of_vat) || 0, // raw number, no ₱
              agent.status,
              agent.calculationType || "", // Agent calc type
              agent.agents_rate || "", // raw number, no %
              Number(agent.agent) || 0,
              Number(agent.vat) || 0,
              Number(agent.ewt) || 0,
              Number(agent.net_comm) || 0,
              agent.um_name,
              agent.um_bdo_account || "",
              agent.umCalculationType || "", // UM calc type
              agent.um_rate || "", // raw number, no %
              Number(agent.um_amount) || 0,
              Number(agent.um_vat) || 0,
              Number(agent.um_ewt) || 0,
              Number(agent.um_net_comm) || 0,
              agent.tl_name,
              agent.tl_bdo_account || "",
              agent.tlCalculationType || "", // TL calc type
              agent.tl_rate || "", // raw number, no %
              Number(agent.tl_amount) || 0,
              Number(agent.tl_vat) || 0,
              Number(agent.tl_ewt) || 0,
              Number(agent.tl_net_comm) || 0,
              agent.remarks || "",
            ]);
          });

          // Totals row for this sale
          worksheetData.push([
            "",
            "",
            "",
            "Totals:",
            "",
            "",
            saleAgents.reduce((sum, r) => sum + (Number(r.comm) || 0), 0),
            saleAgents.reduce((sum, r) => sum + (Number(r.net_of_vat) || 0), 0),
            "",
            "",
            saleAgents.reduce((sum, r) => sum + (Number(r.agent) || 0), 0),
            saleAgents.reduce((sum, r) => sum + (Number(r.vat) || 0), 0),
            saleAgents.reduce((sum, r) => sum + (Number(r.ewt) || 0), 0),
            saleAgents.reduce((sum, r) => sum + (Number(r.net_comm) || 0), 0),
            "",
            "",
            saleAgents.reduce((sum, r) => sum + (Number(r.um_rate) || 0), 0),
            saleAgents.reduce((sum, r) => sum + (Number(r.um_amount) || 0), 0),
            saleAgents.reduce((sum, r) => sum + (Number(r.um_vat) || 0), 0),
            saleAgents.reduce((sum, r) => sum + (Number(r.um_ewt) || 0), 0),
            saleAgents.reduce((sum, r) => sum + (Number(r.um_net_comm) || 0), 0),
            "",
            "",
            saleAgents.reduce((sum, r) => sum + (Number(r.tl_rate) || 0), 0),
            saleAgents.reduce((sum, r) => sum + (Number(r.tl_amount) || 0), 0),
            saleAgents.reduce((sum, r) => sum + (Number(r.tl_vat) || 0), 0),
            saleAgents.reduce((sum, r) => sum + (Number(r.tl_ewt) || 0), 0),
            saleAgents.reduce((sum, r) => sum + (Number(r.tl_net_comm) || 0), 0),
          ]);
        } else {
          worksheetData.push(["No commission records added yet."]);
        }

        worksheetData.push([]);
        worksheetData.push([]);
      });

      // Create worksheet from data
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      // Set column widths for readability (optional)
      worksheet["!cols"] = [
        { wch: 18 }, // RESERVATION DATE
        { wch: 15 }, // DEVELOPER
        { wch: 20 }, // AGENT NAME
        { wch: 20 }, // CLIENT
        { wch: 10 }, // TYPE
        { wch: 18 }, // BDO ACCOUNT #
        { wch: 15 }, // COMM
        { wch: 15 }, // NET OF VAT
        { wch: 12 }, // STATUS
        { wch: 15 }, // AGENT'S RATE
        { wch: 15 }, // AGENT
        { wch: 15 }, // VAT
        { wch: 15 }, // EWT
        { wch: 15 }, // NET COMM
        { wch: 15 }, // UM NAME
        { wch: 18 }, // UM BDO ACCOUNT #
        { wch: 12 }, // UM RATE
        { wch: 15 }, // UM AMOUNT
        { wch: 15 }, // UM VAT
        { wch: 15 }, // UM EWT
        { wch: 15 }, // UM NET COMM
        { wch: 15 }, // TL NAME
        { wch: 18 }, // TL BDO ACCOUNT #
        { wch: 12 }, // TL RATE
        { wch: 15 }, // TL AMOUNT
        { wch: 15 }, // TL VAT
        { wch: 15 }, // TL EWT
        { wch: 15 }, // TL NET COMM
        { wch: 20 }, // REMARKS
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, "Commission Report");
      const fileName = `Commission Report #${report.report_number} - ${report.user_profiles?.full_name || "User"} - ${format(new Date(), "yyyy-MM-dd HH-mm")}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      // Log notification for Excel export
      if (profile?.id && report?.report_number) {
        logNotification(supabase, {
          action: "commission_report_excel_generated",
          description: `Commission report #${report.report_number} Excel generated by ${profile.full_name || profile.id}`,
          ip_address: null,
          location: null,
          meta: JSON.stringify({
            report_uuid: report.uuid,
            report_number: report.report_number,
            generated_by: {
              user_id: profile.id,
              user_name: profile.full_name || profile.id,
              user_email: profile.email,
            },
          }),
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
          user_email: profile.email,
          user_name: profile.full_name || profile.id,
          user_uuid: profile.id,
        });
      }
    } catch (error) {
      console.error("Error generating Excel:", error);
      alert("Failed to generate Excel report. Please try again.");
    }
  };

  const fetchReportData = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log("Fetching report data for", reportNumber);

      // Fetch commission report
      const { data: reportData, error: reportError } = await supabase
        .from("commission_report")
        .select(`
          *,
          user_profiles (
            full_name,
            assigned_area
          )
        `)
        .eq("report_number", reportNumber)
        .single()

      if (reportError || !reportData) throw reportError || new Error("Report not found")
      setReport(reportData)
      console.log("Report data:", reportData);

      // Fetch agent breakdown
      const { data: agentData, error: agentError } = await supabase
        .from("commission_agent_breakdown")
        .select("*")
        .eq("commission_report_number", reportNumber)

      if (agentError) throw agentError
      setAgentBreakdown(agentData || [])

      console.log("Report data:", reportData);
      console.log("Agent breakdown:", agentData);
      console.log("Sales data:", salesData);

      // Fetch sales data
      if (reportData?.sales_uuids && reportData.sales_uuids.length > 0) {
        const { data: salesData, error: salesError } = await supabase
          .from("sales")
          .select(`
            id,
            tin,
            name,
            tax_month,
            type,
            substreet_street_brgy,
            district_city_zip,
            gross_taxable,
            invoice_number,
            tax_type,
            pickup_date,
            total_actual_amount,
            sale_type,
            is_complete,
            remarks,
            user_full_name,
            user_uuid,  
            created_at
          `)
          .in("id", reportData.sales_uuids)
          .order("created_at", { ascending: false })

        if (salesError) throw salesError
        setSalesData(salesData || [])
      } else {
        setSalesData([]) // <-- ADD THIS LINE
      }
    } catch (err: any) {
      console.error("Error fetching report data:", err)
      setError(err.message || "Failed to fetch report data")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="container mx-auto p-6 space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-8 w-64" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-white">
        <div className="container mx-auto p-6">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="border-[#3c8dbc] text-[#3c8dbc] hover:bg-[#3c8dbc] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
          <Card className="bg-white border-gray-200">
            <CardContent className="p-6 text-center">
              <p className="text-red-600">{error || "Commission report not found"}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const totalCommission = agentBreakdown.reduce((sum, agent) => sum + agent.comm, 0)
  const totalNetCommission = agentBreakdown.reduce((sum, agent) => sum + agent.agent_net_comm, 0)
  const totalSalesAmount = salesData.reduce((sum, sale) => sum + (sale.total_actual_amount || 0), 0)

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#001f3f]">
                Commission Report #{report.report_number}
              </h1>
              <p className="text-gray-600">Detailed breakdown and sales information</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="bg-[#001f3f] border-[#001f3f] text-white hover:bg-white hover:text-[#001f3f]"
            onClick={handleExportToExcel}
          >
            Generate Commission Report To Excel
          </Button>
        </div>

        {/* Report Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-white border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#001f3f]">Report Status</CardTitle>
              <FileText className="h-4 w-4 text-[#3c8dbc]" />
            </CardHeader>
            <CardContent>
              <Badge
                className={
                  report.status.toLowerCase() === "active"
                    ? "bg-[#28a745] text-white hover:bg-[#28a745]/90"
                    : report.status.toLowerCase() === "pending"
                      ? "bg-[#ffc107] text-[#001f3f] hover:bg-[#ffc107]/90"
                      : "bg-[#3c8dbc] text-white hover:bg-[#3c8dbc]/90"
                }
              >
                {report.status.toUpperCase()}
              </Badge>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#001f3f]">Total Commission</CardTitle>
              <PhilippinePeso className="h-4 w-4 text-[#28a745]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#28a745]">{formatCurrency(totalCommission)}</div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#001f3f]">Net Commission</CardTitle>
              <PhilippinePeso className="h-4 w-4 text-[#01ff70]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#01ff70]">{formatCurrency(totalNetCommission)}</div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#001f3f]">Total Sales</CardTitle>
              <Hash className="h-4 w-4 text-[#ff851b]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff851b]">{salesData.length}</div>
              <p className="text-xs text-gray-600">{formatCurrency(totalSalesAmount)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Report Details */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#001f3f]">
              <FileText className="h-5 w-5 text-[#3c8dbc]" />
              Report Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-[#3c8dbc]" />
                <span className="font-medium text-[#001f3f]">Created By:</span>
                <span className="text-gray-700">{report.user_profiles?.full_name || "Unknown User"}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#3c8dbc]" />
                <span className="font-medium text-[#001f3f]">Assigned Area:</span>
                <span className="text-gray-700">{report.user_profiles?.assigned_area || "N/A"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#3c8dbc]" />
                <span className="font-medium text-[#001f3f]">Created Date:</span>
                <span className="text-gray-700">{new Date(report.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#3c8dbc]" />
                <span className="font-medium text-[#001f3f]">Last Updated:</span>
                <span className="text-gray-700">{new Date(report.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
            {report.remarks && (
              <div>
                <span className="font-medium text-[#001f3f]">Remarks:</span>
                <p className="mt-1 text-gray-700">{report.remarks}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Agent Breakdown */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#001f3f]">
              <Users className="h-5 w-5 text-[#3c8dbc]" />
              Commission Agent Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200">
                    <TableHead className="text-[#001f3f] font-semibold">Agent</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Developer</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Client</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Commission</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Agent Rate</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Net Commission</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Status</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Remarks (Secretary)</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Remarks (Accounting)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentBreakdown.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-gray-400">
                        No agent breakdown data found
                      </TableCell>
                    </TableRow>
                  ) : (
                    agentBreakdown.map((agent) => (
                      <TableRow
                        key={agent.uuid}
                        className="border-gray-100 cursor-pointer hover:bg-blue-50"
                        onClick={() => handleAgentRowClick(agent)}
                      >
                        <TableCell className="font-medium text-gray-900">{agent.agent_name}</TableCell>
                        <TableCell className="text-gray-700">{agent.developer || "N/A"}</TableCell>
                        <TableCell className="text-gray-700">{agent.client || "N/A"}</TableCell>
                        <TableCell className="text-[#001f3f] font-medium">{formatCurrency(agent.comm)}</TableCell>
                        <TableCell className="text-gray-700">{formatPercentage(agent.agents_rate)}</TableCell>
                        <TableCell className="text-[#001f3f] font-medium">
                          {formatCurrency(agent.agent_net_comm)}
                        </TableCell>
                        <TableCell className="text-[#001f3f] font-medium">{agent.status}</TableCell>
                        <TableCell className="text-[#001f3f] font-medium">{agent.secretary_remarks}</TableCell>
                        <TableCell className="text-[#001f3f] font-medium">{agent.accounting_remarks}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Sales Information */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#001f3f]">
              <Building2 className="h-5 w-5 text-[#3c8dbc]" />
              Sales Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200">
                    <TableHead className="text-[#001f3f] font-semibold">Sale ID</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Tax Month</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">TIN</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Taxpayer Name</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Address</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Gross Taxable</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Tax Type</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Invoice Number</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Actual Amount</TableHead>
                    <TableHead className="text-[#001f3f] font-semibold">Created By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-gray-400">
                        No sales data found
                      </TableCell>
                    </TableRow>
                  ) : (
                    salesData.map((sale) => (
                      <TableRow key={sale.id} className="border-gray-100">
                        <TableCell className="text-gray-700">{sale.id}</TableCell>
                        <TableCell className="text-gray-700">{formatTaxMonth(sale.tax_month)}</TableCell>
                        <TableCell className="font-mono text-gray-900">{formatTin(sale.tin)}</TableCell>
                        <TableCell className="font-medium text-gray-900">{sale.name || "N/A"}</TableCell>
                        <TableCell className="text-gray-700 max-w-xs truncate">
                          {`${sale.substreet_street_brgy || ""} ${sale.district_city_zip || ""}`.trim() || "N/A"}
                        </TableCell>
                        <TableCell className="text-[#28a745] font-medium">
                          {formatCurrency(sale.gross_taxable)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              sale.tax_type?.toLowerCase() === "vat"
                                ? "bg-[#3c8dbc] text-white hover:bg-[#3c8dbc]/90"
                                : "bg-[#ffc107] text-[#001f3f] hover:bg-[#ffc107]/90"
                            }
                          >
                            {sale.tax_type?.toUpperCase() || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-gray-700">{sale.invoice_number || "N/A"}</TableCell>
                        <TableCell className="text-[#01ff70] font-medium">
                          {formatCurrency(sale.total_actual_amount)}
                        </TableCell>
                        <TableCell className="text-gray-700">
                          {userProfiles[sale.user_uuid] || "N/A"}
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
      <AgentEditModal
        open={editModalOpen}
        agent={selectedAgent}
        onClose={handleAgentModalClose}
        onSave={handleAgentSave}
        authUserId={authUserId ?? ""}
      />
    </div>
  )
}
