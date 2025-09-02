import { BaseRepository, type QueryOptions, type RepositoryResult } from '../BaseRepository'

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
   * Get customer order statistics
   */
  async getCustomerOrderStats(customerId: string): Promise<{
    totalOrders: number
    totalAmount: number
    averageOrderValue: number
    lastOrderDate: Date | null
  }> {
    const result = await this.query(`
      SELECT 
        COUNT(o.order_id) as total_orders,
        COALESCE(SUM(od.unit_price * od.quantity * (1 - od.discount)), 0) as total_amount,
        COALESCE(AVG(od.unit_price * od.quantity * (1 - od.discount)), 0) as avg_order_value,
        MAX(o.order_date) as last_order_date
      FROM orders o
      LEFT JOIN order_details od ON o.order_id = od.order_id
      WHERE o.customer_id = $1
      GROUP BY o.customer_id
    `, [customerId])

    const row = result.rows[0]
    return {
      totalOrders: parseInt(row?.total_orders || '0'),
      totalAmount: parseFloat(row?.total_amount || '0'),
      averageOrderValue: parseFloat(row?.avg_order_value || '0'),
      lastOrderDate: row?.last_order_date ? new Date(row.last_order_date) : null,
    }
  }

  /**
   * Get top customers by order value
   */
  async getTopCustomers(limit: number = 10): Promise<Array<Customer & { totalSpent: number; orderCount: number }>> {
    const result = await this.query(`
      SELECT 
        c.*,
        COALESCE(SUM(od.unit_price * od.quantity * (1 - od.discount)), 0) as total_spent,
        COUNT(DISTINCT o.order_id) as order_count
      FROM customers c
      LEFT JOIN orders o ON c.customer_id = o.customer_id
      LEFT JOIN order_details od ON o.order_id = od.order_id
      GROUP BY c.customer_id, c.company_name, c.contact_name, c.contact_title, 
               c.address, c.city, c.region, c.postal_code, c.country, c.phone, c.fax
      ORDER BY total_spent DESC
      LIMIT $1
    `, [limit])

    return result.rows.map(row => ({
      customer_id: row.customer_id,
      company_name: row.company_name,
      contact_name: row.contact_name,
      contact_title: row.contact_title,
      address: row.address,
      city: row.city,
      region: row.region,
      postal_code: row.postal_code,
      country: row.country,
      phone: row.phone,
      fax: row.fax,
      totalSpent: parseFloat(row.total_spent || '0'),
      orderCount: parseInt(row.order_count || '0'),
    }))
  }
}