"use client"

import React, { Suspense, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import Image from "next/image"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Lock,
  LogOut,
  Plug,
  Shield,
  ShieldAlert,
} from "lucide-react"

function McpAuthorizeContent() {
  const searchParams = useSearchParams()
  const { user, profile, loading: authLoading } = useAuth()

  const clientId = searchParams.get("client_id") || "MCP Client"
  const redirectUri = searchParams.get("redirect_uri") || ""
  const state = searchParams.get("state") || ""
  const codeChallenge = searchParams.get("code_challenge") || ""
  const codeChallengeMethod = searchParams.get("code_challenge_method") || ""

  const clientHost = useMemo(() => {
    try {
      return redirectUri ? new URL(redirectUri).hostname : "External MCP Client"
    } catch {
      return "External MCP Client"
    }
  }, [redirectUri])

  // Inline login state if user is not signed in yet
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState("")

  // Consent state
  const canGrantAdmin = profile?.role === "super_admin" || profile?.role === "admin"
  const [accessLevel, setAccessLevel] = useState<"read_only" | "admin_full">("read_only")
  const [approving, setApproving] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setSigningIn(true)
    setError("")
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInError) throw signInError
    } catch (err: any) {
      setError(err?.message || "Invalid email or password.")
    } finally {
      setSigningIn(false)
    }
  }

  const handleSwitchAccount = async () => {
    await supabase.auth.signOut()
    setEmail("")
    setPassword("")
  }

  const handleApprove = async () => {
    if (!redirectUri) {
      setError("Missing redirect_uri from the MCP client.")
      return
    }
    setApproving(true)
    setError("")
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error("Session expired. Please sign in again.")
      }

      const res = await fetch("/api/mcp/oauth/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          state,
          code_challenge: codeChallenge || null,
          code_challenge_method: codeChallengeMethod || null,
          access_level: canGrantAdmin ? accessLevel : "read_only",
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Authorization failed")

      window.location.href = data.redirectUrl
    } catch (err: any) {
      setError(err?.message || "Failed to authorize connection")
      setApproving(false)
    }
  }

  const handleDeny = () => {
    if (!redirectUri) return
    try {
      const target = new URL(redirectUri)
      target.searchParams.set("error", "access_denied")
      if (state) target.searchParams.set("state", state)
      window.location.href = target.toString()
    } catch {
      window.close()
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white border-slate-200 shadow-xl">
        <CardHeader className="bg-[#001f3f] text-white rounded-t-xl space-y-2">
          <div className="flex items-center justify-between">
            <Image
              src="/images/bir-logo.png"
              alt="LR Accounting"
              width={120}
              height={48}
              className="h-7 w-auto object-contain"
            />
            <Badge className="bg-sky-500/20 text-sky-200 border border-sky-400/30 text-[11px]">
              <Plug className="w-3 h-3 mr-1" />
              MCP OAuth 2.1
            </Badge>
          </div>
          <CardTitle className="text-xl">Connect to LR Accounting</CardTitle>
          <CardDescription className="text-slate-300 text-xs">
            <strong className="text-white">{clientHost}</strong> is requesting access to your LRSync
            account via Model Context Protocol (MCP).
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-5">
          {error && (
            <Alert variant="destructive" className="border-red-300 bg-red-50 text-red-900">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          {!redirectUri && (
            <Alert className="border-amber-300 bg-amber-50 text-amber-900">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs">
                No <code>redirect_uri</code> was provided. Open this page through Claude or your MCP
                client&apos;s Connect flow.
              </AlertDescription>
            </Alert>
          )}

          {authLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Checking your LRSync session...
            </div>
          ) : !user || !profile ? (
            /* Step 1: Login with LRSync Account */
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="text-xs text-slate-600">
                Sign in with your <strong>LR Accounting</strong> email and password to authorize{" "}
                <strong>{clientHost}</strong>.
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#001f3f]">Email</Label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="bg-white border-slate-300"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#001f3f]">Password</Label>
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="bg-white border-slate-300"
                />
              </div>
              <Button
                type="submit"
                disabled={signingIn}
                className="w-full bg-[#001f3f] hover:bg-[#001f3f]/90 text-white font-semibold"
              >
                {signingIn ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4 mr-2" />
                )}
                {signingIn ? "Signing In..." : "Sign In to Continue"}
              </Button>
            </form>
          ) : (
            /* Step 2: Choose Access Level & Approve */
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[#001f3f] truncate">
                    {profile.full_name || user.email}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{profile.email || user.email}</div>
                  <Badge className="mt-1.5 bg-sky-100 text-sky-800 border border-sky-200 hover:bg-sky-100 text-[10px] uppercase">
                    {profile.role?.replace(/_/g, " ")}
                  </Badge>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleSwitchAccount}
                  className="text-xs text-slate-500 hover:text-slate-900 shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1" />
                  Switch
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Select Permission Level for {clientHost}
                </Label>

                <button
                  type="button"
                  onClick={() => setAccessLevel("read_only")}
                  className={`w-full text-left rounded-xl border-2 p-3 transition-all ${
                    accessLevel === "read_only"
                      ? "border-sky-600 bg-sky-50/70"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#001f3f] flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-sky-600" />
                      Read-Only Access
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-white">
                      10 tools
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Query Sales, Purchases, Expenses, Commissions, Vouchers, Releases, Cheque
                    Verification, TIN Library, and Audit Logs. Cannot edit or delete records.
                  </p>
                </button>

                {canGrantAdmin && (
                  <button
                    type="button"
                    onClick={() => setAccessLevel("admin_full")}
                    className={`w-full text-left rounded-xl border-2 p-3 transition-all ${
                      accessLevel === "admin_full"
                        ? "border-amber-500 bg-amber-50/70"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-[#001f3f] flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-amber-600" />
                        Admin Full Access
                      </span>
                      <Badge variant="outline" className="text-[10px] bg-white border-amber-300 text-amber-800">
                        16 tools
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Includes Read-Only plus creating, updating, and soft-deleting records. Every
                      change is logged under your name in Activity Tracker.
                    </p>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDeny}
                  disabled={approving}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleApprove}
                  disabled={approving || !redirectUri}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  {approving ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  )}
                  {approving ? "Connecting..." : "Authorize & Connect"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function McpAuthorizePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-100 flex items-center justify-center text-sm text-slate-500">
          Loading authorization...
        </div>
      }
    >
      <McpAuthorizeContent />
    </Suspense>
  )
}
