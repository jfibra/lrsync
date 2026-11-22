"use client"

import React, { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { ProtectedRoute } from "@/components/protected-route"

function CollectorActivitiesRedirect() {
  const { profile, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (loading || !profile) return
    const roleSlug = profile.role.replace("_", "-")
    const collectionId = searchParams.get("collection_id")
    const target = collectionId
      ? `/dashboard/${roleSlug}/cheque-verification?collection_id=${encodeURIComponent(collectionId)}`
      : `/dashboard/${roleSlug}/cheque-verification`
    router.replace(target)
  }, [profile, loading, router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-500">
      Opening Collector Activities...
    </div>
  )
}

export default function CollectorActivitiesPage() {
  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "secretary"]}>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-500">
            Loading...
          </div>
        }
      >
        <CollectorActivitiesRedirect />
      </Suspense>
    </ProtectedRoute>
  )
}
