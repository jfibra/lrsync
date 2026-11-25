"use client"

import React, { Suspense } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardHeader } from "@/components/dashboard-header"
import { AttachmentsLibraryManager } from "@/components/attachments-library-manager"

export default function AdminAttachmentsLibraryPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="min-h-screen bg-slate-50 pb-16 lg:pb-10">
        <DashboardHeader />
        <div className="pt-20 px-4 sm:px-6 lg:px-8 pb-12 max-w-[1600px] mx-auto">
          <Suspense fallback={<div className="py-16 text-center text-sm text-slate-500">Loading library...</div>}>
            <AttachmentsLibraryManager role="admin" />
          </Suspense>
        </div>
      </div>
    </ProtectedRoute>
  )
}
