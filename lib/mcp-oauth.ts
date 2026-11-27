import crypto from "crypto"
import type { NextRequest } from "next/server"
import type { McpAccessLevel } from "@/lib/mcp-server"

export const OAUTH_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, Accept",
}

function getSigningSecret(): string {
  const secret =
    process.env.MCP_OAUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "lrsync-mcp-oauth-fallback-secret"
  return crypto.createHash("sha256").update(`lrsync-oauth:${secret}`).digest("hex")
}

export function getRequestOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host")
  const proto =
    request.headers.get("x-forwarded-proto") ||
    (host && (host.startsWith("localhost") || host.startsWith("127.0.0.1")) ? "http" : "https")
  if (host) return `${proto}://${host}`.replace(/\/$/, "")
  return new URL(request.url).origin.replace(/\/$/, "")
}

function signPayload(prefix: string, payload: Record<string, any>): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  const sig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(`${prefix}.${encoded}`)
    .digest("base64url")
  return `${prefix}_${encoded}.${sig}`
}

function verifyPayload<T = Record<string, any>>(token: string, expectedPrefix: string): T | null {
  try {
    if (!token || !token.startsWith(`${expectedPrefix}_`)) return null
    const rest = token.slice(expectedPrefix.length + 1)
    const dotIdx = rest.lastIndexOf(".")
    if (dotIdx <= 0) return null
    const encoded = rest.slice(0, dotIdx)
    const providedSig = rest.slice(dotIdx + 1)
    const expectedSig = crypto
      .createHmac("sha256", getSigningSecret())
      .update(`${expectedPrefix}.${encoded}`)
      .digest("base64url")

    const a = Buffer.from(providedSig)
    const b = Buffer.from(expectedSig)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"))
    if (typeof parsed?.exp === "number" && Date.now() > parsed.exp) return null
    return parsed as T
  } catch {
    return null
  }
}

export interface OAuthAuthCodePayload {
  userId: string
  email: string
  name: string
  role: string
  accessLevel: McpAccessLevel
  clientId: string
  redirectUri: string
  codeChallenge: string | null
  codeChallengeMethod: string | null
  scope: string
  exp: number
}

export interface OAuthTokenPayload {
  userId: string
  email: string
  name: string
  role: string
  accessLevel: McpAccessLevel
  scope: string
  exp: number
}

export function createAuthorizationCode(payload: Omit<OAuthAuthCodePayload, "exp">): string {
  return signPayload("lrsync_code", {
    ...payload,
    exp: Date.now() + 5 * 60 * 1000, // 5 minutes
  })
}

export function verifyAuthorizationCode(code: string): OAuthAuthCodePayload | null {
  return verifyPayload<OAuthAuthCodePayload>(code, "lrsync_code")
}

export function createOAuthAccessToken(payload: Omit<OAuthTokenPayload, "exp">): string {
  return signPayload("lrsync_oauth", {
    ...payload,
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  })
}

export function verifyOAuthAccessToken(token: string): OAuthTokenPayload | null {
  return verifyPayload<OAuthTokenPayload>(token, "lrsync_oauth")
}

export function createOAuthRefreshToken(payload: Omit<OAuthTokenPayload, "exp">): string {
  return signPayload("lrsync_rt", {
    ...payload,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  })
}

export function verifyOAuthRefreshToken(token: string): OAuthTokenPayload | null {
  return verifyPayload<OAuthTokenPayload>(token, "lrsync_rt")
}

export function verifyPkceChallenge(
  codeVerifier: string | null | undefined,
  codeChallenge: string | null | undefined,
  method: string | null | undefined
): boolean {
  if (!codeChallenge) return true
  if (!codeVerifier) return false
  const m = (method || "S256").toUpperCase()
  if (m === "PLAIN") return codeVerifier === codeChallenge
  if (m === "S256") {
    const digest = crypto.createHash("sha256").update(codeVerifier).digest("base64url")
    return digest === codeChallenge
  }
  return false
}
