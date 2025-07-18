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
import { Search, Edit, Trash2, UserPlus, CheckCircle, AlertCircle, RefreshCw } from "lucide-react"
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

export default function AdminUserManagement() {
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

  const [creationMode, setCreationMode] = useState<"profile-only" | "with-auth">("profile-only")

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError("")

      // Admin users can only see secretary and admin users, not super_admin
      const { data: profiles, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .in("role", ["secretary", "admin"])
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

      console.log(`Creating user in ${creationMode} mode...`)

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

      // Create auth account if requested
      if (creationMode === "with-auth") {
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
          setError(
            `Authentication account creation failed: ${authError.message}. Creating profile-only user instead...`,
          )
          // Continue with profile-only creation
        } else if (authData.user) {
          authUserId = authData.user.id
          console.log("Auth account created:", authUserId)
        }
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

      const successMessage = authUserId
        ? `User "${formData.first_name} ${formData.last_name}" (${formData.email}) created successfully with login capabilities! Default password: TempPass123! (user should change this)`
        : `User "${formData.first_name} ${formData.last_name}" (${formData.email}) created successfully as profile-only user.`

      setSuccess(successMessage)
      setIsAddModalOpen(false)
      setFormData(initialFormData)
      setCreationMode("profile-only")
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

  const resetForm = () => {
    setFormData(initialFormData)
    setEditingUser(null)
    setCreationMode("profile-only")
    setError("")
    setSuccess("")
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />

        <div className="pt-20 px-6 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-600 mt-2">Create and manage user profiles for manual administration</p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-4">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Info Alert */}
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>User Management:</strong> Create user profiles with or without login capabilities. Profile-only
              users bypass email domain restrictions.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle>Users ({users.length})</CardTitle>
                  <CardDescription>Manage user profiles and permissions</CardDescription>
                </div>

                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-full sm:w-64"
                    />
                  </div>
                  <Button onClick={fetchUsers} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={resetForm}>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add User
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add New User Profile</DialogTitle>
                        <DialogDescription>
                          Create a new user profile with optional login capabilities.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="max-h-[60vh] overflow-y-auto px-1">
                        {/* Creation Mode Selection */}
                        <div className="bg-gray-50 p-4 rounded-md">
                          <Label className="text-sm font-medium">Creation Mode</Label>
                          <div className="mt-2 space-y-2">
                            <div className="flex items-center space-x-2">
                              <input
                                type="radio"
                                id="profile-only"
                                name="creationMode"
                                value="profile-only"
                                checked={creationMode === "profile-only"}
                                onChange={(e) => setCreationMode(e.target.value as "profile-only" | "with-auth")}
                                disabled={isCreating}
                              />
                              <Label htmlFor="profile-only" className="text-sm">
                                Profile Only (No login capability)
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="radio"
                                id="with-auth"
                                name="creationMode"
                                value="with-auth"
                                checked={creationMode === "with-auth"}
                                onChange={(e) => setCreationMode(e.target.value as "profile-only" | "with-auth")}
                                disabled={isCreating}
                              />
                              <Label htmlFor="with-auth" className="text-sm">
                                With Login Capability (Creates auth account)
                              </Label>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            {creationMode === "with-auth"
                              ? "Creates both profile and authentication account. Default password: TempPass123!"
                              : "Creates profile only for manual management. No email restrictions."}
                          </p>
                        </div>
                        <div className="grid gap-4 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="add_first_name">First Name *</Label>
                              <Input
                                id="add_first_name"
                                value={formData.first_name}
                                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                disabled={isCreating}
                                placeholder="John"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="add_last_name">Last Name *</Label>
                              <Input
                                id="add_last_name"
                                value={formData.last_name}
                                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                disabled={isCreating}
                                placeholder="Doe"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="add_email">Email Address *</Label>
                            <Input
                              id="add_email"
                              type="email"
                              value={formData.email}
                              onChange={(e) => setFormData({ ...formData, email: e.target.value.toLowerCase().trim() })}
                              disabled={isCreating}
                              placeholder="john.doe@gmail.com"
                            />
                            <p className="text-xs text-gray-500">
                              Any email format is accepted - no domain restrictions apply for profile-only users.
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="add_role">Role</Label>
                              <Select
                                value={formData.role}
                                onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })}
                                disabled={isCreating}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="secretary">Secretary</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="add_status">Status</Label>
                              <Select
                                value={formData.status}
                                onValueChange={(value: UserStatus) => setFormData({ ...formData, status: value })}
                                disabled={isCreating}
                              >
                                <SelectTrigger>
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

                          <div className="space-y-2">
                            <Label htmlFor="add_assigned_area">Assigned Area</Label>
                            <Input
                              id="add_assigned_area"
                              value={formData.assigned_area}
                              onChange={(e) => setFormData({ ...formData, assigned_area: e.target.value })}
                              disabled={isCreating}
                              placeholder="e.g., Metro Manila, Cebu City, Davao Region"
                            />
                          </div>

                          {/* Info box */}
                          <div
                            className={`p-3 rounded-md ${creationMode === "with-auth" ? "bg-green-50" : "bg-blue-50"}`}
                          >
                            <p
                              className={`text-sm font-medium ${creationMode === "with-auth" ? "text-green-800" : "text-blue-800"}`}
                            >
                              {creationMode === "with-auth" ? "Full User Account:" : "Profile-Only User:"}
                            </p>
                            <ul
                              className={`text-xs mt-1 space-y-1 ${creationMode === "with-auth" ? "text-green-700" : "text-blue-700"}`}
                            >
                              {creationMode === "with-auth" ? (
                                <>
                                  <li>• Creates both profile and authentication account</li>
                                  <li>• User can login with email and default password</li>
                                  <li>• May fail due to email domain restrictions</li>
                                  <li>• Default password: TempPass123! (user should change)</li>
                                </>
                              ) : (
                                <>
                                  <li>• Profile-only user (no login capability)</li>
                                  <li>• Any email domain accepted (@gmail.com, @yahoo.com, etc.)</li>
                                  <li>• For administrative tracking and management</li>
                                </>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
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
                        <Button onClick={handleCreateUser} disabled={isCreating}>
                          {isCreating ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Creating...
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
            <CardContent>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-500">Loading users...</p>
                </div>
              ) : (
                <>
                  {filteredUsers.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Assigned Area</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              {user.full_name || `${user.first_name || ""} ${user.last_name || ""}`.trim() || "N/A"}
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">{user.email || "N/A"}</TableCell>
                            <TableCell>
                              <Select
                                value={user.role}
                                onValueChange={(value: UserRole) => handleQuickRoleUpdate(user.id, value)}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="secretary">Secretary</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={user.status}
                                onValueChange={(value: UserStatus) => handleQuickStatusUpdate(user.id, value)}
                              >
                                <SelectTrigger className="w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="inactive">Inactive</SelectItem>
                                  <SelectItem value="suspended">Suspended</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>{user.assigned_area || "N/A"}</TableCell>
                            <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button variant="ghost" size="sm" onClick={() => handleEditUser(user)}>
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
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      {searchTerm ? "No users found matching your search." : "No users found. Create your first user!"}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Edit User Modal */}
          <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit User Profile</DialogTitle>
                <DialogDescription>Update user information and permissions.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_first_name">First Name *</Label>
                    <Input
                      id="edit_first_name"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      disabled={isUpdating}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_last_name">Last Name *</Label>
                    <Input
                      id="edit_last_name"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      disabled={isUpdating}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_email">Email Address *</Label>
                  <Input
                    id="edit_email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value.toLowerCase().trim() })}
                    disabled={isUpdating}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_role">Role</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })}
                      disabled={isUpdating}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="secretary">Secretary</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: UserStatus) => setFormData({ ...formData, status: value })}
                      disabled={isUpdating}
                    >
                      <SelectTrigger>
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

                <div className="space-y-2">
                  <Label htmlFor="edit_assigned_area">Assigned Area</Label>
                  <Input
                    id="edit_assigned_area"
                    value={formData.assigned_area}
                    onChange={(e) => setFormData({ ...formData, assigned_area: e.target.value })}
                    disabled={isUpdating}
                    placeholder="e.g., Metro Manila, Cebu City, Davao Region"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
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
                <Button onClick={handleUpdateUser} disabled={isUpdating}>
                  {isUpdating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Updating...
                    </>
                  ) : (
                    "Update Profile"
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
