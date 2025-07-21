"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Columns, Eye, EyeOff } from "lucide-react"

interface ColumnVisibilityControlProps {
  columns: Array<{
    key: string
    label: string
    visible: boolean
  }>
  onColumnToggle: (key: string) => void
}

export function ColumnVisibilityControl({ columns, onColumnToggle }: ColumnVisibilityControlProps) {
  const [open, setOpen] = useState(false)

  const visibleCount = columns.filter((col) => col.visible).length
  const totalCount = columns.length

  const showAll = () => {
    columns.forEach((col) => {
      if (!col.visible) {
        onColumnToggle(col.key)
      }
    })
  }

  const hideAll = () => {
    columns.forEach((col) => {
      if (col.visible) {
        onColumnToggle(col.key)
      }
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="bg-white text-blue-600 border border-blue-600 hover:bg-blue-50">
          <Columns className="h-4 w-4 mr-2" />
          Columns ({visibleCount}/{totalCount})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-white text-gray-900 border border-gray-300 shadow-lg" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">Column Visibility</h4>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={showAll}>
                <Eye className="h-3 w-3 mr-1" />
                All
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={hideAll}>
                <EyeOff className="h-3 w-3 mr-1" />
                None
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto">
            {columns.map((column) => (
              <div key={column.key} className="flex items-center space-x-2">
                <Checkbox id={column.key} checked={column.visible} onCheckedChange={() => onColumnToggle(column.key)} />
                <Label htmlFor={column.key} className="text-sm font-medium text-gray-700 cursor-pointer flex-1">
                  {column.label}
                </Label>
              </div>
            ))}
          </div>

          <div className="text-xs text-gray-500 pt-2 border-t">
            {visibleCount} of {totalCount} columns visible
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
