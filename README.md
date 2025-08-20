# Supabase Lite

A browser-based implementation of the Supabase stack using PGlite as the core PostgreSQL database. Experience the full Supabase development environment running entirely in your browser with no server dependencies.

## 🚀 Features

### ✅ Available Now
- **Dashboard**: Overview of your local database and connection status
- **SQL Editor**: Full-featured SQL editor with syntax highlighting, query execution, and history
- **PGlite Integration**: PostgreSQL database running in WebAssembly with IndexedDB persistence

### 🚧 Coming Soon
- **Table Editor**: Visual spreadsheet-like interface for data management
- **Authentication**: Local JWT-based auth simulation
- **Storage**: File management with IndexedDB backend
- **Realtime**: WebSocket simulation using BroadcastChannel API
- **Edge Functions**: Local function execution environment
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

4. **Try the SQL Editor**
   - Click "SQL Editor" in the sidebar
   - Run the example queries to explore your database
   - Create tables, insert data, and query as you would with any PostgreSQL database

## 📁 Project Structure

```
src/
├── components/
│   ├── ui/                 # Reusable UI components
│   ├── dashboard/          # Dashboard components
│   └── sql-editor/         # SQL Editor components
├── hooks/                  # React hooks for database operations
├── lib/
│   ├── database/           # Database connection and management
│   ├── constants.ts        # App constants and configuration
│   └── utils.ts            # Utility functions
└── types/                  # TypeScript type definitions
```

## 🎯 Use Cases

- **Local Development**: Full PostgreSQL environment without Docker or server setup
- **Learning SQL**: Safe environment to practice SQL queries
- **Prototyping**: Quickly test database schemas and queries
- **Offline Development**: Works completely offline once loaded
- **Education**: Teaching database concepts without installation complexity

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

### Phase 3 (Future)
- [ ] Authentication service simulation
- [ ] Storage service with file management
- [ ] Realtime subscriptions using BroadcastChannel
- [ ] Edge Functions local execution
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