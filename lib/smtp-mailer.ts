import nodemailer from "nodemailer"
import { createClient } from "@supabase/supabase-js"
import type { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export interface SmtpConfig {
  mail_driver: string
  mail_host: string
  mail_port: number
  mail_username: string
  mail_password: string
  mail_encryption: string
  mail_from_name: string
  mail_from: string
  mail_cc: string
}

export function getDefaultSmtpConfig(): SmtpConfig {
  return {
    mail_driver: (process.env.MAIL_DRIVER || "smtp").trim(),
    mail_host: (process.env.MAIL_HOST || "smtp.hostinger.com").trim(),
    mail_port: Number(process.env.MAIL_PORT) || 465,
    mail_username: (process.env.MAIL_USERNAME || "info@filipinohomes.com").trim(),
    mail_password: (process.env.MAIL_PASSWORD || "").trim(),
    mail_encryption: (process.env.MAIL_ENCRYPTION || "ssl").trim().toLowerCase(),
    mail_from_name: (process.env.MAIL_FROM_NAME || "LR Accounting Software")
      .replace(/^"|"$/g, "")
      .trim(),
    mail_from: (process.env.MAIL_FROM || "no-reply@filipinohomes.com").trim(),
    mail_cc: (process.env.MAIL_CC || "it.dept.leuteriorealty@gmail.com").trim(),
  }
}

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function getAuthenticatedRequestUser(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return null

  const authHeader = request.headers.get("authorization") || ""
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim()
    if (token) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data, error } = await supabase.auth.getUser(token)
      if (!error && data?.user) return data.user
    }
  }

  try {
    const serverSupabase = await createServerClient()
    const { data, error } = await serverSupabase.auth.getUser()
    if (!error && data?.user) return data.user
  } catch {
    // ignore
  }

  return null
}

/**
 * Loads the per-account SMTP configuration from `public.user_smtp_settings`
 * for the given userId (falling back cleanly to env defaults if not found).
 */
export async function getUserSmtpConfig(userId?: string | null): Promise<{
  config: SmtpConfig
  isCustom: boolean
}> {
  const defaults = getDefaultSmtpConfig()
  if (!userId) return { config: defaults, isCustom: false }

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from("user_smtp_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()

    if (error || !data) {
      return { config: defaults, isCustom: false }
    }

    return {
      isCustom: true,
      config: {
        mail_driver: (data.mail_driver || defaults.mail_driver).trim(),
        mail_host: (data.mail_host || defaults.mail_host).trim(),
        mail_port: Number(data.mail_port) || defaults.mail_port,
        mail_username: (data.mail_username || defaults.mail_username).trim(),
        mail_password:
          data.mail_password !== null && data.mail_password !== undefined && data.mail_password !== ""
            ? String(data.mail_password)
            : defaults.mail_password,
        mail_encryption: (data.mail_encryption || defaults.mail_encryption).trim().toLowerCase(),
        mail_from_name: (data.mail_from_name || defaults.mail_from_name)
          .replace(/^"|"$/g, "")
          .trim(),
        mail_from: (data.mail_from || defaults.mail_from).trim(),
        mail_cc: data.mail_cc !== null && data.mail_cc !== undefined ? String(data.mail_cc).trim() : defaults.mail_cc,
      },
    }
  } catch (err) {
    console.warn("Fallback to default SMTP config:", err)
    return { config: defaults, isCustom: false }
  }
}

export function parseCcList(ccRaw?: string | null): string[] {
  if (!ccRaw) return []
  return ccRaw
    .split(/[,;]+/)
    .map((e) => e.trim())
    .filter((e) => e.includes("@"))
}

export async function sendMailWithSmtp(
  config: SmtpConfig,
  options: {
    to: string | string[]
    subject: string
    html: string
    attachments?: any[]
    ccOverride?: string | string[]
  }
) {
  const port = Number(config.mail_port) || 465
  const enc = (config.mail_encryption || "ssl").toLowerCase()
  const secure = enc === "ssl" || port === 465

  const transporter = nodemailer.createTransport({
    host: config.mail_host,
    port,
    secure,
    ...(enc === "tls" && !secure ? { requireTLS: true } : {}),
    auth: {
      user: config.mail_username,
      pass: config.mail_password,
    },
  })

  const fromName = (config.mail_from_name || "LR Accounting Software").replace(/^"|"$/g, "")
  const fromAddress = config.mail_from || config.mail_username || "no-reply@filipinohomes.com"
  const ccList = options.ccOverride
    ? Array.isArray(options.ccOverride)
      ? options.ccOverride
      : parseCcList(options.ccOverride)
    : parseCcList(config.mail_cc)

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: options.to,
    ...(ccList.length > 0 ? { cc: ccList } : {}),
    subject: options.subject,
    html: options.html,
    attachments: options.attachments || [],
  })

  return {
    messageId: info.messageId,
    from: `"${fromName}" <${fromAddress}>`,
    cc: ccList,
  }
}
