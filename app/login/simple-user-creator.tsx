"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/lib/supabase/client"
import type { UserRole, UserStatus } from "@/types/auth"
import { UserPlus, CheckCircle, AlertCircle } from "lucide-react"

export function SimpleUserCreator() {
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    role: "secretary" as UserRole,
    status: "active" as UserStatus,
  })
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const hashPassword = async (password: string): Promise<string> => {
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hashBuffer = await crypto.subtle.digest("SHA-256", data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setIsCreating(true)

    try {
      // Validate
      if (!newUser.email || !newUser.password || !newUser.first_name || !newUser.last_name) {
        setError("Please fill in all required fields")
        return
      }

      // Hash password
      const hashedPassword = await hashPassword(newUser.password)

      // Insert directly into users table
      const { error: insertError } = await supabase.from("users").insert({
        email: newUser.email,
        password: hashedPassword,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        full_name: `${newUser.first_name} ${newUser.last_name}`.trim(),
        role: newUser.role,
        status: newUser.status,
      })

      if (insertError) {
        setError("Error creating user: " + insertError.message)
        return
      }

      setSuccess(`User ${newUser.email} created successfully! You can now try to sign in.`)

      // Reset form
      setNewUser({
        email: "",
        password: "",
        first_name: "",
        last_name: "",
        role: "secretary",
        status: "active",
      })
    } catch (error) {
      setError("Unexpected error: " + (error as Error).message)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Quick User Creator
        </CardTitle>
        <CardDescription>Create user profile only (no auth account)</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCreateUser} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quick_first_name">First Name</Label>
              <Input
                id="quick_first_name"
                value={newUser.first_name}
                onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
                required
                disabled={isCreating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick_last_name">Last Name</Label>
              <Input
                id="quick_last_name"
                value={newUser.last_name}
                onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
                required
                disabled={isCreating}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quick_email">Email</Label>
            <Input
              id="quick_email"
              type="email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              required
              disabled={isCreating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quick_password">Password</Label>
            <Input
              id="quick_password"
              type="password"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              required
              disabled={isCreating}
              minLength={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quick_role">Role</Label>
            <Select
              value={newUser.role}
              onValueChange={(value: UserRole) => setNewUser({ ...newUser, role: value })}
              disabled={isCreating}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="secretary">Secretary</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={isCreating}>
            {isCreating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating...
              </>
            ) : (
              "Create User Profile"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
