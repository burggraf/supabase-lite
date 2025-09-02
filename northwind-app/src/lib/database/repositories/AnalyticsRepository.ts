import { supabase } from '@/lib/supabase'

export interface BusinessMetrics {
  totalCustomers: number
  totalOrders: number
  totalProducts: number
  totalRevenue: number
  averageOrderValue: number
  pendingOrders: number
  shippedOrders: number
  lowStockProducts: number
}

export interface SalesTrendData {
  period: string
  sales: number
  orders: number
  customers: number
}

export interface TopCustomer {
  customer_id: string
  company_name: string
  totalOrders: number
  totalSpent: number
  lastOrderDate: Date | null
}

export interface CustomerSegment {
  segment: string
  count: number
  totalSpent: number
  averageOrderValue: number
}

export interface InventoryAlert {
  product_id: number
  product_name: string
  units_in_stock: number
  reorder_level: number
  category_name: string
  supplier_name: string
}

export interface ProductPerformance {
  product_id: number
  product_name: string
  category_name: string
  totalSales: number
  totalQuantity: number
  orderCount: number
  averageDiscount: number
}

export interface RevenueByCategory {
  category_id: number
  category_name: string
  revenue: number
  orderCount: number
  productCount: number
}

export class AnalyticsRepository {
  /**
   * Get comprehensive business metrics
   */
  async getBusinessMetrics(from?: Date, to?: Date): Promise<BusinessMetrics> {
    // Get customer count
    const { count: customersCount, error: customersError } = await supabase
      .from('customers')
      .select('customer_id', { count: 'exact', head: true })

    if (customersError) {
      throw new Error(`Failed to fetch customer count: ${customersError.message}`)
    }

    // Get orders with date filtering if provided
    let ordersQuery = supabase
      .from('orders')
      .select('order_id, order_date, shipped_date', { count: 'exact' })

    if (from) {
      ordersQuery = ordersQuery.gte('order_date', from.toISOString())
    }
    if (to) {
      ordersQuery = ordersQuery.lte('order_date', to.toISOString())
    }

    const { data: orders, count: ordersCount, error: ordersError } = await ordersQuery

    if (ordersError) {
      throw new Error(`Failed to fetch orders: ${ordersError.message}`)
    }

    // Get products count
    const { count: productsCount, error: productsError } = await supabase
      .from('products')
      .select('product_id', { count: 'exact', head: true })

    if (productsError) {
      throw new Error(`Failed to fetch products count: ${productsError.message}`)
    }

    // Get low stock products count
    // Get low stock count - products where units_in_stock < (reorder_level || 10)
    const { data: allProducts, error: allProductsError } = await supabase
      .from('products')
      .select('product_id, units_in_stock, reorder_level')

    let lowStockCount = 0
    if (allProductsError) {
      console.warn('Failed to fetch products for low stock count:', allProductsError)
    } else if (allProducts) {
      lowStockCount = allProducts.filter(p => 
        p.units_in_stock < (p.reorder_level || 10)
      ).length
    }

    // Calculate order statistics
    const pendingOrders = orders?.filter(order => !order.shipped_date).length || 0
    const shippedOrders = orders?.filter(order => order.shipped_date).length || 0

    // Calculate revenue and average order value
    let totalRevenue = 0
    if (orders && orders.length > 0) {
      for (const order of orders) {
        const { data: orderDetails, error: detailsError } = await supabase
          .from('order_details')
          .select('unit_price, quantity, discount')
          .eq('order_id', order.order_id)

        if (!detailsError && orderDetails) {
          for (const detail of orderDetails) {
            totalRevenue += detail.unit_price * detail.quantity * (1 - detail.discount)
          }
        }
      }
    }

    const averageOrderValue = orders && orders.length > 0 ? totalRevenue / orders.length : 0

    return {
      totalCustomers: customersCount || 0,
      totalOrders: ordersCount || 0,
      totalProducts: productsCount || 0,
      totalRevenue,
      averageOrderValue,
      pendingOrders,
      shippedOrders,
      lowStockProducts: lowStockCount || 0,
    }
  }

  /**
   * Get sales trend data for charts
   */
  async getSalesTrend(from: Date, to: Date, groupBy: 'day' | 'week' | 'month' = 'month'): Promise<SalesTrendData[]> {
    // Get orders within date range
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('order_id, order_date, customer_id')
      .gte('order_date', from.toISOString())
      .lte('order_date', to.toISOString())
      .order('order_date')

    if (ordersError) {
      throw new Error(`Failed to fetch sales trend: ${ordersError.message}`)
    }

    if (!orders || orders.length === 0) {
      return []
    }

    // Calculate revenue for each order
    const orderRevenues = new Map<number, number>()
    
    for (const order of orders) {
      const { data: orderDetails, error: detailsError } = await supabase
        .from('order_details')
        .select('unit_price, quantity, discount')
        .eq('order_id', order.order_id)

      if (!detailsError && orderDetails) {
        let orderTotal = 0
        for (const detail of orderDetails) {
          orderTotal += detail.unit_price * detail.quantity * (1 - detail.discount)
        }
        orderRevenues.set(order.order_id, orderTotal)
      }
    }

    // Group by time period
    const groupedData = new Map<string, { sales: number; orders: number; customers: Set<string> }>()

    for (const order of orders) {
      const orderDate = new Date(order.order_date)
      let periodKey: string

      switch (groupBy) {
        case 'day':
          periodKey = orderDate.toISOString().split('T')[0]
          break
        case 'week':
          const weekStart = new Date(orderDate)
          weekStart.setDate(orderDate.getDate() - orderDate.getDay())
          periodKey = weekStart.toISOString().split('T')[0]
          break
        case 'month':
        default:
          periodKey = `${orderDate.getFullYear()}-${(orderDate.getMonth() + 1).toString().padStart(2, '0')}`
          break
      }

      if (!groupedData.has(periodKey)) {
        groupedData.set(periodKey, { sales: 0, orders: 0, customers: new Set() })
      }

      const group = groupedData.get(periodKey)!
      group.sales += orderRevenues.get(order.order_id) || 0
      group.orders += 1
      if (order.customer_id) {
        group.customers.add(order.customer_id)
      }
    }

    // Convert to array and format
    return Array.from(groupedData.entries())
      .map(([period, data]) => ({
        period: this.formatPeriodLabel(period, groupBy),
        sales: Math.round(data.sales),
        orders: data.orders,
        customers: data.customers.size,
      }))
      .sort((a, b) => a.period.localeCompare(b.period))
  }

  /**
   * Get top customers by revenue
   */
  async getTopCustomers(limit: number = 10, from?: Date, to?: Date): Promise<TopCustomer[]> {
    // Get all customers
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('customer_id, company_name')

    if (customersError) {
      throw new Error(`Failed to fetch customers: ${customersError.message}`)
    }

    if (!customers || customers.length === 0) {
      return []
    }

    const customerStats = await Promise.all(
      customers.map(async (customer) => {
        // Get orders for this customer with optional date filtering
        let ordersQuery = supabase
          .from('orders')
          .select('order_id, order_date')
          .eq('customer_id', customer.customer_id)

        if (from) {
          ordersQuery = ordersQuery.gte('order_date', from.toISOString())
        }
        if (to) {
          ordersQuery = ordersQuery.lte('order_date', to.toISOString())
        }

        const { data: orders, error: ordersError } = await ordersQuery

        if (ordersError || !orders) {
          return {
            ...customer,
            totalOrders: 0,
            totalSpent: 0,
            lastOrderDate: null,
          }
        }

        let totalSpent = 0
        let lastOrderDate: Date | null = null

        for (const order of orders) {
          // Calculate order total
          const { data: orderDetails, error: detailsError } = await supabase
            .from('order_details')
            .select('unit_price, quantity, discount')
            .eq('order_id', order.order_id)

          if (!detailsError && orderDetails) {
            for (const detail of orderDetails) {
              totalSpent += detail.unit_price * detail.quantity * (1 - detail.discount)
            }
          }

          // Track latest order date
          const orderDate = new Date(order.order_date)
          if (!lastOrderDate || orderDate > lastOrderDate) {
            lastOrderDate = orderDate
          }
        }

        return {
          ...customer,
          totalOrders: orders.length,
          totalSpent: Math.round(totalSpent),
          lastOrderDate,
        }
      })
    )

    return customerStats
      .filter(customer => customer.totalOrders > 0)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, limit)
  }

  /**
   * Get inventory alerts for low stock products
   */
  async getInventoryAlerts(): Promise<InventoryAlert[]> {
    // Get all products first
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        product_id,
        product_name,
        units_in_stock,
        reorder_level,
        category_id,
        supplier_id
      `)
      .order('units_in_stock', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch inventory alerts: ${error.message}`)
    }

    if (!products) return []

    // Filter for low stock products using JavaScript
    const lowStockProducts = products.filter(product => 
      product.units_in_stock < (product.reorder_level || 10)
    )

    // Get category and supplier names separately
    const result = await Promise.all(
      lowStockProducts.map(async (product) => {
        let categoryName = 'Unknown'
        let supplierName = 'Unknown'

        // Get category name
        if (product.category_id) {
          const { data: category } = await supabase
            .from('categories')
            .select('category_name')
            .eq('category_id', product.category_id)
            .single()
          if (category) categoryName = category.category_name
        }

        // Get supplier name
        if (product.supplier_id) {
          const { data: supplier } = await supabase
            .from('suppliers')
            .select('company_name')
            .eq('supplier_id', product.supplier_id)
            .single()
          if (supplier) supplierName = supplier.company_name
        }

        return {
          product_id: product.product_id,
          product_name: product.product_name,
          units_in_stock: product.units_in_stock,
          reorder_level: product.reorder_level || 10,
          category_name: categoryName,
          supplier_name: supplierName,
        }
      })
    )

    return result
  }

  /**
   * Get revenue breakdown by category
   */
  async getRevenueByCategory(from?: Date, to?: Date): Promise<RevenueByCategory[]> {
    // Get all categories
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('category_id, category_name')

    if (categoriesError) {
      throw new Error(`Failed to fetch categories: ${categoriesError.message}`)
    }

    if (!categories) return []

    const categoryStats = await Promise.all(
      categories.map(async (category) => {
        // Get products in this category
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('product_id')
          .eq('category_id', category.category_id)

        if (productsError || !products) {
          return {
            category_id: category.category_id,
            category_name: category.category_name,
            revenue: 0,
            orderCount: 0,
            productCount: 0,
          }
        }

        const productIds = products.map(p => p.product_id)
        let revenue = 0
        const orderIds = new Set<number>()

        // Get order details for these products
        for (const productId of productIds) {
          const { data: orderDetails, error: detailsError } = await supabase
            .from('order_details')
            .select('order_id, unit_price, quantity, discount')
            .eq('product_id', productId)

          if (!detailsError && orderDetails) {
            // If date filtering is needed, get order dates for these order details
            if (from || to) {
              const orderIdsInDetails = orderDetails.map(d => d.order_id)
              
              let ordersQuery = supabase
                .from('orders')
                .select('order_id, order_date')
                .in('order_id', orderIdsInDetails)

              if (from) {
                ordersQuery = ordersQuery.gte('order_date', from.toISOString())
              }
              if (to) {
                ordersQuery = ordersQuery.lte('order_date', to.toISOString())
              }

              const { data: validOrders, error: ordersError } = await ordersQuery
              if (ordersError) continue

              const validOrderIds = new Set(validOrders?.map(o => o.order_id) || [])
              
              // Filter order details by valid dates
              for (const detail of orderDetails) {
                if (validOrderIds.has(detail.order_id)) {
                  revenue += detail.unit_price * detail.quantity * (1 - detail.discount)
                  orderIds.add(detail.order_id)
                }
              }
            } else {
              // No date filtering needed
              for (const detail of orderDetails) {
                revenue += detail.unit_price * detail.quantity * (1 - detail.discount)
                orderIds.add(detail.order_id)
              }
            }
          }
        }

        return {
          category_id: category.category_id,
          category_name: category.category_name,
          revenue: Math.round(revenue),
          orderCount: orderIds.size,
          productCount: products.length,
        }
      })
    )

    return categoryStats
      .filter(category => category.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
  }

  private formatPeriodLabel(period: string, groupBy: 'day' | 'week' | 'month'): string {
    switch (groupBy) {
      case 'day':
        return new Date(period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      case 'week':
        const weekStart = new Date(period)
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)
        return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      case 'month':
      default:
        const [year, month] = period.split('-')
        return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
    }
  }
}