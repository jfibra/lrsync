export interface CompressedImageResult {
  blob: Blob
  base64: string
  mimeType: "image/jpeg"
  previewUrl: string
  sizeKb: number
}

export interface StagedFileResult {
  blob: Blob
  base64: string | null
  mimeType: string
  previewUrl: string | null
  sizeKb: number
  isPdf: boolean
  fileName: string
}

/**
 * Compresses an image File via HTMLCanvasElement:
 * - Scales down to max width 1600px (preserving aspect ratio)
 * - Exports as JPEG at 0.82 quality
 */
export async function compressImageFile(
  file: File,
  maxWidth = 1600,
  quality = 0.82
): Promise<CompressedImageResult> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error(`Failed to decode image ${file.name}`))
      el.src = objectUrl
    })

    const naturalW = img.naturalWidth || img.width
    const naturalH = img.naturalHeight || img.height
    const scale = naturalW > maxWidth ? maxWidth / naturalW : 1
    const targetW = Math.max(1, Math.round(naturalW * scale))
    const targetH = Math.max(1, Math.round(naturalH * scale))

    const canvas = document.createElement("canvas")
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      throw new Error("Canvas 2D context unavailable")
    }

    // White background so transparent PNGs convert cleanly to JPEG
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, targetW, targetH)
    ctx.drawImage(img, 0, 0, targetW, targetH)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas JPEG export failed"))),
        "image/jpeg",
        quality
      )
    })

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ""))
      reader.onerror = () => reject(new Error("Failed to read compressed image"))
      reader.readAsDataURL(blob)
    })

    const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl
    const previewUrl = URL.createObjectURL(blob)
    const sizeKb = Math.max(1, Math.round(blob.size / 1024))

    return {
      blob,
      base64,
      mimeType: "image/jpeg",
      previewUrl,
      sizeKb,
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/**
 * Rotates an image Blob clockwise by 90, 180, or 270 degrees on an HTMLCanvasElement
 * (swapping width/height for 90° and 270°) and re-encodes as JPEG at 0.85 quality.
 */
export async function rotateImageBlob(
  sourceBlob: Blob,
  degrees: 90 | 180 | 270,
  quality = 0.85
): Promise<CompressedImageResult> {
  const objectUrl = URL.createObjectURL(sourceBlob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error("Failed to decode image for rotation"))
      el.src = objectUrl
    })

    const w = img.naturalWidth || img.width
    const h = img.naturalHeight || img.height
    const swap = degrees === 90 || degrees === 270

    const canvas = document.createElement("canvas")
    canvas.width = swap ? h : w
    canvas.height = swap ? w : h

    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas 2D context unavailable")

    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate((degrees * Math.PI) / 180)
    ctx.drawImage(img, -w / 2, -h / 2, w, h)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Rotated JPEG export failed"))),
        "image/jpeg",
        quality
      )
    })

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ""))
      reader.onerror = () => reject(new Error("Failed to read rotated image"))
      reader.readAsDataURL(blob)
    })

    const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl
    const previewUrl = URL.createObjectURL(blob)
    const sizeKb = Math.max(1, Math.round(blob.size / 1024))

    return {
      blob,
      base64,
      mimeType: "image/jpeg",
      previewUrl,
      sizeKb,
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/**
 * Prepares any selected file (image or PDF) for staging:
 * - Images are compressed to JPEG (max 1600px, quality 0.82)
 * - PDFs are kept untouched with base64 = null (skipped by vision API, still uploaded to S3)
 */
export async function prepareFileForBatchUpload(file: File): Promise<StagedFileResult> {
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")

  if (isPdf) {
    return {
      blob: file,
      base64: null,
      mimeType: "application/pdf",
      previewUrl: null,
      sizeKb: Math.max(1, Math.round(file.size / 1024)),
      isPdf: true,
      fileName: file.name,
    }
  }

  if (file.type.startsWith("image/")) {
    const compressed = await compressImageFile(file)
    const baseName = file.name.replace(/\.[^.]+$/, "")
    return {
      blob: compressed.blob,
      base64: compressed.base64,
      mimeType: compressed.mimeType,
      previewUrl: compressed.previewUrl,
      sizeKb: compressed.sizeKb,
      isPdf: false,
      fileName: `${baseName}.jpg`,
    }
  }

  return {
    blob: file,
    base64: null,
    mimeType: file.type || "application/octet-stream",
    previewUrl: null,
    sizeKb: Math.max(1, Math.round(file.size / 1024)),
    isPdf: false,
    fileName: file.name,
  }
}
