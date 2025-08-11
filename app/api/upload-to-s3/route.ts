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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const assigned_area = formData.get("assigned_area") as string;
    const created_date = formData.get("created_date") as string;
    const report_number = formData.get("report_number") as string;
    const existing_count = parseInt(
      (formData.get("existing_count") as string) || "0",
      10
    );

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    // Sanitize assigned_area and report_number for S3 key
    const safeReport = (report_number || "Unknown").replace(/[^\w\-]+/g, "_");
    const safeArea = (assigned_area || "Unknown").replace(/[^\w\- ]+/g, "_");

    const uploaded: { name: string; url: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ext = file.name.split(".").pop() || "dat";
      const seq = existing_count + i + 1;

      let typeLabel = "Attachment";
      if (file.type === "application/pdf") {
        typeLabel = "Accounting_PDF_Attachment";
      } else if (file.type.startsWith("image/")) {
        typeLabel = "Accounting_Image_Attachment";
      }

      // Add 1 second per file to the base date for unique datetime
      const now = new Date();
      const fileDate = new Date(now.getTime() + i * 1000);
      const yyyy = fileDate.getFullYear();
      const MM = String(fileDate.getMonth() + 1).padStart(2, "0");
      const dd = String(fileDate.getDate()).padStart(2, "0");
      const HH = String(fileDate.getHours()).padStart(2, "0");
      const mm = String(fileDate.getMinutes()).padStart(2, "0");
      const ss = String(fileDate.getSeconds()).padStart(2, "0");
      const datetime = `${yyyy}${MM}${dd}-${HH}${mm}${ss}`;

      // Use underscores and hyphens, no # or spaces, and include datetime
      const fileName = `CR_${safeReport}-${typeLabel}_${seq}-${datetime}.${ext}`;
      const key = `lrsync/commission_report_attachments/${safeArea}/CR_${safeReport}/${fileName}`;

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

      // Add a 1 second delay before next upload (except after last file)
      if (i < files.length - 1) {
        await new Promise((res) => setTimeout(res, 1000));
      }
    }

    return NextResponse.json({ files: uploaded });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
