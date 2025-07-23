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
import {
  Search,
  Edit,
  Trash2,
  Plus,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  FileText,
  Building2,
  Receipt,
  MapPin,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

const formatTin = (tin: string): string => {
  if (!tin) return ""
  // Remove any existing dashes and format with dashes after every 3 digits
  const cleanTin = tin.replace(/-/g, "")
  return cleanTin.replace(/(\d{3})(?=\d)/g, "$1-")
}

const initialFormData: TaxpayerFormData = {
  tin: "",
  registered_name: "",
  substreet_street_brgy: "",
  district_city_zip: "",
  type: "sales",
}

export default function SecretaryTinLibraryPage() {
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

      if (!profile?.assigned_area) {
        console.log("No assigned area found for secretary")
        setTaxpayers([])
        return
      }

      // Fetch taxpayers first
      const { data: taxpayersData, error: fetchError } = await supabase
        .from("taxpayer_listings")
        .select("*")
        .order("created_at", { ascending: false })

      if (fetchError) {
        console.error("Fetch error:", fetchError)
        setError("Error fetching taxpayer listings: " + fetchError.message)
        return
      }

      // Fetch user profiles separately using the correct column name
      const { data: userProfiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select("auth_user_id, assigned_area")

      if (profilesError) {
        console.error("Profiles fetch error:", profilesError)
        setError("Error fetching user profiles: " + profilesError.message)
        return
      }

      // Create a map of auth_user_id to assigned_area for quick lookup
      const userAreaMap = new Map(userProfiles?.map((profile) => [profile.auth_user_id, profile.assigned_area]) || [])

      // Combine the data - match user_uuid from taxpayer_listings with auth_user_id from user_profiles
      const taxpayersWithAreas =
        taxpayersData?.map((taxpayer) => ({
          ...taxpayer,
          user_profiles: taxpayer.user_uuid
            ? {
                assigned_area: userAreaMap.get(taxpayer.user_uuid) || null,
              }
            : null,
        })) || []

      // Filter to only show taxpayers from the secretary's assigned area
      const filteredTaxpayers = taxpayersWithAreas.filter(
        (taxpayer) => taxpayer.user_profiles?.assigned_area === profile.assigned_area,
      )

      console.log("Fetched taxpayers for area:", profile.assigned_area, filteredTaxpayers?.length || 0)
      setTaxpayers(filteredTaxpayers)
    } catch (error: any) {
      console.error("Unexpected error:", error)
      setError("An unexpected error occurred: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (profile?.assigned_area) {
      fetchTaxpayers()
    }
  }, [profile?.assigned_area])

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
    <div className="space-y-6">
      {/* TIN and Type Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="tin" className="text-sm font-medium text-gray-700">
              TIN Number *
            </Label>
            <Input
              id="tin"
              value={formatTin(formData.tin)}
              onChange={(e) => {
                const cleanValue = e.target.value.replace(/-/g, "")
                if (cleanValue.length <= 15 && /^\d*$/.test(cleanValue)) {
                  setFormData({ ...formData, tin: cleanValue })
                }
              }}
              disabled={isCreating || isUpdating}
              placeholder="000-000-000-000"
              maxLength={19} // 15 digits + 4 dashes
              className="border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type" className="text-sm font-medium text-gray-700">
              Taxpayer Type *
            </Label>
            <Select
              value={formData.type}
              onValueChange={(value: TaxpayerType) => setFormData({ ...formData, type: value })}
              disabled={isCreating || isUpdating}
            >
              <SelectTrigger className="border-gray-300 focus:border-emerald-500 focus:ring-emerald-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="purchases">Purchases</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Company Information Section */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg border border-green-200">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Company Information</h4>
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="registered_name" className="text-sm font-medium text-gray-700">
              Registered Name *
            </Label>
            <Input
              id="registered_name"
              value={formData.registered_name}
              onChange={(e) => setFormData({ ...formData, registered_name: e.target.value })}
              disabled={isCreating || isUpdating}
              placeholder="Company or business name"
              maxLength={255}
              className="border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="substreet_street_brgy" className="text-sm font-medium text-gray-700">
              Substreet/Street/Barangay
            </Label>
            <Textarea
              id="substreet_street_brgy"
              value={formData.substreet_street_brgy}
              onChange={(e) => setFormData({ ...formData, substreet_street_brgy: e.target.value })}
              disabled={isCreating || isUpdating}
              placeholder="Complete address line"
              rows={3}
              className="border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="district_city_zip" className="text-sm font-medium text-gray-700">
              District/City/ZIP
            </Label>
            <Input
              id="district_city_zip"
              value={formData.district_city_zip}
              onChange={(e) => setFormData({ ...formData, district_city_zip: e.target.value })}
              disabled={isCreating || isUpdating}
              placeholder="District, City, ZIP code"
              className="border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>
    </div>
  )

  // Calculate stats
  const totalTaxpayers = taxpayers.length
  const salesTaxpayers = taxpayers.filter((t) => t.type === "sales").length
  const purchasesTaxpayers = taxpayers.filter((t) => t.type === "purchases").length

  return (
    <ProtectedRoute allowedRoles={["secretary"]}>
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
        <DashboardHeader />

        <div className="pt-20 px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl shadow-lg">
                <FileText className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  TIN Library
                </h1>
                <p className="text-gray-600 mt-1">
                  Taxpayer identification database for {profile?.assigned_area || "your assigned area"}
                </p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-gradient-to-r from-emerald-500 to-emerald-600 border-0 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-emerald-100 text-sm font-medium">Total Taxpayers</p>
                    <p className="text-3xl font-bold text-white">{totalTaxpayers}</p>
                    <p className="text-emerald-100 text-xs">in {profile?.assigned_area || "your area"}</p>
                  </div>
                  <Building2 className="h-12 w-12 text-emerald-200" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-blue-500 to-blue-600 border-0 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-medium">Sales Records</p>
                    <p className="text-3xl font-bold text-white">{salesTaxpayers}</p>
                    <p className="text-blue-100 text-xs">sales taxpayers</p>
                  </div>
                  <Receipt className="h-12 w-12 text-blue-200" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-purple-500 to-purple-600 border-0 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm font-medium">Purchase Records</p>
                    <p className="text-3xl font-bold text-white">{purchasesTaxpayers}</p>
                    <p className="text-purple-100 text-xs">purchase taxpayers</p>
                  </div>
                  <FileText className="h-12 w-12 text-purple-200" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Alerts */}
          {error && (
            <Alert variant="destructive" className="mb-6 border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="mb-6 border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          {/* Main Content Card */}
          <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <FileText className="h-6 w-6 text-emerald-600" />
                    Taxpayer Directory ({filteredTaxpayers.length})
                  </CardTitle>
                  <CardDescription className="text-gray-600 mt-1">
                    TIN database for {profile?.assigned_area || "your assigned area"}
                  </CardDescription>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  {/* Search Input */}
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search TIN, name, address..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-full border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
                    />
                  </div>
                  {/* Type Filter */}
                  <Select value={filterType} onValueChange={(value: TaxpayerType | "all") => setFilterType(value)}>
                    <SelectTrigger className="w-full sm:w-32 border-gray-300 focus:border-emerald-500 focus:ring-emerald-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="purchases">Purchases</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={fetchTaxpayers}
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto border-gray-300 hover:bg-gray-50 bg-transparent"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                    <DialogTrigger asChild>
                      <Button
                        onClick={resetForm}
                        className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Taxpayer
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader className="pb-6 border-b border-gray-200">
                        <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                          Add New Taxpayer Listing
                        </DialogTitle>
                        <DialogDescription className="text-gray-600 mt-2">
                          Create a new taxpayer entry for the TIN library database
                        </DialogDescription>
                      </DialogHeader>
                      <div className="max-h-[60vh] overflow-y-auto px-1">{renderFormFields()}</div>
                      <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsAddModalOpen(false)
                            resetForm()
                          }}
                          disabled={isCreating}
                          className="border-gray-300 hover:bg-gray-50 px-6"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleCreateTaxpayer}
                          disabled={isCreating}
                          className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-8"
                        >
                          {isCreating ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Creating Taxpayer...
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
            <CardContent className="p-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mb-4"></div>
                  <p className="text-gray-600 font-medium">Loading taxpayer listings...</p>
                </div>
              ) : (
                <>
                  {filteredTaxpayers.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 border-b border-gray-200">
                            <TableHead className="min-w-[120px] font-semibold text-gray-900">TIN</TableHead>
                            <TableHead className="min-w-[180px] font-semibold text-gray-900">Registered Name</TableHead>
                            <TableHead className="min-w-[80px] font-semibold text-gray-900">Type</TableHead>
                            <TableHead className="min-w-[250px] font-semibold text-gray-900">Address</TableHead>
                            <TableHead className="min-w-[120px] font-semibold text-gray-900">Date Added</TableHead>
                            <TableHead className="min-w-[120px] font-semibold text-gray-900">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredTaxpayers.map((taxpayer) => (
                            <TableRow key={taxpayer.id} className="hover:bg-gray-50 transition-colors">
                              <TableCell className="font-mono font-medium text-gray-900">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                  {formatTin(taxpayer.tin)}
                                </div>
                              </TableCell>
                              <TableCell className="text-gray-900">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full flex items-center justify-center">
                                    <Building2 className="h-4 w-4 text-white" />
                                  </div>
                                  <span className="font-medium">{taxpayer.registered_name || "N/A"}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                                    taxpayer.type === "sales"
                                      ? "bg-green-100 text-green-800 border border-green-200"
                                      : "bg-blue-100 text-blue-800 border border-blue-200"
                                  }`}
                                >
                                  {taxpayer.type.toUpperCase()}
                                </span>
                              </TableCell>
                              <TableCell className="text-gray-600">
                                <div className="max-w-xs">
                                  <div className="text-sm font-medium">{taxpayer.substreet_street_brgy || "N/A"}</div>
                                  <div className="text-xs text-gray-500 flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {taxpayer.district_city_zip || ""}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-gray-600">
                                {new Date(taxpayer.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditTaxpayer(taxpayer)}
                                    className="hover:bg-emerald-50 hover:text-emerald-600"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="sm" className="hover:bg-red-50 hover:text-red-600">
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Taxpayer Listing</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete the taxpayer listing for TIN{" "}
                                          <strong>{formatTin(taxpayer.tin)}</strong>? This action cannot be undone.
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
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No taxpayer listings found</h3>
                      <p className="text-gray-500">
                        {searchTerm || filterType !== "all"
                          ? "No taxpayer listings found matching your criteria."
                          : profile?.assigned_area
                            ? `No taxpayer listings found for ${profile.assigned_area}. Create your first taxpayer entry to get started!`
                            : "No assigned area found. Please contact your administrator."}
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Edit Taxpayer Modal */}
          <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader className="pb-6 border-b border-gray-200">
                <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  Edit Taxpayer Listing
                </DialogTitle>
                <DialogDescription className="text-gray-600 mt-2">
                  Update taxpayer information and details
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[60vh] overflow-y-auto px-1">{renderFormFields()}</div>
              <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditModalOpen(false)
                    resetForm()
                  }}
                  disabled={isUpdating}
                  className="border-gray-300 hover:bg-gray-50 px-6"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateTaxpayer}
                  disabled={isUpdating}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-8"
                >
                  {isUpdating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Updating Taxpayer...
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
