import React, { useState } from 'react'
import { DataTable } from '../data-table/DataTable'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { MoreHorizontal, Edit, Trash2, Eye, AlertTriangle, Package } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import type { ColumnDef } from '../data-table/types'
import type { ProductWithDetails } from '../../lib/database/repositories'

interface ProductTableProps {
  products: ProductWithDetails[]
  loading?: boolean
  error?: string
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  onEdit?: (product: ProductWithDetails) => void
  onDelete?: (product: ProductWithDetails) => void
  onView?: (product: ProductWithDetails) => void
  onPageChange?: (page: number) => void
  onSearch?: (query: string) => void
  onFilterChange?: (filters: any) => void
  onExport?: (format: 'csv' | 'excel') => void
}

export function ProductTable({
  products,
  loading,
  error,
  pagination,
  onEdit,
  onDelete,
  onView,
  onPageChange,
  onSearch,
  onFilterChange,
  onExport
}: ProductTableProps) {
  const [selectedProducts, setSelectedProducts] = useState<ProductWithDetails[]>([])

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
      return { label: 'Out of Stock', variant: 'destructive' as const, icon: AlertTriangle }
    } else if (stock <= reorderLevel) {
      return { label: 'Low Stock', variant: 'secondary' as const, icon: AlertTriangle }
    }
    return { label: 'In Stock', variant: 'default' as const, icon: Package }
  }

  const columns: ColumnDef<ProductWithDetails>[] = [
    {
      id: 'product_name',
      header: 'Product',
      accessorKey: 'product_name',
      sortable: true,
      cell: (value, row) => (
        <div>
          <div className="font-medium">{value}</div>
          {row.category_name && (
            <div className="text-sm text-muted-foreground">
              {row.category_name}
            </div>
          )}
        </div>
      ),
      width: 250,
    },
    {
      id: 'supplier',
      header: 'Supplier',
      cell: (_, row) => row.supplier_name || <span className="text-muted-foreground">—</span>,
      width: 200,
    },
    {
      id: 'unit_price',
      header: 'Price',
      accessorKey: 'unit_price',
      sortable: true,
      cell: (value) => (
        <div className="font-medium">
          {value ? formatCurrency(value) : <span className="text-muted-foreground">—</span>}
        </div>
      ),
      align: 'right',
      width: 100,
    },
    {
      id: 'stock_status',
      header: 'Stock',
      cell: (_, row) => {
        const status = getStockStatus(row)
        const Icon = status.icon
        return (
          <div className="flex items-center gap-2">
            <Badge variant={status.variant} className="gap-1">
              <Icon className="h-3 w-3" />
              {status.label}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {row.units_in_stock || 0} units
            </span>
          </div>
        )
      },
      width: 150,
    },
    {
      id: 'quantity_per_unit',
      header: 'Unit',
      accessorKey: 'quantity_per_unit',
      cell: (value) => (
        <div className="text-sm">
          {value || <span className="text-muted-foreground">—</span>}
        </div>
      ),
      width: 150,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (_, row) => (
        <Badge variant={row.discontinued ? 'secondary' : 'default'}>
          {row.discontinued ? 'Discontinued' : 'Active'}
        </Badge>
      ),
      width: 100,
    },
    {
      id: 'actions',
      header: '',
      cell: (_, row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => onView?.(row)}
              className="cursor-pointer"
            >
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onEdit?.(row)}
              className="cursor-pointer"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Product
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete?.(row)}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Product
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      width: 50,
    },
  ]

  const bulkActions = [
    {
      label: `Delete ${selectedProducts.length} products`,
      action: (products: ProductWithDetails[]) => {
        console.log('Bulk delete products:', products)
      },
      variant: 'destructive' as const,
    },
    {
      label: `Export ${selectedProducts.length} products`,
      action: (products: ProductWithDetails[]) => {
        console.log('Bulk export products:', products)
      },
    },
    {
      label: `Discontinue ${selectedProducts.length} products`,
      action: (products: ProductWithDetails[]) => {
        console.log('Bulk discontinue products:', products)
      },
      variant: 'default' as const,
    },
  ]

  return (
    <DataTable
      data={products}
      columns={columns}
      loading={loading}
      error={error}
      pagination={pagination}
      onPageChange={onPageChange}
      searchable
      searchPlaceholder="Search products by name, category, or supplier..."
      onSearch={onSearch}
      exportable
      onExport={onExport}
      selectable
      selectedRows={selectedProducts}
      onSelectionChange={setSelectedProducts}
      bulkActions={bulkActions}
      emptyMessage="No products found. Add your first product to get started."
      onFilterChange={onFilterChange}
    />
  )
}