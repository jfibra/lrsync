import { NextRequest, NextResponse } from "next/server"
import {
  getAuthenticatedRequestUser,
  getDefaultSmtpConfig,
  getSupabaseAdmin,
  getUserSmtpConfig,
} from "@/lib/smtp-mailer"

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedRequestUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { config, isCustom } = await getUserSmtpConfig(user.id)
    return NextResponse.json({
      success: true,
      isCustom,
      settings: config,
    })
  } catch (error: any) {
    console.error("GET /api/smtp-settings error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to load SMTP settings" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedRequestUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const defaults = getDefaultSmtpConfig()
    const payload = {
      user_id: user.id,
      mail_driver: String(body.mail_driver || defaults.mail_driver).trim() || "smtp",
      mail_host: String(body.mail_host || "").trim(),
      mail_port: Number(body.mail_port) || 465,
      mail_username: String(body.mail_username || "").trim(),
      mail_password: String(body.mail_password ?? ""),
      mail_encryption: String(body.mail_encryption || "ssl").trim().toLowerCase(),
      mail_from_name: String(body.mail_from_name || defaults.mail_from_name)
        .replace(/^"|"$/g, "")
        .trim(),
      mail_from: String(body.mail_from || "").trim(),
      mail_cc: String(body.mail_cc ?? "").trim(),
      updated_at: new Date().toISOString(),
    }

    if (!payload.mail_host || !payload.mail_username) {
      return NextResponse.json(
        { error: "MAIL_HOST and MAIL_USERNAME are required." },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from("user_smtp_settings")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .single()

    if (error) throw error

    await supabaseAdmin.from("notifications").insert([
      {
        action: "smtp_settings_updated",
        description: `Updated account SMTP settings (${payload.mail_host}:${payload.mail_port}, From: ${payload.mail_from || payload.mail_username})`,
        user_uuid: user.id,
        user_email: user.email || "",
        user_name: user.user_metadata?.full_name || user.email || user.id,
        meta: {
          mail_host: payload.mail_host,
          mail_port: payload.mail_port,
          mail_username: payload.mail_username,
          mail_from: payload.mail_from,
          mail_cc: payload.mail_cc,
          mail_encryption: payload.mail_encryption,
        },
      },
    ])

    return NextResponse.json({
      success: true,
      settings: {
        mail_driver: data.mail_driver,
        mail_host: data.mail_host,
        mail_port: data.mail_port,
        mail_username: data.mail_username,
        mail_password: data.mail_password,
        mail_encryption: data.mail_encryption,
        mail_from_name: data.mail_from_name,
        mail_from: data.mail_from,
        mail_cc: data.mail_cc || "",
      },
    })
  } catch (error: any) {
    console.error("PUT /api/smtp-settings error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to save SMTP settings" },
      { status: 500 }
    )
  }
}
