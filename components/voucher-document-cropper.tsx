"use client"

import React, { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Crop,
  Maximize2,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Check,
} from "lucide-react"

export interface CroppedAttachmentResult {
  dataUrl: string
  fileName: string
  fileSize: number
  width: number
  height: number
}

interface VoucherDocumentCropperProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  file: File | null
  title?: string
  onCropComplete: (result: CroppedAttachmentResult) => void
}

interface CropRect {
  x: number // percentage 0..100
  y: number // percentage 0..100
  w: number // percentage 0..100
  h: number // percentage 0..100
}

// Helper to load PDF.js from CDN on demand
let pdfJsPromise: Promise<any> | null = null
function loadPdfJs(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject("No window")
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

export function VoucherDocumentCropper({
  open,
  onOpenChange,
  file,
  title = "Crop Document Attachment",
  onCropComplete,
}: VoucherDocumentCropperProps) {
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null)
  const [loadingDoc, setLoadingDoc] = useState(false)
  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [pageNum, setPageNum] = useState(1)
  const [numPages, setNumPages] = useState(1)
  const [rotation, setRotation] = useState(0)

  // Crop box in percentages (0..100) relative to displayed image
  const [crop, setCrop] = useState<CropRect>({ x: 5, y: 5, w: 90, h: 90 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragMode, setDragMode] = useState<"new" | "move" | "nw" | "ne" | "sw" | "se" | null>(null)
  const [dragStart, setDragStart] = useState<{
    mouseX: number
    mouseY: number
    startCrop: CropRect
  } | null>(null)

  const imgRef = useRef<HTMLImageElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Render a specific PDF page to data URL
  const renderPdfPage = async (pdf: any, pageIndex: number, rot: number) => {
    setLoadingDoc(true)
    try {
      const page = await pdf.getPage(pageIndex)
      const viewport = page.getViewport({ scale: 2.2, rotation: rot })
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      canvas.width = viewport.width
      canvas.height = viewport.height
      if (ctx) {
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: ctx, viewport }).promise
      }
      setSourceImageUrl(canvas.toDataURL("image/png"))
      setCrop({ x: 5, y: 5, w: 90, h: 55 })
    } catch (err) {
      console.error("Error rendering PDF page:", err)
      alert("Could not render PDF page.")
    } finally {
      setLoadingDoc(false)
    }
  }

  // Load file when modal opens
  useEffect(() => {
    if (!open || !file) {
      setSourceImageUrl(null)
      setPdfDoc(null)
      setPageNum(1)
      setNumPages(1)
      setRotation(0)
      return
    }

    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")

    if (isPdf) {
      setLoadingDoc(true)
      const reader = new FileReader()
      reader.onload = async (ev) => {
        try {
          const arrayBuffer = ev.target?.result as ArrayBuffer
          const pdfjsLib = await loadPdfJs()
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
          const pdf = await loadingTask.promise
          setPdfDoc(pdf)
          setNumPages(pdf.numPages || 1)
          setPageNum(1)
          await renderPdfPage(pdf, 1, 0)
        } catch (err) {
          console.error("Error loading PDF:", err)
          alert("Failed to load PDF file for cropping.")
          setLoadingDoc(false)
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      setLoadingDoc(true)
      const reader = new FileReader()
      reader.onload = (ev) => {
        setSourceImageUrl(ev.target?.result as string)
        setCrop({ x: 5, y: 5, w: 90, h: 85 })
        setLoadingDoc(false)
      }
      reader.readAsDataURL(file)
    }
  }, [open, file])

  const handlePageChange = async (nextPage: number) => {
    if (!pdfDoc || nextPage < 1 || nextPage > numPages) return
    setPageNum(nextPage)
    await renderPdfPage(pdfDoc, nextPage, rotation)
  }

  const handleRotate = async () => {
    const nextRot = (rotation + 90) % 360
    setRotation(nextRot)
    if (pdfDoc) {
      await renderPdfPage(pdfDoc, pageNum, nextRot)
    } else if (sourceImageUrl) {
      // Rotate regular image via canvas
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        canvas.width = img.height
        canvas.height = img.width
        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.translate(canvas.width / 2, canvas.height / 2)
          ctx.rotate((90 * Math.PI) / 180)
          ctx.drawImage(img, -img.width / 2, -img.height / 2)
          setSourceImageUrl(canvas.toDataURL("image/png"))
        }
      }
      img.src = sourceImageUrl
    }
  }

  const getRelativePercent = (clientX: number, clientY: number) => {
    const container = containerRef.current
    if (!container) return { px: 0, py: 0 }
    const rect = container.getBoundingClientRect()
    const px = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    const py = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))
    return { px, py }
  }

  const startInteraction = (
    e: React.MouseEvent | React.TouchEvent,
    mode: "new" | "move" | "nw" | "ne" | "sw" | "se"
  ) => {
    e.stopPropagation()
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY
    const { px, py } = getRelativePercent(clientX, clientY)

    setIsDragging(true)
    setDragMode(mode)
    if (mode === "new") {
      const initialCrop = { x: px, y: py, w: 1, h: 1 }
      setCrop(initialCrop)
      setDragStart({ mouseX: px, mouseY: py, startCrop: initialCrop })
    } else {
      setDragStart({ mouseX: px, mouseY: py, startCrop: { ...crop } })
    }
  }

  const onMoveInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !dragStart || !dragMode) return
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY
    const { px, py } = getRelativePercent(clientX, clientY)
    const dx = px - dragStart.mouseX
    const dy = py - dragStart.mouseY
    const s = dragStart.startCrop

    if (dragMode === "new") {
      const x = Math.min(dragStart.mouseX, px)
      const y = Math.min(dragStart.mouseY, py)
      const w = Math.max(2, Math.abs(px - dragStart.mouseX))
      const h = Math.max(2, Math.abs(py - dragStart.mouseY))
      setCrop({ x, y, w: Math.min(100 - x, w), h: Math.min(100 - y, h) })
    } else if (dragMode === "move") {
      const nx = Math.max(0, Math.min(100 - s.w, s.x + dx))
      const ny = Math.max(0, Math.min(100 - s.h, s.y + dy))
      setCrop({ ...s, x: nx, y: ny })
    } else if (dragMode === "se") {
      const nw = Math.max(5, Math.min(100 - s.x, s.w + dx))
      const nh = Math.max(5, Math.min(100 - s.y, s.h + dy))
      setCrop({ ...s, w: nw, h: nh })
    } else if (dragMode === "nw") {
      const nx = Math.max(0, Math.min(s.x + s.w - 5, s.x + dx))
      const ny = Math.max(0, Math.min(s.y + s.h - 5, s.y + dy))
      setCrop({
        x: nx,
        y: ny,
        w: s.w + (s.x - nx),
        h: s.h + (s.y - ny),
      })
    } else if (dragMode === "ne") {
      const ny = Math.max(0, Math.min(s.y + s.h - 5, s.y + dy))
      const nw = Math.max(5, Math.min(100 - s.x, s.w + dx))
      setCrop({
        x: s.x,
        y: ny,
        w: nw,
        h: s.h + (s.y - ny),
      })
    } else if (dragMode === "sw") {
      const nx = Math.max(0, Math.min(s.x + s.w - 5, s.x + dx))
      const nh = Math.max(5, Math.min(100 - s.y, s.h + dy))
      setCrop({
        x: nx,
        y: s.y,
        w: s.w + (s.x - nx),
        h: nh,
      })
    }
  }

  const stopInteraction = () => {
    setIsDragging(false)
    setDragMode(null)
  }

  const handleConfirmCrop = () => {
    const img = imgRef.current
    if (!img || !sourceImageUrl) return

    const naturalW = img.naturalWidth
    const naturalH = img.naturalHeight

    const sx = Math.round((crop.x / 100) * naturalW)
    const sy = Math.round((crop.y / 100) * naturalH)
    const sw = Math.max(10, Math.round((crop.w / 100) * naturalW))
    const sh = Math.max(10, Math.round((crop.h / 100) * naturalH))

    const canvas = document.createElement("canvas")
    canvas.width = sw
    canvas.height = sh
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, sw, sh)
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
    }

    const croppedDataUrl = canvas.toDataURL("image/png")
    const approxBytes = Math.round((croppedDataUrl.length * 3) / 4)

    onCropComplete({
      dataUrl: croppedDataUrl,
      fileName: file?.name || "cropped-attachment.png",
      fileSize: approxBytes,
      width: sw,
      height: sh,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[94vh] overflow-y-auto bg-white text-[#001f3f]">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <DialogTitle className="text-xl font-bold text-[#001f3f] flex items-center gap-2">
                <Crop className="w-5 h-5 text-[#0284c7]" />
                {title}
              </DialogTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Drag on the document or adjust the corner handles to crop the area you want to attach onto the bondpaper.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {numPages > 1 && (
                <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg text-xs font-semibold">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    disabled={pageNum <= 1 || loadingDoc}
                    onClick={() => handlePageChange(pageNum - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span>
                    Page {pageNum} / {numPages}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    disabled={pageNum >= numPages || loadingDoc}
                    onClick={() => handlePageChange(pageNum + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setCrop({ x: 0, y: 0, w: 100, h: 100 })}
                className="text-xs border-slate-300 text-slate-700 bg-white"
              >
                <Maximize2 className="w-3.5 h-3.5 mr-1" />
                Full Page
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleRotate}
                className="text-xs border-slate-300 text-slate-700 bg-white"
              >
                <RotateCw className="w-3.5 h-3.5 mr-1" />
                Rotate
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div
          className="bg-slate-900/95 rounded-xl p-4 flex items-center justify-center min-h-[420px] max-h-[68vh] overflow-auto select-none"
          onMouseMove={onMoveInteraction}
          onMouseUp={stopInteraction}
          onMouseLeave={stopInteraction}
          onTouchMove={onMoveInteraction}
          onTouchEnd={stopInteraction}
        >
          {loadingDoc ? (
            <div className="text-center text-white py-16">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-sky-400" />
              <p className="text-sm">Rendering document page for cropping...</p>
            </div>
          ) : sourceImageUrl ? (
            <div
              ref={containerRef}
              onMouseDown={(e) => startInteraction(e, "new")}
              onTouchStart={(e) => startInteraction(e, "new")}
              className="relative inline-block cursor-crosshair shadow-2xl"
            >
              <img
                ref={imgRef}
                src={sourceImageUrl}
                alt="Document to crop"
                draggable={false}
                className="max-w-full max-h-[62vh] w-auto h-auto block select-none pointer-events-none"
              />

              {/* Darkened overlay outside crop */}
              <div
                className="absolute inset-0 bg-black/45 pointer-events-none"
                style={{
                  clipPath: `polygon(0% 0%, 0% 100%, ${crop.x}% 100%, ${crop.x}% ${crop.y}%, ${
                    crop.x + crop.w
                  }% ${crop.y}%, ${crop.x + crop.w}% ${crop.y + crop.h}%, ${crop.x}% ${
                    crop.y + crop.h
                  }%, ${crop.x}% 100%, 100% 100%, 100% 0%)`,
                }}
              />

              {/* Interactive Crop Box */}
              <div
                onMouseDown={(e) => startInteraction(e, "move")}
                onTouchStart={(e) => startInteraction(e, "move")}
                style={{
                  left: `${crop.x}%`,
                  top: `${crop.y}%`,
                  width: `${crop.w}%`,
                  height: `${crop.h}%`,
                }}
                className="absolute border-2 border-sky-400 shadow-[0_0_0_1px_rgba(0,0,0,0.5)] cursor-move"
              >
                {/* Rule of thirds grid lines */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                  <div className="border-r border-b border-white/30" />
                  <div className="border-r border-b border-white/30" />
                  <div className="border-b border-white/30" />
                  <div className="border-r border-b border-white/30" />
                  <div className="border-r border-b border-white/30" />
                  <div className="border-b border-white/30" />
                  <div className="border-r border-white/30" />
                  <div className="border-r border-white/30" />
                  <div />
                </div>

                {/* Corner Handles */}
                <div
                  onMouseDown={(e) => startInteraction(e, "nw")}
                  onTouchStart={(e) => startInteraction(e, "nw")}
                  className="absolute -top-2 -left-2 w-4 h-4 bg-sky-500 border-2 border-white rounded-sm cursor-nwse-resize"
                />
                <div
                  onMouseDown={(e) => startInteraction(e, "ne")}
                  onTouchStart={(e) => startInteraction(e, "ne")}
                  className="absolute -top-2 -right-2 w-4 h-4 bg-sky-500 border-2 border-white rounded-sm cursor-nesw-resize"
                />
                <div
                  onMouseDown={(e) => startInteraction(e, "sw")}
                  onTouchStart={(e) => startInteraction(e, "sw")}
                  className="absolute -bottom-2 -left-2 w-4 h-4 bg-sky-500 border-2 border-white rounded-sm cursor-nesw-resize"
                />
                <div
                  onMouseDown={(e) => startInteraction(e, "se")}
                  onTouchStart={(e) => startInteraction(e, "se")}
                  className="absolute -bottom-2 -right-2 w-4 h-4 bg-sky-500 border-2 border-white rounded-sm cursor-nwse-resize"
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-3 pt-2" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <Button
            type="button"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
              onOpenChange(false)
            }}
            className="border-slate-300 text-slate-700 bg-white"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleConfirmCrop()
            }}
            disabled={!sourceImageUrl || loadingDoc}
            className="bg-[#001f3f] hover:bg-[#001f3f]/90 text-white font-semibold"
          >
            <Check className="w-4 h-4 mr-1.5" />
            Crop &amp; Attach to Voucher
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
