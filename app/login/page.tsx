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
import { Separator } from "@/components/ui/separator"
import { Eye, EyeOff, LogIn, AlertCircle, CheckCircle, Mail, Info, Shield, Users, Phone } from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import Image from "next/image"
import { logNotification } from "@/utils/logNotification";

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
            // Log notification/audit entry for all roles after successful magic link authentication
            try {
              await logNotification(supabase, {
                action: "magic_link_login",
                description: `Magic link login for user ${data.user.email || "unknown email"} (${data.user.id})`,
                ip_address: null,
                location: null,
                meta: JSON.stringify({
                  user_id: data.user.id,
                  email: data.user.email,
                  role: data.user.user_metadata?.role || "unknown",
                  method: "magic_link",
                }),
                user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
                user_email: profile.email,
                user_name: profile.full_name || profile.first_name || profile.id,
                user_uuid: profile.id,
              })
            } catch (logError) {
              console.error("Error logging notification:", logError)
              // Do not block user on logging failure
            }
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
      // Log notification for failed login attempt
      try {
        await logNotification(supabase, {
          action: "user_login_failed",
          description: `Failed login attempt for email ${email}`,
          ip_address: null,
          location: null,
          meta: JSON.stringify({
            email,
            method: "password",
            error: result.error,
          }),
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
          user_email: email, // Use attempted email
          user_name: "unknown",
          user_uuid: null,
        });
      } catch (logError) {
        console.error("Error logging notification (failed login):", logError)
      }
    } else {
      console.log("Login successful")
      // Log notification for successful login
      try {
        await logNotification(supabase, {
          action: "user_login",
          description: `Successful login for user ${email}`,
          ip_address: null,
          location: null,
          meta: JSON.stringify({
            email,
            method: "password",
          }),
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
          user_email: profile.email,
          user_name: profile.full_name || profile.first_name || profile.id,
          user_uuid: profile.id,
        });
      } catch (logError) {
        console.error("Error logging notification (login success):", logError)
      }
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#ffffff" }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#001f3f] mx-auto mb-4"></div>
          <p className="text-[#001f3f]">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8"
      style={{ backgroundColor: "#ffffff" }}
    >
      <div className="w-full max-w-4xl">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Left side - Information Panel */}
          <div className="hidden lg:block space-y-8">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="relative h-24 w-full">
                  <Image
                    src="/images/bir-logo-navy.png"
                    alt="BIR Logo"
                    width={72}
                    height={72}
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-[#001f3f]">Bureau of Internal Revenue</h1>
                <p className="text-xl text-[#555555]">Leuterio Relief Management System</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-[#f9f9f9] rounded-lg p-6 border border-[#e0e0e0]">
                <div className="flex items-start gap-3">
                  <Shield className="h-6 w-6 text-[#001f3f] mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-lg mb-2 text-[#001f3f]">Access Control</h3>
                    <p className="text-[#555555] text-sm leading-relaxed">
                      User accounts are created exclusively by system administrators. This ensures proper security and
                      access management for all BIR operations.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[#f9f9f9] rounded-lg p-6 border border-[#e0e0e0]">
                <div className="flex items-start gap-3">
                  <Users className="h-6 w-6 text-[#dee242] mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-lg mb-2 text-[#001f3f]">New User Guide</h3>
                    <p className="text-[#555555] text-sm leading-relaxed">
                      If you're a new user, log in using the temporary password provided to you. You can update your
                      password anytime through the "My Profile" section after logging in.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[#fffbe6] rounded-lg p-6 border border-[#dee242]">
                <div className="flex items-start gap-3">
                  <Phone className="h-6 w-6 text-[#ee3433] mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-lg mb-2 text-[#001f3f]">Need Access?</h3>
                    <p className="text-[#555555] text-sm leading-relaxed">
                      For system access requests or account-related inquiries, please contact the Leuterio Realty
                      Accounting Department directly.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Login Form */}
          <div className="w-full">
            <Card className="bg-[#f9f9f9] border border-[#e0e0e0] shadow-2xl">
              <CardHeader className="space-y-4 text-center">
                {/* Mobile logo */}
                <div className="lg:hidden flex justify-center">
                  <div className="relative h-16 w-16 rounded-full bg-[#f9f9f9] p-2 border border-[#e0e0e0]">
                    <Image
                      src="/images/bir-logo-navy.png"
                      alt="BIR Logo"
                      width={48}
                      height={48}
                      className="h-full w-full object-contain"
                    />
                  </div>
                </div>

                <div>
                  <CardTitle className="text-2xl font-bold text-[#001f3f]">
                    {showMagicLinkForm ? "Magic Link Login" : "System Login"}
                  </CardTitle>
                  <CardDescription className="text-[#555555]">
                    {showMagicLinkForm
                      ? "Enter your email to receive a secure login link"
                      : "Access the BIR Management System"}
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {error && (
                  <Alert variant="destructive" className="border-[#ee3433] bg-[#fffbe6]">
                    <AlertCircle className="h-4 w-4 text-[#ee3433]" />
                    <AlertDescription className="text-[#ee3433]">{error}</AlertDescription>
                  </Alert>
                )}

                {success && (
                  <Alert className="border-[#dee242] bg-[#fffbe6]">
                    <CheckCircle className="h-4 w-4 text-[#dee242]" />
                    <AlertDescription className="text-[#001f3f]">{success}</AlertDescription>
                  </Alert>
                )}

                {!showMagicLinkForm ? (
                  // Regular login form
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-[#001f3f] font-medium">
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isLoading}
                        className="h-11 border-[#e0e0e0] bg-white focus:border-[#001f3f] focus:ring-[#001f3f] text-[#555555] placeholder:text-[#001f3f]"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-[#001f3f] font-medium">
                        Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          disabled={isLoading}
                          className="h-11 pr-10 bg-white border-[#e0e0e0] focus:border-[#001f3f] focus:ring-[#001f3f] text-[#555555] placeholder:text-[#001f3f]"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-[#f9f9f9]"
                          onClick={() => setShowPassword(!showPassword)}
                          disabled={isLoading}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-[#001f3f]" />
                          ) : (
                            <Eye className="h-4 w-4 text-[#001f3f]" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-11 text-[#ffffff] font-medium"
                      style={{ backgroundColor: "#001f3f" }}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#ffffff] mr-2"></div>
                          Signing in...
                        </>
                      ) : (
                        <>
                          <LogIn className="h-4 w-4 mr-2" />
                          Sign In
                        </>
                      )}
                    </Button>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <Separator className="w-full border-[#e0e0e0]" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-[#ffffff] px-2 text-[#001f3f]">Or</span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowMagicLinkForm(true)}
                      className="w-full h-11 text-base font-medium border-[#001f3f] text-[#001f3f] bg-[#ffffff] hover:bg-[#f9f9f9]"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Use Magic Link Instead
                    </Button>
                  </form>
                ) : (
                  // Magic link form
                  <div className="space-y-4">
                    <div className="bg-[#fffbe6] border border-[#dee242] rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-[#dee242] mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-medium text-[#001f3f] mb-1">Forgot Your Password?</h4>
                          <p className="text-sm text-[#555555]">
                            No worries! Enter your email address and we'll send you a secure login link. Click the link
                            in your email to access your account instantly - no password required.
                          </p>
                        </div>
                      </div>
                    </div>

                    <form onSubmit={handleSendMagicLink} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="magic_email" className="text-[#001f3f] font-medium">
                          Email Address
                        </Label>
                        <Input
                          id="magic_email"
                          type="email"
                          placeholder="Enter your email"
                          value={magicLinkEmail}
                          onChange={(e) => setMagicLinkEmail(e.target.value)}
                          required
                          disabled={isSendingMagicLink}
                          className="h-11 bg-white border-[#e0e0e0] focus:border-[#001f3f] focus:ring-[#001f3f] text-[#555555] placeholder:text-[#001f3f]"
                        />
                      </div>

                      <Button
                        type="submit"
                        className="w-full h-11 text-base font-medium text-[#ffffff]"
                        style={{ backgroundColor: "#001f3f" }}
                        disabled={isSendingMagicLink}
                      >
                        {isSendingMagicLink ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#ffffff] mr-2"></div>
                            Sending Magic Link...
                          </>
                        ) : (
                          <>
                            <Mail className="h-4 w-4 mr-2" />
                            Send Magic Link
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowMagicLinkForm(false)}
                        className="w-full h-11 text-base font-medium border-[#001f3f] text-[#001f3f] bg-[#ffffff] hover:bg-[#f9f9f9]"
                      >
                        Back to Password Login
                      </Button>
                    </form>
                  </div>
                )}

                {/* Mobile info cards */}
                <div className="lg:hidden space-y-3 pt-4 border-t border-[#e0e0e0]">
                  <div className="text-center">
                    <p className="text-sm text-[#001f3f] font-medium mb-3">Important Information</p>
                  </div>

                  <div className="bg-[#f9f9f9] rounded-lg p-3 border border-[#e0e0e0]">
                    <div className="flex items-start gap-2">
                      <Shield className="h-4 w-4 text-[#001f3f] mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-[#555555]">
                          <strong>Access Control:</strong> Only administrators can create user accounts.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#fffbe6] rounded-lg p-3 border border-[#dee242]">
                    <div className="flex items-start gap-2">
                      <Phone className="h-4 w-4 text-[#ee3433] mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-[#555555]">
                          <strong>Need Access?</strong> Contact Leuterio Realty Accounting Department.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
