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
    const { url } = await request.json();
    if (!url) return NextResponse.json({ error: "No url provided" }, { status: 400 });

    // Extract the S3 key from the URL
    const urlObj = new URL(url);
    const key = decodeURIComponent(urlObj.pathname.replace(/^\/+/, ""));

    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
