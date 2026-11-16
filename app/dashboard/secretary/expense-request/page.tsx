"use client"

import React from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardHeader } from "@/components/dashboard-header"
import { ExpenseRequestManager } from "@/components/expense-request-manager"

export default function SecretaryExpenseRequestPage() {
  return (
    <ProtectedRoute allowedRoles={["secretary"]}>
      <div className="min-h-screen bg-slate-50">
        <DashboardHeader />
        <div className="pt-20 px-4 sm:px-6 lg:px-8 pb-12 max-w-[1600px] mx-auto">
          <ExpenseRequestManager role="secretary" />
        </div>
      </div>
    </ProtectedRoute>
  )
}
