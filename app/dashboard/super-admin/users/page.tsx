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
import { supabase } from "@/lib/supabase/client"
import type { UserProfile, UserRole, UserStatus } from "@/types/auth"
import {
  Search,
  Edit,
  Trash2,
  UserPlus,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Mail,
  Users,
  Shield,
  Clock,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface UserFormData {
  email: string
  first_name: string
  last_name: string
  role: UserRole
  status: UserStatus
  assigned_area: string
}

const initialFormData: UserFormData = {
  email: "",
  first_name: "",
  last_name: "",
  role: "secretary",
  status: "active",
  assigned_area: "",
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Form data
  const [formData, setFormData] = useState<UserFormData>(initialFormData)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)

  const [isSendingMagicLink, setIsSendingMagicLink] = useState<string | null>(null)

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError("")

      const { data: profiles, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .order("created_at", { ascending: false })

      if (profileError) {
        console.error("Profile fetch error:", profileError)
        setError("Error fetching users: " + profileError.message)
        return
      }

      console.log("Fetched users:", profiles?.length || 0)
      setUsers(profiles || [])
    } catch (error: any) {
      console.error("Unexpected error:", error)
      setError("An unexpected error occurred: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
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

  const filteredUsers = users.filter(
    (user) =>
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.assigned_area?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const validateEmail = (email: string): boolean => {
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    return emailRegex.test(email) && email.length <= 254
  }

  const validateForm = (data: UserFormData): string | null => {
    if (!data.first_name.trim()) return "First name is required"
    if (!data.last_name.trim()) return "Last name is required"
    if (!data.email.trim()) return "Email is required"
    if (!validateEmail(data.email)) return "Please enter a valid email address"
    return null
  }

  const handleCreateUser = async () => {
    try {
      setIsCreating(true)
      setError("")

      const validationError = validateForm(formData)
      if (validationError) {
        setError(validationError)
        return
      }

      console.log("Creating user with authentication account...")

      // Check if user already exists by email
      const { data: existingUser, error: checkError } = await supabase
        .from("user_profiles")
        .select("email")
        .eq("email", formData.email.toLowerCase().trim())
        .single()

      if (existingUser) {
        setError(`A user with email "${formData.email}" already exists`)
        return
      }

      if (checkError && checkError.code !== "PGRST116") {
        setError("Error checking existing users: " + checkError.message)
        return
      }

      let authUserId = null

      // Create auth account
      console.log("Creating authentication account...")

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.toLowerCase().trim(),
        password: "TempPass123!", // Default password - user should change it
        options: {
          emailRedirectTo: undefined,
          data: {
            first_name: formData.first_name,
            last_name: formData.last_name,
            email_confirm: false,
          },
        },
      })

      if (authError) {
        console.error("Auth error:", authError)
        setError(`Authentication account creation failed: ${authError.message}`)
        return
      } else if (authData.user) {
        authUserId = authData.user.id
        console.log("Auth account created:", authUserId)
      }

      // Create user profile
      const profileData = {
        auth_user_id: authUserId,
        email: formData.email.toLowerCase().trim(),
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        full_name: `${formData.first_name.trim()} ${formData.last_name.trim()}`,
        role: formData.role,
        status: formData.status,
        assigned_area: formData.assigned_area.trim() || null,
      }

      console.log("Inserting profile data:", profileData)

      const { data: newUser, error: insertError } = await supabase
        .from("user_profiles")
        .insert(profileData)
        .select()
        .single()

      if (insertError) {
        console.error("Insert error:", insertError)
        setError("Error creating user profile: " + insertError.message)
        return
      }

      console.log("User profile created successfully:", newUser)

      const successMessage = `User "${formData.first_name} ${formData.last_name}" (${formData.email}) created successfully with login capabilities! Default password: TempPass123! (user should change this)`

      setSuccess(successMessage)
      setIsAddModalOpen(false)
      setFormData(initialFormData)
      fetchUsers()
    } catch (error: any) {
      console.error("Unexpected error:", error)
      setError("An unexpected error occurred: " + error.message)
    } finally {
      setIsCreating(false)
    }
  }

  const handleEditUser = (user: UserProfile) => {
    setEditingUser(user)
    setFormData({
      email: user.email || "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      role: user.role,
      status: user.status,
      assigned_area: user.assigned_area || "",
    })
    setIsEditModalOpen(true)
  }

  const handleUpdateUser = async () => {
    try {
      setIsUpdating(true)
      setError("")

      if (!editingUser) return

      const validationError = validateForm(formData)
      if (validationError) {
        setError(validationError)
        return
      }

      // Check if email is being changed and if new email already exists
      if (formData.email.toLowerCase().trim() !== editingUser.email?.toLowerCase()) {
        const { data: existingUser } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("email", formData.email.toLowerCase().trim())
          .neq("id", editingUser.id)
          .single()

        if (existingUser) {
          setError(`Email "${formData.email}" is already in use by another user`)
          return
        }
      }

      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({
          email: formData.email.toLowerCase().trim(),
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          full_name: `${formData.first_name.trim()} ${formData.last_name.trim()}`,
          role: formData.role,
          status: formData.status,
          assigned_area: formData.assigned_area.trim() || null,
        })
        .eq("id", editingUser.id)

      if (updateError) {
        setError("Error updating user: " + updateError.message)
        return
      }

      setSuccess("User updated successfully!")
      setIsEditModalOpen(false)
      setEditingUser(null)
      setFormData(initialFormData)
      fetchUsers()
    } catch (error: any) {
      setError("An unexpected error occurred: " + error.message)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteUser = async (user: UserProfile) => {
    try {
      setIsDeleting(true)
      setError("")

      const { error: deleteError } = await supabase.from("user_profiles").delete().eq("id", user.id)

      if (deleteError) {
        setError("Error deleting user: " + deleteError.message)
        return
      }

      setSuccess(`User ${user.full_name || user.first_name} deleted successfully!`)
      fetchUsers()
    } catch (error: any) {
      setError("An unexpected error occurred: " + error.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleQuickStatusUpdate = async (userId: string, newStatus: UserStatus) => {
    try {
      setError("")
      const { error } = await supabase.from("user_profiles").update({ status: newStatus }).eq("id", userId)
      if (error) {
        setError("Error updating status: " + error.message)
        return
      }
      setSuccess("Status updated successfully")
      fetchUsers()
    } catch (error: any) {
      setError("An unexpected error occurred")
    }
  }

  const handleQuickRoleUpdate = async (userId: string, newRole: UserRole) => {
    try {
      setError("")
      const { error } = await supabase.from("user_profiles").update({ role: newRole }).eq("id", userId)
      if (error) {
        setError("Error updating role: " + error.message)
        return
      }
      setSuccess("Role updated successfully")
      fetchUsers()
    } catch (error: any) {
      setError("An unexpected error occurred")
    }
  }

  const handleSendMagicLink = async (user: UserProfile) => {
    try {
      setIsSendingMagicLink(user.id)
      setError("")

      if (!user.email) {
        setError("Cannot send magic link: User has no email address")
        return
      }

      // Send magic link using Supabase Auth
      const { error: magicLinkError } = await supabase.auth.signInWithOtp({
        email: user.email,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      })

      if (magicLinkError) {
        setError("Error sending magic link: " + magicLinkError.message)
        return
      }

      setSuccess(`Magic link sent successfully to ${user.email}!`)
    } catch (error: any) {
      setError("An unexpected error occurred while sending magic link")
    } finally {
      setIsSendingMagicLink(null)
    }
  }

  const resetForm = () => {
    setFormData(initialFormData)
    setEditingUser(null)
    setError("")
    setSuccess("")
  }

  // Calculate stats
  const totalUsers = users.length
  const activeUsers = users.filter((user) => user.status === "active").length
  const adminUsers = users.filter((user) => user.role === "admin" || user.role === "super_admin").length

  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <DashboardHeader />

        <div className="pt-20 px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                <Users className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  User Management
                </h1>
                <p className="text-gray-600 mt-1">Manage user profiles and permissions across the system</p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-gradient-to-r from-blue-500 to-blue-600 border-0 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-medium">Total Users</p>
                    <p className="text-3xl font-bold text-white">{totalUsers}</p>
                  </div>
                  <Users className="h-12 w-12 text-blue-200" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-green-500 to-green-600 border-0 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm font-medium">Active Users</p>
                    <p className="text-3xl font-bold text-white">{activeUsers}</p>
                  </div>
                  <CheckCircle className="h-12 w-12 text-green-200" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-purple-500 to-purple-600 border-0 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm font-medium">Admin Users</p>
                    <p className="text-3xl font-bold text-white">{adminUsers}</p>
                  </div>
                  <Shield className="h-12 w-12 text-purple-200" />
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

          {/* Info Alert */}
          <Alert className="mb-6 border-indigo-200 bg-indigo-50">
            <Mail className="h-4 w-4 text-indigo-600" />
            <AlertDescription className="text-indigo-800">
              <strong>Magic Link Feature:</strong> Click the mail icon next to any user with an email address to send
              them a magic link for passwordless login.
            </AlertDescription>
          </Alert>

          {/* Main Content Card */}
          <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Users className="h-6 w-6 text-blue-600" />
                    Users Directory ({users.length})
                  </CardTitle>
                  <CardDescription className="text-gray-600 mt-1">
                    Manage user profiles and authentication
                  </CardDescription>
                </div>

                <div className="flex gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-full sm:w-64 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <Button
                    onClick={fetchUsers}
                    variant="outline"
                    size="sm"
                    className="border-gray-300 hover:bg-gray-50 bg-transparent"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                    <DialogTrigger asChild>
                      <Button
                        onClick={resetForm}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add User
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader className="pb-6 border-b border-gray-200">
                        <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                          Add New User Profile
                        </DialogTitle>
                        <DialogDescription className="text-gray-600 mt-2">
                          Create a new user with full authentication capabilities and login access
                        </DialogDescription>
                      </DialogHeader>
                      <div className="max-h-[60vh] overflow-y-auto px-1">
                        <div className="space-y-6 py-6">
                          {/* Personal Information Section */}
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
                            <h4 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h4>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="add_first_name" className="text-sm font-medium text-gray-700">
                                  First Name *
                                </Label>
                                <Input
                                  id="add_first_name"
                                  value={formData.first_name}
                                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                  disabled={isCreating}
                                  placeholder="John"
                                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="add_last_name" className="text-sm font-medium text-gray-700">
                                  Last Name *
                                </Label>
                                <Input
                                  id="add_last_name"
                                  value={formData.last_name}
                                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                  disabled={isCreating}
                                  placeholder="Doe"
                                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Account Information Section */}
                          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg border border-green-200">
                            <h4 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h4>
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="add_email" className="text-sm font-medium text-gray-700">
                                  Email Address *
                                </Label>
                                <Input
                                  id="add_email"
                                  type="email"
                                  value={formData.email}
                                  onChange={(e) =>
                                    setFormData({ ...formData, email: e.target.value.toLowerCase().trim() })
                                  }
                                  disabled={isCreating}
                                  placeholder="john.doe@example.com"
                                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="add_role" className="text-sm font-medium text-gray-700">
                                    Role
                                  </Label>
                                  <Select
                                    value={formData.role}
                                    onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })}
                                    disabled={isCreating}
                                  >
                                    <SelectTrigger className="border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="secretary">Secretary</SelectItem>
                                      <SelectItem value="admin">Admin</SelectItem>
                                      <SelectItem value="super_admin">Super Admin</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="add_status" className="text-sm font-medium text-gray-700">
                                    Status
                                  </Label>
                                  <Select
                                    value={formData.status}
                                    onValueChange={(value: UserStatus) => setFormData({ ...formData, status: value })}
                                    disabled={isCreating}
                                  >
                                    <SelectTrigger className="border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="active">Active</SelectItem>
                                      <SelectItem value="inactive">Inactive</SelectItem>
                                      <SelectItem value="suspended">Suspended</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Work Information Section */}
                          <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-lg border border-purple-200">
                            <h4 className="text-lg font-semibold text-gray-900 mb-4">Work Information</h4>
                            <div className="space-y-2">
                              <Label htmlFor="add_assigned_area" className="text-sm font-medium text-gray-700">
                                Assigned Area
                              </Label>
                              <Input
                                id="add_assigned_area"
                                value={formData.assigned_area}
                                onChange={(e) => setFormData({ ...formData, assigned_area: e.target.value })}
                                disabled={isCreating}
                                placeholder="e.g., Metro Manila, Cebu City, Davao Region"
                                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                              />
                            </div>
                          </div>

                          {/* Authentication Info */}
                          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
                            <div className="flex items-center gap-2 mb-2">
                              <Shield className="h-5 w-5 text-green-600" />
                              <p className="text-sm font-medium text-green-800">Full User Account</p>
                            </div>
                            <ul className="text-xs text-green-700 space-y-1">
                              <li>• Creates both profile and authentication account</li>
                              <li>• User can login with email and default password</li>
                              <li>• Default password: TempPass123! (user should change)</li>
                              <li>• Full access to system based on assigned role</li>
                            </ul>
                          </div>
                        </div>
                      </div>
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
                          onClick={handleCreateUser}
                          disabled={isCreating}
                          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-8"
                        >
                          {isCreating ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Creating User...
                            </>
                          ) : (
                            "Create User Profile"
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
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-600 font-medium">Loading users...</p>
                </div>
              ) : (
                <>
                  {filteredUsers.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 border-b border-gray-200">
                            <TableHead className="font-semibold text-gray-900">Name</TableHead>
                            <TableHead className="font-semibold text-gray-900">Email</TableHead>
                            <TableHead className="font-semibold text-gray-900">Role</TableHead>
                            <TableHead className="font-semibold text-gray-900">Status</TableHead>
                            <TableHead className="font-semibold text-gray-900">Assigned Area</TableHead>
                            <TableHead className="font-semibold text-gray-900">Created</TableHead>
                            <TableHead className="font-semibold text-gray-900">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredUsers.map((user) => (
                            <TableRow key={user.id} className="hover:bg-gray-50 transition-colors">
                              <TableCell className="font-medium text-gray-900">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                                    <span className="text-white text-sm font-medium">
                                      {(user.first_name?.[0] || user.full_name?.[0] || "U").toUpperCase()}
                                    </span>
                                  </div>
                                  {user.full_name || `${user.first_name || ""} ${user.last_name || ""}`.trim() || "N/A"}
                                </div>
                              </TableCell>
                              <TableCell className="text-gray-600">{user.email || "N/A"}</TableCell>
                              <TableCell>
                                <Select
                                  value={user.role}
                                  onValueChange={(value: UserRole) => handleQuickRoleUpdate(user.id, value)}
                                >
                                  <SelectTrigger className="w-32 border-gray-300">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="secretary">Secretary</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="super_admin">Super Admin</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={user.status}
                                  onValueChange={(value: UserStatus) => handleQuickStatusUpdate(user.id, value)}
                                >
                                  <SelectTrigger className="w-28 border-gray-300">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                    <SelectItem value="suspended">Suspended</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="text-gray-600">{user.assigned_area || "N/A"}</TableCell>
                              <TableCell className="text-gray-600">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-gray-400" />
                                  {new Date(user.created_at).toLocaleDateString()}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  {user.email && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleSendMagicLink(user)}
                                      disabled={isSendingMagicLink === user.id}
                                      title="Send Magic Link"
                                      className="hover:bg-blue-50 hover:text-blue-600"
                                    >
                                      {isSendingMagicLink === user.id ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                      ) : (
                                        <Mail className="h-4 w-4" />
                                      )}
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditUser(user)}
                                    className="hover:bg-green-50 hover:text-green-600"
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
                                        <AlertDialogTitle>Delete User Profile</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete the profile for{" "}
                                          <strong>{user.full_name || `${user.first_name} ${user.last_name}`}</strong>?
                                          This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteUser(user)}
                                          className="bg-red-600 hover:bg-red-700"
                                          disabled={isDeleting}
                                        >
                                          {isDeleting ? "Deleting..." : "Delete Profile"}
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
                    <div className="flex flex-col items-center justify-center py-12">
                      <AlertCircle className="h-10 w-10 text-gray-400 mb-4" />
                      <p className="text-gray-600 font-medium">No users found.</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  )
}
