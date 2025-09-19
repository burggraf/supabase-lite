# MSW Handlers Reference

## Overview

This document provides a complete reference to all MSW handlers in the system, including URL patterns, parameters, request/response formats, and behavior specifications.

## Handler Organization

Handlers are organized by domain and loaded in a specific order to ensure correct request routing:

```typescript
// From src/mocks/handlers/index.ts
export const handlers = [
  ...authHandlers,           // 1. Authentication (highest priority)
  ...restHandlers,           // 2. REST API operations
  ...projectsHandlers,       // 3. Project management
  ...debugHandlers,          // 4. Debug utilities
  ...healthHandlers,         // 5. Health checks
  ...storageHandlers,        // 6. Storage operations
  ...vfsDirectHandlers,      // 7. Direct VFS access
  ...appHandlers,            // 8. App hosting
  ...functionsHandlers,      // 9. Edge Functions
  corsAndCatchAllHandler,    // 10. CORS catch-all (lowest priority)
]
```

## Authentication Handlers

### User Registration
**Pattern**: `POST /auth/v1/signup`  
**Pattern**: `POST /:projectId/auth/v1/signup`

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "data": {
    "name": "John Doe",
    "custom_field": "value"
  }
}
```

**Response** (201 Created):
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "created_at": "2024-01-01T00:00:00Z",
    "user_metadata": {
      "name": "John Doe",
      "custom_field": "value"
    }
  },
  "session": {
    "access_token": "jwt_token",
    "token_type": "bearer",
    "expires_in": 3600,
    "refresh_token": "refresh_token"
  }
}
```

**Error Responses**:
- `400`: Invalid email format or weak password
- `409`: User already exists

### User Authentication
**Pattern**: `POST /auth/v1/token`  
**Pattern**: `POST /:projectId/auth/v1/token`

**Request Body**:
```json
{
  "grant_type": "password",
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response** (200 OK):
```json
{
  "access_token": "jwt_token",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "refresh_token",
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

### Token Refresh
**Pattern**: `POST /auth/v1/token`  
**Pattern**: `POST /:projectId/auth/v1/token`

**Request Body**:
```json
{
  "grant_type": "refresh_token",
  "refresh_token": "refresh_token"
}
```

### User Information
**Pattern**: `GET /auth/v1/user`  
**Pattern**: `GET /:projectId/auth/v1/user`

**Headers**: `Authorization: Bearer jwt_token`

**Response** (200 OK):
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "created_at": "2024-01-01T00:00:00Z",
  "user_metadata": {},
  "app_metadata": {}
}
```

### Sign Out
**Pattern**: `POST /auth/v1/logout`  
**Pattern**: `POST /:projectId/auth/v1/logout`

**Headers**: `Authorization: Bearer jwt_token`

## REST API Handlers

### Table Operations

#### Get Records
**Pattern**: `GET /rest/v1/:table`  
**Pattern**: `GET /:projectId/rest/v1/:table`

**Query Parameters**:
- `select`: Column selection (default: `*`)
- `order`: Ordering specification
- `limit`: Maximum number of records
- `offset`: Number of records to skip
- Range header: `Range: 0-9` for pagination

**Headers**:
- `apikey`: API key (optional in development)
- `Authorization`: Bearer token for RLS
- `Prefer`: Response preferences (`count=exact`, `return=representation`)

**Example Request**:
```http
GET /rest/v1/users?select=id,name,email&order=created_at.desc&limit=10
Range: 0-9
Prefer: count=exact
```

**Response** (200 OK):
```json
[
  {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  }
]
```

**Response Headers**:
```http
Content-Range: 0-9/100
Content-Type: application/json
```

#### Create Record
**Pattern**: `POST /rest/v1/:table`  
**Pattern**: `POST /:projectId/rest/v1/:table`

**Request Body**:
```json
{
  "name": "New User",
  "email": "new@example.com"
}
```

**Headers**:
- `Prefer`: `return=representation` to return created record

**Response** (201 Created):
```json
{
  "id": 123,
  "name": "New User",
  "email": "new@example.com",
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### Update Records
**Pattern**: `PATCH /rest/v1/:table`  
**Pattern**: `PATCH /:projectId/rest/v1/:table`

**Query Parameters**: Filter conditions (same as GET)

**Request Body**:
```json
{
  "name": "Updated Name",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

**Response** (200 OK or 204 No Content):
- With `Prefer: return=representation`: Returns updated records
- Without: Returns 204 No Content

#### Delete Records
**Pattern**: `DELETE /rest/v1/:table`  
**Pattern**: `DELETE /:projectId/rest/v1/:table`

**Query Parameters**: Filter conditions (same as GET)

**Response** (200 OK or 204 No Content):
- With `Prefer: return=representation`: Returns deleted records
- Without: Returns 204 No Content

### Advanced Query Features

#### Filtering
All REST endpoints support PostgREST filtering syntax:

```http
# Equality
GET /rest/v1/users?name=eq.John

# Comparison operators
GET /rest/v1/users?age=gt.18&age=lt.65

# Pattern matching
GET /rest/v1/users?name=like.*john*
GET /rest/v1/users?email=ilike.*@gmail.com

# Array operations
GET /rest/v1/users?id=in.(1,2,3)
GET /rest/v1/users?tags=cs.{tag1,tag2}

# JSON operations
GET /rest/v1/users?data->>name=eq.John
GET /rest/v1/users?data->age=gt.18

# Logical operators (Enhanced Bridge only)
GET /rest/v1/users?or=(name.eq.John,name.eq.Jane)
GET /rest/v1/users?and=(age.gt.18,status.eq.active)
```

#### Embedding/Joining
```http
# Single level embedding
GET /rest/v1/users?select=*,posts(*)

# Multi-level embedding (Enhanced Bridge only)
GET /rest/v1/users?select=*,posts(*,comments(*))

# Table-qualified filters (Enhanced Bridge only)
GET /rest/v1/users?select=*,posts(*)&posts.status=eq.published

# Table-qualified ordering
GET /rest/v1/users?select=*,posts(*)&order=posts.created_at.desc
```

#### Ordering
```http
# Single column
GET /rest/v1/users?order=name.asc

# Multiple columns
GET /rest/v1/users?order=name.asc,created_at.desc

# Nulls handling
GET /rest/v1/users?order=name.asc.nullsfirst
```

## Storage Handlers

### Bucket Operations

#### List Buckets
**Pattern**: `GET /storage/v1/bucket`  
**Pattern**: `GET /:projectId/storage/v1/bucket`

**Response** (200 OK):
```json
[
  {
    "id": "bucket-id",
    "name": "my-bucket",
    "public": true,
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

#### Create Bucket
**Pattern**: `POST /storage/v1/bucket`  
**Pattern**: `POST /:projectId/storage/v1/bucket`

**Request Body**:
```json
{
  "name": "my-new-bucket",
  "public": false
}
```

#### Get Bucket Details
**Pattern**: `GET /storage/v1/bucket/:bucketId`  
**Pattern**: `GET /:projectId/storage/v1/bucket/:bucketId`

### Object Operations

#### List Objects
**Pattern**: `POST /storage/v1/object/list/:bucket`  
**Pattern**: `POST /:projectId/storage/v1/object/list/:bucket`

**Request Body**:
```json
{
  "limit": 100,
  "offset": 0,
  "prefix": "folder/",
  "search": "filename"
}
```

**Response** (200 OK):
```json
[
  {
    "name": "file.txt",
    "id": "file-id",
    "updated_at": "2024-01-01T00:00:00Z",
    "created_at": "2024-01-01T00:00:00Z",
    "last_accessed_at": "2024-01-01T00:00:00Z",
    "metadata": {
      "size": 1024,
      "mimetype": "text/plain"
    }
  }
]
```

#### Upload Object
**Pattern**: `POST /storage/v1/object/:bucket/:path*`  
**Pattern**: `POST /:projectId/storage/v1/object/:bucket/:path*`

**Content-Type**: `multipart/form-data` or direct binary

**Request Body**: File data

**Response** (200 OK):
```json
{
  "Key": "path/to/file.txt",
  "Id": "file-id"
}
```

#### Download Object
**Pattern**: `GET /storage/v1/object/:bucket/:path*`  
**Pattern**: `GET /:projectId/storage/v1/object/:bucket/:path*`

**Response**: File content with appropriate `Content-Type` header

#### Delete Object
**Pattern**: `DELETE /storage/v1/object/:bucket/:path*`  
**Pattern**: `DELETE /:projectId/storage/v1/object/:bucket/:path*`

### Signed URLs

#### Create Signed URL
**Pattern**: `POST /storage/v1/object/sign/:bucket/:path*`  
**Pattern**: `POST /:projectId/storage/v1/object/sign/:bucket/:path*`

**Request Body**:
```json
{
  "expiresIn": 3600
}
```

**Response** (200 OK):
```json
{
  "signedUrl": "https://example.com/signed-url?token=..."
}
```

## Debug Handlers

### SQL Execution
**Pattern**: `POST /debug/sql`  
**Pattern**: `POST /:projectId/debug/sql`

**Request Body**:
```json
{
  "sql": "SELECT * FROM users LIMIT 5"
}
```

**Response** (200 OK):
```json
{
  "data": [
    {"id": 1, "name": "John", "email": "john@example.com"}
  ],
  "rowCount": 1,
  "command": "SELECT"
}
```

**Error Response** (400 Bad Request):
```json
{
  "error": "SQL syntax error",
  "details": "syntax error at or near..."
}
```

## Health Check Handlers

### System Health
**Pattern**: `GET /health`

**Response** (200 OK):
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00Z",
  "version": "1.0.0"
}
```

### Database Health
**Pattern**: `GET /:projectId/health`

**Response** (200 OK):
```json
{
  "status": "ok",
  "database": "connected",
  "projectId": "project-123"
}
```

## Project Management Handlers

### Project Creation
**Pattern**: `POST /projects`

**Request Body**:
```json
{
  "name": "My Project",
  "region": "us-east-1"
}
```

### Project List
**Pattern**: `GET /projects`

**Response** (200 OK):
```json
[
  {
    "id": "project-123",
    "name": "My Project",
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

## Edge Functions Handlers

### Function Invocation
**Pattern**: `POST /functions/v1/:functionName`  
**Pattern**: `POST /:projectId/functions/v1/:functionName`

**Headers**: 
- `Authorization`: Bearer token
- `Content-Type`: Request body type

**Request Body**: Function payload (any valid JSON)

**Response**: Function return value

### Function Management
**Pattern**: `GET /functions/v1`  
**Pattern**: `POST /functions/v1/:functionName/deploy`

## Application Server Handlers

### App Deployment
**Pattern**: `POST /app/deploy`  
**Pattern**: `POST /:projectId/app/deploy`

**Content-Type**: `multipart/form-data`

**Request Body**: App files

### App Serving
**Pattern**: `GET /app/:appId/*`  
**Pattern**: `GET /:projectId/app/:appId/*`

**Response**: Static file content

## VFS Direct Handlers

### File Operations
**Pattern**: `GET /vfs/:projectId/files/*`  
**Pattern**: `POST /vfs/:projectId/files/*`  
**Pattern**: `PUT /vfs/:projectId/files/*`  
**Pattern**: `DELETE /vfs/:projectId/files/*`

## CORS Handler

### Preflight Requests
**Pattern**: `OPTIONS *` (catch-all)

**Response Headers**:
```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: apikey, authorization, content-type, prefer, range
Access-Control-Allow-Methods: GET, HEAD, POST, PATCH, DELETE, PUT, OPTIONS
Access-Control-Max-Age: 86400
```

## Error Response Format

All handlers use a consistent error response format:

```json
{
  "code": "error_code",
  "message": "Human readable error message",
  "details": "Additional error details",
  "hint": "Suggestion for fixing the error"
}
```

**Common Error Codes**:
- `400`: Bad Request - Invalid request format
- `401`: Unauthorized - Invalid or missing authentication
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource doesn't exist
- `409`: Conflict - Resource already exists
- `422`: Unprocessable Entity - Valid format but invalid data
- `500`: Internal Server Error - Server-side error

## Handler Configuration

### Environment Variables
- `USE_SIMPLIFIED_BRIDGE`: Toggle between bridge implementations
- `NODE_ENV`: Development vs production behavior
- `MSW_DEBUG`: Enable MSW request logging

### Feature Flags
- Bridge selection affects REST handler capabilities
- Authentication can be disabled for development
- CORS can be configured for different origins

## Testing Handlers

### Basic Handler Test
```javascript
// Test a simple GET request
const response = await fetch('/rest/v1/users?limit=1')
const data = await response.json()
console.log('Users:', data)
```

### Authentication Test
```javascript
// Test signup
const signupResponse = await fetch('/auth/v1/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'password123'
  })
})
```

### Storage Test
```javascript
// Test file upload
const formData = new FormData()
formData.append('file', new Blob(['test content'], { type: 'text/plain' }))

const uploadResponse = await fetch('/storage/v1/object/my-bucket/test.txt', {
  method: 'POST',
  body: formData
})
```

This reference provides complete documentation for all MSW handlers, enabling developers to understand exactly how each endpoint behaves and what to expect from requests and responses.