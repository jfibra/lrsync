export type UserRole = "super_admin" | "admin" | "secretary"
export type UserStatus = "active" | "inactive" | "suspended"

export interface UserProfile {
  id: string
  auth_user_id: string | null
  email?: string | null
  first_name: string | null
  last_name: string | null
  full_name: string | null
  role: UserRole
  assigned_area: string | null
  status: UserStatus
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface CombinedUser extends UserProfile {
  email?: string
  auth_created_at?: string
}
