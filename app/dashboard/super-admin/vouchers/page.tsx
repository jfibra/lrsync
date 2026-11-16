"use client"

import React from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardHeader } from "@/components/dashboard-header"
import { CommissionVouchersManager } from "@/components/commission-vouchers-manager"

export default function SuperAdminVouchersPage() {
  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <div className="min-h-screen bg-slate-50 pb-16 lg:pb-10">
        <DashboardHeader />
        <div className="pt-20 px-4 sm:px-6 lg:px-8 pb-12 max-w-[1600px] mx-auto">
          <CommissionVouchersManager role="super_admin" />
        </div>
      </div>
    </ProtectedRoute>
  )
}
