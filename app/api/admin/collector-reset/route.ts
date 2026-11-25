import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3"

const s3 = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { authUserId, action } = body as {
      authUserId?: string
      action?: "reset_device" | "reset_face"
    }

    if (!authUserId || !action || (action !== "reset_device" && action !== "reset_face")) {
      return NextResponse.json(
        { error: "Valid authUserId and action ('reset_device' | 'reset_face') are required." },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Supabase admin credentials are not configured on the server." },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Fetch existing user metadata so we only overwrite targeted biometric/face fields
    const { data: userData, error: fetchErr } = await supabaseAdmin.auth.admin.getUserById(authUserId)
    if (fetchErr || !userData?.user) {
      return NextResponse.json(
        { error: fetchErr?.message || "Auth user not found." },
        { status: 404 }
      )
    }

    const existingMeta = userData.user.user_metadata || {}

    if (action === "reset_device") {
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        user_metadata: {
          ...existingMeta,
          bound_biometric_device: null,
        },
      })
      if (updateErr) throw updateErr

      return NextResponse.json({
        success: true,
        message: "Bound biometric device cleared. Collector can register a new phone on next sign-in.",
      })
    }

    // action === "reset_face"
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
      user_metadata: {
        ...existingMeta,
        face_enrolled_at: null,
        face_consent_granted: false,
      },
    })
    if (updateErr) throw updateErr

    // Also delete enrolled face photo from S3 (ignore if already absent)
    const bucket = process.env.S3_BUCKET_NAME
    if (bucket) {
      const faceKey = `collector/biometrics/${authUserId}/enrolled-face.jpg`
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: faceKey }))
      } catch (s3Err: any) {
        if (s3Err?.name !== "NoSuchKey") {
          console.warn("Non-fatal S3 delete warning for enrolled face:", s3Err?.message)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Enrolled face metadata and S3 biometric photo cleared.",
    })
  } catch (error: any) {
    console.error("Collector biometric/face reset error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to reset collector binding." },
      { status: 500 }
    )
  }
}
