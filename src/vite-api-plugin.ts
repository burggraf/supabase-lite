import type { Plugin } from 'vite'

export function createApiPlugin(): Plugin {
  let bridge: any = null
  let enhancedBridge: any = null
  
  return {
    name: 'supabase-lite-api',
    configureServer(server) {
      // Lazy load bridges
      const getBridges = async () => {
        if (!bridge || !enhancedBridge) {
          const { SupabaseAPIBridge } = await import('./mocks/supabase-bridge')
          const { EnhancedSupabaseAPIBridge } = await import('./mocks/enhanced-bridge')
          bridge = new SupabaseAPIBridge()
          enhancedBridge = new EnhancedSupabaseAPIBridge()
        }
        return { bridge, enhancedBridge }
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
          
          // Handle regular table operations
          let body = null
          const headers = Object.fromEntries(
            Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : v || ''])
          )

          if (method === 'POST' || method === 'PATCH') {
            const chunks: Buffer[] = []
            req.on('data', chunk => chunks.push(chunk))
            req.on('end', async () => {
              try {
                const bodyStr = Buffer.concat(chunks).toString()
                body = bodyStr ? JSON.parse(bodyStr) : null
                
                const { enhancedBridge: eBridge } = await getBridges()
                const response = await eBridge.handleRestRequest({
                  table,
                  method,
                  body,
                  headers,
                  url
                })
                
                res.setHeader('Content-Type', 'application/json')
                res.statusCode = response.status
                
                // Add response headers
                Object.entries(response.headers || {}).forEach(([key, value]) => {
                  res.setHeader(key, value)
                })
                
                res.end(JSON.stringify(response.data))
              } catch (error: any) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ message: error.message }))
              }
            })
          } else {
            // GET or DELETE
            const { enhancedBridge: eBridge } = await getBridges()
            const response = await eBridge.handleRestRequest({
              table,
              method,
              body,
              headers,
              url
            })
            
            res.setHeader('Content-Type', 'application/json')
            res.statusCode = response.status
            
            // Add response headers
            Object.entries(response.headers || {}).forEach(([key, value]) => {
              res.setHeader(key, value)
            })
            
            res.end(JSON.stringify(response.data))
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