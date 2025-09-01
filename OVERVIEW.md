# Supabase Lite

A complete browser-based PostgreSQL development environment that runs entirely in-browser using WebAssembly and Mock Service Worker. Supabase Lite provides a local, offline-first educational and development experience with full Supabase API compatibility.

## Value Proposition

- **Zero Setup**: No Docker, servers, or complex installations required
- **100% Browser-Based**: Runs entirely in the browser with WebAssembly PostgreSQL (PGlite)
- **Supabase Compatible**: Near-full API compatibility for seamless migration to/from Supabase
- **Offline Development**: Works without internet connectivity using IndexedDB persistence
- **Multi-Project**: Manage multiple isolated database projects with easy switching

## Major Use Cases

- **Rapid Prototyping**: Quickly test database schemas and API designs without infrastructure
- **Learning & Education**: Learn PostgreSQL and Supabase concepts in a safe, isolated environment
- **Local Development**: Develop and test applications locally before deploying to production
- **Client Demos**: Run live demos without requiring internet or server dependencies
- **API Testing**: Test and validate REST API endpoints with real database interactions

## Major Application Areas

### Database Management

- Visual query editor with syntax highlighting and auto-completion
- Interactive table editor with CRUD operations
- Multi-project management with isolated databases
- Query history and performance tracking
- Database size monitoring and table statistics

### Authentication System

- JWT-based user authentication with bcrypt password hashing
- User signup, signin, password reset workflows
- Row Level Security (RLS) enforcement

### Storage Management

- File upload/download with drag-and-drop support
- Bucket management with policies and access controls
- Signed URL generation for secure file access
- VFS integration for persistent storage using IndexedDB

### Edge Functions Development

- Function deployment and execution simulation
- Edge function API endpoints
- Monaco Editor with full TypeScript IntelliSense

### App Hosting

- Static web app deployment via drag-and-drop folder upload
- File serving with proper MIME type handling
- Integration with VFS for persistent app storage
