"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, FileSpreadsheet, Calendar, MapPin, Plus, Loader2 } from "lucide-react"
import { format } from "date-fns"
import type { Sales } from "@/types/sales"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { logNotification } from "@/utils/logNotification";

interface CommissionGenerationModalProps {
  isOpen: boolean
  onClose: () => void
  selectedSales: Sales[]
  userArea?: string
  userFullName?: string
}

interface SearchResult {
  id: number
  name: string
  clientfamilyname: string
  clientAge: number
  clientAddress: string
  clientGender: string
  clientEmail: string
  clientMobile: string
  clientCountry: string
  unitnum: string
  developer: string
  devid: number
  dev_rental_id: number | null
  projectname: string
  projid: number
  prop_type_id: number
  qty: number
  tcprice: number
  compercent: string
  reservationdate: string
  termofpayment: string
  dateadded: string
  agentid: number
  statement_of_account: string | null
  bir_form_2307: string | null
  status: string
  requirements: string | null
  client_requirements: string | null
  partialclaimed: string
  remarks: string
  broker_com: string
  deleted: number
  dateupdated: string
  files: string
  userupdate: number
  unconfirm: number
  request_file: string | null
  validSale: string
  agentuploadpot: number
  logs: string
  prop_details: string
  comm_requested: number
  comm_requests_history: string | null
  file_uploaded_to: string | null
  created_at: string
  updated_at: string
}

interface CommissionRecord {
  // EWT Rate fields
  ewtRate?: string // Agent EWT Rate
  umEwtRate?: string // UM EWT Rate
  tlEwtRate?: string // TL EWT Rate
  no: number
  date: string
  developer: string
  agentName: string
  client: string
  reservationDate: string
  calculationType: string
  comm: string
  netOfVat: string
  status: string
  agentsRate: string
  developersRate: string
  agent: string
  vat: string
  ewt: string
  netComm: string
  // UM fields
  umName: string
  umCalculationType: string
  umRate: string
  umDevelopersRate: string
  umAmount: string
  umVat: string
  umEwt: string
  umNetComm: string
  // TL fields
  tlName: string
  tlCalculationType: string
  tlRate: string
  tlDevelopersRate: string
  tlAmount: string
  tlVat: string
  tlEwt: string
  tlNetComm: string
  lrsalesId?: number; // <-- Add this line
  memberid?: number,

  // Agent BDO Account #
  bdoAccount?: string
  umBdoAccount?: string
  tlBdoAccount?: string
  remarks?: string

  // Commission type (COMM, INCENTIVES, COMM & INCENTIVES)
  type?: "COMM" | "INCENTIVES" | "COMM & INCENTIVES"
}

export function CommissionGenerationModal({
  isOpen,
  onClose,
  selectedSales,
  userArea,
  userFullName,
}: CommissionGenerationModalProps) {
  const currentYear = new Date().getFullYear()
  const [searchData, setSearchData] = useState({
    agentName: "",
    developerName: "",
    clientName: "",
    year: currentYear.toString(),
  })
  const [activeTab, setActiveTab] = useState<string>("")
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false)
  const [isSavingReport, setIsSavingReport] = useState(false)

  // Set initial activeTab after groupedByDeveloperAndInvoice is available
  useEffect(() => {
    const firstTab = Object.keys(groupedByDeveloperAndInvoice)[0] || ""
    setActiveTab(firstTab)
  }, [selectedSales])

  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [commissionRecords, setCommissionRecords] = useState<Record<string, CommissionRecord[]>>({})

  const { profile } = useAuth()

  // For debouncing COMM calculation
  const [commInputTimers, setCommInputTimers] = useState<Record<string, NodeJS.Timeout>>({})

  // Generate year options (20 years back from current year)
  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear()
    const years = []
    for (let i = 0; i < 20; i++) {
      years.push(currentYear - i)
    }
    return years
  }

  const yearOptions = generateYearOptions()

  // Format currency as number with commas, no peso sign
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  // Format TIN display - add dash after every 3 digits
  const formatTin = (tin: string) => {
    const digits = tin.replace(/\D/g, "")
    return digits.replace(/(\d{3})(?=\d)/g, "$1-")
  }

  // Utility function to determine EWT dropdown visibility and options
  function getEwtDropdownProps(calcType: string) {
    if (calcType === "nonvat without invoice") {
      return { show: false, options: [0] }
    }
    if (calcType === "nonvat with invoice") {
      return { show: true, options: [5] }
    }
    if (calcType === "vat with invoice") {
      return { show: true, options: [10] }
    }
    if (calcType === "vat deduction") {
      return { show: false, options: [0] }
    }
  }

  // Group selected sales by developer name and invoice number
  const groupedByDeveloperAndInvoice = selectedSales.reduce(
    (acc, sale) => {
      const developerId = sale.user_uuid
      const saleId = sale.id
      const developerName = sale.name || "Unknown Developer"
      const invoiceNumber = sale.invoice_number || "N/A"
      const key = `${developerId}-${invoiceNumber}-${saleId}`

      if (!acc[key]) {
        acc[key] = {
          developerId,
          saleId,
          developerName,
          invoiceNumber,
          sales: [],
        }
      }
      acc[key].sales.push(sale)
      return acc
    },
    {} as Record<string, { developerId: string; developerName: string; invoiceNumber: string; sales: Sales[] }>,
  )

  // Handle search input changes
  const handleSearchChange = (field: string, value: string) => {
    setSearchData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  // Track active tab
  const handleTabChange = (value: string) => {
    setActiveTab(value)
  }

  // Perform search
  const handleSearch = async () => {
    if (!searchData.developerName) return
    setIsSearching(true)
    try {
      const params = new URLSearchParams()
      if (searchData.agentName) params.append("name", searchData.agentName)
      if (searchData.year) params.append("year", searchData.year)
      if (searchData.developerName) {
        params.append("developer", searchData.developerName)
      }
      if (searchData.clientName) {
        params.append("clientfamilyname", searchData.clientName)
      }
      const response = await fetch(`${process.env.NEXT_PUBLIC_NEXT_API_ROUTE_LR}/search-sales-report?${params}`)
      if (response.ok) {
        const results = await response.json()
        setSearchResults(results)
      } else {
        console.error("Search failed:", response.statusText)
        setSearchResults([])
      }
    } catch (error) {
      console.error("Search error:", error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // Add agent to commission table for specific tab
  const addAgentToTab = (tabKey: string, searchResult: SearchResult) => {
    console.log("addAgentToTab searchResult:", searchResult);

    const newRecord: CommissionRecord = {
      no: (commissionRecords[tabKey]?.length || 0) + 1,
      date: format(new Date(), "yyyy-MM-dd"),
      developer: searchResult.developer,
      agentName: searchResult.name,
      reservationDate: searchResult.reservationdate || "",
      client: searchResult.clientfamilyname,
      lrsalesId: searchResult.id,
      memberid: searchResult.agentid,
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
    }
    setCommissionRecords((prev) => ({
      ...prev,
      [tabKey]: [...(prev[tabKey] || []), newRecord],
    }))
  }

  // Remove agent from commission table
  const removeAgentFromTab = (tabKey: string, index: number) => {
    setCommissionRecords((prev) => {
      const updated = { ...prev }
      updated[tabKey] = [...(updated[tabKey] || [])]
      updated[tabKey].splice(index, 1)
      return updated
    })
  }

  // Handle commission record field change - FIXED VERSION
  const handleCommissionRecordChange = (
    tabKey: string,
    index: number,
    field: keyof CommissionRecord,
    value: string,
  ) => {
    console.log(`Field changed: ${field}, Value: ${value}, TabKey: ${tabKey}, Index: ${index}`)

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

      setCommInputTimers((prev) => ({
        ...prev,
        [`${tabKey}-${index}`]: timer,
      }))
      return
    }

    // Update the record first
    setCommissionRecords((prev) => {
      const updated = { ...prev }
      const records = [...(updated[tabKey] || [])]
      records[index] = { ...records[index], [field]: value }
      updated[tabKey] = records
      return updated
    })

    // CRITICAL FIX: Use setTimeout to ensure state update completes before calculation
    setTimeout(() => {
      // If any calculation-affecting field changes, recalculate immediately
      if (
        [
          "agentsRate",
          "developersRate",
          "calculationType",
          "umCalculationType",
          "umRate",
          "umDevelopersRate",
          "tlCalculationType",
          "tlRate",
          "tlDevelopersRate",
          "ewtRate",
          "umEwtRate",
          "tlEwtRate",
        ].includes(field)
      ) {
        console.log(`Triggering calculation for field: ${field}`)
        doCommissionCalculation(tabKey, index)
      }
    }, 0)
  }

  // Actual calculation logic - ENHANCED VERSION
  const doCommissionCalculation = (tabKey: string, index: number, recordsOverride?: CommissionRecord[]) => {
    console.log(`Starting calculation for TabKey: ${tabKey}, Index: ${index}`)

    setCommissionRecords((prev) => {
      const updated = { ...prev }
      const records = recordsOverride ? [...recordsOverride] : [...(updated[tabKey] || [])]

      if (!records[index]) {
        console.error(`Record not found at index ${index}`)
        return prev
      }

      const record = { ...records[index] }
      const calcType = record.calculationType
      const comm = Number.parseFloat(record.comm.replace(/,/g, "")) || 0
      const agentsRate = Number.parseFloat(record.agentsRate) || 0
      const developersRate = Number.parseFloat(record.developersRate) || 5

      console.log(
        `Calculation inputs - COMM: ${comm}, Agent Rate: ${agentsRate}, Developer Rate: ${developersRate}, Calc Type: ${calcType}`,
      )

      let netOfVat = ""
      let agent = ""
      let vat = ""
      let ewt = ""
      let netComm = ""

      if (record.agentsRate === "0") {
        record.agent = ""
        record.vat = ""
        record.ewt = ""
        record.netComm = ""
      }
      if (record.umRate === "0") {
        record.umAmount = ""
        record.umVat = ""
        record.umEwt = ""
        record.umNetComm = ""
      }
      if (record.tlRate === "0") {
        record.tlAmount = ""
        record.tlVat = ""
        record.tlEwt = ""
        record.tlNetComm = ""
      }

      records[index] = record
      updated[tabKey] = records

      // Agent calculations
      if (calcType === "vat deduction") {
        // vat deduction for Agent: netComm = agent / 1.12, vat = netComm * 0.12
        agent = comm && agentsRate && developersRate ? String((comm * agentsRate) / developersRate) : ""
        netComm = agent ? String(Number(agent) / 1.12) : ""
        vat = netComm ? String(Number(netComm) * 0.12) : ""
        ewt = ""
        netOfVat = ""
      } else if (calcType === "nonvat with invoice") {
        netOfVat = comm ? String(comm / 1.02) : ""
        agent =
          netOfVat && agentsRate && developersRate
            ? String((Number.parseFloat(netOfVat) * agentsRate) / developersRate)
            : ""
        // Use selected EWT rate for Agent
        const agentEwtRate = Number(record.ewtRate || "5") / 100
        ewt = agent ? String(Number.parseFloat(agent) * agentEwtRate) : ""
        netComm = agent && ewt ? String(Number.parseFloat(agent) - Number.parseFloat(ewt)) : ""
        vat = ""
      } else if (calcType === "nonvat without invoice") {
        netOfVat = ""
        agent = ""
        vat = ""
        ewt = ""
        netComm = comm && agentsRate && developersRate ? String((comm * agentsRate) / developersRate) : ""
      } else if (calcType === "vat with invoice") {
        netOfVat = ""
        vat = ""
        agent = comm && agentsRate && developersRate
          ? String((Number.parseFloat(comm) * agentsRate) / developersRate)
          : ""
        netComm = comm ? String(agent) : ""
        ewt = comm ? String((Number(netComm) / 1.02) * 0.10) : ""
      }

      record.netOfVat = netOfVat
      record.agent = agent
      record.vat = vat
      record.ewt = ewt
      record.netComm = netComm

      // UM calculation - ENHANCED
      if (record.umCalculationType && record.umRate && record.umDevelopersRate) {
        const umCalcType = record.umCalculationType
        const umRate = Number.parseFloat(record.umRate) || 0
        const umDevelopersRate = Number.parseFloat(record.umDevelopersRate) || 5

        console.log(`UM Calculation - Rate: ${umRate}, Developer Rate: ${umDevelopersRate}, Calc Type: ${umCalcType}`)

        let umAmount = ""
        let umVat = ""
        let umEwt = ""
        let umNetComm = ""

        // If agent calculation is 'nonvat without invoice' or 'vat deduction', use COMM for UM/TL calculation
        if (calcType === "nonvat without invoice" || calcType === "vat deduction" || umCalcType === "vat with invoice") {
          umAmount = comm && umRate && umDevelopersRate ? String((comm * umRate) / umDevelopersRate) : ""
        } else if (umCalcType === "nonvat with invoice") {
          umAmount =
            netOfVat && umRate && umDevelopersRate
              ? String((Number.parseFloat(netOfVat) * umRate) / umDevelopersRate)
              : ""
        } else {
          umAmount = comm && umRate && umDevelopersRate ? String((comm * umRate) / umDevelopersRate) : ""
        }

        if (umCalcType === "nonvat with invoice") {
          const umEwtRate = Number(record.umEwtRate || "5") / 100
          umEwt = umAmount ? String(Number.parseFloat(umAmount) * umEwtRate) : ""
          umNetComm = umAmount && umEwt ? String(Number.parseFloat(umAmount) - Number.parseFloat(umEwt)) : ""
          umVat = ""
        } else if (umCalcType === "vat with invoice") {
          umVat = ""
          umNetComm = comm ? String(umAmount) : ""
          umEwt = comm ? String((Number(umNetComm) / 1.02) * 0.10) : ""
        } else if (umCalcType === "vat deduction") {
          // vat deduction for UM: netComm = umAmount / 1.12, vat = netComm * 0.12
          umNetComm = umAmount ? String(Number(umAmount) / 1.12) : ""
          umVat = umNetComm ? String(Number(umNetComm) * 0.12) : ""
          umEwt = ""
        } else {
          umVat = ""
          umEwt = ""
          umNetComm = umAmount || ""
        }

        record.umAmount = umAmount
        record.umVat = umVat
        record.umEwt = umEwt
        record.umNetComm = umNetComm

        console.log(`UM Results - Amount: ${umAmount}, VAT: ${umVat}, EWT: ${umEwt}, Net: ${umNetComm}`)
      }

      // TL calculation - ENHANCED
      if (record.tlCalculationType && record.tlRate && record.tlDevelopersRate) {
        const tlCalcType = record.tlCalculationType
        const tlRate = Number.parseFloat(record.tlRate) || 0
        const tlDevelopersRate = Number.parseFloat(record.tlDevelopersRate) || 5

        console.log(`TL Calculation - Rate: ${tlRate}, Developer Rate: ${tlDevelopersRate}, Calc Type: ${tlCalcType}`)

        let tlAmount = ""
        let tlVat = ""
        let tlEwt = ""
        let tlNetComm = ""

        // If agent calculation is 'nonvat without invoice' or 'vat deduction', use COMM for UM/TL calculation
        if (calcType === "nonvat without invoice" || calcType === "vat deduction" || tlCalcType === "vat with invoice") {
          tlAmount = comm && tlRate && tlDevelopersRate ? String((comm * tlRate) / tlDevelopersRate) : ""
        } else if (tlCalcType === "nonvat with invoice") {
          tlAmount =
            netOfVat && tlRate && tlDevelopersRate
              ? String((Number.parseFloat(netOfVat) * tlRate) / tlDevelopersRate)
              : ""
        } else {
          tlAmount = comm && tlRate && tlDevelopersRate ? String((comm * tlRate) / tlDevelopersRate) : ""
        }

        if (tlCalcType === "nonvat with invoice") {
          const tlEwtRate = Number(record.tlEwtRate || "5") / 100
          tlEwt = tlAmount ? String(Number.parseFloat(tlAmount) * tlEwtRate) : ""
          tlNetComm = tlAmount && tlEwt ? String(Number.parseFloat(tlAmount) - Number.parseFloat(tlEwt)) : ""
          tlVat = ""
        } else if (tlCalcType === "vat with invoice") {
          tlVat = ""
          tlNetComm = comm ? String(tlAmount) : ""
          tlEwt = comm ? String((Number(tlNetComm) / 1.02) * 0.10) : ""
        } else if (tlCalcType === "vat deduction") {
          // vat deduction for TL: netComm = tlAmount / 1.12, vat = netComm * 0.12
          tlNetComm = tlAmount ? String(Number(tlAmount) / 1.12) : ""
          tlVat = tlNetComm ? String(Number(tlNetComm) * 0.12) : ""
          tlEwt = ""
        } else {
          tlVat = ""
          tlEwt = ""
          tlNetComm = tlAmount || ""
        }

        record.tlAmount = tlAmount
        record.tlVat = tlVat
        record.tlEwt = tlEwt
        record.tlNetComm = tlNetComm

        console.log(`TL Results - Amount: ${tlAmount}, VAT: ${tlVat}, EWT: ${tlEwt}, Net: ${tlNetComm}`)
      }

      records[index] = record
      updated[tabKey] = records

      console.log(`Calculation completed for record:`, record)
      return updated
    })
  }

  // Format number as currency with commas
  const formatNumberWithCommas = (value: string) => {
    const num = value.replace(/,/g, "")
    if (!num) return ""
    const parts = num.split(".")
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    return parts.join(".")
  }

  // Get tax type badge color
  const getTaxTypeBadgeColor = (taxType: string) => {
    switch (taxType) {
      case "vat":
        return "bg-blue-50 text-blue-800 border border-blue-200"
      case "non-vat":
        return "bg-green-50 text-green-800 border border-green-200"
      default:
        return "bg-gray-50 text-gray-800 border border-gray-200"
    }
  }

  // Generate Excel report
  const generateExcelReport = async () => {
    await saveCommissionReport();
    setIsGeneratingExcel(true)
    try {
      // Create a new workbook
      const workbook = XLSX.utils.book_new()

      // Prepare data for the worksheet
      const worksheetData: any[][] = []

      // Add title
      const title = `Commission Report${userArea ? `(${userArea})` : ""} - ${userFullName || "User"
        } - ${format(new Date(), "yyyy-MM-dd HH-mm")}`
      worksheetData.push([title])
      worksheetData.push([]) // Empty row

      // Process each tab (developer/invoice group)
      Object.entries(groupedByDeveloperAndInvoice).forEach(([key, group], groupIndex) => {
        const firstSale = group.sales[0]
        const tabCommissionRecords = commissionRecords[key] || []

        // Add section title
        worksheetData.push([`Sale Record Details - Invoice # ${group.invoiceNumber}`])

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
          formatCurrency(Number(firstSale.total_actual_amount) || 0),
        ])

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
        ])

        worksheetData.push([
          "Name:",
          firstSale.name,
          "",
          "",
          "Gross Taxable:",
          formatCurrency(Number(firstSale.gross_taxable) || 0),
          "",
          "",
          "Pickup Date:",
          firstSale.pickup_date ? format(new Date(firstSale.pickup_date), "MMM dd, yyyy") : "N/A",
        ])

        worksheetData.push(["Area:", firstSale.user_assigned_area || "N/A"])

        worksheetData.push([]) // Empty row

        // Add Commission Records table header
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
        ])

        // Add commission records
        if (tabCommissionRecords.length > 0) {
          tabCommissionRecords.forEach((record) => {
            worksheetData.push([
              format(new Date(record.reservationDate), "MMM dd, yyyy"),
              record.developer,
              record.agentName,
              record.client,
              record.type || "COMM",
              record.bdoAccount || "",
              formatCurrency(Number(record.comm.replace(/,/g, "")) || 0),
              formatCurrency(Number(record.netOfVat) || 0),
              record.status,
              record.calculationType || "", // <-- Agent calc type
              `${record.agentsRate}`,
              formatCurrency(Number(record.agent) || 0),
              formatCurrency(Number(record.vat) || 0),
              formatCurrency(Number(record.ewt) || 0),
              formatCurrency(Number(record.netComm) || 0),
              record.umName,
              record.umBdoAccount || "",
              record.umCalculationType || "", // <-- UM calc type
              `${record.umRate}`,
              formatCurrency(Number(record.umAmount) || 0),
              formatCurrency(Number(record.umVat) || 0),
              formatCurrency(Number(record.umEwt) || 0),
              formatCurrency(Number(record.umNetComm) || 0),
              record.tlName,
              record.tlBdoAccount || "",
              record.tlCalculationType || "", // <-- TL calc type
              `${record.tlRate}`,
              formatCurrency(Number(record.tlAmount) || 0),
              formatCurrency(Number(record.tlVat) || 0),
              formatCurrency(Number(record.tlEwt) || 0),
              formatCurrency(Number(record.tlNetComm) || 0),
              record.remarks || "",
            ])
          })

          // Add combined totals row for Agent, UM, TL
          worksheetData.push([
            "",
            "",
            "",
            "Totals:",
            "",
            "",
            formatCurrency(tabCommissionRecords.reduce((sum, r) => sum + (Number(r.comm.replace(/,/g, "")) || 0), 0)),
            formatCurrency(tabCommissionRecords.reduce((sum, r) => sum + (Number(r.netOfVat) || 0), 0)),
            "",
            "",
            "",
            formatCurrency(tabCommissionRecords.reduce((sum, r) => sum + (Number(r.agent) || 0), 0)),
            formatCurrency(tabCommissionRecords.reduce((sum, r) => sum + (Number(r.vat) || 0), 0)),
            formatCurrency(tabCommissionRecords.reduce((sum, r) => sum + (Number(r.ewt) || 0), 0)),
            formatCurrency(tabCommissionRecords.reduce((sum, r) => sum + (Number(r.netComm) || 0), 0)),
            "",
            "",
            "",
            `${tabCommissionRecords.reduce((sum, r) => sum + (Number(r.umRate) || 0), 0)}%`,
            formatCurrency(tabCommissionRecords.reduce((sum, r) => sum + (Number(r.umAmount) || 0), 0)),
            formatCurrency(tabCommissionRecords.reduce((sum, r) => sum + (Number(r.umVat) || 0), 0)),
            formatCurrency(tabCommissionRecords.reduce((sum, r) => sum + (Number(r.umEwt) || 0), 0)),
            formatCurrency(tabCommissionRecords.reduce((sum, r) => sum + (Number(r.umNetComm) || 0), 0)),
            "",
            "",
            "",
            `${tabCommissionRecords.reduce((sum, r) => sum + (Number(r.tlRate) || 0), 0)}%`,
            formatCurrency(tabCommissionRecords.reduce((sum, r) => sum + (Number(r.tlAmount) || 0), 0)),
            formatCurrency(tabCommissionRecords.reduce((sum, r) => sum + (Number(r.tlVat) || 0), 0)),
            formatCurrency(tabCommissionRecords.reduce((sum, r) => sum + (Number(r.tlEwt) || 0), 0)),
            formatCurrency(tabCommissionRecords.reduce((sum, r) => sum + (Number(r.tlNetComm) || 0), 0)),
          ])
        } else {
          worksheetData.push(["No commission records added yet."])
        }

        // Add blank rows between tabs (except for the last one)
        if (groupIndex < Object.keys(groupedByDeveloperAndInvoice).length - 1) {
          worksheetData.push([])
          worksheetData.push([])
        }
      })

      // Create worksheet from data
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

      // Set column widths
      worksheet["!cols"] = [
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
        { wch: 15 }, // UM NAME
        { wch: 12 }, // UM RATE
        { wch: 15 }, // UM AMOUNT
        { wch: 15 }, // UM VAT
        { wch: 15 }, // UM EWT
        { wch: 15 }, // UM NET COMM
        { wch: 15 }, // TL NAME
        { wch: 12 }, // TL RATE
        { wch: 15 }, // TL AMOUNT
        { wch: 15 }, // TL VAT
        { wch: 15 }, // TL EWT
        { wch: 15 }, // TL NET COMM
      ]

      // Add borders and colors for presentable sheet
      const range = XLSX.utils.decode_range(worksheet["!ref"])
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell_address = { c: C, r: R }
          const cell_ref = XLSX.utils.encode_cell(cell_address)
          if (!worksheet[cell_ref]) continue
          worksheet[cell_ref].s = worksheet[cell_ref].s || {}
          worksheet[cell_ref].s.border = {
            top: { style: "thin", color: { rgb: "001f3f" } },
            bottom: { style: "thin", color: { rgb: "001f3f" } },
            left: { style: "thin", color: { rgb: "001f3f" } },
            right: { style: "thin", color: { rgb: "001f3f" } },
          }
          // Header row coloring
          if (R === 6) {
            worksheet[cell_ref].s.fill = {
              fgColor: { rgb: "a0d9ef" },
            }
            worksheet[cell_ref].s.font = { bold: true }
          }
        }
      }

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, "Commission Report")

      // Generate Excel file and download
      const fileName = `Commission Report${userArea ? `(${userArea})` : ""} - ${userFullName || "User"
        } - ${format(new Date(), "yyyy-MM-dd HH-mm")}.xlsx`
      XLSX.writeFile(workbook, fileName)
    } catch (error) {
      console.error("Error generating Excel:", error)
      alert("Failed to generate Excel report. Please try again.")
    } finally {
      setIsGeneratingExcel(false)
    }
  }

  // Save commission report to database
  const saveCommissionReport = async () => {
    if (!profile?.id) {
      toast.error("User not authenticated")
      return
    }

    // Check if there are any commission records
    const hasRecords = Object.values(commissionRecords).some((records) => records.length > 0)
    if (!hasRecords) {
      toast.error("No commission records to save")
      return
    }

    setIsSavingReport(true)
    const supabase = createClient()

    try {
      // Extract all sales UUIDs from selected sales
      const salesUuids = selectedSales.map((sale) => sale.id)

      // Generate report_number as MMDDYYYYHHmmss
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const reportNumber =
        pad(now.getMonth() + 1) +
        pad(now.getDate()) +
        now.getFullYear() +
        pad(now.getHours()) +
        pad(now.getMinutes()) +
        pad(now.getSeconds());

      // Create the commission report
      const { data: reportData, error: reportError } = await supabase
        .from("commission_report")
        .insert({
          sales_uuids: salesUuids,
          created_by: profile.id,
          status: "new",
          report_number: reportNumber,
          history: [
            {
              action: "created",
              user_id: profile.id,
              user_name: profile.full_name || "Unknown User",
              timestamp: new Date().toISOString(),
              remarks: "Commission report created",
            },
          ],
        })
        .select("uuid, report_number")
        .single()

      if (profile?.id && reportData?.report_number) {
        await logNotification(supabase, {
          action: "commission_report_generated",
          description: `Commission report #${reportData.report_number} generated by ${profile.full_name || profile.first_name || profile.id}`,
          ip_address: null,
          location: null,
          meta: JSON.stringify({
            report_uuid: reportData.uuid,
            report_number: reportData.report_number,
            created_by: {
              user_id: profile.id,
              user_name: profile.full_name || profile.first_name || profile.id,
              user_email: profile.email,
            },
            sales_uuids: salesUuids,
            sales_count: salesUuids.length,
          }),
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
          user_email: profile.email,
          user_name: profile.full_name || profile.first_name || profile.id,
          user_uuid: profile.id,
        });
      }

      if (reportError) {
        console.error("Error creating commission report:", reportError)
        toast.error("Failed to create commission report")
        return
      }

      // Prepare commission agent breakdown records
      const breakdownRecords: any[] = []

      Object.entries(commissionRecords).forEach(([tabKey, records]) => {
        records.forEach((record) => {
          // Find the agent UUID - you might need to adjust this based on your data structure
          // For now, we'll use the profile.id as a placeholder since we don't have agent UUIDs in the search results
          const agentUuid = profile.id // This should be replaced with actual agent UUID from your search results

          breakdownRecords.push({
            commission_report_uuid: reportData.uuid,
            commission_report_number: reportData.report_number,
            agent_uuid: agentUuid,
            agent_name: record.agentName,
            developer: record.developer,
            client: record.client,
            reservation_date: record.reservationDate || null,
            comm: Number.parseFloat(record.comm.replace(/,/g, "")) || null,
            comm_type: record.type || "COMM", // Default to "COMM" if not set
            bdo_account: record.bdoAccount || null,
            net_of_vat: Number.parseFloat(record.netOfVat) || null,
            status: record.status,   // Use record.status or default to "new"
            calculation_type: record.calculationType,
            agents_rate: Number.parseFloat(record.agentsRate) || null,
            developers_rate: Number.parseFloat(record.developersRate) || null,
            agent_amount: Number.parseFloat(record.agent) || null,
            agent_vat: Number.parseFloat(record.vat) || null,
            agent_ewt: Number.parseFloat(record.ewt) || null,
            agent_ewt_rate: Number.parseFloat(record.ewtRate ?? "") || null,
            agent_net_comm: Number.parseFloat(record.netComm) || null,
            um_name: record.umName || null,
            um_calculation_type: record.umCalculationType || null,
            um_rate: Number.parseFloat(record.umRate) || null,
            um_developers_rate: Number.parseFloat(record.umDevelopersRate) || null,
            um_amount: Number.parseFloat(record.umAmount) || null,
            um_vat: Number.parseFloat(record.umVat) || null,
            um_ewt: Number.parseFloat(record.umEwt) || null,
            um_ewt_rate: Number.parseFloat(record.umEwtRate ?? "") || null,
            um_net_comm: Number.parseFloat(record.umNetComm) || null,
            tl_name: record.tlName || null,
            tl_calculation_type: record.tlCalculationType || null,
            tl_rate: Number.parseFloat(record.tlRate) || null,
            tl_developers_rate: Number.parseFloat(record.tlDevelopersRate) || null,
            tl_amount: Number.parseFloat(record.tlAmount) || null,
            tl_vat: Number.parseFloat(record.tlVat) || null,
            tl_ewt: Number.parseFloat(record.tlEwt) || null,
            tl_ewt_rate: Number.parseFloat(record.tlEwtRate ?? "") || null,
            tl_net_comm: Number.parseFloat(record.tlNetComm) || null,
            lrsalesid: record.lrsalesId?.toString() ?? null,
            memberid: record.memberid?.toString() ?? null,
            um_bdo_account: record.umBdoAccount || null,
            tl_bdo_account: record.tlBdoAccount || null,
            secretary_remarks: record.remarks || null, // or record.secretaryRemarks if you have it
            accounting_remarks: null, // or record.accountingRemarks if you have it
            sales_uuid: groupedByDeveloperAndInvoice[tabKey]?.saleId ?? null,
            invoice_number: groupedByDeveloperAndInvoice[tabKey]?.invoiceNumber ?? null,
          })
        })
      })

      // Insert commission agent breakdown records
      if (breakdownRecords.length > 0) {
        const { error: breakdownError } = await supabase.from("commission_agent_breakdown").insert(breakdownRecords)

        if (breakdownError) {
          console.error("Error creating commission breakdowns:", breakdownError)
          toast.error("Failed to save commission breakdowns")
          return
        }
      }

      toast.success(`Commission report #${reportData.report_number} saved successfully!`)
    } catch (error) {
      console.error("Unexpected error saving commission report:", error)
      toast.error("An unexpected error occurred while saving the report")
    } finally {
      setIsSavingReport(false)
    }
  }

  // Clear search results when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchResults([])
      // setCommissionRecords({});
    }
  }, [isOpen])

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) return // Prevent closing on outside click
        // Only allow opening, not closing via outside click
      }}
    >
      <Toaster richColors position="top-right" />
      <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-hidden bg-white">
        <DialogHeader className="border-b border-gray-200 pb-4">
          <DialogTitle className="text-2xl font-bold text-[#001f3f]">
            Generate Commission {userArea && `(${userArea})`} - {format(new Date(), "MMMM dd, yyyy")} -{" "}
            {userFullName || "User"}
          </DialogTitle>
          <p className="text-[#001f3f] mt-1">Commission breakdown for selected developers</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto max-h-[calc(95vh-200px)]">
          {Object.keys(groupedByDeveloperAndInvoice).length === 0 ? (
            <div className="text-center py-12">
              <div className="text-[#001f3f] text-lg font-medium mb-2">No developers selected</div>
              <div className="text-[#001f3f] text-sm">Please select sales records to generate commission reports</div>
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
                      <label className="block text-sm font-medium text-[#001f3f] mb-1">Agent Name</label>
                      <Input
                        placeholder="Enter agent name..."
                        value={searchData.agentName}
                        onChange={(e) => handleSearchChange("agentName", e.target.value)}
                        className="border-gray-300 focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#001f3f] mb-1">Developer Name</label>
                      <Input
                        placeholder="Enter developer name..."
                        value={searchData.developerName || ""}
                        onChange={(e) => handleSearchChange("developerName", e.target.value)}
                        className="border-gray-300 focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#001f3f] mb-1">Client Name</label>
                      <Input
                        placeholder="Enter client name..."
                        value={searchData.clientName}
                        onChange={(e) => handleSearchChange("clientName", e.target.value)}
                        className="border-gray-300 focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#001f3f] mb-1">Year</label>
                      <Select value={searchData.year} onValueChange={(value) => handleSearchChange("year", value)}>
                        <SelectTrigger className="border-gray-300 focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] bg-white">
                          <SelectValue placeholder="Select year..." className="text-[#001f3f]" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          {yearOptions.map((year) => (
                            <SelectItem key={year} value={year.toString()} className="text-[#001f3f]">
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
                      <Button
                        variant="outline"
                        className="border-[#001f3f] text-white bg-[#001f3f]"
                        onClick={() =>
                          setSearchData({
                            agentName: "",
                            developerName: "",
                            clientName: "",
                            year: currentYear.toString(),
                          })
                        }
                      >
                        Clear Filters
                      </Button>
                      <Button
                        variant="outline"
                        className="border-[#ee3433] text-[#ee3433] bg-white"
                        onClick={() => setCommissionRecords({})}
                        disabled={Object.keys(commissionRecords).length === 0}
                      >
                        Clear Table
                      </Button>
                    </div>
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
                                <span className="font-medium text-[#001f3f]">{result.name}</span>
                                <Badge variant="outline" className="text-xs text-[#001f3f]">
                                  Agent
                                </Badge>
                              </div>
                              <div className="text-sm text-[#001f3f] mt-1">
                                Client: {result.clientfamilyname} | Developer: {result.developer}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                Project: {result.projectname} | Unit: {result.unitnum} | TCP:{" "}
                                {formatCurrency(result.tcprice)}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                Reservation Date: {result.reservationdate}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {Object.keys(groupedByDeveloperAndInvoice).map((tabKey) => (
                                <Button
                                  key={tabKey}
                                  size="sm"
                                  onClick={() => {
                                    addAgentToTab(tabKey, result)
                                    toast(
                                      `Agent added to Invoice #${groupedByDeveloperAndInvoice[tabKey].invoiceNumber}`,
                                      { duration: 3000 },
                                    )
                                  }}
                                  className="bg-[#001f3f] text-white hover:bg-[#001f3f]/90"
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add to {groupedByDeveloperAndInvoice[tabKey].invoiceNumber}({groupedByDeveloperAndInvoice[tabKey].developerName})
                                </Button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isSearching && (
                    <div className="mt-4 text-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#001f3f]" />
                      <p className="text-sm text-[#001f3f] mt-2">Searching...</p>
                    </div>
                  )}

                  {searchResults.length === 0 &&
                    !isSearching &&
                    (searchData.agentName || searchData.clientName || searchData.year) && (
                      <div className="mt-4 text-center py-4">
                        <p className="text-sm text-gray-500">No results found. Try adjusting your search criteria.</p>
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
                  {Object.entries(groupedByDeveloperAndInvoice).map(([key, group]) => (
                    <TabsTrigger
                      key={key}
                      value={key}
                      className="data-[state=active]:bg-[#001f3f] data-[state=active]:text-white text-[#001f3f] font-medium px-4 py-2 bg-white whitespace-nowrap"
                    >
                      Invoice # {group.invoiceNumber} - {group.developerName}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {Object.entries(groupedByDeveloperAndInvoice).map(([key, group]) => {
                  const tabCommissionRecords = commissionRecords[key] || []
                  const firstSale = group.sales[0] // Use first sale for display details

                  return (
                    <TabsContent key={key} value={key} className="mt-0 space-y-4 bg-white">
                      {/* Sale Record Details Card */}
                      <Card className="border border-gray-200 shadow-sm bg-white">
                        <CardHeader className="bg-gray-50 border-b border-gray-200 py-3">
                          <CardTitle className="text-lg font-semibold text-[#001f3f]">
                            Sale Record Details - Invoice # {group.invoiceNumber}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 bg-white">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-[#001f3f]" />
                                <span className="text-sm font-medium text-[#001f3f]">Tax Month:</span>
                                <span className="text-sm text-[#001f3f]">
                                  {format(new Date(firstSale.tax_month), "MMM yyyy")}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-[#001f3f]">TIN:</span>
                                <span className="text-sm font-mono text-[#001f3f]">{formatTin(firstSale.tin)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-[#001f3f]">Name:</span>
                                <span className="text-sm text-[#001f3f]">{firstSale.name}</span>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-[#001f3f]">Tax Type:</span>
                                <Badge className={getTaxTypeBadgeColor(firstSale.tax_type)}>
                                  {firstSale.tax_type?.toUpperCase()}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-[#001f3f]">Sale Type:</span>
                                <Badge
                                  className={
                                    firstSale.sale_type === "invoice"
                                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                      : "bg-orange-50 text-orange-800 border border-orange-200"
                                  }
                                >
                                  {firstSale.sale_type?.toUpperCase() || "INVOICE"}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-[#001f3f]">Gross Taxable:</span>
                                <span className="text-sm font-semibold text-[#001f3f]">
                                  {formatCurrency(firstSale.gross_taxable || 0)}
                                </span>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-[#001f3f]">Total Actual Amount:</span>
                                <span className="text-sm font-semibold text-[#001f3f]">
                                  {formatCurrency(firstSale.total_actual_amount || 0)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-[#001f3f]">Invoice #:</span>
                                <span className="text-sm text-[#001f3f]">{firstSale.invoice_number || "N/A"}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-[#001f3f]">Pickup Date:</span>
                                <span className="text-sm text-[#001f3f]">
                                  {firstSale.pickup_date
                                    ? format(new Date(firstSale.pickup_date), "MMM dd, yyyy")
                                    : "N/A"}
                                </span>
                              </div>
                            </div>

                            <div className="space-y-2 md:col-span-2 lg:col-span-3">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-[#001f3f]" />
                                <span className="text-sm font-medium text-[#001f3f]">Area:</span>
                                <span className="text-sm bg-gray-100 px-2 py-1 rounded text-[#001f3f]">
                                  {firstSale.user_assigned_area || "N/A"}
                                </span>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="text-sm font-medium text-[#001f3f]">Files:</span>
                                <div className="flex flex-wrap gap-1">
                                  {firstSale.cheque && firstSale.cheque.length > 0 && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 px-2 py-1 rounded-lg shadow-sm"
                                    >
                                      Cheque ({firstSale.cheque.length})
                                    </Badge>
                                  )}
                                  {firstSale.voucher && firstSale.voucher.length > 0 && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs font-semibold bg-green-50 text-green-800 border border-green-200 px-2 py-1 rounded-lg shadow-sm"
                                    >
                                      Voucher ({firstSale.voucher.length})
                                    </Badge>
                                  )}
                                  {firstSale.invoice && firstSale.invoice.length > 0 && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs font-semibold bg-green-50 text-green-800 border border-green-200 px-2 py-1 rounded-lg shadow-sm"
                                    >
                                      Invoice ({firstSale.invoice.length})
                                    </Badge>
                                  )}
                                  {firstSale.doc_2307 && firstSale.doc_2307.length > 0 && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs font-semibold bg-gray-50 text-gray-800 border border-gray-200 px-2 py-1 rounded-lg shadow-sm"
                                    >
                                      2307 ({firstSale.doc_2307.length})
                                    </Badge>
                                  )}
                                  {firstSale.deposit_slip && firstSale.deposit_slip.length > 0 && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs font-semibold bg-green-50 text-green-800 border border-green-200 px-2 py-1 rounded-lg shadow-sm"
                                    >
                                      Deposit ({firstSale.deposit_slip.length})
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
                            Commission Records - Invoice # {group.invoiceNumber}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 bg-white">
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-gray-50 border-b border-gray-200">
                                  <TableHead className="font-semibold text-[#001f3f] text-center">NO.</TableHead>
                                  <TableHead className="font-semibold text-[#001f3f]">DATE</TableHead>
                                  <TableHead className="font-semibold text-[#001f3f]">DEVELOPER</TableHead>
                                  <TableHead className="font-semibold text-[#001f3f]">Agent Name</TableHead>
                                  <TableHead className="font-semibold text-[#001f3f]">CLIENT</TableHead>
                                  <TableHead className="font-semibold text-[#001f3f]">Reservation Date</TableHead>
                                  <TableHead className="font-semibold text-[#001f3f] text-center">COMM</TableHead>
                                  <TableHead className="font-semibold text-[#001f3f] text-center">Type</TableHead>
                                  <TableHead className="font-semibold text-[#001f3f] text-center">
                                    BDO Account #
                                  </TableHead>
                                  <TableHead className="font-semibold text-[#001f3f] text-center">Net of VAT</TableHead>
                                  <TableHead className="font-semibold text-[#001f3f] text-center">STATUS</TableHead>
                                  <TableHead className="font-semibold bg-[#001f3f] text-white text-center">
                                    Calculation Type
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
                                    EWT RATE
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
                                    UM BDO Account #
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
                                    EWT RATE
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
                                    TL BDO Account #
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
                                    TL Rate
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
                                    EWT RATE
                                  </TableHead>
                                  <TableHead
                                    className="font-semibold text-[#001f3f] text-center"
                                    style={{ background: "#FEEFC6" }}
                                  >
                                    NET COMM
                                  </TableHead>
                                  <TableHead className="font-semibold text-[#ee3433] text-center">Remarks</TableHead>
                                  <TableHead className="font-semibold text-[#ee3433] text-center">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody className="bg-white">
                                {tabCommissionRecords.length > 0 ? (
                                  <>
                                    {tabCommissionRecords.map((record, index) => (
                                      <TableRow key={index} className="border-b border-gray-100 hover:bg-gray-50">
                                        <TableCell className="text-center font-medium text-[#001f3f]">
                                          {record.no}
                                        </TableCell>
                                        <TableCell className="text-[#001f3f]">
                                          {format(new Date(record.date), "MMM dd, yyyy")}
                                        </TableCell>
                                        <TableCell className="font-medium text-[#001f3f]">
                                          <textarea
                                            className="border border-gray-300 rounded px-2 py-1 w-32 text-[#001f3f] bg-white font-medium resize-vertical min-h-[2.5rem] max-h-32"
                                            value={record.developer}
                                            onChange={(e) => {
                                              handleCommissionRecordChange(key, index, "developer", e.target.value)
                                            }}
                                            placeholder="Developer Name"
                                          />
                                        </TableCell>
                                        <TableCell className="text-[#001f3f]">{record.agentName}</TableCell>
                                        <TableCell className="text-[#001f3f]">{record.client}</TableCell>
                                        <TableCell className="text-[#001f3f]">{record.reservationDate}</TableCell>
                                        {/* COMM input */}
                                        <TableCell className="text-right font-semibold text-[#001f3f]">
                                          <input
                                            type="text"
                                            inputMode="decimal"
                                            className="border border-gray-300 rounded px-2 py-1 w-24 text-right text-[#001f3f] bg-white"
                                            value={record.comm}
                                            onChange={(e) => {
                                              // Only allow numbers and commas
                                              let val = e.target.value.replace(/[^\d.,]/g, "")
                                              // Format as currency
                                              val = formatNumberWithCommas(val)
                                              console.log(`COMM changed: ${val}`)
                                              handleCommissionRecordChange(key, index, "comm", val)
                                            }}
                                            placeholder="0.00"
                                          />
                                        </TableCell>
                                        {/* Type Dropdown */}
                                        <TableCell>
                                          <select
                                            className="border border-gray-300 rounded px-2 py-1 text-[#001f3f] bg-white"
                                            value={record.type || "COMM"}
                                            onChange={(e) => {
                                              handleCommissionRecordChange(key, index, "type", e.target.value)
                                            }}
                                          >
                                            <option value="COMM">COMM</option>
                                            <option value="INCENTIVES">INCENTIVES</option>
                                            <option value="COMM & INCENTIVES">COMM & INCENTIVES</option>
                                          </select>
                                        </TableCell>
                                        {/* BDO Account # Input */}
                                        <TableCell>
                                          <input
                                            type="text"
                                            className="border border-gray-300 rounded px-2 py-1 w-32 text-[#001f3f] bg-white"
                                            value={record.bdoAccount || ""}
                                            onChange={(e) => {
                                              handleCommissionRecordChange(key, index, "bdoAccount", e.target.value)
                                            }}
                                            placeholder="BDO Account #"
                                          />
                                        </TableCell>
                                        {/* Net of VAT */}
                                        <TableCell className="text-right font-semibold text-[#001f3f]">
                                          {record.netOfVat ? formatCurrency(Number(record.netOfVat)) : ""}
                                        </TableCell>
                                        {/* Status input */}
                                        <TableCell className="text-center">
                                          <input
                                            type="text"
                                            className="border border-gray-300 rounded px-2 py-1 w-20 text-center text-[#001f3f] bg-white"
                                            value={record.status}
                                            onChange={(e) =>
                                              handleCommissionRecordChange(key, index, "status", e.target.value)
                                            }
                                            placeholder="Status"
                                          />
                                        </TableCell>
                                        {/* Calculation Type Dropdown */}
                                        <TableCell className="bg-[#a0d9ef]">
                                          <select
                                            className="border border-gray-300 rounded px-2 py-1 text-[#001f3f] bg-white"
                                            value={record.calculationType}
                                            onChange={(e) => {
                                              console.log(`Agent Calculation Type changed: ${e.target.value}`)
                                              handleCommissionRecordChange(
                                                key,
                                                index,
                                                "calculationType",
                                                e.target.value,
                                              )
                                            }}
                                          >
                                            <option value="nonvat with invoice">nonvat with invoice</option>
                                            <option value="nonvat without invoice">nonvat without invoice</option>
                                            <option value="vat with invoice">vat with invoice</option>
                                            <option value="vat deduction">vat deduction</option>
                                          </select>
                                        </TableCell>
                                        {/* Agent's Rate dropdown */}
                                        <TableCell className="text-center font-medium text-[#dee242] bg-[#a0d9ef]">
                                          <select
                                            className="border border-gray-300 rounded px-2 py-1 text-[#001f3f] bg-white"
                                            value={record.agentsRate}
                                            onChange={(e) => {
                                              console.log(`Agent Rate changed: ${e.target.value}`)
                                              handleCommissionRecordChange(key, index, "agentsRate", e.target.value)
                                            }}
                                          >
                                            <option value="0">0%</option>
                                            {[...Array(24)].map((_, i) => {
                                              const rate = (0.5 + i * 0.5).toFixed(1)
                                              return (
                                                <option key={rate} value={rate}>
                                                  {rate}%
                                                </option>
                                              )
                                            })}
                                          </select>
                                        </TableCell>
                                        {/* Developer's Rate dropdown */}
                                        <TableCell className="text-center font-medium text-[#dee242] bg-[#a0d9ef]">
                                          <select
                                            className="border border-gray-300 rounded px-2 py-1 text-[#001f3f] bg-white"
                                            value={record.developersRate}
                                            onChange={(e) => {
                                              console.log(`Developer Rate changed: ${e.target.value}`)
                                              handleCommissionRecordChange(key, index, "developersRate", e.target.value)
                                            }}
                                          >
                                            {[...Array(23)].map((_, i) => {
                                              const rate = (1 + i * 0.5).toFixed(1)
                                              return (
                                                <option key={rate} value={rate}>
                                                  {rate}%
                                                </option>
                                              )
                                            })}
                                          </select>
                                        </TableCell>
                                        {/* AGENT */}
                                        <TableCell className="text-right font-semibold text-[#001f3f] bg-[#a0d9ef]">
                                          {record.agent ? formatCurrency(Number(record.agent)) : ""}
                                        </TableCell>
                                        {/* VAT */}
                                        <TableCell className="text-right font-semibold text-[#001f3f] bg-[#a0d9ef]">
                                          {record.vat ? formatCurrency(Number(record.vat)) : ""}
                                        </TableCell>
                                        {/* EWT */}
                                        <TableCell className="text-right font-semibold text-[#ee3433] bg-[#a0d9ef]">
                                          {record.ewt ? formatCurrency(Number(record.ewt)) : ""}
                                        </TableCell>
                                        {/* EWT Rate Dropdown - Agent */}
                                        <TableCell className="text-center font-semibold bg-[#a0d9ef]">
                                          {(() => {
                                            const ewtProps = getEwtDropdownProps(record.calculationType)
                                            if (!ewtProps.show) return null
                                            return (
                                              <select
                                                className="border border-gray-300 rounded px-2 py-1 text-[#001f3f] bg-white w-20"
                                                value={record.ewtRate || ewtProps.options[0].toString()}
                                                onChange={(e) => {
                                                  handleCommissionRecordChange(key, index, "ewtRate", e.target.value)
                                                }}
                                                disabled={ewtProps.options.length === 1}
                                              >
                                                {ewtProps.options.map((rate) => (
                                                  <option key={rate} value={rate}>{rate}%</option>
                                                ))}
                                              </select>
                                            )
                                          })()}
                                        </TableCell>
                                        {/* Net Comm */}
                                        <TableCell className="text-right font-bold text-white bg-[#a0d9ef]">
                                          {record.netComm ? formatCurrency(Number(record.netComm)) : ""}
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
                                              handleCommissionRecordChange(key, index, "umName", e.target.value)
                                            }
                                            placeholder="UM Name"
                                          />
                                        </TableCell>
                                        {/* BDO Account # Input */}
                                        <TableCell
                                          className="text-[#fff] font-semibold"
                                          style={{ background: "#E34A27" }}
                                        >
                                          <input
                                            type="text"
                                            className="border border-gray-300 rounded px-2 py-1 w-32 text-[#001f3f] bg-white"
                                            value={record.umBdoAccount || ""}
                                            onChange={(e) => {
                                              handleCommissionRecordChange(key, index, "umBdoAccount", e.target.value)
                                            }}
                                            placeholder="UM BDO Account #"
                                          />
                                        </TableCell>
                                        <TableCell
                                          className="text-center font-semibold"
                                          style={{ background: "#E34A27" }}
                                        >
                                          <select
                                            className="border border-gray-300 rounded px-2 py-1 text-[#E34A27] bg-white font-bold"
                                            value={record.umCalculationType}
                                            onChange={(e) => {
                                              console.log(`UM Calculation Type changed: ${e.target.value}`)
                                              handleCommissionRecordChange(
                                                key,
                                                index,
                                                "umCalculationType",
                                                e.target.value,
                                              )
                                            }}
                                          >
                                            <option value="nonvat with invoice">nonvat with invoice</option>
                                            <option value="nonvat without invoice">nonvat without invoice</option>
                                            <option value="vat with invoice">vat with invoice</option>
                                            <option value="vat deduction">vat deduction</option>
                                          </select>
                                        </TableCell>
                                        <TableCell
                                          className="text-center font-semibold"
                                          style={{ background: "#E34A27" }}
                                        >
                                          <select
                                            className="border border-gray-300 rounded px-2 py-1 text-[#E34A27] bg-white font-bold"
                                            value={record.umRate}
                                            onChange={(e) => {
                                              console.log(`UM Rate changed: ${e.target.value}`)
                                              handleCommissionRecordChange(key, index, "umRate", e.target.value)
                                            }}
                                          >
                                            <option value="0">0%</option>
                                            {[...Array(24)].map((_, i) => {
                                              const rate = (0.5 + i * 0.5).toFixed(1)
                                              return (
                                                <option key={rate} value={rate}>
                                                  {rate}%
                                                </option>
                                              )
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
                                            onChange={(e) => {
                                              console.log(`UM Developer Rate changed: ${e.target.value}`)
                                              handleCommissionRecordChange(
                                                key,
                                                index,
                                                "umDevelopersRate",
                                                e.target.value,
                                              )
                                            }}
                                          >
                                            {[...Array(23)].map((_, i) => {
                                              const rate = (1 + i * 0.5).toFixed(1)
                                              return (
                                                <option key={rate} value={rate}>
                                                  {rate}%
                                                </option>
                                              )
                                            })}
                                          </select>
                                        </TableCell>
                                        <TableCell
                                          className="text-right font-semibold"
                                          style={{ background: "#E34A27" }}
                                        >
                                          {record.umAmount ? formatCurrency(Number(record.umAmount)) : ""}
                                        </TableCell>
                                        <TableCell
                                          className="text-right font-semibold"
                                          style={{ background: "#E34A27" }}
                                        >
                                          {record.umVat ? formatCurrency(Number(record.umVat)) : ""}
                                        </TableCell>
                                        <TableCell
                                          className="text-right font-semibold"
                                          style={{ background: "#E34A27" }}
                                        >
                                          {record.umEwt ? formatCurrency(Number(record.umEwt)) : ""}
                                        </TableCell>
                                        {/* EWT Rate Dropdown - UM */}
                                        <TableCell
                                          className="text-center font-semibold"
                                          style={{ background: "#E34A27" }}
                                        >
                                          {(() => {
                                            const ewtProps = getEwtDropdownProps(record.umCalculationType)
                                            if (!ewtProps.show) return null
                                            return (
                                              <select
                                                className="border border-gray-300 rounded px-2 py-1 text-[#E34A27] bg-white font-bold w-20"
                                                value={record.umEwtRate || ewtProps.options[0].toString()}
                                                onChange={(e) => {
                                                  handleCommissionRecordChange(key, index, "umEwtRate", e.target.value)
                                                }}
                                                disabled={ewtProps.options.length === 1}
                                              >
                                                {ewtProps.options.map((rate) => (
                                                  <option key={rate} value={rate}>{rate}%</option>
                                                ))}
                                              </select>
                                            )
                                          })()}
                                        </TableCell>
                                        <TableCell
                                          className="text-right font-bold"
                                          style={{
                                            background: "#E34A27",
                                            color: "#fff",
                                          }}
                                        >
                                          {record.umNetComm ? formatCurrency(Number(record.umNetComm)) : ""}
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
                                              handleCommissionRecordChange(key, index, "tlName", e.target.value)
                                            }
                                            placeholder="TL Name"
                                          />
                                        </TableCell>
                                        {/* BDO Account # Input */}
                                        <TableCell
                                          className="text-[#fff] font-semibold"
                                          style={{ background: "#FEEFC6" }}
                                        >
                                          <input
                                            type="text"
                                            className="border border-gray-300 rounded px-2 py-1 w-32 text-[#001f3f] bg-white"
                                            value={record.tlBdoAccount || ""}
                                            onChange={(e) => {
                                              handleCommissionRecordChange(key, index, "tlBdoAccount", e.target.value)
                                            }}
                                            placeholder="TL BDO Account #"
                                          />
                                        </TableCell>
                                        <TableCell
                                          className="text-center font-semibold"
                                          style={{ background: "#FEEFC6" }}
                                        >
                                          <select
                                            className="border border-gray-300 rounded px-2 py-1 text-[#001f3f] bg-white font-bold"
                                            value={record.tlCalculationType}
                                            onChange={(e) => {
                                              console.log(`TL Calculation Type changed: ${e.target.value}`)
                                              handleCommissionRecordChange(
                                                key,
                                                index,
                                                "tlCalculationType",
                                                e.target.value,
                                              )
                                            }}
                                          >
                                            <option value="nonvat with invoice">nonvat with invoice</option>
                                            <option value="nonvat without invoice">nonvat without invoice</option>
                                            <option value="vat with invoice">vat with invoice</option>
                                            <option value="vat deduction">vat deduction</option>
                                          </select>
                                        </TableCell>
                                        <TableCell
                                          className="text-center font-semibold"
                                          style={{ background: "#FEEFC6" }}
                                        >
                                          <select
                                            className="border border-gray-300 rounded px-2 py-1 text-[#001f3f] bg-white font-bold"
                                            value={record.tlRate}
                                            onChange={(e) => {
                                              console.log(`TL Rate changed: ${e.target.value}`)
                                              handleCommissionRecordChange(key, index, "tlRate", e.target.value)
                                            }}
                                          >
                                            <option value="0">0%</option>
                                            {[...Array(24)].map((_, i) => {
                                              const rate = (0.5 + i * 0.5).toFixed(1)
                                              return (
                                                <option key={rate} value={rate}>
                                                  {rate}%
                                                </option>
                                              )
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
                                            onChange={(e) => {
                                              console.log(`TL Developer Rate changed: ${e.target.value}`)
                                              handleCommissionRecordChange(
                                                key,
                                                index,
                                                "tlDevelopersRate",
                                                e.target.value,
                                              )
                                            }}
                                          >
                                            {[...Array(23)].map((_, i) => {
                                              const rate = (1 + i * 0.5).toFixed(1)
                                              return (
                                                <option key={rate} value={rate}>
                                                  {rate}%
                                                </option>
                                              )
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
                                          {record.tlAmount ? formatCurrency(Number(record.tlAmount)) : ""}
                                        </TableCell>
                                        <TableCell
                                          className="text-right font-semibold"
                                          style={{
                                            background: "#FEEFC6",
                                            color: "#001f3f",
                                          }}
                                        >
                                          {record.tlVat ? formatCurrency(Number(record.tlVat)) : ""}
                                        </TableCell>
                                        <TableCell
                                          className="text-right font-semibold"
                                          style={{
                                            background: "#FEEFC6",
                                            color: "#001f3f",
                                          }}
                                        >
                                          {record.tlEwt ? formatCurrency(Number(record.tlEwt)) : ""}
                                        </TableCell>
                                        {/* EWT Rate Dropdown - TL */}
                                        <TableCell
                                          className="text-center font-semibold"
                                          style={{ background: "#FEEFC6" }}
                                        >
                                          {(() => {
                                            const ewtProps = getEwtDropdownProps(record.tlCalculationType)
                                            if (!ewtProps.show) return null
                                            return (
                                              <select
                                                className="border border-gray-300 rounded px-2 py-1 text-[#001f3f] bg-white font-bold w-20"
                                                value={record.tlEwtRate || ewtProps.options[0].toString()}
                                                onChange={(e) => {
                                                  handleCommissionRecordChange(key, index, "tlEwtRate", e.target.value)
                                                }}
                                                disabled={ewtProps.options.length === 1}
                                              >
                                                {ewtProps.options.map((rate) => (
                                                  <option key={rate} value={rate}>{rate}%</option>
                                                ))}
                                              </select>
                                            )
                                          })()}
                                        </TableCell>
                                        <TableCell
                                          className="text-right font-bold"
                                          style={{
                                            background: "#FEEFC6",
                                            color: "#001f3f",
                                          }}
                                        >
                                          {record.tlNetComm ? formatCurrency(Number(record.tlNetComm)) : ""}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          <textarea
                                            className="border border-gray-300 rounded px-2 py-1 w-32 text-[#ee3433] bg-white font-medium resize-vertical min-h-[2.5rem] max-h-32"
                                            value={record.remarks || ""}
                                            onChange={(e) => handleCommissionRecordChange(key, index, "remarks", e.target.value)}
                                            placeholder="Remarks"
                                          />
                                        </TableCell>
                                        <TableCell className="text-center">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-red-500 text-red-600 hover:bg-red-50 bg-transparent"
                                            onClick={() => removeAgentFromTab(key, index)}
                                          >
                                            Remove
                                          </Button>
                                        </TableCell>
                                        {/* Hidden fields */}
                                        <input type="hidden" name={`commissionRecords[${key}][${index}][lrsalesId]`} value={record.lrsalesId ?? ""} />
                                        <input type="hidden" name={`commissionRecords[${key}][${index}][memberid]`} value={record.memberid ?? ""} />
                                        <input type="hidden" name={`commissionRecords[${key}][${index}][saleId]`} value={group.saleId ?? ""} />
                                        <input type="hidden" name={`commissionRecords[${key}][${index}][invoiceNumber]`} value={group.invoiceNumber ?? ""} />
                                      </TableRow>
                                    ))}
                                    {/* Combined Totals Row */}
                                    <TableRow className="bg-gray-100 font-bold">
                                      {/* Agent Totals */}
                                      <TableCell colSpan={6} className="text-right text-[#001f3f]">
                                        Totals:
                                      </TableCell>
                                      <TableCell className="text-right text-[#001f3f]">
                                        {formatCurrency(
                                          tabCommissionRecords.reduce(
                                            (sum, r) => sum + (Number.parseFloat(r.comm.replace(/,/g, "")) || 0),
                                            0,
                                          ),
                                        )}
                                      </TableCell>
                                      <TableCell />
                                      <TableCell />
                                      <TableCell className="text-right text-[#001f3f]">
                                        {formatCurrency(
                                          tabCommissionRecords.reduce(
                                            (sum, r) => sum + (Number.parseFloat(r.netOfVat) || 0),
                                            0,
                                          ),
                                        )}
                                      </TableCell>
                                      <TableCell />
                                      <TableCell />
                                      <TableCell />
                                      <TableCell />
                                      <TableCell className="text-right text-[#001f3f]">
                                        {formatCurrency(
                                          tabCommissionRecords.reduce(
                                            (sum, r) => sum + (Number.parseFloat(r.agent) || 0),
                                            0,
                                          ),
                                        )}
                                      </TableCell>
                                      <TableCell className="text-right text-[#001f3f]">
                                        {formatCurrency(
                                          tabCommissionRecords.reduce(
                                            (sum, r) => sum + (Number.parseFloat(r.vat) || 0),
                                            0,
                                          ),
                                        )}
                                      </TableCell>
                                      <TableCell className="text-right text-[#001f3f]">
                                        {formatCurrency(
                                          tabCommissionRecords.reduce(
                                            (sum, r) => sum + (Number.parseFloat(r.ewt) || 0),
                                            0,
                                          ),
                                        )}
                                      </TableCell>
                                      <TableCell />
                                      <TableCell className="text-right text-[#001f3f]">
                                        {formatCurrency(
                                          tabCommissionRecords.reduce(
                                            (sum, r) => sum + (Number.parseFloat(r.netComm) || 0),
                                            0,
                                          ),
                                        )}
                                      </TableCell>
                                      <TableCell />
                                      {/* UM Totals */}
                                      <TableCell />
                                      <TableCell />
                                      <TableCell />
                                      <TableCell />
                                      <TableCell className="text-right text-[#E34A27]">
                                        {formatCurrency(
                                          tabCommissionRecords.reduce(
                                            (sum, r) => sum + (Number.parseFloat(r.umAmount) || 0),
                                            0,
                                          ),
                                        )}
                                      </TableCell>
                                      <TableCell className="text-right text-[#E34A27]">
                                        {formatCurrency(
                                          tabCommissionRecords.reduce(
                                            (sum, r) => sum + (Number.parseFloat(r.umVat) || 0),
                                            0,
                                          ),
                                        )}
                                      </TableCell>
                                      <TableCell className="text-right text-[#E34A27]">
                                        {formatCurrency(
                                          tabCommissionRecords.reduce(
                                            (sum, r) => sum + (Number.parseFloat(r.umEwt) || 0),
                                            0,
                                          ),
                                        )}
                                      </TableCell>
                                      <TableCell />
                                      <TableCell className="text-right text-[#E34A27]">
                                        {formatCurrency(
                                          tabCommissionRecords.reduce(
                                            (sum, r) => sum + (Number.parseFloat(r.umNetComm) || 0),
                                            0,
                                          ),
                                        )}
                                      </TableCell>
                                      <TableCell />
                                      {/* TL Totals */}
                                      <TableCell />
                                      <TableCell />
                                      <TableCell />
                                      <TableCell />
                                      <TableCell className="text-right text-[#001f3f]">
                                        {formatCurrency(
                                          tabCommissionRecords.reduce(
                                            (sum, r) => sum + (Number.parseFloat(r.tlAmount) || 0),
                                            0,
                                          ),
                                        )}
                                      </TableCell>
                                      <TableCell className="text-right text-[#001f3f]">
                                        {formatCurrency(
                                          tabCommissionRecords.reduce(
                                            (sum, r) => sum + (Number.parseFloat(r.tlVat) || 0),
                                            0,
                                          ),
                                        )}
                                      </TableCell>
                                      <TableCell className="text-right text-[#001f3f]">
                                        {formatCurrency(
                                          tabCommissionRecords.reduce(
                                            (sum, r) => sum + (Number.parseFloat(r.tlEwt) || 0),
                                            0,
                                          ),
                                        )}
                                      </TableCell>
                                      <TableCell />
                                      <TableCell className="text-right text-[#001f3f]">
                                        {formatCurrency(
                                          tabCommissionRecords.reduce(
                                            (sum, r) => sum + (Number.parseFloat(r.tlNetComm) || 0),
                                            0,
                                          ),
                                        )}
                                      </TableCell>
                                      <TableCell />
                                      <TableCell />
                                    </TableRow>
                                  </>
                                ) : (
                                  <TableRow>
                                    <TableCell colSpan={32} className="text-center text-gray-400 py-8">
                                      No commission records added yet. Use the search above to add agents.
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
                            <input type="hidden" name={`sales[${key}][${index}][id]`} value={sale.id} />
                            <input type="hidden" name={`sales[${key}][${index}][tin]`} value={sale.tin} />
                            <input type="hidden" name={`sales[${key}][${index}][name]`} value={sale.name} />
                            <input type="hidden" name={`sales[${key}][${index}][tax_type]`} value={sale.tax_type} />
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
                            <input type="hidden" name={`sales[${key}][${index}][tax_month]`} value={sale.tax_month} />
                            <input
                              type="hidden"
                              name={`sales[${key}][${index}][pickup_date]`}
                              value={sale.pickup_date || ""}
                            />
                            <input type="hidden" name={`sales[${key}][${index}][user_uuid]`} value={sale.user_uuid} />
                            <input
                              type="hidden"
                              name={`sales[${key}][${index}][user_assigned_area]`}
                              value={sale.user_assigned_area || ""}
                            />
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  )
                })}
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
            disabled={Object.keys(groupedByDeveloperAndInvoice).length === 0 || isGeneratingExcel}
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
                Generate Excel Report
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
