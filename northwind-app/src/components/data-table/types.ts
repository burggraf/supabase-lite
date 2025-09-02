export interface SortConfig {
  field: string
  direction: 'ASC' | 'DESC'
}

export interface FilterConfig {
  [key: string]: any
}

export interface PaginationConfig {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ColumnDef<T> {
  id: string
  header: string | React.ReactNode
  accessorKey?: keyof T
  cell?: (value: any, row: T) => React.ReactNode
  sortable?: boolean
  filterable?: boolean
  filterType?: 'text' | 'select' | 'date' | 'number'
  filterOptions?: Array<{ label: string; value: any }>
  width?: string | number
  minWidth?: string | number
  maxWidth?: string | number
  align?: 'left' | 'center' | 'right'
}

export interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  loading?: boolean
  error?: string
  pagination?: PaginationConfig
  sorting?: SortConfig[]
  filters?: FilterConfig
  onSortChange?: (sorting: SortConfig[]) => void
  onFilterChange?: (filters: FilterConfig) => void
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  searchable?: boolean
  searchPlaceholder?: string
  onSearch?: (query: string) => void
  exportable?: boolean
  onExport?: (format: 'csv' | 'excel') => void
  selectable?: boolean
  selectedRows?: T[]
  onSelectionChange?: (selectedRows: T[]) => void
  bulkActions?: Array<{
    label: string
    action: (selectedRows: T[]) => void
    variant?: 'default' | 'destructive'
  }>
  emptyMessage?: string
  className?: string
}