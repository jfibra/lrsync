"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Edit2, Trash2, Save, X } from "lucide-react"
import { format } from "date-fns"

interface Remark {
  remark: string
  name: string
  uuid: string
  date: string
}

interface RemarksModalViewerProps {
  isOpen: boolean
  onClose: () => void
  saleId: string
  remarks: string | null
  onRemarksUpdate: (saleId: string, updatedRemarks: Remark[]) => void
  roleColor?: "blue" | "purple" // For theme consistency
}

export function RemarksModalViewer({
  isOpen,
  onClose,
  saleId,
  remarks,
  onRemarksUpdate,
  roleColor = "blue",
}: RemarksModalViewerProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editText, setEditText] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const parseRemarks = (remarksJson: string | null): Remark[] => {
    if (!remarksJson) return []
    try {
      const parsed = JSON.parse(remarksJson)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  const remarksArray = parseRemarks(remarks)
  const sortedRemarks = [...remarksArray].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const handleEdit = (index: number, remark: string) => {
    setEditingIndex(index)
    setEditText(remark)
  }

  const handleSave = async (index: number) => {
    if (!editText.trim()) return

    setIsLoading(true)
    try {
      const targetRemark = sortedRemarks[index]
      const updatedRemarks = remarksArray.map((remark) => {
        if (
          remark.uuid === targetRemark.uuid &&
          remark.date === targetRemark.date &&
          remark.remark === targetRemark.remark
        ) {
          return { ...remark, remark: editText.trim() }
        }
        return remark
      })

      console.log("[v0] Saving remark update for saleId:", saleId)
      console.log("[v0] Updated remarks array:", updatedRemarks)

      const response = await fetch("/api/update-sale-remarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId,
          remarks: updatedRemarks,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        console.log("[v0] API response:", result)
        onRemarksUpdate(saleId, updatedRemarks)
        setEditingIndex(null)
        setEditText("")
      } else {
        const errorText = await response.text()
        console.error("[v0] Failed to update remark:", errorText)
      }
    } catch (error) {
      console.error("[v0] Error updating remark:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (index: number) => {
    if (!confirm("Are you sure you want to delete this remark?")) return

    setIsLoading(true)
    try {
      const targetRemark = sortedRemarks[index]
      const updatedRemarks = remarksArray.filter((remark) => {
        return !(
          remark.uuid === targetRemark.uuid &&
          remark.date === targetRemark.date &&
          remark.remark === targetRemark.remark
        )
      })

      console.log("[v0] Deleting remark for saleId:", saleId)
      console.log("[v0] Updated remarks array after deletion:", updatedRemarks)

      const response = await fetch("/api/update-sale-remarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId,
          remarks: updatedRemarks,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        console.log("[v0] API response:", result)
        onRemarksUpdate(saleId, updatedRemarks)
      } else {
        const errorText = await response.text()
        console.error("[v0] Failed to delete remark:", errorText)
      }
    } catch (error) {
      console.error("[v0] Error deleting remark:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setEditingIndex(null)
    setEditText("")
  }

  const themeColors = {
    blue: {
      header: "bg-blue-600",
      badge: "bg-blue-100 text-blue-800",
      button: "bg-blue-600 hover:bg-blue-700",
      editButton: "text-blue-600 hover:text-blue-800",
      deleteButton: "text-red-600 hover:text-red-800",
    },
    purple: {
      header: "bg-purple-600",
      badge: "bg-purple-100 text-purple-800",
      button: "bg-purple-600 hover:bg-purple-700",
      editButton: "text-purple-600 hover:text-purple-800",
      deleteButton: "text-red-600 hover:text-red-800",
    },
  }

  const colors = themeColors[roleColor]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] bg-white text-[#001f3f] overflow-hidden flex flex-col">
        <DialogHeader className={`${colors.header} text-white p-4 -m-6 mb-4`}>
          <DialogTitle className="text-lg font-semibold">All Remarks ({sortedRemarks.length})</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {sortedRemarks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No remarks found for this sale.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Remark</TableHead>
                  <TableHead className="w-40">Created By</TableHead>
                  <TableHead className="w-32">Date</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRemarks.map((remark, index) => (
                  <TableRow key={`${remark.uuid}-${remark.date}`}>
                    <TableCell>
                      <Badge variant="outline" className={colors.badge}>
                        {index + 1}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {editingIndex === index ? (
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="min-h-[60px] bg-white resize-none"
                          placeholder="Enter remark..."
                        />
                      ) : (
                        <div className="whitespace-pre-wrap text-sm">{remark.remark}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{remark.name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-600">
                        {format(new Date(remark.date), "MMM dd, yyyy")}
                        <br />
                        <span className="text-xs">{format(new Date(remark.date), "h:mm a")}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {editingIndex === index ? (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            onClick={() => handleSave(index)}
                            disabled={isLoading || !editText.trim()}
                            className={`${colors.button} text-white`}
                          >
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            className="bg-white"
                            variant="outline"
                            onClick={handleCancel}
                            disabled={isLoading}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(index, remark.remark)}
                            disabled={isLoading}
                            className={colors.editButton}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(index)}
                            disabled={isLoading}
                            className={colors.deleteButton}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="flex justify-end text-white pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
