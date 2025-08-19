// Basic CRUD operation tests
export const basicCrudTests = {
  async 'basic-select'(supabase, environment) {
    console.log(`[${environment}] Running basic SELECT test`)
    
    const { data, error, status, statusText } = await supabase
      .from('products')
      .select('*')
      .limit(5)
    
    return {
      operation: 'SELECT * FROM products LIMIT 5',
      data,
      error,
      status,
      statusText,
      count: data?.length || 0,
      timestamp: new Date().toISOString()
    }
  },

  async 'basic-insert'(supabase, environment) {
    console.log(`[${environment}] Running basic INSERT test`)
    
    const testProduct = {
      name: `Test Product ${Date.now()}`,
      price: 29.99,
      category: 'test'
    }

    const { data, error, status, statusText } = await supabase
      .from('products')
      .insert(testProduct)
      .select()
    
    return {
      operation: 'INSERT INTO products',
      input: testProduct,
      data,
      error,
      status,
      statusText,
      timestamp: new Date().toISOString()
    }
  },

  async 'basic-update'(supabase, environment) {
    console.log(`[${environment}] Running basic UPDATE test`)
    
    // First, get a product to update
    const { data: products } = await supabase
      .from('products')
      .select('id')
      .limit(1)
    
    if (!products || products.length === 0) {
      throw new Error('No products found to update')
    }

    const productId = products[0].id
    const updateData = {
      name: `Updated Product ${Date.now()}`,
      price: 39.99
    }

    const { data, error, status, statusText } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', productId)
      .select()
    
    return {
      operation: `UPDATE products SET ... WHERE id = ${productId}`,
      input: updateData,
      productId,
      data,
      error,
      status,
      statusText,
      timestamp: new Date().toISOString()
    }
  },

  async 'basic-delete'(supabase, environment) {
    console.log(`[${environment}] Running basic DELETE test`)
    
    // First, create a product to delete
    const { data: created } = await supabase
      .from('products')
      .insert({
        name: 'Product to Delete',
        price: 1.00,
        category: 'temp'
      })
      .select()
    
    if (!created || created.length === 0) {
      throw new Error('Failed to create product for deletion test')
    }

    const productId = created[0].id

    const { data, error, status, statusText } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)
      .select()
    
    return {
      operation: `DELETE FROM products WHERE id = ${productId}`,
      productId,
      data,
      error,
      status,
      statusText,
      timestamp: new Date().toISOString()
    }
  },

  async 'bulk-insert'(supabase, environment) {
    console.log(`[${environment}] Running bulk INSERT test`)
    
    const testProducts = [
      {
        name: `Bulk Product A ${Date.now()}`,
        price: 10.00,
        category: 'bulk-test'
      },
      {
        name: `Bulk Product B ${Date.now()}`,
        price: 20.00,
        category: 'bulk-test'
      },
      {
        name: `Bulk Product C ${Date.now()}`,
        price: 30.00,
        category: 'bulk-test'
      }
    ]

    const { data, error, status, statusText } = await supabase
      .from('products')
      .insert(testProducts)
      .select()
    
    return {
      operation: 'INSERT INTO products (bulk)',
      input: testProducts,
      inputCount: testProducts.length,
      data,
      error,
      status,
      statusText,
      resultCount: data?.length || 0,
      timestamp: new Date().toISOString()
    }
  }
}