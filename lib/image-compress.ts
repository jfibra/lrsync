import { PDFDocument, degrees as pdfDegrees } from "pdf-lib"

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
  aiMimeType: "image/jpeg" | null
  mimeType: string
  previewUrl: string | null
  sizeKb: number
  isPdf: boolean
  fileName: string
}

// Shared on-demand PDF.js CDN loader (matches VoucherDocumentCropper)
let pdfJsPromise: Promise<any> | null = null
export function loadPdfJs(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"))
  if ((window as any).pdfjsLib) {
    return Promise.resolve((window as any).pdfjsLib)
  }
  if (pdfJsPromise) return pdfJsPromise

  pdfJsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
    script.async = true
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib
      if (pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
        resolve(pdfjsLib)
      } else {
        reject(new Error("Failed to initialize PDF.js"))
      }
    }
    script.onerror = () => reject(new Error("Failed to load PDF.js script"))
    document.head.appendChild(script)
  })
  return pdfJsPromise
}

/**
 * Renders page 1 of a PDF Blob to a JPEG (max 1600px wide, 0.82 quality) so
 * Perplexity Vision AI can read & auto-fill from PDFs just like image files,
 * while preserving the original PDF Blob for S3 upload.
 */
export async function renderPdfFirstPageToJpeg(
  pdfBlob: Blob,
  maxWidth = 1600,
  quality = 0.82
): Promise<CompressedImageResult | null> {
  try {
    const arrayBuffer = await pdfBlob.arrayBuffer()
    const pdfjsLib = await loadPdfJs()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const page = await pdf.getPage(1)

    const baseViewport = page.getViewport({ scale: 1 })
    const scale = Math.min(2.2, maxWidth / Math.max(1, baseViewport.width))
    const viewport = page.getViewport({ scale: Math.max(1.2, scale) })

    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(viewport.width))
    canvas.height = Math.max(1, Math.round(viewport.height))
    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport }).promise

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PDF page JPEG export failed"))),
        "image/jpeg",
        quality
      )
    })

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ""))
      reader.onerror = () => reject(new Error("Failed to read PDF preview image"))
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
  } catch (err) {
    console.warn("Could not render PDF page 1 for AI/preview:", err)
    return null
  }
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
 * Rotates all pages of a PDF Blob clockwise by 90, 180, or 270 degrees using pdf-lib,
 * returning the updated PDF Blob plus a refreshed page-1 JPEG preview & base64 for AI.
 */
export async function rotatePdfBlob(
  sourceBlob: Blob,
  degrees: 90 | 180 | 270
): Promise<{
  pdfBlob: Blob
  sizeKb: number
  previewUrl: string | null
  base64: string | null
}> {
  const bytes = await sourceBlob.arrayBuffer()
  const pdfDoc = await PDFDocument.load(bytes)
  const pages = pdfDoc.getPages()
  for (const page of pages) {
    const current = page.getRotation().angle || 0
    page.setRotation(pdfDegrees((current + degrees) % 360))
  }
  const rotatedBytes = await pdfDoc.save()
  const pdfBlob = new Blob([new Uint8Array(rotatedBytes)], { type: "application/pdf" })
  const sizeKb = Math.max(1, Math.round(pdfBlob.size / 1024))
  const rendered = await renderPdfFirstPageToJpeg(pdfBlob, 1600, 0.82)

  return {
    pdfBlob,
    sizeKb,
    previewUrl: rendered?.previewUrl || null,
    base64: rendered?.base64 || null,
  }
}

/**
 * Converts a cropped image data URL (e.g. from VoucherDocumentCropper) to a JPEG Blob + preview.
 */
export async function dataUrlToCompressedImage(
  dataUrl: string,
  quality = 0.85
): Promise<CompressedImageResult> {
  const res = await fetch(dataUrl)
  const rawBlob = await res.blob()
  const file = new File([rawBlob], "cropped.jpg", { type: rawBlob.type || "image/png" })
  return compressImageFile(file, 1800, quality)
}

/**
 * Prepares any selected file (image or PDF) for staging:
 * - Images are compressed to JPEG (max 1600px, quality 0.82)
 * - PDFs keep their original PDF Blob for S3 upload AND render page 1 as JPEG
 *   so Perplexity Vision AI can read, tag, auto-fill, and auto-rotate PDFs too!
 */
export async function prepareFileForBatchUpload(file: File): Promise<StagedFileResult> {
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")

  if (isPdf) {
    const rendered = await renderPdfFirstPageToJpeg(file, 1600, 0.82)
    return {
      blob: file,
      base64: rendered?.base64 || null,
      aiMimeType: rendered ? "image/jpeg" : null,
      mimeType: "application/pdf",
      previewUrl: rendered?.previewUrl || null,
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
      aiMimeType: "image/jpeg",
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
    aiMimeType: null,
    mimeType: file.type || "application/octet-stream",
    previewUrl: null,
    sizeKb: Math.max(1, Math.round(file.size / 1024)),
    isPdf: false,
    fileName: file.name,
  }
}
