import { NextRequest, NextResponse } from "next/server"
import { getRequestOrigin, OAUTH_CORS_HEADERS } from "@/lib/mcp-oauth"

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: OAUTH_CORS_HEADERS })
}

export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request)
  return NextResponse.json(
    {
      resource: `${origin}/api/mcp`,
      authorization_servers: [origin],
      scopes_supported: ["mcp:read", "mcp:admin"],
      bearer_methods_supported: ["header"],
    },
    { status: 200, headers: OAUTH_CORS_HEADERS }
  )
}
