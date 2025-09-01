import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { saleId, remarks } = await request.json()

    if (!saleId) {
      return NextResponse.json({ error: "Sale ID is required" }, { status: 400 })
    }

    const supabase = await createServerClient()

    const { error } = await supabase
      .from("sales")
      .update({
        remarks: JSON.stringify(remarks),
        updated_at: new Date().toISOString(),
      })
      .eq("id", saleId)

    if (error) {
      console.error("Error updating sale remarks:", error)
      return NextResponse.json({ error: "Failed to update remarks" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in update-sale-remarks API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
