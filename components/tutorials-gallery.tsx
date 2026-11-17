"use client"

import React, { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PlayCircle, Download, Search, Video, Sparkles, ShieldCheck, Receipt, Layout } from "lucide-react"

interface TutorialVideo {
  id: string
  number: string
  title: string
  description: string
  audience: string
  category: "expense" | "executive" | "vouchers" | "navigation"
  src: string
  highlights: string[]
}

const TUTORIAL_VIDEOS: TutorialVideo[] = [
  {
    id: "01",
    number: "01",
    title: "How to Encode Itemized Expense Requests",
    description:
      "Add multiple itemized values (e.g. Petty Cash, Birthday Celebration, Event Venue) and use the 'Not Applicable (TIN 000)' option for internal expenses without a company.",
    audience: "Accounting & Secretaries",
    category: "expense",
    src: "/tutorials/01-encode-itemized-expense-requests.mp4",
    highlights: ["Multiple Items", "TIN Autocomplete", "TIN 000 Option", "S3 Receipt Upload"],
  },
  {
    id: "02",
    number: "02",
    title: "How to Create & Email an Expense Request Invoice",
    description:
      "Select pending itemized expense requests, bundle them into a professional PDF invoice with the Leuterio Realty logo, and email it via SMTP for approval.",
    audience: "Accounting & Secretaries",
    category: "expense",
    src: "/tutorials/02-create-send-expense-invoice.mp4",
    highlights: ["Bundle Items", "Live PDF Preview", "SMTP Email", "Dashboard Sync"],
  },
  {
    id: "03",
    number: "03",
    title: "How to Convert Approved Invoices to Purchases",
    description:
      "Verify the 'Approved & Signed' status and recorded Signed Date, then consolidate the entire invoice into 1 official Purchase record with the signed PDF auto-attached.",
    audience: "Accounting & Secretaries",
    category: "expense",
    src: "/tutorials/03-convert-approved-invoice-to-purchase.mp4",
    highlights: ["Signed Date Check", "1 Consolidated Record", "Auto-attach Signed PDF"],
  },
  {
    id: "04",
    number: "04",
    title: "Two Ways to Sign & Approve Expense Invoices",
    description:
      "Guide for Sir Anthony Leuterio: review and digitally sign invoices either via the 1-click no-login email link or from the exclusive mindworth@gmail.com portal.",
    audience: "Executive Approver (Boss)",
    category: "executive",
    src: "/tutorials/04-executive-approval-signing-guide.mp4",
    highlights: ["No-Login Email Link", "Exclusive Dashboard", "Digital Signature Pad"],
  },
  {
    id: "05",
    number: "05",
    title: "How to Create a Commission Voucher & Search Sales",
    description:
      "Search agent sales across all years, pick the encoded or manual Unit No., choose the Slip Type, and auto-calculate Total for Release and BIR 2307 withholding tax.",
    audience: "Accounting & Secretaries",
    category: "vouchers",
    src: "/tutorials/05-create-commission-voucher-search-sales.mp4",
    highlights: ["All-Years Sale Search", "Unit No. Selector", "5 Slip Formulas"],
  },
  {
    id: "06",
    number: "06",
    title: "How to Crop Attachments & Generate Bondpaper PDF",
    description:
      "Upload PDF or PNG files for Voucher and Header documents, crop the exact region interactively, and generate the single-page A4 bondpaper Commission Slip PDF.",
    audience: "Accounting & Secretaries",
    category: "vouchers",
    src: "/tutorials/06-crop-attachments-generate-bondpaper-pdf.mp4",
    highlights: ["PDF & PNG Cropper", "Rotate & Multi-page", "A4 Bondpaper PDF"],
  },
  {
    id: "07",
    number: "07",
    title: "Navigating the Updated Dashboard on Desktop & Mobile",
    description:
      "Tour of the single-line desktop header, Commissions and Management dropdowns, mobile bottom quick-access bar, and scrollable slide-out navigation drawer.",
    audience: "All Users",
    category: "navigation",
    src: "/tutorials/07-desktop-mobile-navigation-guide.mp4",
    highlights: ["Single-Line Desktop Bar", "Grouped Dropdowns", "Mobile Bottom Bar"],
  },
]

export function TutorialsGallery() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [activeVideo, setActiveVideo] = useState<TutorialVideo | null>(null)

  const filteredVideos = useMemo(() => {
    return TUTORIAL_VIDEOS.filter((vid) => {
      if (selectedCategory !== "all" && vid.category !== selectedCategory) return false
      if (searchTerm.trim() !== "") {
        const q = searchTerm.toLowerCase()
        const match =
          vid.title.toLowerCase().includes(q) ||
          vid.description.toLowerCase().includes(q) ||
          vid.audience.toLowerCase().includes(q) ||
          vid.highlights.some((h) => h.toLowerCase().includes(q))
        if (!match) return false
      }
      return true
    })
  }, [searchTerm, selectedCategory])

  const getCategoryBadgeStyle = (category: TutorialVideo["category"]) => {
    switch (category) {
      case "expense":
        return "bg-sky-100 text-sky-800 border-sky-200"
      case "executive":
        return "bg-amber-100 text-amber-800 border-amber-200"
      case "vouchers":
        return "bg-emerald-100 text-emerald-800 border-emerald-200"
      case "navigation":
        return "bg-purple-100 text-purple-800 border-purple-200"
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#001f3f] via-[#0f3460] to-[#0284c7] rounded-2xl p-6 sm:p-8 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="bg-white/15 backdrop-blur-sm p-3.5 rounded-xl border border-white/20">
              <Video className="w-8 h-8 text-sky-200" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 bg-white/15 text-sky-100 text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Video Training Center &bull; Neural AI Voice-Over
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold">
                LR Accounting Software Tutorials
              </h1>
              <p className="text-sm text-sky-100 mt-1 max-w-2xl">
                Step-by-step video walkthroughs for Expense Requests, Executive Approvals, Commission Vouchers, and Desktop &amp; Mobile Navigation.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: "all", label: "All Tutorials (7)", icon: Video },
            { key: "expense", label: "Expense Requests", icon: Receipt },
            { key: "executive", label: "Executive Approval", icon: ShieldCheck },
            { key: "vouchers", label: "Commission Vouchers", icon: PlayCircle },
            { key: "navigation", label: "Navigation", icon: Layout },
          ].map((tab) => (
            <Button
              key={tab.key}
              size="sm"
              variant={selectedCategory === tab.key ? "default" : "outline"}
              onClick={() => setSelectedCategory(tab.key)}
              className={
                selectedCategory === tab.key
                  ? "bg-[#001f3f] text-white hover:bg-[#001f3f]/90 font-semibold"
                  : "border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
              }
            >
              <tab.icon className="w-3.5 h-3.5 mr-1.5" />
              {tab.label}
            </Button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tutorials..."
            className="pl-9 bg-white text-[#001f3f] border-slate-300"
          />
        </div>
      </div>

      {/* Videos Grid */}
      {filteredVideos.length === 0 ? (
        <Card className="bg-white border-slate-200 p-12 text-center text-slate-500">
          No tutorial videos match your search.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVideos.map((video) => (
            <Card
              key={video.id}
              className="bg-white border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col overflow-hidden group"
            >
              {/* Video Thumbnail / Inline Preview */}
              <div
                onClick={() => setActiveVideo(video)}
                className="relative bg-[#001f3f] aspect-video cursor-pointer overflow-hidden"
              >
                <video
                  src={`${video.src}#t=0.5`}
                  preload="metadata"
                  muted
                  playsInline
                  className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-white/95 text-[#001f3f] flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                    <PlayCircle className="w-8 h-8 text-[#0284c7]" />
                  </div>
                </div>
                <div className="absolute top-3 left-3">
                  <span className="bg-[#001f3f]/90 text-white text-xs font-extrabold px-2.5 py-1 rounded-md border border-white/20">
                    Tutorial #{video.number}
                  </span>
                </div>
              </div>

              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <Badge className={`text-[11px] font-semibold border ${getCategoryBadgeStyle(video.category)}`}>
                    {video.audience}
                  </Badge>
                </div>
                <CardTitle
                  onClick={() => setActiveVideo(video)}
                  className="text-lg font-bold text-[#001f3f] group-hover:text-[#0284c7] transition-colors cursor-pointer"
                >
                  {video.title}
                </CardTitle>
                <CardDescription className="text-xs text-slate-600 leading-relaxed">
                  {video.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-0 mt-auto space-y-4">
                <div className="flex flex-wrap gap-1.5">
                  {video.highlights.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <Button
                    onClick={() => setActiveVideo(video)}
                    className="flex-1 bg-[#001f3f] hover:bg-[#001f3f]/90 text-white font-semibold"
                    size="sm"
                  >
                    <PlayCircle className="w-4 h-4 mr-1.5" />
                    Watch Tutorial
                  </Button>
                  <a href={video.src} download>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-slate-300 text-slate-700 hover:bg-slate-50 bg-white"
                      title="Download MP4"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Theatre Video Player Modal */}
      <Dialog open={Boolean(activeVideo)} onOpenChange={(o) => !o && setActiveVideo(null)}>
        <DialogContent className="max-w-5xl bg-slate-950 text-white border-slate-800 p-4 sm:p-6">
          {activeVideo && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
                  <div>
                    <Badge className="bg-sky-500/20 text-sky-300 border border-sky-400/30 mb-1.5">
                      Tutorial #{activeVideo.number} &bull; {activeVideo.audience}
                    </Badge>
                    <DialogTitle className="text-xl font-bold text-white">
                      {activeVideo.title}
                    </DialogTitle>
                  </div>
                  <a href={activeVideo.src} download>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
                    >
                      <Download className="w-4 h-4 mr-1.5" />
                      Download MP4
                    </Button>
                  </a>
                </div>
              </DialogHeader>

              <div className="mt-2 rounded-xl overflow-hidden bg-black border border-slate-800 shadow-2xl">
                <video
                  key={activeVideo.src}
                  src={activeVideo.src}
                  controls
                  autoPlay
                  playsInline
                  className="w-full aspect-video"
                />
              </div>

              <p className="text-sm text-slate-300 mt-2">{activeVideo.description}</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
