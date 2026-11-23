"use client"

import React, { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw } from "lucide-react"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Dashboard runtime error:", error)
  }, [error])

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl shadow-sm p-6 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#001f3f]">Something went wrong loading this page</h2>
          <p className="text-xs text-slate-600 mt-1">
            {error?.message || "An unexpected error occurred while rendering this dashboard view."}
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button onClick={() => reset()} className="bg-[#001f3f] hover:bg-[#001f3f]/90 text-white">
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Try Again
          </Button>
          <Button variant="outline" onClick={() => window.history.back()}>
            Go Back
          </Button>
        </div>
      </div>
    </div>
  )
}
