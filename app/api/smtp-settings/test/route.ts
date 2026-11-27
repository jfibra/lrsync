import { NextRequest, NextResponse } from "next/server"
import {
  getAuthenticatedRequestUser,
  getSupabaseAdmin,
  getUserSmtpConfig,
  sendMailWithSmtp,
  type SmtpConfig,
} from "@/lib/smtp-mailer"

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedRequestUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const testEmail = String(body?.testEmail || "").trim()
    if (!testEmail || !testEmail.includes("@")) {
      return NextResponse.json(
        { error: "Please enter a valid recipient email address for the test email." },
        { status: 400 }
      )
    }

    // Use submitted form config if provided so user can test before saving, else load saved account config
    const { config: savedConfig } = await getUserSmtpConfig(user.id)
    const override = body?.smtpConfig
    const configToTest: SmtpConfig =
      override && typeof override === "object"
        ? {
            mail_driver: String(override.mail_driver || savedConfig.mail_driver).trim(),
            mail_host: String(override.mail_host || savedConfig.mail_host).trim(),
            mail_port: Number(override.mail_port) || savedConfig.mail_port,
            mail_username: String(override.mail_username || savedConfig.mail_username).trim(),
            mail_password:
              override.mail_password !== undefined && override.mail_password !== ""
                ? String(override.mail_password)
                : savedConfig.mail_password,
            mail_encryption: String(override.mail_encryption || savedConfig.mail_encryption)
              .trim()
              .toLowerCase(),
            mail_from_name: String(override.mail_from_name || savedConfig.mail_from_name)
              .replace(/^"|"$/g, "")
              .trim(),
            mail_from:
              override.mail_from !== undefined
                ? String(override.mail_from).trim()
                : savedConfig.mail_from,
            mail_cc:
              override.mail_cc !== undefined ? String(override.mail_cc).trim() : savedConfig.mail_cc,
          }
        : savedConfig

    if (!configToTest.mail_host || !configToTest.mail_username || !configToTest.mail_password) {
      return NextResponse.json(
        { error: "SMTP Host, Username, and Password are required to send a test email." },
        { status: 400 }
      )
    }

    const sentAt = new Date().toLocaleString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })

    const html = `
      <!DOCTYPE html>
      <html>
        <body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
          <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
            <div style="background:#001f3f;color:#ffffff;padding:20px 24px;">
              <div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#93c5fd;font-weight:700;">
                ${configToTest.mail_from_name}
              </div>
              <h2 style="margin:6px 0 0 0;font-size:20px;">SMTP Settings Test Successful</h2>
            </div>
            <div style="padding:24px;color:#334155;font-size:14px;line-height:1.6;">
              <p style="margin-top:0;">Your per-account SMTP configuration is working properly.</p>
              <table style="width:100%;border-collapse:collapse;font-size:13px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
                <tr><td style="padding:8px 12px;color:#64748b;">Host / Port</td><td style="padding:8px 12px;font-weight:600;color:#0f172a;">${configToTest.mail_host}:${configToTest.mail_port} (${configToTest.mail_encryption.toUpperCase()})</td></tr>
                <tr><td style="padding:8px 12px;color:#64748b;">Username</td><td style="padding:8px 12px;font-weight:600;color:#0f172a;">${configToTest.mail_username}</td></tr>
                <tr><td style="padding:8px 12px;color:#64748b;">From</td><td style="padding:8px 12px;font-weight:600;color:#0f172a;">${configToTest.mail_from_name} &lt;${configToTest.mail_from || configToTest.mail_username}&gt;</td></tr>
                <tr><td style="padding:8px 12px;color:#64748b;">CC</td><td style="padding:8px 12px;font-weight:600;color:#0f172a;">${configToTest.mail_cc || "None"}</td></tr>
                <tr><td style="padding:8px 12px;color:#64748b;">Tested By</td><td style="padding:8px 12px;font-weight:600;color:#0f172a;">${user.email || user.id}</td></tr>
                <tr><td style="padding:8px 12px;color:#64748b;">Sent At</td><td style="padding:8px 12px;font-weight:600;color:#0f172a;">${sentAt}</td></tr>
              </table>
            </div>
          </div>
        </body>
      </html>
    `

    const result = await sendMailWithSmtp(configToTest, {
      to: testEmail,
      subject: `[SMTP Test] ${configToTest.mail_from_name} — Email Configuration Verified`,
      html,
    })

    const supabaseAdmin = getSupabaseAdmin()
    await supabaseAdmin.from("notifications").insert([
      {
        action: "smtp_settings_tested",
        description: `Sent SMTP test email to ${testEmail}${result.cc.length > 0 ? ` (CC: ${result.cc.join(", ")})` : ""}`,
        user_uuid: user.id,
        user_email: user.email || "",
        user_name: user.user_metadata?.full_name || user.email || user.id,
        meta: {
          test_email: testEmail,
          cc: result.cc,
          mail_host: configToTest.mail_host,
          mail_port: configToTest.mail_port,
          message_id: result.messageId,
        },
      },
    ])

    return NextResponse.json({
      success: true,
      sentTo: testEmail,
      cc: result.cc,
      from: result.from,
      messageId: result.messageId,
    })
  } catch (error: any) {
    console.error("POST /api/smtp-settings/test error:", error)
    return NextResponse.json(
      { error: error?.message || "SMTP test failed. Please verify your host, port, encryption, and credentials." },
      { status: 500 }
    )
  }
}
