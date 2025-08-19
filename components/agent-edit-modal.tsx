"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export interface AgentEditModalProps {
  open: boolean
  agent: any
  onClose: () => void
  onSave: (updatedAgent: any) => void
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

function formatNumberWithCommas(value: string) {
  const num = value.replace(/,/g, "")
  if (!num) return ""
  const parts = num.split(".")
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return parts.join(".")
}

export function AgentEditModal({ open, agent, onClose, onSave }: AgentEditModalProps) {
  const [form, setForm] = useState(agent || {})
  const [calcTimer, setCalcTimer] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setForm(agent || {})
  }, [agent])

  const doCalculation = (formData: any) => {
    const calcType = formData.calculation_type
    const comm = Number.parseFloat(formData.comm?.toString().replace(/,/g, "") || "0")
    const agentsRate = Number.parseFloat(formData.agents_rate || "0")
    const developersRate = Number.parseFloat(formData.developers_rate || "5")

    let netOfVat = ""
    let agent = ""
    let vat = ""
    let ewt = ""
    let netComm = ""

    if (agentsRate === 0) {
      agent = ""
      vat = ""
      ewt = ""
      netComm = ""
    } else {
      if (calcType === "vat deduction") {
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
        const agentEwtRate = Number(formData.agent_ewt_rate || "5") / 100
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
        netOfVat = comm ? String(comm / 1.02) : ""
        agent =
          netOfVat && agentsRate && developersRate
            ? String((Number.parseFloat(netOfVat) * agentsRate) / developersRate)
            : ""
        vat = agent ? String(Number.parseFloat(agent) * 0.12) : ""
        const agentEwtRate = Number(formData.agent_ewt_rate || "5") / 100
        ewt = agent ? String(Number.parseFloat(agent) * agentEwtRate) : ""
        netComm =
          agent && vat && ewt ? String(Number.parseFloat(agent) + Number.parseFloat(vat) - Number.parseFloat(ewt)) : ""
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

  const handleChange = (name: string, value: string) => {
    const newForm = { ...form }

    if (name === "comm") {
      const formattedValue = formatNumberWithCommas(value)
      newForm[name] = formattedValue
      setForm(newForm)

      // Clear previous timer
      if (calcTimer) {
        clearTimeout(calcTimer)
      }

      // Set new timer for calculation
      const timer = setTimeout(() => {
        const calculatedForm = doCalculation(newForm)
        setForm(calculatedForm)
      }, 700)

      setCalcTimer(timer)
      return
    } else {
      newForm[name] = value
      setForm(newForm)
    }

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
      setTimeout(() => {
        const calculatedForm = doCalculation(newForm)
        setForm(calculatedForm)
      }, 0)
    }
  }

  const handleSave = () => {
    onSave(form)
  }

  if (!agent) return null

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
    ...props
  }: {
    label: string
    name: string
    type?: string
    disabled?: boolean
    children?: React.ReactNode
    [key: string]: any
  }) => (
    <div>
      <label className="block text-sm font-semibold text-[#001f3f] mb-2">{label}</label>
      {children ? (
        children
      ) : (
        <Input
          className={`border-[#3c8dbc] focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] bg-white
                        ${disabled ? "bg-gray-100 text-gray-400 cursor-not-allowed" : ""}
                    `}
          name={name}
          type={type}
          value={form[name] || ""}
          onChange={(e) => handleChange(name, e.target.value)}
          disabled={disabled}
          {...props}
        />
      )}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-white text-[#001f3f] max-w-6xl w-full max-h-[90vh] overflow-y-auto rounded-xl shadow-lg border-2 border-[#3c8dbc]">
        <DialogHeader className="border-b border-[#3c8dbc] pb-4">
          <DialogTitle className="text-2xl text-[#001f3f] font-bold">
            Edit Agent Commission: {agent.agent_name}
          </DialogTitle>
        </DialogHeader>

        <div className="py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <SectionHeading bgColor="#001f3f">Commission Sale Details</SectionHeading>

            <InputField label="Developer" name="developer" />
            <InputField label="Client" name="client" disabled />
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
            <InputField label="BDO Account #" name="bdo_account" />
            <InputField
              label="Net of VAT"
              name="net_of_vat"
              type="text"
              disabled
              value={form.net_of_vat ? formatCurrency(Number.parseFloat(form.net_of_vat)) : ""}
            />
            <InputField label="Status" name="status" />
            <InputField label="Invoice Number" name="invoice_number" />

            <SectionHeading bgColor="#3c8dbc">Agent Details</SectionHeading>

            <InputField label="Agent Name" name="agent_name" />
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
              <Select value={form.agents_rate || ""} onValueChange={(value) => handleChange("agents_rate", value)}>
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
                value={form.developers_rate || ""}
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
            <InputField
              label="Agent Amount"
              name="agent_amount"
              disabled
              value={form.agent_amount ? formatCurrency(Number.parseFloat(form.agent_amount)) : ""}
            />
            <InputField
              label="Agent VAT"
              name="agent_vat"
              disabled
              value={form.agent_vat ? formatCurrency(Number.parseFloat(form.agent_vat)) : ""}
            />
            <InputField
              label="Agent EWT"
              name="agent_ewt"
              disabled
              value={form.agent_ewt ? formatCurrency(Number.parseFloat(form.agent_ewt)) : ""}
            />
            <InputField label="Agent EWT Rate (%)" name="agent_ewt_rate">
              <Select
                value={form.agent_ewt_rate || "5"}
                onValueChange={(value) => handleChange("agent_ewt_rate", value)}
              >
                <SelectTrigger className="border-[#3c8dbc] focus:border-[#001f3f] text-[#001f3f] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="5" className="text-[#001f3f]">
                    5%
                  </SelectItem>
                  <SelectItem value="10" className="text-[#001f3f]">
                    10%
                  </SelectItem>
                </SelectContent>
              </Select>
            </InputField>
            <InputField
              label="Agent Net Commission"
              name="agent_net_comm"
              disabled
              value={form.agent_net_comm ? formatCurrency(Number.parseFloat(form.agent_net_comm)) : ""}
            />

            <SectionHeading bgColor="#ff851b">UM Details</SectionHeading>

            <InputField label="UM Name" name="um_name" />
            <InputField label="UM BDO Account #" name="um_bdo_account" />
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
              <Select value={form.um_rate || ""} onValueChange={(value) => handleChange("um_rate", value)}>
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
                value={form.um_developers_rate || ""}
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
            <InputField
              label="UM Amount"
              name="um_amount"
              disabled
              value={form.um_amount ? formatCurrency(Number.parseFloat(form.um_amount)) : ""}
            />
            <InputField
              label="UM VAT"
              name="um_vat"
              disabled
              value={form.um_vat ? formatCurrency(Number.parseFloat(form.um_vat)) : ""}
            />
            <InputField
              label="UM EWT"
              name="um_ewt"
              disabled
              value={form.um_ewt ? formatCurrency(Number.parseFloat(form.um_ewt)) : ""}
            />
            <InputField label="UM EWT Rate (%)" name="um_ewt_rate">
              <Select value={form.um_ewt_rate || "5"} onValueChange={(value) => handleChange("um_ewt_rate", value)}>
                <SelectTrigger className="border-[#3c8dbc] focus:border-[#001f3f] text-[#001f3f] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="5" className="text-[#001f3f]">
                    5%
                  </SelectItem>
                  <SelectItem value="10" className="text-[#001f3f]">
                    10%
                  </SelectItem>
                </SelectContent>
              </Select>
            </InputField>
            <InputField
              label="UM Net Commission"
              name="um_net_comm"
              disabled
              value={form.um_net_comm ? formatCurrency(Number.parseFloat(form.um_net_comm)) : ""}
            />

            <SectionHeading bgColor="#ffc107">TL Details</SectionHeading>

            <InputField label="TL Name" name="tl_name" />
            <InputField label="TL BDO Account #" name="tl_bdo_account" />
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
              <Select value={form.tl_rate || ""} onValueChange={(value) => handleChange("tl_rate", value)}>
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
                value={form.tl_developers_rate || ""}
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
            <InputField
              label="TL Amount"
              name="tl_amount"
              disabled
              value={form.tl_amount ? formatCurrency(Number.parseFloat(form.tl_amount)) : ""}
            />
            <InputField
              label="TL VAT"
              name="tl_vat"
              disabled
              value={form.tl_vat ? formatCurrency(Number.parseFloat(form.tl_vat)) : ""}
            />
            <InputField
              label="TL EWT"
              name="tl_ewt"
              disabled
              value={form.tl_ewt ? formatCurrency(Number.parseFloat(form.tl_ewt)) : ""}
            />
            <InputField label="TL EWT Rate (%)" name="tl_ewt_rate">
              <Select value={form.tl_ewt_rate || "5"} onValueChange={(value) => handleChange("tl_ewt_rate", value)}>
                <SelectTrigger className="border-[#3c8dbc] focus:border-[#001f3f] text-[#001f3f] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="5" className="text-[#001f3f]">
                    5%
                  </SelectItem>
                  <SelectItem value="10" className="text-[#001f3f]">
                    10%
                  </SelectItem>
                </SelectContent>
              </Select>
            </InputField>
            <InputField
              label="TL Net Commission"
              name="tl_net_comm"
              disabled
              value={form.tl_net_comm ? formatCurrency(Number.parseFloat(form.tl_net_comm)) : ""}
            />

            <SectionHeading bgColor="#28a745">Remarks</SectionHeading>

            <InputField label="Secretary Remarks" name="secretary_remarks" />
            <InputField label="Accounting Remarks" name="accounting_remarks" />
          </div>
        </div>

        <DialogFooter className="border-t border-[#3c8dbc] pt-4">
          <Button
            variant="outline"
            className="bg-white text-[#3c8dbc] border-[#3c8dbc] hover:bg-[#3c8dbc] hover:text-white"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button className="bg-[#001f3f] text-white hover:bg-[#3c8dbc]" onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
