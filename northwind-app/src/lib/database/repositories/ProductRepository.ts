import { BaseRepository, type QueryOptions, type RepositoryResult } from '../BaseRepository'

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

export interface ProductSearchFilters {
  product_id?: number
  product_name?: string
  supplier_id?: number
  category_id?: number
  discontinued?: boolean
  in_stock?: boolean
  low_stock?: boolean
}

export interface ProductWithDetails extends Product {
  category_name?: string
  supplier_name?: string
}

export class ProductRepository extends BaseRepository<Product> {
  constructor() {
    super('products', 'product_id')
  }

  /**
   * Search products with enhanced filtering
   */
  async searchProducts(options: QueryOptions & { filters?: ProductSearchFilters } = {}): Promise<RepositoryResult<Product>> {
    const enhancedOptions: QueryOptions = {
      ...options,
      search: options.search || {
        fields: ['product_name', 'quantity_per_unit'],
        query: '',
      },
    }

    // Handle special filters
    if (options.filters) {
      const { in_stock, low_stock, ...regularFilters } = options.filters
      
      enhancedOptions.filters = regularFilters

      // Add custom WHERE conditions for stock filters
      if (in_stock !== undefined || low_stock !== undefined) {
        // This will require custom query building
        return this.findProductsWithStockFilters({
          ...enhancedOptions,
          stockFilters: { in_stock, low_stock }
        })
      }
    }

    return this.findAll(enhancedOptions)
  }

  /**
   * Custom method to handle stock-based filtering
   */
  private async findProductsWithStockFilters(options: QueryOptions & { 
    stockFilters?: { in_stock?: boolean; low_stock?: boolean } 
  }): Promise<RepositoryResult<Product>> {
    const { pagination, sort, filters, search, stockFilters } = options
    
    let query = `SELECT * FROM ${this.tableName}`
    let countQuery = `SELECT COUNT(*) as total FROM ${this.tableName}`
    const params: any[] = []
    let paramIndex = 1

    // Build WHERE clause
    const whereConditions: string[] = []
    
    // Regular filters
    if (filters) {
      for (const [field, value] of Object.entries(filters)) {
        if (value !== null && value !== undefined && value !== '') {
          whereConditions.push(`${field} = $${paramIndex}`)
          params.push(value)
          paramIndex++
        }
      }
    }

    // Stock filters
    if (stockFilters?.in_stock !== undefined) {
      if (stockFilters.in_stock) {
        whereConditions.push(`units_in_stock > 0`)
      } else {
        whereConditions.push(`units_in_stock = 0`)
      }
    }

    if (stockFilters?.low_stock !== undefined && stockFilters.low_stock) {
      whereConditions.push(`units_in_stock <= reorder_level AND units_in_stock > 0`)
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
      query += ` ORDER BY ${this.primaryKey}`
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
      data: dataResult.rows,
      total,
      page,
      limit,
      totalPages,
    }
  }

  /**
   * Find products with category and supplier details
   */
  async findWithDetails(options: QueryOptions = {}): Promise<RepositoryResult<ProductWithDetails>> {
    const { pagination, sort, filters, search } = options
    
    let query = `
      SELECT 
        p.*,
        c.category_name,
        s.company_name as supplier_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      LEFT JOIN suppliers s ON p.supplier_id = s.supplier_id
    `
    
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      LEFT JOIN suppliers s ON p.supplier_id = s.supplier_id
    `
    
    const params: any[] = []
    let paramIndex = 1

    // Build WHERE clause (similar to base implementation)
    const whereConditions: string[] = []
    
    if (filters) {
      for (const [field, value] of Object.entries(filters)) {
        if (value !== null && value !== undefined && value !== '') {
          whereConditions.push(`p.${field} = $${paramIndex}`)
          params.push(value)
          paramIndex++
        }
      }
    }

    if (search && search.query && search.fields.length > 0) {
      const searchConditions = search.fields.map(field => 
        `p.${field}::text ILIKE $${paramIndex}`
      ).join(' OR ')
      whereConditions.push(`(${searchConditions})`)
      params.push(`%${search.query}%`)
      paramIndex++
    }

    if (whereConditions.length > 0) {
      const whereClause = ` WHERE ${whereConditions.join(' AND ')}`
      query += whereClause
      countQuery += whereClause
    }

    // Add sorting
    if (sort && sort.length > 0) {
      const sortClauses = sort.map(s => `p.${s.field} ${s.direction}`).join(', ')
      query += ` ORDER BY ${sortClauses}`
    } else {
      query += ` ORDER BY p.${this.primaryKey}`
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

    const [dataResult, countResult] = await Promise.all([
      this.query(query, params),
      this.query(countQuery, params.slice(0, paramIndex - (pagination ? 2 : 0)))
    ])

    const total = parseInt(countResult.rows[0].total)
    const totalPages = Math.ceil(total / limit)

    return {
      data: dataResult.rows,
      total,
      page,
      limit,
      totalPages,
    }
  }

  /**
   * Find products by category
   */
  async findByCategory(categoryId: number, options: QueryOptions = {}): Promise<RepositoryResult<Product>> {
    return this.findAll({
      ...options,
      filters: { ...options.filters, category_id: categoryId },
    })
  }

  /**
   * Find products by supplier
   */
  async findBySupplier(supplierId: number, options: QueryOptions = {}): Promise<RepositoryResult<Product>> {
    return this.findAll({
      ...options,
      filters: { ...options.filters, supplier_id: supplierId },
    })
  }

  /**
   * Find low stock products
   */
  async findLowStock(options: QueryOptions = {}): Promise<RepositoryResult<Product>> {
    return this.findProductsWithStockFilters({
      ...options,
      stockFilters: { low_stock: true }
    })
  }

  /**
   * Find discontinued products
   */
  async findDiscontinued(options: QueryOptions = {}): Promise<RepositoryResult<Product>> {
    return this.findAll({
      ...options,
      filters: { ...options.filters, discontinued: true },
    })
  }

  /**
   * Get product sales statistics
   */
  async getProductSalesStats(productId: number): Promise<{
    totalQuantitySold: number
    totalRevenue: number
    averageOrderQuantity: number
    timesOrdered: number
  }> {
    const result = await this.query(`
      SELECT 
        COALESCE(SUM(quantity), 0) as total_quantity_sold,
        COALESCE(SUM(unit_price * quantity * (1 - discount)), 0) as total_revenue,
        COALESCE(AVG(quantity), 0) as avg_order_quantity,
        COUNT(*) as times_ordered
      FROM order_details 
      WHERE product_id = $1
    `, [productId])

    const row = result.rows[0]
    return {
      totalQuantitySold: parseInt(row?.total_quantity_sold || '0'),
      totalRevenue: parseFloat(row?.total_revenue || '0'),
      averageOrderQuantity: parseFloat(row?.avg_order_quantity || '0'),
      timesOrdered: parseInt(row?.times_ordered || '0'),
    }
  }
}