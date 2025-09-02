import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Users, TrendingUp, DollarSign } from 'lucide-react'
import { CustomerTable } from '@/components/customers/CustomerTable'
import { CustomerForm } from '@/components/forms/CustomerForm'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { useCustomers, useCustomerManagement, useTopCustomers } from '@/hooks/useCustomers'
import { useDatabase } from '@/hooks/useDatabase'
import type { Customer } from '@/lib/database/repositories'

export function Customers() {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({})
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20

  // Database connection status
  const { isConnected, isInitialized, isLoading: dbLoading } = useDatabase()

  // Customer data hooks
  const {
    data: customersData,
    isLoading: customersLoading,
    error: customersError,
    refetch: refetchCustomers
  } = useCustomers({
    pagination: { page: currentPage, limit: pageSize },
    search: searchQuery ? {
      fields: ['company_name', 'customer_id', 'contact_name', 'city', 'country'],
      query: searchQuery
    } : undefined,
    filters
  })

  // Top customers for stats
  const { data: topCustomers } = useTopCustomers(5)

  // Customer management operations
  const customerManagement = useCustomerManagement()

  // Handle create customer
  const handleCreate = async (customerData: any) => {
    try {
      await customerManagement.create(customerData)
      setShowCreateForm(false)
      refetchCustomers()
    } catch (error) {
      console.error('Failed to create customer:', error)
      throw error
    }
  }

  // Handle edit customer
  const handleEdit = async (customerData: any) => {
    if (!editingCustomer) return

    try {
      await customerManagement.update({
        customerId: editingCustomer.customer_id,
        data: customerData
      })
      setEditingCustomer(null)
      refetchCustomers()
    } catch (error) {
      console.error('Failed to update customer:', error)
      throw error
    }
  }

  // Handle delete customer
  const handleDelete = async (customer: Customer) => {
    if (!confirm(`Are you sure you want to delete ${customer.company_name}?`)) {
      return
    }

    try {
      await customerManagement.delete(customer.customer_id)
      refetchCustomers()
    } catch (error) {
      console.error('Failed to delete customer:', error)
      alert('Failed to delete customer. Please try again.')
    }
  }

  // Handle view customer (navigate to detail page)
  const handleView = (customer: Customer) => {
    console.log('View customer:', customer)
    // TODO: Navigate to customer detail page
  }

  // Handle export
  const handleExport = (format: 'csv' | 'excel') => {
    console.log('Export customers as:', format)
    // TODO: Implement export functionality
  }

  // Show loading state if database is not ready
  if (dbLoading || !isConnected || !isInitialized) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
            <p className="text-gray-600 mt-2">Loading customer data...</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Initializing database connection...
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show create/edit form
  if (showCreateForm || editingCustomer) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {editingCustomer ? 'Edit Customer' : 'New Customer'}
            </h1>
            <p className="text-gray-600 mt-2">
              {editingCustomer 
                ? `Update information for ${editingCustomer.company_name}` 
                : 'Add a new customer to your database'
              }
            </p>
          </div>
        </div>
        
        <ErrorBoundary>
          <CustomerForm
            customer={editingCustomer || undefined}
            onSubmit={editingCustomer ? handleEdit : handleCreate}
            isLoading={customerManagement.isLoading}
            onCancel={() => {
              setShowCreateForm(false)
              setEditingCustomer(null)
            }}
            submitLabel={editingCustomer ? 'Update Customer' : 'Create Customer'}
          />
        </ErrorBoundary>
      </div>
    )
  }

  // Calculate summary stats
  const totalCustomers = customersData?.total || 0
  const activeCustomers = totalCustomers // All customers are active in this demo
  const topCustomerSpending = topCustomers?.reduce((sum, customer) => sum + customer.totalSpent, 0) || 0

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
            <p className="text-gray-600 mt-2">
              Manage your customer relationships and contact information.
            </p>
          </div>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCustomers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Active customer accounts</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeCustomers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Recently active customers</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Customer Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${topCustomerSpending.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Combined spending of top 5 customers</p>
            </CardContent>
          </Card>
        </div>

        {/* Customer Table */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Directory</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomerTable
              customers={customersData?.data || []}
              loading={customersLoading}
              error={customersError?.message}
              pagination={customersData ? {
                page: customersData.page,
                limit: customersData.limit,
                total: customersData.total,
                totalPages: customersData.totalPages
              } : undefined}
              onEdit={setEditingCustomer}
              onDelete={handleDelete}
              onView={handleView}
              onPageChange={setCurrentPage}
              onSearch={setSearchQuery}
              onFilterChange={setFilters}
              onExport={handleExport}
            />
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  )
}