"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, LogIn, AlertCircle, CheckCircle, Mail } from "lucide-react"
import { supabase } from "@/lib/supabase/client"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false)
  const [showMagicLinkForm, setShowMagicLinkForm] = useState(false)
  const [magicLinkEmail, setMagicLinkEmail] = useState("")

  const { signIn, user, profile, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Handle magic link authentication on page load
  useEffect(() => {
    const handleMagicLinkAuth = async () => {
      // Check if this is a magic link callback
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get("access_token")
      const refreshToken = hashParams.get("refresh_token")

      if (accessToken && refreshToken) {
        console.log("Magic link authentication detected")
        setIsLoading(true)

        try {
          // Set the session using the tokens from the magic link
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (error) {
            console.error("Magic link auth error:", error)
            setError("Magic link authentication failed: " + error.message)
          } else if (data.user) {
            console.log("Magic link authentication successful")
            setSuccess("Successfully logged in via magic link!")
            // The auth context will handle the redirect
          }
        } catch (error) {
          console.error("Magic link auth error:", error)
          setError("An error occurred during magic link authentication")
        } finally {
          setIsLoading(false)
          // Clean up the URL
          window.history.replaceState({}, document.title, window.location.pathname)
        }
      }
    }

    handleMagicLinkAuth()
  }, [])

  useEffect(() => {
    console.log("LoginPage useEffect - loading:", loading, "user:", !!user, "profile:", !!profile)

    if (!loading && user && profile) {
      console.log("User already logged in, redirecting based on role:", profile.role)
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
          router.push("/dashboard")
      }
    }
  }, [user, profile, loading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    console.log("Attempting login for:", email)

    const result = await signIn(email, password)

    if (result.error) {
      console.error("Login failed:", result.error)
      setError(result.error)
    } else {
      console.log("Login successful")
    }

    setIsLoading(false)
  }

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSendingMagicLink(true)
    setError("")
    setSuccess("")

    try {
      if (!magicLinkEmail.trim()) {
        setError("Please enter your email address")
        return
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: magicLinkEmail.toLowerCase().trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      })

      if (error) {
        setError("Error sending magic link: " + error.message)
        return
      }

      setSuccess(`Magic link sent to ${magicLinkEmail}! Check your email and click the link to login.`)
      setMagicLinkEmail("")
    } catch (error: any) {
      setError("An unexpected error occurred while sending magic link")
    } finally {
      setIsSendingMagicLink(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-blue-600 p-3 rounded-full">
              <LogIn className="h-6 w-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">Leuterio Relief System</CardTitle>
          <CardDescription className="text-center">
            {showMagicLinkForm ? "Get a magic link sent to your email" : "Sign in to your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-4">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {!showMagicLinkForm ? (
            // Regular login form
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>

              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setShowMagicLinkForm(true)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Login with Magic Link instead
                </Button>
              </div>
            </form>
          ) : (
            // Magic link form
            <form onSubmit={handleSendMagicLink} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="magic_email">Email Address</Label>
                <Input
                  id="magic_email"
                  type="email"
                  placeholder="Enter your email"
                  value={magicLinkEmail}
                  onChange={(e) => setMagicLinkEmail(e.target.value)}
                  required
                  disabled={isSendingMagicLink}
                />
                <p className="text-xs text-gray-500">We'll send you a secure link to login without a password.</p>
              </div>

              <Button type="submit" className="w-full" disabled={isSendingMagicLink}>
                {isSendingMagicLink ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Sending Magic Link...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Magic Link
                  </>
                )}
              </Button>

              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setShowMagicLinkForm(false)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Back to password login
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
