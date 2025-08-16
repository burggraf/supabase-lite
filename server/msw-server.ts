import { createServer } from 'http'

const PORT = process.env.PORT || 3001

// Create HTTP server
const httpServer = createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  try {
    const url = new URL(req.url!, `http://localhost:${PORT}`)
    
    // Simple routing based on our handlers
    if (url.pathname === '/hello' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        message: 'Hello, world.',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }))
    } else if (url.pathname === '/api/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString()
      }))
    } else if (url.pathname.startsWith('/rest/v1/') && req.method === 'GET') {
      const table = url.pathname.split('/rest/v1/')[1]
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        message: `REST API for table: ${table}`,
        status: 'mock_response'
      }))
    } else if (url.pathname === '/auth/v1/token' && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        access_token: 'mock_token_' + Math.random().toString(36).substr(2, 9),
        token_type: 'bearer',
        expires_in: 3600
      }))
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found' }))
    }
  } catch (error) {
    console.error('Server error:', error)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Internal server error' }))
  }
})

httpServer.listen(PORT, () => {
  console.log(`🚀 MSW Server running on http://localhost:${PORT}`)
  console.log('📍 Available endpoints:')
  console.log('  GET  /hello')
  console.log('  GET  /api/health')
  console.log('  GET  /rest/v1/:table')
  console.log('  POST /auth/v1/token')
  console.log('')
  console.log('🧪 Test with curl:')
  console.log(`  curl http://localhost:${PORT}/hello`)
})