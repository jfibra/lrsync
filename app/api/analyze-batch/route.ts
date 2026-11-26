import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase/server"

const TAG_VALUES = ["invoice", "cheque", "deposit_slip", "doc_2307", "voucher"] as const
type DetectedTag = (typeof TAG_VALUES)[number]
type RotationDegrees = 0 | 90 | 180 | 270

const batchItemSchema = z.object({
  id: z.string().min(1),
  tag: z.enum(["auto", "invoice", "cheque", "deposit_slip", "doc_2307", "voucher"]),
  imageBase64: z.string().min(50).max(8 * 1024 * 1024),
  mimeType: z.string().default("image/jpeg"),
  fileName: z.string().max(200).optional(),
})

const batchRequestSchema = z.object({
  items: z.array(batchItemSchema).min(1).max(8),
})

export interface AnalyzeBatchResponse {
  detected_tags: Record<string, DetectedTag>
  detected_rotations: Record<string, RotationDegrees>
  developer_name: string | null
  developer_tin: string | null
  invoice_number: string | null
  invoice_date: string | null
  commission_amount: number | null
  cheque_number: string | null
  cheque_bank: string | null
  cheque_date: string | null
  cheque_amount: number | null
  deposit_bank: string | null
  deposit_reference_no: string | null
  deposit_amount: number | null
  deposit_date: string | null
  ai_summary_remark: string
  fallback?: boolean
}

function buildFallbackResponse(
  items: Array<z.infer<typeof batchItemSchema>>,
  reason?: string
): AnalyzeBatchResponse {
  const detected_tags: Record<string, DetectedTag> = {}
  const detected_rotations: Record<string, RotationDegrees> = {}
  const labels = new Set<string>()

  const labelMap: Record<DetectedTag, string> = {
    invoice: "Invoice",
    cheque: "Cheque",
    deposit_slip: "Deposit Slip",
    doc_2307: "BIR 2307",
    voucher: "Check Voucher",
  }

  for (const item of items) {
    const resolved: DetectedTag = item.tag === "auto" ? "invoice" : item.tag
    detected_tags[item.id] = resolved
    detected_rotations[item.id] = 0
    labels.add(labelMap[resolved])
  }

  const attachSummary = Array.from(labels).join(", ") || "Document(s)"
  return {
    detected_tags,
    detected_rotations,
    developer_name: null,
    developer_tin: null,
    invoice_number: null,
    invoice_date: null,
    commission_amount: null,
    cheque_number: null,
    cheque_bank: null,
    cheque_date: null,
    cheque_amount: null,
    deposit_bank: null,
    deposit_reference_no: null,
    deposit_amount: null,
    deposit_date: null,
    ai_summary_remark: reason
      ? `Attachments: ${attachSummary} (${items.length} file${items.length === 1 ? "" : "s"}).`
      : `Attachments: ${attachSummary} (${items.length} file${items.length === 1 ? "" : "s"}).`,
    fallback: true,
  }
}

function toNumberOrNull(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null
  if (typeof val === "number") return Number.isFinite(val) && val > 0 ? val : null
  const cleaned = String(val).replace(/[^0-9.\-]/g, "")
  if (!cleaned) return null
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) && n > 0 ? n : null
}

function toStringOrNull(val: unknown): string | null {
  if (val === null || val === undefined) return null
  const s = String(val).trim()
  return s && s.toLowerCase() !== "null" && s.toLowerCase() !== "n/a" ? s : null
}

function toIsoDateOrNull(val: unknown): string | null {
  const s = toStringOrNull(val)
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

async function verifyAuthenticatedUser(request: NextRequest): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return false

  // 1. Prefer Authorization: Bearer <access_token> sent by browser client
  const authHeader = request.headers.get("authorization") || ""
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim()
    if (token) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data, error } = await supabase.auth.getUser(token)
      if (!error && data?.user) return true
    }
  }

  // 2. Fallback to cookie-based server client
  try {
    const serverSupabase = await createServerClient()
    const { data, error } = await serverSupabase.auth.getUser()
    if (!error && data?.user) return true
  } catch {
    // ignore cookie fallback error
  }

  return false
}

export async function POST(request: NextRequest) {
  try {
    const isAuthed = await verifyAuthenticatedUser(request)
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rawBody = await request.json().catch(() => null)
    const parsed = batchRequestSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { items } = parsed.data
    const apiKey = (process.env.PERPLEXITY_API_KEY || "").trim()
    const model = (process.env.PERPLEXITY_VISION_MODEL || "sonar-pro").trim()

    if (!apiKey) {
      console.warn("PERPLEXITY_API_KEY is not configured; returning fallback analysis.")
      return NextResponse.json(buildFallbackResponse(items, "AI key not configured"))
    }

    const manifest = items
      .map(
        (item, idx) =>
          `Image ${idx + 1} (id="${item.id}", tag="${item.tag}", file="${item.fileName || `image_${idx + 1}.jpg`}")`
      )
      .join("\n")

    const prompt = `You are a Philippine real estate accounting & BIR document extraction expert.
Analyze ALL uploaded images below together as one related accounting/commission collection batch.

Uploaded Images Manifest:
${manifest}

Return ONLY valid JSON (no markdown fences, no extra commentary) with this exact shape:
{
  "detected_tags": { "<item_id>": "invoice" | "cheque" | "deposit_slip" | "doc_2307" | "voucher" },
  "detected_rotations": { "<item_id>": 0 | 90 | 180 | 270 },
  "developer_name": "string | null",
  "developer_tin": "string | null",
  "invoice_number": "string | null",
  "invoice_date": "YYYY-MM-DD | null",
  "commission_amount": 0,
  "cheque_number": "string | null",
  "cheque_bank": "string | null",
  "cheque_date": "YYYY-MM-DD | null",
  "cheque_amount": 0,
  "deposit_bank": "string | null",
  "deposit_reference_no": "string | null",
  "deposit_amount": 0,
  "deposit_date": "YYYY-MM-DD | null",
  "ai_summary_remark": "1-sentence fast-track summary e.g. 'Ayala Land · PHP 45,000.00 · Attachments: Invoice, Cheque #001234 (BDO), Deposit Slip.'"
}

Rules:
1. Keep user-selected tags unless tag === "auto". If tag === "auto", classify accurately as one of: "invoice", "cheque", "deposit_slip", "doc_2307", or "voucher".
2. For "detected_rotations", return the clockwise degrees (0, 90, 180, or 270) needed to make each photo upright and horizontally readable (0 = already upright, 90 = rotate 90° clockwise, 180 = upside down, 270 = rotate 90° counter-clockwise).
3. Return all amounts as plain numbers (no commas or currency symbols; use 0 or null if not found) and all dates in YYYY-MM-DD format.
4. For developer_name and developer_tin, extract the real estate developer / payor company name and TIN (not Leuterio Realty & Brokerage).
5. Cross-reference across all images so fields from the invoice, cheque, BIR 2307, check voucher, and deposit slip combine cleanly.`

    const imageContents = items.map((item) => {
      const cleanBase64 = item.imageBase64.replace(/^data:[^;]+;base64,/, "").trim()
      return {
        type: "image_url",
        image_url: {
          url: `data:${item.mimeType || "image/jpeg"};base64,${cleanBase64}`,
        },
      }
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20_000)

    let perplexityRes: Response
    try {
      perplexityRes = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          messages: [
            {
              role: "user",
              content: [{ type: "text", text: prompt }, ...imageContents],
            },
          ],
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!perplexityRes.ok) {
      const errText = await perplexityRes.text().catch(() => "")
      console.error("Perplexity Vision API error:", perplexityRes.status, errText.slice(0, 300))
      return NextResponse.json(buildFallbackResponse(items, `Perplexity HTTP ${perplexityRes.status}`))
    }

    const completion = await perplexityRes.json().catch(() => null)
    const rawContent: string = completion?.choices?.[0]?.message?.content || ""

    // Strip markdown code fences and isolate JSON object
    const stripped = rawContent
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim()

    const firstBrace = stripped.indexOf("{")
    const lastBrace = stripped.lastIndexOf("}")
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      console.warn("Perplexity Vision returned non-JSON content:", stripped.slice(0, 200))
      return NextResponse.json(buildFallbackResponse(items, "Invalid AI JSON"))
    }

    let extracted: Record<string, any>
    try {
      extracted = JSON.parse(stripped.slice(firstBrace, lastBrace + 1))
    } catch (parseErr) {
      console.warn("Failed to parse Perplexity JSON:", parseErr)
      return NextResponse.json(buildFallbackResponse(items, "JSON parse error"))
    }

    const rawTags =
      extracted.detected_tags && typeof extracted.detected_tags === "object"
        ? extracted.detected_tags
        : {}
    const rawRotations =
      extracted.detected_rotations && typeof extracted.detected_rotations === "object"
        ? extracted.detected_rotations
        : {}

    const detected_tags: Record<string, DetectedTag> = {}
    const detected_rotations: Record<string, RotationDegrees> = {}
    for (const item of items) {
      if (item.tag !== "auto") {
        detected_tags[item.id] = item.tag
      } else {
        const candidate = String(rawTags[item.id] || "").trim().toLowerCase()
        detected_tags[item.id] = (TAG_VALUES as readonly string[]).includes(candidate)
          ? (candidate as DetectedTag)
          : "invoice"
      }

      const rawDeg = Number(rawRotations[item.id])
      detected_rotations[item.id] =
        rawDeg === 90 || rawDeg === 180 || rawDeg === 270 ? rawDeg : 0
    }

    const fallback = buildFallbackResponse(items)
    const result: AnalyzeBatchResponse = {
      detected_tags,
      detected_rotations,
      developer_name: toStringOrNull(extracted.developer_name),
      developer_tin: toStringOrNull(extracted.developer_tin),
      invoice_number: toStringOrNull(extracted.invoice_number),
      invoice_date: toIsoDateOrNull(extracted.invoice_date),
      commission_amount: toNumberOrNull(extracted.commission_amount),
      cheque_number: toStringOrNull(extracted.cheque_number),
      cheque_bank: toStringOrNull(extracted.cheque_bank),
      cheque_date: toIsoDateOrNull(extracted.cheque_date),
      cheque_amount: toNumberOrNull(extracted.cheque_amount),
      deposit_bank: toStringOrNull(extracted.deposit_bank),
      deposit_reference_no: toStringOrNull(extracted.deposit_reference_no),
      deposit_amount: toNumberOrNull(extracted.deposit_amount),
      deposit_date: toIsoDateOrNull(extracted.deposit_date),
      ai_summary_remark: toStringOrNull(extracted.ai_summary_remark) || fallback.ai_summary_remark,
      fallback: false,
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Analyze batch route error:", error?.name === "AbortError" ? "Timeout (20s)" : error)
    return NextResponse.json(
      {
        detected_tags: {},
        detected_rotations: {},
        developer_name: null,
        developer_tin: null,
        invoice_number: null,
        invoice_date: null,
        commission_amount: null,
        cheque_number: null,
        cheque_bank: null,
        cheque_date: null,
        cheque_amount: null,
        deposit_bank: null,
        deposit_reference_no: null,
        deposit_amount: null,
        deposit_date: null,
        ai_summary_remark: "Uploaded batch attachments.",
        fallback: true,
      } satisfies AnalyzeBatchResponse,
      { status: 200 }
    )
  }
}
