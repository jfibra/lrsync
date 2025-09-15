"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Edit2, Trash2, Save, X } from "lucide-react"
import { format } from "date-fns"
import { supabase } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface Remark {
    remark: string
    name: string
    uuid: string
    date: string
}

interface RemarksModalViewerPurchasesProps {
    isOpen: boolean
    onClose: () => void
    purchaseId: string
    remarks: string | null
    onRemarksUpdate: (purchaseId: string, updatedRemarks: Remark[]) => void
    userRole?: string
}

export function RemarksModalViewerPurchases({
    isOpen,
    onClose,
    purchaseId,
    remarks,
    onRemarksUpdate,
    userRole,
}: RemarksModalViewerPurchasesProps) {
    const [editingIndex, setEditingIndex] = useState<number | null>(null)
    const [editText, setEditText] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

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

            const { error } = await supabase
                .from("purchases")
                .update({
                    remarks: JSON.stringify(updatedRemarks),
                    updated_at: new Date().toISOString(),
                })
                .eq("id", purchaseId) // <-- use purchaseId

            if (!error) {
                onRemarksUpdate(purchaseId, updatedRemarks) // <-- use purchaseId
                setEditingIndex(null)
                setEditText("")

                // Log the edit action
                await supabase.rpc("log_notification", {
                    p_action: "edit_purchase_remark",
                    p_description: `Remark edited for purchase ID: ${purchaseId}`,
                    p_ip_address: "",
                    p_location: null,
                    p_user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "",
                    p_meta: {
                        purchaseId,
                        uuid: targetRemark.uuid,
                        edited_remark: editText.trim(),
                        original_remark: targetRemark.remark,
                        date: targetRemark.date,
                    },
                })
                router.replace(`/dashboard/${userRole === "super_admin" ? "super-admin" : userRole}/purchases`)
            } else {
                console.error("[v0] Failed to update remark:", error)
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

            const { error } = await supabase
                .from("purchases")
                .update({
                    remarks: JSON.stringify(updatedRemarks),
                    updated_at: new Date().toISOString(),
                })
                .eq("id", purchaseId) // <-- use purchaseId

            if (!error) {
                onRemarksUpdate(purchaseId, updatedRemarks) // <-- use purchaseId

                // Log the delete action
                await supabase.rpc("log_notification", {
                    p_action: "delete_purchase_remark",
                    p_description: `Remark deleted for purchase ID: ${purchaseId}`,
                    p_ip_address: "",
                    p_location: null,
                    p_user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "",
                    p_meta: {
                        purchaseId,
                        uuid: targetRemark.uuid,
                        deleted_remark: targetRemark.remark,
                        date: targetRemark.date,
                    },
                })
                router.replace(`/dashboard/${userRole === "super_admin" ? "super-admin" : userRole}/purchases`)
            } else {
                console.error("[v0] Failed to delete remark:", error)
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

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[80vh] bg-white text-[#001f3f] overflow-hidden flex flex-col">
                <DialogHeader className="bg-blue-600 text-white p-4 -m-6 mb-4">
                    <DialogTitle className="text-lg font-semibold">All Remarks ({sortedRemarks.length})</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-auto">
                    {sortedRemarks.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">No remarks found for this purchase.</div>
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
                                            <Badge variant="outline" className="bg-blue-100 text-blue-800">
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
                                                        className="bg-blue-600 hover:bg-blue-700 text-white"
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
                                                        className="text-blue-600 hover:text-blue-800"
                                                    >
                                                        <Edit2 className="h-3 w-3" />
                                                    </Button>
                                                    {userRole === "super_admin" && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handleDelete(index)}
                                                                disabled={isLoading}
                                                                className="text-red-600 hover:text-red-800"
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </>
                                                    )}
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