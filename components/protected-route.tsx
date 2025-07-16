"use client"

import type React from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import type { UserRole } from "@/types/auth"

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
  redirectTo?: string
}

export function ProtectedRoute({ children, allowedRoles, redirectTo = "/login" }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [timeoutReached, setTimeoutReached] = useState(false)

  useEffect(() => {
    // Set a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      console.log("ProtectedRoute timeout reached")
      setTimeoutReached(true)
    }, 10000) // 10 second timeout

    return () => clearTimeout(timeout)
  }, [])

  useEffect(() => {
    if (timeoutReached || !loading) {
      if (!user) {
        console.log("ProtectedRoute: No user, redirecting to", redirectTo)
        router.push(redirectTo)
        return
      }

      if (!profile) {
        console.log("ProtectedRoute: No profile, redirecting to login")
        router.push("/login")
        return
      }

      if (allowedRoles && !allowedRoles.includes(profile.role)) {
        console.log("ProtectedRoute: Role not allowed, redirecting based on role")
        // Redirect based on user role
        switch (profile.role) {
          case "super_admin":
            router.push("/dashboard/super-admin")
            break
          case "admin":
            router.push("/dashboard/admin")
            break
          case "secretary":
            router.push("/dashboard/secretary")
            break
          default:
            router.push("/login")
        }
      }
    }
  }, [user, profile, loading, allowedRoles, router, redirectTo, timeoutReached])

  if (timeoutReached && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Session Timeout</h2>
          <p className="text-gray-600 mb-4">Please sign in to continue.</p>
          <button
            onClick={() => router.push("/login")}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  if (loading && !timeoutReached) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Profile Setup Required</h2>
          <p className="text-gray-600 mb-4">Your profile needs to be set up by an administrator.</p>
          <p className="text-gray-600">Please contact support for assistance.</p>
          <button
            onClick={() => router.push("/login")}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return null
  }

  return <>{children}</>
}
