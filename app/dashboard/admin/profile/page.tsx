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
import { CheckCircle, AlertCircle, User } from "lucide-react"

export default function ProfilePage() {
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

      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          full_name: `${formData.first_name} ${formData.last_name}`.trim(),
          assigned_area: formData.assigned_area,
        })
        .eq("id", profile.id)

      if (updateError) {
        setError("Error updating profile: " + updateError.message)
        return
      }

      setSuccess("Profile updated successfully!")
      setIsEditing(false)
      await refreshProfile()
    } catch (error: any) {
      setError("An unexpected error occurred: " + error.message)
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
    } catch (error: any) {
      setPasswordError("An unexpected error occurred: " + error.message)
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50">
        <DashboardHeader />

        <div className="pt-20 px-6 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-navy">My Profile</h1>
            <p className="text-navy mt-2">Manage your personal information and account settings</p>
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

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* Profile Information */}
            <Card className="bg-gradient-to-br from-rose-100 via-orange-100 to-amber-100 backdrop-blur-sm shadow-lg border border-rose-200">
              <CardHeader className="border-b border-rose-200 pb-4">
                <CardTitle className="flex items-center gap-2 text-navy">
                  <div className="p-2 rounded-full bg-gradient-to-br from-rose-200 to-orange-200 text-navy">
                    <User className="h-5 w-5" />
                  </div>
                  Profile Information
                </CardTitle>
                <CardDescription className="text-navy">Update your personal details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name" className="text-navy">
                      First Name
                    </Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      disabled={!isEditing}
                      className="bg-white border-rose-200 text-navy focus:ring-rose-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name" className="text-navy">
                      Last Name
                    </Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      disabled={!isEditing}
                      className="bg-white border-rose-200 text-navy focus:ring-rose-300"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assigned_area" className="text-navy">
                    Assigned Area
                  </Label>
                  <Input
                    id="assigned_area"
                    value={formData.assigned_area}
                    onChange={(e) => setFormData({ ...formData, assigned_area: e.target.value })}
                    disabled={!isEditing}
                    placeholder="e.g., Metro Manila, Cebu City, Davao Region"
                    className="bg-white border-rose-200 text-navy focus:ring-rose-300"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  {!isEditing ? (
                    <Button onClick={() => setIsEditing(true)} className="bg-navy text-white hover:bg-navy/90">
                      Edit Profile
                    </Button>
                  ) : (
                    <>
                      <Button onClick={handleSave} disabled={isSaving} className="bg-navy text-white hover:bg-navy/90">
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
                        className="border-navy text-navy hover:bg-navy/10 bg-transparent"
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Account Information (Read-only) */}
            <Card className="bg-gradient-to-br from-orange-100 via-amber-100 to-rose-100 backdrop-blur-sm shadow-lg border border-orange-200">
              <CardHeader className="border-b border-orange-200 pb-4">
                <CardTitle className="text-navy">Account Information</CardTitle>
                <CardDescription className="text-navy">Your account details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label className="text-navy">Email</Label>
                  <div className="px-3 py-2 bg-white rounded-md text-sm text-navy border border-orange-200">
                    {profile?.email || "Not available"}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-navy">Role</Label>
                  <div className="px-3 py-2 bg-white rounded-md text-sm capitalize text-navy border border-orange-200">
                    {profile?.role?.replace("_", " ") || "N/A"}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-navy">Status</Label>
                  <div className="px-3 py-2 bg-white rounded-md text-sm capitalize text-navy border border-orange-200">
                    {profile?.status || "N/A"}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-navy">Member Since</Label>
                  <div className="px-3 py-2 bg-white rounded-md text-sm text-navy border border-orange-200">
                    {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "N/A"}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-navy">Last Login</Label>
                  <div className="px-3 py-2 bg-white rounded-md text-sm text-navy border border-orange-200">
                    {profile?.last_login_at ? new Date(profile.last_login_at).toLocaleDateString() : "Never"}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Password Change */}
            <Card className="bg-gradient-to-br from-amber-100 via-rose-100 to-orange-100 backdrop-blur-sm shadow-lg border border-amber-200">
              <CardHeader className="border-b border-amber-200 pb-4">
                <CardTitle className="text-navy">Change Password</CardTitle>
                <CardDescription className="text-navy">Update your account password</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                {passwordError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{passwordError}</AlertDescription>
                  </Alert>
                )}

                {passwordSuccess && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>{passwordSuccess}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="current_password" className="text-navy">
                    Current Password
                  </Label>
                  <Input
                    id="current_password"
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    disabled={isChangingPassword}
                    placeholder="Enter current password"
                    className="bg-white border-amber-200 text-navy focus:ring-amber-300"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new_password" className="text-navy">
                    New Password
                  </Label>
                  <Input
                    id="new_password"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    disabled={isChangingPassword}
                    placeholder="Enter new password (min 6 characters)"
                    className="bg-white border-amber-200 text-navy focus:ring-amber-300"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm_password" className="text-navy">
                    Confirm New Password
                  </Label>
                  <Input
                    id="confirm_password"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    disabled={isChangingPassword}
                    placeholder="Confirm new password"
                    className="bg-white border-amber-200 text-navy focus:ring-amber-300"
                  />
                </div>

                <Button
                  onClick={handleChangePassword}
                  disabled={isChangingPassword}
                  className="w-full bg-navy text-white hover:bg-navy/90"
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
