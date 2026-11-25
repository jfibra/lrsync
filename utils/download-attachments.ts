import { formatS3Url } from "@/utils/s3-url"

export interface DownloadableAttachment {
  url: string
  name?: string
}

export async function downloadAttachmentsAsZip(
  files: DownloadableAttachment[],
  zipName = "attachments"
): Promise<void> {
  const validFiles = files
    .filter((f) => f && f.url && f.url.trim() !== "")
    .map((f) => ({
      url: formatS3Url(f.url),
      name: f.name,
    }))

  if (validFiles.length === 0) {
    alert("No attachments available to download.")
    return
  }

  const res = await fetch("/api/download-attachments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files: validFiles, zipName }),
  })

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}))
    throw new Error(errJson?.error || `Failed to download attachments (${res.status})`)
  }

  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = blobUrl
  a.download = `${zipName.replace(/[\\/:*?"<>|]+/g, "_").replace(/\.zip$/i, "")}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
}
