# Edge Functions Developer Guide

A comprehensive guide to using Edge Functions in Supabase Lite - your complete serverless development environment running entirely in the browser.

## Table of Contents

1. [Getting Started](#getting-started)
2. [File Management](#file-management)
3. [Code Editor Features](#code-editor-features)
4. [Local Folder Synchronization](#local-folder-synchronization)
5. [Deployment System](#deployment-system)
6. [Developer Tools](#developer-tools)
7. [Best Practices](#best-practices)
8. [Examples and Use Cases](#examples-and-use-cases)
9. [Troubleshooting](#troubleshooting)

---

## Getting Started

### What are Edge Functions?

Edge Functions in Supabase Lite provide a complete serverless development environment that runs entirely in your browser. You can:

- Write and edit TypeScript/JavaScript functions with full IDE support
- Test functions locally with realistic execution simulation
- Synchronize with local folders for external development workflows  
- Deploy and manage functions with environment variables
- Monitor performance and debug with comprehensive developer tools

### Accessing Edge Functions

1. Start Supabase Lite: `npm run dev`
2. Navigate to `http://localhost:5173`
3. Click **Edge Functions** in the sidebar
4. Start creating your first serverless function!

### Your First Function

Let's create a simple "Hello World" function:

1. **Create a new function**:
   - Right-click in the file explorer
   - Select "New File"
   - Name it `hello/index.ts`

2. **Write your function**:
   ```typescript
   // hello/index.ts
   import "jsr:@supabase/functions-js/edge-runtime.d.ts";

   Deno.serve(async (req: Request) => {
     const { name } = await req.json() || { name: "World" };
     
     return new Response(
       JSON.stringify({ 
         message: `Hello, ${name}!`,
         timestamp: new Date().toISOString()
       }),
       { 
         headers: { 
           "Content-Type": "application/json" 
         } 
       }
     );
   });
   ```

3. **Test your function**:
   - Switch to the **Deployment** tab
   - Click "Test Function"
   - Send a test request with JSON body: `{"name": "Developer"}`
   - View the response in real-time!

---

## File Management

The File Explorer provides a powerful tree view for managing your Edge Functions with full CRUD operations.

### File Operations

#### Creating Files and Folders
- **Right-click menu**: Right-click in empty space or on folders
  - "New File" - Create a new TypeScript/JavaScript file
  - "New Folder" - Create a new directory
- **Quick creation**: Use the "+" buttons in the toolbar
- **Nested structure**: Create complex directory structures like `api/users/[id]/index.ts`

#### File Naming Conventions
```
edge-functions/
├── hello/
│   └── index.ts          # Simple function
├── api/
│   ├── users/
│   │   ├── index.ts      # GET /api/users
│   │   └── create.ts     # POST /api/users  
│   └── auth/
│       └── login.ts      # Authentication function
└── webhooks/
    └── stripe.ts         # Webhook handler
```

#### Managing Files
- **Rename**: Right-click → "Rename" or click on file name
- **Delete**: Right-click → "Delete" with confirmation dialog
- **Move**: Drag and drop files between folders (coming soon)
- **Search**: Use the search bar to quickly find files

### File Types and Templates

Edge Functions supports various file types:

- **TypeScript** (`.ts`): Full type support with IntelliSense
- **JavaScript** (`.js`): Standard JavaScript functions
- **Configuration** (`.json`): Environment configs and settings

---

## Code Editor Features

The Monaco Editor provides a professional VS Code-like experience with advanced features.

### Editor Capabilities

#### TypeScript Support
- **Full IntelliSense**: Auto-completion for Deno APIs and Edge Runtime
- **Type Checking**: Real-time TypeScript error detection
- **Syntax Highlighting**: Rich syntax coloring for TypeScript/JavaScript
- **Code Folding**: Collapse functions and blocks for better navigation

#### Multi-File Editing
```typescript
// Tab management
- Open multiple files in tabs
- Switch between files instantly  
- Unsaved changes indicator (*)
- Auto-save every 2 seconds
- Preserve tab state across sessions
```

#### Advanced Editing Features
- **Multi-cursor editing**: Hold Cmd/Ctrl + click
- **Find and replace**: Cmd/Ctrl + F for search, Cmd/Ctrl + H for replace
- **Code formatting**: Auto-format on save
- **Bracket matching**: Automatic bracket pair highlighting
- **Code suggestions**: IntelliSense with parameter hints

### Auto-Save System

The editor automatically saves your changes every 2 seconds when you stop typing:

- **Visual feedback**: Unsaved files show `*` in the tab
- **Debounced saving**: Prevents excessive save operations
- **Cross-tab sync**: Changes sync across browser tabs
- **Manual save**: Cmd/Ctrl + S for immediate save

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + S` | Save current file |
| `Cmd/Ctrl + F` | Find in file |
| `Cmd/Ctrl + H` | Find and replace |
| `Cmd/Ctrl + /` | Toggle comment |
| `Alt + Up/Down` | Move line up/down |
| `Cmd/Ctrl + D` | Select next occurrence |
| `Cmd/Ctrl + Shift + K` | Delete line |

---

## Local Folder Synchronization

Synchronize your Edge Functions with local directories for seamless development workflows.

### Setting Up Sync

1. **Access Folder Sync**:
   - Click the **Folder Sync** tab
   - Click "Select Folder" to choose your local directory

2. **Grant Permissions**:
   - Browser will request file system access
   - Select your project's functions folder
   - Grant read/write permissions

3. **Configure Sync Settings**:
   ```typescript
   {
     "syncDirection": "both",    // both, toLocal, toRemote
     "autoSync": true,          // Sync on file changes
     "includePatterns": ["*.ts", "*.js", "*.json"],
     "excludePatterns": ["node_modules/**", ".git/**"]
   }
   ```

### Sync Operations

#### Bidirectional Sync
- **From Browser to Local**: Download functions to your local folder
- **From Local to Browser**: Upload local changes to Supabase Lite
- **Auto-sync**: Real-time synchronization when files change

#### Conflict Resolution
When conflicts occur during sync:

```typescript
interface Conflict {
  file: string;
  localContent: string;
  remoteContent: string;
  lastModified: {
    local: Date;
    remote: Date;
  };
}
```

Resolution options:
- **Keep Local**: Use your local file version
- **Keep Remote**: Use the browser version  
- **Merge**: Manually merge both versions
- **Preview**: See differences before deciding

### Browser Compatibility

| Browser | File System Access API | Sync Status |
|---------|----------------------|-------------|
| Chrome 86+ | ✅ Full Support | ✅ Complete |
| Edge 86+ | ✅ Full Support | ✅ Complete |
| Firefox | ❌ Not Supported | 🔴 Disabled |
| Safari | ❌ Not Supported | 🔴 Disabled |

*Note: Sync functionality gracefully degrades in unsupported browsers*

---

## Deployment System

Manage your Edge Functions deployment lifecycle with environment variables, versioning, and testing.

### Environment Variables

Secure configuration management for your functions:

1. **Adding Variables**:
   - Go to **Deployment** tab
   - Click "Environment Variables"
   - Add key-value pairs for your configuration

```typescript
// Example environment variables
{
  "DATABASE_URL": "your-database-connection",
  "API_SECRET": "your-secret-key", 
  "STRIPE_WEBHOOK_SECRET": "whsec_...",
  "DEBUG_MODE": "true"
}
```

2. **Using in Functions**:
```typescript
Deno.serve(async (req: Request) => {
  const secret = Deno.env.get("API_SECRET");
  const debugMode = Deno.env.get("DEBUG_MODE") === "true";
  
  if (debugMode) {
    console.log("Debug mode enabled");
  }
  
  // Your function logic here
});
```

### Function Testing

Test your functions before deployment:

1. **Test Interface**:
   - Method selection (GET, POST, PUT, DELETE)
   - Request headers configuration
   - Request body editor with JSON validation
   - Query parameters input

2. **Example Test Request**:
```json
{
  "method": "POST",
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer test-token"
  },
  "body": {
    "user_id": "123",
    "action": "create_profile"
  },
  "query": {
    "debug": "true"
  }
}
```

### Deployment History

Track all your function deployments:

- **Version Control**: Each deployment creates a new version
- **Rollback Support**: One-click rollback to any previous version
- **Deployment Metadata**: Timestamp, status, and environment variables
- **Status Tracking**: Success/failure indicators with detailed logs

```typescript
interface DeploymentHistory {
  id: string;
  functionName: string;
  version: number;
  status: 'deployed' | 'failed' | 'rolled_back';
  deployedAt: string;
  environmentVars: Record<string, string>;
}
```

---

## Developer Tools

Comprehensive debugging and monitoring tools for your Edge Functions.

### Console Logs

Monitor function execution in real-time:

#### Log Features
- **Real-time streaming**: Live logs during function execution
- **Log levels**: Info, Warning, Error, Debug
- **Filtering**: Filter by level, function name, or content
- **Search**: Full-text search through log history
- **Export**: Download logs for offline analysis

#### Log Format
```typescript
{
  timestamp: "2025-08-28T10:30:45.123Z",
  level: "info",
  message: "User authentication successful", 
  functionName: "auth-login",
  executionId: "exec-123",
  metadata: {
    userId: "user-456",
    duration: "45ms"
  }
}
```

### Performance Monitoring

Track function performance and optimization opportunities:

#### Metrics Dashboard
```typescript
interface PerformanceMetrics {
  executionTime: {
    avg: number;      // Average execution time
    p50: number;      // 50th percentile 
    p95: number;      // 95th percentile
    p99: number;      // 99th percentile
  };
  invocations: {
    total: number;    // Total invocations
    successful: number;  // Successful executions
    failed: number;   // Failed executions
    errorRate: number; // Error percentage
  };
  memory: {
    peak: number;     // Peak memory usage
    average: number;  // Average memory usage
  };
}
```

#### Performance Graphs
- **Execution Time**: Trends over time with percentile breakdowns
- **Invocation Rate**: Function call frequency and patterns
- **Error Tracking**: Error rates and failure analysis
- **Memory Usage**: Memory consumption patterns

### Network Monitoring

Monitor function network requests and API calls:

- **Request/Response Logging**: Full HTTP request and response capture
- **API Call Tracking**: External API usage monitoring  
- **Response Time Analysis**: Network latency measurements
- **Error Detection**: Network-related error identification

---

## Best Practices

### Function Structure

#### Single Responsibility
```typescript
// ✅ Good: Single, focused function
export async function createUser(userData: UserData) {
  return await userService.create(userData);
}

// ❌ Bad: Multiple responsibilities
export async function handleUserStuff(action: string, data: any) {
  // Too many different operations in one function
}
```

#### Error Handling
```typescript
Deno.serve(async (req: Request) => {
  try {
    const body = await req.json();
    
    // Validate input
    if (!body.email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Your logic here
    const result = await processUser(body);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error("Function error:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        message: error.message 
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
```

### Performance Optimization

#### Efficient Response Handling
```typescript
// ✅ Good: Efficient JSON response
return new Response(JSON.stringify(data), {
  headers: { 
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=300" // 5 minutes cache
  }
});

// ✅ Good: Streaming for large responses  
return new Response(stream, {
  headers: { "Content-Type": "application/json" }
});
```

#### Resource Management
```typescript
// ✅ Good: Proper cleanup
const connection = await database.connect();
try {
  const result = await connection.query(sql);
  return result;
} finally {
  await connection.close(); // Always cleanup
}
```

### Security Best Practices

#### Input Validation
```typescript
function validateInput(data: unknown): UserData {
  // Use a validation library like zod
  const schema = z.object({
    email: z.string().email(),
    name: z.string().min(1).max(100),
    age: z.number().min(0).max(150)
  });
  
  return schema.parse(data);
}
```

#### Environment Variables
```typescript
// ✅ Good: Secure secret handling
const dbPassword = Deno.env.get("DB_PASSWORD");
if (!dbPassword) {
  throw new Error("Database password not configured");
}

// ❌ Bad: Hardcoded secrets
const dbPassword = "hardcoded-secret"; // Never do this!
```

### File Organization

#### Recommended Structure
```
edge-functions/
├── auth/                 # Authentication functions
│   ├── login.ts
│   ├── logout.ts
│   └── refresh-token.ts
├── api/                  # API endpoints
│   ├── users/
│   │   ├── index.ts      # List users
│   │   ├── create.ts     # Create user
│   │   └── [id]/
│   │       ├── index.ts  # Get user by ID
│   │       └── update.ts # Update user
│   └── products/
│       └── index.ts
├── webhooks/            # Webhook handlers
│   ├── stripe.ts
│   └── github.ts
├── scheduled/           # Scheduled functions
│   └── cleanup.ts
└── utils/              # Shared utilities
    ├── database.ts
    ├── auth.ts
    └── validation.ts
```

---

## Examples and Use Cases

### REST API Endpoints

#### User Management API
```typescript
// api/users/index.ts - GET /api/users
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "10");
  const offset = parseInt(url.searchParams.get("offset") || "0");
  
  const users = await getUsersFromDatabase({ limit, offset });
  
  return new Response(JSON.stringify({
    users,
    pagination: {
      limit,
      offset,
      total: users.length
    }
  }), {
    headers: { "Content-Type": "application/json" }
  });
});
```

#### CRUD Operations
```typescript
// api/users/[id]/index.ts - GET /api/users/:id
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const pathSegments = url.pathname.split('/');
  const userId = pathSegments[pathSegments.length - 1];
  
  if (!userId) {
    return new Response(
      JSON.stringify({ error: "User ID required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  
  const user = await getUserById(userId);
  
  if (!user) {
    return new Response(
      JSON.stringify({ error: "User not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  
  return new Response(JSON.stringify(user), {
    headers: { "Content-Type": "application/json" }
  });
});
```

### Webhook Handlers

#### Stripe Webhook
```typescript
// webhooks/stripe.ts
import { crypto } from "https://deno.land/std/crypto/mod.ts";

Deno.serve(async (req: Request) => {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  
  if (!signature || !webhookSecret) {
    return new Response("Unauthorized", { status: 401 });
  }
  
  const payload = await req.text();
  
  // Verify webhook signature
  const isValid = await verifyStripeSignature(payload, signature, webhookSecret);
  if (!isValid) {
    return new Response("Invalid signature", { status: 401 });
  }
  
  const event = JSON.parse(payload);
  
  switch (event.type) {
    case "payment_intent.succeeded":
      await handleSuccessfulPayment(event.data.object);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdate(event.data.object);
      break;
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
  
  return new Response("OK");
});

async function verifyStripeSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  // Implement Stripe signature verification
  // This is a simplified example
  return true;
}
```

### Authentication Functions

#### JWT Token Validation
```typescript
// auth/validate-token.ts
import { verify } from "https://deno.land/x/djwt@v2.8/mod.ts";

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get("Authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Missing or invalid authorization header" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  
  const token = authHeader.substring(7);
  const jwtSecret = Deno.env.get("JWT_SECRET");
  
  try {
    const payload = await verify(token, jwtSecret, "HS256");
    
    return new Response(JSON.stringify({
      valid: true,
      user: payload
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      valid: false,
      error: "Invalid token"
    }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
});
```

### Scheduled Functions

#### Database Cleanup
```typescript
// scheduled/cleanup.ts
Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get("Authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");
  
  // Verify this is a legitimate cron request
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  
  console.log("Starting scheduled cleanup...");
  
  try {
    // Clean up expired sessions
    const expiredSessions = await cleanupExpiredSessions();
    
    // Clean up temporary files
    const tempFiles = await cleanupTempFiles();
    
    // Send cleanup report
    const report = {
      timestamp: new Date().toISOString(),
      expiredSessions: expiredSessions.length,
      tempFiles: tempFiles.length,
      status: "completed"
    };
    
    console.log("Cleanup completed:", report);
    
    return new Response(JSON.stringify(report), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Cleanup failed:", error);
    
    return new Response(JSON.stringify({
      error: "Cleanup failed",
      message: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
```

---

## Troubleshooting

### Common Issues

#### Function Not Found
**Problem**: Getting 404 when testing functions
**Solution**:
1. Check file exists in `edge-functions/` directory
2. Verify file has `.ts` or `.js` extension
3. Ensure function exports `Deno.serve()` call

#### TypeScript Errors
**Problem**: Red underlines in editor
**Solution**:
1. Check import paths are correct
2. Add missing type definitions
3. Verify Deno-specific imports use correct URLs

#### Auto-save Not Working
**Problem**: Changes not saving automatically
**Solution**:
1. Check browser storage permissions
2. Try manual save with Cmd/Ctrl + S
3. Refresh page and retry

#### Sync Folder Access Denied
**Problem**: Can't access local folder
**Solution**:
1. Use Chrome or Edge browser (86+)
2. Grant file system permissions when prompted
3. Check folder isn't protected or in use

### Performance Issues

#### Slow Function Execution
**Causes & Solutions**:

1. **Large Response Size**:
   - Use streaming for large data
   - Implement pagination
   - Add response compression

2. **Inefficient Database Queries**:
   - Add database indexes
   - Optimize query structure
   - Use connection pooling

3. **Memory Leaks**:
   - Close database connections
   - Clear large objects
   - Monitor memory usage in DevTools

#### Editor Performance
**Problem**: Editor feels slow or laggy
**Solution**:
1. Close unnecessary tabs
2. Reduce file size (split large functions)
3. Clear browser cache
4. Check available memory

### Browser Compatibility

#### Feature Support Matrix
| Feature | Chrome/Edge 86+ | Firefox 78+ | Safari 14+ |
|---------|----------------|-------------|------------|
| Core Editor | ✅ Full | ✅ Full | ✅ Full |
| Auto-save | ✅ Full | ✅ Full | ✅ Full |
| Folder Sync | ✅ Full | ❌ No Support | ❌ No Support |
| File System API | ✅ Full | ❌ No Support | ❌ No Support |
| Monaco Editor | ✅ Full | ✅ Full | ✅ Full |
| Developer Tools | ✅ Full | ✅ Full | ✅ Full |

#### Unsupported Features
When using browsers without File System Access API:
- Folder sync will be disabled
- All other features work normally
- Manual file upload/download available
- Consider using Chrome/Edge for full functionality

### Getting Help

#### Resources
- **Documentation**: Check this guide for detailed information
- **Console Logs**: Use browser DevTools for debugging
- **Performance Metrics**: Monitor function execution in DevTools panel
- **Community**: Share issues and solutions with other developers

#### Debug Checklist
When something isn't working:

1. **Check Browser Console**: Look for JavaScript errors
2. **Verify Function Code**: Ensure proper TypeScript/JavaScript syntax
3. **Test Environment Variables**: Verify all required variables are set
4. **Check File Structure**: Confirm files are in correct locations
5. **Review Network Tab**: Check for failed API requests
6. **Clear Cache**: Sometimes a refresh resolves issues
7. **Try Different Browser**: Test in Chrome/Edge for full compatibility

---

## Conclusion

Edge Functions in Supabase Lite provide a complete serverless development environment that runs entirely in your browser. With professional code editing, local folder sync, comprehensive deployment tools, and advanced debugging capabilities, you have everything needed to build and test serverless functions without any server infrastructure.

The combination of Monaco Editor's powerful features, real-time synchronization, and comprehensive developer tools makes Supabase Lite's Edge Functions a compelling choice for serverless development, prototyping, and learning.

Start building your serverless functions today and experience the full power of browser-based development!