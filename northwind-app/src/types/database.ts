export interface Database {
  public: {
    Tables: {
      customers: {
        Row: Customer
        Insert: Omit<Customer, 'customer_id'>
        Update: Partial<Omit<Customer, 'customer_id'>>
      }
      products: {
        Row: Product
        Insert: Omit<Product, 'product_id'>
        Update: Partial<Omit<Product, 'product_id'>>
      }
      categories: {
        Row: Category
        Insert: Omit<Category, 'category_id'>
        Update: Partial<Omit<Category, 'category_id'>>
      }
      suppliers: {
        Row: Supplier
        Insert: Omit<Supplier, 'supplier_id'>
        Update: Partial<Omit<Supplier, 'supplier_id'>>
      }
      orders: {
        Row: Order
        Insert: Omit<Order, 'order_id'>
        Update: Partial<Omit<Order, 'order_id'>>
      }
      order_details: {
        Row: OrderDetail
        Insert: OrderDetail
        Update: Partial<OrderDetail>
      }
      employees: {
        Row: Employee
        Insert: Omit<Employee, 'employee_id'>
        Update: Partial<Omit<Employee, 'employee_id'>>
      }
      shippers: {
        Row: Shipper
        Insert: Omit<Shipper, 'shipper_id'>
        Update: Partial<Omit<Shipper, 'shipper_id'>>
      }
    }
  }
}

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

export interface Order {
  order_id: number
  customer_id?: string
  employee_id?: number
  order_date?: string
  required_date?: string
  shipped_date?: string
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

export interface Employee {
  employee_id: number
  last_name: string
  first_name: string
  title?: string
  title_of_courtesy?: string
  birth_date?: string
  hire_date?: string
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

export interface Shipper {
  shipper_id: number
  company_name: string
  phone?: string
}