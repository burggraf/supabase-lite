# @supabase-lite/proxy

HTTP proxy server that bridges external API calls to browser-based Supabase Lite instances, supporting both local development and production deployments.

## Overview

This package enables full Supabase.js compatibility with Supabase Lite by providing an HTTP proxy that forwards API requests to the browser-based database. It automatically detects and uses the appropriate communication method:

- **WebSocket mode**: For local development (localhost URLs)
- **PostMessage mode**: For production deployments (connects to existing browser tabs)

## Installation

```bash
npm install -g @supabase-lite/proxy
```

## Quick Start

### Local Development

1. **Start Supabase Lite locally:**
   ```bash
   cd supabase-lite
   npm run dev
   # Open http://localhost:5173 in your browser
   ```

2. **Start the proxy server:**
   ```bash
   supabase-lite-proxy start
   # Uses WebSocket mode automatically for localhost
   ```

3. **Use with Supabase.js:**
   ```javascript
   import { createClient } from '@supabase/supabase-js'
   
   const supabase = createClient(
     'http://localhost:54321', // Proxy URL
     'your-anon-key'           // Any key works for local development
   )
   
   // Now use Supabase.js normally
   const { data, error } = await supabase
     .from('users')
     .select('*')
   ```

### Production Deployment

1. **Open Supabase Lite in your browser:**
   ```
   https://supabase-lite.pages.dev
   ```

2. **Start the proxy server targeting production:**
   ```bash
   supabase-lite-proxy start --target https://supabase-lite.pages.dev --port 8080
   # Uses PostMessage mode automatically for production URLs
   ```

3. **Connect via bridge page:**
   - Open the bridge page (automatically opens)
   - Click "Connect to Existing Tab" button
   - This establishes communication with your existing browser tab

4. **Use with curl or any HTTP client:**
   ```bash
   curl -X GET "http://localhost:8080/rest/v1/your-table" -H "apikey: your-key"
   ```

## CLI Commands

### Start Server
```bash
supabase-lite-proxy start [options]

Options:
  -p, --port <port>      Port to run the proxy server on (default: 54321)
  -t, --target <url>     Target Supabase Lite URL (default: https://supabase-lite.pages.dev)
  -m, --mode <mode>      Connection mode: websocket, postmessage, or auto (default: auto)
  -q, --quiet           Disable request logging

Examples:
  # Local development (WebSocket mode)
  supabase-lite-proxy start --port 3000

  # Production deployment (PostMessage mode)
  supabase-lite-proxy start --target https://supabase-lite.pages.dev --port 8080

  # Force specific mode
  supabase-lite-proxy start --mode websocket --port 5000
```

### Test Connection
```bash
supabase-lite-proxy test [options]

Options:
  -t, --target <url>     Target Supabase Lite URL to test (default: https://supabase-lite.pages.dev)
  -m, --mode <mode>      Test mode: websocket, postmessage, or auto (default: websocket)

Examples:
  # Test local WebSocket connection
  supabase-lite-proxy test --target http://localhost:5173 --mode websocket

  # Test production PostMessage connection
  supabase-lite-proxy test --target https://supabase-lite.pages.dev --mode postmessage
```

## How It Works

The proxy automatically detects the target environment and uses the appropriate communication method:

### WebSocket Mode (Local Development)
1. **Browser Database**: Supabase Lite runs a WebAssembly PostgreSQL database in your browser
2. **WebSocket Bridge**: The browser connects to a WebSocket server that can receive HTTP requests  
3. **HTTP Proxy**: This package provides an HTTP server that forwards requests to the WebSocket bridge
4. **API Compatibility**: Your applications can use standard HTTP requests and Supabase.js client library

```
External App ─HTTP─> Proxy Server ─WebSocket─> Browser ─PGlite─> Database
```

### PostMessage Mode (Production Deployment)
1. **Browser Database**: Supabase Lite runs in your existing browser tab (e.g., https://supabase-lite.pages.dev)
2. **Bridge Server**: The proxy creates a local bridge server with a connection interface
3. **PostMessage Communication**: Bridge opens a communication channel to your existing browser tab
4. **API Compatibility**: Your applications can use standard HTTP requests to access existing browser data

```
External App ─HTTP─> Proxy Server ─Bridge─> PostMessage ─> Existing Browser Tab ─PGlite─> Database
```

### Auto-Detection Logic
- **localhost/127.0.0.1 URLs**: Uses WebSocket mode (development)
- **Production URLs**: Uses PostMessage mode (connects to existing tab)
- **Manual Override**: Use `--mode` flag to force a specific mode

## Configuration

### Environment Variables
- `PROXY_PORT`: Default port for the proxy server (default: 54321)
- `TARGET_URL`: Default target Supabase Lite URL (default: https://supabase-lite.pages.dev)
- `CONNECTION_MODE`: Default connection mode: websocket, postmessage, or auto (default: auto)

### Programmatic Usage
```typescript
import { ProxyServer } from '@supabase-lite/proxy'

// Local development setup
const devServer = new ProxyServer({
  port: 54321,
  targetUrl: 'http://localhost:5173',
  mode: 'websocket', // or 'auto' for auto-detection
  enableLogging: true
})

// Production setup
const prodServer = new ProxyServer({
  port: 8080,
  targetUrl: 'https://supabase-lite.pages.dev',
  mode: 'postmessage', // or 'auto' for auto-detection
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

### WebSocket Mode Issues (Local Development)
```bash
# Test the WebSocket connection
supabase-lite-proxy test --mode websocket

# Check if Supabase Lite is running locally
curl http://localhost:5173/health

# Verify WebSocket bridge is active
curl http://localhost:5173/projects
```

### PostMessage Mode Issues (Production)
```bash
# Test the PostMessage connection
supabase-lite-proxy test --target https://supabase-lite.pages.dev --mode postmessage
```

**Common PostMessage Issues:**
1. **Bridge page not connecting**: 
   - Open the bridge page manually at `http://localhost:8765`
   - Click the "Connect to Existing Tab" button
   - Make sure https://supabase-lite.pages.dev is already open in another tab

2. **Popup blocker preventing connection**:
   - Allow popups for localhost in your browser
   - Manually open https://supabase-lite.pages.dev if needed

3. **Cross-origin communication blocked**:
   - Ensure both the bridge tab and Supabase Lite tab are in the same browser
   - Check browser console for PostMessage errors

4. **WebSocket connection errors in production** (Fixed):
   - ✅ **Resolved**: Production tabs no longer show WebSocket connection errors
   - The production site now only uses PostMessage communication
   - If you still see WebSocket errors, refresh https://supabase-lite.pages.dev

### Port Conflicts
```bash
# Use a different port
supabase-lite-proxy start --port 8080

# Check what's using the default port
lsof -i :54321
```

### CORS Issues
The proxy automatically handles CORS headers. If you encounter CORS issues:
1. Ensure you're using the proxy URL (`http://localhost:8080`) not the browser URL
2. Check that your API calls include the correct headers
3. Verify the proxy server is running and accessible
4. For PostMessage mode, ensure the bridge connection is established

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