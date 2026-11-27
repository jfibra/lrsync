import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { OAUTH_CORS_HEADERS } from "@/lib/mcp-oauth"

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: OAUTH_CORS_HEADERS })
}

/**
 * RFC 7591 Dynamic Client Registration for MCP clients (Claude, Cursor, Antigravity, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const clientName = String(body?.client_name || "MCP Client").trim()
    const redirectUris = Array.isArray(body?.redirect_uris)
      ? body.redirect_uris.map((u: any) => String(u)).filter(Boolean)
      : []

    const clientId = `lrsync_client_${crypto.randomBytes(12).toString("hex")}`
    const nowSec = Math.floor(Date.now() / 1000)

    return NextResponse.json(
      {
        client_id: clientId,
        client_id_issued_at: nowSec,
        client_name: clientName,
        redirect_uris: redirectUris,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      },
      { status: 201, headers: OAUTH_CORS_HEADERS }
    )
  } catch (error: any) {
    return NextResponse.json(
      { error: "invalid_client_metadata", error_description: error?.message || "Registration failed" },
      { status: 400, headers: OAUTH_CORS_HEADERS }
    )
  }
}
