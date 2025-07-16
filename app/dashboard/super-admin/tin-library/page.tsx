"use client"

import { useState, useEffect } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import type { TaxpayerListing, TaxpayerFormData, TaxpayerType } from "@/types/taxpayer"
import { Search, Edit, Trash2, Plus, CheckCircle, AlertCircle, RefreshCw, FileText } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

const initialFormData: TaxpayerFormData = {
  tin: "",
  registered_name: "",
  substreet_street_brgy: "",
  district_city_zip: "",
  type: "sales",
}

export default function TinLibraryPage() {
  const { user, profile } = useAuth()
  const [taxpayers, setTaxpayers] = useState<TaxpayerListing[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState<TaxpayerType | "all">("all")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Form data
  const [formData, setFormData] = useState<TaxpayerFormData>(initialFormData)
  const [editingTaxpayer, setEditingTaxpayer] = useState<TaxpayerListing | null>(null)

  const fetchTaxpayers = async () => {
    try {
      setLoading(true)
      setError("")

      const { data, error: fetchError } = await supabase
        .from("taxpayer_listings")
        .select("*")
        .order("created_at", { ascending: false })

      if (fetchError) {
        console.error("Fetch error:", fetchError)
        setError("Error fetching taxpayer listings: " + fetchError.message)
        return
      }

      console.log("Fetched taxpayers:", data?.length || 0)
      setTaxpayers(data || [])
    } catch (error: any) {
      console.error("Unexpected error:", error)
      setError("An unexpected error occurred: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTaxpayers()
  }, [])

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 5000)
      return () => clearTimeout(timer)
    }
  }, [success])

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 8000)
      return () => clearTimeout(timer)
    }
  }, [error])

  const filteredTaxpayers = taxpayers.filter((taxpayer) => {
    const matchesSearch =
      taxpayer.tin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      taxpayer.registered_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      taxpayer.substreet_street_brgy?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      taxpayer.district_city_zip?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = filterType === "all" || taxpayer.type === filterType

    return matchesSearch && matchesType
  })

  const validateForm = (data: TaxpayerFormData): string | null => {
    if (!data.tin.trim()) return "TIN is required"
    if (!data.type) return "Type is required"
    if (!data.registered_name.trim()) return "Registered name is required"
    return null
  }

  const handleCreateTaxpayer = async () => {
    try {
      setIsCreating(true)
      setError("")

      const validationError = validateForm(formData)
      if (validationError) {
        setError(validationError)
        return
      }

      // Check if TIN already exists
      const { data: existingTaxpayer, error: checkError } = await supabase
        .from("taxpayer_listings")
        .select("tin")
        .eq("tin", formData.tin.trim())
        .eq("type", formData.type)
        .single()

      if (existingTaxpayer) {
        setError(`A ${formData.type} taxpayer with TIN "${formData.tin}" already exists`)
        return
      }

      if (checkError && checkError.code !== "PGRST116") {
        setError("Error checking existing taxpayers: " + checkError.message)
        return
      }

      const taxpayerData = {
        tin: formData.tin.trim(),
        registered_name: formData.registered_name.trim() || null,
        substreet_street_brgy: formData.substreet_street_brgy.trim() || null,
        district_city_zip: formData.district_city_zip.trim() || null,
        type: formData.type,
        user_uuid: user?.id || null,
        user_full_name: profile?.full_name || null,
      }

      const { data: newTaxpayer, error: insertError } = await supabase
        .from("taxpayer_listings")
        .insert(taxpayerData)
        .select()
        .single()

      if (insertError) {
        console.error("Insert error:", insertError)
        setError("Error creating taxpayer listing: " + insertError.message)
        return
      }

      console.log("Taxpayer created successfully:", newTaxpayer)
      setSuccess(`Taxpayer listing for TIN "${formData.tin}" created successfully!`)
      setIsAddModalOpen(false)
      setFormData(initialFormData)
      fetchTaxpayers()
    } catch (error: any) {
      console.error("Unexpected error:", error)
      setError("An unexpected error occurred: " + error.message)
    } finally {
      setIsCreating(false)
    }
  }

  const handleEditTaxpayer = (taxpayer: TaxpayerListing) => {
    setEditingTaxpayer(taxpayer)
    setFormData({
      tin: taxpayer.tin,
      registered_name: taxpayer.registered_name || "",
      substreet_street_brgy: taxpayer.substreet_street_brgy || "",
      district_city_zip: taxpayer.district_city_zip || "",
      type: taxpayer.type,
    })
    setIsEditModalOpen(true)
  }

  const handleUpdateTaxpayer = async () => {
    try {
      setIsUpdating(true)
      setError("")

      if (!editingTaxpayer) return

      const validationError = validateForm(formData)
      if (validationError) {
        setError(validationError)
        return
      }

      // Check if TIN is being changed and if new TIN already exists
      if (formData.tin.trim() !== editingTaxpayer.tin || formData.type !== editingTaxpayer.type) {
        const { data: existingTaxpayer } = await supabase
          .from("taxpayer_listings")
          .select("id")
          .eq("tin", formData.tin.trim())
          .eq("type", formData.type)
          .neq("id", editingTaxpayer.id)
          .single()

        if (existingTaxpayer) {
          setError(`A ${formData.type} taxpayer with TIN "${formData.tin}" already exists`)
          return
        }
      }

      const updateData = {
        tin: formData.tin.trim(),
        registered_name: formData.registered_name.trim() || null,
        substreet_street_brgy: formData.substreet_street_brgy.trim() || null,
        district_city_zip: formData.district_city_zip.trim() || null,
        type: formData.type,
      }

      const { error: updateError } = await supabase
        .from("taxpayer_listings")
        .update(updateData)
        .eq("id", editingTaxpayer.id)

      if (updateError) {
        setError("Error updating taxpayer listing: " + updateError.message)
        return
      }

      setSuccess("Taxpayer listing updated successfully!")
      setIsEditModalOpen(false)
      setEditingTaxpayer(null)
      setFormData(initialFormData)
      fetchTaxpayers()
    } catch (error: any) {
      setError("An unexpected error occurred: " + error.message)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteTaxpayer = async (taxpayer: TaxpayerListing) => {
    try {
      setIsDeleting(true)
      setError("")

      const { error: deleteError } = await supabase.from("taxpayer_listings").delete().eq("id", taxpayer.id)

      if (deleteError) {
        setError("Error deleting taxpayer listing: " + deleteError.message)
        return
      }

      setSuccess(`Taxpayer listing for TIN "${taxpayer.tin}" deleted successfully!`)
      fetchTaxpayers()
    } catch (error: any) {
      setError("An unexpected error occurred: " + error.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const resetForm = () => {
    setFormData(initialFormData)
    setEditingTaxpayer(null)
    setError("")
    setSuccess("")
  }

  const renderFormFields = () => (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tin">TIN *</Label>
          <Input
            id="tin"
            value={formData.tin}
            onChange={(e) => setFormData({ ...formData, tin: e.target.value })}
            disabled={isCreating || isUpdating}
            placeholder="000-000-000-000"
            maxLength={20}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Type *</Label>
          <Select
            value={formData.type}
            onValueChange={(value: TaxpayerType) => setFormData({ ...formData, type: value })}
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

      <div className="space-y-2">
        <Label htmlFor="registered_name">Registered Name *</Label>
        <Input
          id="registered_name"
          value={formData.registered_name}
          onChange={(e) => setFormData({ ...formData, registered_name: e.target.value })}
          disabled={isCreating || isUpdating}
          placeholder="Company or business name"
          maxLength={255}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="substreet_street_brgy">Substreet/Street/Barangay</Label>
        <Textarea
          id="substreet_street_brgy"
          value={formData.substreet_street_brgy}
          onChange={(e) => setFormData({ ...formData, substreet_street_brgy: e.target.value })}
          disabled={isCreating || isUpdating}
          placeholder="Complete address line"
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="district_city_zip">District/City/ZIP</Label>
        <Input
          id="district_city_zip"
          value={formData.district_city_zip}
          onChange={(e) => setFormData({ ...formData, district_city_zip: e.target.value })}
          disabled={isCreating || isUpdating}
          placeholder="District, City, ZIP code"
        />
      </div>
    </div>
  )

  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />

        <div className="pt-20 px-6 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">TIN Library</h1>
            <p className="text-gray-600 mt-2">Manage taxpayer listings for sales and purchases</p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-4">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Taxpayer Listings ({filteredTaxpayers.length})
                  </CardTitle>
                  <CardDescription>Manage TIN database for sales and purchases tracking</CardDescription>
                </div>

                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search TIN, name, address..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-full sm:w-64"
                    />
                  </div>
                  <Select value={filterType} onValueChange={(value: TaxpayerType | "all") => setFilterType(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="purchases">Purchases</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={fetchTaxpayers} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={resetForm}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Taxpayer
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add New Taxpayer Listing</DialogTitle>
                        <DialogDescription>Create a new taxpayer entry for the TIN library.</DialogDescription>
                      </DialogHeader>
                      <div className="max-h-[60vh] overflow-y-auto px-1">{renderFormFields()}</div>
                      <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsAddModalOpen(false)
                            resetForm()
                          }}
                          disabled={isCreating}
                        >
                          Cancel
                        </Button>
                        <Button onClick={handleCreateTaxpayer} disabled={isCreating}>
                          {isCreating ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Creating...
                            </>
                          ) : (
                            "Create Taxpayer"
                          )}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-500">Loading taxpayer listings...</p>
                </div>
              ) : (
                <>
                  {filteredTaxpayers.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>TIN</TableHead>
                          <TableHead>Registered Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Address</TableHead>
                          <TableHead>Date Added</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTaxpayers.map((taxpayer) => (
                          <TableRow key={taxpayer.id}>
                            <TableCell className="font-mono font-medium">{taxpayer.tin}</TableCell>
                            <TableCell>{taxpayer.registered_name || "N/A"}</TableCell>
                            <TableCell>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  taxpayer.type === "sales"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {taxpayer.type}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-xs">
                                <div className="text-sm">{taxpayer.substreet_street_brgy || "N/A"}</div>
                                <div className="text-xs text-gray-500">{taxpayer.district_city_zip || ""}</div>
                              </div>
                            </TableCell>
                            <TableCell>{new Date(taxpayer.date_added).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button variant="ghost" size="sm" onClick={() => handleEditTaxpayer(taxpayer)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Taxpayer Listing</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete the taxpayer listing for TIN{" "}
                                        <strong>{taxpayer.tin}</strong>? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteTaxpayer(taxpayer)}
                                        className="bg-red-600 hover:bg-red-700"
                                        disabled={isDeleting}
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
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      {searchTerm || filterType !== "all"
                        ? "No taxpayer listings found matching your criteria."
                        : "No taxpayer listings found. Create your first entry!"}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Edit Taxpayer Modal */}
          <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Taxpayer Listing</DialogTitle>
                <DialogDescription>Update taxpayer information and details.</DialogDescription>
              </DialogHeader>
              <div className="max-h-[60vh] overflow-y-auto px-1">{renderFormFields()}</div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditModalOpen(false)
                    resetForm()
                  }}
                  disabled={isUpdating}
                >
                  Cancel
                </Button>
                <Button onClick={handleUpdateTaxpayer} disabled={isUpdating}>
                  {isUpdating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Updating...
                    </>
                  ) : (
                    "Update Taxpayer"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </ProtectedRoute>
  )
}
