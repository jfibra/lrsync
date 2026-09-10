import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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

function generate8DigitNumber() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      fileName: rawFileName,
      fileType, // e.g. "application/pdf" or "image/jpeg"
      category = "sales", // "sales" | "purchases"
      // Sales metadata
      taxMonth,
      tin,
      attachmentType = "attachment",
      existingCount = 0,
      // Purchases metadata
      tinName = "Unknown",
      tinNumber = "Unknown",
      assignedArea = "Unknown",
      userFullName = "Unknown",
    } = body;

    const ext = rawFileName ? rawFileName.split(".").pop() || "dat" : "dat";
    const contentType = fileType || "application/octet-stream";

    let s3Key = "";
    let finalFileName = "";

    if (category === "purchases") {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const date = String(now.getDate()).padStart(2, "0");

      const orNumber = generate8DigitNumber();
      const safeTinName = tinName.replace(/[^\w\s\-]/g, "").replace(/\s+/g, " ").trim();
      const safeTinNumber = tinNumber.replace(/[^\w\-]/g, "");
      const safeAssignedArea = assignedArea.replace(/[^\w\s\-]/g, "").replace(/\s+/g, " ").trim();
      const safeUserFullName = userFullName.replace(/[^\w\s\-]/g, "").replace(/\s+/g, " ").trim();

      finalFileName = `OR ${orNumber} - ${safeTinName} - ${safeTinNumber} (${safeAssignedArea} - ${safeUserFullName}).${ext}`;
      s3Key = `lrsync/purchases/${year}/${month}/${date}/${finalFileName}`;
    } else {
      // Sales category
      let year = "";
      let month = "";
      let date = "";

      if (taxMonth && taxMonth.includes("-")) {
        const d = new Date(taxMonth);
        if (!isNaN(d.getTime())) {
          year = d.getFullYear().toString();
          month = String(d.getMonth() + 1).padStart(2, "0");
          date = String(d.getDate()).padStart(2, "0");
        }
      }

      if (!year || !month || !date) {
        const now = new Date();
        year = now.getFullYear().toString();
        month = String(now.getMonth() + 1).padStart(2, "0");
        date = String(now.getDate()).padStart(2, "0");
      }

      const cleanTin = (tin || "000000000").replace(/[^0-9]/g, "") || "000000000";
      const uniqueId = uuidv4();
      const now = new Date();
      const dateStr = format(now, "MMddyyyy-HHmmss");
      const seq = Number(existingCount) || 0;

      finalFileName =
        seq > 0
          ? `${cleanTin}-${attachmentType}-${dateStr}-${uniqueId}-${seq + 1}.${ext}`
          : `${cleanTin}-${attachmentType}-${dateStr}-${uniqueId}.${ext}`;

      s3Key = `lrsync/${year}/${month}/${date}/${finalFileName}`;
    }

    // Generate presigned PUT URL
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      ContentType: contentType,
      ACL: "public-read",
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    const publicUrl = `${PUBLIC_URL.replace(/\/$/, "")}/${s3Key
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/")}`;

    return NextResponse.json({
      uploadUrl,
      publicUrl,
      fileName: finalFileName,
      s3Key,
    });
  } catch (error: any) {
    console.error("Error generating S3 presigned URL:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate S3 upload URL" },
      { status: 500 }
    );
  }
}
