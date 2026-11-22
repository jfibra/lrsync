import { NextRequest, NextResponse } from "next/server"

const LRAPP_BASE_URL = "https://leuteriorealty.com/api/lrapp"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get("q") || "").trim()
    const page = searchParams.get("page") || "1"

    if (q.length < 2) {
      return NextResponse.json(
        { success: false, message: "Enter at least 2 characters to search.", members: [] },
        { status: 422 }
      )
    }

    const token = process.env.LRAPP_API_TOKEN || process.env.LR_PWA_BEARER_TOKEN || ""
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          configured: false,
          message: "LRAPP_API_TOKEN is not configured in environment variables.",
          members: [],
        },
        { status: 200 }
      )
    }

    const upstreamUrl = `${LRAPP_BASE_URL}/members/search?q=${encodeURIComponent(q)}&page=${encodeURIComponent(page)}`
    const res = await fetch(upstreamUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          message: data?.message || `Upstream member search failed (${res.status})`,
          members: [],
        },
        { status: res.status }
      )
    }

    return NextResponse.json(data, { status: 200 })
  } catch (error: any) {
    console.error("Error proxying LRAPP member search:", error)
    return NextResponse.json(
      { success: false, message: error?.message || "Member search failed", members: [] },
      { status: 500 }
    )
  }
}
