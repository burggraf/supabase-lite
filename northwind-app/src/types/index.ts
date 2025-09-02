export interface QueryResult {
  rows: any[]
  rowCount: number
  command: string
  fields: Array<{ name: string; dataTypeID: number }>
}

export interface DatabaseConnection {
  id: string
  name: string
  status: 'connected' | 'disconnected' | 'connecting' | 'error'
  lastAccess?: Date
}

// Domain types
export interface Customer {
  customer_id: string
  company_name: string
  contact_name?: string
  contact_title?: string
  address?: string
  city?: string
  region?: string
  postal_code?: string
  country?: string
  phone?: string
  fax?: string
}

export interface Category {
  category_id: number
  category_name: string
  description?: string
  picture?: Buffer
}

export interface Supplier {
  supplier_id: number
  company_name: string
  contact_name?: string
  contact_title?: string
  address?: string
  city?: string
  region?: string
  postal_code?: string
  country?: string
  phone?: string
  fax?: string
  homepage?: string
}

export interface Product {
  product_id: number
  product_name: string
  supplier_id?: number
  category_id?: number
  quantity_per_unit?: string
  unit_price?: number
  units_in_stock?: number
  units_on_order?: number
  reorder_level?: number
  discontinued: boolean
}

export interface Employee {
  employee_id: number
  last_name: string
  first_name: string
  title?: string
  title_of_courtesy?: string
  birth_date?: Date
  hire_date?: Date
  address?: string
  city?: string
  region?: string
  postal_code?: string
  country?: string
  home_phone?: string
  extension?: string
  photo?: Buffer
  notes?: string
  reports_to?: number
  photo_path?: string
}

export interface Shipper {
  shipper_id: number
  company_name: string
  phone?: string
}

export interface Order {
  order_id: number
  customer_id?: string
  employee_id?: number
  order_date?: Date
  required_date?: Date
  shipped_date?: Date
  ship_via?: number
  freight?: number
  ship_name?: string
  ship_address?: string
  ship_city?: string
  ship_region?: string
  ship_postal_code?: string
  ship_country?: string
}

export interface OrderDetail {
  order_id: number
  product_id: number
  unit_price: number
  quantity: number
  discount: number
}

// Extended types for joins
export interface ProductWithDetails extends Product {
  category_name?: string
  supplier_name?: string
}

export interface OrderWithDetails extends Order {
  customer_name?: string
  employee_name?: string
  shipper_name?: string
  total?: number
  details?: OrderDetail[]
}

export interface CustomerWithStats extends Customer {
  total_orders?: number
  total_spent?: number
  last_order_date?: Date
}

// API Response types
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiResponse<T> {
  data?: T
  error?: string
  success: boolean
}