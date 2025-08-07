import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { Readable } from 'stream';

// Initialize Google Drive API
const initializeDrive = () => {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return google.drive({ version: "v3", auth });
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const reportId = formData.get("reportId") as string;

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    if (!reportId) {
      return NextResponse.json(
        { error: "Report ID is required" },
        { status: 400 }
      );
    }

    const drive = initializeDrive();
    const uploadedFiles = [];

    for (const file of files) {
      try {
        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload file to Google Drive
        const fileMetadata = {
          name: file.name,
          parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
        };

        const media = {
          mimeType: file.type,
          body: Buffer.isBuffer(buffer) ? Readable.from(buffer) : buffer,
        };

        const uploadResponse = await drive.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: "id,name,webViewLink",
        });

        const fileId = uploadResponse.data.id;

        if (!fileId) {
          throw new Error("Failed to get file ID from upload response");
        }

        // Make the file publicly viewable
        await drive.permissions.create({
          fileId: fileId,
          requestBody: {
            role: "reader",
            type: "anyone",
          },
        });

        // Get the file details including webViewLink
        const fileDetails = await drive.files.get({
          fileId: fileId,
          fields: "id,name,webViewLink,webContentLink",
        });

        uploadedFiles.push({
          id: fileId,
          name: fileDetails.data.name,
          webViewLink: fileDetails.data.webViewLink,
          webContentLink: fileDetails.data.webContentLink,
          originalName: file.name,
        });
      } catch (fileError) {
        console.error(`Error uploading file ${file.name}:`, fileError);
        // Continue with other files even if one fails
        uploadedFiles.push({
          name: file.name,
          error: `Failed to upload: ${
            fileError instanceof Error ? fileError.message : "Unknown error"
          }`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      files: uploadedFiles,
      reportId,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        error: "Failed to upload files",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
