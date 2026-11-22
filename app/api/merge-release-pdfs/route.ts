import { NextRequest, NextResponse } from "next/server"
import { PDFDocument } from "pdf-lib"

const A4_WIDTH = 595.28
const A4_HEIGHT = 841.89
const MARGIN = 24

function detectFileKind(url: string, contentType: string): "pdf" | "png" | "jpg" | "unknown" {
  const ct = (contentType || "").toLowerCase()
  const lowerUrl = url.toLowerCase().split("?")[0]

  if (ct.includes("pdf") || lowerUrl.endsWith(".pdf")) return "pdf"
  if (ct.includes("png") || lowerUrl.endsWith(".png")) return "png"
  if (
    ct.includes("jpeg") ||
    ct.includes("jpg") ||
    lowerUrl.endsWith(".jpg") ||
    lowerUrl.endsWith(".jpeg")
  ) {
    return "jpg"
  }
  return "unknown"
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const pdfUrls: string[] = Array.isArray(body?.pdfUrls) ? body.pdfUrls : []

    if (pdfUrls.length === 0) {
      return NextResponse.json({ error: "No PDF or attachment URLs provided to merge." }, { status: 400 })
    }

    const mergedPdf = await PDFDocument.create()
    let mergedPageCount = 0

    for (const rawUrl of pdfUrls) {
      if (!rawUrl || typeof rawUrl !== "string") continue
      const res = await fetch(rawUrl)
      if (!res.ok) {
        console.warn(`Skipping unreachable attachment (${res.status}): ${rawUrl}`)
        continue
      }

      const contentType = res.headers.get("content-type") || ""
      const arrayBuffer = await res.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      const kind = detectFileKind(rawUrl, contentType)

      if (kind === "pdf") {
        try {
          const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true })
          const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices())
          for (const page of copiedPages) {
            mergedPdf.addPage(page)
            mergedPageCount++
          }
        } catch (pdfErr) {
          console.warn(`Failed to parse PDF attachment ${rawUrl}:`, pdfErr)
        }
      } else if (kind === "png" || kind === "jpg") {
        try {
          const embeddedImage =
            kind === "png" ? await mergedPdf.embedPng(bytes) : await mergedPdf.embedJpg(bytes)
          const page = mergedPdf.addPage([A4_WIDTH, A4_HEIGHT])
          const maxW = A4_WIDTH - MARGIN * 2
          const maxH = A4_HEIGHT - MARGIN * 2
          const scale = Math.min(maxW / embeddedImage.width, maxH / embeddedImage.height, 1)
          const drawW = embeddedImage.width * scale
          const drawH = embeddedImage.height * scale
          const x = (A4_WIDTH - drawW) / 2
          const y = (A4_HEIGHT - drawH) / 2
          page.drawImage(embeddedImage, { x, y, width: drawW, height: drawH })
          mergedPageCount++
        } catch (imgErr) {
          console.warn(`Failed to embed image attachment ${rawUrl}:`, imgErr)
        }
      } else {
        // Fallback: attempt PDF load first, then JPG, then PNG
        let added = false
        try {
          const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true })
          const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices())
          for (const page of copiedPages) {
            mergedPdf.addPage(page)
            mergedPageCount++
          }
          added = true
        } catch {}

        if (!added) {
          try {
            const img = await mergedPdf.embedJpg(bytes)
            const page = mergedPdf.addPage([A4_WIDTH, A4_HEIGHT])
            const scale = Math.min((A4_WIDTH - MARGIN * 2) / img.width, (A4_HEIGHT - MARGIN * 2) / img.height, 1)
            page.drawImage(img, {
              x: (A4_WIDTH - img.width * scale) / 2,
              y: (A4_HEIGHT - img.height * scale) / 2,
              width: img.width * scale,
              height: img.height * scale,
            })
            mergedPageCount++
            added = true
          } catch {}
        }

        if (!added) {
          try {
            const img = await mergedPdf.embedPng(bytes)
            const page = mergedPdf.addPage([A4_WIDTH, A4_HEIGHT])
            const scale = Math.min((A4_WIDTH - MARGIN * 2) / img.width, (A4_HEIGHT - MARGIN * 2) / img.height, 1)
            page.drawImage(img, {
              x: (A4_WIDTH - img.width * scale) / 2,
              y: (A4_HEIGHT - img.height * scale) / 2,
              width: img.width * scale,
              height: img.height * scale,
            })
            mergedPageCount++
          } catch {}
        }
      }
    }

    if (mergedPageCount === 0) {
      return NextResponse.json({ error: "No valid PDF or image pages found to merge." }, { status: 400 })
    }

    const mergedBytes = await mergedPdf.save()

    return new NextResponse(Buffer.from(mergedBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="Merged_Commission_Release.pdf"',
      },
    })
  } catch (error: any) {
    console.error("Error merging release PDFs:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to merge release PDFs." },
      { status: 500 }
    )
  }
}
