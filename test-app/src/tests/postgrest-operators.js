// PostgREST operator tests
export const postgrestOperatorTests = {
  async 'operators-comparison'(supabase, environment) {
    console.log(`[${environment}] Running comparison operators test`)
    
    // Test gt, gte, lt, lte
    const results = {}
    
    // Greater than
    const gt = await supabase
      .from('products')
      .select('id, name, price')
      .gt('price', 50)
      .limit(3)
    
    // Greater than or equal
    const gte = await supabase
      .from('products')
      .select('id, name, price')
      .gte('price', 50)
      .limit(3)
    
    // Less than
    const lt = await supabase
      .from('products')
      .select('id, name, price')
      .lt('price', 20)
      .limit(3)
    
    // Less than or equal
    const lte = await supabase
      .from('products')
      .select('id, name, price')
      .lte('price', 20)
      .limit(3)
    
    return {
      operation: 'Comparison operators: gt, gte, lt, lte',
      results: {
        gt: { data: gt.data, count: gt.data?.length || 0, error: gt.error },
        gte: { data: gte.data, count: gte.data?.length || 0, error: gte.error },
        lt: { data: lt.data, count: lt.data?.length || 0, error: lt.error },
        lte: { data: lte.data, count: lte.data?.length || 0, error: lte.error }
      },
      timestamp: new Date().toISOString()
    }
  },

  async 'operators-pattern'(supabase, environment) {
    console.log(`[${environment}] Running pattern matching operators test`)
    
    // Test like and ilike
    const like = await supabase
      .from('products')
      .select('id, name')
      .like('name', '%test%')
      .limit(5)
    
    const ilike = await supabase
      .from('products')
      .select('id, name')
      .ilike('name', '%TEST%')
      .limit(5)
    
    return {
      operation: 'Pattern matching: like, ilike',
      results: {
        like: { data: like.data, count: like.data?.length || 0, error: like.error },
        ilike: { data: ilike.data, count: ilike.data?.length || 0, error: ilike.error }
      },
      timestamp: new Date().toISOString()
    }
  },

  async 'operators-array'(supabase, environment) {
    console.log(`[${environment}] Running array operators test`)
    
    // Test in operator
    const inOp = await supabase
      .from('products')
      .select('id, name, category')
      .in('category', ['electronics', 'books', 'clothing'])
      .limit(10)
    
    // Test contains (cs) for arrays
    const contains = await supabase
      .from('products')
      .select('id, name, tags')
      .contains('tags', ['electronics'])
      .limit(5)
    
    return {
      operation: 'Array operations: in, contains',
      results: {
        in: { data: inOp.data, count: inOp.data?.length || 0, error: inOp.error },
        contains: { data: contains.data, count: contains.data?.length || 0, error: contains.error }
      },
      timestamp: new Date().toISOString()
    }
  },

  async 'operators-null'(supabase, environment) {
    console.log(`[${environment}] Running NULL operators test`)
    
    // Test is null
    const isNull = await supabase
      .from('products')
      .select('id, name, description')
      .is('description', null)
      .limit(5)
    
    // Test is not null (using not.is)
    const isNotNull = await supabase
      .from('products')
      .select('id, name, description')
      .not('description', 'is', null)
      .limit(5)
    
    return {
      operation: 'NULL checks: is null, is not null',
      results: {
        isNull: { data: isNull.data, count: isNull.data?.length || 0, error: isNull.error },
        isNotNull: { data: isNotNull.data, count: isNotNull.data?.length || 0, error: isNotNull.error }
      },
      timestamp: new Date().toISOString()
    }
  },

  async 'operators-fts'(supabase, environment) {
    console.log(`[${environment}] Running full-text search test`)
    
    // Note: Full-text search might not work in PGlite without proper setup
    // This test mainly checks if the operator is supported
    
    try {
      const fts = await supabase
        .from('products')
        .select('id, name, description')
        .textSearch('name', 'laptop')
        .limit(5)
      
      return {
        operation: 'Full-text search: textSearch',
        results: {
          fts: { data: fts.data, count: fts.data?.length || 0, error: fts.error }
        },
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        operation: 'Full-text search: textSearch',
        results: {
          fts: { data: null, count: 0, error: error.message }
        },
        note: 'Full-text search may require additional PostgreSQL configuration',
        timestamp: new Date().toISOString()
      }
    }
  }
}