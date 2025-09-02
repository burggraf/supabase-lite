import { BaseRepository, type QueryOptions, type RepositoryResult } from '../BaseRepository'
import { supabase } from '@/lib/supabase'

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

export interface CustomerSearchFilters {
  customer_id?: string
  company_name?: string
  contact_name?: string
  city?: string
  country?: string
  region?: string
}

export class CustomerRepository extends BaseRepository<Customer> {
  constructor() {
    super('customers', 'customer_id')
  }

  /**
   * Search customers with enhanced filtering
   */
  async searchCustomers(options: QueryOptions & { filters?: CustomerSearchFilters } = {}): Promise<RepositoryResult<Customer>> {
    const enhancedOptions: QueryOptions = {
      ...options,
      search: options.search || {
        fields: ['company_name', 'contact_name', 'city', 'country'],
        query: '',
      },
    }

    return this.findAll(enhancedOptions)
  }

  /**
   * Find customers by country
   */
  async findByCountry(country: string, options: QueryOptions = {}): Promise<RepositoryResult<Customer>> {
    return this.findAll({
      ...options,
      filters: { ...options.filters, country },
    })
  }

  /**
   * Find customers by city
   */
  async findByCity(city: string, options: QueryOptions = {}): Promise<RepositoryResult<Customer>> {
    return this.findAll({
      ...options,
      filters: { ...options.filters, city },
    })
  }

  /**
   * Get customer order statistics using Supabase.js
   */
  async getCustomerOrderStats(customerId: string): Promise<{
    totalOrders: number
    totalAmount: number
    averageOrderValue: number
    lastOrderDate: Date | null
  }> {
    // Get orders for the customer
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        order_id,
        order_date,
        order_details(unit_price, quantity, discount)
      `)
      .eq('customer_id', customerId)

    if (ordersError) {
      throw new Error(`Failed to fetch customer order stats: ${ordersError.message}`)
    }

    if (!orders || orders.length === 0) {
      return {
        totalOrders: 0,
        totalAmount: 0,
        averageOrderValue: 0,
        lastOrderDate: null,
      }
    }

    // Calculate statistics
    let totalAmount = 0
    let lastOrderDate: Date | null = null

    for (const order of orders) {
      // Calculate order total
      if (order.order_details) {
        for (const detail of order.order_details) {
          totalAmount += detail.unit_price * detail.quantity * (1 - detail.discount)
        }
      }

      // Track latest order date
      if (order.order_date) {
        const orderDate = new Date(order.order_date)
        if (!lastOrderDate || orderDate > lastOrderDate) {
          lastOrderDate = orderDate
        }
      }
    }

    return {
      totalOrders: orders.length,
      totalAmount,
      averageOrderValue: orders.length > 0 ? totalAmount / orders.length : 0,
      lastOrderDate,
    }
  }

  /**
   * Get top customers by order value using Supabase.js
   */
  async getTopCustomers(limit: number = 10): Promise<Array<Customer & { totalSpent: number; orderCount: number }>> {
    // Get all customers
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('*')

    if (customersError) {
      throw new Error(`Failed to fetch customers: ${customersError.message}`)
    }

    if (!customers || customers.length === 0) {
      return []
    }

    // Get customer spending data by calculating totals
    const customersWithStats = await Promise.all(
      customers.map(async (customer) => {
        // Get orders with details for this customer
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select(`
            order_id,
            order_details(unit_price, quantity, discount)
          `)
          .eq('customer_id', customer.customer_id)

        if (ordersError) {
          console.warn(`Failed to fetch orders for customer ${customer.customer_id}:`, ordersError)
          return {
            ...customer,
            totalSpent: 0,
            orderCount: 0,
          }
        }

        let totalSpent = 0
        const orderCount = orders?.length || 0

        if (orders) {
          for (const order of orders) {
            if (order.order_details) {
              for (const detail of order.order_details) {
                totalSpent += detail.unit_price * detail.quantity * (1 - detail.discount)
              }
            }
          }
        }

        return {
          ...customer,
          totalSpent,
          orderCount,
        }
      })
    )

    // Sort by totalSpent descending and limit results
    return customersWithStats
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, limit)
  }
}