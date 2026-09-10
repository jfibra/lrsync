"use client"

import React, { useState } from "react"
import { Calendar, ChevronDown, Check, X } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  MONTHS_LIST,
  QUARTER_PRESETS,
  getAvailableYears,
  formatDatePeriodLabel,
} from "@/lib/date-filter"

interface YearSelectProps {
  value: string
  onValueChange: (year: string) => void
  availableYears?: string[]
  className?: string
}

export function YearSelect({
  value,
  onValueChange,
  availableYears = getAvailableYears(),
  className = "w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900",
}: YearSelectProps) {
  return (
    <Select value={value || "all"} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <div className="flex items-center gap-2 truncate">
          <Calendar className="h-4 w-4 text-gray-500 shrink-0" />
          <SelectValue placeholder="Filter by year">
            {value === "all" || !value ? "All Years" : `Year ${value}`}
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent className="bg-white border border-gray-200">
        <SelectItem value="all" className="text-gray-900 hover:bg-gray-100 font-medium">
          All Years
        </SelectItem>
        {availableYears.map((yr) => (
          <SelectItem key={yr} value={yr} className="text-gray-900 hover:bg-gray-100">
            {yr}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface MonthMultiSelectProps {
  selectedMonths: string[]
  onMonthsChange: (months: string[]) => void
  selectedYear?: string
  className?: string
}

export function MonthMultiSelect({
  selectedMonths = [],
  onMonthsChange,
  selectedYear = "all",
  className = "w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900",
}: MonthMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)

  const toggleMonth = (monthVal: string) => {
    if (selectedMonths.includes(monthVal)) {
      onMonthsChange(selectedMonths.filter((m) => m !== monthVal))
    } else {
      onMonthsChange([...selectedMonths, monthVal].sort())
    }
  }

  const selectQuarter = (presetMonths: string[]) => {
    onMonthsChange([...presetMonths])
  }

  const selectAll = () => {
    onMonthsChange(MONTHS_LIST.map((m) => m.value))
  }

  const clearMonths = () => {
    onMonthsChange([])
  }

  // Determine button trigger label
  const getTriggerLabel = () => {
    if (!selectedMonths || selectedMonths.length === 0) {
      return selectedYear !== "all" ? `All Months (${selectedYear})` : "All Months"
    }
    if (selectedMonths.length === 12) {
      return selectedYear !== "all" ? `Full Year (${selectedYear})` : "Full Year (All Months)"
    }
    return formatDatePeriodLabel("all", selectedMonths)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Filter by month"
          className={`h-10 px-3 py-2 text-sm border rounded-md flex items-center justify-between font-normal text-left truncate transition-colors shadow-sm ${className}`}
        >
          <span className="truncate">{getTriggerLabel()}</span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3 bg-white border border-gray-200 shadow-xl rounded-lg z-50" align="start">
        {/* Popover Header */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-700">Filter Months</span>
            {selectedYear !== "all" && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                {selectedYear}
              </span>
            )}
          </div>
          {selectedMonths.length > 0 && (
            <button
              type="button"
              onClick={clearMonths}
              className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1 transition-colors"
            >
              <X className="h-3 w-3" /> Reset
            </button>
          )}
        </div>

        {/* Quick Presets */}
        <div className="mb-3">
          <div className="text-[11px] font-medium text-gray-500 mb-1.5">Quick Presets:</div>
          <div className="grid grid-cols-6 gap-1">
            <button
              type="button"
              onClick={selectAll}
              className={`text-xs py-1 px-1.5 rounded text-center transition-all font-medium ${
                selectedMonths.length === 12
                  ? "bg-[#001f3f] text-white"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
            >
              All
            </button>
            {Object.entries(QUARTER_PRESETS).map(([qKey, qObj]) => {
              const isSelected =
                qObj.months.length === selectedMonths.length &&
                qObj.months.every((m) => selectedMonths.includes(m))
              return (
                <button
                  key={qKey}
                  type="button"
                  onClick={() => selectQuarter(qObj.months)}
                  className={`text-xs py-1 px-1.5 rounded text-center transition-all font-medium ${
                    isSelected
                      ? "bg-[#001f3f] text-white"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  }`}
                  title={qObj.label}
                >
                  {qKey}
                </button>
              )
            })}
            <button
              type="button"
              onClick={clearMonths}
              className={`text-xs py-1 px-1.5 rounded text-center transition-all font-medium ${
                selectedMonths.length === 0
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-600"
              }`}
              title="All Months (Default)"
            >
              None
            </button>
          </div>
        </div>

        {/* 12 Months Grid */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {MONTHS_LIST.map((m) => {
            const isChecked = selectedMonths.includes(m.value)
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => toggleMonth(m.value)}
                className={`py-1.5 px-2 text-xs rounded-md font-medium flex items-center justify-between transition-all border ${
                  isChecked
                    ? "bg-[#001f3f] text-white border-[#001f3f] shadow-sm"
                    : "bg-gray-50 hover:bg-gray-100 text-gray-800 border-gray-200"
                }`}
              >
                <span>{m.short}</span>
                {isChecked && <Check className="h-3.5 w-3.5 text-white stroke-[2.5]" />}
              </button>
            )
          })}
        </div>

        {/* Footer info & Done button */}
        <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
          <span className="text-[11px] text-gray-500">
            {selectedMonths.length === 0
              ? "All months included"
              : `${selectedMonths.length} of 12 selected`}
          </span>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-xs bg-[#001f3f] text-white hover:bg-[#002f5f] px-3 py-1 rounded font-medium transition-colors"
          >
            Apply
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
