# Supabase Lite

A browser-based implementation of the Supabase stack using PGlite as the core PostgreSQL database. Experience the full Supabase development environment running entirely in your browser with no server dependencies.

## 🚀 Features

### ✅ Available Now
- **Dashboard**: Overview of your local database and connection status
- **SQL Editor**: Full-featured SQL editor with syntax highlighting, query execution, and history
- **PGlite Integration**: PostgreSQL database running in WebAssembly with IndexedDB persistence
- **Cross-Origin Proxy**: HTTP proxy server for external API access with 100% Supabase.js compatibility
- **Edge Functions**: Complete serverless function development environment with:
  - File explorer with tree view and drag-drop support
  - Monaco Editor with TypeScript support and multi-file tabs
  - Local folder synchronization using File System Access API
  - Deployment panel with environment variables
  - Developer tools with console logs and performance metrics
  - Function execution simulation with MSW integration

### 🚧 Coming Soon
- **Table Editor**: Visual spreadsheet-like interface for data management
- **Authentication**: Local JWT-based auth simulation
- **Storage**: File management with IndexedDB backend
- **Realtime**: WebSocket simulation using BroadcastChannel API
- **API Documentation**: Auto-generated REST API docs

## 🛠️ Technology Stack

- **Frontend**: React 19 + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui components
- **Database**: PGlite (WebAssembly PostgreSQL)
- **Editor**: Monaco Editor (VS Code editor)
- **Storage**: IndexedDB for persistence

## 🏃‍♂️ Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start development server**
   ```bash
   npm run dev
   ```

3. **Open in browser**
   Navigate to `http://localhost:5173`

4. **Explore the Features**
   - **SQL Editor**: Run example queries and create your database schema
   - **Edge Functions**: Create serverless functions with the built-in code editor
   - **Dashboard**: Monitor your database status and performance metrics

## 📁 Project Structure

```
src/
├── components/
│   ├── ui/                 # Reusable UI components
│   ├── dashboard/          # Dashboard components
│   ├── sql-editor/         # SQL Editor components
│   └── edge-functions/     # Edge Functions development environment
│       ├── FileExplorer.tsx       # Tree view file browser
│       ├── CodeEditor.tsx         # Monaco Editor integration
│       ├── FolderSync.tsx         # Local folder synchronization
│       ├── DeploymentPanel.tsx    # Function deployment
│       └── DevTools.tsx           # Developer tools
├── hooks/                  # React hooks for database operations
├── lib/
│   ├── database/           # Database connection and management
│   ├── vfs/               # Virtual File System for Edge Functions
│   ├── constants.ts        # App constants and configuration
│   └── utils.ts            # Utility functions
├── pages/
│   └── EdgeFunctions.tsx  # Edge Functions main page
└── types/                  # TypeScript type definitions
```

## 🎯 Use Cases

- **Local Development**: Full PostgreSQL environment without Docker or server setup
- **Serverless Development**: Build and test Edge Functions locally with hot reload
- **Learning SQL**: Safe environment to practice SQL queries
- **Prototyping**: Quickly test database schemas, queries, and functions
- **Offline Development**: Works completely offline once loaded
- **Function Development**: Create, test, and debug serverless functions with built-in tools
- **Education**: Teaching database concepts and serverless architecture without complexity

## 🔧 Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🧪 Testing with External Applications

Supabase Lite provides MSW (Mock Service Worker) HTTP middleware that exposes Supabase-compatible REST API endpoints for cross-origin testing. This allows you to test external applications against your local Supabase Lite instance.

### Creating External Test Apps

1. **Create a new directory** for your test application:
   ```bash
   mkdir my-supabase-test-app
   cd my-supabase-test-app
   ```

2. **Initialize with package.json**:
   ```json
   {
     "name": "my-supabase-test-app",
     "type": "module",
     "scripts": {
       "dev": "vite"
     },
     "dependencies": {
       "@supabase/supabase-js": "^2.48.1"
     },
     "devDependencies": {
       "vite": "^7.1.2"
     }
   }
   ```

3. **Create your test application**:
   ```javascript
   // main.js
   import { createClient } from '@supabase/supabase-js'

   const supabase = createClient(
     'http://localhost:5173',  // Your Supabase Lite URL
     'your-anon-key-here'      // Any key (not validated in local development)
   )

   // Test your Supabase operations
   const { data, error } = await supabase
     .from('products')
     .select('*')

   console.log('Data:', data)
   ```

4. **Run your test app**:
   ```bash
   npm install
   npm run dev
   ```

### Available API Endpoints

When running `npm run dev`, Supabase Lite exposes these endpoints:

- **REST API**: `http://localhost:5173/rest/v1/*` (PostgREST-compatible)
- **Auth API**: `http://localhost:5173/auth/v1/*` (GoTrue-compatible)
- **Health Check**: `http://localhost:5173/health`

### Example Test App

See the included `test-app/` directory for a comprehensive example that demonstrates:
- Basic CRUD operations
- Authentication flows
- Error handling
- Both local and remote environment switching

To run the example:
```bash
cd test-app
npm install
npm run dev
```

Then visit `http://localhost:5176` to see the test interface.

## 🌐 Cross-Origin API Access with Supabase Lite Proxy

For external applications that need to connect to Supabase Lite from different origins (e.g., deployed apps connecting to your local development environment), use the **Supabase Lite Proxy**.

### What is the Proxy?

The Supabase Lite Proxy is an HTTP server that bridges external API requests to your browser-based Supabase Lite instance. It supports two connection modes:

- **PostMessage Mode** (Production): For connecting to deployed Supabase Lite at `https://supabase-lite.pages.dev`
- **WebSocket Mode** (Development): For connecting to local development server

This enables full cross-origin API access and 100% Supabase.js compatibility.

**Note**: The Supabase Lite CLI (v1.3.1+) includes **automatic proxy support** - it detects HTTPS URLs and automatically starts/stops the proxy as needed. Manual proxy setup is only required for non-CLI use cases.

### Installation & Setup

#### For CLI Users (Automatic)
The Supabase Lite CLI automatically handles proxy setup for deployed instances:

```bash
# Install CLI (includes automatic proxy)
npm install -g supabase-lite

# Connect to deployed instance - proxy starts automatically
supabase-lite psql --url https://supabase-lite.pages.dev
```

#### For Non-CLI Applications (Manual)

1. **Install the proxy globally**:
   ```bash
   npm install -g supabase-lite-proxy
   ```

2. **For Production Use** (Recommended):
   ```bash
   supabase-lite-proxy start
   ```
   
   This connects to `https://supabase-lite.pages.dev` via PostMessage bridge. No local setup required!

3. **For Development** (when developing Supabase Lite itself):
   ```bash
   # In one terminal, start Supabase Lite development server
   npm run dev
   
   # In another terminal, start the proxy
   supabase-lite-proxy start --target http://localhost:5173
   ```

### Using with Supabase.js

Once the proxy is running, any external application can connect to Supabase Lite using the standard Supabase.js client:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'http://localhost:54321',  // Proxy URL (default port)
  'any-key-works-locally'    // Any key (not validated in local development)
)

// Use Supabase.js normally - 100% compatible!
const { data, error } = await supabase
  .from('users')
  .select('*')

const { data: insertData, error: insertError } = await supabase
  .from('products')
  .insert({ name: 'New Product', price: 29.99 })
```

### Proxy Commands

- **Start server**: `supabase-lite-proxy start [options]`
  - `-p, --port <port>`: Port to run on (default: 54321)
  - `-t, --target <url>`: Target Supabase Lite URL (default: https://supabase-lite.pages.dev)
  - `-m, --mode <mode>`: Connection mode: websocket, postmessage, or auto (default: auto)
  - `-q, --quiet`: Disable request logging
- **Test connection**: `supabase-lite-proxy test [options]`
  - `-t, --target <url>`: Target URL to test
  - `-m, --mode <mode>`: Test mode (auto-detects by default)
- **Help**: `supabase-lite-proxy --help`

### Connection Modes

The proxy automatically detects the appropriate connection mode:

- **Auto-detection** (default): localhost URLs use WebSocket, others use PostMessage
- **Manual override**: Use `--mode websocket` or `--mode postmessage` to force a specific mode

### How It Works

```
External App ─HTTP─> Proxy Server ─WebSocket─> Browser ─PGlite─> Database
```

1. **External App**: Your application makes standard HTTP requests to the proxy
2. **Proxy Server**: Forwards requests via WebSocket to the browser
3. **Browser**: MSW intercepts and processes requests through PGlite
4. **Response**: Data flows back through the same chain

### Architecture Benefits

- **100% Supabase.js Compatibility**: No changes needed in your existing code
- **Cross-Origin Support**: Connect from any domain to your local development environment
- **Reliable Connection**: Automatic reconnection with exponential backoff
- **Full API Support**: All REST, Auth, and Debug endpoints work seamlessly

### Use Cases

- **Remote Testing**: Test deployed applications against local database
- **Team Development**: Share your local Supabase Lite with team members
- **CI/CD Integration**: Run tests against browser-based database in pipelines
- **Mobile App Development**: Connect mobile apps to local development environment
- **API Integration Testing**: Validate external service integrations

## 🌐 Deployment

Since this is a pure client-side application, you can deploy it to any static hosting service:

- **Vercel**: `npx vercel`
- **Netlify**: `npm run build` then drag `dist/` folder
- **GitHub Pages**: Build and push `dist/` to `gh-pages` branch
- **Any CDN**: Upload `dist/` contents

## 📋 Roadmap

### Phase 1 (Current)
- [x] Basic project setup with Vite + React + TypeScript
- [x] PGlite integration with IndexedDB persistence
- [x] Dashboard with database status and overview
- [x] SQL Editor with Monaco Editor and query execution

### Phase 2 (Next)
- [ ] Table Editor with spreadsheet-like interface
- [ ] Schema management and visualization
- [ ] Data import/export functionality

### Phase 3 (Current)
- [x] **Edge Functions**: Complete serverless development environment
  - [x] File explorer with tree view and CRUD operations
  - [x] Monaco Editor with TypeScript support and auto-complete
  - [x] Local folder synchronization with File System Access API
  - [x] Deployment system with environment variables
  - [x] Developer tools with logs, metrics, and debugging
  - [x] Function execution simulation with MSW integration

### Phase 4 (Next)
- [ ] Authentication service simulation
- [ ] Storage service with file management
- [ ] Realtime subscriptions using BroadcastChannel
- [ ] API documentation generator

## 🤝 Contributing

This project is in active development. Contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - feel free to use this project for learning and development.

## 🙏 Acknowledgments

- **PGlite** by Electric SQL - Making PostgreSQL run in the browser
- **Supabase** - Inspiration for the UI and feature set
- **Monaco Editor** - Providing VS Code editing experience
- **shadcn/ui** - Beautiful and accessible UI components