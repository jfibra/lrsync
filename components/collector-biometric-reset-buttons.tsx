"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Smartphone, ScanFace, Loader2 } from "lucide-react"
import type { UserProfile } from "@/types/auth"

interface CollectorBiometricResetButtonsProps {
  user: UserProfile
}

export function CollectorBiometricResetButtons({ user }: CollectorBiometricResetButtonsProps) {
  const [busyAction, setBusyAction] = useState<"reset_device" | "reset_face" | null>(null)

  if (user.role !== "collector" || !user.auth_user_id) {
    return null
  }

  const runReset = async (action: "reset_device" | "reset_face") => {
    const displayName = user.full_name || user.email || "this collector"
    const confirmMsg =
      action === "reset_device"
        ? `Reset bound biometric device for ${displayName}? They will be able to bind a new phone on next sign-in.`
        : `Reset enrolled face for ${displayName}? This clears face enrollment metadata and deletes their enrolled face photo from S3.`

    if (!window.confirm(confirmMsg)) return

    setBusyAction(action)
    try {
      const res = await fetch("/api/admin/collector-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authUserId: user.auth_user_id,
          action,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || "Reset failed")
      }
      alert(data?.message || "Reset completed successfully.")
    } catch (err: any) {
      console.error("Collector reset error:", err)
      alert("Error: " + (err?.message || "Failed to complete reset"))
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={busyAction !== null}
        onClick={() => runReset("reset_device")}
        title="Reset Bound Biometric Device (Collector replaced phone)"
        className="text-sky-700 hover:bg-sky-100 hover:text-sky-900"
      >
        {busyAction === "reset_device" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Smartphone className="h-4 w-4" />
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={busyAction !== null}
        onClick={() => runReset("reset_face")}
        title="Reset Enrolled Face (Clears face metadata & deletes S3 enrolled-face.jpg)"
        className="text-indigo-700 hover:bg-indigo-100 hover:text-indigo-900"
      >
        {busyAction === "reset_face" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ScanFace className="h-4 w-4" />
        )}
      </Button>
    </>
  )
}
