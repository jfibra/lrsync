import { NextRequest, NextResponse } from "next/server"
import { PDFDocument } from "pdf-lib"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const pdfUrls: string[] = Array.isArray(body?.pdfUrls) ? body.pdfUrls : []

    if (pdfUrls.length === 0) {
      return NextResponse.json({ error: "No PDF URLs provided to merge." }, { status: 400 })
    }

    const mergedPdf = await PDFDocument.create()
    let mergedPageCount = 0

    for (const rawUrl of pdfUrls) {
      if (!rawUrl || typeof rawUrl !== "string") continue
      const res = await fetch(rawUrl)
      if (!res.ok) {
        throw new Error(`Failed to fetch PDF (${res.status}): ${rawUrl}`)
      }
      const arrayBuffer = await res.arrayBuffer()
      const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
      const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices())
      for (const page of copiedPages) {
        mergedPdf.addPage(page)
        mergedPageCount++
      }
    }

    if (mergedPageCount === 0) {
      return NextResponse.json({ error: "No valid PDF pages found to merge." }, { status: 400 })
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
