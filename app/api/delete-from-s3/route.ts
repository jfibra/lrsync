import { NextRequest, NextResponse } from "next/server";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});
const BUCKET = process.env.S3_BUCKET_NAME!;

export async function POST(request: NextRequest) {
  try {
    const { key } = await request.json();
    if (!key) return NextResponse.json({ error: "No key provided" }, { status: 400 });

    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}