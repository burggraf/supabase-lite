import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  Grid3X3, 
  List,
  Filter
} from 'lucide-react'
import { ProductTable } from '@/components/products/ProductTable'
import { ProductGrid } from '@/components/products/ProductGrid'
import { ProductForm } from '@/components/forms/ProductForm'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { 
  useProductsWithDetails, 
  useProductManagement, 
  useLowStockProducts,
  useDiscontinuedProducts 
} from '@/hooks/useProducts'
import { useDatabase } from '@/hooks/useDatabase'
import type { ProductWithDetails } from '@/lib/database/repositories'

export function Products() {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductWithDetails | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({})
  const [currentPage, setCurrentPage] = useState(1)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [showFilters, setShowFilters] = useState(false)
  const pageSize = 20

  // Database connection status
  const { isConnected, isInitialized, isLoading: dbLoading } = useDatabase()

  // Product data hooks
  const {
    data: productsData,
    isLoading: productsLoading,
    error: productsError,
    refetch: refetchProducts
  } = useProductsWithDetails({
    pagination: { page: currentPage, limit: pageSize },
    search: searchQuery ? {
      fields: ['product_name', 'category_name', 'supplier_name'],
      query: searchQuery
    } : undefined,
    filters
  })

  // Low stock products for alerts
  const { data: lowStockData } = useLowStockProducts({ pagination: { page: 1, limit: 10 } })
  
  // Discontinued products for stats
  const { data: discontinuedData } = useDiscontinuedProducts({ pagination: { page: 1, limit: 1 } })

  // Product management operations
  const productManagement = useProductManagement()

  // Handle create product
  const handleCreate = async (productData: any) => {
    try {
      await productManagement.create(productData)
      setShowCreateForm(false)
      refetchProducts()
    } catch (error) {
      console.error('Failed to create product:', error)
      throw error
    }
  }

  // Handle edit product
  const handleEdit = async (productData: any) => {
    if (!editingProduct) return

    try {
      await productManagement.update({
        productId: editingProduct.product_id,
        data: productData
      })
      setEditingProduct(null)
      refetchProducts()
    } catch (error) {
      console.error('Failed to update product:', error)
      throw error
    }
  }

  // Handle delete product
  const handleDelete = async (product: ProductWithDetails) => {
    if (!confirm(`Are you sure you want to delete ${product.product_name}?`)) {
      return
    }

    try {
      await productManagement.delete(product.product_id)
      refetchProducts()
    } catch (error) {
      console.error('Failed to delete product:', error)
      alert('Failed to delete product. Please try again.')
    }
  }

  // Handle view product (navigate to detail page)
  const handleView = (product: ProductWithDetails) => {
    console.log('View product:', product)
    // TODO: Navigate to product detail page
  }

  // Handle export
  const handleExport = (format: 'csv' | 'excel') => {
    console.log('Export products as:', format)
    // TODO: Implement export functionality
  }

  // Show loading state if database is not ready
  if (dbLoading || !isConnected || !isInitialized) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Products</h1>
            <p className="text-gray-600 mt-2">Loading product catalog...</p>
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
  if (showCreateForm || editingProduct) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {editingProduct ? 'Edit Product' : 'New Product'}
            </h1>
            <p className="text-gray-600 mt-2">
              {editingProduct 
                ? `Update information for ${editingProduct.product_name}` 
                : 'Add a new product to your catalog'
              }
            </p>
          </div>
        </div>
        
        <ErrorBoundary>
          <ProductForm
            product={editingProduct || undefined}
            onSubmit={editingProduct ? handleEdit : handleCreate}
            isLoading={productManagement.isLoading}
            onCancel={() => {
              setShowCreateForm(false)
              setEditingProduct(null)
            }}
            submitLabel={editingProduct ? 'Update Product' : 'Create Product'}
          />
        </ErrorBoundary>
      </div>
    )
  }

  // Calculate summary stats
  const totalProducts = productsData?.total || 0
  const lowStockCount = lowStockData?.total || 0
  const discontinuedCount = discontinuedData?.total || 0
  const activeProducts = totalProducts - discontinuedCount

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Products</h1>
            <p className="text-gray-600 mt-2">
              Manage your product catalog and inventory.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === 'table' ? 'grid' : 'table')}
            >
              {viewMode === 'table' ? (
                <>
                  <Grid3X3 className="h-4 w-4 mr-2" />
                  Grid View
                </>
              ) : (
                <>
                  <List className="h-4 w-4 mr-2" />
                  Table View
                </>
              )}
            </Button>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalProducts.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {activeProducts} active, {discontinuedCount} discontinued
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{lowStockCount}</div>
              <p className="text-xs text-muted-foreground">Products need restocking</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Products</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeProducts.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Available for sale</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categories</CardTitle>
              <Filter className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">8</div>
              <p className="text-xs text-muted-foreground">Product categories</p>
            </CardContent>
          </Card>
        </div>

        {/* Low Stock Alerts */}
        {lowStockCount > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <CardTitle className="text-yellow-800">Low Stock Alert</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {lowStockCount} products are running low on stock and may need restocking.
              </p>
              <div className="flex flex-wrap gap-2">
                {lowStockData?.data?.slice(0, 5).map((product) => (
                  <Badge key={product.product_id} variant="secondary" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {product.product_name} ({product.units_in_stock} left)
                  </Badge>
                ))}
                {(lowStockData?.data?.length || 0) > 5 && (
                  <Badge variant="outline">
                    +{(lowStockData?.data?.length || 0) - 5} more
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Product Catalog */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Product Catalog</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'table' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {viewMode === 'table' ? (
              <ProductTable
                products={productsData?.data || []}
                loading={productsLoading}
                error={productsError?.message}
                pagination={productsData ? {
                  page: productsData.page,
                  limit: productsData.limit,
                  total: productsData.total,
                  totalPages: productsData.totalPages
                } : undefined}
                onEdit={setEditingProduct}
                onDelete={handleDelete}
                onView={handleView}
                onPageChange={setCurrentPage}
                onSearch={setSearchQuery}
                onFilterChange={setFilters}
                onExport={handleExport}
              />
            ) : (
              <div className="space-y-4">
                {/* Search for grid view */}
                <div className="flex items-center gap-4">
                  <div className="relative flex-1 max-w-md">
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    />
                  </div>
                </div>
                
                <ProductGrid
                  products={productsData?.data || []}
                  loading={productsLoading}
                  error={productsError?.message}
                  onEdit={setEditingProduct}
                  onDelete={handleDelete}
                  onView={handleView}
                />

                {/* Pagination for grid view */}
                {productsData && (
                  <div className="flex justify-center mt-6">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage <= 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {productsData.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage >= productsData.totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  )
}