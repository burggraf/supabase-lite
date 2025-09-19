# Supabase Lite

A browser-based implementation of the Supabase stack using PGlite as the core PostgreSQL database and Mock Service Worker for the API backend. Experience the full Supabase education and development environment running entirely in your browser with no server dependencies. Supabase Lite is deployed as a static web app with no backend requirements so it works offline.

## 🚀 Features

### ✅ Complete Supabase Experience in Your Browser

**🏗️ Core Platform**

- **Multi-Project Management**: Create and manage isolated database projects with automatic switching
- **Browser-First Architecture**: Pure client-side application with no server dependencies - works completely offline
- **PostgreSQL in Browser**: Full PostgreSQL database powered by PGlite (WebAssembly) with IndexedDB persistence
- **Performance Optimized**: Built-in query caching, connection pooling, and performance analytics

**📊 Database Management**

- **SQL Editor**: Monaco Editor with syntax highlighting, auto-completion, query execution, and history
- **Table Editor**: Spreadsheet-like interface with advanced filtering, sorting, and CRUD operations
- **Schema Management**: Visual table creation, column editing, and relationship management
- **Data Import/Export**: Support for various data formats with backup and restore functionality

**🔐 Authentication System**

- **Complete Auth Service**: Full GoTrue-compatible authentication with JWT token management
- **User Management**: Signup, signin, password recovery, email verification, and profile updates
- **Multi-Factor Authentication**: TOTP-based MFA with QR code generation and verification
- **Row Level Security**: Automatic RLS policy enforcement with user context injection
- **Admin Operations**: User administration, role management, and session control

**🗄️ Storage Service**

- **File Management**: Complete Supabase Storage-compatible service with bucket operations
- **Secure Access**: Signed URL generation for temporary file access with expiration controls
- **Upload/Download**: Drag-and-drop file uploads with progress tracking and batch operations
- **VFS Integration**: Virtual file system with IndexedDB for persistent storage

**⚡ Edge Functions**

- **Serverless Development**: Complete development environment with TypeScript support
- **Code Editor**: Monaco Editor with IntelliSense, auto-completion, and multi-file management
- **Local Sync**: File System Access API for bidirectional folder synchronization
- **Deployment System**: Environment variables, versioning, and rollback capabilities
- **Developer Tools**: Real-time console logs, performance metrics, and debugging tools

**🚀 Application Server (MVP)**

- **WebVM Powered**: Lazy-loads an in-browser Linux VM to run server runtimes completely offline
- **Runtime Manager**: Install and remove nginx + Node.js bundles from an additive runtime catalog
- **State Persistence**: Persists VM state and runtime metadata with IndexedDB to survive reloads
- **Proxy Ready**: MSW handler stubbed to proxy `/app/*` requests into WebVM applications as networking lands

**🧪 API Testing**

- **Interactive Testing**: Built-in API testing interface for all endpoints
- **Full HTTP Support**: Test GET, POST, PUT, PATCH, DELETE operations
- **Authentication Testing**: Validate auth flows and token management
- **Real-time Inspection**: Live response analysis and debugging

**🔌 API Compatibility**

- **PostgREST Compatible**: Complete PostgREST API with advanced query syntax support
- **Supabase.js Compatible**: Extensive compatibility with existing Supabase.js applications
- **Cross-Origin Ready**: MSW-powered API accessible from external applications
- **Project Isolation**: Project-specific API routing with complete data separation

**💻 Command Line Interface**

- **PSQL Compatible**: Full-featured command-line database access with meta commands
- **Project Administration**: Create, list, and delete projects from scripts and automation
- **SQL Script Execution**: Run complex migrations and batch operations
- **Cross-Origin Proxy**: Automatic proxy handling for deployed instances

## 🛠️ Technology Stack

- **Frontend**: React 19 + TypeScript + Vite 7
- **UI Framework**: Tailwind CSS + shadcn/ui components + Lucide React icons
- **Database**: @electric-sql/pglite (WebAssembly PostgreSQL) with IndexedDB persistence
- **Code Editor**: Monaco Editor (VS Code editor in browser) with TypeScript IntelliSense
- **API Layer**: MSW (Mock Service Worker) with PostgREST and GoTrue compatibility
- **Storage**: Virtual File System (VFS) with IndexedDB for persistent file storage
- **Testing**: Vitest + React Testing Library with comprehensive test coverage
- **Authentication**: JWT-based with bcrypt password hashing
- **Build System**: Vite with TypeScript checking and ESLint linting

## 🏃‍♂️ Quick Start

**FASTEST**: Just visit https://supabase-lite.com in your [Chrome] browser. (Other browsers may work, but only Chrome has been tested.)

### Running Locally

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
│   ├── ui/                 # Reusable UI components (shadcn/ui)
│   ├── dashboard/          # Dashboard and main navigation
│   ├── sql-editor/         # SQL Editor with Monaco Editor
│   ├── table-editor/       # Full-featured data table with CRUD operations
│   ├── edge-functions/     # Edge Functions development environment
│   │   ├── FileExplorer.tsx       # Tree view file browser
│   │   ├── CodeEditor.tsx         # Monaco Editor integration
│   │   ├── FolderSync.tsx         # Local folder synchronization
│   │   ├── DeploymentPanel.tsx    # Function deployment
│   │   └── DevTools.tsx           # Developer tools
│   ├── storage/            # Storage management interface
│   │   ├── Storage.tsx            # Main storage interface
│   │   ├── BucketList.tsx         # Bucket management
│   │   ├── FileBrowser.tsx        # File browser and management
│   │   └── FileUpload.tsx         # File upload component
│   ├── auth/               # Authentication interface
│   │   └── AuthTestPanel.tsx      # Auth testing and management
│   ├── app-hosting/        # Static app hosting
│   │   ├── AppHosting.tsx         # Main app hosting interface
│   │   ├── AppList.tsx            # Deployed app management
│   │   └── AppDeploymentModal.tsx # App deployment dialog
│   ├── api-test/           # API testing interface
│   │   └── APITester.tsx          # REST API testing component
│   └── database/           # Database management components
├── hooks/                  # Custom React hooks for database operations
├── lib/
│   ├── database/           # DatabaseManager and PGlite connection
│   ├── vfs/               # Virtual File System for Edge Functions and Storage
│   │   ├── VFSManager.ts          # File storage and management
│   │   ├── VFSBridge.ts           # API bridge integration
│   │   ├── SyncManager.ts         # Local folder sync
│   │   ├── SignedUrlManager.ts    # Signed URL generation
│   │   └── FolderUploadService.ts # Folder upload and app deployment
│   ├── storage/            # Storage service implementation
│   │   ├── StorageClient.ts       # Main storage API client
│   │   ├── StorageBucket.ts       # Bucket operations
│   │   └── StorageError.ts        # Storage error handling
│   ├── auth/               # Authentication system
│   │   ├── AuthBridge.ts          # Main auth service bridge
│   │   ├── core/                  # Core auth components
│   │   │   ├── AuthManager.ts     # User management
│   │   │   ├── JWTService.ts      # JWT token generation
│   │   │   └── SessionManager.ts  # Session lifecycle management
│   │   ├── rls-enforcer.ts        # Row Level Security enforcement
│   │   └── services/              # Auth services
│   │       └── MFAService.ts      # Multi-factor authentication
│   ├── functions/          # Edge Functions service
│   │   ├── FunctionsClient.ts     # Functions deployment and execution
│   │   └── integration.ts         # Functions integration
│   ├── projects/           # Multi-project management
│   │   └── ProjectManager.ts      # Project lifecycle management
│   ├── infrastructure/     # Core infrastructure
│   │   ├── Logger.ts              # Structured logging
│   │   ├── ErrorHandler.ts        # Centralized error handling
│   │   └── ConfigManager.ts       # Configuration management
│   ├── postgrest/          # PostgREST compatibility layer
│   ├── constants.ts        # App constants and configuration
│   └── utils.ts            # Utility functions
├── pages/
│   └── EdgeFunctions.tsx   # Edge Functions main page
├── mocks/                  # MSW handlers and API bridge implementations
└── types/                  # TypeScript type definitions
```

## 🎯 Use Cases

### 🚀 Development & Prototyping

- **Rapid Prototyping**: Quickly test database schemas, APIs, and application logic
- **Local Development**: Full PostgreSQL environment without Docker or server dependencies
- **Offline Development**: Complete development environment that works offline once loaded
- **Cross-Platform Testing**: Test applications across different environments and devices

### 📚 Learning & Education

- **SQL Learning**: Safe environment to practice SQL queries with real PostgreSQL features
- **Database Concepts**: Teach database design, normalization, and relationship modeling
- **API Development**: Learn REST API patterns with real PostgREST compatibility
- **Authentication Flows**: Understand JWT tokens, session management, and security patterns
- **Serverless Architecture**: Learn Edge Functions and serverless development concepts

### 🔧 Production Support

- **API Testing**: Comprehensive testing of REST endpoints and authentication flows
- **Database Migration**: Test schema changes and data migrations before production deployment
- **Client Integration**: Test Supabase.js applications against controlled database states
- **Performance Analysis**: Analyze query performance and optimize database operations

### 👥 Team Development

- **Shared Development**: Team members can easily share database states and configurations
- **Demo Environments**: Create consistent demo environments for presentations and testing
- **Training**: Onboard new team members with pre-configured database examples
- **Documentation**: Generate API documentation and examples from working schemas

### 🏢 Enterprise Applications

- **Proof of Concept**: Validate concepts before investing in full infrastructure
- **Client Demos**: Demonstrate applications to clients without server setup
- **Training Materials**: Create interactive training environments for users
- **Compliance Testing**: Test data access controls and security policies

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
   	'http://localhost:5173', // Your Supabase Lite URL
   	'your-anon-key-here' // Any key (not validated in local development)
   )

   // Test your Supabase operations
   const { data, error } = await supabase.from('products').select('*')

   console.log('Data:', data)
   ```

4. **Run your test app**:
   ```bash
   npm install
   npm run dev
   ```

### Available API Endpoints

When running `npm run dev`, Supabase Lite exposes a comprehensive API that's fully compatible with Supabase.js:

#### REST API (PostgREST-compatible)

- **Data Operations**: `http://localhost:5173/rest/v1/{table}` (GET, POST, PATCH, DELETE)
- **RPC Functions**: `http://localhost:5173/rest/v1/rpc/{function_name}` (POST)
- **Project-specific**: `http://localhost:5173/{projectId}/rest/v1/{table}`

#### Authentication API (GoTrue-compatible)

- **User Authentication**: `http://localhost:5173/auth/v1/{signup,signin,token,logout}`
- **User Management**: `http://localhost:5173/auth/v1/{user,session,recover}`
- **Multi-factor Auth**: `http://localhost:5173/auth/v1/factors/*`
- **Admin Operations**: `http://localhost:5173/auth/v1/admin/users/*`
- **OAuth & Social**: `http://localhost:5173/auth/v1/{authorize,callback}`
- **Project-specific**: `http://localhost:5173/{projectId}/auth/v1/*`

#### Storage API (Supabase Storage-compatible)

- **Bucket Management**: `http://localhost:5173/storage/v1/bucket/*`
- **File Operations**: `http://localhost:5173/storage/v1/object/*`
- **Signed URLs**: Secure file access with expiration

#### Edge Functions API

- **Function Execution**: `http://localhost:5173/functions/v1/{function_name}`
- **Function Management**: Deploy, update, and manage serverless functions

#### VFS & App Hosting API

- **File System**: Virtual file system for Edge Functions and Storage
- **App Deployment**: Static app hosting and serving
- **Signed URLs**: Secure file access and app serving

#### Development & Debug APIs

- **SQL Execution**: `http://localhost:5173/debug/sql` (POST) - Direct SQL queries
- **Health Check**: `http://localhost:5173/health`
- **Project Management**: Create, list, and delete projects

#### Multi-Project Support

All APIs support project-specific routing with the pattern:
`http://localhost:5173/{projectId}/{api_path}`

This enables complete isolation between different projects within the same Supabase Lite instance.

## 🌐 Supabase Lite CLI

The **Supabase Lite CLI** is a powerful command-line companion tool that extends Supabase Lite functionality beyond the browser. It provides PSQL-compatible database access, project management, and cross-origin API connectivity.

### Installation

```bash
npm install -g supabase-lite
```

### Key Features

#### 🔗 PSQL-Compatible Database Access

Connect to your browser-based PostgreSQL database from the command line with full PSQL functionality:

```bash
# Connect to local instance
supabase-lite psql --url http://localhost:5173

# Connect to deployed instance (automatic proxy handling)
supabase-lite psql --url https://supabase-lite.com

# Connect to specific project
supabase-lite psql --url http://localhost:5173/abc123def456
```

#### 📊 Project Administration

Manage multiple projects from the command line:

```bash
# List all projects
supabase-lite admin list-projects -u http://localhost:5173

# Create a new project
supabase-lite admin create-project "My New Project" -u http://localhost:5173

# Delete a project
supabase-lite admin delete-project abc123def456 -u http://localhost:5173
```

#### 🔄 Automatic Cross-Origin Proxy

The CLI automatically handles connections to deployed HTTPS instances by:

- **Auto-detecting** HTTPS URLs and starting proxy when needed
- **Opening browser** to ensure the deployed app is loaded
- **Managing lifecycle** - proxy starts before commands and stops after completion
- **Transparent operation** - no configuration needed

#### 📝 SQL File Execution

Execute complex multi-statement SQL scripts:

```bash
# Execute SQL script
supabase-lite psql -u http://localhost:5173 -f schema.sql

# With error handling options
supabase-lite psql -u http://localhost:5173 -f migration.sql --continue-on-error --show-progress
```

#### 💻 Interactive SQL Session

Full PSQL-compatible interactive sessions with meta commands:

```sql
-- List tables
\dt

-- Describe table structure
\d users

-- Execute complex queries
SELECT id, email, created_at
FROM auth.users
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

### Use Cases

- **Database Administration**: Manage schemas, users, and data from command line
- **Script Automation**: Execute SQL scripts for migrations and data loading
- **Cross-Origin Testing**: Connect external applications to browser-based database
- **Team Development**: Share database access with team members
- **CI/CD Integration**: Run database operations in automated pipelines
- **Mobile Development**: Connect mobile apps to local development environment

### Architecture

The CLI communicates with Supabase Lite instances via HTTP using the `/debug/sql` endpoint for query execution. For HTTPS instances, it automatically starts a proxy server that bridges external requests to the browser-based database through PostMessage communication.

```
CLI ─HTTP─> Local Instance (Direct)
CLI ─HTTP─> Proxy Server ─PostMessage─> Browser ─PGlite─> Database (HTTPS)
```

## 📋 Roadmap

### ✅ Completed Features

**Core Platform**

- [x] Browser-based PostgreSQL with PGlite and IndexedDB persistence
- [x] Multi-project management with isolated databases
- [x] Comprehensive dashboard with database status and metrics
- [x] Full-featured SQL Editor with Monaco Editor and query execution
- [x] Table Editor with spreadsheet-like interface and CRUD operations
- [x] Data import/export functionality
- [x] Schema management and visualization

**API Compatibility**

- [x] PostgREST-compatible REST API with full query syntax support
- [x] Row Level Security (RLS) enforcement
- [x] Project-specific API routing and isolation
- [x] Cross-origin API access with MSW integration

**Authentication System**

- [x] Complete GoTrue-compatible authentication service
- [x] JWT token management and validation
- [x] User management with signup/signin/recovery flows
- [x] Multi-factor authentication (TOTP)
- [x] Session lifecycle management
- [x] Admin user operations

**Storage Service**

- [x] Supabase Storage-compatible file management
- [x] Bucket creation and management with policies
- [x] File upload/download with drag-and-drop support
- [x] Signed URL generation for secure file access
- [x] VFS integration with IndexedDB persistence

**Edge Functions**

- [x] Complete serverless development environment
- [x] File explorer with tree view and CRUD operations
- [x] Monaco Editor with TypeScript support and auto-complete
- [x] Local folder synchronization with File System Access API
- [x] Deployment system with environment variables
- [x] Developer tools with logs, metrics, and debugging
- [x] Function execution simulation

**App Hosting**

- [x] Static web app deployment and serving
- [x] Drag-and-drop folder upload for apps
- [x] App management and versioning
- [x] File serving with proper MIME types

**API Testing**

- [x] Interactive API testing interface
- [x] REST endpoint testing with all HTTP methods
- [x] Authentication endpoint validation
- [x] Real-time response inspection

**CLI Tool**

- [x] PSQL-compatible command-line interface
- [x] Project administration (list, create, delete)
- [x] SQL script execution with error handling
- [x] Automatic cross-origin proxy for HTTPS instances

### 🚧 In Progress

- [ ] **Performance Optimization**: Query caching improvements and memory management
- [ ] **Enhanced Testing**: Comprehensive test coverage for all components

### 🔮 Future Features

- [ ] **Realtime Subscriptions**: BroadcastChannel-based real-time data synchronization
- [ ] **API Documentation Generator**: Automatic API docs based on database schema
- [ ] **Schema Migrations**: Visual migration builder and version management
- [ ] **Data Visualization**: Built-in charts and analytics dashboard
- [ ] **Import/Export Enhancements**: Support for more data formats (CSV, JSON, SQL dumps)
- [ ] **Backup Scheduling**: Automated backup system with restore points

## 🧪 API Endpoint Test Runners

Supabase Lite includes comprehensive test runners that validate 100% API compatibility with the official Supabase API. These tools replicate every test from the test-app's Authentication and API Testing tabs to identify compatibility issues.

### 🎯 Perfect Test Parity Achievement

**Both test runners now execute exactly 87 identical tests** - achieving perfect parity between HTTP-based and Supabase.js client testing approaches.

### Features

- **Perfect Test Parity**: Both runners execute exactly 87 identical tests for consistent validation
- **Complete Coverage**: All 84 core test-app tests + 3 enhancement tests for comprehensive validation
- **Dual Testing Approach**: HTTP-based testing and Supabase.js client library testing
- **Random User Generation**: Prevents conflicts with existing users during test runs
- **Detailed Reporting**: JSON reports with compatibility issue analysis and severity levels
- **Cross-Reference System**: Test IDs match between test-app and runners for easy maintenance

### Quick Start

```bash
cd api-endpoint-test-runners
npm install

# Run HTTP-based tests
node curl-test-runner.js

# Run Supabase client library tests
node supabase-client-test-runner.js

# Run both for comparison
npm run test:both
```

### Documentation

For comprehensive documentation including test coverage, usage examples, CI/CD integration, and troubleshooting guides, see:

**📖 [API Endpoint Test Runners Documentation](docs/API-Endpoint-Test-Runners.md)**

## 🤝 Contributing

This project is in active development. Contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

Apache2 License - feel free to use this project for learning and development.

## 🙏 Acknowledgments

- **PGlite** by Electric SQL - Making PostgreSQL run in the browser
- **Supabase** - Inspiration for the UI and feature set
- **Monaco Editor** - Providing VS Code editing experience
- **shadcn/ui** - Beautiful and accessible UI components
