import { BaseRepository, type QueryOptions, type RepositoryResult } from '../BaseRepository'
import { supabase } from '@/lib/supabase'

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
    const { pagination = { page: 1, limit: 20 }, sort, filters, search, stockFilters } = options
    
    // Start with base query
    let query = supabase.from(this.tableName).select('*', { count: 'exact' })

    // Apply regular filters
    if (filters) {
      for (const [field, value] of Object.entries(filters)) {
        if (value !== null && value !== undefined && value !== '') {
          if (Array.isArray(value)) {
            query = query.in(field, value)
          } else if (typeof value === 'string' && value.includes('%')) {
            query = query.ilike(field, value)
          } else {
            query = query.eq(field, value)
          }
        }
      }
    }

    // Apply stock filters
    if (stockFilters?.in_stock !== undefined) {
      if (stockFilters.in_stock) {
        query = query.gt('units_in_stock', 0)
      } else {
        query = query.eq('units_in_stock', 0)
      }
    }

    // For low_stock filter, we need to use a more complex condition
    // This checks: units_in_stock <= reorder_level AND units_in_stock > 0
    // We'll need to fetch data and filter client-side for this complex condition
    // or use a PostgREST filter if available

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
      query = query.order(this.primaryKey)
    }

    // Apply pagination
    const page = pagination.page || 1
    const limit = pagination.limit || 20
    const offset = (page - 1) * limit
    
    query = query.range(offset, offset + limit - 1)

    // Execute query
    const { data, error, count } = await query

    if (error) {
      throw new Error(`Failed to fetch products with stock filters: ${error.message}`)
    }

    let filteredData = data || []

    // Apply low_stock filter client-side if needed
    if (stockFilters?.low_stock !== undefined && stockFilters.low_stock) {
      filteredData = filteredData.filter(product => 
        product.units_in_stock <= (product.reorder_level || 0) && product.units_in_stock > 0
      )
    }

    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    return {
      data: filteredData,
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
    const { pagination = { page: 1, limit: 20 }, sort, filters, search } = options
    
    // Build query - first try without joins to test basic functionality
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })

    // Apply filters
    if (filters) {
      for (const [field, value] of Object.entries(filters)) {
        if (value !== null && value !== undefined && value !== '') {
          if (Array.isArray(value)) {
            query = query.in(field, value)
          } else if (typeof value === 'string' && value.includes('%')) {
            query = query.ilike(field, value)
          } else {
            query = query.eq(field, value)
          }
        }
      }
    }

    // Apply search
    if (search && search.query && search.fields.length > 0) {
      // For search across multiple fields
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
      query = query.order(this.primaryKey)
    }

    // Apply pagination
    const page = pagination.page || 1
    const limit = pagination.limit || 20
    const offset = (page - 1) * limit
    
    query = query.range(offset, offset + limit - 1)

    // Execute query
    const { data, error, count } = await query

    if (error) {
      throw new Error(`Failed to fetch products with details: ${error.message}`)
    }

    // Transform the data to match expected format (without joins for now)
    const transformedData = (data || []).map((product: any) => ({
      ...product,
      category_name: null, // TODO: Add separate query for category names
      supplier_name: null, // TODO: Add separate query for supplier names
    }))

    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    return {
      data: transformedData,
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
   * Get product sales statistics using Supabase.js
   */
  async getProductSalesStats(productId: number): Promise<{
    totalQuantitySold: number
    totalRevenue: number
    averageOrderQuantity: number
    timesOrdered: number
  }> {
    // Get all order details for this product
    const { data: orderDetails, error } = await supabase
      .from('order_details')
      .select('unit_price, quantity, discount')
      .eq('product_id', productId)

    if (error) {
      throw new Error(`Failed to fetch product sales stats: ${error.message}`)
    }

    if (!orderDetails || orderDetails.length === 0) {
      return {
        totalQuantitySold: 0,
        totalRevenue: 0,
        averageOrderQuantity: 0,
        timesOrdered: 0,
      }
    }

    // Calculate statistics
    let totalQuantitySold = 0
    let totalRevenue = 0
    const timesOrdered = orderDetails.length

    for (const detail of orderDetails) {
      totalQuantitySold += detail.quantity
      totalRevenue += detail.unit_price * detail.quantity * (1 - detail.discount)
    }

    const averageOrderQuantity = timesOrdered > 0 ? totalQuantitySold / timesOrdered : 0

    return {
      totalQuantitySold,
      totalRevenue,
      averageOrderQuantity,
      timesOrdered,
    }
  }
}