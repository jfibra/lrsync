import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { format } from "date-fns";

const s3 = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET_NAME!;
const PUBLIC_URL = process.env.S3_PUBLIC_URL!;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Support both single file ("file") and multiple files ("files")
    let rawFiles = formData.getAll("files") as File[];
    if (!rawFiles || rawFiles.length === 0) {
      const singleFile = formData.get("file") as File | null;
      if (singleFile) {
        rawFiles = [singleFile];
      }
    }

    if (!rawFiles || rawFiles.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    // Extract date info for folder structure (lrsync/YYYY/MM/DD/)
    let year = (formData.get("tax_year") as string) || "";
    let month = (formData.get("tax_month") as string) || "";
    let date = (formData.get("tax_date") as string) || "";

    if (month && month.includes("-")) {
      const d = new Date(month);
      if (!isNaN(d.getTime())) {
        year = d.getFullYear().toString();
        month = String(d.getMonth() + 1).padStart(2, "0");
        date = String(d.getDate()).padStart(2, "0");
      }
    }

    if (!year || !month || !date) {
      const now = new Date();
      year = year || now.getFullYear().toString();
      month = month ? String(month).padStart(2, "0") : String(now.getMonth() + 1).padStart(2, "0");
      date = date ? String(date).padStart(2, "0") : String(now.getDate()).padStart(2, "0");
    }

    const tin = (formData.get("tin") as string) || "";
    const cleanTin = tin.replace(/[^0-9]/g, "") || "000000000";
    const fileType = (formData.get("file_type") as string) || "attachment";
    const clientFileName = formData.get("file_name") as string | null;
    const existingCount = parseInt((formData.get("existing_count") as string) || "0", 10);

    const uploaded: { name: string; url: string }[] = [];

    for (let i = 0; i < rawFiles.length; i++) {
      const file = rawFiles[i];
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ext = file.name.split(".").pop() || "dat";

      let fileName = "";
      if (clientFileName && rawFiles.length === 1) {
        // Sanitize client filename
        fileName = clientFileName.replace(/[^\w\s\-().]/g, "").trim();
      } else {
        const uniqueId = uuidv4();
        const now = new Date();
        const dateStr = format(now, "MMddyyyy-HHmmss");
        const seq = existingCount + i;
        fileName =
          seq > 0
            ? `${cleanTin}-${fileType}-${dateStr}-${uniqueId}-${seq + 1}.${ext}`
            : `${cleanTin}-${fileType}-${dateStr}-${uniqueId}.${ext}`;
      }

      // S3 Key matches existing format: lrsync/YYYY/MM/DD/filename
      const key = `lrsync/${year}/${month}/${date}/${fileName}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: buffer,
          ContentType: file.type || "application/octet-stream",
          ACL: "public-read",
        })
      );

      const url = `${PUBLIC_URL.replace(/\/$/, "")}/${key
        .split("/")
        .map((seg) => encodeURIComponent(seg))
        .join("/")}`;

      uploaded.push({ name: fileName, url });

      if (i < rawFiles.length - 1) {
        await new Promise((res) => setTimeout(res, 1000));
      }
    }

    const primaryUrl = uploaded[0]?.url || "";

    return NextResponse.json({
      success: true,
      url: primaryUrl,
      files: uploaded,
      "0": { url: primaryUrl },
    });
  } catch (error: any) {
    console.error("Sales attachment upload error:", error);
    return NextResponse.json({ error: error.message || "Failed to upload file to S3" }, { status: 500 });
  }
}
