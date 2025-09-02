"use client"

import { useState, useEffect } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardHeader } from "@/components/dashboard-header"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Edit, Trash2, Settings, Package } from "lucide-react"
import { toast } from "sonner"

interface PurchaseCategory {
  id: string
  category: string
  is_default: boolean
  is_deleted: boolean
  created_at: string
  updated_at: string
  user_full_name: string | null
  user_area: string | null
}

export default function AdminSettingsPage() {
  const { profile } = useAuth()
  const [categories, setCategories] = useState<PurchaseCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<PurchaseCategory | null>(null)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [editCategoryName, setEditCategoryName] = useState("")

  const fetchCategories = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("purchases_categories")
        .select("*")
        .eq("is_deleted", false)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true })

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error("Error fetching categories:", error)
      toast.error("Failed to fetch categories")
    } finally {
      setLoading(false)
    }
  }

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Category name is required")
      return
    }

    try {
      const { error } = await supabase.from("purchases_categories").insert({
        category: newCategoryName.trim(),
        is_default: false,
        user_uuid: profile?.auth_user_id,
        user_full_name: profile?.full_name,
        user_area: profile?.assigned_area,
      })

      if (error) throw error

      toast.success("Category added successfully")
      setNewCategoryName("")
      setIsAddModalOpen(false)
      fetchCategories()
    } catch (error) {
      console.error("Error adding category:", error)
      toast.error("Failed to add category")
    }
  }

  const handleEditCategory = async () => {
    if (!editCategoryName.trim() || !selectedCategory) {
      toast.error("Category name is required")
      return
    }

    if (selectedCategory.is_default) {
      toast.error("Default categories cannot be edited")
      return
    }

    try {
      const { error } = await supabase
        .from("purchases_categories")
        .update({
          category: editCategoryName.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedCategory.id)

      if (error) throw error

      toast.success("Category updated successfully")
      setEditCategoryName("")
      setSelectedCategory(null)
      setIsEditModalOpen(false)
      fetchCategories()
    } catch (error) {
      console.error("Error updating category:", error)
      toast.error("Failed to update category")
    }
  }

  const handleDeleteCategory = async (category: PurchaseCategory) => {
    if (category.is_default) {
      toast.error("Default categories cannot be deleted")
      return
    }

    if (!confirm("Are you sure you want to delete this category?")) {
      return
    }

    try {
      const { error } = await supabase
        .from("purchases_categories")
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", category.id)

      if (error) throw error

      toast.success("Category deleted successfully")
      fetchCategories()
    } catch (error) {
      console.error("Error deleting category:", error)
      toast.error("Failed to delete category")
    }
  }

  const openEditModal = (category: PurchaseCategory) => {
    if (category.is_default) {
      toast.error("Default categories cannot be edited")
      return
    }
    setSelectedCategory(category)
    setEditCategoryName(category.category)
    setIsEditModalOpen(true)
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <DashboardHeader />

        <div className="pt-20 px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Section */}
          <div className="bg-white/80 backdrop-blur-sm border-l-4 border-l-blue-600 p-6 mb-8 rounded-r-xl shadow-xl hover:shadow-2xl transition-shadow duration-300">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-xl text-white shadow-lg">
                <Settings className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                  Admin Settings
                </h1>
                <p className="text-gray-600 text-lg">Manage system configurations and settings</p>
              </div>
            </div>
          </div>

          {/* Purchase Categories Management */}
          <Card className="bg-white/80 backdrop-blur-sm border-2 border-blue-200 shadow-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-gradient-to-r from-green-500 to-green-600 p-2 rounded-lg text-white">
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-xl text-gray-900">Purchase Categories</CardTitle>
                    <CardDescription>Manage categories for purchase records</CardDescription>
                  </div>
                </div>
                <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Category
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-white">
                    <DialogHeader>
                      <DialogTitle className="text-[#001f3f]">Add New Category</DialogTitle>
                      <DialogDescription>Create a new purchase category</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <Input
                        placeholder="Enter category name"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        className="bg-white text-[#001f3f]"
                        onKeyPress={(e) => e.key === "Enter" && handleAddCategory()}
                      />
                    </div>
                    <DialogFooter>
                      <Button variant="outline" className="bg-white text-[#001f3f]" onClick={() => setIsAddModalOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddCategory} className="text-white bg-[#001f3f] hover:bg-[#001f3f]">
                        Add Category
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Created Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-medium text-[#001f3f]">{category.category}</TableCell>
                        <TableCell>
                          {category.is_default ? (
                            <Badge className="bg-blue-100 text-blue-800">Default</Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-800">Custom</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-[#001f3f]">{category.user_full_name || "System"}</TableCell>
                        <TableCell className="text-[#001f3f]">{new Date(category.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditModal(category)}
                              disabled={category.is_default}
                              className="hover:bg-blue-50"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteCategory(category)}
                              disabled={category.is_default}
                              className="hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Edit Modal */}
          <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
            <DialogContent className="bg-white text-[#001f3f]">
              <DialogHeader>
                <DialogTitle>Edit Category</DialogTitle>
                <DialogDescription>Update the category name</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Input
                  placeholder="Enter category name"
                  value={editCategoryName}
                  onChange={(e) => setEditCategoryName(e.target.value)}
                  className="bg-white text-[#001f3f]"
                  onKeyPress={(e) => e.key === "Enter" && handleEditCategory()}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" className="bg-white" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleEditCategory} className="bg-blue-600 hover:bg-blue-700">
                  Update Category
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </ProtectedRoute>
  )
}
