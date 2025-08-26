"use client"

import type React from "react"
import { useRef } from "react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, ChevronRight, Check } from "lucide-react"

export interface AgentEditModalProps {
  open: boolean
  agent: any
  onClose: () => void
  onSave: (updatedAgent: any) => void
  authUserId?: string // <-- add this
}

const calculationTypes = ["nonvat with invoice", "nonvat without invoice", "vat with invoice", "vat deduction"]

const commissionTypes = ["COMM", "INCENTIVES", "COMM & INCENTIVES"]

const generateRateOptions = (start = 0, max = 12) => {
  const options = []
  for (let i = start; i <= max * 2; i++) {
    const rate = (i * 0.5).toFixed(1)
    options.push(rate)
  }
  return options
}

const agentRateOptions = generateRateOptions(0, 12) // 0% to 12%
const developerRateOptions = generateRateOptions(1, 12) // 0.5% to 12%

function formatCurrency(amount: number | null | undefined) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "0.00"
  }
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatCurrencyInput(value: string) {
  // Remove all non-numeric characters except decimal point
  const cleanValue = value.replace(/[^\d.]/g, "")

  // Handle multiple decimal points
  const parts = cleanValue.split(".")
  if (parts.length > 2) {
    return parts[0] + "." + parts.slice(1).join("")
  }

  // Add commas for thousands
  if (parts[0]) {
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  }

  return parts.join(".")
}

const steps = [
  { id: 1, title: "Commission Details", color: "#001f3f" },
  { id: 2, title: "Agent Information", color: "#3c8dbc" },
  { id: 3, title: "UM Information", color: "#ff851b" },
  { id: 4, title: "TL Information", color: "#ffc107" },
  { id: 5, title: "Remarks", color: "#28a745" },
]

const AgentEditModal = ({ open, agent, onClose, onSave, authUserId }: AgentEditModalProps) => {
  const [form, setForm] = useState(agent || {})
  const commTimeout = useRef<NodeJS.Timeout | null>(null)
  const [currentStep, setCurrentStep] = useState(1)

  const doCalculation = useMemo(() => {
    return (formData: any) => {
      const calcType = formData.calculation_type
      const comm = Number.parseFloat(formData.comm?.toString().replace(/,/g, "") || "0")
      const agentsRate = Number.parseFloat(formData.agents_rate || "0")
      const developersRate = Number.parseFloat(formData.developers_rate || "5")

      let netOfVat = ""
      let agent = ""
      let vat = ""
      let ewt = ""
      let netComm = ""

      // Always calculate netOfVat for these types, regardless of agent rate
      if (calcType === "nonvat with invoice" || calcType === "vat with invoice") {
        netOfVat = comm ? String(comm / 1.02) : ""
      }

      if (agentsRate === 0) {
        agent = ""
        vat = ""
        ewt = ""
        netComm = ""
        // Do NOT clear netOfVat here!
      } else {
        if (calcType === "vat deduction") {
          agent = comm && agentsRate && developersRate ? String((comm * agentsRate) / developersRate) : ""
          netComm = agent ? String(Number(agent) / 1.12) : ""
          vat = netComm ? String(Number(netComm) * 0.12) : ""
          ewt = ""
          // netOfVat is not used for vat deduction
        } else if (calcType === "nonvat with invoice") {
          agent =
            netOfVat && agentsRate && developersRate
              ? String((Number.parseFloat(netOfVat) * agentsRate) / developersRate)
              : ""
          const agentEwtRate = Number(formData.agent_ewt_rate || "5") / 100
          ewt = agent ? String(Number.parseFloat(agent) * agentEwtRate) : ""
          netComm = agent && ewt ? String(Number.parseFloat(agent) - Number.parseFloat(ewt)) : ""
          vat = ""
        } else if (calcType === "nonvat without invoice") {
          agent = ""
          vat = ""
          ewt = ""
          netComm = comm && agentsRate && developersRate ? String((comm * agentsRate) / developersRate) : ""
          // netOfVat is not used for nonvat without invoice
        } else if (calcType === "vat with invoice") {
          agent =
            netOfVat && agentsRate && developersRate
              ? String((Number.parseFloat(netOfVat) * agentsRate) / developersRate)
              : ""
          vat = agent ? String(Number.parseFloat(agent) * 0.12) : ""
          const agentEwtRate = Number(formData.agent_ewt_rate || "5") / 100
          ewt = agent ? String(Number.parseFloat(agent) * agentEwtRate) : ""
          netComm =
            agent && vat && ewt
              ? String(Number.parseFloat(agent) + Number.parseFloat(vat) - Number.parseFloat(ewt))
              : ""
        }
      }

      // UM calculations
      let umAmount = ""
      let umVat = ""
      let umEwt = ""
      let umNetComm = ""

      if (formData.um_calculation_type && formData.um_rate && formData.um_developers_rate) {
        const umCalcType = formData.um_calculation_type
        const umRate = Number.parseFloat(formData.um_rate || "0")
        const umDevelopersRate = Number.parseFloat(formData.um_developers_rate || "5")

        if (umRate === 0) {
          umAmount = ""
          umVat = ""
          umEwt = ""
          umNetComm = ""
        } else {
          if (calcType === "nonvat without invoice" || calcType === "vat deduction") {
            umAmount = comm && umRate && umDevelopersRate ? String((comm * umRate) / umDevelopersRate) : ""
          } else if (umCalcType === "nonvat with invoice" || umCalcType === "vat with invoice") {
            umAmount =
              netOfVat && umRate && umDevelopersRate
                ? String((Number.parseFloat(netOfVat) * umRate) / umDevelopersRate)
                : ""
          } else {
            umAmount = comm && umRate && umDevelopersRate ? String((comm * umRate) / umDevelopersRate) : ""
          }

          if (umCalcType === "nonvat with invoice") {
            const umEwtRate = Number(formData.um_ewt_rate || "5") / 100
            umEwt = umAmount ? String(Number.parseFloat(umAmount) * umEwtRate) : ""
            umNetComm = umAmount && umEwt ? String(Number.parseFloat(umAmount) - Number.parseFloat(umEwt)) : ""
            umVat = ""
          } else if (umCalcType === "vat with invoice") {
            umVat = umAmount ? String(Number.parseFloat(umAmount) * 0.12) : ""
            const umEwtRate = Number(formData.um_ewt_rate || "5") / 100
            umEwt = umAmount ? String(Number.parseFloat(umAmount) * umEwtRate) : ""
            umNetComm =
              umAmount && umVat && umEwt
                ? String(Number.parseFloat(umAmount) + Number.parseFloat(umVat) - Number.parseFloat(umEwt))
                : ""
          } else if (umCalcType === "vat deduction") {
            umNetComm = umAmount ? String(Number(umAmount) / 1.12) : ""
            umVat = umNetComm ? String(Number(umNetComm) * 0.12) : ""
            umEwt = ""
          } else {
            umVat = ""
            umEwt = ""
            umNetComm = umAmount || ""
          }
        }
      }

      // TL calculations
      let tlAmount = ""
      let tlVat = ""
      let tlEwt = ""
      let tlNetComm = ""

      if (formData.tl_calculation_type && formData.tl_rate && formData.tl_developers_rate) {
        const tlCalcType = formData.tl_calculation_type
        const tlRate = Number.parseFloat(formData.tl_rate || "0")
        const tlDevelopersRate = Number.parseFloat(formData.tl_developers_rate || "5")

        if (tlRate === 0) {
          tlAmount = ""
          tlVat = ""
          tlEwt = ""
          tlNetComm = ""
        } else {
          if (calcType === "nonvat without invoice" || calcType === "vat deduction") {
            tlAmount = comm && tlRate && tlDevelopersRate ? String((comm * tlRate) / tlDevelopersRate) : ""
          } else if (tlCalcType === "nonvat with invoice" || tlCalcType === "vat with invoice") {
            tlAmount =
              netOfVat && tlRate && tlDevelopersRate
                ? String((Number.parseFloat(netOfVat) * tlRate) / tlDevelopersRate)
                : ""
          } else {
            tlAmount = comm && tlRate && tlDevelopersRate ? String((comm * tlRate) / tlDevelopersRate) : ""
          }

          if (tlCalcType === "nonvat with invoice") {
            const tlEwtRate = Number(formData.tl_ewt_rate || "5") / 100
            tlEwt = tlAmount ? String(Number.parseFloat(tlAmount) * tlEwtRate) : ""
            tlNetComm = tlAmount && tlEwt ? String(Number.parseFloat(tlAmount) - Number.parseFloat(tlEwt)) : ""
            tlVat = ""
          } else if (tlCalcType === "vat with invoice") {
            tlVat = tlAmount ? String(Number.parseFloat(tlAmount) * 0.12) : ""
            const tlEwtRate = Number(formData.tl_ewt_rate || "5") / 100
            tlEwt = tlAmount ? String(Number.parseFloat(tlAmount) * tlEwtRate) : ""
            tlNetComm =
              tlAmount && tlVat && tlEwt
                ? String(Number.parseFloat(tlAmount) + Number.parseFloat(tlVat) - Number.parseFloat(tlEwt))
                : ""
          } else if (tlCalcType === "vat deduction") {
            tlNetComm = tlAmount ? String(Number(tlAmount) / 1.12) : ""
            tlVat = tlNetComm ? String(Number(tlNetComm) * 0.12) : ""
            tlEwt = ""
          } else {
            tlVat = ""
            tlEwt = ""
            tlNetComm = tlAmount || ""
          }
        }
      }

      return {
        ...formData,
        net_of_vat: netOfVat,
        agent_amount: agent,
        agent_vat: vat,
        agent_ewt: ewt,
        agent_net_comm: netComm,
        um_amount: umAmount,
        um_vat: umVat,
        um_ewt: umEwt,
        um_net_comm: umNetComm,
        tl_amount: tlAmount,
        tl_vat: tlVat,
        tl_ewt: tlEwt,
        tl_net_comm: tlNetComm,
      }
    }
  }, [agent])

  const handleChange = useCallback(
    (name: string, value: string) => {
      console.log("[v0] handleChange called:", name, value)

      setForm((prevForm) => {
        let newForm = { ...prevForm, [name]: value }

        // Auto-set EWT rate based on calculation type changes
        if (name === "calculation_type") {
          if (value === "nonvat without invoice") {
            newForm.agent_ewt_rate = "0"
          } else if (value === "vat deduction") {
            newForm.agent_ewt_rate = "0"
          } else if (value === "nonvat with invoice") {
            newForm.agent_ewt_rate = "5"
          } else if (value === "vat with invoice") {
            newForm.agent_ewt_rate = "10"
          }
        }
        if (name === "um_calculation_type") {
          if (value === "nonvat without invoice" || value === "vat deduction") {
            newForm.um_ewt_rate = "0"
          } else if (value === "nonvat with invoice") {
            newForm.um_ewt_rate = "5"
          } else if (value === "vat with invoice") {
            newForm.um_ewt_rate = "10"
          }
        }
        if (name === "tl_calculation_type") {
          if (value === "nonvat without invoice" || value === "vat deduction") {
            newForm.tl_ewt_rate = "0"
          } else if (value === "nonvat with invoice") {
            newForm.tl_ewt_rate = "5"
          } else if (value === "vat with invoice") {
            newForm.tl_ewt_rate = "10"
          }
        }

        // Immediate calculation for rate/type changes
        if (
          [
            "calculation_type",
            "agents_rate",
            "developers_rate",
            "agent_ewt_rate",
            "um_calculation_type",
            "um_rate",
            "um_developers_rate",
            "um_ewt_rate",
            "tl_calculation_type",
            "tl_rate",
            "tl_developers_rate",
            "tl_ewt_rate",
          ].includes(name)
        ) {
          return doCalculation(newForm)
        }

        return newForm
      })
    },
    [agent, doCalculation],
  )

  const handleSimpleChange = useCallback((name: string, value: string) => {
    console.log("[v0] handleSimpleChange called:", name, value)
    setForm((prevForm) => ({ ...prevForm, [name]: value }))
  }, [])

  const sanitizePayload = (data: any) => {
    const numericFields = [
      "comm",
      "net_of_vat",
      "agent_amount",
      "agent_vat",
      "agent_ewt",
      "agent_ewt_rate",
      "agent_net_comm",
      "um_rate",
      "um_developers_rate",
      "um_amount",
      "um_vat",
      "um_ewt",
      "um_ewt_rate",
      "um_net_comm",
      "tl_rate",
      "tl_developers_rate",
      "tl_amount",
      "tl_vat",
      "tl_ewt",
      "tl_ewt_rate",
      "tl_net_comm",
      "agents_rate",
      "developers_rate",
    ]
    const sanitized = { ...data }
    for (const key of numericFields) {
      if (sanitized[key] !== undefined) {
        if (typeof sanitized[key] === "string") {
          const cleaned = sanitized[key].replace(/,/g, "")
          sanitized[key] = cleaned === "" ? null : Number(cleaned)
        }
      }
    }
    return sanitized
  }

  const handleSave = async () => {
    try {
      const payload = sanitizePayload(form)
      const response = await fetch("/api/update-agent-commission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uuid: agent.uuid, ...payload }),
      })
      if (response.ok) {
        onSave(form)
      } else {
        console.error("Failed to update agent commission")
      }
    } catch (error) {
      console.error("Error updating agent commission:", error)
    }
  }

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const goToStep = (stepId: number) => {
    setCurrentStep(stepId)
  }

  useEffect(() => {
    if (!agent) return

    const processedAgent = { ...agent }

    const normalizeRate = (val: any) => {
      if (val === null || val === undefined || val === "") return "0"
      const numVal = Number(val)
      return isNaN(numVal) ? "0" : numVal.toString()
    }

    processedAgent.agents_rate = normalizeRate(processedAgent.agents_rate)
    processedAgent.developers_rate = normalizeRate(processedAgent.developers_rate)
    processedAgent.um_rate = normalizeRate(processedAgent.um_rate)
    processedAgent.um_developers_rate = normalizeRate(processedAgent.um_developers_rate)
    processedAgent.tl_rate = normalizeRate(processedAgent.tl_rate)
    processedAgent.tl_developers_rate = normalizeRate(processedAgent.tl_developers_rate)

    // Set Agent EWT Rate based on calculation type
    if (
      processedAgent.calculation_type === "nonvat without invoice"
    ) {
      processedAgent.agent_ewt_rate = "0"
    } else if (processedAgent.calculation_type === "vat deduction") {
      processedAgent.agent_ewt_rate = "0"
    } else if (processedAgent.calculation_type === "nonvat with invoice") {
      processedAgent.agent_ewt_rate = "5"
    } else if (processedAgent.calculation_type === "vat with invoice") {
      processedAgent.agent_ewt_rate = "10"
    } else {
      processedAgent.agent_ewt_rate = normalizeRate(processedAgent.agent_ewt_rate) || "5"
    }

    // Set UM EWT Rate based on calculation type
    if (
      processedAgent.um_calculation_type === "nonvat without invoice" ||
      processedAgent.um_calculation_type === "vat deduction"
    ) {
      processedAgent.um_ewt_rate = "0"
    } else if (processedAgent.um_calculation_type === "nonvat with invoice") {
      processedAgent.um_ewt_rate = "5"
    } else if (processedAgent.um_calculation_type === "vat with invoice") {
      processedAgent.um_ewt_rate = "10"
    } else {
      processedAgent.um_ewt_rate = normalizeRate(processedAgent.um_ewt_rate) || "5"
    }

    // Set TL EWT Rate based on calculation type
    if (
      processedAgent.tl_calculation_type === "nonvat without invoice" ||
      processedAgent.tl_calculation_type === "vat deduction"
    ) {
      processedAgent.tl_ewt_rate = "0"
    } else if (processedAgent.tl_calculation_type === "nonvat with invoice") {
      processedAgent.tl_ewt_rate = "5"
    } else if (processedAgent.tl_calculation_type === "vat with invoice") {
      processedAgent.tl_ewt_rate = "10"
    } else {
      processedAgent.tl_ewt_rate = normalizeRate(processedAgent.tl_ewt_rate) || "5"
    }

    // Calculate all derived fields immediately
    setForm(doCalculation(processedAgent))
    setCurrentStep(1)
  }, [agent, doCalculation])

  const SectionHeading = ({ children, bgColor = "#3c8dbc" }: { children: React.ReactNode; bgColor?: string }) => (
    <div className="col-span-2 border-b-2 pb-2 mb-4 mt-6">
      <h3 className="text-lg font-bold text-white px-4 py-2 rounded" style={{ backgroundColor: bgColor }}>
        {children}
      </h3>
    </div>
  )

  const InputField = ({
    label,
    name,
    type = "text",
    disabled = false,
    children,
    isDisplayOnly = false,
    unrestricted = false,
    ...props
  }: {
    label: string
    name: string
    type?: string
    disabled?: boolean
    children?: React.ReactNode
    isDisplayOnly?: boolean
    unrestricted?: boolean
    [key: string]: any
  }) => (
    <div>
      <label className="block text-sm font-semibold text-[#001f3f] mb-2">{label}</label>
      {children ? (
        children
      ) : isDisplayOnly ? (
        <div>
          <div className="px-3 py-2 border border-[#3c8dbc] rounded-md bg-gray-50 text-[#001f3f] font-medium">
            ₱{form[name] ? formatCurrency(Number.parseFloat(form[name])) : "0.00"}
          </div>
          <input type="hidden" name={name} value={form[name] || ""} />
        </div>
      ) : (
        <Input
          className={`border-[#3c8dbc] focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] bg-white
                        ${disabled ? "bg-gray-100 text-gray-400 cursor-not-allowed" : ""}
                    `}
          name={name}
          type={type}
          value={form[name] || ""}
          onChange={(e) =>
            unrestricted ? handleSimpleChange(name, e.target.value) : handleChange(name, e.target.value)
          }
          disabled={disabled}
          {...props}
        />
      )}
    </div>
  )

  const ADMIN_ID = "cf82f7ac-8f88-4b93-8da4-d24db6b87984"

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <SectionHeading bgColor="#001f3f">Commission Sale Details</SectionHeading>
            <InputField label="Developer" name="developer" disabled />
            <InputField label="Client" name="client" disabled />
            <InputField label="BDO Account #" name="bdo_account" unrestricted />
            <InputField label="Status" name="status" unrestricted />
            {authUserId === ADMIN_ID && (
              <>
                <InputField label="Sales UUID(For Admin Edit Only)" name="sales_uuid" unrestricted />
                <InputField label="Invoice Number" name="invoice_number" unrestricted />
              </>
            )}
          </div>
        )
      case 2:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <SectionHeading bgColor="#3c8dbc">Agent Details</SectionHeading>
            <InputField label="Agent Name" name="agent_name" disabled />
            <InputField label="Commission" name="comm" type="text" placeholder="0.00" />
            <InputField label="Commission Type" name="comm_type">
              <Select value={form.comm_type || ""} onValueChange={(value) => handleChange("comm_type", value)}>
                <SelectTrigger className="border-[#3c8dbc] focus:border-[#001f3f] text-[#001f3f] bg-white">
                  <SelectValue placeholder="Select commission type" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {commissionTypes.map((type) => (
                    <SelectItem key={type} value={type} className="text-[#001f3f]">
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </InputField>
            <InputField label="Net of VAT" name="net_of_vat" isDisplayOnly />
            <InputField label="Calculation Type" name="calculation_type">
              <Select
                value={form.calculation_type || ""}
                onValueChange={(value) => handleChange("calculation_type", value)}
              >
                <SelectTrigger className="border-[#3c8dbc] focus:border-[#001f3f] text-[#001f3f] bg-white">
                  <SelectValue placeholder="Select calculation type" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {calculationTypes.map((type) => (
                    <SelectItem key={type} value={type} className="text-[#001f3f]">
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </InputField>
            <InputField label="Agent's Rate (%)" name="agents_rate">
              <Select
                value={
                  form.agents_rate === null ||
                    form.agents_rate === undefined ||
                    form.agents_rate === "" ||
                    form.agents_rate === 0 ||
                    form.agents_rate === "0"
                    ? "0.0"
                    : String(Number(form.agents_rate).toFixed(1))
                }
                onValueChange={(value) => handleChange("agents_rate", value)}
              >
                <SelectTrigger className="border-[#3c8dbc] focus:border-[#001f3f] text-[#001f3f] bg-white">
                  <SelectValue placeholder="Select rate" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {agentRateOptions.map((rate) => (
                    <SelectItem key={rate} value={rate} className="text-[#001f3f]">
                      {rate}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </InputField>
            <InputField label="Developer's Rate (%)" name="developers_rate">
              <Select
                value={
                  form.developers_rate === null ||
                    form.developers_rate === undefined ||
                    form.developers_rate === "" ||
                    form.developers_rate === 0 ||
                    form.developers_rate === "0"
                    ? "0.0"
                    : String(Number(form.developers_rate).toFixed(1))
                }
                onValueChange={(value) => handleChange("developers_rate", value)}
              >
                <SelectTrigger className="border-[#3c8dbc] focus:border-[#001f3f] text-[#001f3f] bg-white">
                  <SelectValue placeholder="Select rate" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {developerRateOptions.map((rate) => (
                    <SelectItem key={rate} value={rate} className="text-[#001f3f]">
                      {rate}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </InputField>
            <InputField label="Agent Amount" name="agent_amount" isDisplayOnly />
            <InputField label="Agent VAT" name="agent_vat" isDisplayOnly />
            <InputField label="Agent EWT" name="agent_ewt" isDisplayOnly />
            <InputField label="Agent EWT Rate (%)" name="agent_ewt_rate">
              <Select
                value={
                  form.agent_ewt_rate === null ||
                    form.agent_ewt_rate === undefined ||
                    form.agent_ewt_rate === ""
                    ? "5"
                    : String(form.agent_ewt_rate)
                }
                onValueChange={(value) => handleChange("agent_ewt_rate", value)}
              >
                <SelectTrigger className="border-[#3c8dbc] focus:border-[#001f3f] text-[#001f3f] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="0" className="text-[#001f3f]">
                    0%
                  </SelectItem>
                  <SelectItem value="5" className="text-[#001f3f]">
                    5%
                  </SelectItem>
                  <SelectItem value="10" className="text-[#001f3f]">
                    10%
                  </SelectItem>
                </SelectContent>
              </Select>
            </InputField>
            <InputField label="Agent Net Commission" name="agent_net_comm" isDisplayOnly />
          </div>
        )
      case 3:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <SectionHeading bgColor="#ff851b">UM Details</SectionHeading>
            <InputField label="UM Name" name="um_name" unrestricted />
            <InputField label="UM BDO Account #" name="um_bdo_account" unrestricted />
            <InputField label="UM Calculation Type" name="um_calculation_type">
              <Select
                value={form.um_calculation_type || ""}
                onValueChange={(value) => handleChange("um_calculation_type", value)}
              >
                <SelectTrigger className="border-[#3c8dbc] focus:border-[#001f3f] text-[#001f3f] bg-white">
                  <SelectValue placeholder="Select calculation type" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {calculationTypes.map((type) => (
                    <SelectItem key={type} value={type} className="text-[#001f3f]">
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </InputField>
            <InputField label="UM Rate (%)" name="um_rate">
              <Select
                value={
                  form.um_rate === null ||
                    form.um_rate === undefined ||
                    form.um_rate === "" ||
                    form.um_rate === 0 ||
                    form.um_rate === "0"
                    ? "0.0"
                    : String(Number(form.um_rate).toFixed(1))
                }
                onValueChange={(value) => handleChange("um_rate", value)}
              >
                <SelectTrigger className="border-[#3c8dbc] focus:border-[#001f3f] text-[#001f3f] bg-white">
                  <SelectValue placeholder="Select rate" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {agentRateOptions.map((rate) => (
                    <SelectItem key={rate} value={rate} className="text-[#001f3f]">
                      {rate}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </InputField>
            <InputField label="UM Developer's Rate (%)" name="um_developers_rate">
              <Select
                value={
                  form.um_developers_rate === null ||
                    form.um_developers_rate === undefined ||
                    form.um_developers_rate === "" ||
                    form.um_developers_rate === 0 ||
                    form.um_developers_rate === "0"
                    ? "5.0"
                    : String(Number(form.um_developers_rate).toFixed(1))
                }
                onValueChange={(value) => handleChange("um_developers_rate", value)}
              >
                <SelectTrigger className="border-[#3c8dbc] focus:border-[#001f3f] text-[#001f3f] bg-white">
                  <SelectValue placeholder="Select rate" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {developerRateOptions.map((rate) => (
                    <SelectItem key={rate} value={rate} className="text-[#001f3f]">
                      {rate}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </InputField>
            <InputField label="UM Amount" name="um_amount" isDisplayOnly />
            <InputField label="UM VAT" name="um_vat" isDisplayOnly />
            <InputField label="UM EWT" name="um_ewt" isDisplayOnly />
            <InputField label="UM EWT Rate (%)" name="um_ewt_rate">
              <Select
                value={
                  form.um_ewt_rate === null ||
                    form.um_ewt_rate === undefined ||
                    form.um_ewt_rate === ""
                    ? "5"
                    : String(form.um_ewt_rate)
                }
                onValueChange={(value) => handleChange("um_ewt_rate", value)}
              >
                <SelectTrigger className="border-[#3c8dbc] focus:border-[#001f3f] text-[#001f3f] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="0" className="text-[#001f3f]">
                    0%
                  </SelectItem>
                  <SelectItem value="5" className="text-[#001f3f]">
                    5%
                  </SelectItem>
                  <SelectItem value="10" className="text-[#001f3f]">
                    10%
                  </SelectItem>
                </SelectContent>
              </Select>
            </InputField>
            <InputField label="UM Net Commission" name="um_net_comm" isDisplayOnly />
          </div>
        )
      case 4:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <SectionHeading bgColor="#ffc107">TL Details</SectionHeading>
            <InputField label="TL Name" name="tl_name" unrestricted />
            <InputField label="TL BDO Account #" name="tl_bdo_account" unrestricted />
            <InputField label="TL Calculation Type" name="tl_calculation_type">
              <Select
                value={form.tl_calculation_type || ""}
                onValueChange={(value) => handleChange("tl_calculation_type", value)}
              >
                <SelectTrigger className="border-[#3c8dbc] focus:border-[#001f3f] text-[#001f3f] bg-white">
                  <SelectValue placeholder="Select calculation type" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {calculationTypes.map((type) => (
                    <SelectItem key={type} value={type} className="text-[#001f3f]">
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </InputField>
            <InputField label="TL Rate (%)" name="tl_rate">
              <Select
                value={
                  form.tl_rate === null ||
                    form.tl_rate === undefined ||
                    form.tl_rate === "" ||
                    form.tl_rate === 0 ||
                    form.tl_rate === "0"
                    ? "0.0"
                    : String(Number(form.tl_rate).toFixed(1))
                }
                onValueChange={(value) => handleChange("tl_rate", value)}
              >
                <SelectTrigger className="border-[#3c8dbc] focus:border-[#001f3f] text-[#001f3f] bg-white">
                  <SelectValue placeholder="Select rate" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {agentRateOptions.map((rate) => (
                    <SelectItem key={rate} value={rate} className="text-[#001f3f]">
                      {rate}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </InputField>
            <InputField label="TL Developer's Rate (%)" name="tl_developers_rate">
              <Select
                value={
                  form.tl_developers_rate === null ||
                    form.tl_developers_rate === undefined ||
                    form.tl_developers_rate === "" ||
                    form.tl_developers_rate === 0 ||
                    form.tl_developers_rate === "0"
                    ? "5.0"
                    : String(Number(form.tl_developers_rate).toFixed(1))
                }
                onValueChange={(value) => handleChange("tl_developers_rate", value)}
              >
                <SelectTrigger className="border-[#3c8dbc] focus:border-[#001f3f] text-[#001f3f] bg-white">
                  <SelectValue placeholder="Select rate" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {developerRateOptions.map((rate) => (
                    <SelectItem key={rate} value={rate} className="text-[#001f3f]">
                      {rate}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </InputField>
            <InputField label="TL Amount" name="tl_amount" isDisplayOnly />
            <InputField label="TL VAT" name="tl_vat" isDisplayOnly />
            <InputField label="TL EWT" name="tl_ewt" isDisplayOnly />
            <InputField label="TL EWT Rate (%)" name="tl_ewt_rate">
              <Select
                value={
                  form.tl_ewt_rate === null ||
                    form.tl_ewt_rate === undefined ||
                    form.tl_ewt_rate === ""
                    ? "5"
                    : String(form.tl_ewt_rate)
                }
                onValueChange={(value) => handleChange("tl_ewt_rate", value)}
              >
                <SelectTrigger className="border-[#3c8dbc] focus:border-[#001f3f] text-[#001f3f] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="0" className="text-[#001f3f]">
                    0%
                  </SelectItem>
                  <SelectItem value="5" className="text-[#001f3f]">
                    5%
                  </SelectItem>
                  <SelectItem value="10" className="text-[#001f3f]">
                    10%
                  </SelectItem>
                </SelectContent>
              </Select>
            </InputField>
            <InputField label="TL Net Commission" name="tl_net_comm" isDisplayOnly />
          </div>
        )
      case 5:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <SectionHeading bgColor="#28a745">Remarks</SectionHeading>
            <InputField label="Secretary Remarks" name="secretary_remarks" unrestricted />
            <InputField label="Accounting Remarks" name="accounting_remarks" unrestricted />
          </div>
        )
      default:
        return null
    }
  }

  if (!agent) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-white text-[#001f3f] max-w-6xl w-full max-h-[90vh] overflow-y-auto rounded-xl shadow-lg border-2 border-[#3c8dbc] p-2 sm:p-6">
        <DialogHeader className="border-b border-[#3c8dbc] pb-4">
          <DialogTitle className="text-lg sm:text-2xl text-[#001f3f] font-bold text-center sm:text-left">
            Edit Agent Commission: {agent.agent_name}
          </DialogTitle>

          {/* Stepper: stack on mobile, row on desktop */}
          <div className="flex flex-col sm:flex-row items-center justify-center mt-4 gap-2 sm:space-x-2">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => goToStep(step.id)}
                  className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 font-semibold text-xs sm:text-sm transition-all
                ${currentStep === step.id
                      ? "border-[#001f3f] bg-[#001f3f] text-white"
                      : "border-[#3c8dbc] bg-white text-[#3c8dbc] hover:bg-[#3c8dbc] hover:text-white"
                    }`}
                >
                  {currentStep > step.id ? <Check size={14} /> : step.id}
                </button>
                <span
                  className={`ml-2 text-xs sm:text-sm font-medium ${currentStep === step.id ? "text-[#001f3f]" : "text-[#3c8dbc]"}`}
                >
                  {step.title}
                </span>
                {index < steps.length - 1 && <div className="hidden sm:block w-8 h-0.5 bg-[#3c8dbc] mx-4"></div>}
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="py-4 sm:py-6">{renderStepContent()}</div>

        <DialogFooter className="border-t border-[#3c8dbc] pt-4">
          {/* Buttons: stack on mobile, row on desktop */}
          <div className="flex flex-col sm:flex-row justify-between w-full gap-2">
            <div className="flex flex-row gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                className="bg-white text-[#3c8dbc] border-[#3c8dbc] hover:bg-[#3c8dbc] hover:text-white w-full sm:w-auto"
                onClick={prevStep}
                disabled={currentStep === 1}
              >
                <ChevronLeft size={16} className="mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                className="bg-white text-[#3c8dbc] border-[#3c8dbc] hover:bg-[#3c8dbc] hover:text-white w-full sm:w-auto"
                onClick={nextStep}
                disabled={currentStep === steps.length}
              >
                Next
                <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>

            <div className="flex flex-row gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                className="bg-white text-[#3c8dbc] border-[#3c8dbc] hover:bg-[#3c8dbc] hover:text-white w-full sm:w-auto"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button className="bg-[#001f3f] text-white hover:bg-[#3c8dbc] w-full sm:w-auto" onClick={handleSave}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AgentEditModal
export { AgentEditModal }
