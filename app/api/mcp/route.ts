import { NextRequest, NextResponse } from "next/server"
import {
  authenticateMcpToken,
  executeMcpTool,
  getToolsForAccessLevel,
  MCP_PROTOCOL_VERSION,
  MCP_SERVER_INFO,
} from "@/lib/mcp-server"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, mcp-session-id, Accept",
}

function extractToken(request: NextRequest): string | null {
  const auth = request.headers.get("authorization") || ""
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim()
  }
  const apiKey = request.headers.get("x-api-key")
  if (apiKey) return apiKey.trim()
  return null
}

function jsonRpcResult(id: any, result: any) {
  return NextResponse.json(
    { jsonrpc: "2.0", id: id ?? null, result },
    { status: 200, headers: CORS_HEADERS }
  )
}

function jsonRpcError(id: any, code: number, message: string, httpStatus = 200) {
  return NextResponse.json(
    { jsonrpc: "2.0", id: id ?? null, error: { code, message } },
    { status: httpStatus, headers: CORS_HEADERS }
  )
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

/**
 * GET /api/mcp — Discovery & health endpoint for MCP clients
 */
export async function GET(request: NextRequest) {
  const token = extractToken(request)
  const auth = token ? await authenticateMcpToken(token) : null

  return NextResponse.json(
    {
      name: MCP_SERVER_INFO.name,
      version: MCP_SERVER_INFO.version,
      protocol: "Model Context Protocol (JSON-RPC 2.0 over Streamable HTTP)",
      protocolVersion: MCP_PROTOCOL_VERSION,
      endpoint: "/api/mcp",
      authenticated: Boolean(auth),
      accessLevel: auth?.accessLevel || null,
      toolCount: auth ? getToolsForAccessLevel(auth.accessLevel).length : null,
      authHeaders: ["Authorization: Bearer <YOUR_MCP_KEY>", "x-api-key: <YOUR_MCP_KEY>"],
    },
    { status: 200, headers: CORS_HEADERS }
  )
}

/**
 * POST /api/mcp — Standards-compliant Streamable HTTP JSON-RPC 2.0 MCP Server
 */
export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request)
    const auth = await authenticateMcpToken(token)
    if (!auth) {
      return jsonRpcError(
        null,
        -32001,
        "Unauthorized: Provide a valid Read-Only or Admin Full Access MCP key via Authorization: Bearer <key> or x-api-key header.",
        401
      )
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || body.jsonrpc !== "2.0" || !body.method) {
      return jsonRpcError(body?.id, -32600, "Invalid JSON-RPC 2.0 request", 400)
    }

    const { id, method, params } = body

    // Notifications (no id) simply return 202 Accepted
    if (method === "notifications/initialized" || method === "notifications/cancelled") {
      return new NextResponse(null, { status: 202, headers: CORS_HEADERS })
    }

    if (method === "ping") {
      return jsonRpcResult(id, {})
    }

    if (method === "initialize") {
      const requestedVersion =
        typeof params?.protocolVersion === "string" ? params.protocolVersion : MCP_PROTOCOL_VERSION
      return jsonRpcResult(id, {
        protocolVersion: requestedVersion,
        capabilities: {
          tools: { listChanged: false },
          resources: { subscribe: false, listChanged: false },
        },
        serverInfo: {
          ...MCP_SERVER_INFO,
          accessLevel: auth.accessLevel,
        },
        instructions:
          auth.accessLevel === "admin_full"
            ? "Connected to LRSync Accounting with ADMIN FULL ACCESS. All mutations are recorded in the system audit trail."
            : "Connected to LRSync Accounting with READ-ONLY ACCESS. You can query all accounting modules safely without modifying data.",
      })
    }

    if (method === "tools/list") {
      return jsonRpcResult(id, {
        tools: getToolsForAccessLevel(auth.accessLevel),
      })
    }

    if (method === "tools/call") {
      const toolName = String(params?.name || "")
      const toolArgs = params?.arguments && typeof params.arguments === "object" ? params.arguments : {}
      const result = await executeMcpTool(toolName, toolArgs, auth)
      return jsonRpcResult(id, result)
    }

    if (method === "resources/list") {
      return jsonRpcResult(id, {
        resources: [
          {
            uri: "lrsync://schema/overview",
            name: "LRSync Accounting Modules Overview",
            description: "Overview of available tables, modules, and access level for this MCP connection.",
            mimeType: "application/json",
          },
          {
            uri: "lrsync://summary/live",
            name: "Live Dashboard Summary",
            description: "Live record counts across all LRSync accounting modules.",
            mimeType: "application/json",
          },
        ],
      })
    }

    if (method === "resources/read") {
      const uri = String(params?.uri || "")
      if (uri === "lrsync://schema/overview") {
        return jsonRpcResult(id, {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  server: MCP_SERVER_INFO,
                  accessLevel: auth.accessLevel,
                  modules: [
                    "sales",
                    "purchases",
                    "expense_requests",
                    "expense_request_invoices",
                    "commission_report",
                    "commission_vouchers",
                    "commission_releases",
                    "collector_transactions",
                    "taxpayer_listings",
                    "notifications",
                  ],
                  availableTools: getToolsForAccessLevel(auth.accessLevel).map((t) => t.name),
                },
                null,
                2
              ),
            },
          ],
        })
      }

      if (uri === "lrsync://summary/live") {
        const res = await executeMcpTool("get_dashboard_summary", {}, auth)
        return jsonRpcResult(id, {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: res.content[0]?.text || "{}",
            },
          ],
        })
      }

      return jsonRpcError(id, -32002, `Resource not found: ${uri}`)
    }

    return jsonRpcError(id, -32601, `Method not found: ${method}`)
  } catch (error: any) {
    console.error("POST /api/mcp error:", error)
    return jsonRpcError(null, -32603, error?.message || "Internal MCP server error", 500)
  }
}
