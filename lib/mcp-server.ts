import crypto from "crypto"
import { getSupabaseAdmin } from "@/lib/smtp-mailer"

export type McpAccessLevel = "read_only" | "admin_full"

export interface McpAuthContext {
  keyId: string | null
  keyName: string
  accessLevel: McpAccessLevel
  source: "database" | "env"
}

export interface McpToolDefinition {
  name: string
  description: string
  accessLevel: McpAccessLevel
  inputSchema: Record<string, any>
}

export const MCP_PROTOCOL_VERSION = "2024-11-05"
export const MCP_SERVER_INFO = {
  name: "lrsync-accounting-mcp",
  version: "1.0.0",
}

export function hashMcpKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey.trim()).digest("hex")
}

export function generateMcpKey(accessLevel: McpAccessLevel): {
  rawKey: string
  keyPrefix: string
  keyHash: string
} {
  const prefix = accessLevel === "admin_full" ? "lrsync_ad_" : "lrsync_ro_"
  const randomPart = crypto.randomBytes(24).toString("base64url")
  const rawKey = `${prefix}${randomPart}`
  return {
    rawKey,
    keyPrefix: rawKey.slice(0, 16),
    keyHash: hashMcpKey(rawKey),
  }
}

/**
 * Authenticates an MCP Bearer / x-api-key token against `public.mcp_api_keys`
 * (or optional MCP_READONLY_API_KEY / MCP_ADMIN_API_KEY env fallback keys).
 */
export async function authenticateMcpToken(rawToken: string | null): Promise<McpAuthContext | null> {
  const token = (rawToken || "").trim()
  if (!token) return null

  // 1. Optional env-var fallback keys for instant zero-DB setup
  const envAdmin = (process.env.MCP_ADMIN_API_KEY || "").trim()
  if (envAdmin && token === envAdmin) {
    return {
      keyId: null,
      keyName: "ENV Admin Key",
      accessLevel: "admin_full",
      source: "env",
    }
  }
  const envReadOnly = (process.env.MCP_READONLY_API_KEY || "").trim()
  if (envReadOnly && token === envReadOnly) {
    return {
      keyId: null,
      keyName: "ENV Read-Only Key",
      accessLevel: "read_only",
      source: "env",
    }
  }

  // 2. Database-managed keys (SHA-256 hashed)
  try {
    const supabase = getSupabaseAdmin()
    const keyHash = hashMcpKey(token)
    const { data, error } = await supabase
      .from("mcp_api_keys")
      .select("id, name, access_level, is_active, expires_at, request_count")
      .eq("key_hash", keyHash)
      .maybeSingle()

    if (error || !data || !data.is_active) return null
    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
      return null
    }

    // Fire-and-forget usage update
    supabase
      .from("mcp_api_keys")
      .update({
        last_used_at: new Date().toISOString(),
        request_count: (Number(data.request_count) || 0) + 1,
      })
      .eq("id", data.id)
      .then(() => {})

    return {
      keyId: data.id,
      keyName: data.name,
      accessLevel: data.access_level === "admin_full" ? "admin_full" : "read_only",
      source: "database",
    }
  } catch (err) {
    console.error("MCP token authentication error:", err)
    return null
  }
}

const ALLOWED_MUTATION_TABLES = [
  "sales",
  "purchases",
  "taxpayer_listings",
  "expense_requests",
  "collector_transactions",
  "commission_vouchers",
  "purchases_categories",
] as const

export const MCP_TOOLS: McpToolDefinition[] = [
  // ================= READ-ONLY TOOLS =================
  {
    name: "get_dashboard_summary",
    description:
      "Get live high-level record counts across Sales, Purchases, Expense Requests, Expense Vouchers, Commission Reports, Commission Vouchers, Releases, Cheque Verification, and TIN Library.",
    accessLevel: "read_only",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "list_sales",
    description: "Search and list Sales records (BIR ledger) with optional search, tax_type, area, and limit.",
    accessLevel: "read_only",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Search taxpayer name, TIN, invoice number, or remarks" },
        tax_type: { type: "string", enum: ["vat", "non-vat"] },
        area: { type: "string", description: "Filter by assigned area (e.g. Cebu, Davao)" },
        limit: { type: "number", description: "Max rows to return (1-100, default 25)" },
      },
    },
  },
  {
    name: "list_purchases",
    description: "Search and list Purchases records with optional search, tax_type, and limit.",
    accessLevel: "read_only",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Search vendor name, TIN, invoice number, or remarks" },
        tax_type: { type: "string", enum: ["vat", "non-vat"] },
        limit: { type: "number", description: "Max rows to return (1-100, default 25)" },
      },
    },
  },
  {
    name: "list_expense_requests",
    description: "List itemized Expense Requests and/or Expense Vouchers with optional status or search filter.",
    accessLevel: "read_only",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["vouchers", "items"], description: "Default: vouchers" },
        status: { type: "string", description: "Filter by status (pending_approval, approved, converted, rejected, pending)" },
        search: { type: "string" },
        limit: { type: "number", description: "Max rows (1-100, default 25)" },
      },
    },
  },
  {
    name: "list_commission_reports",
    description: "List Commission Reports with optional status, report_number, and limit.",
    accessLevel: "read_only",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "e.g. new, ongoing_verification, for_approval, approved, cancelled" },
        report_number: { type: "string", description: "Partial or exact report number" },
        limit: { type: "number", description: "Max rows (1-100, default 25)" },
      },
    },
  },
  {
    name: "list_commission_vouchers",
    description: "Search and list Commission Vouchers by voucher number, agent, developer, client, or slip type.",
    accessLevel: "read_only",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string" },
        slip_type: { type: "string" },
        limit: { type: "number", description: "Max rows (1-100, default 25)" },
      },
    },
  },
  {
    name: "list_commission_releases",
    description: "List grouped Commission Releases with totals, voucher numbers, and POT counts.",
    accessLevel: "read_only",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Search release title or remarks" },
        limit: { type: "number", description: "Max rows (1-100, default 25)" },
      },
    },
  },
  {
    name: "list_cheque_verification",
    description: "List Collector Daily Batches & Cheque Verification records (including Voucher No., Cheque #, Deposit Ref, and workflow status).",
    accessLevel: "read_only",
    inputSchema: {
      type: "object",
      properties: {
        workflow_status: {
          type: "string",
          enum: ["invoice_issued", "cheque_collected", "deposited", "verified", "returned", "converted_to_sale"],
        },
        search: { type: "string", description: "Search developer, voucher #, cheque #, or deposit ref" },
        limit: { type: "number", description: "Max rows (1-100, default 25)" },
      },
    },
  },
  {
    name: "search_tin_library",
    description: "Search the TIN Library (taxpayer_listings) by TIN, registered name, or type (sales/purchases).",
    accessLevel: "read_only",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string" },
        type: { type: "string", enum: ["sales", "purchases"] },
        limit: { type: "number", description: "Max rows (1-100, default 25)" },
      },
    },
  },
  {
    name: "list_notifications",
    description: "View recent accounting & system audit notifications.",
    accessLevel: "read_only",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "Optional filter by action name" },
        limit: { type: "number", description: "Max rows (1-100, default 25)" },
      },
    },
  },

  // ================= ADMIN FULL ACCESS TOOLS =================
  {
    name: "list_users",
    description: "[Admin Full Access] List user accounts, roles, areas, and statuses.",
    accessLevel: "admin_full",
    inputSchema: {
      type: "object",
      properties: {
        role: { type: "string", enum: ["super_admin", "admin", "secretary", "collector"] },
        search: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "update_cheque_verification",
    description:
      "[Admin Full Access] Update Voucher No., Cheque Status, Workflow Status, or Accounting Remarks on a Cheque Verification record.",
    accessLevel: "admin_full",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "UUID of collector_transactions record" },
        voucher_number: { type: "string" },
        cheque_status: { type: "string", enum: ["pending", "deposited", "verified"] },
        workflow_status: {
          type: "string",
          enum: ["invoice_issued", "cheque_collected", "deposited", "verified", "returned"],
        },
        accounting_remarks: { type: "string" },
      },
    },
  },
  {
    name: "update_commission_report_status",
    description:
      "[Admin Full Access] Update status and append a history remark on a Commission Report.",
    accessLevel: "admin_full",
    inputSchema: {
      type: "object",
      required: ["uuid", "status"],
      properties: {
        uuid: { type: "string", description: "UUID of commission_report" },
        status: {
          type: "string",
          enum: ["new", "ongoing_verification", "for_approval", "approved", "cancelled", "for_testing"],
        },
        remarks: { type: "string" },
      },
    },
  },
  {
    name: "create_record",
    description: `[Admin Full Access] Insert a new record into an allowed table (${ALLOWED_MUTATION_TABLES.join(", ")}).`,
    accessLevel: "admin_full",
    inputSchema: {
      type: "object",
      required: ["table", "data"],
      properties: {
        table: { type: "string", enum: [...ALLOWED_MUTATION_TABLES] },
        data: { type: "object", description: "Key-value pairs for the new row" },
      },
    },
  },
  {
    name: "update_record",
    description: `[Admin Full Access] Update fields on a single record by ID in an allowed table (${ALLOWED_MUTATION_TABLES.join(", ")}).`,
    accessLevel: "admin_full",
    inputSchema: {
      type: "object",
      required: ["table", "id", "patch"],
      properties: {
        table: { type: "string", enum: [...ALLOWED_MUTATION_TABLES] },
        id: { type: "string", description: "Record ID (UUID)" },
        patch: { type: "object", description: "Fields to update" },
      },
    },
  },
  {
    name: "soft_delete_record",
    description: `[Admin Full Access] Soft-delete a single record by ID (sets is_deleted=true) in an allowed table.`,
    accessLevel: "admin_full",
    inputSchema: {
      type: "object",
      required: ["table", "id"],
      properties: {
        table: {
          type: "string",
          enum: ["sales", "purchases", "expense_requests", "collector_transactions", "commission_vouchers"],
        },
        id: { type: "string" },
      },
    },
  },
]

export function getToolsForAccessLevel(accessLevel: McpAccessLevel) {
  return MCP_TOOLS.filter(
    (t) => accessLevel === "admin_full" || t.accessLevel === "read_only"
  ).map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  }))
}

function clampLimit(val: unknown, fallback = 25): number {
  const n = Number(val)
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(100, Math.floor(n))
}

async function logMcpAudit(auth: McpAuthContext, toolName: string, description: string, meta: Record<string, any>) {
  try {
    const supabase = getSupabaseAdmin()
    await supabase.from("notifications").insert([
      {
        action: `mcp_${toolName}`,
        description: `[MCP: ${auth.keyName}] ${description}`,
        user_name: `MCP (${auth.keyName})`,
        user_email: auth.accessLevel,
        meta: { ...meta, mcp_key_id: auth.keyId, mcp_access_level: auth.accessLevel },
      },
    ])
  } catch (err) {
    console.warn("MCP audit log warning:", err)
  }
}

export async function executeMcpTool(
  toolName: string,
  args: Record<string, any>,
  auth: McpAuthContext
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  const toolDef = MCP_TOOLS.find((t) => t.name === toolName)
  if (!toolDef) {
    return {
      isError: true,
      content: [{ type: "text", text: `Unknown MCP tool: ${toolName}` }],
    }
  }

  if (toolDef.accessLevel === "admin_full" && auth.accessLevel !== "admin_full") {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Forbidden: Tool "${toolName}" requires an Admin Full Access MCP key. Your current key has Read-Only access.`,
        },
      ],
    }
  }

  const supabase = getSupabaseAdmin()

  try {
    switch (toolName) {
      case "get_dashboard_summary": {
        const [
          sales,
          purchases,
          expReqs,
          expVouchers,
          commReports,
          commVouchers,
          commReleases,
          cheques,
          tins,
        ] = await Promise.all([
          supabase.from("sales").select("id", { count: "exact", head: true }).eq("is_deleted", false),
          supabase.from("purchases").select("id", { count: "exact", head: true }).eq("is_deleted", false),
          supabase.from("expense_requests").select("id", { count: "exact", head: true }).eq("is_deleted", false),
          supabase.from("expense_request_invoices").select("id", { count: "exact", head: true }).eq("is_deleted", false),
          supabase.from("commission_report").select("uuid", { count: "exact", head: true }).is("deleted_at", null),
          supabase.from("commission_vouchers").select("id", { count: "exact", head: true }).eq("is_deleted", false),
          supabase.from("commission_releases").select("id", { count: "exact", head: true }),
          supabase.from("collector_transactions").select("id", { count: "exact", head: true }).eq("is_deleted", false),
          supabase.from("taxpayer_listings").select("id", { count: "exact", head: true }),
        ])

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  access_level: auth.accessLevel,
                  counts: {
                    sales: sales.count ?? 0,
                    purchases: purchases.count ?? 0,
                    expense_requests: expReqs.count ?? 0,
                    expense_vouchers: expVouchers.count ?? 0,
                    commission_reports: commReports.count ?? 0,
                    commission_vouchers: commVouchers.count ?? 0,
                    commission_releases: commReleases.count ?? 0,
                    cheque_verification_batches: cheques.count ?? 0,
                    tin_library: tins.count ?? 0,
                  },
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case "list_sales": {
        const limit = clampLimit(args.limit)
        let q = supabase
          .from("sales")
          .select("id, tax_month, tin, name, tax_type, invoice_number, gross_taxable, total_actual_amount, pickup_date, remarks, created_at")
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(limit)

        if (args.tax_type) q = q.eq("tax_type", args.tax_type)
        if (args.search) {
          const s = String(args.search).replace(/,/g, "").trim()
          q = q.or(`name.ilike.%${s}%,tin.ilike.%${s}%,invoice_number.ilike.%${s}%,remarks.ilike.%${s}%`)
        }
        const { data, error } = await q
        if (error) throw error
        return { content: [{ type: "text", text: JSON.stringify({ count: data?.length || 0, sales: data || [] }, null, 2) }] }
      }

      case "list_purchases": {
        const limit = clampLimit(args.limit)
        let q = supabase
          .from("purchases")
          .select("id, tax_month, tin, name, tax_type, invoice_number, gross_taxable, total_actual_amount, remarks, created_at")
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(limit)

        if (args.tax_type) q = q.eq("tax_type", args.tax_type)
        if (args.search) {
          const s = String(args.search).replace(/,/g, "").trim()
          q = q.or(`name.ilike.%${s}%,tin.ilike.%${s}%,invoice_number.ilike.%${s}%,remarks.ilike.%${s}%`)
        }
        const { data, error } = await q
        if (error) throw error
        return { content: [{ type: "text", text: JSON.stringify({ count: data?.length || 0, purchases: data || [] }, null, 2) }] }
      }

      case "list_expense_requests": {
        const limit = clampLimit(args.limit)
        if (args.type === "items") {
          let q = supabase
            .from("expense_requests")
            .select("id, item_name, name, tin, tax_month, tax_type, total_actual_amount, status, user_full_name, user_assigned_area, created_at")
            .eq("is_deleted", false)
            .order("created_at", { ascending: false })
            .limit(limit)
          if (args.status) q = q.eq("status", args.status)
          if (args.search) {
            const s = String(args.search).replace(/,/g, "").trim()
            q = q.or(`item_name.ilike.%${s}%,name.ilike.%${s}%,user_full_name.ilike.%${s}%`)
          }
          const { data, error } = await q
          if (error) throw error
          return { content: [{ type: "text", text: JSON.stringify({ count: data?.length || 0, items: data || [] }, null, 2) }] }
        }

        let q = supabase
          .from("expense_request_invoices")
          .select("id, invoice_number, invoice_date, payee_name, purpose, total, status, requested_by_name, assigned_area, signed_at, signed_via, created_at")
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(limit)
        if (args.status) q = q.eq("status", args.status)
        if (args.search) {
          const s = String(args.search).replace(/,/g, "").trim()
          q = q.or(`invoice_number.ilike.%${s}%,payee_name.ilike.%${s}%,purpose.ilike.%${s}%,requested_by_name.ilike.%${s}%`)
        }
        const { data, error } = await q
        if (error) throw error
        return { content: [{ type: "text", text: JSON.stringify({ count: data?.length || 0, vouchers: data || [] }, null, 2) }] }
      }

      case "list_commission_reports": {
        const limit = clampLimit(args.limit)
        let q = supabase
          .from("commission_report")
          .select("uuid, report_number, status, remarks, sales_uuids, created_at, updated_at")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(limit)
        if (args.status) q = q.eq("status", args.status)
        if (args.report_number) q = q.ilike("report_number", `%${String(args.report_number).trim()}%`)
        const { data, error } = await q
        if (error) throw error
        return { content: [{ type: "text", text: JSON.stringify({ count: data?.length || 0, reports: data || [] }, null, 2) }] }
      }

      case "list_commission_vouchers": {
        const limit = clampLimit(args.limit)
        let q = supabase
          .from("commission_vouchers")
          .select("id, voucher_number, slip_type, developer_name, agent_name, client_name, project_name, unit_number, amount_released, total_amount, assigned_area, created_at")
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(limit)
        if (args.slip_type) q = q.eq("slip_type", args.slip_type)
        if (args.search) {
          const s = String(args.search).replace(/,/g, "").trim()
          q = q.or(`voucher_number.ilike.%${s}%,agent_name.ilike.%${s}%,developer_name.ilike.%${s}%,client_name.ilike.%${s}%`)
        }
        const { data, error } = await q
        if (error) throw error
        return { content: [{ type: "text", text: JSON.stringify({ count: data?.length || 0, vouchers: data || [] }, null, 2) }] }
      }

      case "list_commission_releases": {
        const limit = clampLimit(args.limit)
        let q = supabase
          .from("commission_releases")
          .select("id, title, remarks, voucher_numbers, total_gross_comm, total_net_comm, assigned_area, created_by_name, created_at")
          .order("created_at", { ascending: false })
          .limit(limit)
        if (args.search) {
          const s = String(args.search).replace(/,/g, "").trim()
          q = q.or(`title.ilike.%${s}%,remarks.ilike.%${s}%`)
        }
        const { data, error } = await q
        if (error) throw error
        return { content: [{ type: "text", text: JSON.stringify({ count: data?.length || 0, releases: data || [] }, null, 2) }] }
      }

      case "list_cheque_verification": {
        const limit = clampLimit(args.limit)
        let q = supabase
          .from("collector_transactions")
          .select("id, workflow_status, cheque_status, voucher_number, developer_name, developer_tin, invoice_date, commission_amount, cheque_number, cheque_bank, cheque_amount, deposit_bank, deposit_reference_no, deposit_amount, assigned_area, accounting_remarks, updated_at")
          .eq("is_deleted", false)
          .order("updated_at", { ascending: false })
          .limit(limit)
        if (args.workflow_status) q = q.eq("workflow_status", args.workflow_status)
        if (args.search) {
          const s = String(args.search).replace(/,/g, "").trim()
          q = q.or(`developer_name.ilike.%${s}%,voucher_number.ilike.%${s}%,cheque_number.ilike.%${s}%,deposit_reference_no.ilike.%${s}%`)
        }
        const { data, error } = await q
        if (error) throw error
        return { content: [{ type: "text", text: JSON.stringify({ count: data?.length || 0, records: data || [] }, null, 2) }] }
      }

      case "search_tin_library": {
        const limit = clampLimit(args.limit)
        let q = supabase
          .from("taxpayer_listings")
          .select("id, tin, registered_name, type, substreet_street_brgy, district_city_zip")
          .order("registered_name", { ascending: true })
          .limit(limit)
        if (args.type) q = q.eq("type", args.type)
        if (args.search) {
          const s = String(args.search).replace(/,/g, "").trim()
          q = q.or(`registered_name.ilike.%${s}%,tin.ilike.%${s}%`)
        }
        const { data, error } = await q
        if (error) throw error
        return { content: [{ type: "text", text: JSON.stringify({ count: data?.length || 0, taxpayers: data || [] }, null, 2) }] }
      }

      case "list_notifications": {
        const limit = clampLimit(args.limit)
        let q = supabase
          .from("notifications")
          .select("id, action, description, user_name, user_email, created_at")
          .order("id", { ascending: false })
          .limit(limit)
        if (args.action) q = q.eq("action", args.action)
        const { data, error } = await q
        if (error) throw error
        return { content: [{ type: "text", text: JSON.stringify({ count: data?.length || 0, notifications: data || [] }, null, 2) }] }
      }

      // ================= ADMIN WRITE TOOLS =================
      case "list_users": {
        const limit = clampLimit(args.limit, 50)
        let q = supabase
          .from("user_profiles")
          .select("id, auth_user_id, full_name, email, role, status, assigned_area, created_at")
          .order("full_name", { ascending: true })
          .limit(limit)
        if (args.role) q = q.eq("role", args.role)
        if (args.search) {
          const s = String(args.search).replace(/,/g, "").trim()
          q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%`)
        }
        const { data, error } = await q
        if (error) throw error
        return { content: [{ type: "text", text: JSON.stringify({ count: data?.length || 0, users: data || [] }, null, 2) }] }
      }

      case "update_cheque_verification": {
        const id = String(args.id || "").trim()
        if (!id) throw new Error("id is required")
        const patch: Record<string, any> = { updated_at: new Date().toISOString() }
        if (args.voucher_number !== undefined) patch.voucher_number = String(args.voucher_number).trim() || null
        if (args.cheque_status) patch.cheque_status = args.cheque_status
        if (args.workflow_status) patch.workflow_status = args.workflow_status
        if (args.accounting_remarks !== undefined) patch.accounting_remarks = String(args.accounting_remarks).trim() || null

        const { data, error } = await supabase
          .from("collector_transactions")
          .update(patch)
          .eq("id", id)
          .select("id, developer_name, voucher_number, cheque_number, cheque_status, workflow_status, accounting_remarks")
          .single()
        if (error) throw error

        await logMcpAudit(auth, toolName, `Updated cheque verification record ${id}`, { id, patch })
        return { content: [{ type: "text", text: JSON.stringify({ updated: data }, null, 2) }] }
      }

      case "update_commission_report_status": {
        const uuid = String(args.uuid || "").trim()
        const status = String(args.status || "").trim()
        if (!uuid || !status) throw new Error("uuid and status are required")

        const { data: existing } = await supabase
          .from("commission_report")
          .select("history, report_number")
          .eq("uuid", uuid)
          .single()

        const nextHistory = [
          ...(Array.isArray(existing?.history) ? existing.history : []),
          {
            action: "status_updated",
            status,
            remarks: String(args.remarks || "").trim(),
            user_id: auth.keyId || "mcp",
            user_name: `MCP (${auth.keyName})`,
            timestamp: new Date().toISOString(),
          },
        ]

        const { data, error } = await supabase
          .from("commission_report")
          .update({
            status,
            history: nextHistory,
            updated_at: new Date().toISOString(),
          })
          .eq("uuid", uuid)
          .select("uuid, report_number, status, updated_at")
          .single()
        if (error) throw error

        await logMcpAudit(auth, toolName, `Updated Commission Report #${existing?.report_number || uuid} to ${status}`, { uuid, status })
        return { content: [{ type: "text", text: JSON.stringify({ updated: data }, null, 2) }] }
      }

      case "create_record": {
        const table = String(args.table || "")
        if (!(ALLOWED_MUTATION_TABLES as readonly string[]).includes(table)) {
          throw new Error(`Table "${table}" is not allowed for MCP create_record.`)
        }
        const { data, error } = await supabase.from(table).insert([args.data]).select("*").single()
        if (error) throw error
        await logMcpAudit(auth, toolName, `Created record in ${table}`, { table, id: (data as any)?.id })
        return { content: [{ type: "text", text: JSON.stringify({ created: data }, null, 2) }] }
      }

      case "update_record": {
        const table = String(args.table || "")
        const id = String(args.id || "").trim()
        if (!(ALLOWED_MUTATION_TABLES as readonly string[]).includes(table)) {
          throw new Error(`Table "${table}" is not allowed for MCP update_record.`)
        }
        if (!id) throw new Error("id is required")
        const { data, error } = await supabase.from(table).update(args.patch).eq("id", id).select("*").single()
        if (error) throw error
        await logMcpAudit(auth, toolName, `Updated record ${id} in ${table}`, { table, id })
        return { content: [{ type: "text", text: JSON.stringify({ updated: data }, null, 2) }] }
      }

      case "soft_delete_record": {
        const table = String(args.table || "")
        const id = String(args.id || "").trim()
        const allowedSoft = ["sales", "purchases", "expense_requests", "collector_transactions", "commission_vouchers"]
        if (!allowedSoft.includes(table)) throw new Error(`Table "${table}" does not support MCP soft delete.`)
        if (!id) throw new Error("id is required")

        const { data, error } = await supabase
          .from(table)
          .update({ is_deleted: true, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select("id, is_deleted")
          .single()
        if (error) throw error
        await logMcpAudit(auth, toolName, `Soft-deleted record ${id} in ${table}`, { table, id })
        return { content: [{ type: "text", text: JSON.stringify({ soft_deleted: data }, null, 2) }] }
      }

      default:
        return { isError: true, content: [{ type: "text", text: `Tool "${toolName}" is not implemented.` }] }
    }
  } catch (err: any) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error executing ${toolName}: ${err?.message || String(err)}` }],
    }
  }
}
