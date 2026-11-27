import { NextRequest, NextResponse } from "next/server"
import { getRequestOrigin, OAUTH_CORS_HEADERS } from "@/lib/mcp-oauth"

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: OAUTH_CORS_HEADERS })
}

export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request)
  return NextResponse.json(
    {
      issuer: origin,
      authorization_endpoint: `${origin}/mcp/authorize`,
      token_endpoint: `${origin}/api/mcp/oauth/token`,
      registration_endpoint: `${origin}/api/mcp/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256", "plain"],
      token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
      scopes_supported: ["mcp:read", "mcp:admin"],
      client_id_metadata_document_supported: true,
    },
    { status: 200, headers: OAUTH_CORS_HEADERS }
  )
}
