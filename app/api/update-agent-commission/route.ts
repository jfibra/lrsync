import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const body = await request.json()
    const { id, ...updateData } = body

    const { data, error } = await supabase.from("commission_agent_breakdown").update(updateData).eq("id", id).select()

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to update agent commission" }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
