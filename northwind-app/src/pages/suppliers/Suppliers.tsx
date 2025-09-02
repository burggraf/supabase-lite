import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Edit, Trash2, Building2, Phone, Globe, MapPin } from 'lucide-react'
import { DataTable } from '@/components/data-table/DataTable'
import { SupplierForm } from '@/components/forms/SupplierForm'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { useSuppliers, useSupplierManagement } from '@/hooks/useReferenceData'
import type { Supplier } from '@/lib/database/repositories'

export function Suppliers() {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20


  // Supplier data
  const {
    data: suppliersData,
    isLoading: suppliersLoading,
    error: suppliersError,
    refetch: refetchSuppliers
  } = useSuppliers({
    pagination: { page: currentPage, limit: pageSize },
    search: searchQuery ? {
      fields: ['company_name', 'contact_name', 'city', 'country'],
      query: searchQuery
    } : undefined
  })

  // Supplier management operations
  const supplierManagement = useSupplierManagement()

  // Handle create supplier
  const handleCreate = async (supplierData: any) => {
    try {
      await supplierManagement.create(supplierData)
      setShowCreateForm(false)
      refetchSuppliers()
    } catch (error) {
      console.error('Failed to create supplier:', error)
      throw error
    }
  }

  // Handle edit supplier
  const handleEdit = async (supplierData: any) => {
    if (!editingSupplier) return

    try {
      await supplierManagement.update({
        supplierId: editingSupplier.supplier_id,
        data: supplierData
      })
      setEditingSupplier(null)
      refetchSuppliers()
    } catch (error) {
      console.error('Failed to update supplier:', error)
      throw error
    }
  }

  // Handle delete supplier
  const handleDelete = async (supplier: Supplier) => {
    if (!confirm(`Are you sure you want to delete "${supplier.company_name}"? This action cannot be undone.`)) {
      return
    }

    try {
      await supplierManagement.delete(supplier.supplier_id)
      refetchSuppliers()
    } catch (error) {
      console.error('Failed to delete supplier:', error)
      alert('Failed to delete supplier. It may be referenced by existing products.')
    }
  }


  // Show create/edit form
  if (showCreateForm || editingSupplier) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {editingSupplier ? 'Edit Supplier' : 'New Supplier'}
            </h1>
            <p className="text-gray-600 mt-2">
              {editingSupplier 
                ? `Update information for ${editingSupplier.company_name}` 
                : 'Add a new supplier to your vendor network'
              }
            </p>
          </div>
        </div>
        
        <ErrorBoundary>
          <SupplierForm
            supplier={editingSupplier || undefined}
            onSubmit={editingSupplier ? handleEdit : handleCreate}
            isLoading={supplierManagement.isLoading}
            onCancel={() => {
              setShowCreateForm(false)
              setEditingSupplier(null)
            }}
            submitLabel={editingSupplier ? 'Update Supplier' : 'Create Supplier'}
          />
        </ErrorBoundary>
      </div>
    )
  }

  // Define table columns
  const columns = [
    {
      id: 'company_name',
      header: 'Company',
      accessorKey: 'company_name' as keyof Supplier,
      sortable: true,
      cell: (value: any, row: Supplier) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          {row.contact_name && (
            <div className="text-sm text-gray-500">{row.contact_name}</div>
          )}
          {row.contact_title && (
            <div className="text-xs text-gray-400">{row.contact_title}</div>
          )}
        </div>
      )
    },
    {
      id: 'location',
      header: 'Location',
      cell: (value: any, row: Supplier) => (
        <div className="text-sm">
          {row.city && row.country ? (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3 text-gray-400" />
              <span>{row.city}, {row.country}</span>
            </div>
          ) : row.country ? (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3 text-gray-400" />
              <span>{row.country}</span>
            </div>
          ) : (
            <span className="text-gray-400">--</span>
          )}
        </div>
      )
    },
    {
      id: 'contact',
      header: 'Contact',
      accessorKey: 'phone' as keyof Supplier,
      cell: (value: any, row: Supplier) => (
        <div className="text-sm space-y-1">
          {value && (
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3 text-gray-400" />
              <span>{value}</span>
            </div>
          )}
          {row.home_page && (
            <div className="flex items-center gap-1">
              <Globe className="h-3 w-3 text-gray-400" />
              <a 
                href={row.home_page} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Website
              </a>
            </div>
          )}
          {!value && !row.home_page && (
            <span className="text-gray-400">--</span>
          )}
        </div>
      )
    },
    {
      id: 'products',
      header: 'Products',
      cell: (value: any, row: Supplier) => (
        <Badge variant="secondary" className="gap-1">
          <Building2 className="h-3 w-3" />
          <span>-- products</span>
        </Badge>
      )
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (value: any, row: Supplier) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditingSupplier(row)}
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

  const totalSuppliers = suppliersData?.total || 0

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Suppliers</h1>
            <p className="text-gray-600 mt-2">
              Manage your vendor network and supplier relationships.
            </p>
          </div>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Supplier
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Suppliers</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSuppliers}</div>
              <p className="text-xs text-muted-foreground">
                Active vendors
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Countries</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground">Global reach</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">With Websites</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground">Online presence</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Supplier</CardTitle>
              <Badge className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground">Most products supplied</p>
            </CardContent>
          </Card>
        </div>

        {/* Suppliers Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Supplier Directory</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search suppliers..."
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
              data={suppliersData?.data || []}
              columns={columns}
              loading={suppliersLoading}
              error={suppliersError?.message}
              pagination={suppliersData ? {
                page: suppliersData.page,
                limit: suppliersData.limit,
                total: suppliersData.total,
                totalPages: suppliersData.totalPages
              } : undefined}
              onPageChange={setCurrentPage}
            />
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  )
}