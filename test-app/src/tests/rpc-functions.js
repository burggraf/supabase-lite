// RPC (Remote Procedure Call) function tests
export const rpcFunctionTests = {
  async 'rpc-basic'(supabase, environment) {
    console.log(`[${environment}] Running basic RPC test`)
    
    try {
      const { data, error, status, statusText } = await supabase
        .rpc('get_product_stats')
      
      return {
        operation: 'SELECT * FROM get_product_stats()',
        data,
        error,
        status,
        statusText,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        operation: 'SELECT * FROM get_product_stats()',
        data: null,
        error: error.message,
        status: 'error',
        statusText: 'Function may not exist',
        timestamp: new Date().toISOString()
      }
    }
  },

  async 'rpc-params'(supabase, environment) {
    console.log(`[${environment}] Running RPC with parameters test`)
    
    try {
      const { data, error, status, statusText } = await supabase
        .rpc('get_products_by_category', {
          category_name: 'electronics'
        })
      
      return {
        operation: 'SELECT * FROM get_products_by_category(\'electronics\')',
        data,
        error,
        status,
        statusText,
        count: data?.length || 0,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        operation: 'SELECT * FROM get_products_by_category(\'electronics\')',
        data: null,
        error: error.message,
        status: 'error',
        statusText: 'Function may not exist',
        timestamp: new Date().toISOString()
      }
    }
  },

  async 'rpc-json'(supabase, environment) {
    console.log(`[${environment}] Running RPC returning JSON test`)
    
    try {
      const { data, error, status, statusText } = await supabase
        .rpc('get_category_summary')
      
      return {
        operation: 'SELECT * FROM get_category_summary()',
        data,
        error,
        status,
        statusText,
        dataType: typeof data,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        operation: 'SELECT * FROM get_category_summary()',
        data: null,
        error: error.message,
        status: 'error',
        statusText: 'Function may not exist',
        timestamp: new Date().toISOString()
      }
    }
  }
}