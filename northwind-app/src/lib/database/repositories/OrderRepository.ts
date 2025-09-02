import { BaseRepository, type QueryOptions, type RepositoryResult } from '../BaseRepository'
import { supabase } from '@/lib/supabase'

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

export interface OrderWithDetails extends Order {
  customer_name?: string
  employee_name?: string
  shipper_name?: string
  order_details?: (OrderDetail & { product_name?: string })[]
  total_amount?: number
}

export interface OrderSearchFilters {
  order_id?: number
  customer_id?: string
  employee_id?: number
  ship_country?: string
  ship_city?: string
  date_from?: Date
  date_to?: Date
  shipped?: boolean
}

export class OrderRepository extends BaseRepository<Order> {
  constructor() {
    super('orders', 'order_id')
  }

  /**
   * Search orders with enhanced filtering
   */
  async searchOrders(options: QueryOptions & { filters?: OrderSearchFilters } = {}): Promise<RepositoryResult<Order>> {
    const { pagination = { page: 1, limit: 20 }, sort, filters, search } = options
    
    // Start with base query
    let query = supabase.from(this.tableName).select('*', { count: 'exact' })

    // Apply regular filters
    if (filters) {
      const { date_from, date_to, shipped, ...regularFilters } = filters

      // Regular filters
      for (const [field, value] of Object.entries(regularFilters)) {
        if (value !== null && value !== undefined && value !== '') {
          query = query.eq(field, value)
        }
      }

      // Date range filters
      if (date_from) {
        query = query.gte('order_date', date_from.toISOString())
      }

      if (date_to) {
        query = query.lte('order_date', date_to.toISOString())
      }

      // Shipped filter
      if (shipped !== undefined) {
        if (shipped) {
          query = query.not('shipped_date', 'is', null)
        } else {
          query = query.is('shipped_date', null)
        }
      }
    }

    // Apply search
    if (search && search.query && search.fields.length > 0) {
      const searchConditions = search.fields.map(field => `${field}.ilike.%${search.query}%`)
      if (searchConditions.length === 1) {
        query = query.ilike(search.fields[0], `%${search.query}%`)
      } else {
        query = query.or(searchConditions.join(','))
      }
    }

    // Apply sorting
    if (sort && sort.length > 0) {
      for (const s of sort) {
        query = query.order(s.field, { ascending: s.direction === 'ASC' })
      }
    } else {
      query = query.order(this.primaryKey, { ascending: false })
    }

    // Apply pagination
    const page = pagination.page || 1
    const limit = pagination.limit || 20
    const offset = (page - 1) * limit
    
    query = query.range(offset, offset + limit - 1)

    // Execute query
    const { data, error, count } = await query

    if (error) {
      throw new Error(`Failed to search orders: ${error.message}`)
    }

    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    return {
      data: (data || []).map(row => ({
        ...row,
        order_date: row.order_date ? new Date(row.order_date) : undefined,
        required_date: row.required_date ? new Date(row.required_date) : undefined,
        shipped_date: row.shipped_date ? new Date(row.shipped_date) : undefined,
      })),
      total,
      page,
      limit,
      totalPages,
    }
  }

  /**
   * Find orders with full details (customer, employee, shipper info)
   */
  async findWithDetails(orderId: number): Promise<OrderWithDetails | null> {
    // Get order with related information using Supabase joins
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        customers(company_name),
        employees(first_name, last_name),
        shippers(company_name)
      `)
      .eq('order_id', orderId)
      .single()

    if (orderError && orderError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch order details: ${orderError.message}`)
    }

    if (!orderData) return null

    // Get order details with product information
    const { data: orderDetails, error: detailsError } = await supabase
      .from('order_details')
      .select(`
        *,
        products(product_name)
      `)
      .eq('order_id', orderId)
      .order('product_id')

    if (detailsError) {
      throw new Error(`Failed to fetch order details: ${detailsError.message}`)
    }

    // Transform the data and calculate totals
    const transformedDetails = (orderDetails || []).map((detail: any) => {
      const lineTotal = detail.unit_price * detail.quantity * (1 - detail.discount)
      return {
        ...detail,
        product_name: detail.products?.product_name,
        line_total: lineTotal,
      }
    })

    const totalAmount = transformedDetails.reduce((sum, detail) => sum + detail.line_total, 0)

    return {
      ...orderData,
      order_date: orderData.order_date ? new Date(orderData.order_date) : undefined,
      required_date: orderData.required_date ? new Date(orderData.required_date) : undefined,
      shipped_date: orderData.shipped_date ? new Date(orderData.shipped_date) : undefined,
      customer_name: (orderData as any).customers?.company_name,
      employee_name: (orderData as any).employees 
        ? `${(orderData as any).employees.first_name} ${(orderData as any).employees.last_name}`
        : undefined,
      shipper_name: (orderData as any).shippers?.company_name,
      order_details: transformedDetails,
      total_amount: totalAmount,
    }
  }

  /**
   * Find orders by customer
   */
  async findByCustomer(customerId: string, options: QueryOptions = {}): Promise<RepositoryResult<Order>> {
    return this.searchOrders({
      ...options,
      filters: { ...options.filters, customer_id: customerId },
    })
  }

  /**
   * Find orders by employee
   */
  async findByEmployee(employeeId: number, options: QueryOptions = {}): Promise<RepositoryResult<Order>> {
    return this.searchOrders({
      ...options,
      filters: { ...options.filters, employee_id: employeeId },
    })
  }

  /**
   * Find pending orders (not yet shipped)
   */
  async findPending(options: QueryOptions = {}): Promise<RepositoryResult<Order>> {
    return this.searchOrders({
      ...options,
      filters: { ...options.filters, shipped: false },
    })
  }

  /**
   * Find orders by date range
   */
  async findByDateRange(from: Date, to: Date, options: QueryOptions = {}): Promise<RepositoryResult<Order>> {
    return this.searchOrders({
      ...options,
      filters: { ...options.filters, date_from: from, date_to: to },
    })
  }

  /**
   * Get order statistics for a date range
   */
  async getOrderStats(from?: Date, to?: Date): Promise<{
    totalOrders: number
    totalRevenue: number
    averageOrderValue: number
    pendingOrders: number
    shippedOrders: number
  }> {
    // Get orders with optional date filtering
    let ordersQuery = supabase
      .from('orders')
      .select('order_id, shipped_date, order_date')

    if (from) {
      ordersQuery = ordersQuery.gte('order_date', from.toISOString())
    }

    if (to) {
      ordersQuery = ordersQuery.lte('order_date', to.toISOString())
    }

    const { data: orders, error } = await ordersQuery

    if (error) {
      throw new Error(`Failed to fetch order stats: ${error.message}`)
    }

    if (!orders || orders.length === 0) {
      return {
        totalOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        pendingOrders: 0,
        shippedOrders: 0,
      }
    }

    // Get order details for all orders
    const orderIds = orders.map(order => order.order_id)
    
    // Use or() method with eq() for each order_id to avoid .in() issues
    const orConditions = orderIds.map(id => `order_id.eq.${id}`).join(',')
    const { data: allOrderDetails, error: detailsError } = await supabase
      .from('order_details')
      .select('order_id, unit_price, quantity, discount')
      .or(orConditions)

    if (detailsError) {
      console.warn('Failed to fetch order details for stats:', detailsError)
    }

    // Calculate statistics
    let totalRevenue = 0
    let pendingOrders = 0
    let shippedOrders = 0
    const orderTotals: number[] = []

    for (const order of orders) {
      let orderTotal = 0
      
      // Calculate order total from details
      if (allOrderDetails) {
        const orderDetails = allOrderDetails.filter(detail => detail.order_id === order.order_id)
        for (const detail of orderDetails) {
          orderTotal += detail.unit_price * detail.quantity * (1 - detail.discount)
        }
      }
      
      totalRevenue += orderTotal
      orderTotals.push(orderTotal)
      
      if (order.shipped_date) {
        shippedOrders++
      } else {
        pendingOrders++
      }
    }

    const averageOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0

    return {
      totalOrders: orders.length,
      totalRevenue,
      averageOrderValue,
      pendingOrders,
      shippedOrders,
    }
  }

  /**
   * Get top selling products from orders
   */
  async getTopSellingProducts(limit: number = 10, from?: Date, to?: Date): Promise<Array<{
    product_id: number
    product_name: string
    total_quantity: number
    total_revenue: number
    order_count: number
  }>> {
    // Get order details with products and orders for date filtering
    let query = supabase
      .from('order_details')
      .select(`
        product_id,
        unit_price,
        quantity,
        discount,
        order_id,
        products(product_name),
        orders(order_date)
      `)

    const { data: orderDetails, error } = await query

    if (error) {
      throw new Error(`Failed to fetch top selling products: ${error.message}`)
    }

    if (!orderDetails || orderDetails.length === 0) {
      return []
    }

    // Filter by date range if provided and aggregate data
    const productStats = new Map<number, {
      product_id: number
      product_name: string
      total_quantity: number
      total_revenue: number
      order_ids: Set<number>
    }>()

    for (const detail of orderDetails) {
      // Apply date filtering
      if (from || to) {
        const orderDate = new Date((detail as any).orders?.order_date)
        if (from && orderDate < from) continue
        if (to && orderDate > to) continue
      }

      const productId = detail.product_id
      const revenue = detail.unit_price * detail.quantity * (1 - detail.discount)
      const productName = (detail as any).products?.product_name || 'Unknown'

      if (!productStats.has(productId)) {
        productStats.set(productId, {
          product_id: productId,
          product_name: productName,
          total_quantity: 0,
          total_revenue: 0,
          order_ids: new Set(),
        })
      }

      const stats = productStats.get(productId)!
      stats.total_quantity += detail.quantity
      stats.total_revenue += revenue
      stats.order_ids.add(detail.order_id)
    }

    // Convert to array and sort by revenue
    const results = Array.from(productStats.values())
      .map(stats => ({
        product_id: stats.product_id,
        product_name: stats.product_name,
        total_quantity: stats.total_quantity,
        total_revenue: stats.total_revenue,
        order_count: stats.order_ids.size,
      }))
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, limit)

    return results
  }
}