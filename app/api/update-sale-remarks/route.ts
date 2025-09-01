import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { saleId, remarks } = await request.json()

    // [v0] Add debugging logs to track the update process
    console.log("[v0] Updating sale remarks for saleId:", saleId)
    console.log("[v0] New remarks data:", JSON.stringify(remarks, null, 2))

    if (!saleId) {
      return NextResponse.json({ error: "Sale ID is required" }, { status: 400 })
    }

    const supabase = await createServerClient()

    // [v0] Add debugging to check current record before update
    const { data: currentRecord, error: fetchError } = await supabase
      .from("sales")
      .select("remarks")
      .eq("id", saleId)
      .single()

    if (fetchError) {
      console.error("[v0] Error fetching current record:", fetchError)
    } else {
      console.log("[v0] Current remarks in DB:", currentRecord?.remarks)
    }

    const { error } = await supabase
      .from("sales")
      .update({
        remarks: JSON.stringify(remarks),
        updated_at: new Date().toISOString(),
      })
      .eq("id", saleId)

    if (error) {
      console.error("[v0] Error updating sale remarks:", error)
      return NextResponse.json({ error: "Failed to update remarks" }, { status: 500 })
    }

    // [v0] Verify the update was successful
    const { data: updatedRecord, error: verifyError } = await supabase
      .from("sales")
      .select("remarks")
      .eq("id", saleId)
      .single()

    if (verifyError) {
      console.error("[v0] Error verifying update:", verifyError)
    } else {
      console.log("[v0] Updated remarks in DB:", updatedRecord?.remarks)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error in update-sale-remarks API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
