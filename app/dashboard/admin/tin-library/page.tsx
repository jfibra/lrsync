"use client"

import { useEffect, useMemo, useState } from "react"

import { ProtectedRoute } from "@/components/protected-route"
import { DashboardHeader } from "@/components/dashboard-header"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

import type { TaxpayerFormData, TaxpayerListing, TaxpayerType } from "@/types/taxpayer"

import {
  AlertCircle,
  Building2,
  CheckCircle,
  Edit,
  FileText,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react"

////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

const initialFormData: TaxpayerFormData = {
  tin: "",
  registered_name: "",
  substreet_street_brgy: "",
  district_city_zip: "",
  type: "sales",
}

const formatTin = (tin: string) => (tin ? tin.replace(/-/g, "").replace(/(\d{3})(?=\d)/g, "$1-") : "")

////////////////////////////////////////////////////////////////////////////////
// Component
////////////////////////////////////////////////////////////////////////////////

export default function AdminTinLibraryPage() {
  const { user, profile } = useAuth()

  // ──────────────────────────────────────────────────────────────────────────
  // State
  // ──────────────────────────────────────────────────────────────────────────
  const [taxpayers, setTaxpayers] = useState<TaxpayerListing[]>([])
  const [areas, setAreas] = useState<string[]>([])

  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState<TaxpayerType | "all">("all")
  const [filterArea, setFilterArea] = useState<string>("all")

  const [formData, setFormData] = useState<TaxpayerFormData>(initialFormData)
  const [editingTaxpayer, setEditingTaxpayer] = useState<TaxpayerListing | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)

  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // ──────────────────────────────────────────────────────────────────────────
  // Effects
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchTaxpayers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(""), 6_000)
      return () => clearTimeout(t)
    }
  }, [error])

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 4_000)
      return () => clearTimeout(t)
    }
  }, [success])

  // ──────────────────────────────────────────────────────────────────────────
  // Derived data
  // ──────────────────────────────────────────────────────────────────────────
  const filteredTaxpayers = useMemo(() => {
    return taxpayers.filter((taxpayer) => {
      const matchesSearch =
        taxpayer.tin.toLowerCase().includes(searchTerm.toLowerCase()) ||
        taxpayer.registered_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        taxpayer.substreet_street_brgy?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        taxpayer.district_city_zip?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesType = filterType === "all" || taxpayer.type === filterType
      const matchesArea = filterArea === "all" || taxpayer.user_profiles?.assigned_area === filterArea

      return matchesSearch && matchesType && matchesArea
    })
  }, [taxpayers, searchTerm, filterType, filterArea])

  // Simple stats
  const stats = useMemo(
    () => ({
      total: taxpayers.length,
      sales: taxpayers.filter((t) => t.type === "sales").length,
      purchases: taxpayers.filter((t) => t.type === "purchases").length,
    }),
    [taxpayers],
  )

  // ──────────────────────────────────────────────────────────────────────────
  // Networking
  // ──────────────────────────────────────────────────────────────────────────
  async function fetchTaxpayers() {
    try {
      setLoading(true)
      setError("")

      const { data: taxpayersData, error: tErr } = await supabase
        .from("taxpayer_listings")
        .select("*")
        .order("created_at", { ascending: false })

      if (tErr) throw tErr

      const { data: profiles, error: pErr } = await supabase.from("user_profiles").select("auth_user_id, assigned_area")

      if (pErr) throw pErr

      const areaMap = new Map(profiles?.map((p) => [p.auth_user_id, p.assigned_area]) || [])
      const result: TaxpayerListing[] =
        taxpayersData?.map((t) => ({
          ...t,
          user_profiles: t.user_uuid
            ? {
                assigned_area: areaMap.get(t.user_uuid) ?? null,
              }
            : null,
        })) ?? []

      setTaxpayers(result)

      // unique areas
      setAreas([...new Set(result.map((t) => t.user_profiles?.assigned_area).filter(Boolean) as string[])].sort())
    } catch (err: any) {
      setError(`Error fetching taxpayers: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CRUD helpers
  // ──────────────────────────────────────────────────────────────────────────
  const validateForm = (data: TaxpayerFormData): string | null => {
    if (!data.tin.trim()) return "TIN is required"
    if (!data.registered_name.trim()) return "Registered name is required"
    return null
  }

  async function handleCreate() {
    try {
      setIsCreating(true)
      setError("")

      const validationError = validateForm(formData)
      if (validationError) {
        setError(validationError)
        return
      }

      // Prevent duplicates
      const { data: existing } = await supabase
        .from("taxpayer_listings")
        .select("id")
        .eq("tin", formData.tin.trim())
        .eq("type", formData.type)
        .maybeSingle()

      if (existing) {
        setError(`A ${formData.type} taxpayer with TIN "${formData.tin}" already exists`)
        return
      }

      const payload = {
        tin: formData.tin.trim(),
        registered_name: formData.registered_name.trim(),
        substreet_street_brgy: formData.substreet_street_brgy.trim() || null,
        district_city_zip: formData.district_city_zip.trim() || null,
        type: formData.type,
        user_uuid: user?.id ?? null,
        user_full_name: profile?.full_name ?? null,
      }

      const { error: insertErr } = await supabase.from("taxpayer_listings").insert(payload)
      if (insertErr) throw insertErr

      setSuccess("Taxpayer created successfully!")
      setIsAddOpen(false)
      resetForm()
      fetchTaxpayers()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsCreating(false)
    }
  }

  async function handleUpdate() {
    if (!editingTaxpayer) return
    try {
      setIsUpdating(true)
      setError("")

      const validationError = validateForm(formData)
      if (validationError) {
        setError(validationError)
        return
      }

      // Duplicate check if TIN changed
      const changedTin = formData.tin.trim() !== editingTaxpayer.tin || formData.type !== editingTaxpayer.type
      if (changedTin) {
        const { data: existing } = await supabase
          .from("taxpayer_listings")
          .select("id")
          .eq("tin", formData.tin.trim())
          .eq("type", formData.type)
          .neq("id", editingTaxpayer.id)
          .maybeSingle()

        if (existing) {
          setError(`A ${formData.type} taxpayer with TIN "${formData.tin}" already exists`)
          return
        }
      }

      const updatePayload = {
        tin: formData.tin.trim(),
        registered_name: formData.registered_name.trim(),
        substreet_street_brgy: formData.substreet_street_brgy.trim() || null,
        district_city_zip: formData.district_city_zip.trim() || null,
        type: formData.type,
      }

      const { error: updateErr } = await supabase
        .from("taxpayer_listings")
        .update(updatePayload)
        .eq("id", editingTaxpayer.id)

      if (updateErr) throw updateErr

      setSuccess("Taxpayer updated successfully!")
      setIsEditOpen(false)
      resetForm()
      fetchTaxpayers()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsUpdating(false)
    }
  }

  async function handleDelete(taxpayer: TaxpayerListing) {
    try {
      setIsDeleting(true)
      setError("")

      const { error: delErr } = await supabase.from("taxpayer_listings").delete().eq("id", taxpayer.id)
      if (delErr) throw delErr

      setSuccess("Taxpayer deleted!")
      fetchTaxpayers()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const resetForm = () => {
    setFormData(initialFormData)
    setEditingTaxpayer(null)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // UI helpers
  // ──────────────────────────────────────────────────────────────────────────
  const renderFormFields = () => (
    <div className="grid gap-6 py-4">
      {/* Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="tin">TIN *</Label>
          <Input
            id="tin"
            placeholder="000-000-000-000"
            maxLength={19}
            value={formatTin(formData.tin)}
            onChange={({ target }) => {
              const num = target.value.replace(/-/g, "")
              if (/^\d*$/.test(num) && num.length <= 15) {
                setFormData((p) => ({ ...p, tin: num }))
              }
            }}
            disabled={isCreating || isUpdating}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Type *</Label>
          <Select
            value={formData.type}
            onValueChange={(v: TaxpayerType) => setFormData((p) => ({ ...p, type: v }))}
            disabled={isCreating || isUpdating}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sales">Sales</SelectItem>
              <SelectItem value="purchases">Purchases</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2 */}
      <div className="space-y-2">
        <Label htmlFor="registered_name">Registered Name *</Label>
        <Input
          id="registered_name"
          value={formData.registered_name}
          onChange={({ target }) => setFormData((p) => ({ ...p, registered_name: target.value }))}
          disabled={isCreating || isUpdating}
        />
      </div>

      {/* Row 3 */}
      <div className="space-y-2">
        <Label htmlFor="substreet_street_brgy">Substreet / Street / Barangay</Label>
        <Textarea
          id="substreet_street_brgy"
          rows={3}
          value={formData.substreet_street_brgy}
          onChange={({ target }) => setFormData((p) => ({ ...p, substreet_street_brgy: target.value }))}
          disabled={isCreating || isUpdating}
        />
      </div>

      {/* Row 4 */}
      <div className="space-y-2">
        <Label htmlFor="district_city_zip">District / City / ZIP</Label>
        <Input
          id="district_city_zip"
          value={formData.district_city_zip}
          onChange={({ target }) => setFormData((p) => ({ ...p, district_city_zip: target.value }))}
          disabled={isCreating || isUpdating}
        />
      </div>
    </div>
  )

  // ──────────────────────────────────────────────────────────────────────────
  // JSX
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
        {/* Sticky header */}
        <DashboardHeader />

        <main className="pt-20 px-4 sm:px-6 lg:px-8 py-8">
          {/* TITLE */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl shadow-lg">
                <FileText className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                TIN Library
              </h1>
            </div>
            <p className="text-gray-600">
              Comprehensive taxpayer identification database management for the admin dashboard
            </p>
          </section>

          {/* STATS */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-gradient-to-r from-emerald-500 to-emerald-600 border-0 shadow-xl">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-emerald-100">Total Taxpayers</p>
                  <p className="text-3xl font-bold text-white">{stats.total}</p>
                </div>
                <Building2 className="h-12 w-12 text-emerald-200" />
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-blue-500 to-blue-600 border-0 shadow-xl">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-blue-100">Sales Records</p>
                  <p className="text-3xl font-bold text-white">{stats.sales}</p>
                </div>
                <Receipt className="h-12 w-12 text-blue-200" />
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-purple-500 to-purple-600 border-0 shadow-xl">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-purple-100">Purchase Records</p>
                  <p className="text-3xl font-bold text-white">{stats.purchases}</p>
                </div>
                <FileText className="h-12 w-12 text-purple-200" />
              </CardContent>
            </Card>
          </section>

          {/* ALERTS */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="mb-6">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* MAIN CARD */}
          <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="border-b bg-gradient-to-r from-gray-50 to-gray-100">
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-gray-900">
                    <FileText className="h-6 w-6 text-emerald-600" />
                    Taxpayer Directory ({filteredTaxpayers.length})
                  </CardTitle>
                  <CardDescription>Manage TIN database for sales and purchases tracking</CardDescription>
                </div>

                {/* TOOLS */}
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  {/* Search */}
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      className="pl-10"
                      placeholder="Search TIN, name, address..."
                      value={searchTerm}
                      onChange={({ target }) => setSearchTerm(target.value)}
                    />
                  </div>

                  {/* Type Filter */}
                  <Select value={filterType} onValueChange={(v) => setFilterType(v as TaxpayerType | "all")}>
                    <SelectTrigger className="sm:w-32">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="purchases">Purchases</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Area Filter */}
                  <Select value={filterArea} onValueChange={(v) => setFilterArea(v)}>
                    <SelectTrigger className="sm:w-40">
                      <SelectValue placeholder="Area" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Areas</SelectItem>
                      {areas.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Refresh */}
                  <Button variant="outline" size="sm" onClick={fetchTaxpayers}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>

                  {/* Add */}
                  <Dialog open={isAddOpen} onOpenChange={(o) => (setIsAddOpen(o), !o && resetForm())}>
                    <DialogTrigger asChild>
                      <Button className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Taxpayer
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add New Taxpayer Listing</DialogTitle>
                        <DialogDescription>Create a new taxpayer entry</DialogDescription>
                      </DialogHeader>
                      {renderFormFields()}
                      <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button variant="outline" onClick={() => setIsAddOpen(false)} disabled={isCreating}>
                          Cancel
                        </Button>
                        <Button onClick={handleCreate} disabled={isCreating}>
                          {isCreating ? "Creating..." : "Create"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mb-4" />
                  Loading data...
                </div>
              ) : filteredTaxpayers.length === 0 ? (
                <div className="text-center py-12">No taxpayer listings found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="min-w-[120px]">TIN</TableHead>
                        <TableHead className="min-w-[180px]">Registered Name</TableHead>
                        <TableHead className="min-w-[80px]">Type</TableHead>
                        <TableHead className="min-w-[250px]">Address</TableHead>
                        <TableHead className="min-w-[100px]">Area</TableHead>
                        <TableHead className="min-w-[120px]">Date Added</TableHead>
                        <TableHead className="min-w-[120px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTaxpayers.map((t) => (
                        <TableRow key={t.id} className="hover:bg-gray-50">
                          <TableCell className="font-mono">{formatTin(t.tin)}</TableCell>
                          <TableCell>{t.registered_name}</TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                t.type === "sales" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {t.type}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs">
                              <div>{t.substreet_street_brgy || "—"}</div>
                              <div className="text-xs text-gray-500">{t.district_city_zip || ""}</div>
                            </div>
                          </TableCell>
                          <TableCell>{t.user_profiles?.assigned_area ?? "—"}</TableCell>
                          <TableCell>{new Date(t.date_added).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {/* EDIT */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingTaxpayer(t)
                                  setFormData({
                                    tin: t.tin,
                                    registered_name: t.registered_name ?? "",
                                    substreet_street_brgy: t.substreet_street_brgy ?? "",
                                    district_city_zip: t.district_city_zip ?? "",
                                    type: t.type,
                                  })
                                  setIsEditOpen(true)
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>

                              {/* DELETE */}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Taxpayer</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete taxpayer&nbsp;
                                      <strong>{formatTin(t.tin)}</strong>? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(t)}
                                      disabled={isDeleting}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      {isDeleting ? "Deleting..." : "Delete"}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>

        {/* EDIT MODAL */}
        <Dialog open={isEditOpen} onOpenChange={(o) => (setIsEditOpen(o), !o && resetForm())}>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Taxpayer Listing</DialogTitle>
              <DialogDescription>Update taxpayer information.</DialogDescription>
            </DialogHeader>
            {renderFormFields()}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button onClick={handleUpdate} disabled={isUpdating}>
                {isUpdating ? "Updating..." : "Update Taxpayer"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  )
}
