import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/smtp-mailer"
import {
  createOAuthAccessToken,
  createOAuthRefreshToken,
  OAUTH_CORS_HEADERS,
  verifyAuthorizationCode,
  verifyOAuthRefreshToken,
  verifyPkceChallenge,
} from "@/lib/mcp-oauth"

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: OAUTH_CORS_HEADERS })
}

async function parseTokenBody(request: NextRequest): Promise<Record<string, string>> {
  const ct = (request.headers.get("content-type") || "").toLowerCase()
  if (ct.includes("application/json")) {
    const json = await request.json().catch(() => ({}))
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(json || {})) {
      if (v !== undefined && v !== null) out[k] = String(v)
    }
    return out
  }
  const text = await request.text().catch(() => "")
  const params = new URLSearchParams(text)
  const out: Record<string, string> = {}
  params.forEach((v, k) => {
    out[k] = v
  })
  return out
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseTokenBody(request)
    const grantType = body.grant_type || ""

    if (grantType === "authorization_code") {
      const code = body.code || ""
      const redirectUri = body.redirect_uri || ""
      const codeVerifier = body.code_verifier || ""

      const payload = verifyAuthorizationCode(code)
      if (!payload) {
        return NextResponse.json(
          { error: "invalid_grant", error_description: "Authorization code is invalid or expired." },
          { status: 400, headers: OAUTH_CORS_HEADERS }
        )
      }

      if (redirectUri && payload.redirectUri && redirectUri !== payload.redirectUri) {
        return NextResponse.json(
          { error: "invalid_grant", error_description: "redirect_uri mismatch." },
          { status: 400, headers: OAUTH_CORS_HEADERS }
        )
      }

      if (!verifyPkceChallenge(codeVerifier, payload.codeChallenge, payload.codeChallengeMethod)) {
        return NextResponse.json(
          { error: "invalid_grant", error_description: "PKCE code_verifier verification failed." },
          { status: 400, headers: OAUTH_CORS_HEADERS }
        )
      }

      const tokenPayload = {
        userId: payload.userId,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        accessLevel: payload.accessLevel,
        scope: payload.scope,
      }

      const accessToken = createOAuthAccessToken(tokenPayload)
      const refreshToken = createOAuthRefreshToken(tokenPayload)

      return NextResponse.json(
        {
          access_token: accessToken,
          token_type: "Bearer",
          expires_in: 86400,
          refresh_token: refreshToken,
          scope: payload.scope,
        },
        { status: 200, headers: OAUTH_CORS_HEADERS }
      )
    }

    if (grantType === "refresh_token") {
      const refreshToken = body.refresh_token || ""
      const payload = verifyOAuthRefreshToken(refreshToken)
      if (!payload) {
        return NextResponse.json(
          { error: "invalid_grant", error_description: "Refresh token is invalid or expired." },
          { status: 400, headers: OAUTH_CORS_HEADERS }
        )
      }

      // Re-verify user is still active in user_profiles
      const supabase = getSupabaseAdmin()
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role, status, full_name, email")
        .or(`auth_user_id.eq.${payload.userId},id.eq.${payload.userId}`)
        .maybeSingle()

      if (!profile || (profile.status && profile.status !== "active")) {
        return NextResponse.json(
          { error: "invalid_grant", error_description: "User account is no longer active." },
          { status: 400, headers: OAUTH_CORS_HEADERS }
        )
      }

      const canGrantAdmin = profile.role === "super_admin" || profile.role === "admin"
      const effectiveAccess =
        payload.accessLevel === "admin_full" && canGrantAdmin ? "admin_full" : "read_only"

      const nextPayload = {
        userId: payload.userId,
        email: profile.email || payload.email,
        name: profile.full_name || payload.name,
        role: profile.role || payload.role,
        accessLevel: effectiveAccess as "read_only" | "admin_full",
        scope: effectiveAccess === "admin_full" ? "mcp:read mcp:admin" : "mcp:read",
      }

      return NextResponse.json(
        {
          access_token: createOAuthAccessToken(nextPayload),
          token_type: "Bearer",
          expires_in: 86400,
          refresh_token: createOAuthRefreshToken(nextPayload),
          scope: nextPayload.scope,
        },
        { status: 200, headers: OAUTH_CORS_HEADERS }
      )
    }

    return NextResponse.json(
      { error: "unsupported_grant_type", error_description: `Unsupported grant_type: ${grantType}` },
      { status: 400, headers: OAUTH_CORS_HEADERS }
    )
  } catch (error: any) {
    console.error("POST /api/mcp/oauth/token error:", error)
    return NextResponse.json(
      { error: "server_error", error_description: error?.message || "Token exchange failed" },
      { status: 500, headers: OAUTH_CORS_HEADERS }
    )
  }
}
