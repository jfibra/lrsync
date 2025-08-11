"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { DashboardHeader } from "@/components/dashboard-header"

export default function ActivityTrackerPage() {
  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <DashboardHeader />
      <div className="pt-20 px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-4">Activity Tracker</h1>
        <p className="text-muted-foreground">This page will display activity logs in the future.</p>
      </div>
    </ProtectedRoute>
  )
}