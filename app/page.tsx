"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"

export default function HomePage() {
  const router = useRouter()
  const { user, profile, loading } = useAuth()
  const [redirecting, setRedirecting] = useState(false)
  const [timeoutReached, setTimeoutReached] = useState(false)

  useEffect(() => {
    // Set a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      console.log("Homepage timeout reached - forcing redirect to login")
      setTimeoutReached(true)
      if (!redirecting) {
        setRedirecting(true)
        router.push("/login")
      }
    }, 8000) // 8 second timeout

    return () => clearTimeout(timeout)
  }, [router, redirecting])

  useEffect(() => {
    console.log(
      "HomePage useEffect - loading:",
      loading,
      "user:",
      !!user,
      "profile:",
      !!profile,
      "timeoutReached:",
      timeoutReached,
    )

    if (timeoutReached) return // Don't process if timeout was reached

    if (!loading && !redirecting) {
      setRedirecting(true)

      if (user && profile) {
        console.log("Redirecting based on role:", profile.role)
        // Redirect based on role
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
            console.log("Unknown role, redirecting to login")
            router.push("/login")
        }
      } else if (user && !profile) {
        console.log("User found but no profile, redirecting to login")
        router.push("/login")
      } else {
        console.log("No user or profile, redirecting to login")
        router.push("/login")
      }
    }
  }, [user, profile, loading, router, redirecting, timeoutReached])

  if (timeoutReached) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 18.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Timeout</h2>
          <p className="text-gray-600 mb-4">The page took too long to load. Redirecting to login...</p>
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

  if (loading || redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{loading ? "Loading your dashboard..." : "Redirecting..."}</p>
          <p className="text-sm text-gray-400 mt-2">If this takes too long, please refresh the page</p>
        </div>
      </div>
    )
  }

  return null
}
