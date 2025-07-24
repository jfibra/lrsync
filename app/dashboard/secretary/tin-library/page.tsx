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
      <div style={{ background: '#f9f9f9', border: '1px solid #e0e0e0' }} className="p-6 rounded-lg">
        <h4 style={{ color: '#001f3f' }} className="text-lg font-semibold mb-4">Basic Information</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="tin" style={{ color: '#001f3f' }} className="text-sm font-medium">
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
              maxLength={19}
              style={{ borderColor: '#e0e0e0', color: '#001f3f', background: '#fff' }}
              className="focus:border-[#001f3f] focus:ring-[#001f3f]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type" style={{ color: '#001f3f' }} className="text-sm font-medium">
              Taxpayer Type *
            </Label>
            <Select
              value={formData.type}
              onValueChange={(value: TaxpayerType) => setFormData({ ...formData, type: value })}
              disabled={isCreating || isUpdating}
            >
              <SelectTrigger style={{ borderColor: '#e0e0e0', color: '#001f3f', background: '#fff' }} className="focus:border-[#001f3f] focus:ring-[#001f3f]">
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
      <div style={{ background: '#f9f9f9', border: '1px solid #e0e0e0' }} className="p-6 rounded-lg">
        <h4 style={{ color: '#001f3f' }} className="text-lg font-semibold mb-4">Company Information</h4>
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="registered_name" style={{ color: '#001f3f' }} className="text-sm font-medium">
              Registered Name *
            </Label>
            <Input
              id="registered_name"
              value={formData.registered_name}
              onChange={(e) => setFormData({ ...formData, registered_name: e.target.value })}
              disabled={isCreating || isUpdating}
              placeholder="Company or business name"
              maxLength={255}
              style={{ borderColor: '#e0e0e0', color: '#001f3f', background: '#fff' }}
              className="focus:border-[#001f3f] focus:ring-[#001f3f]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="substreet_street_brgy" style={{ color: '#001f3f' }} className="text-sm font-medium">
              Substreet/Street/Barangay
            </Label>
            <Textarea
              id="substreet_street_brgy"
              value={formData.substreet_street_brgy}
              onChange={(e) => setFormData({ ...formData, substreet_street_brgy: e.target.value })}
              disabled={isCreating || isUpdating}
              placeholder="Complete address line"
              rows={3}
              style={{ borderColor: '#e0e0e0', color: '#001f3f', background: '#fff' }}
              className="focus:border-[#001f3f] focus:ring-[#001f3f]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="district_city_zip" style={{ color: '#001f3f' }} className="text-sm font-medium">
              District/City/ZIP
            </Label>
            <Input
              id="district_city_zip"
              value={formData.district_city_zip}
              onChange={(e) => setFormData({ ...formData, district_city_zip: e.target.value })}
              disabled={isCreating || isUpdating}
              placeholder="District, City, ZIP code"
              style={{ borderColor: '#e0e0e0', color: '#001f3f', background: '#fff' }}
              className="focus:border-[#001f3f] focus:ring-[#001f3f]"
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
      <div style={{ background: '#fff' }} className="min-h-screen">
        <DashboardHeader />

        <div className="pt-20 px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div style={{ background: '#001f3f' }} className="p-3 rounded-xl shadow-lg">
                <FileText className="h-8 w-8" style={{ color: '#fff' }} />
              </div>
              <div>
                <h1 className="text-4xl font-bold" style={{ color: '#001f3f' }}>
                  TIN Library
                </h1>
                <p style={{ color: '#555' }} className="mt-1">
                  Taxpayer identification database for {profile?.assigned_area || "your assigned area"}
                </p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card style={{ background: '#f9f9f9', border: '1px solid #e0e0e0' }} className="shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p style={{ color: '#001f3f' }} className="text-sm font-medium">Total Taxpayers</p>
                    <p style={{ color: '#001f3f' }} className="text-3xl font-bold">{totalTaxpayers}</p>
                    <p style={{ color: '#555' }} className="text-xs">in {profile?.assigned_area || "your area"}</p>
                  </div>
                  <Building2 className="h-12 w-12" style={{ color: '#001f3f' }} />
                </div>
              </CardContent>
            </Card>

            <Card style={{ background: '#f9f9f9', border: '1px solid #e0e0e0' }} className="shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p style={{ color: '#001f3f' }} className="text-sm font-medium">Sales Records</p>
                    <p style={{ color: '#dee242' }} className="text-3xl font-bold">{salesTaxpayers}</p>
                    <p style={{ color: '#555' }} className="text-xs">sales taxpayers</p>
                  </div>
                  <Receipt className="h-12 w-12" style={{ color: '#dee242' }} />
                </div>
              </CardContent>
            </Card>

            <Card style={{ background: '#f9f9f9', border: '1px solid #e0e0e0' }} className="shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p style={{ color: '#001f3f' }} className="text-sm font-medium">Purchase Records</p>
                    <p style={{ color: '#dee242' }} className="text-3xl font-bold">{purchasesTaxpayers}</p>
                    <p style={{ color: '#555' }} className="text-xs">purchase taxpayers</p>
                  </div>
                  <FileText className="h-12 w-12" style={{ color: '#dee242' }} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Alerts */}
          {error && (
            <Alert variant="destructive" style={{ background: '#fffbe6', border: '1px solid #ee3433' }} className="mb-6">
              <AlertCircle className="h-4 w-4" style={{ color: '#ee3433' }} />
              <AlertDescription style={{ color: '#ee3433' }}>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert style={{ background: '#fffbe6', border: '1px solid #dee242' }} className="mb-6">
              <CheckCircle className="h-4 w-4" style={{ color: '#dee242' }} />
              <AlertDescription style={{ color: '#dee242' }}>{success}</AlertDescription>
            </Alert>
          )}

          {/* Main Content Card */}
          <Card style={{ background: '#f9f9f9', border: '1px solid #e0e0e0' }} className="shadow-2xl">
            <CardHeader style={{ borderBottom: '1px solid #e0e0e0' }} className="bg-white">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-2xl font-bold flex items-center gap-2" style={{ color: '#001f3f' }}>
                    <FileText className="h-6 w-6" style={{ color: '#001f3f' }} />
                    Taxpayer Directory ({filteredTaxpayers.length})
                  </CardTitle>
                  <CardDescription style={{ color: '#555' }} className="mt-1">
                    TIN database for {profile?.assigned_area || "your assigned area"}
                  </CardDescription>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  {/* Search Input */}
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2" style={{ color: '#555' }} />
                    <Input
                      placeholder="Search TIN, name, address..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{ borderColor: '#e0e0e0', color: '#001f3f', background: '#fff' }}
                      className="pl-10 w-full focus:border-[#001f3f] focus:ring-[#001f3f]"
                    />
                  </div>
                  {/* Type Filter */}
                  <Select value={filterType} onValueChange={(value: TaxpayerType | "all") => setFilterType(value)}>
                    <SelectTrigger style={{ borderColor: '#e0e0e0', color: '#001f3f', background: '#fff' }} className="w-full sm:w-32 focus:border-[#001f3f] focus:ring-[#001f3f]">
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
                    style={{ background: '#fff', color: '#001f3f', border: '1px solid #001f3f' }}
                    className="w-full sm:w-auto hover:bg-[#f9f9f9]"
                  >
                    <RefreshCw className="h-4 w-4" style={{ color: '#001f3f' }} />
                  </Button>
                  <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                    <DialogTrigger asChild>
                      <Button
                        onClick={resetForm}
                        style={{ background: '#001f3f', color: '#fff' }}
                        className="w-full sm:w-auto shadow-lg hover:bg-[#ee3433]"
                      >
                        <Plus className="h-4 w-4 mr-2" style={{ color: '#fff' }} />
                        Add Taxpayer
                      </Button>
                    </DialogTrigger>
                    <DialogContent style={{ background: '#fff', border: '1px solid #e0e0e0' }} className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader style={{ borderBottom: '1px solid #e0e0e0' }} className="pb-6">
                        <DialogTitle className="text-2xl font-bold" style={{ color: '#001f3f' }}>
                          Add New Taxpayer Listing
                        </DialogTitle>
                        <DialogDescription style={{ color: '#555' }} className="mt-2">
                          Create a new taxpayer entry for the TIN library database
                        </DialogDescription>
                      </DialogHeader>
                      <div className="max-h-[60vh] overflow-y-auto px-1">{renderFormFields()}</div>
                      <div className="flex justify-end gap-3 pt-6" style={{ borderTop: '1px solid #e0e0e0' }}>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsAddModalOpen(false)
                            resetForm()
                          }}
                          disabled={isCreating}
                          style={{ background: '#fff', color: '#001f3f', border: '1px solid #001f3f' }}
                          className="px-6 hover:bg-[#f9f9f9]"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleCreateTaxpayer}
                          disabled={isCreating}
                          style={{ background: '#001f3f', color: '#fff' }}
                          className="px-8 hover:bg-[#ee3433]"
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
                  <div className="animate-spin rounded-full h-12 w-12" style={{ borderBottom: '2px solid #001f3f' }}></div>
                  <p style={{ color: '#555' }} className="font-medium">Loading taxpayer listings...</p>
                </div>
              ) : (
                <>
                  {filteredTaxpayers.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow style={{ background: '#fff', borderBottom: '1px solid #e0e0e0' }}>
                            <TableHead className="min-w-[120px] font-semibold" style={{ color: '#001f3f' }}>TIN</TableHead>
                            <TableHead className="min-w-[180px] font-semibold" style={{ color: '#001f3f' }}>Registered Name</TableHead>
                            <TableHead className="min-w-[80px] font-semibold" style={{ color: '#001f3f' }}>Type</TableHead>
                            <TableHead className="min-w-[250px] font-semibold" style={{ color: '#001f3f' }}>Address</TableHead>
                            <TableHead className="min-w-[120px] font-semibold" style={{ color: '#001f3f' }}>Date Added</TableHead>
                            <TableHead className="min-w-[120px] font-semibold" style={{ color: '#001f3f' }}>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredTaxpayers.map((taxpayer) => (
                            <TableRow key={taxpayer.id} style={{ background: '#fff' }} className="hover:bg-[#f9f9f9] transition-colors">
                              <TableCell className="font-mono font-medium" style={{ color: '#001f3f' }}>
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full" style={{ background: '#001f3f' }}></div>
                                  {formatTin(taxpayer.tin)}
                                </div>
                              </TableCell>
                              <TableCell style={{ color: '#001f3f' }}>
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#001f3f' }}>
                                    <Building2 className="h-4 w-4" style={{ color: '#fff' }} />
                                  </div>
                                  <span className="font-medium">{taxpayer.registered_name || "N/A"}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                                    taxpayer.type === "sales"
                                      ? "" // success
                                      : "" // secondary
                                  }`}
                                  style={taxpayer.type === "sales"
                                    ? { background: '#dee242', color: '#001f3f', border: '1px solid #dee242' }
                                    : { background: '#fffbe6', color: '#001f3f', border: '1px solid #e0e0e0' }}
                                >
                                  {taxpayer.type.toUpperCase()}
                                </span>
                              </TableCell>
                              <TableCell style={{ color: '#555' }}>
                                <div className="max-w-xs">
                                  <div className="text-sm font-medium">{taxpayer.substreet_street_brgy || "N/A"}</div>
                                  <div className="text-xs flex items-center gap-1" style={{ color: '#555' }}>
                                    <MapPin className="h-3 w-3" style={{ color: '#001f3f' }} />
                                    {taxpayer.district_city_zip || ""}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell style={{ color: '#555' }}>
                                {new Date(taxpayer.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditTaxpayer(taxpayer)}
                                    style={{ color: '#001f3f', background: '#fff' }}
                                    className="hover:bg-[#f9f9f9] hover:text-[#ee3433]"
                                  >
                                    <Edit className="h-4 w-4" style={{ color: '#001f3f' }} />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="sm" style={{ color: '#ee3433', background: '#fff' }} className="hover:bg-[#fffbe6] hover:text-[#ee3433]">
                                        <Trash2 className="h-4 w-4" style={{ color: '#ee3433' }} />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent style={{ background: '#fff', border: '1px solid #e0e0e0' }}>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle style={{ color: '#ee3433' }}>Delete Taxpayer Listing</AlertDialogTitle>
                                        <AlertDialogDescription style={{ color: '#ee3433' }}>
                                          Are you sure you want to delete the taxpayer listing for TIN{" "}
                                          <strong>{formatTin(taxpayer.tin)}</strong>? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel style={{ background: '#fff', color: '#001f3f', border: '1px solid #001f3f' }}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteTaxpayer(taxpayer)}
                                          style={{ background: '#ee3433', color: '#fff' }}
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
                      <FileText className="h-16 w-16 mx-auto mb-4" style={{ color: '#e0e0e0' }} />
                      <h3 className="text-lg font-medium mb-2" style={{ color: '#001f3f' }}>No taxpayer listings found</h3>
                      <p style={{ color: '#555' }}>
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
            <DialogContent style={{ background: '#fff', border: '1px solid #e0e0e0' }} className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader style={{ borderBottom: '1px solid #e0e0e0' }} className="pb-6">
                <DialogTitle className="text-2xl font-bold" style={{ color: '#001f3f' }}>
                  Edit Taxpayer Listing
                </DialogTitle>
                <DialogDescription style={{ color: '#555' }} className="mt-2">
                  Update taxpayer information and details
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[60vh] overflow-y-auto px-1">{renderFormFields()}</div>
              <div className="flex justify-end gap-3 pt-6" style={{ borderTop: '1px solid #e0e0e0' }}>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditModalOpen(false)
                    resetForm()
                  }}
                  disabled={isUpdating}
                  style={{ background: '#fff', color: '#001f3f', border: '1px solid #001f3f' }}
                  className="px-6 hover:bg-[#f9f9f9]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateTaxpayer}
                  disabled={isUpdating}
                  style={{ background: '#001f3f', color: '#fff' }}
                  className="px-8 hover:bg-[#ee3433]"
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
