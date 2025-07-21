"use client"

import { useState, useEffect } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase/client"
import { CheckCircle, AlertCircle, User, Settings, Shield, Clock, Mail } from "lucide-react"

export default function SecretaryProfilePage() {
  const { profile, refreshProfile } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    assigned_area: "",
  })

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState("")

  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        assigned_area: profile.assigned_area || "",
      })
    }
  }, [profile])

  const handleSave = async () => {
    try {
      setIsSaving(true)
      setError("")
      setSuccess("")

      if (!profile) {
        setError("Profile not found")
        return
      }

      // Validate required fields
      if (!formData.first_name.trim() || !formData.last_name.trim()) {
        setError("First name and last name are required")
        return
      }

      const updateData = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        full_name: `${formData.first_name.trim()} ${formData.last_name.trim()}`,
        assigned_area: formData.assigned_area.trim() || null,
      }

      const { error: updateError } = await supabase.from("user_profiles").update(updateData).eq("id", profile.id)

      if (updateError) {
        setError("Error updating profile: " + updateError.message)
        return
      }

      setSuccess("Profile updated successfully!")
      setIsEditing(false)

      // Refresh the profile data
      await refreshProfile()
    } catch (error) {
      setError("An unexpected error occurred")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        assigned_area: profile.assigned_area || "",
      })
    }
    setIsEditing(false)
    setError("")
    setSuccess("")
  }

  const handleChangePassword = async () => {
    try {
      setIsChangingPassword(true)
      setPasswordError("")
      setPasswordSuccess("")

      // Validate inputs
      if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
        setPasswordError("All password fields are required")
        return
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        setPasswordError("New passwords do not match")
        return
      }

      if (passwordData.newPassword.length < 6) {
        setPasswordError("New password must be at least 6 characters long")
        return
      }

      if (passwordData.currentPassword === passwordData.newPassword) {
        setPasswordError("New password must be different from current password")
        return
      }

      // Verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile?.email || "",
        password: passwordData.currentPassword,
      })

      if (signInError) {
        setPasswordError("Current password is incorrect")
        return
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      })

      if (updateError) {
        setPasswordError("Error updating password: " + updateError.message)
        return
      }

      setPasswordSuccess("Password updated successfully!")
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
    } catch (error) {
      setPasswordError("An unexpected error occurred")
    } finally {
      setIsChangingPassword(false)
    }
  }

  if (!profile) {
    return (
      <ProtectedRoute allowedRoles={["secretary"]}>
        <div className="min-h-screen bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50">
          <DashboardHeader />
          <div className="pt-20 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600 mx-auto mb-4"></div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Loading Profile...</h2>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute allowedRoles={["secretary"]}>
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50">
        <DashboardHeader />

        <div className="pt-20 px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-gradient-to-r from-rose-500 to-orange-600 rounded-xl shadow-lg">
                <User className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  My Profile
                </h1>
                <p className="text-gray-600 mt-1">Manage your personal information and account settings</p>
              </div>
            </div>
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

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {/* Profile Information */}
            <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Settings className="h-6 w-6 text-rose-600" />
                  Profile Information
                </CardTitle>
                <CardDescription className="text-gray-600">Update your personal details</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name" className="text-sm font-medium text-gray-700">
                      First Name *
                    </Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      disabled={!isEditing || isSaving}
                      placeholder="Enter first name"
                      className="border-gray-300 focus:border-rose-500 focus:ring-rose-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name" className="text-sm font-medium text-gray-700">
                      Last Name *
                    </Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      disabled={!isEditing || isSaving}
                      placeholder="Enter last name"
                      className="border-gray-300 focus:border-rose-500 focus:ring-rose-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assigned_area" className="text-sm font-medium text-gray-700">
                    Assigned Area
                  </Label>
                  <Input
                    id="assigned_area"
                    value={formData.assigned_area}
                    onChange={(e) => setFormData({ ...formData, assigned_area: e.target.value })}
                    disabled={!isEditing || isSaving}
                    placeholder="e.g., Metro Manila, Cebu City, Davao Region"
                    className="border-gray-300 focus:border-rose-500 focus:ring-rose-500"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  {!isEditing ? (
                    <Button
                      onClick={() => setIsEditing(true)}
                      className="bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-700 hover:to-orange-700 shadow-lg"
                    >
                      Edit Profile
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-700 hover:to-orange-700 shadow-lg"
                      >
                        {isSaving ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Saving...
                          </>
                        ) : (
                          "Save Changes"
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleCancel}
                        disabled={isSaving}
                        className="border-gray-300 hover:bg-gray-50 bg-transparent"
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Account Information (Read-only) */}
            <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Shield className="h-6 w-6 text-rose-600" />
                  Account Information
                </CardTitle>
                <CardDescription className="text-gray-600">View your account details</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Email Address</Label>
                  <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-900">{profile?.email ?? "Not available"}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Role</Label>
                  <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                    <Shield className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-900 capitalize">
                      {profile?.role ? profile.role.replace("_", " ") : "N/A"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Status</Label>
                  <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-gray-900 capitalize">{profile?.status ?? "N/A"}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Member Since</Label>
                  <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-900">
                      {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "N/A"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Last Login</Label>
                  <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-900">
                      {profile?.last_login_at ? new Date(profile.last_login_at).toLocaleDateString() : "Never"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Change Password */}
            <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Settings className="h-6 w-6 text-rose-600" />
                  Change Password
                </CardTitle>
                <CardDescription className="text-gray-600">Update your account password</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {passwordError && (
                  <Alert variant="destructive" className="border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-red-800">{passwordError}</AlertDescription>
                  </Alert>
                )}

                {passwordSuccess && (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">{passwordSuccess}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword" className="text-sm font-medium text-gray-700">
                      Current Password
                    </Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      disabled={isChangingPassword}
                      placeholder="Enter current password"
                      className="border-gray-300 focus:border-rose-500 focus:ring-rose-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-sm font-medium text-gray-700">
                      New Password
                    </Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      disabled={isChangingPassword}
                      placeholder="Enter new password (min 6 characters)"
                      className="border-gray-300 focus:border-rose-500 focus:ring-rose-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                      Confirm New Password
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      disabled={isChangingPassword}
                      placeholder="Confirm new password"
                      className="border-gray-300 focus:border-rose-500 focus:ring-rose-500"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleChangePassword}
                  disabled={isChangingPassword}
                  className="w-full bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-700 hover:to-orange-700 shadow-lg"
                >
                  {isChangingPassword ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Changing Password...
                    </>
                  ) : (
                    "Change Password"
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
