export { BaseRepository } from '../BaseRepository'
export type { 
  QueryOptions, 
  RepositoryResult, 
  PaginationOptions, 
  SortOptions, 
  FilterOptions 
} from '../BaseRepository'

export { CustomerRepository } from './CustomerRepository'
export type { Customer, CustomerSearchFilters } from './CustomerRepository'

export { ProductRepository } from './ProductRepository'
export type { 
  Product, 
  ProductSearchFilters, 
  ProductWithDetails 
} from './ProductRepository'

export { OrderRepository } from './OrderRepository'
export type { 
  Order, 
  OrderDetail, 
  OrderWithDetails, 
  OrderSearchFilters 
} from './OrderRepository'

// Additional repository types
export interface Category {
  category_id: number
  category_name: string
  description?: string
  picture?: string
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
  home_page?: string
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
  photo?: string
  notes?: string
  reports_to?: number
  photo_path?: string
}