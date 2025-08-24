import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface Customer {
  customer_id: string
  company_name: string
  contact_name: string
  contact_title: string
  address: string
  city: string
  region: string
  postal_code: string
  country: string
  phone: string
  fax: string
}

interface Product {
  product_id: number
  product_name: string
  category_id: number
  category_name?: string
  quantity_per_unit: string
  unit_price: number
  units_in_stock: number
  units_on_order: number
  reorder_level: number
  discontinued: boolean
}

interface Order {
  order_id: number
  customer_id: string
  employee_id: number
  order_date: string
  required_date: string
  shipped_date: string
  ship_via: number
  freight: number
  ship_name: string
  ship_address: string
  ship_city: string
  ship_region: string
  ship_postal_code: string
  ship_country: string
  customer_name?: string
  employee_name?: string
  total_amount?: number
}

interface Employee {
  employee_id: number
  last_name: string
  first_name: string
  title: string
  title_of_courtesy: string
  birth_date: string
  hire_date: string
  address: string
  city: string
  region: string
  postal_code: string
  country: string
  home_phone: string
  extension: string
  notes: string
  reports_to: number | null
}

interface Metrics {
  totalCustomers: number
  totalOrders: number
  totalProducts: number
  totalEmployees: number
  totalRevenue: number
  avgOrderValue: number
  topCustomer: string
  topProduct: string
}

interface UseNorthwindDataReturn {
  // Data
  customers: Customer[]
  products: Product[]
  orders: Order[]
  employees: Employee[]
  metrics: Metrics | null
  
  // Loading states
  isLoading: boolean
  customersLoading: boolean
  productsLoading: boolean
  ordersLoading: boolean
  employeesLoading: boolean
  metricsLoading: boolean
  
  // Error states
  error: string | null
  
  // Methods
  refetchAll: () => Promise<void>
  refetchCustomers: () => Promise<void>
  refetchProducts: () => Promise<void>
  refetchOrders: () => Promise<void>
  refetchEmployees: () => Promise<void>
  refetchMetrics: () => Promise<void>
}

export function useNorthwindData(): UseNorthwindDataReturn {
  
  // Data states
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  
  // Loading states
  const [customersLoading, setCustomersLoading] = useState(false)
  const [productsLoading, setProductsLoading] = useState(false)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [employeesLoading, setEmployeesLoading] = useState(false)
  const [metricsLoading, setMetricsLoading] = useState(false)
  
  const [error, setError] = useState<string | null>(null)

  const isLoading = customersLoading || productsLoading || ordersLoading || employeesLoading || metricsLoading


  const refetchCustomers = useCallback(async () => {
    setCustomersLoading(true)
    setError(null)
    
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .limit(100)
      
      if (error) throw error
      setCustomers(data || [])
    } catch (err) {
      console.error('Error fetching customers:', err)
      setError('Failed to load customers')
    } finally {
      setCustomersLoading(false)
    }
  }, [])

  const refetchProducts = useCallback(async () => {
    setProductsLoading(true)
    setError(null)
    
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(category_name)')
        .limit(100)
      
      if (error) throw error
      
      const processedData = data?.map((product: any) => ({
        ...product,
        category_name: product.categories?.category_name || 'Unknown'
      })) || []
      setProducts(processedData)
    } catch (err) {
      console.error('Error fetching products:', err)
      setError('Failed to load products')
    } finally {
      setProductsLoading(false)
    }
  }, [])

  const refetchOrders = useCallback(async () => {
    setOrdersLoading(true)
    setError(null)
    
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, customers(company_name), employees(first_name, last_name)')
        .order('order_date', { ascending: false })
        .limit(100)
      
      if (error) throw error
      
      const processedData = data?.map((order: any) => ({
        ...order,
        customer_name: order.customers?.company_name || 'Unknown Customer',
        employee_name: order.employees ? `${order.employees.first_name} ${order.employees.last_name}` : 'Unknown Employee'
      })) || []
      setOrders(processedData)
    } catch (err) {
      console.error('Error fetching orders:', err)
      setError('Failed to load orders')
    } finally {
      setOrdersLoading(false)
    }
  }, [])

  const refetchEmployees = useCallback(async () => {
    setEmployeesLoading(true)
    setError(null)
    
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .limit(100)
      
      if (error) throw error
      setEmployees(data || [])
    } catch (err) {
      console.error('Error fetching employees:', err)
      setError('Failed to load employees')
    } finally {
      setEmployeesLoading(false)
    }
  }, [])

  const refetchMetrics = useCallback(async () => {
    setMetricsLoading(true)
    setError(null)
    
    try {
      // Use multiple Supabase queries to calculate metrics
      const [customersResult, ordersResult, productsResult, employeesResult] = await Promise.all([
        supabase.from('customers').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('discontinued', false),
        supabase.from('employees').select('*', { count: 'exact', head: true })
      ])

      // Calculate revenue from order_details
      const { data: orderDetails, error: orderDetailsError } = await supabase
        .from('order_details')
        .select('unit_price, quantity, discount')

      if (orderDetailsError) throw orderDetailsError

      let totalRevenue = 0
      if (orderDetails) {
        totalRevenue = orderDetails.reduce((sum, detail) => {
          return sum + (detail.unit_price * detail.quantity * (1 - detail.discount))
        }, 0)
      }

      const totalOrders = ordersResult.count || 0
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

      // Get top customer by order count (simplified approach)
      const { data: topCustomerData } = await supabase
        .from('orders')
        .select('customer_id, customers(company_name)')
        .limit(1000) // Get enough data to find patterns

      let topCustomer = 'N/A'
      if (topCustomerData) {
        const customerCounts = topCustomerData.reduce((acc: Record<string, number>, order: any) => {
          const customerName = order.customers?.company_name || 'Unknown'
          acc[customerName] = (acc[customerName] || 0) + 1
          return acc
        }, {})
        
        const topCustomerEntry = Object.entries(customerCounts).reduce((max, [name, count]) => 
          count > max.count ? { name, count } : max, { name: 'N/A', count: 0 }
        )
        topCustomer = topCustomerEntry.name
      }

      // Get top product by order frequency (simplified approach)
      const { data: topProductData } = await supabase
        .from('order_details')
        .select('product_id, products(product_name)')
        .limit(1000)

      let topProduct = 'N/A'
      if (topProductData) {
        const productCounts = topProductData.reduce((acc: Record<string, number>, detail: any) => {
          const productName = detail.products?.product_name || 'Unknown'
          acc[productName] = (acc[productName] || 0) + 1
          return acc
        }, {})
        
        const topProductEntry = Object.entries(productCounts).reduce((max, [name, count]) => 
          count > max.count ? { name, count } : max, { name: 'N/A', count: 0 }
        )
        topProduct = topProductEntry.name
      }

      setMetrics({
        totalCustomers: customersResult.count || 0,
        totalOrders: ordersResult.count || 0,
        totalProducts: productsResult.count || 0,
        totalEmployees: employeesResult.count || 0,
        totalRevenue,
        avgOrderValue,
        topCustomer,
        topProduct
      })
    } catch (err) {
      console.error('Error fetching metrics:', err)
      setError('Failed to load metrics')
    } finally {
      setMetricsLoading(false)
    }
  }, [])

  const refetchAll = useCallback(async () => {
    await Promise.all([
      refetchCustomers(),
      refetchProducts(),
      refetchOrders(),
      refetchEmployees(),
      refetchMetrics()
    ])
  }, [refetchCustomers, refetchProducts, refetchOrders, refetchEmployees, refetchMetrics])

  // Initial data loading
  useEffect(() => {
    refetchAll()
  }, [refetchAll])

  return {
    // Data
    customers,
    products,
    orders,
    employees,
    metrics,
    
    // Loading states
    isLoading,
    customersLoading,
    productsLoading,
    ordersLoading,
    employeesLoading,
    metricsLoading,
    
    // Error state
    error,
    
    // Methods
    refetchAll,
    refetchCustomers,
    refetchProducts,
    refetchOrders,
    refetchEmployees,
    refetchMetrics
  }
}