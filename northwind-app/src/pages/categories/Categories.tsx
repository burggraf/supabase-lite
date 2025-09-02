import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Edit, Trash2, Package } from 'lucide-react'
import { DataTable } from '@/components/data-table/DataTable'
import { CategoryForm } from '@/components/forms/CategoryForm'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { useCategories, useCategoryManagement } from '@/hooks/useReferenceData'
import type { Category } from '@/lib/database/repositories'

export function Categories() {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20


  // Category data
  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    error: categoriesError,
    refetch: refetchCategories
  } = useCategories({
    pagination: { page: currentPage, limit: pageSize },
    search: searchQuery ? {
      fields: ['category_name', 'description'],
      query: searchQuery
    } : undefined
  })

  // Category management operations
  const categoryManagement = useCategoryManagement()

  // Handle create category
  const handleCreate = async (categoryData: any) => {
    try {
      await categoryManagement.create(categoryData)
      setShowCreateForm(false)
      refetchCategories()
    } catch (error) {
      console.error('Failed to create category:', error)
      throw error
    }
  }

  // Handle edit category
  const handleEdit = async (categoryData: any) => {
    if (!editingCategory) return

    try {
      await categoryManagement.update({
        categoryId: editingCategory.category_id,
        data: categoryData
      })
      setEditingCategory(null)
      refetchCategories()
    } catch (error) {
      console.error('Failed to update category:', error)
      throw error
    }
  }

  // Handle delete category
  const handleDelete = async (category: Category) => {
    if (!confirm(`Are you sure you want to delete "${category.category_name}"? This action cannot be undone.`)) {
      return
    }

    try {
      await categoryManagement.delete(category.category_id)
      refetchCategories()
    } catch (error) {
      console.error('Failed to delete category:', error)
      alert('Failed to delete category. It may be referenced by existing products.')
    }
  }


  // Show create/edit form
  if (showCreateForm || editingCategory) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {editingCategory ? 'Edit Category' : 'New Category'}
            </h1>
            <p className="text-gray-600 mt-2">
              {editingCategory 
                ? `Update information for ${editingCategory.category_name}` 
                : 'Add a new category to organize your products'
              }
            </p>
          </div>
        </div>
        
        <ErrorBoundary>
          <CategoryForm
            category={editingCategory || undefined}
            onSubmit={editingCategory ? handleEdit : handleCreate}
            isLoading={categoryManagement.isLoading}
            onCancel={() => {
              setShowCreateForm(false)
              setEditingCategory(null)
            }}
            submitLabel={editingCategory ? 'Update Category' : 'Create Category'}
          />
        </ErrorBoundary>
      </div>
    )
  }

  // Define table columns
  const columns = [
    {
      id: 'category_name',
      header: 'Category Name',
      accessorKey: 'category_name' as keyof Category,
      sortable: true,
      cell: (value: any, row: Category) => (
        <div className="font-medium text-gray-900">{value}</div>
      )
    },
    {
      id: 'description',
      header: 'Description',
      accessorKey: 'description' as keyof Category,
      sortable: true,
      cell: (value: any, row: Category) => (
        <div className="text-gray-600 max-w-md truncate">
          {value || 'No description'}
        </div>
      )
    },
    {
      id: 'product_count',
      header: 'Products',
      cell: (value: any, row: Category) => (
        <Badge variant="secondary" className="gap-1">
          <Package className="h-3 w-3" />
          <span>-- products</span>
        </Badge>
      )
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (value: any, row: Category) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditingCategory(row)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(row)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ]

  const totalCategories = categoriesData?.total || 0

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Categories</h1>
            <p className="text-gray-600 mt-2">
              Organize your products into categories for better management.
            </p>
          </div>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Categories</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCategories}</div>
              <p className="text-xs text-muted-foreground">
                Product organization
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Most Popular</CardTitle>
              <Badge className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground">Category with most products</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Empty Categories</CardTitle>
              <Search className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground">Categories without products</p>
            </CardContent>
          </Card>
        </div>

        {/* Categories Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Product Categories</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search categories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-4 py-2 border rounded-md text-sm w-64"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              data={categoriesData?.data || []}
              columns={columns}
              loading={categoriesLoading}
              error={categoriesError?.message}
              pagination={categoriesData ? {
                page: categoriesData.page,
                limit: categoriesData.limit,
                total: categoriesData.total,
                totalPages: categoriesData.totalPages
              } : undefined}
              onPageChange={setCurrentPage}
            />
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  )
}