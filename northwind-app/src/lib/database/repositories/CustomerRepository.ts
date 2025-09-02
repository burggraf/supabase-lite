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
      .select('order_id, order_date')
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

    // Get order details for all orders
    const orderIds = orders.map(order => order.order_id)
    
    // Use or() method with eq() for each order_id to avoid .in() issues  
    const orConditions = orderIds.map(id => `order_id.eq.${id}`).join(',')
    const { data: orderDetails, error: detailsError } = await supabase
      .from('order_details')
      .select('order_id, unit_price, quantity, discount')
      .or(orConditions)

    if (detailsError) {
      console.warn(`Failed to fetch order details for customer ${customerId}:`, detailsError)
      // Continue with basic stats without amounts
    }

    // Calculate statistics
    let totalAmount = 0
    let lastOrderDate: Date | null = null

    // Calculate order amounts
    if (orderDetails) {
      for (const detail of orderDetails) {
        totalAmount += detail.unit_price * detail.quantity * (1 - detail.discount)
      }
    }

    // Track latest order date
    for (const order of orders) {
      if (order.order_date) {
        const orderDate = new Date(order.order_date)
        if (!lastOrderDate || orderDate > lastOrderDate) {
          lastOrderDate = orderDate
        }
      }
    }

    const averageOrderValue = orders.length > 0 ? totalAmount / orders.length : 0

    return {
      totalOrders: orders.length,
      totalAmount,
      averageOrderValue,
      lastOrderDate,
    }
  }

  /**
   * Get customer segmentation analysis
   */
  async getCustomerSegmentation(): Promise<Array<{
    segment: string
    count: number
    totalSpent: number
    averageOrderValue: number
    description: string
  }>> {
    // Get all customers with their order statistics
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('customer_id, company_name')

    if (customersError) {
      throw new Error(`Failed to fetch customers: ${customersError.message}`)
    }

    if (!customers || customers.length === 0) {
      return []
    }

    // Calculate statistics for each customer
    const customerStats = await Promise.all(
      customers.map(async (customer) => {
        const stats = await this.getCustomerOrderStats(customer.customer_id)
        return {
          customer_id: customer.customer_id,
          company_name: customer.company_name,
          ...stats
        }
      })
    )

    // Define segments based on order count and total spent
    const segments = {
      'VIP Customers': { customers: [] as any[], description: 'High-value customers (>$5000 and >10 orders)' },
      'Loyal Customers': { customers: [] as any[], description: 'Frequent buyers (>5 orders but <$5000)' },
      'High-Value Customers': { customers: [] as any[], description: 'Big spenders (<5 orders but >$3000)' },
      'Regular Customers': { customers: [] as any[], description: 'Moderate activity (2-5 orders, $500-$3000)' },
      'New Customers': { customers: [] as any[], description: 'Recent or low activity (1-2 orders, <$500)' },
    }

    // Categorize customers
    customerStats.forEach(customer => {
      if (customer.totalAmount > 5000 && customer.totalOrders > 10) {
        segments['VIP Customers'].customers.push(customer)
      } else if (customer.totalOrders > 5) {
        segments['Loyal Customers'].customers.push(customer)
      } else if (customer.totalAmount > 3000) {
        segments['High-Value Customers'].customers.push(customer)
      } else if (customer.totalOrders >= 2 && customer.totalAmount > 500) {
        segments['Regular Customers'].customers.push(customer)
      } else {
        segments['New Customers'].customers.push(customer)
      }
    })

    // Calculate segment statistics
    return Object.entries(segments).map(([segment, data]) => ({
      segment,
      count: data.customers.length,
      totalSpent: Math.round(data.customers.reduce((sum, customer) => sum + customer.totalAmount, 0)),
      averageOrderValue: data.customers.length > 0 
        ? Math.round(data.customers.reduce((sum, customer) => sum + customer.averageOrderValue, 0) / data.customers.length)
        : 0,
      description: data.description
    })).filter(segment => segment.count > 0)
  }

  /**
   * Get customer lifetime value analysis
   */
  async getCustomerLifetimeValue(limit: number = 20): Promise<Array<Customer & { 
    totalSpent: number
    orderCount: number
    averageOrderValue: number
    daysSinceFirstOrder: number
    estimatedLifetimeValue: number
  }>> {
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

    // Calculate lifetime value for each customer
    const customerLTV = await Promise.all(
      customers.map(async (customer) => {
        const stats = await this.getCustomerOrderStats(customer.customer_id)
        
        // Get first order date
        const { data: firstOrder, error: firstOrderError } = await supabase
          .from('orders')
          .select('order_date')
          .eq('customer_id', customer.customer_id)
          .order('order_date', { ascending: true })
          .limit(1)
          .single()

        let daysSinceFirstOrder = 0
        if (!firstOrderError && firstOrder) {
          const firstOrderDate = new Date(firstOrder.order_date)
          const now = new Date()
          daysSinceFirstOrder = Math.floor((now.getTime() - firstOrderDate.getTime()) / (1000 * 60 * 60 * 24))
        }

        // Estimate lifetime value (simple model: current spending rate * projected lifespan)
        const spendingRate = daysSinceFirstOrder > 0 ? stats.totalAmount / daysSinceFirstOrder : 0
        const estimatedLifetimeValue = Math.round(spendingRate * 365 * 3) // 3-year projection

        return {
          ...customer,
          ...stats,
          daysSinceFirstOrder,
          estimatedLifetimeValue: Math.max(estimatedLifetimeValue, stats.totalAmount)
        }
      })
    )

    return customerLTV
      .filter(customer => customer.totalOrders > 0)
      .sort((a, b) => b.estimatedLifetimeValue - a.estimatedLifetimeValue)
      .slice(0, limit)
  }

  /**
   * Get customer retention analysis
   */
  async getCustomerRetention(): Promise<{
    totalCustomers: number
    activeCustomers: number
    newCustomersThisMonth: number
    returningCustomers: number
    churnedCustomers: number
    retentionRate: number
  }> {
    const now = new Date()
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)

    // Get all customers
    const { data: allCustomers, error: customersError } = await supabase
      .from('customers')
      .select('customer_id')

    if (customersError) {
      throw new Error(`Failed to fetch customers: ${customersError.message}`)
    }

    const totalCustomers = allCustomers?.length || 0

    // Get customers with orders in different periods
    const [activeThisMonth, activeLastMonth, activeThreeMonthsAgo] = await Promise.all([
      this.getCustomersWithOrdersAfter(thisMonth),
      this.getCustomersWithOrdersAfter(lastMonth),
      this.getCustomersWithOrdersAfter(threeMonthsAgo)
    ])

    const activeCustomers = activeThisMonth.length
    const newCustomersThisMonth = await this.getNewCustomersAfter(thisMonth)
    const returningCustomers = activeThisMonth.filter(id => activeLastMonth.includes(id)).length
    const churnedCustomers = activeLastMonth.filter(id => !activeThisMonth.includes(id)).length
    const retentionRate = activeLastMonth.length > 0 ? (returningCustomers / activeLastMonth.length) * 100 : 0

    return {
      totalCustomers,
      activeCustomers,
      newCustomersThisMonth: newCustomersThisMonth.length,
      returningCustomers,
      churnedCustomers,
      retentionRate: Math.round(retentionRate * 100) / 100
    }
  }

  private async getCustomersWithOrdersAfter(date: Date): Promise<string[]> {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('customer_id')
      .gte('order_date', date.toISOString())

    if (error) return []
    
    return [...new Set(orders?.map(order => order.customer_id).filter(Boolean) || [])]
  }

  private async getNewCustomersAfter(date: Date): Promise<string[]> {
    const { data: customers, error } = await supabase
      .from('customers')
      .select('customer_id')

    if (error || !customers) return []

    // For each customer, check if their first order was after the date
    const newCustomers = []
    for (const customer of customers) {
      const { data: firstOrder, error: orderError } = await supabase
        .from('orders')
        .select('order_date')
        .eq('customer_id', customer.customer_id)
        .order('order_date', { ascending: true })
        .limit(1)
        .single()

      if (!orderError && firstOrder && new Date(firstOrder.order_date) >= date) {
        newCustomers.push(customer.customer_id)
      }
    }

    return newCustomers
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
        // Get orders for this customer
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select('order_id')
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

        if (orders && orders.length > 0) {
          // Get order details for this customer's orders - fetch one by one to avoid .in() issues
          let orderDetails: any[] = []
          
          for (const order of orders) {
            const { data: details, error: detailsError } = await supabase
              .from('order_details')
              .select('unit_price, quantity, discount')
              .eq('order_id', order.order_id)
            
            if (detailsError) {
              console.warn(`Failed to fetch details for order ${order.order_id}:`, detailsError)
            } else if (details) {
              orderDetails.push(...details)
            }
          }

          // Calculate total spent from collected order details
          for (const detail of orderDetails) {
            totalSpent += detail.unit_price * detail.quantity * (1 - detail.discount)
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