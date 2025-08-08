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

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth()
  // Log notification/audit entry for profile dashboard access (all roles)
  useEffect(() => {
    if (profile?.id) {
      (async () => {
        try {
          await logNotification(supabase, { 
            action: "profile_dashboard_access",
            description: `Profile dashboard accessed by ${profile.full_name || profile.first_name || profile.id}`,
            user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
            meta: JSON.stringify({
              user_id: profile.id,
              role: profile.role || "unknown",
              dashboard: "profile_management",
            }),
          })
        } catch (logError) {
          console.error("Error logging notification:", logError)
          // Do not block user on logging failure
        }
      })()
    }
    // Only log once when profile is available
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])
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
        // Log failed update
        try {
          await logNotification(supabase, { 
            p_action: "profile_updated",
            p_description: `Failed profile update for user ${profile.full_name || profile.id}`,
            p_ip_address: null,
            p_location: null,
            p_user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
            p_meta: JSON.stringify({ error: updateError.message, updateData }),
          })
        } catch (logError) {
          console.error("Error logging notification (profile update failed):", logError)
        }
        return
      }

      setSuccess("Profile updated successfully!")
      setIsEditing(false)

      // Log successful update
      try {
        await logNotification(supabase, { 
          p_action: "profile_updated",
          p_description: `Profile updated for user ${profile.full_name || profile.id}`,
          p_ip_address: null,
          p_location: null,
          p_user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
          p_meta: JSON.stringify({ updateData }),
        })
      } catch (logError) {
        console.error("Error logging notification (profile update success):", logError)
      }

      // Refresh the profile data
      await refreshProfile()
    } catch (error) {
      setError("An unexpected error occurred")
      // Log unexpected error
      try {
        await logNotification(supabase, { 
          p_action: "profile_updated",
          p_description: `Unexpected error during profile update for user ${profile?.full_name || profile?.id}`,
          p_ip_address: null,
          p_location: null,
          p_user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
          p_meta: JSON.stringify({ error }),
        })
      } catch (logError) {
        console.error("Error logging notification (profile update error):", logError)
      }
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
        // Log failed password change
        try {
          await logNotification(supabase, { 
            p_action: "password_changed",
            p_description: `Failed password change for user ${profile?.full_name || profile?.id}`,
            p_ip_address: null,
            p_location: null,
            p_user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
            p_meta: JSON.stringify({ error: signInError.message }),
          })
        } catch (logError) {
          console.error("Error logging notification (password change failed):", logError)
        }
        return
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      })

      if (updateError) {
        setPasswordError("Error updating password: " + updateError.message)
        // Log failed password update
        try {
          await logNotification(supabase, { 
            p_action: "password_changed",
            p_description: `Error updating password for user ${profile?.full_name || profile?.id}`,
            p_ip_address: null,
            p_location: null,
            p_user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
            p_meta: JSON.stringify({ error: updateError.message }),
          })
        } catch (logError) {
          console.error("Error logging notification (password update failed):", logError)
        }
        return
      }

      setPasswordSuccess("Password updated successfully!")
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })

      // Log successful password change
      try {
        await logNotification(supabase, { 
          p_action: "password_changed",
          p_description: `Password changed for user ${profile?.full_name || profile?.id}`,
          p_ip_address: null,
          p_location: null,
          p_user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
          p_meta: JSON.stringify({}),
        })
      } catch (logError) {
        console.error("Error logging notification (password change success):", logError)
      }
    } catch (error) {
      setPasswordError("An unexpected error occurred")
      // Log unexpected error
      try {
        await logNotification(supabase, { 
          p_action: "password_changed",
          p_description: `Unexpected error during password change for user ${profile?.full_name || profile?.id}`,
          p_ip_address: null,
          p_location: null,
          p_user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
          p_meta: JSON.stringify({ error }),
        })
      } catch (logError) {
        console.error("Error logging notification (password change error):", logError)
      }
    } finally {
      setIsChangingPassword(false)
    }
  }

  if (!profile) {
    return (
      <ProtectedRoute allowedRoles={["super_admin"]}>
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
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <div className="min-h-screen bg-[#ffffff]">
        <DashboardHeader />

        <div className="pt-20 px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-[#001f3f] rounded-xl shadow-lg">
                <User className="h-8 w-8 text-[#ffffff]" />
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
              <CheckCircle className="h-4 w-4 text-[#ee3433]" />
              <AlertDescription className="text-[#001f3f]">{success}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {/* Profile Information */}
            <Card className="shadow-2xl border-0 bg-[#f9f9f9] backdrop-blur-sm">
              <CardHeader className="bg-[#f9f9f9] border-b border-[#e0e0e0]">
                <CardTitle className="text-xl font-bold text-[#001f3f] flex items-center gap-2">
                  <Settings className="h-6 w-6 text-[#ee3433]" />
                  Profile Information
                </CardTitle>
                <CardDescription className="text-[#555555]">Update your personal details</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name" className="text-sm font-medium text-[#001f3f]">
                      First Name *
                    </Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      disabled={!isEditing || isSaving}
                      placeholder="Enter first name"
                      className="border-[#e0e0e0] focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] placeholder:text-[#e0e0e0] bg-[#ffffff]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name" className="text-sm font-medium text-[#001f3f]">
                      Last Name *
                    </Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      disabled={!isEditing || isSaving}
                      placeholder="Enter last name"
                      className="border-[#e0e0e0] focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] placeholder:text-[#e0e0e0] bg-[#ffffff]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assigned_area" className="text-sm font-medium text-[#001f3f]">
                    Assigned Area
                  </Label>
                  <Input
                    id="assigned_area"
                    value={formData.assigned_area}
                    onChange={(e) => setFormData({ ...formData, assigned_area: e.target.value })}
                    disabled={!isEditing || isSaving}
                    placeholder="e.g., Metro Manila, Cebu City, Davao Region"
                    className="border-[#e0e0e0] focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] placeholder:text-[#e0e0e0] bg-[#ffffff]"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  {!isEditing ? (
                    <Button
                      onClick={() => setIsEditing(true)}
                      className="bg-[#001f3f] text-[#ffffff] hover:bg-[#ee3433] border border-[#001f3f] shadow-lg"
                    >
                      Edit Profile
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-[#001f3f] text-[#ffffff] hover:bg-[#ee3433] border border-[#001f3f] shadow-lg"
                      >
                        {isSaving ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#ffffff] mr-2"></div>
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
                        className="bg-[#ffffff] text-[#001f3f] border border-[#001f3f] hover:bg-[#f9f9f9]"
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Account Information (Read-only) */}
            <Card className="shadow-2xl border-0 bg-[#f9f9f9] backdrop-blur-sm">
              <CardHeader className="bg-[#f9f9f9] border-b border-[#e0e0e0]">
                <CardTitle className="text-xl font-bold text-[#001f3f] flex items-center gap-2">
                  <Shield className="h-6 w-6 text-[#ee3433]" />
                  Account Information
                </CardTitle>
                <CardDescription className="text-[#555555]">View your account details</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#001f3f]">Email Address</Label>
                  <div className="flex items-center gap-3 px-3 py-2 bg-[#f9f9f9] rounded-md border border-[#e0e0e0]">
                    <Mail className="h-4 w-4 text-[#001f3f]" />
                    <span className="text-sm text-[#001f3f]">{profile.email || "Not available"}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#001f3f]">Role</Label>
                  <div className="flex items-center gap-3 px-3 py-2 bg-[#f9f9f9] rounded-md border border-[#e0e0e0]">
                    <Shield className="h-4 w-4 text-[#001f3f]" />
                    <span className="text-sm text-[#001f3f] capitalize">{profile.role.replace("_", " ")}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#001f3f]">Status</Label>
                  <div className="flex items-center gap-3 px-3 py-2 bg-[#f9f9f9] rounded-md border border-[#e0e0e0]">
                    <CheckCircle className="h-4 w-4 text-[#dee242]" />
                    <span className="text-sm text-[#001f3f] capitalize">{profile.status}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#001f3f]">Member Since</Label>
                  <div className="flex items-center gap-3 px-3 py-2 bg-[#f9f9f9] rounded-md border border-[#e0e0e0]">
                    <Clock className="h-4 w-4 text-[#001f3f]" />
                    <span className="text-sm text-[#001f3f]">{new Date(profile.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#001f3f]">Last Login</Label>
                  <div className="flex items-center gap-3 px-3 py-2 bg-[#f9f9f9] rounded-md border border-[#e0e0e0]">
                    <Clock className="h-4 w-4 text-[#001f3f]" />
                    <span className="text-sm text-[#001f3f]">
                      {profile.last_login_at ? new Date(profile.last_login_at).toLocaleDateString() : "Never"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Change Password */}
            <Card className="shadow-2xl border-0 bg-[#f9f9f9] backdrop-blur-sm">
              <CardHeader className="bg-[#f9f9f9] border-b border-[#e0e0e0]">
                <CardTitle className="text-xl font-bold text-[#001f3f] flex items-center gap-2">
                  <Settings className="h-6 w-6 text-[#ee3433]" />
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
                    <AlertDescription className="text-[#001f3f]">{passwordSuccess}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword" className="text-sm font-medium text-[#001f3f]">
                      Current Password
                    </Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      disabled={isChangingPassword}
                      placeholder="Enter current password"
                      className="border-[#e0e0e0] focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] placeholder:text-[#e0e0e0] bg-[#ffffff]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-sm font-medium text-[#001f3f]">
                      New Password
                    </Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      disabled={isChangingPassword}
                      placeholder="Enter new password (min 6 characters)"
                      className="border-[#e0e0e0] focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] placeholder:text-[#e0e0e0] bg-[#ffffff]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-medium text-[#001f3f]">
                      Confirm New Password
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      disabled={isChangingPassword}
                      placeholder="Confirm new password"
                      className="border-[#e0e0e0] focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] placeholder:text-[#e0e0e0] bg-[#ffffff]"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleChangePassword}
                  disabled={isChangingPassword}
                  className="w-full bg-[#001f3f] text-[#ffffff] hover:bg-[#ee3433] border border-[#001f3f] shadow-lg"
                >
                  {isChangingPassword ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#ffffff] mr-2"></div>
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
