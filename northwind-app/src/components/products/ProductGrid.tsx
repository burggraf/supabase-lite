// import React from 'react'
import { Card, CardContent, CardHeader } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Edit, Eye, Trash2, Package, AlertTriangle } from 'lucide-react'
import { SkeletonCard } from '../common/LoadingSpinner'
import { ErrorDisplay } from '../common/ErrorBoundary'
import type { ProductWithDetails } from '../../lib/database/repositories'

interface ProductGridProps {
  products: ProductWithDetails[]
  loading?: boolean
  error?: string
  onEdit?: (product: ProductWithDetails) => void
  onDelete?: (product: ProductWithDetails) => void
  onView?: (product: ProductWithDetails) => void
}

export function ProductGrid({
  products,
  loading,
  error,
  onEdit,
  onDelete,
  onView
}: ProductGridProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value)
  }

  const getStockStatus = (product: ProductWithDetails) => {
    const stock = product.units_in_stock || 0
    const reorderLevel = product.reorder_level || 0
    
    if (stock === 0) {
      return { 
        label: 'Out of Stock', 
        variant: 'destructive' as const, 
        icon: AlertTriangle,
        className: 'bg-red-100 text-red-800 border-red-200'
      }
    } else if (stock <= reorderLevel) {
      return { 
        label: 'Low Stock', 
        variant: 'secondary' as const, 
        icon: AlertTriangle,
        className: 'bg-yellow-100 text-yellow-800 border-yellow-200'
      }
    }
    return { 
      label: 'In Stock', 
      variant: 'default' as const, 
      icon: Package,
      className: 'bg-green-100 text-green-800 border-green-200'
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (error) {
    return <ErrorDisplay error={error} />
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-lg font-medium text-muted-foreground">No products found</p>
        <p className="text-sm text-muted-foreground mt-2">
          Add your first product to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {products.map((product) => {
        const stockStatus = getStockStatus(product)
        const StockIcon = stockStatus.icon

        return (
          <Card key={product.product_id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-sm leading-tight mb-1">
                    {product.product_name}
                  </h3>
                  {product.category_name && (
                    <p className="text-xs text-muted-foreground">
                      {product.category_name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => onView?.(product)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => onEdit?.(product)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => onDelete?.(product)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3">
              {/* Price */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Price:</span>
                <span className="font-semibold">
                  {product.unit_price ? formatCurrency(product.unit_price) : '—'}
                </span>
              </div>

              {/* Stock Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Stock:</span>
                <div className="flex items-center gap-2">
                  <Badge className={`gap-1 ${stockStatus.className}`}>
                    <StockIcon className="h-3 w-3" />
                    {stockStatus.label}
                  </Badge>
                </div>
              </div>

              {/* Units in Stock */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Available:</span>
                <span className="text-sm font-medium">
                  {product.units_in_stock || 0} units
                </span>
              </div>

              {/* Supplier */}
              {product.supplier_name && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Supplier:</span>
                  <span className="text-sm truncate max-w-32" title={product.supplier_name}>
                    {product.supplier_name}
                  </span>
                </div>
              )}

              {/* Unit Description */}
              {product.quantity_per_unit && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    {product.quantity_per_unit}
                  </p>
                </div>
              )}

              {/* Status Badges */}
              <div className="flex items-center gap-2 pt-2">
                <Badge variant={product.discontinued ? 'secondary' : 'default'}>
                  {product.discontinued ? 'Discontinued' : 'Active'}
                </Badge>
                {product.units_on_order && product.units_on_order > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {product.units_on_order} on order
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}