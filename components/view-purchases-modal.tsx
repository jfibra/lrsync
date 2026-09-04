"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { useAuth } from "@/contexts/auth-context"
import { ExternalLink, Eye, FileText, Image as ImageIcon } from "lucide-react"
import { formatS3Url } from "@/utils/s3-url"

interface Purchase {
  id: string
  tax_month: string
  tin_id: string | null
  tin: string
  name: string
  substreet_street_brgy: string | null
  district_city_zip: string | null
  gross_taxable: number
  invoice_number: string | null
  tax_type: string
  official_receipt?: any
  date_added: string | null
  user_uuid: string | null
  user_full_name: string | null
  remarks: string | null
  created_at: string
}

interface ViewPurchasesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  purchase: Purchase | null
}

export function ViewPurchasesModal({ open, onOpenChange, purchase }: ViewPurchasesModalProps) {
  const { profile } = useAuth()
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxImages, setLightboxImages] = useState<{ url: string; label: string }[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)

  // Format TIN display
  const formatTin = (tin: string) => {
    const digits = tin.replace(/\D/g, "")
    return digits.replace(/(\d{3})(?=\d)/g, "$1-")
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount)
  }

  // Get tax type badge color
  const getTaxTypeBadgeColor = (taxType: string) => {
    switch (taxType) {
      case "vat":
        return "bg-[#3c8dbc]/20 text-[#3c8dbc] border border-[#3c8dbc]/30"
      case "non-vat":
        return "bg-[#ffc107]/20 text-[#ffc107] border border-[#ffc107]/30"
      default:
        return "bg-gray-100 text-gray-800 border border-gray-200"
    }
  }

  const isImageFile = (url: string) => {
    const cleanUrl = url.split("?")[0].toLowerCase()
    return [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"].some((ext) => cleanUrl.endsWith(ext))
  }

  const isPdfFile = (url: string) => {
    const cleanUrl = url.split("?")[0].toLowerCase()
    return cleanUrl.endsWith(".pdf")
  }

  const getFileTypeLabel = (url: string) => {
    if (isPdfFile(url)) return "PDF"
    if (isImageFile(url)) return "IMAGE"
    return "FILE"
  }

  // Parse attached files safely and encode S3 URLs
  const getAttachmentFiles = (): string[] => {
    if (!purchase?.official_receipt) return []
    let rawList: string[] = []
    if (Array.isArray(purchase.official_receipt)) {
      rawList = purchase.official_receipt.filter(Boolean)
    } else if (typeof purchase.official_receipt === "string" && purchase.official_receipt.trim() !== "") {
      try {
        const parsed = JSON.parse(purchase.official_receipt)
        rawList = Array.isArray(parsed) ? parsed.filter(Boolean) : [purchase.official_receipt]
      } catch {
        rawList = [purchase.official_receipt]
      }
    }
    return rawList.map((u) => formatS3Url(u))
  }

  const files = getAttachmentFiles()
  const imageFiles = files
    .filter(isImageFile)
    .map((url, i) => ({
      url,
      label: `Official Receipt Image ${i + 1}`,
    }))

  function LightboxModal({
    images,
    index,
    onClose,
  }: {
    images: { url: string; label: string }[]
    index: number
    onClose: () => void
  }) {
    const [current, setCurrent] = useState(index)
    const [zoom, setZoom] = useState(1)
    const [rotation, setRotation] = useState(0)
    const [offset, setOffset] = useState({ x: 0, y: 0 })
    const [dragging, setDragging] = useState(false)
    const [start, setStart] = useState<{ x: number; y: number } | null>(null)

    const currentImage = images[current]

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "ArrowLeft") {
          setCurrent((prev) => (prev === 0 ? images.length - 1 : prev - 1))
        } else if (e.key === "ArrowRight") {
          setCurrent((prev) => (prev === images.length - 1 ? 0 : prev + 1))
        } else if (e.key === "Escape") {
          onClose()
        }
      }
      window.addEventListener("keydown", handleKeyDown)
      return () => window.removeEventListener("keydown", handleKeyDown)
    }, [images.length, onClose])

    useEffect(() => {
      setZoom(1)
      setRotation(0)
      setOffset({ x: 0, y: 0 })
    }, [current, index, images])

    const handleMouseDown = (e: React.MouseEvent) => {
      if (zoom === 1) return
      setDragging(true)
      setStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
    }
    const handleMouseMove = (e: React.MouseEvent) => {
      if (!dragging || zoom === 1) return
      setOffset({
        x: e.clientX - (start?.x ?? 0),
        y: e.clientY - (start?.y ?? 0),
      })
    }
    const handleMouseUp = () => setDragging(false)

    const handlePrev = () => setCurrent((prev) => (prev === 0 ? images.length - 1 : prev - 1))
    const handleNext = () => setCurrent((prev) => (prev === images.length - 1 ? 0 : prev + 1))
    const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 3))
    const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 1))
    const handleRotate = () => setRotation((r) => r + 90)
    const handleReset = () => {
      setZoom(1)
      setRotation(0)
      setOffset({ x: 0, y: 0 })
    }

    if (!currentImage) return null

    return (
      <div
        className="fixed inset-0 z-[9999] bg-black bg-opacity-95 overflow-hidden flex items-center justify-center"
        style={{ touchAction: "none" }}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      >
        <button
          className="absolute top-6 right-6 text-white text-3xl z-20"
          onClick={onClose}
          aria-label="Close"
          style={{ lineHeight: 1 }}
        >
          ×
        </button>

        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex gap-2 bg-black bg-opacity-60 rounded-lg px-4 py-2">
          {images.length > 1 && (
            <>
              <button onClick={handlePrev} className="text-white px-2 py-1 rounded hover:bg-gray-700">&lt;</button>
              <button onClick={handleNext} className="text-white px-2 py-1 rounded hover:bg-gray-700">&gt;</button>
            </>
          )}
          <button onClick={handleZoomIn} className="text-white px-2 py-1 rounded hover:bg-gray-700">Zoom In</button>
          <button onClick={handleZoomOut} className="text-white px-2 py-1 rounded hover:bg-gray-700">Zoom Out</button>
          <button onClick={handleRotate} className="text-white px-2 py-1 rounded hover:bg-gray-700">Rotate</button>
          <button onClick={handleReset} className="text-white px-2 py-1 rounded hover:bg-gray-700">Reset</button>
          <a
            href={currentImage.url}
            download
            className="text-white px-2 py-1 rounded hover:bg-gray-700"
            target="_blank"
            rel="noopener noreferrer"
          >
            Download
          </a>
        </div>

        <div className="absolute inset-0 flex items-center justify-center select-none">
          <img
            src={currentImage.url}
            alt={currentImage.label}
            className="max-w-[90vw] max-h-[80vh] object-contain"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              transition: dragging ? "none" : "transform 0.2s",
              cursor: zoom > 1 ? "grab" : "default",
              userSelect: "none",
            }}
            draggable={false}
            onMouseDown={handleMouseDown}
          />
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white bg-black bg-opacity-60 rounded px-3 py-1 z-20 text-sm">
            {currentImage.label} {images.length > 1 && `(${current + 1} of ${images.length})`}
          </div>
        </div>
      </div>
    )
  }

  if (!purchase) return null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white text-[#001f3f]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#001f3f]">Purchase Record Details</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-[#001f3f]">Tax Month</label>
                  <div className="text-lg font-semibold text-[#001f3f]">
                    {purchase.tax_month ? format(new Date(purchase.tax_month), "MMMM yyyy") : "N/A"}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-[#001f3f]">TIN</label>
                  <div className="text-lg font-mono text-[#001f3f]">{formatTin(purchase.tin || "")}</div>
                </div>

                <div>
                  <label className="text-sm font-medium text-[#001f3f]">Name</label>
                  <div className="text-lg font-semibold text-[#001f3f]">{purchase.name}</div>
                </div>

                <div>
                  <label className="text-sm font-medium text-[#001f3f]">Tax Type</label>
                  <div>
                    <Badge className={getTaxTypeBadgeColor(purchase.tax_type)}>{purchase.tax_type?.toUpperCase()}</Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-[#001f3f]">Gross Taxable</label>
                  <div className="text-lg font-semibold text-[#dc3545]">
                    {formatCurrency(purchase.gross_taxable || 0)}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-[#001f3f]">Invoice Number</label>
                  <div className="text-lg text-[#001f3f]">{purchase.invoice_number || "N/A"}</div>
                </div>

                <div>
                  <label className="text-sm font-medium text-[#001f3f]">Date Added</label>
                  <div className="text-lg text-[#001f3f]">
                    {purchase.date_added ? format(new Date(purchase.date_added), "MMM dd, yyyy") : "N/A"}
                  </div>
                </div>
              </div>
            </div>

            {/* Address Information */}
            {(purchase.substreet_street_brgy || purchase.district_city_zip) && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[#001f3f]">Address Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {purchase.substreet_street_brgy && (
                    <div>
                      <label className="text-sm font-medium text-[#001f3f]">Substreet/Street/Barangay</label>
                      <div className="text-base text-[#001f3f]">{purchase.substreet_street_brgy}</div>
                    </div>
                  )}
                  {purchase.district_city_zip && (
                    <div>
                      <label className="text-sm font-medium text-[#001f3f]">District/City/ZIP</label>
                      <div className="text-base text-[#001f3f]">{purchase.district_city_zip}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* File Attachments Section */}
            <div className="space-y-4 pt-2 border-t border-[#001f3f]/10">
              <h3 className="text-lg font-semibold text-[#001f3f] flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#3c8dbc]" />
                File Attachments ({files.length})
              </h3>
              {files.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No attachments uploaded for this purchase record.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {files.map((url, idx) => {
                    const isImg = isImageFile(url)
                    const isPdf = isPdfFile(url)
                    const filename = decodeURIComponent(url.split("/").pop() || `Attachment ${idx + 1}`)

                    return (
                      <div
                        key={idx}
                        className="flex flex-col justify-between p-3 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-gray-100/80 transition-colors"
                      >
                        <div className="flex items-start gap-2 mb-2">
                          {isImg ? (
                            <ImageIcon className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                          ) : (
                            <FileText className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-gray-900 truncate" title={filename}>
                              {filename}
                            </p>
                            <span className="inline-block mt-1 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">
                              {getFileTypeLabel(url)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 mt-2">
                          {isImg ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="w-full text-xs h-8 bg-white text-blue-700 border-blue-200 hover:bg-blue-50"
                                onClick={() => {
                                  const imgIndex = imageFiles.findIndex((f) => f.url === url)
                                  setLightboxImages(imageFiles)
                                  setLightboxIndex(imgIndex >= 0 ? imgIndex : 0)
                                  setLightboxOpen(true)
                                }}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                Preview
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-gray-600 hover:text-blue-600"
                                onClick={() => window.open(url, "_blank")}
                                title="Open in new tab"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="w-full text-xs h-8 bg-white text-[#001f3f] border-gray-300 hover:bg-gray-50 justify-center"
                              onClick={() => window.open(url, "_blank")}
                            >
                              <ExternalLink className="h-3 w-3 mr-1.5" />
                              Open {isPdf ? "PDF" : "File"}
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Remarks */}
            {purchase.remarks && (
              <div className="space-y-2 pt-2 border-t border-[#001f3f]/10">
                <label className="text-sm font-medium text-[#001f3f]">Remarks</label>
                <div className="text-base text-[#001f3f] bg-[#001f3f]/5 p-3 rounded-md">{purchase.remarks}</div>
              </div>
            )}

            {/* User Information */}
            {purchase.user_full_name && (
              <div className="space-y-2 pt-4 border-t border-[#001f3f]/20">
                <label className="text-sm font-medium text-[#001f3f]">Added by</label>
                <div className="text-base text-[#001f3f]">{purchase.user_full_name}</div>
              </div>
            )}

            {/* Created At */}
            <div className="space-y-2 pt-4 border-t border-[#001f3f]/20">
              <label className="text-sm font-medium text-[#001f3f]">Created At</label>
              <div className="text-base text-[#001f3f]">
                {format(new Date(purchase.created_at), "MMM dd, yyyy 'at' hh:mm a")}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <LightboxModal
          images={lightboxImages}
          index={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  )
}
