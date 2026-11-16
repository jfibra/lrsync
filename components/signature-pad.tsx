"use client"

import React, { useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Eraser, Upload, PenTool, Check } from "lucide-react"

interface SignaturePadProps {
  value?: string | null
  onChange: (signatureDataUrl: string | null) => void
  signerName?: string
  disabled?: boolean
}

export function SignaturePad({
  value,
  onChange,
  signerName = "ANTHONY GERARD LEUTERIO",
  disabled = false,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(Boolean(value))
  const [penColor, setPenColor] = useState("#001f3f")
  const [mode, setMode] = useState<"draw" | "upload">("draw")

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0 && canvas.width !== rect.width * dpr) {
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)
    }

    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.lineWidth = 2.6
    ctx.strokeStyle = penColor
  }, [penColor, mode])

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()

    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0]
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      }
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled) return
    if ("touches" in e) {
      e.preventDefault()
    }
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    if (canvas.width !== Math.floor(rect.width * dpr)) {
      canvas.width = Math.floor(rect.width * dpr)
      canvas.height = Math.floor(rect.height * dpr)
      ctx.scale(dpr, dpr)
    }

    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.lineWidth = 2.6
    ctx.strokeStyle = penColor

    const { x, y } = getCoordinates(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return
    if ("touches" in e) {
      e.preventDefault()
    }
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return

    const { x, y } = getCoordinates(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasSignature(true)
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (canvas) {
      const dataUrl = canvas.toDataURL("image/png")
      onChange(dataUrl)
    }
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    setHasSignature(false)
    onChange(null)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      if (result) {
        setHasSignature(true)
        onChange(result)
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "draw" ? "default" : "outline"}
            onClick={() => setMode("draw")}
            className={
              mode === "draw"
                ? "bg-[#001f3f] text-white hover:bg-[#001f3f]/90"
                : "border-slate-300 text-slate-700 bg-white"
            }
          >
            <PenTool className="w-3.5 h-3.5 mr-1.5" />
            Draw Signature
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "upload" ? "default" : "outline"}
            onClick={() => setMode("upload")}
            className={
              mode === "upload"
                ? "bg-[#001f3f] text-white hover:bg-[#001f3f]/90"
                : "border-slate-300 text-slate-700 bg-white"
            }
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Upload Image
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {mode === "draw" && (
            <div className="flex items-center gap-1.5 mr-2">
              <span className="text-xs text-slate-500">Ink:</span>
              {[
                { color: "#001f3f", label: "Navy" },
                { color: "#0f172a", label: "Black" },
                { color: "#1d4ed8", label: "Blue" },
              ].map((ink) => (
                <button
                  key={ink.color}
                  type="button"
                  onClick={() => setPenColor(ink.color)}
                  className={`w-5 h-5 rounded-full border-2 transition-transform ${
                    penColor === ink.color ? "scale-125 border-sky-500 shadow" : "border-slate-300"
                  }`}
                  style={{ backgroundColor: ink.color }}
                  title={ink.label}
                />
              ))}
            </div>
          )}

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={clearSignature}
            disabled={disabled || (!hasSignature && !value)}
            className="border-red-200 text-red-600 hover:bg-red-50 bg-white"
          >
            <Eraser className="w-3.5 h-3.5 mr-1.5" />
            Clear
          </Button>
        </div>
      </div>

      {mode === "draw" ? (
        <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-white overflow-hidden shadow-inner">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-44 cursor-crosshair touch-none block"
          />
          {!hasSignature && !value && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-slate-400">
              <PenTool className="w-6 h-6 mb-1 opacity-50" />
              <span className="text-sm font-medium">Sign here with your mouse or finger</span>
            </div>
          )}
          <div className="pointer-events-none absolute bottom-3 left-6 right-6 border-b border-slate-300 flex justify-between items-end pb-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              Authorized Signature: {signerName}
            </span>
            {hasSignature && (
              <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                <Check className="w-3 h-3" /> Captured
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-6 text-center">
          {value ? (
            <div className="space-y-2">
              <img
                src={value}
                alt="Uploaded Signature"
                className="max-h-32 mx-auto object-contain bg-white p-2 rounded border"
              />
              <p className="text-xs text-emerald-600 font-medium">Signature image loaded</p>
            </div>
          ) : (
            <label className="cursor-pointer block py-4">
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <span className="text-sm font-medium text-slate-700 block">
                Click to upload signature image (PNG / JPG)
              </span>
              <span className="text-xs text-slate-500">Transparent PNG recommended</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                disabled={disabled}
              />
            </label>
          )}
        </div>
      )}
    </div>
  )
}
