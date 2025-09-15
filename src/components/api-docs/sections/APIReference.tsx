import React from 'react'
import { Card } from '../../ui/card'
import { Badge } from '../../ui/badge'

interface APIReferenceProps {
  codeLanguage: 'javascript' | 'bash'
}

export default function APIReference({ codeLanguage }: APIReferenceProps) {
  const getRestEndpointsExample = () => {
    if (codeLanguage === 'javascript') {
      return `// Base URL for all REST API calls
const baseUrl = 'https://your-project.supabase.co/rest/v1'

// Headers required for all requests
const headers = {
  'apikey': 'YOUR_SUPABASE_ANON_KEY',
  'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY',
  'Content-Type': 'application/json'
}

// GET /table_name - Read rows
fetch(\`\${baseUrl}/products\`, { headers })

// POST /table_name - Create rows
fetch(\`\${baseUrl}/products\`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ name: 'New Product', price: 99.99 })
})

// PATCH /table_name - Update rows
fetch(\`\${baseUrl}/products?id=eq.1\`, {
  method: 'PATCH',
  headers,
  body: JSON.stringify({ price: 89.99 })
})

// DELETE /table_name - Delete rows
fetch(\`\${baseUrl}/products?id=eq.1\`, {
  method: 'DELETE',
  headers
})`
    } else {
      return `# Base URL for all REST API calls
BASE_URL="https://your-project.supabase.co/rest/v1"
API_KEY="YOUR_SUPABASE_ANON_KEY"

# GET /table_name - Read rows
curl -X GET "$BASE_URL/products" \\
-H "apikey: $API_KEY" \\
-H "Authorization: Bearer $API_KEY"

# POST /table_name - Create rows
curl -X POST "$BASE_URL/products" \\
-H "apikey: $API_KEY" \\
-H "Authorization: Bearer $API_KEY" \\
-H "Content-Type: application/json" \\
-d '{"name": "New Product", "price": 99.99}'

# PATCH /table_name - Update rows
curl -X PATCH "$BASE_URL/products?id=eq.1" \\
-H "apikey: $API_KEY" \\
-H "Authorization: Bearer $API_KEY" \\
-H "Content-Type: application/json" \\
-d '{"price": 89.99}'

# DELETE /table_name - Delete rows
curl -X DELETE "$BASE_URL/products?id=eq.1" \\
-H "apikey: $API_KEY" \\
-H "Authorization: Bearer $API_KEY"`
    }
  }

  const getAuthEndpointsExample = () => {
    if (codeLanguage === 'javascript') {
      return `// Auth endpoints base URL
const authUrl = 'https://your-project.supabase.co/auth/v1'

// POST /signup - Register new user
fetch(\`\${authUrl}/signup\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'apikey': 'YOUR_KEY' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password'
  })
})

// POST /token - Sign in user
fetch(\`\${authUrl}/token?grant_type=password\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'apikey': 'YOUR_KEY' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password'
  })
})

// POST /logout - Sign out user
fetch(\`\${authUrl}/logout\`, {
  method: 'POST',
  headers: {
    'apikey': 'YOUR_KEY',
    'Authorization': 'Bearer USER_ACCESS_TOKEN'
  }
})

// GET /user - Get current user
fetch(\`\${authUrl}/user\`, {
  headers: {
    'apikey': 'YOUR_KEY',
    'Authorization': 'Bearer USER_ACCESS_TOKEN'
  }
})`
    } else {
      return `# Auth endpoints base URL
AUTH_URL="https://your-project.supabase.co/auth/v1"
API_KEY="YOUR_SUPABASE_ANON_KEY"

# POST /signup - Register new user
curl -X POST "$AUTH_URL/signup" \\
-H "apikey: $API_KEY" \\
-H "Content-Type: application/json" \\
-d '{"email": "user@example.com", "password": "password"}'

# POST /token - Sign in user
curl -X POST "$AUTH_URL/token?grant_type=password" \\
-H "apikey: $API_KEY" \\
-H "Content-Type: application/json" \\
-d '{"email": "user@example.com", "password": "password"}'

# POST /logout - Sign out user
curl -X POST "$AUTH_URL/logout" \\
-H "apikey: $API_KEY" \\
-H "Authorization: Bearer USER_ACCESS_TOKEN"

# GET /user - Get current user
curl -X GET "$AUTH_URL/user" \\
-H "apikey: $API_KEY" \\
-H "Authorization: Bearer USER_ACCESS_TOKEN"`
    }
  }

  const getStorageEndpointsExample = () => {
    if (codeLanguage === 'javascript') {
      return `// Storage endpoints base URL
const storageUrl = 'https://your-project.supabase.co/storage/v1'

// POST /object/bucket_name/file_path - Upload file
const formData = new FormData()
formData.append('file', fileObject)

fetch(\`\${storageUrl}/object/avatars/user-avatar.png\`, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer USER_ACCESS_TOKEN'
  },
  body: formData
})

// GET /object/bucket_name/file_path - Download file
fetch(\`\${storageUrl}/object/avatars/user-avatar.png\`, {
  headers: {
    'Authorization': 'Bearer USER_ACCESS_TOKEN'
  }
})

// DELETE /object/bucket_name/file_path - Delete file
fetch(\`\${storageUrl}/object/avatars/user-avatar.png\`, {
  method: 'DELETE',
  headers: {
    'Authorization': 'Bearer USER_ACCESS_TOKEN'
  }
})

// POST /object/list/bucket_name - List files
fetch(\`\${storageUrl}/object/list/avatars\`, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer USER_ACCESS_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    limit: 100,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' }
  })
})`
    } else {
      return `# Storage endpoints base URL
STORAGE_URL="https://your-project.supabase.co/storage/v1"
ACCESS_TOKEN="USER_ACCESS_TOKEN"

# POST /object/bucket_name/file_path - Upload file
curl -X POST "$STORAGE_URL/object/avatars/user-avatar.png" \\
-H "Authorization: Bearer $ACCESS_TOKEN" \\
-F "file=@avatar.png"

# GET /object/bucket_name/file_path - Download file
curl -X GET "$STORAGE_URL/object/avatars/user-avatar.png" \\
-H "Authorization: Bearer $ACCESS_TOKEN" \\
--output avatar.png

# DELETE /object/bucket_name/file_path - Delete file
curl -X DELETE "$STORAGE_URL/object/avatars/user-avatar.png" \\
-H "Authorization: Bearer $ACCESS_TOKEN"

# POST /object/list/bucket_name - List files
curl -X POST "$STORAGE_URL/object/list/avatars" \\
-H "Authorization: Bearer $ACCESS_TOKEN" \\
-H "Content-Type: application/json" \\
-d '{"limit": 100, "offset": 0}'`
    }
  }

  const getRPCEndpointsExample = () => {
    if (codeLanguage === 'javascript') {
      return `// RPC (Remote Procedure Call) endpoints
const rpcUrl = 'https://your-project.supabase.co/rest/v1/rpc'

// POST /rpc/function_name - Call stored procedure
fetch(\`\${rpcUrl}/get_category_summary\`, {
  method: 'POST',
  headers: {
    'apikey': 'YOUR_SUPABASE_ANON_KEY',
    'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({}) // No parameters for this function
})

// POST /rpc/function_name - Call function with parameters
fetch(\`\${rpcUrl}/get_products_by_category\`, {
  method: 'POST',
  headers: {
    'apikey': 'YOUR_SUPABASE_ANON_KEY',
    'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    category_name: 'Electronics',
    min_price: 100,
    max_price: 500
  })
})`
    } else {
      return `# RPC (Remote Procedure Call) endpoints
RPC_URL="https://your-project.supabase.co/rest/v1/rpc"
API_KEY="YOUR_SUPABASE_ANON_KEY"

# POST /rpc/function_name - Call stored procedure
curl -X POST "$RPC_URL/get_category_summary" \\
-H "apikey: $API_KEY" \\
-H "Authorization: Bearer $API_KEY" \\
-H "Content-Type: application/json" \\
-d '{}'

# POST /rpc/function_name - Call function with parameters
curl -X POST "$RPC_URL/get_products_by_category" \\
-H "apikey: $API_KEY" \\
-H "Authorization: Bearer $API_KEY" \\
-H "Content-Type: application/json" \\
-d '{
  "category_name": "Electronics",
  "min_price": 100,
  "max_price": 500
}'`
    }
  }

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-3xl font-bold mb-6">API Reference</h1>

      <div className="prose prose-neutral dark:prose-invert max-w-none">
        <p className="text-lg text-muted-foreground mb-6">
          Complete reference for all Supabase API endpoints including REST, Auth, Storage, and RPC.
          Use this reference to integrate directly with HTTP endpoints.
        </p>

        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-8">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">API Endpoints</h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• <strong>REST API:</strong> /rest/v1/* - Database operations</li>
            <li>• <strong>Auth API:</strong> /auth/v1/* - Authentication endpoints</li>
            <li>• <strong>Storage API:</strong> /storage/v1/* - File storage operations</li>
            <li>• <strong>RPC API:</strong> /rest/v1/rpc/* - Stored procedure calls</li>
            <li>• <strong>GraphQL API:</strong> /graphql/v1 - GraphQL endpoint</li>
          </ul>
        </div>
      </div>

      {/* REST API Endpoints */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">REST API Endpoints</h2>
        <p className="text-muted-foreground mb-4">
          Access your database tables and views through RESTful endpoints. All endpoints follow PostgREST conventions.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold">DATABASE OPERATIONS</h3>
          <Badge variant="outline" className="text-xs">
            {codeLanguage === 'javascript' ? 'JavaScript' : 'Bash'}
          </Badge>
        </div>
        <Card className="p-4">
          <pre className="text-sm overflow-x-auto">
            <code>{getRestEndpointsExample()}</code>
          </pre>
        </Card>
      </div>

      {/* Auth API Endpoints */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Auth API Endpoints</h2>
        <p className="text-muted-foreground mb-4">
          Manage user authentication, registration, and sessions through dedicated auth endpoints.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold">AUTHENTICATION OPERATIONS</h3>
          <Badge variant="outline" className="text-xs">
            {codeLanguage === 'javascript' ? 'JavaScript' : 'Bash'}
          </Badge>
        </div>
        <Card className="p-4">
          <pre className="text-sm overflow-x-auto">
            <code>{getAuthEndpointsExample()}</code>
          </pre>
        </Card>
      </div>

      {/* Storage API Endpoints */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Storage API Endpoints</h2>
        <p className="text-muted-foreground mb-4">
          Upload, download, and manage files through the Storage API. Supports bucket-based organization.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold">FILE OPERATIONS</h3>
          <Badge variant="outline" className="text-xs">
            {codeLanguage === 'javascript' ? 'JavaScript' : 'Bash'}
          </Badge>
        </div>
        <Card className="p-4">
          <pre className="text-sm overflow-x-auto">
            <code>{getStorageEndpointsExample()}</code>
          </pre>
        </Card>
      </div>

      {/* RPC API Endpoints */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">RPC API Endpoints</h2>
        <p className="text-muted-foreground mb-4">
          Call PostgreSQL stored procedures (functions) through RPC endpoints for custom business logic.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold">STORED PROCEDURE CALLS</h3>
          <Badge variant="outline" className="text-xs">
            {codeLanguage === 'javascript' ? 'JavaScript' : 'Bash'}
          </Badge>
        </div>
        <Card className="p-4">
          <pre className="text-sm overflow-x-auto">
            <code>{getRPCEndpointsExample()}</code>
          </pre>
        </Card>
      </div>

      {/* HTTP Status Codes */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">HTTP Status Codes</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4">
            <h3 className="font-semibold mb-2 text-green-600 dark:text-green-400">Success Codes</h3>
            <div className="space-y-2 text-sm">
              <div><code className="bg-muted px-1 py-0.5 rounded">200</code> - OK (GET, PATCH, DELETE)</div>
              <div><code className="bg-muted px-1 py-0.5 rounded">201</code> - Created (POST)</div>
              <div><code className="bg-muted px-1 py-0.5 rounded">204</code> - No Content (DELETE)</div>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-2 text-red-600 dark:text-red-400">Error Codes</h3>
            <div className="space-y-2 text-sm">
              <div><code className="bg-muted px-1 py-0.5 rounded">400</code> - Bad Request</div>
              <div><code className="bg-muted px-1 py-0.5 rounded">401</code> - Unauthorized</div>
              <div><code className="bg-muted px-1 py-0.5 rounded">403</code> - Forbidden</div>
              <div><code className="bg-muted px-1 py-0.5 rounded">404</code> - Not Found</div>
              <div><code className="bg-muted px-1 py-0.5 rounded">409</code> - Conflict</div>
              <div><code className="bg-muted px-1 py-0.5 rounded">422</code> - Unprocessable Entity</div>
            </div>
          </Card>
        </div>
      </div>

      {/* Request Headers */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Required Headers</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4">
            <h3 className="font-semibold mb-2">Authentication Headers</h3>
            <div className="space-y-2 text-sm">
              <div><code className="bg-muted px-1 py-0.5 rounded text-xs">apikey</code> - Your project's anon key</div>
              <div><code className="bg-muted px-1 py-0.5 rounded text-xs">Authorization</code> - Bearer token</div>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-2">Content Headers</h3>
            <div className="space-y-2 text-sm">
              <div><code className="bg-muted px-1 py-0.5 rounded text-xs">Content-Type</code> - application/json</div>
              <div><code className="bg-muted px-1 py-0.5 rounded text-xs">Prefer</code> - return=representation</div>
            </div>
          </Card>
        </div>
      </div>

      {/* Query Parameters */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Query Parameters</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4">
            <h3 className="font-semibold mb-2">Filtering</h3>
            <div className="space-y-1 text-xs">
              <div><code className="bg-muted px-1 py-0.5 rounded">column=eq.value</code> - Equal</div>
              <div><code className="bg-muted px-1 py-0.5 rounded">column=gt.100</code> - Greater than</div>
              <div><code className="bg-muted px-1 py-0.5 rounded">column=lt.100</code> - Less than</div>
              <div><code className="bg-muted px-1 py-0.5 rounded">column=like.*text*</code> - Pattern match</div>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-2">Ordering & Limiting</h3>
            <div className="space-y-1 text-xs">
              <div><code className="bg-muted px-1 py-0.5 rounded">order=column.asc</code> - Sort ascending</div>
              <div><code className="bg-muted px-1 py-0.5 rounded">order=column.desc</code> - Sort descending</div>
              <div><code className="bg-muted px-1 py-0.5 rounded">limit=10</code> - Limit results</div>
              <div><code className="bg-muted px-1 py-0.5 rounded">offset=20</code> - Pagination offset</div>
            </div>
          </Card>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">API Best Practices</h3>
        <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
          <li>• Always include required authentication headers</li>
          <li>• Use HTTPS for all API requests in production</li>
          <li>• Handle errors gracefully and check HTTP status codes</li>
          <li>• Implement rate limiting and caching where appropriate</li>
          <li>• Use the Supabase client libraries for easier integration</li>
        </ul>
      </div>
    </div>
  )
}