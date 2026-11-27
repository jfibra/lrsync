import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedRequestUser, getSupabaseAdmin } from "@/lib/smtp-mailer"
import { generateMcpKey, type McpAccessLevel } from "@/lib/mcp-server"

async function requireSuperAdmin(request: NextRequest) {
  const user = await getAuthenticatedRequestUser(request)
  if (!user) return null
  const supabase = getSupabaseAdmin()
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, auth_user_id, full_name, email, role")
    .or(`auth_user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle()

  if (!profile || profile.role !== "super_admin") return null
  return { user, profile }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request)
    if (!auth) {
      return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from("mcp_api_keys")
      .select(
        "id, name, access_level, key_prefix, is_active, created_by_name, created_by_email, last_used_at, request_count, expires_at, revoked_at, created_at"
      )
      .order("created_at", { ascending: false })

    if (error) throw error
    return NextResponse.json({ success: true, keys: data || [] })
  } catch (error: any) {
    console.error("GET /api/mcp/keys error:", error)
    return NextResponse.json({ error: error?.message || "Failed to list MCP keys" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request)
    if (!auth) {
      return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const name = String(body?.name || "").trim()
    const accessLevel: McpAccessLevel =
      body?.access_level === "admin_full" ? "admin_full" : "read_only"
    const expiresInDays = Number(body?.expires_in_days) || 0

    if (!name) {
      return NextResponse.json({ error: "Key name is required." }, { status: 400 })
    }

    const { rawKey, keyPrefix, keyHash } = generateMcpKey(accessLevel)
    const expiresAt =
      expiresInDays > 0
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from("mcp_api_keys")
      .insert([
        {
          name,
          access_level: accessLevel,
          key_prefix: keyPrefix,
          key_hash: keyHash,
          is_active: true,
          created_by_uuid: auth.user.id,
          created_by_name: auth.profile.full_name || auth.profile.email || "Super Admin",
          created_by_email: auth.profile.email || auth.user.email || "",
          expires_at: expiresAt,
        },
      ])
      .select(
        "id, name, access_level, key_prefix, is_active, created_by_name, created_by_email, last_used_at, request_count, expires_at, created_at"
      )
      .single()

    if (error) throw error

    await supabase.from("notifications").insert([
      {
        action: "mcp_api_key_created",
        description: `Created ${accessLevel === "admin_full" ? "Admin Full Access" : "Read-Only"} MCP API key "${name}" (${keyPrefix}...)`,
        user_uuid: auth.user.id,
        user_name: auth.profile.full_name || auth.profile.email || "Super Admin",
        user_email: auth.profile.email || auth.user.email || "",
        meta: { key_id: data.id, name, access_level: accessLevel, key_prefix: keyPrefix },
      },
    ])

    return NextResponse.json({
      success: true,
      key: data,
      rawKey, // Returned ONCE upon creation
    })
  } catch (error: any) {
    console.error("POST /api/mcp/keys error:", error)
    return NextResponse.json({ error: error?.message || "Failed to create MCP key" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request)
    if (!auth) {
      return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const id = String(body?.id || "").trim()
    const isActive = Boolean(body?.is_active)
    if (!id) return NextResponse.json({ error: "Key id is required" }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from("mcp_api_keys")
      .update({
        is_active: isActive,
        revoked_at: isActive ? null : new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, name, access_level, key_prefix, is_active, revoked_at")
      .single()

    if (error) throw error

    await supabase.from("notifications").insert([
      {
        action: isActive ? "mcp_api_key_reactivated" : "mcp_api_key_revoked",
        description: `${isActive ? "Reactivated" : "Revoked"} MCP API key "${data.name}" (${data.key_prefix}...)`,
        user_uuid: auth.user.id,
        user_name: auth.profile.full_name || auth.profile.email || "Super Admin",
        user_email: auth.profile.email || auth.user.email || "",
        meta: { key_id: data.id, name: data.name, is_active: isActive },
      },
    ])

    return NextResponse.json({ success: true, key: data })
  } catch (error: any) {
    console.error("PATCH /api/mcp/keys error:", error)
    return NextResponse.json({ error: error?.message || "Failed to update MCP key" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request)
    if (!auth) {
      return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 })
    }

    const id = request.nextUrl.searchParams.get("id") || ""
    if (!id) return NextResponse.json({ error: "Key id is required" }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const { data: existing } = await supabase
      .from("mcp_api_keys")
      .select("id, name, key_prefix")
      .eq("id", id)
      .maybeSingle()

    const { error } = await supabase.from("mcp_api_keys").delete().eq("id", id)
    if (error) throw error

    if (existing) {
      await supabase.from("notifications").insert([
        {
          action: "mcp_api_key_deleted",
          description: `Deleted MCP API key "${existing.name}" (${existing.key_prefix}...)`,
          user_uuid: auth.user.id,
          user_name: auth.profile.full_name || auth.profile.email || "Super Admin",
          user_email: auth.profile.email || auth.user.email || "",
          meta: { key_id: existing.id, name: existing.name },
        },
      ])
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("DELETE /api/mcp/keys error:", error)
    return NextResponse.json({ error: error?.message || "Failed to delete MCP key" }, { status: 500 })
  }
}
