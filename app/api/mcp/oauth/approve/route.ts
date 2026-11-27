import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedRequestUser, getSupabaseAdmin } from "@/lib/smtp-mailer"
import { createAuthorizationCode } from "@/lib/mcp-oauth"
import type { McpAccessLevel } from "@/lib/mcp-server"

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedRequestUser(request)
    if (!user) {
      return NextResponse.json({ error: "Please sign in to your LRSync account first." }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const clientId = String(body?.client_id || "mcp-client").trim()
    const redirectUri = String(body?.redirect_uri || "").trim()
    const state = String(body?.state || "").trim()
    const codeChallenge = body?.code_challenge ? String(body.code_challenge).trim() : null
    const codeChallengeMethod = body?.code_challenge_method
      ? String(body.code_challenge_method).trim()
      : null
    const requestedAccess: McpAccessLevel =
      body?.access_level === "admin_full" ? "admin_full" : "read_only"

    if (!redirectUri) {
      return NextResponse.json({ error: "Missing redirect_uri parameter." }, { status: 400 })
    }

    let parsedRedirect: URL
    try {
      parsedRedirect = new URL(redirectUri)
      if (parsedRedirect.protocol !== "https:" && parsedRedirect.protocol !== "http:") {
        throw new Error("Invalid protocol")
      }
    } catch {
      return NextResponse.json({ error: "Invalid redirect_uri." }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id, auth_user_id, full_name, email, role, status")
      .or(`auth_user_id.eq.${user.id},id.eq.${user.id}`)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: "User profile not found." }, { status: 403 })
    }
    if (profile.status && profile.status !== "active") {
      return NextResponse.json({ error: "Your account is not active." }, { status: 403 })
    }

    // Only super_admin and admin roles are allowed to grant Admin Full Access
    const canGrantAdmin = profile.role === "super_admin" || profile.role === "admin"
    const effectiveAccess: McpAccessLevel =
      requestedAccess === "admin_full" && canGrantAdmin ? "admin_full" : "read_only"

    const scope = effectiveAccess === "admin_full" ? "mcp:read mcp:admin" : "mcp:read"

    const code = createAuthorizationCode({
      userId: user.id,
      email: profile.email || user.email || "",
      name: profile.full_name || profile.email || user.email || "LRSync User",
      role: profile.role || "secretary",
      accessLevel: effectiveAccess,
      clientId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      scope,
    })

    parsedRedirect.searchParams.set("code", code)
    if (state) parsedRedirect.searchParams.set("state", state)

    await supabase.from("notifications").insert([
      {
        action: "mcp_oauth_authorized",
        description: `${profile.full_name || user.email} authorized MCP OAuth connection (${effectiveAccess === "admin_full" ? "Admin Full Access" : "Read-Only"}) for ${parsedRedirect.hostname}`,
        user_uuid: user.id,
        user_name: profile.full_name || user.email || "User",
        user_email: profile.email || user.email || "",
        meta: {
          client_id: clientId,
          redirect_host: parsedRedirect.hostname,
          access_level: effectiveAccess,
          role: profile.role,
        },
      },
    ])

    return NextResponse.json({
      success: true,
      redirectUrl: parsedRedirect.toString(),
      accessLevel: effectiveAccess,
    })
  } catch (error: any) {
    console.error("POST /api/mcp/oauth/approve error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to approve OAuth authorization" },
      { status: 500 }
    )
  }
}
