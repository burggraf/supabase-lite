import { BaseRepository, type QueryOptions, type RepositoryResult } from '../BaseRepository'

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
    const { pagination, sort, filters, search } = options
    
    let query = `SELECT * FROM ${this.tableName}`
    let countQuery = `SELECT COUNT(*) as total FROM ${this.tableName}`
    const params: any[] = []
    let paramIndex = 1

    // Build WHERE clause
    const whereConditions: string[] = []
    
    if (filters) {
      const { date_from, date_to, shipped, ...regularFilters } = filters

      // Regular filters
      for (const [field, value] of Object.entries(regularFilters)) {
        if (value !== null && value !== undefined && value !== '') {
          whereConditions.push(`${field} = $${paramIndex}`)
          params.push(value)
          paramIndex++
        }
      }

      // Date range filters
      if (date_from) {
        whereConditions.push(`order_date >= $${paramIndex}`)
        params.push(date_from)
        paramIndex++
      }

      if (date_to) {
        whereConditions.push(`order_date <= $${paramIndex}`)
        params.push(date_to)
        paramIndex++
      }

      // Shipped filter
      if (shipped !== undefined) {
        if (shipped) {
          whereConditions.push(`shipped_date IS NOT NULL`)
        } else {
          whereConditions.push(`shipped_date IS NULL`)
        }
      }
    }

    // Search
    if (search && search.query && search.fields.length > 0) {
      const searchConditions = search.fields.map(field => 
        `${field}::text ILIKE $${paramIndex}`
      ).join(' OR ')
      whereConditions.push(`(${searchConditions})`)
      params.push(`%${search.query}%`)
      paramIndex++
    }

    // Apply WHERE clause
    if (whereConditions.length > 0) {
      const whereClause = ` WHERE ${whereConditions.join(' AND ')}`
      query += whereClause
      countQuery += whereClause
    }

    // Add sorting
    if (sort && sort.length > 0) {
      const sortClauses = sort.map(s => `${s.field} ${s.direction}`).join(', ')
      query += ` ORDER BY ${sortClauses}`
    } else {
      query += ` ORDER BY ${this.primaryKey} DESC`
    }

    // Add pagination
    let page = 1
    let limit = 50
    if (pagination) {
      page = pagination.page || 1
      limit = pagination.limit || 50
      const offset = pagination.offset || (page - 1) * limit
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
      params.push(limit, offset)
    }

    // Execute queries
    const [dataResult, countResult] = await Promise.all([
      this.query(query, params),
      this.query(countQuery, params.slice(0, paramIndex - (pagination ? 2 : 0)))
    ])

    const total = parseInt(countResult.rows[0].total)
    const totalPages = Math.ceil(total / limit)

    return {
      data: dataResult.rows.map(row => ({
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
    const result = await this.query(`
      SELECT 
        o.*,
        c.company_name as customer_name,
        (e.first_name || ' ' || e.last_name) as employee_name,
        s.company_name as shipper_name
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.customer_id
      LEFT JOIN employees e ON o.employee_id = e.employee_id
      LEFT JOIN shippers s ON o.ship_via = s.shipper_id
      WHERE o.order_id = $1
    `, [orderId])

    if (result.rows.length === 0) return null

    const order = result.rows[0]

    // Get order details with product information
    const detailsResult = await this.query(`
      SELECT 
        od.*,
        p.product_name,
        (od.unit_price * od.quantity * (1 - od.discount)) as line_total
      FROM order_details od
      JOIN products p ON od.product_id = p.product_id
      WHERE od.order_id = $1
      ORDER BY od.product_id
    `, [orderId])

    const orderDetails = detailsResult.rows
    const totalAmount = orderDetails.reduce((sum, detail) => sum + parseFloat(detail.line_total), 0)

    return {
      ...order,
      order_date: order.order_date ? new Date(order.order_date) : undefined,
      required_date: order.required_date ? new Date(order.required_date) : undefined,
      shipped_date: order.shipped_date ? new Date(order.shipped_date) : undefined,
      customer_name: order.customer_name,
      employee_name: order.employee_name,
      shipper_name: order.shipper_name,
      order_details: orderDetails,
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
    let query = `
      SELECT 
        COUNT(DISTINCT o.order_id) as total_orders,
        COALESCE(SUM(od.unit_price * od.quantity * (1 - od.discount)), 0) as total_revenue,
        COALESCE(AVG(od.unit_price * od.quantity * (1 - od.discount)), 0) as avg_order_value,
        COUNT(DISTINCT CASE WHEN o.shipped_date IS NULL THEN o.order_id END) as pending_orders,
        COUNT(DISTINCT CASE WHEN o.shipped_date IS NOT NULL THEN o.order_id END) as shipped_orders
      FROM orders o
      LEFT JOIN order_details od ON o.order_id = od.order_id
    `

    const params: any[] = []
    const whereConditions: string[] = []

    if (from) {
      whereConditions.push(`o.order_date >= $${params.length + 1}`)
      params.push(from)
    }

    if (to) {
      whereConditions.push(`o.order_date <= $${params.length + 1}`)
      params.push(to)
    }

    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`
    }

    const result = await this.query(query, params)
    const row = result.rows[0]

    return {
      totalOrders: parseInt(row?.total_orders || '0'),
      totalRevenue: parseFloat(row?.total_revenue || '0'),
      averageOrderValue: parseFloat(row?.avg_order_value || '0'),
      pendingOrders: parseInt(row?.pending_orders || '0'),
      shippedOrders: parseInt(row?.shipped_orders || '0'),
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
    let query = `
      SELECT 
        p.product_id,
        p.product_name,
        SUM(od.quantity) as total_quantity,
        SUM(od.unit_price * od.quantity * (1 - od.discount)) as total_revenue,
        COUNT(DISTINCT od.order_id) as order_count
      FROM order_details od
      JOIN products p ON od.product_id = p.product_id
      JOIN orders o ON od.order_id = o.order_id
    `

    const params: any[] = []
    const whereConditions: string[] = []

    if (from) {
      whereConditions.push(`o.order_date >= $${params.length + 1}`)
      params.push(from)
    }

    if (to) {
      whereConditions.push(`o.order_date <= $${params.length + 1}`)
      params.push(to)
    }

    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`
    }

    query += `
      GROUP BY p.product_id, p.product_name
      ORDER BY total_revenue DESC
      LIMIT $${params.length + 1}
    `
    params.push(limit)

    const result = await this.query(query, params)

    return result.rows.map(row => ({
      product_id: row.product_id,
      product_name: row.product_name,
      total_quantity: parseInt(row.total_quantity || '0'),
      total_revenue: parseFloat(row.total_revenue || '0'),
      order_count: parseInt(row.order_count || '0'),
    }))
  }
}