"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/auth-context"
import { MessageSquarePlus } from "lucide-react"

interface AddRemarkModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  saleId: number
  onRemarkAdded: () => void
}

export function AddRemarkModal({ open, onOpenChange, saleId, onRemarkAdded }: AddRemarkModalProps) {
  const { profile } = useAuth()
  const [remarkInput, setRemarkInput] = useState("")
  const [loading, setLoading] = useState(false)

  const handleAddRemark = async () => {
    if (!remarkInput.trim() || !profile) return

    setLoading(true)
    try {
      const { supabase } = await import("@/lib/supabase/client")

      // Get current remarks
      const { data: currentSale } = await supabase.from("sales").select("remarks").eq("id", saleId).single()

      let existingRemarks: any[] = []
      if (currentSale?.remarks) {
        try {
          existingRemarks = JSON.parse(currentSale.remarks)
        } catch {
          existingRemarks = []
        }
      }

      // Add new remark
      const newRemark = {
        remark: remarkInput.trim(),
        name: profile.full_name || "",
        uuid: profile.id || "",
        date: new Date().toISOString(),
      }

      const updatedRemarks = [...existingRemarks, newRemark]

      // Update the sale record
      const { error } = await supabase
        .from("sales")
        .update({ remarks: JSON.stringify(updatedRemarks) })
        .eq("id", saleId)

      if (error) throw error

      // Log the action
      await supabase.rpc("log_notification", {
        p_action: "remark_added",
        p_description: `Remark added to sales record ID: ${saleId}`,
        p_ip_address: "",
        p_location: null,
        p_user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "",
        p_meta: { saleId, remarkText: remarkInput.trim() },
      })

      setRemarkInput("")
      onRemarkAdded()
      onOpenChange(false)
    } catch (error) {
      console.error("Error adding remark:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white text-[#001f3f]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5 text-blue-600" />
            Add Remark
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="remark" className="text-sm font-medium text-[#001f3f]">
              Remark
            </Label>
            <textarea
              id="remark"
              value={remarkInput}
              onChange={(e) => setRemarkInput(e.target.value)}
              rows={4}
              className="w-full border-2 border-[#001f3f] focus:border-blue-500 focus:ring-blue-500 text-[#001f3f] bg-blue-50 rounded-lg p-3 shadow-sm resize-none"
              placeholder="Enter your remark..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="border-[#001f3f] text-[#001f3f] hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAddRemark}
              disabled={loading || !remarkInput.trim()}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
            >
              {loading ? "Adding..." : "Add Remark"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
