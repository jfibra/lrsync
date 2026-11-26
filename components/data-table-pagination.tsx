"use client"

import React, { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

interface DataTablePaginationProps {
  totalItems: number
  currentPage: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  itemLabel?: string
  pageSizeOptions?: number[]
}

export function DataTablePagination({
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = "records",
  pageSizeOptions = [10, 15, 25, 50, 100],
}: DataTablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(Math.max(1, currentPage), totalPages)

  const pageNumbers = useMemo(() => {
    const pages: (number | "...")[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (safePage > 3) pages.push("...")
      const start = Math.max(2, safePage - 1)
      const end = Math.min(totalPages - 1, safePage + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (safePage < totalPages - 2) pages.push("...")
      pages.push(totalPages)
    }
    return pages
  }, [totalPages, safePage])

  if (totalItems <= 0) return null

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50/70">
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <span>
          Showing{" "}
          <strong className="text-[#001f3f]">{(safePage - 1) * pageSize + 1}</strong> to{" "}
          <strong className="text-[#001f3f]">{Math.min(safePage * pageSize, totalItems)}</strong>{" "}
          of <strong className="text-[#001f3f]">{totalItems}</strong> {itemLabel}
        </span>

        <div className="flex items-center gap-1.5">
          <span>Rows per page:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(val) => onPageSizeChange(Number(val))}
          >
            <SelectTrigger className="h-7 w-16 text-xs bg-white border-slate-300 text-[#001f3f]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {pageSizeOptions.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => onPageChange(1)}
          disabled={safePage <= 1}
          className="h-7 w-7 border-slate-300 bg-white text-[#001f3f]"
          title="First page"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage <= 1}
          className="h-7 w-7 border-slate-300 bg-white text-[#001f3f]"
          title="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>

        {pageNumbers.map((pg, idx) =>
          pg === "..." ? (
            <span key={`ellipsis-${idx}`} className="px-1.5 text-xs text-slate-400">
              ...
            </span>
          ) : (
            <Button
              key={pg}
              type="button"
              size="sm"
              variant={pg === safePage ? "default" : "outline"}
              onClick={() => onPageChange(pg)}
              className={
                pg === safePage
                  ? "h-7 min-w-[28px] px-2 text-xs bg-[#001f3f] text-white font-bold"
                  : "h-7 min-w-[28px] px-2 text-xs border-slate-300 bg-white text-[#001f3f] hover:bg-slate-100"
              }
            >
              {pg}
            </Button>
          )
        )}

        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage >= totalPages}
          className="h-7 w-7 border-slate-300 bg-white text-[#001f3f]"
          title="Next page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => onPageChange(totalPages)}
          disabled={safePage >= totalPages}
          className="h-7 w-7 border-slate-300 bg-white text-[#001f3f]"
          title="Last page"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}
