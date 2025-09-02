import React, { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import { 
  ChevronUp, 
  ChevronDown, 
  ChevronsUpDown,
  Download,
  Search,
  X
} from 'lucide-react'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { LoadingSpinner, SkeletonTable } from '../common/LoadingSpinner'
import { ErrorDisplay } from '../common/ErrorBoundary'
import { getPaginationMeta } from '@/lib/utils/pagination'
import type { DataTableProps, ColumnDef, SortConfig } from './types'

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  error,
  pagination,
  sorting = [],
  filters = {},
  onSortChange,
  onFilterChange,
  onPageChange,
  onPageSizeChange,
  searchable = true,
  searchPlaceholder = 'Search...',
  onSearch,
  exportable = false,
  onExport,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  bulkActions = [],
  emptyMessage = 'No data available',
  className = '',
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('')
  const [localFilters, setLocalFilters] = useState<Record<string, any>>({})

  // Handle sorting
  const handleSort = (columnId: string) => {
    if (!onSortChange) return

    const existingSort = sorting.find(s => s.field === columnId)
    let newSorting: SortConfig[]

    if (!existingSort) {
      // Add new sort
      newSorting = [...sorting, { field: columnId, direction: 'ASC' }]
    } else if (existingSort.direction === 'ASC') {
      // Change to DESC
      newSorting = sorting.map(s => 
        s.field === columnId ? { ...s, direction: 'DESC' } : s
      )
    } else {
      // Remove sort
      newSorting = sorting.filter(s => s.field !== columnId)
    }

    onSortChange(newSorting)
  }

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (onSearch) {
      onSearch(query)
    }
  }

  // Handle filter changes
  const handleFilterChange = (columnId: string, value: any) => {
    const newFilters = { ...localFilters, [columnId]: value }
    if (value === '' || value === null || value === undefined) {
      delete newFilters[columnId]
    }
    setLocalFilters(newFilters)
    if (onFilterChange) {
      onFilterChange(newFilters)
    }
  }

  // Handle selection
  const isRowSelected = (row: T) => {
    if (!selectable) return false
    return selectedRows.some(selected => 
      JSON.stringify(selected) === JSON.stringify(row)
    )
  }

  const handleRowSelect = (row: T, checked: boolean) => {
    if (!onSelectionChange) return

    if (checked) {
      onSelectionChange([...selectedRows, row])
    } else {
      onSelectionChange(selectedRows.filter(selected => 
        JSON.stringify(selected) !== JSON.stringify(row)
      ))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return

    if (checked) {
      onSelectionChange(data)
    } else {
      onSelectionChange([])
    }
  }

  const isAllSelected = selectedRows.length === data.length && data.length > 0
  const isSomeSelected = selectedRows.length > 0 && selectedRows.length < data.length

  // Get sort icon for column
  const getSortIcon = (columnId: string) => {
    const sortConfig = sorting.find(s => s.field === columnId)
    if (!sortConfig) return <ChevronsUpDown className="h-4 w-4" />
    return sortConfig.direction === 'ASC' 
      ? <ChevronUp className="h-4 w-4" />
      : <ChevronDown className="h-4 w-4" />
  }

  // Render cell content
  const renderCell = (column: ColumnDef<T>, row: T) => {
    if (column.cell) {
      const value = column.accessorKey ? row[column.accessorKey] : undefined
      return column.cell(value, row)
    }

    if (column.accessorKey) {
      const value = row[column.accessorKey]
      if (value === null || value === undefined) {
        return <span className="text-muted-foreground">—</span>
      }
      return String(value)
    }

    return null
  }

  // Show loading state
  if (loading) {
    return <SkeletonTable rows={10} cols={columns.length} />
  }

  // Show error state
  if (error) {
    return (
      <div className="border rounded-lg p-8">
        <ErrorDisplay error={error} />
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          {/* Search */}
          {searchable && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9"
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearch('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {/* Active filters */}
          {Object.keys(localFilters).length > 0 && (
            <div className="flex items-center gap-2">
              {Object.entries(localFilters).map(([key, value]) => (
                <Badge key={key} variant="secondary" className="gap-1">
                  {key}: {String(value)}
                  <button
                    onClick={() => handleFilterChange(key, null)}
                    className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Bulk actions */}
          {selectedRows.length > 0 && bulkActions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedRows.length} selected
              </span>
              {bulkActions.map((action, index) => (
                <Button
                  key={index}
                  variant={action.variant || 'outline'}
                  size="sm"
                  onClick={() => action.action(selectedRows)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}

          {/* Export */}
          {exportable && onExport && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onExport('csv')}
              >
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onExport('excel')}
              >
                <Download className="h-4 w-4 mr-2" />
                Excel
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              {/* Selection column */}
              {selectable && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={isAllSelected}
                    indeterminate={isSomeSelected}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
              )}

              {/* Data columns */}
              {columns.map((column) => (
                <TableHead
                  key={column.id}
                  className={`${column.sortable ? 'cursor-pointer select-none' : ''} ${
                    column.align === 'center' ? 'text-center' :
                    column.align === 'right' ? 'text-right' : ''
                  }`}
                  style={{
                    width: column.width,
                    minWidth: column.minWidth,
                    maxWidth: column.maxWidth,
                  }}
                  onClick={() => column.sortable && handleSort(column.id)}
                >
                  <div className="flex items-center gap-2">
                    {column.header}
                    {column.sortable && getSortIcon(column.id)}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="text-center py-12 text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, index) => (
                <TableRow
                  key={index}
                  data-state={isRowSelected(row) ? 'selected' : undefined}
                >
                  {/* Selection column */}
                  {selectable && (
                    <TableCell>
                      <Checkbox
                        checked={isRowSelected(row)}
                        onCheckedChange={(checked) => 
                          handleRowSelect(row, checked as boolean)
                        }
                      />
                    </TableCell>
                  )}

                  {/* Data columns */}
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={
                        column.align === 'center' ? 'text-center' :
                        column.align === 'right' ? 'text-right' : ''
                      }
                    >
                      {renderCell(column, row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} results
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              Previous
            </Button>
            
            <div className="flex items-center gap-1">
              {(() => {
                const paginationMeta = getPaginationMeta(pagination.page, pagination.totalPages, 5)
                const { range, showStartEllipsis, showEndEllipsis, showFirstPage, showLastPage } = paginationMeta
                
                return (
                  <>
                    {/* First page */}
                    {showFirstPage && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onPageChange?.(1)}
                        >
                          1
                        </Button>
                        {showStartEllipsis && (
                          <span className="px-2 text-muted-foreground">...</span>
                        )}
                      </>
                    )}
                    
                    {/* Page range */}
                    {range.map((pageNum) => (
                      <Button
                        key={pageNum}
                        variant={pageNum === pagination.page ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onPageChange?.(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    ))}
                    
                    {/* Last page */}
                    {showLastPage && (
                      <>
                        {showEndEllipsis && (
                          <span className="px-2 text-muted-foreground">...</span>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onPageChange?.(pagination.totalPages)}
                        >
                          {pagination.totalPages}
                        </Button>
                      </>
                    )}
                  </>
                )
              })()}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}