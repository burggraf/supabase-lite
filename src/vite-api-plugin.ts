import type { Plugin } from 'vite'

export function createApiPlugin(): Plugin {
  // Mock data for server-side responses (since PGlite requires browser context)
  const mockData = {
    products: [
      { id: 1, name: 'Wireless Headphones', price: 99.99, category: 'Electronics', description: 'High-quality wireless headphones with noise cancellation', in_stock: true },
      { id: 2, name: 'Running Shoes', price: 129.99, category: 'Footwear', description: 'Comfortable running shoes for daily exercise', in_stock: true },
      { id: 3, name: 'Coffee Mug', price: 15.99, category: 'Home & Kitchen', description: 'Ceramic coffee mug with ergonomic handle', in_stock: true },
      { id: 4, name: 'Laptop Stand', price: 49.99, category: 'Electronics', description: 'Adjustable aluminum laptop stand', in_stock: true },
      { id: 5, name: 'Desk Lamp', price: 35.99, category: 'Home & Kitchen', description: 'LED desk lamp with adjustable brightness', in_stock: true }
    ],
    orders: [
      { id: 1, user_id: 1, product_id: 1, quantity: 1, total_price: 99.99, status: 'completed' },
      { id: 2, user_id: 1, product_id: 3, quantity: 2, total_price: 31.98, status: 'completed' },
      { id: 3, user_id: 2, product_id: 2, quantity: 1, total_price: 129.99, status: 'pending' }
    ],
    users: [
      { id: 1, email: 'user1@example.com', name: 'User One' },
      { id: 2, email: 'user2@example.com', name: 'User Two' },
      { id: 3, email: 'user3@example.com', name: 'User Three' }
    ]
  }
  
  return {
    name: 'supabase-lite-api',
    configureServer(server) {
      // Helper function to get mock data with filters
      const getMockData = (table: string, query: URLSearchParams) => {
        const data = mockData[table as keyof typeof mockData] || []
        const limit = query.get('limit') ? parseInt(query.get('limit')!) : data.length
        return data.slice(0, limit)
      }
      
      // Health check endpoint
      server.middlewares.use('/health', (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.end(JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          message: 'Supabase Lite API is running'
        }))
      })

      // CORS preflight handler
      server.middlewares.use('*', (req, res, next) => {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'apikey, authorization, content-type, prefer, range, content-range')
          res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Type')
          res.setHeader('Access-Control-Max-Age', '86400')
          res.statusCode = 200
          res.end()
          return
        }
        next()
      })

      // PostgREST endpoints
      server.middlewares.use('/rest/v1', async (req, res, next) => {
        try {
          // Add CORS headers
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Headers', 'apikey, authorization, content-type, prefer, range')
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE')
          
          const url = new URL(req.url!, `http://${req.headers.host}`)
          const pathParts = url.pathname.split('/').filter(Boolean)
          
          console.log('API Request:', req.method, url.pathname, 'PathParts:', pathParts)
          
          if (pathParts.length < 1) {
            res.statusCode = 404
            res.end('Not Found')
            return
          }

          const table = pathParts[0] // Since middleware is mounted at /rest/v1, first part is the table
          const method = req.method!
          
          // Handle RPC calls
          if (pathParts[0] === 'rpc' && pathParts[1]) {
            const functionName = pathParts[1]
            let body = {}
            
            if (method === 'POST') {
              const chunks: Buffer[] = []
              req.on('data', chunk => chunks.push(chunk))
              req.on('end', async () => {
                try {
                  const bodyStr = Buffer.concat(chunks).toString()
                  body = bodyStr ? JSON.parse(bodyStr) : {}
                  
                  const { enhancedBridge: bridge } = await getBridges()
                  const response = await bridge.handleRpc(functionName, body)
                  res.setHeader('Content-Type', 'application/json')
                  res.statusCode = response.status
                  res.end(JSON.stringify(response.data))
                } catch (error: any) {
                  res.statusCode = 400
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ message: error.message }))
                }
              })
              return
            }
          }
          
          // Handle regular table operations with mock data
          if (method === 'GET') {
            // GET request - return mock data
            try {
              const data = getMockData(table, url.searchParams)
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = 200
              res.end(JSON.stringify(data))
            } catch (error: any) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ message: error.message }))
            }
          } else if (method === 'POST') {
            // POST request - simulate insert
            const chunks: Buffer[] = []
            req.on('data', chunk => chunks.push(chunk))
            req.on('end', () => {
              try {
                const bodyStr = Buffer.concat(chunks).toString()
                const body = bodyStr ? JSON.parse(bodyStr) : null
                
                // Simulate successful insert
                const newItem = { id: Date.now(), ...body }
                res.setHeader('Content-Type', 'application/json')
                res.statusCode = 201
                res.end(JSON.stringify([newItem]))
              } catch (error: any) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ message: error.message }))
              }
            })
          } else if (method === 'PATCH') {
            // PATCH request - simulate update
            const chunks: Buffer[] = []
            req.on('data', chunk => chunks.push(chunk))
            req.on('end', () => {
              try {
                const bodyStr = Buffer.concat(chunks).toString()
                const body = bodyStr ? JSON.parse(bodyStr) : null
                
                // Simulate successful update
                res.setHeader('Content-Type', 'application/json')
                res.statusCode = 200
                res.end(JSON.stringify([{ id: 1, ...body }]))
              } catch (error: any) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ message: error.message }))
              }
            })
          } else if (method === 'DELETE') {
            // DELETE request - simulate deletion
            res.setHeader('Content-Type', 'application/json')
            res.statusCode = 204
            res.end()
          } else {
            res.statusCode = 405
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ message: 'Method not allowed' }))
          }
        } catch (error: any) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message: error.message }))
        }
      })

      // Auth endpoints
      server.middlewares.use('/auth/v1', async (req, res, next) => {
        try {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Headers', 'apikey, authorization, content-type')
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST')
          
          const url = new URL(req.url!, `http://${req.headers.host}`)
          const pathParts = url.pathname.split('/').filter(Boolean)
          
          if (pathParts.length < 3) {
            res.statusCode = 404
            res.end('Not Found')
            return
          }

          const endpoint = pathParts[2] // signup, signin, etc.
          const method = req.method!
          
          if (method === 'POST') {
            const chunks: Buffer[] = []
            req.on('data', chunk => chunks.push(chunk))
            req.on('end', async () => {
              try {
                const bodyStr = Buffer.concat(chunks).toString()
                const body = bodyStr ? JSON.parse(bodyStr) : {}
                
                const { bridge: authBridge } = await getBridges()
                const result = await authBridge.handleAuth(endpoint, method, body)
                res.setHeader('Content-Type', 'application/json')
                res.statusCode = 200
                res.end(JSON.stringify(result))
              } catch (error: any) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ message: error.message }))
              }
            })
          } else if (method === 'GET' && endpoint === 'user') {
            const { bridge: authBridge } = await getBridges()
            const result = await authBridge.handleAuth('user', 'GET')
            res.setHeader('Content-Type', 'application/json')
            res.statusCode = 200
            res.end(JSON.stringify(result))
          } else {
            next()
          }
        } catch (error: any) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message: error.message }))
        }
      })
    }
  }
}