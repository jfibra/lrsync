"use client";

import { useState, useEffect, useMemo } from "react";
import { ProtectedRoute } from "@/components/protected-route";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase/client";
import type { UserProfile, UserRole, UserStatus } from "@/types/auth";
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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { logNotification } from "@/utils/logNotification";

interface UserFormData {
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  status: UserStatus;
  assigned_area: string;
}

const initialFormData: UserFormData = {
  email: "",
  first_name: "",
  last_name: "",
  role: "secretary",
  status: "active",
  assigned_area: "",
};

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  // Log notification/audit entry for user management dashboard access (all roles)
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit User Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] =
    useState<UserFormData>(initialFormData);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // Form data
  const [formData, setFormData] = useState<UserFormData>(initialFormData);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  const [isSendingMagicLink, setIsSendingMagicLink] = useState<string | null>(
    null
  );

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError("");

      const { data: profiles, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profileError) {
        console.error("Profile fetch error:", profileError);
        setError("Error fetching users: " + profileError.message);
        return;
      }

      console.log("Fetched users:", profiles?.length || 0);
      setUsers(profiles || []);
    } catch (error: any) {
      console.error("Unexpected error:", error);
      setError("An unexpected error occurred: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const filteredUsers = users.filter(
    (user) =>
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.assigned_area?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination calculations
  const totalRecords = filteredUsers.length;
  const totalPages = Math.ceil(totalRecords / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalRecords);
  const currentPageUsers = filteredUsers.slice(startIndex, endIndex);

  // Reset to first page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Reset to first page when page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  // Generate page numbers for pagination
  const getPageNumbers = useMemo(() => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const halfVisible = Math.floor(maxVisiblePages / 2);
      let startPage = Math.max(1, currentPage - halfVisible);
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

      if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }

    return pages;
  }, [currentPage, totalPages]);

  const validateEmail = (email: string): boolean => {
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email) && email.length <= 254;
  };

  const validateForm = (data: UserFormData): string | null => {
    if (!data.first_name.trim()) return "First name is required";
    if (!data.last_name.trim()) return "Last name is required";
    if (!data.email.trim()) return "Email is required";
    if (!validateEmail(data.email)) return "Please enter a valid email address";
    return null;
  };

  const handleCreateUser = async () => {
    try {
      setIsCreating(true);
      setError("");

      const validationError = validateForm(formData);
      if (validationError) {
        setError(validationError);
        return;
      }

      // Check if user already exists by email
      const { data: existingUser, error: checkError } = await supabase
        .from("user_profiles")
        .select("email")
        .eq("email", formData.email.toLowerCase().trim())
        .single();

      if (existingUser) {
        setError(`A user with email "${formData.email}" already exists`);
        return;
      }

      if (checkError && checkError.code !== "PGRST116") {
        setError("Error checking existing users: " + checkError.message);
        return;
      }

      let authUserId = null;

      // Create auth account
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
      });

      if (authError) {
        setError(
          `Authentication account creation failed: ${authError.message}`
        );
        return;
      } else if (authData.user) {
        authUserId = authData.user.id;
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
      };

      const { data: newUser, error: insertError } = await supabase
        .from("user_profiles")
        .insert(profileData)
        .select()
        .single();

      if (insertError) {
        setError("Error creating user profile: " + insertError.message);
        return;
      }

      // Log notification for add user action with correct RPC parameters
      const { error: logError } = await logNotification(supabase, { 
        p_action: "user_created",
        p_description: `User created: ${profileData.full_name} (${profileData.email})`,
        p_ip_address: null,
        p_location: null,
        p_meta: JSON.stringify(profileData),
        p_user_agent:
          typeof window !== "undefined" ? window.navigator.userAgent : "server",
      });
      if (logError) {
        setError("Notification logging failed: " + logError.message);
        // Optionally, you can return here if logging is critical
      }

      setSuccess(
        `User "${formData.first_name} ${formData.last_name}" (${formData.email}) created successfully with login capabilities! Default password: TempPass123! (user should change this)`
      );
      setIsAddModalOpen(false);
      setFormData(initialFormData);
      fetchUsers();
    } catch (error: any) {
      setError("An unexpected error occurred: " + error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditUser = (user: UserProfile) => {
    setEditUser(user);
    setEditFormData({
      email: user.email || "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      role: user.role,
      status: user.status,
      assigned_area: user.assigned_area || "",
    });
    setEditModalOpen(true);
    setEditError("");
  };

  const handleEditUserSave = async () => {
    if (!editUser) return;
    setEditLoading(true);
    setEditError("");
    try {
      // Validate
      const validationError = validateForm(editFormData);
      if (validationError) {
        setEditError(validationError);
        return;
      }
      // Check if email is being changed and if new email already exists
      if (
        editFormData.email.toLowerCase().trim() !==
        (editUser.email || "").toLowerCase()
      ) {
        const { data: existingUser } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("email", editFormData.email.toLowerCase().trim())
          .neq("id", editUser.id)
          .single();
        if (existingUser) {
          setEditError(
            `Email "${editFormData.email}" is already in use by another user`
          );
          return;
        }
      }
      // Update user_profiles
      const { error: updateProfileError } = await supabase
        .from("user_profiles")
        .update({
          email: editFormData.email.toLowerCase().trim(),
          first_name: editFormData.first_name.trim(),
          last_name: editFormData.last_name.trim(),
          full_name: `${editFormData.first_name.trim()} ${editFormData.last_name.trim()}`,
          role: editFormData.role,
          status: editFormData.status,
          assigned_area: editFormData.assigned_area.trim() || null,
        })
        .eq("id", editUser.id);
      if (updateProfileError) {
        setEditError(
          "Error updating user profile: " + updateProfileError.message
        );
        return;
      }
      // If email changed, update auth.users
      if (
        editFormData.email.toLowerCase().trim() !==
          (editUser.email || "").toLowerCase() &&
        editUser.auth_user_id
      ) {
        const { error: updateAuthError } =
          await supabase.auth.admin.updateUserById(editUser.auth_user_id, {
            email: editFormData.email.toLowerCase().trim(),
          });
        if (updateAuthError) {
          setEditError(
            "Error updating authentication email: " + updateAuthError.message
          );
          return;
        }
      }
      setEditModalOpen(false);
      setEditUser(null);
      setSuccess("User updated successfully!");
      fetchUsers();
    } catch (error: any) {
      setEditError("An unexpected error occurred: " + error.message);
    } finally {
      setEditLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    try {
      setIsUpdating(true);
      setError("");

      if (!editingUser) return;

      const validationError = validateForm(formData);
      if (validationError) {
        setError(validationError);
        return;
      }

      // Check if email is being changed and if new email already exists
      if (
        formData.email.toLowerCase().trim() !== editingUser.email?.toLowerCase()
      ) {
        const { data: existingUser } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("email", formData.email.toLowerCase().trim())
          .neq("id", editingUser.id)
          .single();

        if (existingUser) {
          setError(
            `Email "${formData.email}" is already in use by another user`
          );
          return;
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
        .eq("id", editingUser.id);

      if (updateError) {
        setError("Error updating user: " + updateError.message);
        return;
      }

      setSuccess("User updated successfully!");
      setIsEditModalOpen(false);
      setEditingUser(null);
      setFormData(initialFormData);
      fetchUsers();
    } catch (error: any) {
      setError("An unexpected error occurred: " + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteUser = async (user: UserProfile) => {
    try {
      setIsDeleting(true);
      setError("");

      const { error: deleteError } = await supabase
        .from("user_profiles")
        .delete()
        .eq("id", user.id);

      if (deleteError) {
        setError("Error deleting user: " + deleteError.message);
        return;
      }

      // Log notification for user deletion
      const { error: logError } = await logNotification(supabase, { 
        p_action: "user_deleted",
        p_description: `User deleted: ${
          user.full_name || user.email || user.id
        }`,
        p_ip_address: null,
        p_location: null,
        p_meta: JSON.stringify({ user_id: user.id, email: user.email }),
        p_user_agent:
          typeof window !== "undefined" ? window.navigator.userAgent : "server",
      });
      if (logError) {
        setError("Notification logging failed: " + logError.message);
      }

      setSuccess(
        `User ${user.full_name || user.first_name} deleted successfully!`
      );
      fetchUsers();
    } catch (error: any) {
      setError("An unexpected error occurred: " + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleQuickStatusUpdate = async (
    userId: string,
    newStatus: UserStatus
  ) => {
    try {
      setError("");
      const user = users.find((u) => u.id === userId);
      const prevStatus = user?.status;
      const { error } = await supabase
        .from("user_profiles")
        .update({ status: newStatus })
        .eq("id", userId);
      if (error) {
        setError("Error updating status: " + error.message);
        return;
      }
      // Log notification for status change
      const { error: logError } = await logNotification(supabase, { 
        p_action: "user_status_changed",
        p_description: `User status changed for ${
          user?.full_name || userId
        }: ${prevStatus} → ${newStatus}`,
        p_ip_address: null,
        p_location: null,
        p_meta: JSON.stringify({
          user_id: userId,
          prev_status: prevStatus,
          new_status: newStatus,
        }),
        p_user_agent:
          typeof window !== "undefined" ? window.navigator.userAgent : "server",
      });
      if (logError) {
        setError("Notification logging failed: " + logError.message);
      }
      setSuccess("Status updated successfully");
      fetchUsers();
    } catch (error: any) {
      setError("An unexpected error occurred");
    }
  };

  const handleQuickRoleUpdate = async (userId: string, newRole: UserRole) => {
    try {
      setError("");
      const user = users.find((u) => u.id === userId);
      const prevRole = user?.role;
      const { error } = await supabase
        .from("user_profiles")
        .update({ role: newRole })
        .eq("id", userId);
      if (error) {
        setError("Error updating role: " + error.message);
        return;
      }
      // Log notification for role change
      const { error: logError } = await logNotification(supabase, { 
        p_action: "user_role_changed",
        p_description: `User role changed for ${
          user?.full_name || userId
        }: ${prevRole} → ${newRole}`,
        p_ip_address: null,
        p_location: null,
        p_meta: JSON.stringify({
          user_id: userId,
          prev_role: prevRole,
          new_role: newRole,
        }),
        p_user_agent:
          typeof window !== "undefined" ? window.navigator.userAgent : "server",
      });
      if (logError) {
        setError("Notification logging failed: " + logError.message);
      }
      setSuccess("Role updated successfully");
      fetchUsers();
    } catch (error: any) {
      setError("An unexpected error occurred");
    }
  };

  const handleSendMagicLink = async (user: UserProfile) => {
    try {
      setIsSendingMagicLink(user.id);
      setError("");

      if (!user.email) {
        setError("Cannot send magic link: User has no email address");
        return;
      }

      // Send magic link using Supabase Auth
      const { error: magicLinkError } = await supabase.auth.signInWithOtp({
        email: user.email,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (magicLinkError) {
        setError("Error sending magic link: " + magicLinkError.message);
        return;
      }

      setSuccess(`Magic link sent successfully to ${user.email}!`);
    } catch (error: any) {
      setError("An unexpected error occurred while sending magic link");
    } finally {
      setIsSendingMagicLink(null);
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingUser(null);
    setError("");
    setSuccess("");
  };

  // Calculate stats
  const totalUsers = users.length;
  const activeUsers = users.filter((user) => user.status === "active").length;
  const adminUsers = users.filter(
    (user) => user.role === "admin" || user.role === "super_admin"
  ).length;

  useEffect(() => {
    (async () => {
      try {
        // Try to get current user profile from the first loaded user (super admin only)
        const currentUser =
          users.find((u) => u.role === "super_admin") || users[0];
        if (currentUser) {
          await logNotification(supabase, { 
            action: "user_management_access",
            description: `User management dashboard accessed by ${
              currentUser.full_name || currentUser.first_name || currentUser.id
            }`,
            user_agent:
              typeof window !== "undefined"
                ? window.navigator.userAgent
                : "server",
            meta: JSON.stringify({
              user_id: currentUser.id,
              role: currentUser.role || "unknown",
              dashboard: "user_management",
            }),
          });
        }
      } catch (logError) {
        console.error("Error logging notification:", logError);
        // Do not block user on logging failure
      }
    })();
    // Only log once when users are loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users]);

  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <div className="min-h-screen bg-[#f9f9f9]">
        <DashboardHeader />

        <div className="pt-20 px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-[#001f3f] rounded-xl shadow-lg">
                <Users className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-[#001f3f]">
                  User Management
                </h1>
                <p className="text-[#001f3f] mt-1">
                  Manage user profiles and permissions across the system
                </p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-[#001f3f] border-0 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#dee242] text-sm font-medium">
                      Total Users
                    </p>
                    <p className="text-3xl font-bold text-white">
                      {totalUsers}
                    </p>
                  </div>
                  <Users className="h-12 w-12 text-[#dee242]" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#dee242] border-0 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#001f3f] text-sm font-medium">
                      Active Users
                    </p>
                    <p className="text-3xl font-bold text-[#001f3f]">
                      {activeUsers}
                    </p>
                  </div>
                  <CheckCircle className="h-12 w-12 text-[#001f3f]" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#ee3433] border-0 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-medium">
                      Admin Users
                    </p>
                    <p className="text-3xl font-bold text-white">
                      {adminUsers}
                    </p>
                  </div>
                  <Shield className="h-12 w-12 text-white" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Alerts */}
          {error && (
            <Alert
              variant="destructive"
              className="mb-6 border-[#ee3433] bg-[#ee3433]/10"
            >
              <AlertCircle className="h-4 w-4 text-[#ee3433]" />
              <AlertDescription className="text-[#ee3433]">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-6 border-[#dee242] bg-[#dee242]/10">
              <CheckCircle className="h-4 w-4 text-[#dee242]" />
              <AlertDescription className="text-[#001f3f]">
                {success}
              </AlertDescription>
            </Alert>
          )}

          {/* Info Alert */}
          <Alert className="mb-6 border-[#001f3f] bg-[#001f3f]/10">
            <Mail className="h-4 w-4 text-[#001f3f]" />
            <AlertDescription className="text-[#001f3f]">
              <strong>Magic Link Feature:</strong> Click the mail icon next to
              any user with an email address to send them a magic link for
              passwordless login.
            </AlertDescription>
          </Alert>

          {/* Main Content Card */}
          <Card className="shadow-2xl border-0 bg-[#ffffff]">
            <CardHeader className="bg-[#f9f9f9] border-b border-[#e0e0e0]">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-2xl font-bold text-[#001f3f] flex items-center gap-2">
                    <Users className="h-6 w-6 text-[#001f3f]" />
                    Users Directory ({users.length})
                  </CardTitle>
                  <CardDescription className="text-[#001f3f] mt-1">
                    Manage user profiles and authentication
                  </CardDescription>
                </div>

                <div className="flex gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#001f3f] h-4 w-4" />
                    <Input
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-full sm:w-64 border-[#e0e0e0] focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] bg-[#ffffff] placeholder-[#001f3f]/60"
                    />
                  </div>
                  <Button
                    onClick={fetchUsers}
                    variant="outline"
                    size="sm"
                    className="border-[#e0e0e0] hover:bg-[#f9f9f9] bg-transparent text-[#001f3f]"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Dialog
                    open={isAddModalOpen}
                    onOpenChange={setIsAddModalOpen}
                  >
                    <DialogTrigger asChild>
                      <Button
                        onClick={resetForm}
                        className="bg-[#001f3f] hover:bg-[#001f3f]/80 text-white shadow-lg"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add User
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
                      <DialogHeader className="pb-6 border-b border-[#e0e0e0]">
                        <DialogTitle className="text-2xl font-bold text-[#001f3f]">
                          Add New User Profile
                        </DialogTitle>
                        <DialogDescription className="text-[#001f3f] mt-2">
                          Create a new user with full authentication
                          capabilities and login access
                        </DialogDescription>
                      </DialogHeader>
                      <div className="max-h-[60vh] overflow-y-auto px-1">
                        <div className="space-y-6 py-6">
                          {/* Personal Information Section */}
                          <div className="bg-[#f9f9f9] p-6 rounded-lg border border-[#e0e0e0]">
                            <h4 className="text-lg font-semibold text-[#001f3f] mb-4">
                              Personal Information
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label
                                  htmlFor="add_first_name"
                                  className="text-sm font-medium text-[#001f3f]"
                                >
                                  First Name *
                                </Label>
                                <Input
                                  id="add_first_name"
                                  value={formData.first_name}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      first_name: e.target.value,
                                    })
                                  }
                                  disabled={isCreating}
                                  placeholder="John"
                                  className="border-[#dee242] focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] bg-[#f9f9f9] placeholder-[#001f3f]/60"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label
                                  htmlFor="add_last_name"
                                  className="text-sm font-medium text-[#001f3f]"
                                >
                                  Last Name *
                                </Label>
                                <Input
                                  id="add_last_name"
                                  value={formData.last_name}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      last_name: e.target.value,
                                    })
                                  }
                                  disabled={isCreating}
                                  placeholder="Doe"
                                  className="border-[#dee242] focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] bg-[#f9f9f9] placeholder-[#001f3f]/60"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Account Information Section */}
                          <div className="bg-[#f9f9f9] p-6 rounded-lg border border-[#e0e0e0]">
                            <h4 className="text-lg font-semibold text-[#001f3f] mb-4">
                              Account Information
                            </h4>
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label
                                  htmlFor="add_email"
                                  className="text-sm font-medium text-[#001f3f]"
                                >
                                  Email Address *
                                </Label>
                                <Input
                                  id="add_email"
                                  type="email"
                                  value={formData.email}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      email: e.target.value
                                        .toLowerCase()
                                        .trim(),
                                    })
                                  }
                                  disabled={isCreating}
                                  placeholder="john.doe@example.com"
                                  className="border-[#dee242] focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] bg-[#f9f9f9] placeholder-[#001f3f]/60"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label
                                    htmlFor="add_role"
                                    className="text-sm font-medium text-[#001f3f]"
                                  >
                                    Role
                                  </Label>
                                  <Select
                                    value={formData.role}
                                    onValueChange={(value: UserRole) =>
                                      setFormData({ ...formData, role: value })
                                    }
                                    disabled={isCreating}
                                  >
                                    <SelectTrigger className="border-[#dee242] focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] bg-[#f9f9f9]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="secretary">
                                        Secretary
                                      </SelectItem>
                                      <SelectItem value="admin">
                                        Admin
                                      </SelectItem>
                                      <SelectItem value="super_admin">
                                        Super Admin
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-2">
                                  <Label
                                    htmlFor="add_status"
                                    className="text-sm font-medium text-[#001f3f]"
                                  >
                                    Status
                                  </Label>
                                  <Select
                                    value={formData.status}
                                    onValueChange={(value: UserStatus) =>
                                      setFormData({
                                        ...formData,
                                        status: value,
                                      })
                                    }
                                    disabled={isCreating}
                                  >
                                    <SelectTrigger className="border-[#dee242] focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] bg-[#f9f9f9]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="active">
                                        Active
                                      </SelectItem>
                                      <SelectItem value="inactive">
                                        Inactive
                                      </SelectItem>
                                      <SelectItem value="suspended">
                                        Suspended
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Work Information Section */}
                          <div className="bg-[#f9f9f9] p-6 rounded-lg border border-[#e0e0e0]">
                            <h4 className="text-lg font-semibold text-[#001f3f] mb-4">
                              Work Information
                            </h4>
                            <div className="space-y-2">
                              <Label
                                htmlFor="add_assigned_area"
                                className="text-sm font-medium text-[#001f3f]"
                              >
                                Assigned Area
                              </Label>
                              <Input
                                id="add_assigned_area"
                                value={formData.assigned_area}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    assigned_area: e.target.value,
                                  })
                                }
                                disabled={isCreating}
                                placeholder="e.g., Metro Manila, Cebu City, Davao Region"
                                className="border-[#dee242] focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] bg-[#f9f9f9] placeholder-[#001f3f]/60"
                              />
                            </div>
                          </div>

                          {/* Authentication Info */}
                          <div className="bg-[#dee242]/20 p-4 rounded-lg border border-[#dee242]">
                            <div className="flex items-center gap-2 mb-2">
                              <Shield className="h-5 w-5 text-[#dee242]" />
                              <p className="text-sm font-medium text-[#001f3f]">
                                Full User Account
                              </p>
                            </div>
                            <ul className="text-xs text-[#001f3f] space-y-1">
                              <li>
                                • Creates both profile and authentication
                                account
                              </li>
                              <li>
                                • User can login with email and default password
                              </li>
                              <li>
                                • Default password: TempPass123! (user should
                                change)
                              </li>
                              <li>
                                • Full access to system based on assigned role
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-3 pt-6 border-t border-[#e0e0e0] bg-[#f9f9f9]">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsAddModalOpen(false);
                            resetForm();
                          }}
                          disabled={isCreating}
                          className="border-[#001f3f] bg-white hover:bg-[#001f3f]/10 px-6 text-[#001f3f]"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleCreateUser}
                          disabled={isCreating}
                          className="bg-[#001f3f] hover:bg-[#001f3f]/80 px-8 text-white shadow-lg"
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
                  <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
                    <DialogContent className="sm:max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
                      <DialogHeader className="pb-6 border-b border-[#e0e0e0]">
                        <DialogTitle className="text-2xl font-bold text-[#001f3f]">
                          Edit User Profile
                        </DialogTitle>
                        <DialogDescription className="text-[#001f3f] mt-2">
                          Update user information. Changing the email will
                          update both the profile and authentication account.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="max-h-[60vh] overflow-y-auto px-1">
                        <div className="space-y-6 py-6">
                          {/* Personal Information Section */}
                          <div className="bg-[#f9f9f9] p-6 rounded-lg border border-[#e0e0e0]">
                            <h4 className="text-lg font-semibold text-[#001f3f] mb-4">
                              Personal Information
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label
                                  htmlFor="edit_first_name"
                                  className="text-sm font-medium text-[#001f3f]"
                                >
                                  First Name *
                                </Label>
                                <Input
                                  id="edit_first_name"
                                  value={editFormData.first_name}
                                  onChange={(e) =>
                                    setEditFormData({
                                      ...editFormData,
                                      first_name: e.target.value,
                                    })
                                  }
                                  disabled={editLoading}
                                  placeholder="John"
                                  className="border-[#dee242] focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] bg-[#f9f9f9] placeholder-[#001f3f]/60"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label
                                  htmlFor="edit_last_name"
                                  className="text-sm font-medium text-[#001f3f]"
                                >
                                  Last Name *
                                </Label>
                                <Input
                                  id="edit_last_name"
                                  value={editFormData.last_name}
                                  onChange={(e) =>
                                    setEditFormData({
                                      ...editFormData,
                                      last_name: e.target.value,
                                    })
                                  }
                                  disabled={editLoading}
                                  placeholder="Doe"
                                  className="border-[#dee242] focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] bg-[#f9f9f9] placeholder-[#001f3f]/60"
                                />
                              </div>
                            </div>
                          </div>
                          {/* Account Information Section */}
                          <div className="bg-[#f9f9f9] p-6 rounded-lg border border-[#e0e0e0]">
                            <h4 className="text-lg font-semibold text-[#001f3f] mb-4">
                              Account Information
                            </h4>
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label
                                  htmlFor="edit_email"
                                  className="text-sm font-medium text-[#001f3f]"
                                >
                                  Email Address *
                                </Label>
                                <Input
                                  id="edit_email"
                                  type="email"
                                  value={editFormData.email}
                                  onChange={(e) =>
                                    setEditFormData({
                                      ...editFormData,
                                      email: e.target.value
                                        .toLowerCase()
                                        .trim(),
                                    })
                                  }
                                  disabled={editLoading}
                                  placeholder="john.doe@example.com"
                                  className="border-[#dee242] focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] bg-[#f9f9f9] placeholder-[#001f3f]/60"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label
                                    htmlFor="edit_role"
                                    className="text-sm font-medium text-[#001f3f]"
                                  >
                                    Role
                                  </Label>
                                  <Select
                                    value={editFormData.role}
                                    onValueChange={(value: UserRole) =>
                                      setEditFormData({
                                        ...editFormData,
                                        role: value,
                                      })
                                    }
                                    disabled={editLoading}
                                  >
                                    <SelectTrigger className="border-[#dee242] focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] bg-[#f9f9f9]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="secretary">
                                        Secretary
                                      </SelectItem>
                                      <SelectItem value="admin">
                                        Admin
                                      </SelectItem>
                                      <SelectItem value="super_admin">
                                        Super Admin
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label
                                    htmlFor="edit_status"
                                    className="text-sm font-medium text-[#001f3f]"
                                  >
                                    Status
                                  </Label>
                                  <Select
                                    value={editFormData.status}
                                    onValueChange={(value: UserStatus) =>
                                      setEditFormData({
                                        ...editFormData,
                                        status: value,
                                      })
                                    }
                                    disabled={editLoading}
                                  >
                                    <SelectTrigger className="border-[#dee242] focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] bg-[#f9f9f9]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="active">
                                        Active
                                      </SelectItem>
                                      <SelectItem value="inactive">
                                        Inactive
                                      </SelectItem>
                                      <SelectItem value="suspended">
                                        Suspended
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                          </div>
                          {/* Work Information Section */}
                          <div className="bg-[#f9f9f9] p-6 rounded-lg border border-[#e0e0e0]">
                            <h4 className="text-lg font-semibold text-[#001f3f] mb-4">
                              Work Information
                            </h4>
                            <div className="space-y-2">
                              <Label
                                htmlFor="edit_assigned_area"
                                className="text-sm font-medium text-[#001f3f]"
                              >
                                Assigned Area
                              </Label>
                              <Input
                                id="edit_assigned_area"
                                value={editFormData.assigned_area}
                                onChange={(e) =>
                                  setEditFormData({
                                    ...editFormData,
                                    assigned_area: e.target.value,
                                  })
                                }
                                disabled={editLoading}
                                placeholder="e.g., Metro Manila, Cebu City, Davao Region"
                                className="border-[#dee242] focus:border-[#001f3f] focus:ring-[#001f3f] text-[#001f3f] bg-[#f9f9f9] placeholder-[#001f3f]/60"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      {editError && (
                        <Alert
                          variant="destructive"
                          className="mb-4 border-[#ee3433] bg-[#ee3433]/10"
                        >
                          <AlertCircle className="h-4 w-4 text-[#ee3433]" />
                          <AlertDescription className="text-[#ee3433]">
                            {editError}
                          </AlertDescription>
                        </Alert>
                      )}
                      <div className="flex justify-end gap-3 pt-6 border-t border-[#e0e0e0] bg-[#f9f9f9]">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditModalOpen(false);
                            setEditUser(null);
                          }}
                          disabled={editLoading}
                          className="border-[#001f3f] bg-white hover:bg-[#001f3f]/10 px-6 text-[#001f3f]"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleEditUserSave}
                          disabled={editLoading}
                          className="bg-[#001f3f] hover:bg-[#001f3f]/80 px-8 text-white shadow-lg"
                        >
                          {editLoading ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Saving...
                            </>
                          ) : (
                            "Save Changes"
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
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#001f3f] mb-4"></div>
                  <p className="text-[#001f3f] font-medium">Loading users...</p>
                </div>
              ) : (
                <>
                  {/* Table Controls */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 border-b border-[#e0e0e0] bg-[#f9f9f9]">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor="pageSize"
                          className="text-sm font-medium text-[#001f3f] whitespace-nowrap"
                        >
                          Show
                        </Label>
                        <Select
                          value={pageSize.toString()}
                          onValueChange={(value) => setPageSize(Number(value))}
                        >
                          <SelectTrigger
                            id="pageSize"
                            className="w-20 border-[#e0e0e0] text-[#001f3f] bg-[#ffffff]"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-sm text-[#001f3f] whitespace-nowrap">
                          entries
                        </span>
                      </div>
                    </div>

                    <div className="text-sm text-[#001f3f]">
                      {totalRecords > 0 ? (
                        <>
                          Showing {startIndex + 1} to {endIndex} of{" "}
                          {totalRecords} records
                          {searchTerm &&
                            ` (filtered from ${users.length} total records)`}
                        </>
                      ) : (
                        "No records found"
                      )}
                    </div>
                  </div>

                  {filteredUsers.length > 0 ? (
                    <>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-[#f9f9f9] border-b border-[#e0e0e0]">
                              <TableHead className="font-semibold text-[#001f3f]">
                                Name
                              </TableHead>
                              <TableHead className="font-semibold text-[#001f3f]">
                                Email
                              </TableHead>
                              <TableHead className="font-semibold text-[#001f3f]">
                                Role
                              </TableHead>
                              <TableHead className="font-semibold text-[#001f3f]">
                                Status
                              </TableHead>
                              <TableHead className="font-semibold text-[#001f3f]">
                                Assigned Area
                              </TableHead>
                              <TableHead className="font-semibold text-[#001f3f]">
                                Created
                              </TableHead>
                              <TableHead className="font-semibold text-[#001f3f]">
                                Actions
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {currentPageUsers.map((user) => (
                              <TableRow
                                key={user.id}
                                className="hover:bg-[#f9f9f9] transition-colors"
                              >
                                <TableCell className="font-medium text-[#001f3f]">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-[#001f3f] rounded-full flex items-center justify-center">
                                      <span className="text-white text-sm font-medium">
                                        {(
                                          user.first_name?.[0] ||
                                          user.full_name?.[0] ||
                                          "U"
                                        ).toUpperCase()}
                                      </span>
                                    </div>
                                    {user.full_name ||
                                      `${user.first_name || ""} ${
                                        user.last_name || ""
                                      }`.trim() ||
                                      "N/A"}
                                  </div>
                                </TableCell>
                                <TableCell className="text-[#001f3f]">
                                  {user.email || "N/A"}
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={user.role}
                                    onValueChange={(value: UserRole) =>
                                      handleQuickRoleUpdate(user.id, value)
                                    }
                                  >
                                    <SelectTrigger className="w-32 border-[#e0e0e0] text-[#001f3f] bg-[#ffffff]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="secretary">
                                        Secretary
                                      </SelectItem>
                                      <SelectItem value="admin">
                                        Admin
                                      </SelectItem>
                                      <SelectItem value="super_admin">
                                        Super Admin
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={user.status}
                                    onValueChange={(value: UserStatus) =>
                                      handleQuickStatusUpdate(user.id, value)
                                    }
                                  >
                                    <SelectTrigger className="w-28 border-[#e0e0e0] text-[#001f3f] bg-[#ffffff]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="active">
                                        Active
                                      </SelectItem>
                                      <SelectItem value="inactive">
                                        Inactive
                                      </SelectItem>
                                      <SelectItem value="suspended">
                                        Suspended
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="text-[#001f3f]">
                                  {user.assigned_area || "N/A"}
                                </TableCell>
                                <TableCell className="text-[#001f3f]">
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-[#001f3f]" />
                                    {new Date(
                                      user.created_at
                                    ).toLocaleDateString()}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    {user.email && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          handleSendMagicLink(user)
                                        }
                                        disabled={
                                          isSendingMagicLink === user.id
                                        }
                                        title="Send Magic Link"
                                        className="text-[#001f3f] hover:bg-[#dee242]/20 hover:text-[#001f3f]"
                                      >
                                        {isSendingMagicLink === user.id ? (
                                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#dee242]"></div>
                                        ) : (
                                          <Mail className="h-4 w-4" />
                                        )}
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditUser(user)}
                                      className="text-[#3dcd8d] hover:bg-[#dee242]/20 hover:text-[#3dcd8d]"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="text-[#ee3433] hover:bg-[#ee3433]/20 hover:text-[#ee3433]"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent className="bg-white">
                                        <AlertDialogHeader>
                                          <AlertDialogTitle className="text-[#ee3433]">
                                            Delete User Profile
                                          </AlertDialogTitle>
                                          <AlertDialogDescription className="text-[#001f3f]">
                                            Are you sure you want to delete the
                                            profile for{" "}
                                            <strong>
                                              {user.full_name ||
                                                `${user.first_name} ${user.last_name}`}
                                            </strong>
                                            ? This action cannot be undone.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel className="text-[#001f3f] bg-white border-[#e0e0e0]">
                                            Cancel
                                          </AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() =>
                                              handleDeleteUser(user)
                                            }
                                            className="bg-[#ee3433] hover:bg-[#ee3433]/80 text-white"
                                            disabled={isDeleting}
                                          >
                                            {isDeleting
                                              ? "Deleting..."
                                              : "Delete Profile"}
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

                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-6 border-t border-[#e0e0e0] bg-[#f9f9f9]">
                          <div className="text-sm text-[#001f3f]">
                            Page {currentPage} of {totalPages}
                          </div>

                          <div className="flex items-center gap-2">
                            {/* First Page */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(1)}
                              disabled={currentPage === 1}
                              className="border-[#e0e0e0] text-[#001f3f] bg-white hover:bg-[#f9f9f9] disabled:opacity-50"
                            >
                              <ChevronsLeft className="h-4 w-4" />
                              <span className="sr-only sm:not-sr-only sm:ml-1">
                                First
                              </span>
                            </Button>

                            {/* Previous Page */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(currentPage - 1)}
                              disabled={currentPage === 1}
                              className="border-[#e0e0e0] text-[#001f3f] bg-white hover:bg-[#f9f9f9] disabled:opacity-50"
                            >
                              <ChevronLeft className="h-4 w-4" />
                              <span className="sr-only sm:not-sr-only sm:ml-1">
                                Previous
                              </span>
                            </Button>

                            {/* Page Numbers */}
                            <div className="flex items-center gap-1">
                              {getPageNumbers.map((pageNum) => (
                                <Button
                                  key={pageNum}
                                  variant={
                                    currentPage === pageNum
                                      ? "default"
                                      : "outline"
                                  }
                                  size="sm"
                                  onClick={() => setCurrentPage(pageNum)}
                                  className={
                                    currentPage === pageNum
                                      ? "bg-[#001f3f] text-white hover:bg-[#001f3f]/80"
                                      : "border-[#e0e0e0] text-[#001f3f] bg-white hover:bg-[#f9f9f9]"
                                  }
                                >
                                  {pageNum}
                                </Button>
                              ))}
                            </div>

                            {/* Next Page */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(currentPage + 1)}
                              disabled={currentPage === totalPages}
                              className="border-[#e0e0e0] text-[#001f3f] bg-white hover:bg-[#f9f9f9] disabled:opacity-50"
                            >
                              <span className="sr-only sm:not-sr-only sm:mr-1">
                                Next
                              </span>
                              <ChevronRight className="h-4 w-4" />
                            </Button>

                            {/* Last Page */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(totalPages)}
                              disabled={currentPage === totalPages}
                              className="border-[#e0e0e0] text-[#001f3f] bg-white hover:bg-[#f9f9f9] disabled:opacity-50"
                            >
                              <span className="sr-only sm:not-sr-only sm:mr-1">
                                Last
                              </span>
                              <ChevronsRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12">
                      <AlertCircle className="h-10 w-10 text-[#001f3f] mb-4" />
                      <p className="text-[#001f3f] font-medium">
                        No users found.
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}
