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
import { logNotification } from "@/utils/logNotification";

export default function SecretaryProfilePage() {
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  })
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

      await logNotification(supabase, {
        action: "profile_updated",
        description: `Secretary updated profile: ${profile.email}`,
        ip_address: null,
        location: null,
        meta: JSON.stringify({
          user_id: profile.id,
          role: profile.role || "unknown",
          dashboard: "secretary_profile",
          updated_fields: formData,
        }),
        user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
        user_email: profile.email,
        user_name: profile.full_name || profile.first_name || profile.id,
        user_uuid: profile.id,
      });

      // Refresh the profile data
      await refreshProfile()
    } catch (error) {
      setError("An unexpected error occurred")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = async () => {
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
    if (profile) {
      await logNotification(supabase, {
        action: "profile_edit_cancelled",
        description: `Secretary cancelled profile edit: ${profile.email}`,
        ip_address: null,
        location: null,
        meta: JSON.stringify({
          user_id: profile.id,
          role: profile.role || "unknown",
          dashboard: "secretary_profile",
        }),
        user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
        user_email: profile.email,
        user_name: profile.full_name || profile.first_name || profile.id,
        user_uuid: profile.id,
      });
    }
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

      await logNotification(supabase, {
        action: "password_changed",
        description: `Secretary changed password: ${profile?.email}`,
        ip_address: null,
        location: null,
        meta: JSON.stringify({
          user_id: profile?.id,
          role: profile?.role || "unknown",
          dashboard: "secretary_profile",
        }),
        user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
        user_email: profile?.email,
        user_name: profile?.full_name || profile?.first_name || profile?.id,
        user_uuid: profile?.id,
      });
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
      <div className="min-h-screen bg-[#ffffff]">
        <DashboardHeader />

        <div className="pt-20 px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-[#001f3f] rounded-xl shadow-lg">
                <User className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-[#001f3f]">
                  My Profile
                </h1>
                <p className="text-[#555555] mt-1">Manage your personal information and account settings</p>
              </div>
            </div>
          </div>

          {/* Alerts */}
          {error && (
            <Alert variant="destructive" className="mb-6 border-[#ee3433] bg-[#fffbe6]">
              <AlertCircle className="h-4 w-4 text-[#ee3433]" />
              <AlertDescription className="text-[#ee3433]">{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-6 border-[#dee242] bg-[#fffbe6]">
              <CheckCircle className="h-4 w-4 text-[#dee242]" />
              <AlertDescription className="text-[#dee242]">{success}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {/* Profile Information */}
            <Card className="border border-[#001f3f] rounded-2xl bg-[#f9f9f9] shadow-[0_4px_24px_0_rgba(0,31,63,0.10),0_1.5px_6px_0_rgba(34,34,34,0.08)]">
              <CardHeader className="bg-[#f9f9f9] border-b border-[#e0e0e0]">
                <CardTitle className="text-xl font-bold text-[#001f3f] flex items-center gap-2">
                  <Settings className="h-6 w-6 text-[#001f3f]" />
                  Profile Information
                </CardTitle>
                <CardDescription className="text-[#555555]">Update your personal details</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name" className="text-sm font-medium text-gray-700">
                      <span className="text-[#001f3f]">First Name *</span>
                    </Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      disabled={!isEditing || isSaving}
                      placeholder="Enter first name"
                      className="border-[#e0e0e0] text-[#001f3f] focus:border-[#001f3f] focus:ring-[#001f3f] bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name" className="text-sm font-medium text-gray-700">
                      <span className="text-[#001f3f]">Last Name *</span>
                    </Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      disabled={!isEditing || isSaving}
                      placeholder="Enter last name"
                      className="border-[#e0e0e0] text-[#001f3f] focus:border-[#001f3f] focus:ring-[#001f3f] bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assigned_area" className="text-sm font-medium text-gray-700">
                    <span className="text-[#001f3f]">Assigned Area</span>
                  </Label>
                  <Input
                    id="assigned_area"
                    value={formData.assigned_area}
                    readOnly
                    style={{ color: '#1a202c', backgroundColor: '#f3f4f6', opacity: 1 }}
                    tabIndex={-1}
                    placeholder="e.g., Metro Manila, Cebu City, Davao Region"
                    className="border-[#e0e0e0] bg-[#f9f9f9] cursor-not-allowed text-[#001f3f]"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  {!isEditing ? (
                    <Button
                      onClick={() => setIsEditing(true)}
                      className="bg-[#001f3f] text-white hover:bg-[#ee3433] shadow-lg border border-[#001f3f]"
                    >
                      Edit Profile
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-[#001f3f] text-white hover:bg-[#ee3433] shadow-lg border border-[#001f3f]"
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
                        className="bg-white text-[#001f3f] border border-[#001f3f] hover:bg-[#dee242] hover:text-[#001f3f] shadow-lg"
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Account Information (Read-only) */}
            <Card className="border border-[#001f3f] rounded-2xl bg-[#f9f9f9] shadow-[0_4px_24px_0_rgba(0,31,63,0.10),0_1.5px_6px_0_rgba(34,34,34,0.08)]">
              <CardHeader className="bg-[#f9f9f9] border-b border-[#e0e0e0]">
                <CardTitle className="text-xl font-bold text-[#001f3f] flex items-center gap-2">
                  <Shield className="h-6 w-6 text-[#001f3f]" />
                  Account Information
                </CardTitle>
                <CardDescription className="text-[#555555]">View your account details</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Email Address</Label>
                  <div className="flex items-center gap-3 px-3 py-2 bg-[#f9f9f9] rounded-md border border-[#e0e0e0]">
                    <Mail className="h-4 w-4 text-[#001f3f]" />
                    <span className="text-sm text-[#001f3f]">{profile?.email ?? "Not available"}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Role</Label>
                  <div className="flex items-center gap-3 px-3 py-2 bg-[#f9f9f9] rounded-md border border-[#e0e0e0]">
                    <Shield className="h-4 w-4 text-[#001f3f]" />
                    <span className="text-sm text-[#001f3f] capitalize">
                      {profile?.role ? profile.role.replace("_", " ") : "N/A"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Status</Label>
                  <div className="flex items-center gap-3 px-3 py-2 bg-[#f9f9f9] rounded-md border border-[#e0e0e0]">
                    <CheckCircle className="h-4 w-4 text-[#dee242]" />
                    <span className="text-sm text-[#001f3f] capitalize">{profile?.status ?? "N/A"}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Member Since</Label>
                  <div className="flex items-center gap-3 px-3 py-2 bg-[#f9f9f9] rounded-md border border-[#e0e0e0]">
                    <Clock className="h-4 w-4 text-[#001f3f]" />
                    <span className="text-sm text-[#001f3f]">
                      {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "N/A"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Last Login</Label>
                  <div className="flex items-center gap-3 px-3 py-2 bg-[#f9f9f9] rounded-md border border-[#e0e0e0]">
                    <Clock className="h-4 w-4 text-[#001f3f]" />
                    <span className="text-sm text-[#001f3f]">
                      {profile?.last_login_at ? new Date(profile.last_login_at).toLocaleDateString() : "Never"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Change Password */}
            <Card className="border border-[#001f3f] rounded-2xl bg-[#f9f9f9] shadow-[0_4px_24px_0_rgba(0,31,63,0.10),0_1.5px_6px_0_rgba(34,34,34,0.08)]">
              <CardHeader className="bg-[#f9f9f9] border-b border-[#e0e0e0]">
                <CardTitle className="text-xl font-bold text-[#001f3f] flex items-center gap-2">
                  <Settings className="h-6 w-6 text-[#001f3f]" />
                  Change Password
                </CardTitle>
                <CardDescription className="text-[#555555]">Update your account password</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {passwordError && (
                  <Alert variant="destructive" className="border-[#ee3433] bg-[#fffbe6]">
                    <AlertCircle className="h-4 w-4 text-[#ee3433]" />
                    <AlertDescription className="text-[#ee3433]">{passwordError}</AlertDescription>
                  </Alert>
                )}

                {passwordSuccess && (
                  <Alert className="border-[#dee242] bg-[#fffbe6]">
                    <CheckCircle className="h-4 w-4 text-[#dee242]" />
                    <AlertDescription className="text-[#dee242]">{passwordSuccess}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword" className="text-sm font-medium text-gray-700">
                      <span className="text-[#001f3f]">Current Password</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showPassword.current ? "text" : "password"}
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                        disabled={isChangingPassword}
                        placeholder="Enter current password"
                        className="border-[#e0e0e0] text-[#001f3f] focus:border-[#001f3f] focus:ring-[#001f3f] bg-white pr-10"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        className="absolute right-2 top-2 text-gray-500 hover:text-gray-900"
                        onClick={() => setShowPassword((prev) => ({ ...prev, current: !prev.current }))}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                      >
                        {showPassword.current ? "👁️" : "🙈"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-sm font-medium text-gray-700">
                      <span className="text-[#001f3f]">New Password</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showPassword.new ? "text" : "password"}
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                        disabled={isChangingPassword}
                        placeholder="Enter new password (min 6 characters)"
                        className="border-[#e0e0e0] text-[#001f3f] focus:border-[#001f3f] focus:ring-[#001f3f] bg-white pr-10"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        className="absolute right-2 top-2 text-gray-500 hover:text-gray-900"
                        onClick={() => setShowPassword((prev) => ({ ...prev, new: !prev.new }))}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                      >
                        {showPassword.new ? "👁️" : "🙈"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                      <span className="text-[#001f3f]">Confirm New Password</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showPassword.confirm ? "text" : "password"}
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                        disabled={isChangingPassword}
                        placeholder="Confirm new password"
                        className="border-[#e0e0e0] text-[#001f3f] focus:border-[#001f3f] focus:ring-[#001f3f] bg-white pr-10"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        className="absolute right-2 top-2 text-gray-500 hover:text-gray-900"
                        onClick={() => setShowPassword((prev) => ({ ...prev, confirm: !prev.confirm }))}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                      >
                        {showPassword.confirm ? "👁️" : "🙈"}
                      </button>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleChangePassword}
                  disabled={isChangingPassword}
                  className="w-full bg-[#001f3f] text-white hover:bg-[#ee3433] shadow-lg border border-[#001f3f]"
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
