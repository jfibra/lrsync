import { NextRequest, NextResponse } from "next/server"

// Standard IEEE 802.3 CRC32 table for valid PKZIP archives (zero external dependencies)
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
})()

function crc32(buf: Buffer): number {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function buildZipBuffer(entries: { name: string; data: Buffer }[]): Buffer {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  const now = new Date()
  const dosTime =
    ((now.getHours() & 0x1f) << 11) |
    ((now.getMinutes() & 0x3f) << 5) |
    ((now.getSeconds() >> 1) & 0x1f)
  const dosDate =
    (((Math.max(1980, now.getFullYear()) - 1980) & 0x7f) << 9) |
    (((now.getMonth() + 1) & 0x0f) << 5) |
    (now.getDate() & 0x1f)

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8")
    const data = entry.data
    const crc = crc32(data)
    const size = data.length

    // Local file header (30 bytes + filename)
    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0) // signature
    localHeader.writeUInt16LE(20, 4) // version needed
    localHeader.writeUInt16LE(0x0800, 6) // UTF-8 flag
    localHeader.writeUInt16LE(0, 8) // method: store (uncompressed)
    localHeader.writeUInt16LE(dosTime, 10)
    localHeader.writeUInt16LE(dosDate, 12)
    localHeader.writeUInt32LE(crc, 14)
    localHeader.writeUInt32LE(size, 18)
    localHeader.writeUInt32LE(size, 22)
    localHeader.writeUInt16LE(nameBuf.length, 26)
    localHeader.writeUInt16LE(0, 28)

    localParts.push(localHeader, nameBuf, data)

    // Central directory header (46 bytes + filename)
    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0) // signature
    centralHeader.writeUInt16LE(20, 4) // version made by
    centralHeader.writeUInt16LE(20, 6) // version needed
    centralHeader.writeUInt16LE(0x0800, 8) // UTF-8 flag
    centralHeader.writeUInt16LE(0, 10) // method: store
    centralHeader.writeUInt16LE(dosTime, 12)
    centralHeader.writeUInt16LE(dosDate, 14)
    centralHeader.writeUInt32LE(crc, 16)
    centralHeader.writeUInt32LE(size, 20)
    centralHeader.writeUInt32LE(size, 24)
    centralHeader.writeUInt16LE(nameBuf.length, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE(0, 38)
    centralHeader.writeUInt32LE(offset, 42)

    centralParts.push(centralHeader, nameBuf)
    offset += localHeader.length + nameBuf.length + data.length
  }

  const centralDir = Buffer.concat(centralParts)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(centralDir.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)

  return Buffer.concat([...localParts, centralDir, eocd])
}

function isAllowedAttachmentUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== "https:") return false
    const host = parsed.hostname.toLowerCase()
    return (
      host.endsWith(".amazonaws.com") ||
      host.endsWith(".supabase.co") ||
      host.endsWith(".leuteriorealty.com") ||
      host.endsWith(".filipinohomes.com")
    )
  } catch {
    return false
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|\r\n]+/g, "_").trim() || "attachment"
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const files: { url: string; name?: string }[] = Array.isArray(body?.files) ? body.files : []
    const zipName = sanitizeFileName(String(body?.zipName || "attachments")).replace(/\.zip$/i, "")

    if (files.length === 0) {
      return NextResponse.json({ error: "No attachment files provided." }, { status: 400 })
    }

    const capped = files.slice(0, 50)
    const entries: { name: string; data: Buffer }[] = []
    const usedNames = new Set<string>()

    for (let i = 0; i < capped.length; i++) {
      const item = capped[i]
      if (!item?.url || !isAllowedAttachmentUrl(item.url)) continue

      try {
        const res = await fetch(item.url)
        if (!res.ok) continue
        const arrBuf = await res.arrayBuffer()
        const buf = Buffer.from(arrBuf)
        if (buf.length === 0) continue

        const urlPath = item.url.split("?")[0]
        const urlFileName = decodeURIComponent(urlPath.split("/").pop() || `file_${i + 1}`)
        const rawName = sanitizeFileName(item.name || urlFileName)
        const dotIdx = rawName.lastIndexOf(".")
        const base = dotIdx > 0 ? rawName.slice(0, dotIdx) : rawName
        const ext = dotIdx > 0 ? rawName.slice(dotIdx) : ""

        let finalName = rawName
        let counter = 2
        while (usedNames.has(finalName.toLowerCase())) {
          finalName = `${base}_${counter}${ext}`
          counter++
        }
        usedNames.add(finalName.toLowerCase())

        entries.push({ name: finalName, data: buf })
      } catch (err) {
        console.warn("Skipping unreadable attachment:", item.url, err)
      }
    }

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "Could not download any of the requested attachments." },
        { status: 404 }
      )
    }

    const zipBuffer = buildZipBuffer(entries)

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipName}.zip"`,
        "Content-Length": String(zipBuffer.length),
      },
    })
  } catch (error: any) {
    console.error("Download attachments ZIP error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to bundle attachments." },
      { status: 500 }
    )
  }
}
