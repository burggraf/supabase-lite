### **Analysis of the Current System**

1.  **Complexity through Multiple Bridges:** The system uses an `EnhancedSupabaseAPIBridge` for full PostgREST compatibility and a `SimplifiedSupabaseAPIBridge` for performance. This creates two separate, complex code paths for handling requests, leading to:
    *   **Code Duplication:** Logic for parsing, SQL generation, and request handling is duplicated and divergent between the bridges.
    *   **Debugging Difficulty:** It's hard to trace which bridge is handling a request and why behavior might differ. The documentation explicitly calls this out as a major challenge.
    *   **Maintenance Overhead:** New features or bug fixes need to be considered for both bridges, increasing development time.
    *   **Inconsistent Behavior:** The `simplified-bridge.ts` has known issues (e.g., the "overlaps" operator) and silently fails on unsupported features, which is dangerous.

2.  **Monolithic Handler File:** `src/mocks/handlers.ts` is a large file that contains routing logic for all API domains (REST, auth, storage, etc.). This makes it difficult to:
    *   Locate the code for a specific endpoint.
    *   Understand the scope of a particular feature.
    *   Avoid conflicts and ordering issues between handlers.

3.  **Convoluted Project Resolution:** The `withProjectResolution` higher-order function is wrapped around handlers, mixing routing/middleware concerns with business logic. While it includes caching, the implementation is spread across `project-resolver.ts` and `handlers.ts`, making the request lifecycle harder to follow.

4.  **Inconsistent Abstractions:** The system uses a "Bridge" pattern, but its application is inconsistent. `AuthBridge` and `VFSBridge` are more like service classes, whereas the REST bridges are complex request processors. This makes the term "Bridge" ambiguous.

### **The Refactoring Plan: A Unified, Modular, Pipeline-Based Architecture**

The goal is to move from a multi-bridge, monolithic system to a single, unified, and modular request processing pipeline. This will simplify the architecture, eliminate code duplication, and make the system easier to debug and extend.

---

### **Phase 1: Introduce a Unified API Kernel and Request Pipeline**

**Goal:** Replace the dual-bridge system with a single, composable request processing pipeline. This pipeline will be a series of middleware functions that each perform a specific task.

**Proposed Changes:**

1.  **Create `src/api/kernel.ts`:** This file will export a `createApiHandler` function. This function will take a feature-specific executor and wrap it in a standard pipeline of middleware.

2.  **Define the Middleware Pipeline:** The pipeline will process requests in a clear, linear sequence:
    *   **Instrumentation:** Assign a unique Request ID for tracing.
    *   **CORS Handling:** Ensure all responses have correct CORS headers.
    *   **Project Resolution:** Extract the project ID and switch the database context. This logic will be a self-contained middleware, replacing the `withProjectResolution` HOF.
    *   **Authentication & RLS:** Decode the JWT and establish the user's session context for Row Level Security.
    *   **Request Parsing:** A new, unified parser will translate URL parameters and headers into a standardized `ParsedQuery` object. This parser will combine the strengths of both old bridges.
    *   **Execution:** The feature-specific logic (e.g., for a database query or a storage operation) is executed.
    *   **Response Formatting:** Format the result into a standard PostgREST-compatible or JSON:API response.
    *   **Error Handling:** A final middleware to catch all errors and format them into a standard error response.

**Benefits:**
*   **Simplicity:** A single, predictable request lifecycle for all API calls.
*   **Extensibility:** New cross-cutting concerns (like caching or rate-limiting) can be added as new middleware to one place.
*   **Debuggability:** Tracing a request becomes a simple matter of following the steps in the pipeline.

---

### **Phase 2: Modularize API Handlers by Feature**

**Goal:** Break down the monolithic `src/mocks/handlers.ts` into feature-specific modules.

**Proposed Changes:**

1.  **Create a New API Directory:** `src/api/`.
2.  **Create Feature-Specific Subdirectories:**
    *   `src/api/db/`: For all PostgREST-related database operations.
    *   `src/api/auth/`: For all authentication endpoints.
    *   `src/api/storage/`: For all file storage operations.
    *   `src/api/functions/`: For edge function invocations.
3.  **Structure of Each Feature Module:**
    *   `handlers.ts`: Contains the MSW `http` handlers, which will be extremely simple. They will only call the `createApiHandler` from the kernel, passing in the feature-specific executor.
    *   `executor.ts`: Contains the core business logic for the feature (e.g., `handleSelect`, `handleInsert`). This is what the pipeline will execute.
    *   `parser.ts` (if needed): Feature-specific parsing logic.
    *   `formatter.ts` (if needed): Feature-specific response formatting.

**Benefits:**
*   **Clarity:** Code for a feature is co-located and easy to find.
*   **Maintainability:** Changes to the `storage` API won't risk breaking the `auth` API.
*   **Scalability:** Adding a new API (e.g., "realtime") is as simple as adding a new directory.

---

### **Phase 3: Consolidate Bridges into a Unified Query Engine**

**Goal:** Eliminate the `enhanced-bridge.ts` and `simplified-bridge.ts` files and create a single, powerful, and efficient query engine.

**Proposed Changes:**

1.  **Create `src/api/db/QueryEngine.ts`:** This class will be responsible for translating the `ParsedQuery` object from the pipeline into an executable SQL query.
2.  **Unify Parsing Logic:** Create a new `QueryParser` in `src/api/db/parser.ts`. This parser will support the full PostgREST syntax from the enhanced bridge but will be optimized. It can use fast paths for simple queries (the goal of the simplified bridge) and fall back to more complex parsing only when needed. This is an internal optimization, not a top-level architectural split.
3.  **Unify SQL Generation:** Create a new `SQLBuilder` in `src/api/db/sql.ts`. This builder will handle all SQL generation, including complex joins for embedded resources and RLS-aware queries.
4.  **Deprecate the Bridges:** The `enhanced-bridge.ts` and `simplified-bridge.ts` files will be removed entirely. The `AuthBridge` and `VFSBridge` will be refactored into service classes within their respective feature modules (`src/api/auth/service.ts`, `src/api/storage/service.ts`).

**Benefits:**
*   **Efficiency:** A single, optimized query engine that can handle all cases without the overhead of two separate systems.
*   **Consistency:** All REST queries are guaranteed to behave identically.
*   **Reduced Complexity:** The most complex part of the old architecture is replaced with a single, streamlined component.

---

### **Phase 4: Standardize and Centralize Configuration, Error Handling, and Debugging**

**Goal:** Make the system's behavior predictable and easy to debug.

**Proposed Changes:**

1.  **Centralized Configuration:** Create a single `src/api/config.ts` to manage all API-related settings (e.g., JWT secrets, default query limits).
2.  **Standardized API Error:** Create a custom `ApiError` class in `src/api/errors.ts` with properties like `statusCode`, `errorCode`, and `details`. All executors will throw this error, and the pipeline's error handling middleware will format it.
3.  **Enhanced Debugging:** The instrumentation middleware in the pipeline will be the single source of truth for logging. The `window.mswDebug` tools will be refactored to hook into the pipeline, allowing developers to inspect the request at each stage (e.g., "after-authentication", "after-parsing").

**Benefits:**
*   **Predictability:** Consistent error formats and configuration management.
*   **Powerful Debugging:** The ability to inspect a request as it flows through the pipeline will dramatically reduce debugging time.

---

### **Complete API Endpoint Inventory (77 Total Endpoints)**

This refactor must handle **ALL** existing endpoints to ensure 100% compatibility:

#### **Database/REST API (8 endpoints)**
- `GET/POST/PATCH/DELETE /rest/v1/:table` (4 endpoints)
- `GET/POST/PATCH/DELETE /:projectId/rest/v1/:table` (4 endpoints)

#### **Authentication API (34 endpoints)**
- Core auth: signup, signin, token, logout, session, user (12 endpoints)
- Password recovery: recover, verify, magiclink, otp (8 endpoints)
- MFA: factors, challenge, verify, delete (8 endpoints)
- OAuth: authorize, callback (4 endpoints)
- Admin: users CRUD, generate_link, sessions (10 endpoints)
- Identity management: identities CRUD (6 endpoints)
- Each with both `/auth/v1/` and `/:projectId/auth/v1/` variants

#### **Storage API (20 endpoints)**
- Bucket management: create, list, get, update, delete, empty (12 endpoints)
- Object operations: upload, download, delete, list, move, copy (16 endpoints)
- Signed URLs: sign, upload/sign, public, authenticated access (8 endpoints)
- Each with both `/storage/v1/` and `/:projectId/storage/v1/` variants

#### **Edge Functions (4 endpoints)**
- `ALL /functions/:functionName` (2 endpoints)
- `ALL /functions/v1/:functionName` (legacy support) (2 endpoints)

#### **Project Management (4 endpoints)**
- `GET /projects` (public project listing)
- `GET /admin/projects` (admin project listing)
- `POST /admin/projects` (create project)
- `DELETE /admin/projects/:projectId` (delete project)

#### **Debug & Utilities (3 endpoints)**
- `POST /debug/sql` and `POST /:projectId/debug/sql` (2 endpoints)
- `GET /health` (health check) (1 endpoint)

#### **Direct File Access (2 endpoints)**
- `GET /files/:bucket/*` and `GET /:projectId/files/:bucket/*` (2 endpoints)

#### **App Hosting (2 endpoints)**
- `GET /app/*` and `GET /:projectId/app/*` (SPA serving) (2 endpoints)

#### **Infrastructure (2 endpoints)**
- `OPTIONS *` (CORS preflight handling)
- `ALL *` (catch-all for Edge Functions and unhandled requests)

**Total: 77 endpoints across 9 API domains**

### **Proposed New File Structure**

```
src/
├── api/
│   ├── kernel.ts           # The core request pipeline and middleware
│   ├── config.ts           # Centralized API configuration
│   ├── errors.ts           # Standardized ApiError class
│   ├── types.ts            # Shared API type definitions
│   │
│   ├── auth/               # Authentication feature module (34 endpoints)
│   │   ├── handlers.ts     # MSW handlers for /auth/v1/*
│   │   └── service.ts      # Handles user/session logic
│   │
│   ├── db/                 # Database/PostgREST feature module (8 endpoints)
│   │   ├── handlers.ts     # MSW handlers for /rest/v1/*
│   │   ├── executor.ts     # Logic for select, insert, update, delete
│   │   ├── parser.ts       # The new unified query parser
│   │   └── sql.ts          # The new unified SQL builder
│   │
│   ├── functions/          # Edge Functions feature module (4 endpoints)
│   │   ├── handlers.ts     # MSW handlers for /functions/v1/*
│   │   └── executor.ts     # Handles function invocation simulation
│   │
│   ├── storage/            # Storage feature module (20 endpoints)
│   │   ├── handlers.ts     # MSW handlers for /storage/v1/*
│   │   └── service.ts      # Handles file/bucket operations
│   │
│   ├── projects/           # Project management module (4 endpoints)
│   │   ├── handlers.ts     # MSW handlers for /admin/projects, /projects
│   │   └── service.ts      # Project CRUD operations
│   │
│   ├── debug/              # Debug and utilities module (3 endpoints)
│   │   ├── handlers.ts     # MSW handlers for /debug/sql, /health
│   │   └── executor.ts     # SQL execution and health checks
│   │
│   ├── files/              # Direct file access module (2 endpoints)
│   │   ├── handlers.ts     # MSW handlers for /files/*
│   │   └── service.ts      # Direct VFS file serving
│   │
│   ├── app/                # App hosting module (2 endpoints)
│   │   ├── handlers.ts     # MSW handlers for /app/*
│   │   └── service.ts      # SPA serving from VFS
│   │
│   └── middleware/         # Infrastructure middleware
│       ├── cors.ts         # CORS preflight handling
│       └── catch-all.ts    # Catch-all for unhandled requests
│
└── mocks/
    ├── handlers.ts         # Will now only import and compose handlers from src/api/
    └── server.ts           # MSW server setup
    └── (old bridge files and project-resolver.ts will be deleted)
```

### **Summary of Outcomes**

This comprehensive refactoring plan will transform the API system from a complex, fragmented, and hard-to-maintain collection of bridges and handlers into a modern, modular, and efficient architecture that handles **ALL 77 endpoints** across 9 API domains.

**Key Improvements:**
*   **Complete Coverage:** Every existing endpoint (REST, Auth, Storage, Functions, Projects, Debug, Files, App Hosting, Infrastructure) will be handled by the new architecture
*   **Architectural Simplification:** Single unified pipeline replaces dual-bridge complexity
*   **Performance:** Optimized query engine with intelligent fast paths for simple queries
*   **Maintainability:** Feature-based modularization makes code easy to locate and modify
*   **Debugging:** Centralized instrumentation with request tracing through the pipeline
*   **Consistency:** Standardized error handling and response formatting across all domains
*   **Extensibility:** Adding new features (like Realtime) becomes straightforward
*   **Future-Ready:** Clean abstractions that can evolve with Supabase API changes

**Migration Benefits:**
*   **Zero Downtime:** Phased approach ensures continuous functionality
*   **No Breaking Changes:** 100% backward compatibility maintained
*   **Improved Developer Experience:** Better debugging tools and clearer code organization
*   **Reduced Technical Debt:** Eliminates code duplication and inconsistent behavior between bridges
