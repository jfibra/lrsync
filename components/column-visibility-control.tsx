"use client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Columns, Eye, EyeOff } from "lucide-react"

interface Column {
  key: string
  label: string
  visible: boolean
}

interface ColumnVisibilityControlProps {
  columns: Column[]
  onColumnToggle: (key: string) => void
}

export function ColumnVisibilityControl({ columns, onColumnToggle }: ColumnVisibilityControlProps) {
  const visibleCount = columns.filter((col) => col.visible).length
  const totalCount = columns.length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-transparent">
          <Columns className="h-4 w-4 mr-2" />
          Columns ({visibleCount}/{totalCount})
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-white text-[#001f3f]">
        <DropdownMenuLabel className="text-sm font-semibold text-[#001f3f]">Toggle Columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.key}
            className="cursor-pointer"
            checked={column.visible}
            onCheckedChange={() => onColumnToggle(column.key)}
          >
            <div className="flex items-center gap-2">
              {column.visible ? (
                <Eye className="h-3 w-3 text-green-600" />
              ) : (
                <EyeOff className="h-3 w-3 text-gray-400" />
              )}
              <span className="text-sm">{column.label}</span>
            </div>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
