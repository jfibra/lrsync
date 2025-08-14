"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, Search, Plus, Save } from "lucide-react"
import { format } from "date-fns"
import { toast, Toaster } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"

interface CommissionEditModalProps {
  isOpen: boolean
  onClose: () => void
  reportData: any
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
  uuid?: string
  ewtRate?: string
  umEwtRate?: string
  tlEwtRate?: string
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
  umName: string
  umCalculationType: string
  umRate: string
  umDevelopersRate: string
  umAmount: string
  umVat: string
  umEwt: string
  umNetComm: string
  tlName: string
  tlCalculationType: string
  tlRate: string
  tlDevelopersRate: string
  tlAmount: string
  tlVat: string
  tlEwt: string
  tlNetComm: string
  lrsalesId?: number
  memberid?: number
  bdoAccount?: string
  umBdoAccount?: string
  tlBdoAccount?: string
  remarks?: string
  type?: "COMM" | "INCENTIVES" | "COMM & INCENTIVES"
}

export function CommissionEditModal({ isOpen, onClose, reportData, userArea, userFullName }: CommissionEditModalProps) {
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
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [commissionRecords, setCommissionRecords] = useState<Record<string, CommissionRecord[]>>({})
  const [isLoadingExistingData, setIsLoadingExistingData] = useState(false)

  const { profile } = useAuth()
  const supabase = createClient()

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

  const formatNumberWithCommas = (value: string) => {
    // Remove all non-digit characters except decimal point
    const cleanValue = value.replace(/[^\d.]/g, "")

    // Split by decimal point
    const parts = cleanValue.split(".")

    // Add commas to the integer part
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")

    // Rejoin with decimal point (limit to 2 decimal places)
    return parts.length > 1 ? `${parts[0]}.${parts[1].slice(0, 2)}` : parts[0]
  }

  // Load existing commission data when modal opens
  useEffect(() => {
    if (isOpen && reportData) {
      loadExistingCommissionData()
    }
  }, [isOpen, reportData])

  const loadExistingCommissionData = async () => {
    if (!reportData?.uuid) return

    setIsLoadingExistingData(true)
    try {
      // Fetch existing commission agent breakdown data
      const { data: breakdownData, error } = await supabase
        .from("commission_agent_breakdown")
        .select("*")
        .eq("commission_report_uuid", reportData.uuid)
        .order("created_at", { ascending: true })

      if (error) {
        console.error("Error loading commission data:", error)
        toast.error("Failed to load existing commission data")
        return
      }

      if (breakdownData && breakdownData.length > 0) {
        // Group by developer and invoice (we'll use a single tab for now)
        const groupedRecords: Record<string, CommissionRecord[]> = {}
        const tabKey = `${reportData.uuid}-edit`

        groupedRecords[tabKey] = breakdownData.map((item, index) => ({
          uuid: item.uuid,
          no: index + 1,
          date: item.created_at ? format(new Date(item.created_at), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
          developer: item.developer || "",
          agentName: item.agent_name || "",
          client: item.client || "",
          reservationDate: item.reservation_date ? format(new Date(item.reservation_date), "yyyy-MM-dd") : "",
          calculationType: item.calculation_type || "nonvat with invoice",
          comm: item.comm?.toString() || "",
          netOfVat: item.net_of_vat?.toString() || "",
          status: item.status || "",
          agentsRate: item.agents_rate?.toString() || "4.0",
          developersRate: item.developers_rate?.toString() || "5.0",
          agent: item.agent_amount?.toString() || "",
          vat: item.agent_vat?.toString() || "",
          ewt: item.agent_ewt?.toString() || "",
          ewtRate: item.agent_ewt_rate?.toString() || "5",
          netComm: item.agent_net_comm?.toString() || "",
          umName: item.um_name || "",
          umCalculationType: item.um_calculation_type || "nonvat with invoice",
          umRate: item.um_rate?.toString() || "4.0",
          umDevelopersRate: item.um_developers_rate?.toString() || "5.0",
          umAmount: item.um_amount?.toString() || "",
          umVat: item.um_vat?.toString() || "",
          umEwt: item.um_ewt?.toString() || "",
          umEwtRate: item.um_ewt_rate?.toString() || "5",
          umNetComm: item.um_net_comm?.toString() || "",
          tlName: item.tl_name || "",
          tlCalculationType: item.tl_calculation_type || "nonvat with invoice",
          tlRate: item.tl_rate?.toString() || "4.0",
          tlDevelopersRate: item.tl_developers_rate?.toString() || "5.0",
          tlAmount: item.tl_amount?.toString() || "",
          tlVat: item.tl_vat?.toString() || "",
          tlEwt: item.tl_ewt?.toString() || "",
          tlEwtRate: item.tl_ewt_rate?.toString() || "5",
          tlNetComm: item.tl_net_comm?.toString() || "",
          lrsalesId: item.lrsalesid ? Number.parseInt(item.lrsalesid) : undefined,
          memberid: item.memberid ? Number.parseInt(item.memberid) : undefined,
          bdoAccount: item.bdo_account || "",
          umBdoAccount: item.um_bdo_account || "",
          tlBdoAccount: item.tl_bdo_account || "",
          remarks: item.secretary_remarks || "",
          type: (item.comm_type as "COMM" | "INCENTIVES" | "COMM & INCENTIVES") || "COMM",
        }))

        setCommissionRecords(groupedRecords)
        setActiveTab(tabKey)
      }
    } catch (error) {
      console.error("Error loading commission data:", error)
      toast.error("Failed to load existing commission data")
    } finally {
      setIsLoadingExistingData(false)
    }
  }

  // Handle search input changes
  const handleSearchChange = (field: string, value: string) => {
    setSearchData((prev) => ({
      ...prev,
      [field]: value,
    }))
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
    const existingRecords = commissionRecords[tabKey] || []
    const newRecord: CommissionRecord = {
      no: existingRecords.length + 1,
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
      agentsRate: "4.0",
      developersRate: "5.0",
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

  // Handle commission record field change
  const handleCommissionRecordChange = (
    tabKey: string,
    index: number,
    field: keyof CommissionRecord,
    value: string,
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

    // If any calculation-affecting field changes, recalculate immediately
    setTimeout(() => {
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
        doCommissionCalculation(tabKey, index)
      }
    }, 0)
  }

  // Commission calculation logic (simplified version from original modal)
  const doCommissionCalculation = (tabKey: string, index: number) => {
    setCommissionRecords((prev) => {
      const updated = { ...prev }
      const records = [...(updated[tabKey] || [])]

      if (!records[index]) return prev

      const record = { ...records[index] }
      const calcType = record.calculationType
      const comm = Number.parseFloat(record.comm.replace(/,/g, "")) || 0
      const agentsRate = Number.parseFloat(record.agentsRate) || 0
      const developersRate = Number.parseFloat(record.developersRate) || 5

      let netOfVat = ""
      let agent = ""
      let vat = ""
      let ewt = ""
      let netComm = ""

      // Agent calculations based on calculation type
      if (calcType === "nonvat with invoice") {
        netOfVat = comm ? String(comm / 1.02) : ""
        agent =
          netOfVat && agentsRate && developersRate
            ? String((Number.parseFloat(netOfVat) * agentsRate) / developersRate)
            : ""
        const agentEwtRate = Number(record.ewtRate || "5") / 100
        ewt = agent ? String(Number.parseFloat(agent) * agentEwtRate) : ""
        netComm = agent && ewt ? String(Number.parseFloat(agent) - Number.parseFloat(ewt)) : ""
        vat = ""
      }
      // Add other calculation types as needed...

      record.netOfVat = netOfVat
      record.agent = agent
      record.vat = vat
      record.ewt = ewt
      record.netComm = netComm

      records[index] = record
      updated[tabKey] = records
      return updated
    })
  }

  // Save updated commission data
  const handleSaveReport = async () => {
    if (!reportData?.uuid) return

    setIsSavingReport(true)
    try {
      const allRecords = Object.values(commissionRecords).flat()

      if (allRecords.length === 0) {
        toast.error("No commission records to save")
        return
      }

      // Update existing records and insert new ones
      for (const record of allRecords) {
        const recordData = {
          commission_report_uuid: reportData.uuid,
          commission_report_number: reportData.report_number,
          agent_uuid: profile?.id || null,
          agent_name: record.agentName,
          developer: record.developer,
          client: record.client,
          reservation_date: record.reservationDate || null,
          comm: record.comm ? Number.parseFloat(record.comm.replace(/,/g, "")) : null,
          comm_type: record.type || "COMM",
          bdo_account: record.bdoAccount || null,
          net_of_vat: record.netOfVat ? Number.parseFloat(record.netOfVat.replace(/,/g, "")) : null,
          status: record.status || null,
          calculation_type: record.calculationType,
          agents_rate: record.agentsRate ? Number.parseFloat(record.agentsRate) : null,
          developers_rate: record.developersRate ? Number.parseFloat(record.developersRate) : null,
          agent_amount: record.agent ? Number.parseFloat(record.agent.replace(/,/g, "")) : null,
          agent_vat: record.vat ? Number.parseFloat(record.vat.replace(/,/g, "")) : null,
          agent_ewt: record.ewt ? Number.parseFloat(record.ewt.replace(/,/g, "")) : null,
          agent_ewt_rate: record.ewtRate ? Number.parseFloat(record.ewtRate) : null,
          agent_net_comm: record.netComm ? Number.parseFloat(record.netComm.replace(/,/g, "")) : null,
          um_name: record.umName || null,
          um_calculation_type: record.umCalculationType || null,
          um_rate: record.umRate ? Number.parseFloat(record.umRate) : null,
          um_developers_rate: record.umDevelopersRate ? Number.parseFloat(record.umDevelopersRate) : null,
          um_amount: record.umAmount ? Number.parseFloat(record.umAmount.replace(/,/g, "")) : null,
          um_vat: record.umVat ? Number.parseFloat(record.umVat.replace(/,/g, "")) : null,
          um_ewt: record.umEwt ? Number.parseFloat(record.umEwt.replace(/,/g, "")) : null,
          um_ewt_rate: record.umEwtRate ? Number.parseFloat(record.umEwtRate) : null,
          um_net_comm: record.umNetComm ? Number.parseFloat(record.umNetComm.replace(/,/g, "")) : null,
          tl_name: record.tlName || null,
          tl_calculation_type: record.tlCalculationType || null,
          tl_rate: record.tlRate ? Number.parseFloat(record.tlRate) : null,
          tl_developers_rate: record.tlDevelopersRate ? Number.parseFloat(record.tlDevelopersRate) : null,
          tl_amount: record.tlAmount ? Number.parseFloat(record.tlAmount.replace(/,/g, "")) : null,
          tl_vat: record.tlVat ? Number.parseFloat(record.tlVat.replace(/,/g, "")) : null,
          tl_ewt: record.tlEwt ? Number.parseFloat(record.tlEwt.replace(/,/g, "")) : null,
          tl_ewt_rate: record.tlEwtRate ? Number.parseFloat(record.tlEwtRate) : null,
          tl_net_comm: record.tlNetComm ? Number.parseFloat(record.tlNetComm.replace(/,/g, "")) : null,
          lrsalesid: record.lrsalesId?.toString() ?? null,
          memberid: record.memberid?.toString() ?? null,
          um_bdo_account: record.umBdoAccount || null,
          tl_bdo_account: record.tlBdoAccount || null,
          secretary_remarks: record.remarks || null,
          updated_at: new Date().toISOString(),
        }

        if (record.uuid) {
          // Update existing record
          const { error } = await supabase.from("commission_agent_breakdown").update(recordData).eq("uuid", record.uuid)

          if (error) {
            console.error("Error updating commission record:", error)
            throw error
          }
        } else {
          // Insert new record
          const { error } = await supabase.from("commission_agent_breakdown").insert(recordData)

          if (error) {
            console.error("Error inserting commission record:", error)
            throw error
          }
        }
      }

      toast.success("Commission report updated successfully!")
      onClose()
    } catch (error) {
      console.error("Error saving commission report:", error)
      toast.error("Failed to save commission report")
    } finally {
      setIsSavingReport(false)
    }
  }

  // Clear search results when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchResults([])
      setCommissionRecords({})
    }
  }, [isOpen])

  const tabKey = `${reportData?.uuid}-edit`
  const tabCommissionRecords = commissionRecords[tabKey] || []

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
            Edit Commission Report #{reportData?.report_number} {userArea && `(${userArea})`} -{" "}
            {format(new Date(), "MMMM dd, yyyy")} - {userFullName || "User"}
          </DialogTitle>
          <p className="text-[#001f3f] mt-1">Edit commission breakdown for report #{reportData?.report_number}</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto max-h-[calc(95vh-200px)]">
          {isLoadingExistingData ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#001f3f]" />
              <span className="ml-2 text-[#001f3f]">Loading existing commission data...</span>
            </div>
          ) : (
            <div className="space-y-6">
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
                        className="border-[#001f3f] text-[#001f3f] bg-transparent"
                        onClick={() => setSearchResults([])}
                        disabled={searchResults.length === 0}
                      >
                        Clear Results
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
                            </div>
                            <Button
                              size="sm"
                              onClick={() => {
                                addAgentToTab(tabKey, result)
                                toast("Agent added to commission report")
                              }}
                              className="bg-[#001f3f] text-white hover:bg-[#001f3f]/90"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border border-gray-200 shadow-sm bg-white">
                <CardHeader className="bg-gray-50 border-b border-gray-200 py-3">
                  <CardTitle className="text-lg font-semibold text-[#001f3f]">
                    Commission Records ({tabCommissionRecords.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50 border-b border-gray-200">
                          <TableHead className="font-semibold text-[#001f3f] text-center">NO.</TableHead>
                          <TableHead className="font-semibold text-[#001f3f]">DATE</TableHead>
                          <TableHead className="font-semibold text-[#001f3f]">DEVELOPER</TableHead>
                          <TableHead className="font-semibold text-[#001f3f]">AGENT NAME</TableHead>
                          <TableHead className="font-semibold text-[#001f3f]">CLIENT</TableHead>
                          <TableHead className="font-semibold text-[#001f3f]">RESERVATION DATE</TableHead>
                          <TableHead className="font-semibold text-[#001f3f] text-center">COMM</TableHead>
                          <TableHead className="font-semibold text-[#001f3f] text-center">TYPE</TableHead>
                          <TableHead className="font-semibold text-[#001f3f] text-center">BDO ACCOUNT #</TableHead>
                          <TableHead className="font-semibold text-[#001f3f] text-center">NET OF VAT</TableHead>
                          <TableHead className="font-semibold text-[#001f3f] text-center">STATUS</TableHead>
                          <TableHead className="font-semibold bg-[#a0d9ef] text-[#001f3f] text-center">
                            CALCULATION TYPE
                          </TableHead>
                          <TableHead className="font-semibold bg-[#a0d9ef] text-[#dee242] text-center">
                            AGENT'S RATE
                          </TableHead>
                          <TableHead className="font-semibold bg-[#a0d9ef] text-[#dee242] text-center">
                            DEVELOPER'S RATE
                          </TableHead>
                          <TableHead className="font-semibold bg-[#a0d9ef] text-[#001f3f] text-center">AGENT</TableHead>
                          <TableHead className="font-semibold bg-[#a0d9ef] text-[#001f3f] text-center">VAT</TableHead>
                          <TableHead className="font-semibold bg-[#a0d9ef] text-[#ee3433] text-center">EWT</TableHead>
                          <TableHead className="font-semibold bg-[#a0d9ef] text-[#001f3f] text-center">
                            EWT RATE
                          </TableHead>
                          <TableHead className="font-semibold bg-[#a0d9ef] text-white text-center">NET COMM</TableHead>
                          <TableHead
                            className="font-semibold text-[#fff] text-center"
                            style={{ background: "#E34A27" }}
                          >
                            UM NAME
                          </TableHead>
                          <TableHead
                            className="font-semibold text-[#fff] text-center"
                            style={{ background: "#E34A27" }}
                          >
                            UM BDO ACCOUNT #
                          </TableHead>
                          <TableHead
                            className="font-semibold text-[#fff] text-center"
                            style={{ background: "#E34A27" }}
                          >
                            UM CALCULATION TYPE
                          </TableHead>
                          <TableHead
                            className="font-semibold text-[#fff] text-center"
                            style={{ background: "#E34A27" }}
                          >
                            UM RATE
                          </TableHead>
                          <TableHead
                            className="font-semibold text-[#fff] text-center"
                            style={{ background: "#E34A27" }}
                          >
                            UM DEVELOPER'S RATE
                          </TableHead>
                          <TableHead
                            className="font-semibold text-[#fff] text-center"
                            style={{ background: "#E34A27" }}
                          >
                            UM
                          </TableHead>
                          <TableHead
                            className="font-semibold text-[#fff] text-center"
                            style={{ background: "#E34A27" }}
                          >
                            UM VAT
                          </TableHead>
                          <TableHead
                            className="font-semibold text-[#fff] text-center"
                            style={{ background: "#E34A27" }}
                          >
                            UM EWT
                          </TableHead>
                          <TableHead
                            className="font-semibold text-[#fff] text-center"
                            style={{ background: "#E34A27" }}
                          >
                            UM EWT RATE
                          </TableHead>
                          <TableHead
                            className="font-semibold text-[#fff] text-center"
                            style={{ background: "#E34A27" }}
                          >
                            UM NET COMM
                          </TableHead>
                          <TableHead
                            className="font-semibold text-[#001f3f] text-center"
                            style={{ background: "#FEEFC6" }}
                          >
                            TL NAME
                          </TableHead>
                          <TableHead
                            className="font-semibold text-[#001f3f] text-center"
                            style={{ background: "#FEEFC6" }}
                          >
                            TL BDO ACCOUNT #
                          </TableHead>
                          <TableHead
                            className="font-semibold text-[#001f3f] text-center"
                            style={{ background: "#FEEFC6" }}
                          >
                            TL CALCULATION TYPE
                          </TableHead>
                          <TableHead
                            className="font-semibold text-[#001f3f] text-center"
                            style={{ background: "#FEEFC6" }}
                          >
                            TL RATE
                          </TableHead>
                          <TableHead
                            className="font-semibold text-[#001f3f] text-center"
                            style={{ background: "#FEEFC6" }}
                          >
                            TL DEVELOPER'S RATE
                          </TableHead>
                          <TableHead
                            className="font-semibold text-[#001f3f] text-center"
                            style={{ background: "#FEEFC6" }}
                          >
                            TL
                          </TableHead>
                          <TableHead
                            className="font-semibold text-[#001f3f] text-center"
                            style={{ background: "#FEEFC6" }}
                          >
                            TL VAT
                          </TableHead>
                          <TableHead
                            className="font-semibold text-[#001f3f] text-center"
                            style={{ background: "#FEEFC6" }}
                          >
                            TL EWT
                          </TableHead>
                          <TableHead
                            className="font-semibold text-[#001f3f] text-center"
                            style={{ background: "#FEEFC6" }}
                          >
                            TL EWT RATE
                          </TableHead>
                          <TableHead
                            className="font-semibold text-[#001f3f] text-center"
                            style={{ background: "#FEEFC6" }}
                          >
                            TL NET COMM
                          </TableHead>
                          <TableHead className="font-semibold text-[#ee3433] text-center">Remarks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="bg-white">
                        {tabCommissionRecords.length > 0 ? (
                          tabCommissionRecords.map((record, index) => (
                            <TableRow key={index} className="border-b border-gray-100 hover:bg-gray-50">
                              <TableCell className="text-center font-medium text-[#001f3f]">{record.no}</TableCell>
                              <TableCell className="text-[#001f3f]">
                                {format(new Date(record.date), "MMM dd, yyyy")}
                              </TableCell>
                              <TableCell className="font-medium text-[#001f3f]">
                                <textarea
                                  className="border border-gray-300 rounded px-2 py-1 w-32 text-[#001f3f] bg-white font-medium resize-vertical min-h-[2.5rem] max-h-32"
                                  value={record.developer}
                                  onChange={(e) => {
                                    handleCommissionRecordChange(tabKey, index, "developer", e.target.value)
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
                                    handleCommissionRecordChange(tabKey, index, "comm", val)
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
                                    handleCommissionRecordChange(tabKey, index, "type", e.target.value)
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
                                    handleCommissionRecordChange(tabKey, index, "bdoAccount", e.target.value)
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
                                    handleCommissionRecordChange(tabKey, index, "status", e.target.value)
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
                                    handleCommissionRecordChange(tabKey, index, "calculationType", e.target.value)
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
                                    handleCommissionRecordChange(tabKey, index, "agentsRate", e.target.value)
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
                                    handleCommissionRecordChange(tabKey, index, "developersRate", e.target.value)
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
                                <select
                                  className="border border-gray-300 rounded px-2 py-1 text-[#001f3f] bg-white w-20"
                                  value={record.ewtRate || "5"}
                                  onChange={(e) => {
                                    handleCommissionRecordChange(tabKey, index, "ewtRate", e.target.value)
                                  }}
                                >
                                  <option value="5">5%</option>
                                  <option value="10">10%</option>
                                </select>
                              </TableCell>
                              {/* Net Comm */}
                              <TableCell className="text-right font-bold text-white bg-[#a0d9ef]">
                                {record.netComm ? formatCurrency(Number(record.netComm)) : ""}
                              </TableCell>
                              {/* UM FIELDS - #E34A27 */}
                              <TableCell className="text-[#fff] font-semibold" style={{ background: "#E34A27" }}>
                                <input
                                  type="text"
                                  className="border border-gray-300 rounded px-2 py-1 w-28 text-[#E34A27] bg-white font-bold"
                                  value={record.umName}
                                  onChange={(e) =>
                                    handleCommissionRecordChange(tabKey, index, "umName", e.target.value)
                                  }
                                  placeholder="UM Name"
                                />
                              </TableCell>
                              {/* BDO Account # Input */}
                              <TableCell className="text-[#fff] font-semibold" style={{ background: "#E34A27" }}>
                                <input
                                  type="text"
                                  className="border border-gray-300 rounded px-2 py-1 w-32 text-[#001f3f] bg-white"
                                  value={record.umBdoAccount || ""}
                                  onChange={(e) => {
                                    handleCommissionRecordChange(tabKey, index, "umBdoAccount", e.target.value)
                                  }}
                                  placeholder="UM BDO Account #"
                                />
                              </TableCell>
                              <TableCell className="text-center font-semibold" style={{ background: "#E34A27" }}>
                                <select
                                  className="border border-gray-300 rounded px-2 py-1 text-[#E34A27] bg-white font-bold"
                                  value={record.umCalculationType}
                                  onChange={(e) => {
                                    console.log(`UM Calculation Type changed: ${e.target.value}`)
                                    handleCommissionRecordChange(tabKey, index, "umCalculationType", e.target.value)
                                  }}
                                >
                                  <option value="nonvat with invoice">nonvat with invoice</option>
                                  <option value="nonvat without invoice">nonvat without invoice</option>
                                  <option value="vat with invoice">vat with invoice</option>
                                  <option value="vat deduction">vat deduction</option>
                                </select>
                              </TableCell>
                              <TableCell className="text-center font-semibold" style={{ background: "#E34A27" }}>
                                <select
                                  className="border border-gray-300 rounded px-2 py-1 text-[#E34A27] bg-white font-bold"
                                  value={record.umRate}
                                  onChange={(e) => {
                                    console.log(`UM Rate changed: ${e.target.value}`)
                                    handleCommissionRecordChange(tabKey, index, "umRate", e.target.value)
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
                              <TableCell className="text-center font-semibold" style={{ background: "#E34A27" }}>
                                <select
                                  className="border border-gray-300 rounded px-2 py-1 text-[#E34A27] bg-white font-bold"
                                  value={record.umDevelopersRate}
                                  onChange={(e) => {
                                    console.log(`UM Developer Rate changed: ${e.target.value}`)
                                    handleCommissionRecordChange(tabKey, index, "umDevelopersRate", e.target.value)
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
                              <TableCell className="text-right font-semibold" style={{ background: "#E34A27" }}>
                                {record.umAmount ? formatCurrency(Number(record.umAmount)) : ""}
                              </TableCell>
                              <TableCell className="text-right font-semibold" style={{ background: "#E34A27" }}>
                                {record.umVat ? formatCurrency(Number(record.umVat)) : ""}
                              </TableCell>
                              <TableCell className="text-right font-semibold" style={{ background: "#E34A27" }}>
                                {record.umEwt ? formatCurrency(Number(record.umEwt)) : ""}
                              </TableCell>
                              {/* EWT Rate Dropdown - UM */}
                              <TableCell className="text-center font-semibold" style={{ background: "#E34A27" }}>
                                <select
                                  className="border border-gray-300 rounded px-2 py-1 text-[#E34A27] bg-white font-bold w-20"
                                  value={record.umEwtRate || "5"}
                                  onChange={(e) => {
                                    handleCommissionRecordChange(tabKey, index, "umEwtRate", e.target.value)
                                  }}
                                >
                                  <option value="5">5%</option>
                                  <option value="10">10%</option>
                                </select>
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
                              <TableCell className="text-[#001f3f] font-semibold" style={{ background: "#FEEFC6" }}>
                                <input
                                  type="text"
                                  className="border border-gray-300 rounded px-2 py-1 w-28 text-[#001f3f] bg-white font-bold"
                                  value={record.tlName}
                                  onChange={(e) =>
                                    handleCommissionRecordChange(tabKey, index, "tlName", e.target.value)
                                  }
                                  placeholder="TL Name"
                                />
                              </TableCell>
                              {/* BDO Account # Input */}
                              <TableCell className="text-[#fff] font-semibold" style={{ background: "#FEEFC6" }}>
                                <input
                                  type="text"
                                  className="border border-gray-300 rounded px-2 py-1 w-32 text-[#001f3f] bg-white"
                                  value={record.tlBdoAccount || ""}
                                  onChange={(e) => {
                                    handleCommissionRecordChange(tabKey, index, "tlBdoAccount", e.target.value)
                                  }}
                                  placeholder="TL BDO Account #"
                                />
                              </TableCell>
                              <TableCell className="text-center font-semibold" style={{ background: "#FEEFC6" }}>
                                <select
                                  className="border border-gray-300 rounded px-2 py-1 text-[#001f3f] bg-white font-bold"
                                  value={record.tlCalculationType}
                                  onChange={(e) => {
                                    console.log(`TL Calculation Type changed: ${e.target.value}`)
                                    handleCommissionRecordChange(tabKey, index, "tlCalculationType", e.target.value)
                                  }}
                                >
                                  <option value="nonvat with invoice">nonvat with invoice</option>
                                  <option value="nonvat without invoice">nonvat without invoice</option>
                                  <option value="vat with invoice">vat with invoice</option>
                                  <option value="vat deduction">vat deduction</option>
                                </select>
                              </TableCell>
                              <TableCell className="text-center font-semibold" style={{ background: "#FEEFC6" }}>
                                <select
                                  className="border border-gray-300 rounded px-2 py-1 text-[#001f3f] bg-white font-bold"
                                  value={record.tlRate}
                                  onChange={(e) => {
                                    console.log(`TL Rate changed: ${e.target.value}`)
                                    handleCommissionRecordChange(tabKey, index, "tlRate", e.target.value)
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
                              <TableCell className="text-center font-semibold" style={{ background: "#FEEFC6" }}>
                                <select
                                  className="border border-gray-300 rounded px-2 py-1 text-[#001f3f] bg-white font-bold"
                                  value={record.tlDevelopersRate}
                                  onChange={(e) => {
                                    console.log(`TL Developer Rate changed: ${e.target.value}`)
                                    handleCommissionRecordChange(tabKey, index, "tlDevelopersRate", e.target.value)
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
                              <TableCell className="text-center font-semibold" style={{ background: "#FEEFC6" }}>
                                <select
                                  className="border border-gray-300 rounded px-2 py-1 text-[#001f3f] bg-white font-bold w-20"
                                  value={record.tlEwtRate || "5"}
                                  onChange={(e) => {
                                    handleCommissionRecordChange(tabKey, index, "tlEwtRate", e.target.value)
                                  }}
                                >
                                  <option value="5">5%</option>
                                  <option value="10">10%</option>
                                </select>
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
                                  onChange={(e) =>
                                    handleCommissionRecordChange(tabKey, index, "remarks", e.target.value)
                                  }
                                  placeholder="Remarks"
                                />
                              </TableCell>
                              {/* Hidden fields */}
                              <input
                                type="hidden"
                                name={`commissionRecords[${tabKey}][${index}][lrsalesId]`}
                                value={record.lrsalesId ?? ""}
                              />
                              <input
                                type="hidden"
                                name={`commissionRecords[${tabKey}][${index}][memberid]`}
                                value={record.memberid ?? ""}
                              />
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={38} className="text-center text-gray-400 py-8">
                              No commission records found. Use the search above to add agents.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
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
            Cancel
          </Button>
          <Button
            className="bg-[#001f3f] text-white hover:bg-[#001f3f]/90"
            disabled={tabCommissionRecords.length === 0 || isSavingReport}
            onClick={handleSaveReport}
          >
            {isSavingReport ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
