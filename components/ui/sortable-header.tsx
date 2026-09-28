import * as React from "react"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { TableHead } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export interface SortableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  field: string
  currentSortField?: string | null
  currentSort?: string | null
  currentSortDirection?: "asc" | "desc"
  direction?: "asc" | "desc"
  onSort: (field: string) => void
  children: React.ReactNode
  icon?: React.ReactNode
  align?: "left" | "center" | "right"
}

export function SortableTableHead({
  field,
  currentSortField,
  currentSort,
  currentSortDirection,
  direction,
  onSort,
  children,
  icon,
  align = "left",
  className,
  style,
  ...props
}: SortableTableHeadProps) {
  const activeSortField = currentSortField ?? currentSort
  const activeSortDirection = currentSortDirection ?? direction ?? "asc"
  const isActive = activeSortField === field

  return (
    <TableHead
      {...props}
      style={style}
      onClick={() => onSort(field)}
      className={cn(
        "cursor-pointer select-none transition-colors hover:bg-black/5 dark:hover:bg-white/5 group",
        className
      )}
      title={`Click to sort by ${typeof children === "string" ? children : field}`}
    >
      <div
        className={cn(
          "flex items-center gap-1.5",
          align === "center" && "justify-center",
          align === "right" && "justify-end"
        )}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        <span className="font-semibold">{children}</span>
        <span className="inline-flex shrink-0 items-center ml-0.5">
          {isActive ? (
            activeSortDirection === "asc" ? (
              <ArrowUp className="h-3.5 w-3.5 text-current stroke-[2.5]" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5 text-current stroke-[2.5]" />
            )
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-80 transition-opacity" />
          )}
        </span>
      </div>
    </TableHead>
  )
}

/**
 * Universal in-memory sort helper function that safely sorts objects by field path
 * Supports nested paths like "user_profiles.full_name", arrays lengths like "sales_uuids.length",
 * date strings, numeric strings, and raw numbers.
 */
export function sortData<T>(
  data: T[],
  field: string | null | undefined,
  direction: "asc" | "desc" = "asc"
): T[] {
  if (!field || !Array.isArray(data)) return data

  return [...data].sort((a: any, b: any) => {
    let valA = getNestedValue(a, field)
    let valB = getNestedValue(b, field)

    // Handle null / undefined
    if (valA === null || valA === undefined) return direction === "asc" ? 1 : -1
    if (valB === null || valB === undefined) return direction === "asc" ? -1 : 1

    // If numbers
    if (typeof valA === "number" && typeof valB === "number") {
      return direction === "asc" ? valA - valB : valB - valA
    }

    // Attempt date comparison if matches date pattern
    const isDateA = typeof valA === "string" && !isNaN(Date.parse(valA)) && (valA.includes("-") || valA.includes("/"))
    const isDateB = typeof valB === "string" && !isNaN(Date.parse(valB)) && (valB.includes("-") || valB.includes("/"))
    if (isDateA && isDateB) {
      const timeA = new Date(valA).getTime()
      const timeB = new Date(valB).getTime()
      if (!isNaN(timeA) && !isNaN(timeB)) {
        return direction === "asc" ? timeA - timeB : timeB - timeA
      }
    }

    // If numeric strings (e.g. "123.45")
    const numA = Number(valA)
    const numB = Number(valB)
    if (!isNaN(numA) && !isNaN(numB) && typeof valA === "string" && typeof valB === "string" && valA.trim() !== "" && valB.trim() !== "") {
      return direction === "asc" ? numA - numB : numB - numA
    }

    // String comparison (case insensitive)
    const strA = String(valA).toLowerCase()
    const strB = String(valB).toLowerCase()
    if (strA < strB) return direction === "asc" ? -1 : 1
    if (strA > strB) return direction === "asc" ? 1 : -1
    return 0
  })
}

function getNestedValue(obj: any, path: string): any {
  if (!obj) return null
  if (path.includes(".")) {
    const parts = path.split(".")
    let curr = obj
    for (const part of parts) {
      if (curr === null || curr === undefined) return null
      curr = curr[part]
    }
    return curr
  }
  return obj[path]
}
