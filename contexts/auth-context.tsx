"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase/client"
import type { UserProfile } from "@/types/auth"

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  const fetchProfile = async (authUserId: string) => {
    try {
      console.log("Fetching profile for auth user:", authUserId)
      const { data, error } = await supabase.from("user_profiles").select("*").eq("auth_user_id", authUserId).single()

      if (error) {
        if (error.code === "PGRST116") {
          console.log("No profile found for auth user:", authUserId)
          return null
        }
        console.error("Error fetching profile:", error)
        return null
      }

      console.log("Profile fetched successfully:", data)
      return data as UserProfile
    } catch (error) {
      console.error("Error fetching profile:", error)
      return null
    }
  }

  const refreshProfile = async () => {
    try {
      console.log("Refreshing profile...")
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (authUser) {
        console.log("Auth user found:", authUser.email)
        setUser(authUser)
        const userProfile = await fetchProfile(authUser.id)
        setProfile(userProfile)
      } else {
        console.log("No auth user found")
        setUser(null)
        setProfile(null)
      }
    } catch (error) {
      console.error("Error refreshing profile:", error)
      setUser(null)
      setProfile(null)
    }
  }

  useEffect(() => {
    let mounted = true
    let timeoutId: NodeJS.Timeout

    // Set a maximum timeout for initialization
    const initTimeout = setTimeout(() => {
      if (mounted && !initialized) {
        console.log("Auth initialization timeout - setting loading to false")
        setLoading(false)
        setInitialized(true)
      }
    }, 5000) // 5 second timeout

    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log("Getting initial session...")

        // Add a timeout to the session request
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Session timeout")), 3000))

        const {
          data: { session },
        } = (await Promise.race([sessionPromise, timeoutPromise])) as any

        if (!mounted) return

        if (session?.user) {
          console.log("Initial session found for:", session.user.email)
          setUser(session.user)

          // Try to fetch profile with timeout
          try {
            const profilePromise = fetchProfile(session.user.id)
            const profileTimeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Profile fetch timeout")), 2000),
            )

            const userProfile = (await Promise.race([profilePromise, profileTimeoutPromise])) as UserProfile | null

            if (mounted) {
              setProfile(userProfile)
            }
          } catch (profileError) {
            console.error("Profile fetch failed:", profileError)
            // Continue without profile - user can still access login
          }
        } else {
          console.log("No initial session found")
          setUser(null)
          setProfile(null)
        }
      } catch (error) {
        console.error("Error getting initial session:", error)
        // Don't block the app if session fetch fails
        if (mounted) {
          setUser(null)
          setProfile(null)
        }
      } finally {
        if (mounted) {
          setLoading(false)
          setInitialized(true)
          clearTimeout(initTimeout)
        }
      }
    }

    getInitialSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event, session?.user?.email)

      if (!mounted) return

      // Clear any existing timeout when auth state changes
      clearTimeout(timeoutId)

      if (session?.user) {
        setUser(session.user)

        // Fetch profile with timeout
        timeoutId = setTimeout(async () => {
          try {
            const userProfile = await fetchProfile(session.user.id)
            if (mounted) {
              setProfile(userProfile)
            }
          } catch (error) {
            console.error("Profile fetch failed in auth change:", error)
          }
        }, 100) // Small delay to batch updates
      } else {
        setUser(null)
        setProfile(null)
      }

      if (mounted && !initialized) {
        setLoading(false)
        setInitialized(true)
      }
    })

    return () => {
      mounted = false
      clearTimeout(initTimeout)
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [initialized])

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      console.log("Attempting sign in for:", email)

      // Sign in with Supabase auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error("Sign in error:", error)
        return { error: error.message }
      }

      console.log("Sign in successful for:", email)

      // Update last login time if profile exists
      if (data.user) {
        const userProfile = await fetchProfile(data.user.id)
        if (userProfile) {
          await supabase
            .from("user_profiles")
            .update({ last_login_at: new Date().toISOString() })
            .eq("auth_user_id", data.user.id)
        }
      }

      return {}
    } catch (error) {
      console.error("Sign in error:", error)
      return { error: "An unexpected error occurred" }
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    console.log("Signing out...")
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setInitialized(false)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
