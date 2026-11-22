import { NextRequest, NextResponse } from "next/server"

const LRAPP_BASE_URL = "https://leuteriorealty.com/api/lrapp"

// In-memory per-email Sanctum token cache (lives per server instance; auto-refreshes on 401)
const tokenCache = new Map<string, string>()

async function loginToLrapp(email: string, password: string): Promise<string | null> {
  try {
    const body = new URLSearchParams({ email, password })
    const res = await fetch(`${LRAPP_BASE_URL}/login`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      cache: "no-store",
    })

    if (!res.ok) return null
    const data = await res.json().catch(() => ({}))
    const token = typeof data?.token === "string" ? data.token : null
    if (token) {
      tokenCache.set(email.toLowerCase(), token)
    }
    return token
  } catch (err) {
    console.error("LRAPP login error:", err)
    return null
  }
}

async function getTokenForEmail(email: string, password: string, forceRefresh = false): Promise<string | null> {
  const key = email.toLowerCase()
  if (!forceRefresh && tokenCache.has(key)) {
    return tokenCache.get(key) || null
  }
  tokenCache.delete(key)
  return loginToLrapp(email, password)
}

async function fetchMembersWithToken(q: string, page: string, token: string) {
  const upstreamUrl = `${LRAPP_BASE_URL}/members/search?q=${encodeURIComponent(q)}&page=${encodeURIComponent(page)}`
  return fetch(upstreamUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get("q") || "").trim()
    const page = searchParams.get("page") || "1"
    const userEmail = (searchParams.get("userEmail") || "").trim()

    if (q.length < 2) {
      return NextResponse.json(
        { success: false, message: "Enter at least 2 characters to search.", members: [] },
        { status: 422 }
      )
    }

    const staticToken = (process.env.LRAPP_API_TOKEN || "").trim()
    const password = (process.env.LRAPP_LOGIN_PASSWORD || "").trim()
    const fallbackEmail = (process.env.LRAPP_LOGIN_EMAIL || "").trim()

    const candidateEmails = Array.from(
      new Set([userEmail, fallbackEmail].filter(Boolean).map((e) => e.toLowerCase()))
    )

    // 1. Try per-user Sanctum login (with fallback email if user's LR account is blocked/missing)
    if (password && candidateEmails.length > 0) {
      for (const email of candidateEmails) {
        let token = await getTokenForEmail(email, password, false)
        if (!token) continue

        let res = await fetchMembersWithToken(q, page, token)

        // If cached token expired or user logged out elsewhere, re-login once and retry
        if (res.status === 401) {
          token = await getTokenForEmail(email, password, true)
          if (!token) continue
          res = await fetchMembersWithToken(q, page, token)
        }

        if (res.ok) {
          const data = await res.json().catch(() => ({}))
          return NextResponse.json(data, { status: 200 })
        }
      }
    }

    // 2. Fallback to static LRAPP_API_TOKEN if configured
    if (staticToken) {
      const res = await fetchMembersWithToken(q, page, staticToken)
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        return NextResponse.json(data, { status: 200 })
      }
      return NextResponse.json(
        {
          success: false,
          message: data?.message || `Upstream member search failed (${res.status})`,
          members: [],
        },
        { status: res.status }
      )
    }

    return NextResponse.json(
      {
        success: false,
        configured: false,
        message:
          "Could not authenticate with LR API. Set LRAPP_LOGIN_PASSWORD (and optional LRAPP_LOGIN_EMAIL fallback) in environment variables.",
        members: [],
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error("Error proxying LRAPP member search:", error)
    return NextResponse.json(
      { success: false, message: error?.message || "Member search failed", members: [] },
      { status: 500 }
    )
  }
}
