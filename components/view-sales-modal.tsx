"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink, Eye, FileText, Image as ImageIcon } from "lucide-react"
import { format } from "date-fns"
import type { Sales } from "@/types/sales"
import { useAuth } from "@/contexts/auth-context"

interface ViewSalesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sale: Sales | null
}

export function ViewSalesModal({ open, onOpenChange, sale }: ViewSalesModalProps) {
  const { profile } = useAuth()
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxImages, setLightboxImages] = useState<{ url: string; label: string }[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)

  // Format TIN display - add dash after every 3 digits
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
        return "bg-blue-100 text-blue-800"
      case "non-vat":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
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

  const getFilesArray = (fileProp: any): string[] => {
    if (!fileProp) return []
    if (Array.isArray(fileProp)) return fileProp.filter(Boolean)
    if (typeof fileProp === "string" && fileProp.trim() !== "") {
      try {
        const parsed = JSON.parse(fileProp)
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [fileProp]
      } catch {
        return [fileProp]
      }
    }
    return []
  }

  // Gather all image files across all categories for lightbox navigation
  const getAllImageFiles = () => {
    if (!sale) return []
    const categories = [
      { key: "cheque", label: "Cheque" },
      { key: "voucher", label: "Voucher" },
      { key: "invoice", label: "Invoice" },
      { key: "doc_2307", label: "Doc 2307" },
      { key: "deposit_slip", label: "Deposit Slip" },
    ]

    const allImages: { url: string; label: string }[] = []
    categories.forEach(({ key, label }) => {
      const urls = getFilesArray(sale[key as keyof Sales])
      urls.forEach((url, i) => {
        if (isImageFile(url)) {
          allImages.push({
            url,
            label: `${label} ${urls.length > 1 ? i + 1 : ""}`.trim(),
          })
        }
      })
    })
    return allImages
  }

  const openImageInLightbox = (targetUrl: string) => {
    const allImages = getAllImageFiles()
    const targetIdx = allImages.findIndex((img) => img.url === targetUrl)
    setLightboxImages(allImages)
    setLightboxIndex(targetIdx >= 0 ? targetIdx : 0)
    setLightboxOpen(true)
  }

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

  // Log view action when modal opens
  useEffect(() => {
    if (open && sale) {
      ;(async () => {
        try {
          const { supabase } = await import("@/lib/supabase/client")
          await supabase.rpc("log_notification", {
            p_action: "sales_viewed",
            p_description: `Sales record viewed for ${sale.name} (TIN: ${sale.tin})`,
            p_ip_address: "",
            p_location: null,
            p_user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "",
            p_meta: { saleId: sale.id, viewedBy: profile?.full_name || "", role: profile?.role || "" },
          })
        } catch (err) {
          // Silent fail for logging
        }
      })()
    }
  }, [open, sale, profile])

  if (!sale) return null

  const chequeFiles = getFilesArray(sale.cheque)
  const voucherFiles = getFilesArray(sale.voucher)
  const invoiceFiles = getFilesArray(sale.invoice)
  const doc2307Files = getFilesArray(sale.doc_2307)
  const depositSlipFiles = getFilesArray(sale.deposit_slip)

  const hasAnyAttachments =
    chequeFiles.length > 0 ||
    voucherFiles.length > 0 ||
    invoiceFiles.length > 0 ||
    doc2307Files.length > 0 ||
    depositSlipFiles.length > 0

  const renderFileCategory = (label: string, filesList: string[]) => {
    if (filesList.length === 0) return null

    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-[#001f3f]">
          {label} ({filesList.length})
        </label>
        <div className="space-y-1.5">
          {filesList.map((url, index) => {
            const isImg = isImageFile(url)
            const isPdf = isPdfFile(url)
            const typeLabel = getFileTypeLabel(url)

            return (
              <div
                key={index}
                className="flex items-center justify-between p-2 rounded border border-gray-200 bg-gray-50/50 hover:bg-gray-100/80 transition-colors gap-2"
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  {isImg ? (
                    <ImageIcon className="h-4 w-4 text-blue-600 shrink-0" />
                  ) : (
                    <FileText className="h-4 w-4 text-red-600 shrink-0" />
                  )}
                  <span className="text-xs font-medium text-gray-800 truncate" title={url.split("/").pop()}>
                    {label} {index + 1}
                  </span>
                  <span className="text-[10px] uppercase font-semibold px-1 py-0.2 rounded bg-gray-200 text-gray-700 shrink-0">
                    {typeLabel}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isImg ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs bg-white text-blue-700 border-blue-200 hover:bg-blue-50"
                        onClick={() => openImageInLightbox(url)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Preview
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-1.5 text-gray-600 hover:text-blue-600"
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
                      className="h-7 px-2 text-xs bg-white text-[#001f3f] border-gray-300 hover:bg-gray-50"
                      onClick={() => window.open(url, "_blank")}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Open {isPdf ? "PDF" : "File"}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white text-[#001f3f]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Sales Record Details
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-[#001f3f]">Tax Month</label>
                  <div className="text-lg font-semibold">
                    {sale.tax_month ? format(new Date(sale.tax_month), "MMMM yyyy") : "N/A"}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-[#001f3f]">TIN</label>
                  <div className="text-lg font-mono">{formatTin(sale.tin || "")}</div>
                </div>

                <div>
                  <label className="text-sm font-medium text-[#001f3f]">Name</label>
                  <div className="text-lg font-semibold">{sale.name}</div>
                </div>

                <div>
                  <label className="text-sm font-medium text-[#001f3f]">Tax Type</label>
                  <div>
                    <Badge className={getTaxTypeBadgeColor(sale.tax_type)}>{sale.tax_type?.toUpperCase()}</Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-[#001f3f]">Gross Taxable</label>
                  <div className="text-lg font-semibold text-green-600">{formatCurrency(sale.gross_taxable || 0)}</div>
                </div>

                <div>
                  <label className="text-sm font-medium text-[#001f3f]">Invoice Number</label>
                  <div className="text-lg">{sale.invoice_number || "N/A"}</div>
                </div>

                <div>
                  <label className="text-sm font-medium text-[#001f3f]">Pickup Date</label>
                  <div className="text-lg">
                    {sale.pickup_date ? format(new Date(sale.pickup_date), "MMM dd, yyyy") : "N/A"}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-[#001f3f]">Date Added</label>
                  <div className="text-lg">
                    {sale.created_at ? format(new Date(sale.created_at), "MMM dd, yyyy") : "N/A"}
                  </div>
                </div>
              </div>
            </div>

            {/* Address Information */}
            {(sale.substreet_street_brgy || sale.district_city_zip) && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[#001f3f]">Address Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sale.substreet_street_brgy && (
                    <div>
                      <label className="text-sm font-medium text-[#001f3f]">Substreet/Street/Barangay</label>
                      <div className="text-base">{sale.substreet_street_brgy}</div>
                    </div>
                  )}
                  {sale.district_city_zip && (
                    <div>
                      <label className="text-sm font-medium text-[#001f3f]">District/City/ZIP</label>
                      <div className="text-base">{sale.district_city_zip}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* File Attachments */}
            <div className="space-y-4 pt-2 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-[#001f3f] flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                File Attachments
              </h3>
              {!hasAnyAttachments ? (
                <p className="text-sm text-gray-500 italic">No file attachments for this sales record.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {renderFileCategory("Cheque", chequeFiles)}
                  {renderFileCategory("Voucher", voucherFiles)}
                  {renderFileCategory("Invoice", invoiceFiles)}
                  {renderFileCategory("Doc 2307", doc2307Files)}
                  {renderFileCategory("Deposit Slip", depositSlipFiles)}
                </div>
              )}
            </div>

            {/* User Information */}
            {sale.user_full_name && (
              <div className="space-y-2 pt-4 border-t">
                <label className="text-sm font-medium text-[#001f3f]">Added by</label>
                <div className="text-base">{sale.user_full_name}</div>
              </div>
            )}
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
