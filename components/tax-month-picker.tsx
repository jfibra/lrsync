"use client"

import React, { useMemo } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const MONTHS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
]

export function formatTaxMonthValue(year: number, monthNum: number): string {
  const lastDay = new Date(year, monthNum, 0).getDate()
  return `${year}-${String(monthNum).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
}

export function parseTaxMonthParts(value?: string | null): { year: string; month: string } {
  const trimmed = (value || "").trim()
  const match = trimmed.match(/^(\d{4})-(\d{2})/)
  if (match) {
    return { year: match[1], month: match[2] }
  }
  return { year: "", month: "" }
}

interface TaxMonthPickerProps {
  id?: string
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
  triggerClassName?: string
  minYear?: number
  futureYears?: number
}

export function TaxMonthPicker({
  id,
  value,
  onValueChange,
  disabled = false,
  triggerClassName = "bg-white text-[#001f3f] border-[#001f3f]",
  minYear = 2020,
  futureYears = 5,
}: TaxMonthPickerProps) {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonthStr = String(now.getMonth() + 1).padStart(2, "0")

  const { year: selectedYear, month: selectedMonth } = parseTaxMonthParts(value)

  const years = useMemo(() => {
    const maxY = Math.max(currentYear + futureYears, selectedYear ? Number(selectedYear) : 0)
    const minY = Math.min(minYear, selectedYear ? Number(selectedYear) : minYear)
    const list: string[] = []
    for (let y = maxY; y >= minY; y--) {
      list.push(String(y))
    }
    return list
  }, [currentYear, futureYears, minYear, selectedYear])

  const handleMonthChange = (nextMonth: string) => {
    const yr = Number(selectedYear || currentYear)
    const mo = Number(nextMonth)
    if (!Number.isNaN(yr) && !Number.isNaN(mo)) {
      onValueChange(formatTaxMonthValue(yr, mo))
    }
  }

  const handleYearChange = (nextYear: string) => {
    const yr = Number(nextYear)
    const mo = Number(selectedMonth || currentMonthStr)
    if (!Number.isNaN(yr) && !Number.isNaN(mo)) {
      onValueChange(formatTaxMonthValue(yr, mo))
    }
  }

  return (
    <div id={id} className="grid grid-cols-2 gap-2">
      <Select value={selectedMonth} onValueChange={handleMonthChange} disabled={disabled}>
        <SelectTrigger className={triggerClassName}>
          <SelectValue placeholder="Month" />
        </SelectTrigger>
        <SelectContent className="bg-white">
          {MONTHS.map((m) => (
            <SelectItem key={m.value} value={m.value} className="text-[#001f3f] hover:bg-gray-100">
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selectedYear} onValueChange={handleYearChange} disabled={disabled}>
        <SelectTrigger className={triggerClassName}>
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent className="bg-white">
          {years.map((yr) => (
            <SelectItem key={yr} value={yr} className="text-[#001f3f] hover:bg-gray-100">
              {yr}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
