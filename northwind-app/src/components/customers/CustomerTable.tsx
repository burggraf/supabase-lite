import { useState } from 'react'
import { DataTable } from '../data-table/DataTable'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { MoreHorizontal, Edit, Trash2, Eye, Phone, Mail } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import type { ColumnDef } from '../data-table/types'
import type { Customer } from '../../lib/database/repositories'

interface CustomerTableProps {
  customers: Customer[]
  loading?: boolean
  error?: string
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  onEdit?: (customer: Customer) => void
  onDelete?: (customer: Customer) => void
  onView?: (customer: Customer) => void
  onPageChange?: (page: number) => void
  onSearch?: (query: string) => void
  onFilterChange?: (filters: any) => void
  onExport?: (format: 'csv' | 'excel') => void
}

export function CustomerTable({
  customers,
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
}: CustomerTableProps) {
  const [selectedCustomers, setSelectedCustomers] = useState<Customer[]>([])

  const columns: ColumnDef<Customer>[] = [
    {
      id: 'customer_id',
      header: 'Customer ID',
      accessorKey: 'customer_id',
      sortable: true,
      cell: (value) => (
        <div className="font-mono font-medium">{value}</div>
      ),
      width: 120,
    },
    {
      id: 'company_name',
      header: 'Company Name',
      accessorKey: 'company_name',
      sortable: true,
      cell: (value, row) => (
        <div>
          <div className="font-medium">{value}</div>
          {row.contact_name && (
            <div className="text-sm text-muted-foreground">
              {row.contact_name}
              {row.contact_title && ` • ${row.contact_title}`}
            </div>
          )}
        </div>
      ),
      width: 300,
    },
    {
      id: 'location',
      header: 'Location',
      cell: (_, row) => {
        const location = [row.city, row.region, row.country]
          .filter(Boolean)
          .join(', ')
        return location || <span className="text-muted-foreground">—</span>
      },
      width: 200,
    },
    {
      id: 'contact_info',
      header: 'Contact',
      cell: (_, row) => (
        <div className="flex flex-col gap-1">
          {row.phone && (
            <div className="flex items-center gap-1 text-sm">
              <Phone className="h-3 w-3 text-muted-foreground" />
              {row.phone}
            </div>
          )}
          {row.fax && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Mail className="h-3 w-3" />
              {row.fax}
            </div>
          )}
        </div>
      ),
      width: 180,
    },
    {
      id: 'status',
      header: 'Status',
      cell: () => (
        <Badge variant="secondary" className="bg-green-100 text-green-800">
          Active
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
              Edit Customer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete?.(row)}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Customer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      width: 50,
    },
  ]

  const bulkActions = [
    {
      label: `Delete ${selectedCustomers.length} customers`,
      action: (customers: Customer[]) => {
        // Handle bulk delete
        console.log('Bulk delete:', customers)
      },
      variant: 'destructive' as const,
    },
    {
      label: `Export ${selectedCustomers.length} customers`,
      action: (customers: Customer[]) => {
        // Handle bulk export
        console.log('Bulk export:', customers)
      },
    },
  ]

  return (
    <DataTable
      data={customers}
      columns={columns}
      loading={loading}
      error={error}
      pagination={pagination}
      onPageChange={onPageChange}
      searchable
      searchPlaceholder="Search customers by name, ID, or location..."
      onSearch={onSearch}
      exportable
      onExport={onExport}
      selectable
      selectedRows={selectedCustomers}
      onSelectionChange={setSelectedCustomers}
      bulkActions={bulkActions}
      emptyMessage="No customers found. Create your first customer to get started."
      onFilterChange={onFilterChange}
    />
  )
}