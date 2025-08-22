# @supabase-lite/proxy

HTTP proxy server that bridges external API calls to browser-based Supabase Lite instances.

## Overview

This package enables full Supabase.js compatibility with Supabase Lite by providing an HTTP proxy that forwards API requests to the browser-based database via WebSocket communication.

## Installation

```bash
npm install -g @supabase-lite/proxy
```

## Quick Start

1. **Start Supabase Lite in your browser:**
   ```bash
   cd supabase-lite
   npm run dev
   # Open http://localhost:5173 in your browser
   ```

2. **Start the proxy server:**
   ```bash
   supabase-lite-proxy start
   ```

3. **Use with Supabase.js:**
   ```javascript
   import { createClient } from '@supabase/supabase-js'
   
   const supabase = createClient(
     'http://localhost:54321', // Proxy URL instead of Supabase cloud URL
     'your-anon-key'           // Any key works for local development
   )
   
   // Now use Supabase.js normally
   const { data, error } = await supabase
     .from('users')
     .select('*')
   ```

## CLI Commands

### Start Server
```bash
supabase-lite-proxy start [options]

Options:
  -p, --port <port>      Port to run the proxy server on (default: 54321)
  -w, --websocket <url>  WebSocket URL to connect to (default: ws://localhost:5176)
  -q, --quiet           Disable request logging
```

### Test Connection
```bash
supabase-lite-proxy test [options]

Options:
  -w, --websocket <url>  WebSocket URL to test (default: ws://localhost:5176)
```

## How It Works

1. **Browser Database**: Supabase Lite runs a WebAssembly PostgreSQL database in your browser
2. **WebSocket Bridge**: The browser connects to a WebSocket server that can receive HTTP requests
3. **HTTP Proxy**: This package provides an HTTP server that forwards requests to the WebSocket bridge
4. **API Compatibility**: Your applications can use standard HTTP requests and Supabase.js client library

```
External App ─HTTP─> Proxy Server ─WebSocket─> Browser ─PGlite─> Database
```

## Configuration

### Environment Variables
- `PROXY_PORT`: Default port for the proxy server (default: 54321)
- `WEBSOCKET_URL`: WebSocket URL to connect to (default: ws://localhost:5176)

### Programmatic Usage
```typescript
import { ProxyServer } from '@supabase-lite/proxy'

const server = new ProxyServer({
  port: 54321,
  websocketUrl: 'ws://localhost:5176',
  enableLogging: true
})

await server.start()
console.log('Proxy server running!')

// Later...
await server.stop()
```

## Supported APIs

The proxy supports all Supabase REST API endpoints:

- **PostgREST**: `/rest/v1/*` - Database queries, inserts, updates, deletes
- **Auth**: `/auth/v1/*` - Authentication and user management  
- **Health**: `/health` - Server health checks
- **Projects**: `/projects` - Multi-project support
- **Debug**: `/debug/sql` - Direct SQL execution

## Troubleshooting

### Connection Issues
```bash
# Test the WebSocket connection
supabase-lite-proxy test

# Check if Supabase Lite is running
curl http://localhost:5173/health

# Verify WebSocket bridge is active
curl http://localhost:5173/projects
```

### Port Conflicts
```bash
# Use a different port
supabase-lite-proxy start --port 8080

# Check what's using the default port
lsof -i :54321
```

### CORS Issues
The proxy automatically handles CORS headers. If you encounter CORS issues:
1. Ensure you're using the proxy URL (`http://localhost:54321`) not the browser URL
2. Check that your API calls include the correct headers
3. Verify the proxy server is running and accessible

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Run in development mode
npm run dev

# Run tests
npm test
```

## License

MIT