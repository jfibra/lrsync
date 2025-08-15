import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

const s3 = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET_NAME!;
const PUBLIC_URL = process.env.S3_PUBLIC_URL!;

function generate8DigitNumber() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const tin_name = (formData.get("tin_name") as string) || "Unknown";
    const tin_number = (formData.get("tin_number") as string) || "Unknown";
    const assigned_area = (formData.get("assigned_area") as string) || "Unknown";
    const user_full_name = (formData.get("user_full_name") as string) || "Unknown";

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    // Get current date info for folder structure
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const date = String(now.getDate()).padStart(2, "0");

    const uploaded: { name: string; url: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ext = file.name.split(".").pop() || "dat";

      // Generate unique 8-digit number
      const orNumber = generate8DigitNumber();

      // Sanitize file name parts
      const safeTinName = tin_name.replace(/[^\w\s\-]/g, "").replace(/\s+/g, " ").trim();
      const safeTinNumber = tin_number.replace(/[^\w\-]/g, "");
      const safeAssignedArea = assigned_area.replace(/[^\w\s\-]/g, "").replace(/\s+/g, " ").trim();
      const safeUserFullName = user_full_name.replace(/[^\w\s\-]/g, "").replace(/\s+/g, " ").trim();

      // Compose file name
      const fileName = `OR # ${orNumber} - ${safeTinName} - ${safeTinNumber} (${safeAssignedArea} - ${safeUserFullName}).${ext}`;

      // Compose S3 key
      const key = `lrsync/purchases/${year}/${month}/${date}/${fileName}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: buffer,
          ContentType: file.type,
          ACL: "public-read",
        })
      );
      uploaded.push({
        name: fileName,
        url: `${PUBLIC_URL.replace(/\/$/, "")}/${key.replace(/^\//, "")}`,
      });
    }

    return NextResponse.json({ files: uploaded });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
