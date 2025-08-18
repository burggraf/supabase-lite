// Advanced query feature tests
export const advancedQueryTests = {
  async 'select-columns'(supabase, environment) {
    console.log(`[${environment}] Running SELECT specific columns test`)
    
    const { data, error, status, statusText } = await supabase
      .from('products')
      .select('id, name, price')
      .limit(3)
    
    return {
      operation: 'SELECT id, name, price FROM products LIMIT 3',
      data,
      error,
      status,
      statusText,
      columns: data && data.length > 0 ? Object.keys(data[0]) : [],
      timestamp: new Date().toISOString()
    }
  },

  async 'filters-eq'(supabase, environment) {
    console.log(`[${environment}] Running basic equality filters test`)
    
    const { data, error, status, statusText } = await supabase
      .from('products')
      .select('*')
      .eq('category', 'electronics')
      .limit(5)
    
    return {
      operation: 'SELECT * FROM products WHERE category = \'electronics\' LIMIT 5',
      data,
      error,
      status,
      statusText,
      count: data?.length || 0,
      timestamp: new Date().toISOString()
    }
  },

  async 'filters-advanced'(supabase, environment) {
    console.log(`[${environment}] Running advanced filters test`)
    
    const { data, error, status, statusText } = await supabase
      .from('products')
      .select('*')
      .gte('price', 10.00)
      .lte('price', 100.00)
      .neq('category', 'discontinued')
      .limit(10)
    
    return {
      operation: 'SELECT * FROM products WHERE price >= 10.00 AND price <= 100.00 AND category != \'discontinued\' LIMIT 10',
      data,
      error,
      status,
      statusText,
      count: data?.length || 0,
      priceRange: data ? {
        min: Math.min(...data.map(p => p.price || 0)),
        max: Math.max(...data.map(p => p.price || 0))
      } : null,
      timestamp: new Date().toISOString()
    }
  },

  async 'ordering'(supabase, environment) {
    console.log(`[${environment}] Running ORDER BY test`)
    
    const { data, error, status, statusText } = await supabase
      .from('products')
      .select('id, name, price')
      .order('price', { ascending: false })
      .order('name', { ascending: true })
      .limit(5)
    
    return {
      operation: 'SELECT id, name, price FROM products ORDER BY price DESC, name ASC LIMIT 5',
      data,
      error,
      status,
      statusText,
      count: data?.length || 0,
      prices: data?.map(p => p.price) || [],
      timestamp: new Date().toISOString()
    }
  },

  async 'pagination'(supabase, environment) {
    console.log(`[${environment}] Running pagination test`)
    
    const pageSize = 3
    const pageNumber = 2 // Get second page (offset 3)
    
    const { data, error, status, statusText } = await supabase
      .from('products')
      .select('id, name')
      .order('id')
      .range(pageSize * (pageNumber - 1), pageSize * pageNumber - 1)
    
    return {
      operation: `SELECT id, name FROM products ORDER BY id LIMIT ${pageSize} OFFSET ${pageSize * (pageNumber - 1)}`,
      data,
      error,
      status,
      statusText,
      count: data?.length || 0,
      page: pageNumber,
      pageSize,
      timestamp: new Date().toISOString()
    }
  },

  async 'count'(supabase, environment) {
    console.log(`[${environment}] Running count test`)
    
    const { data, error, status, statusText, count } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: false })
      .eq('category', 'electronics')
    
    return {
      operation: 'SELECT COUNT(*) FROM products WHERE category = \'electronics\'',
      data,
      error,
      status,
      statusText,
      count,
      dataLength: data?.length || 0,
      timestamp: new Date().toISOString()
    }
  }
}