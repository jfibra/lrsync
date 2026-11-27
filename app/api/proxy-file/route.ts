import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase/server"

async function verifyAuthenticatedUser(request: NextRequest): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return false

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

  try {
    const serverSupabase = await createServerClient()
    const { data, error } = await serverSupabase.auth.getUser()
    if (!error && data?.user) return true
  } catch {
    // ignore
  }
  return false
}

export async function GET(request: NextRequest) {
  try {
    const isAuthed = await verifyAuthenticatedUser(request)
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const urlParam = request.nextUrl.searchParams.get("url") || ""
    let parsed: URL
    try {
      parsed = new URL(urlParam)
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return NextResponse.json({ error: "Unsupported URL protocol" }, { status: 400 })
    }

    const upstream = await fetch(parsed.toString(), { cache: "no-store" })
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Failed to fetch file (${upstream.status})` },
        { status: upstream.status }
      )
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream"
    const arrayBuffer = await upstream.arrayBuffer()

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
      },
    })
  } catch (error: any) {
    console.error("Proxy file error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to proxy file" },
      { status: 500 }
    )
  }
}
