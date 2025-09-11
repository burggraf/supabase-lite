# MSW API Request Flow Diagrams

This document provides visual flow diagrams for understanding how requests are processed through the MSW API system. These diagrams are essential for debugging and understanding the complex execution paths.

## 1. Overall Request Flow

```mermaid
flowchart TD
    A[HTTP Request] --> B{MSW Handler Match?}
    B -->|No| C[Pass Through to Network]
    B -->|Yes| D[Extract Handler Type]
    
    D --> E{Request Type}
    E -->|REST API| F[REST Handler]
    E -->|Auth| G[Auth Handler]
    E -->|Storage| H[Storage Handler]
    E -->|Functions| I[Functions Handler]
    E -->|Debug| J[Debug Handler]
    E -->|Health| K[Health Handler]
    
    F --> L[Project Resolution]
    G --> L
    H --> L
    I --> L
    J --> L
    K --> M[Direct Response]
    
    L --> N{Project ID Found?}
    N -->|No| O[Use Default Project]
    N -->|Yes| P[Switch Database Context]
    
    O --> Q[Bridge Selection]
    P --> Q
    
    Q --> R{Bridge Type}
    R -->|Enhanced| S[Enhanced Bridge Processing]
    R -->|Simplified| T[Simplified Bridge Processing]
    R -->|Auth| U[Auth Bridge Processing]
    R -->|Storage| V[VFS Bridge Processing]
    
    S --> W[Database Query]
    T --> W
    U --> X[Auth Database Query]
    V --> Y[VFS Operation]
    
    W --> Z[Format Response]
    X --> Z
    Y --> Z
    
    Z --> AA[Add CORS Headers]
    AA --> BB[Return HTTP Response]
```

## 2. Project Resolution Flow

```mermaid
flowchart TD
    A[Request URL] --> B[Extract Project ID Pattern]
    B --> C{Project ID in URL?}
    
    C -->|No| D[Use Default Project]
    C -->|Yes| E[Parse Project ID]
    
    E --> F{Cache Hit?}
    F -->|Yes| G[Return Cached Resolution]
    F -->|No| H[Validate Project ID]
    
    H --> I{Project Exists?}
    I -->|No| J[Return 404 Error]
    I -->|Yes| K[Switch Database Connection]
    
    K --> L[Normalize URL Path]
    L --> M[Cache Resolution Result]
    M --> N[Update Cache Metrics]
    N --> O[Return Project Context]
    
    D --> P[Default Database Connection]
    P --> Q[Return Default Context]
    
    G --> R[Update Cache Hit Counter]
    R --> O
```

## 3. Bridge Selection Decision Tree

```mermaid
flowchart TD
    A[Request Routed to Bridge] --> B{Request Type}
    
    B -->|REST API| C{USE_SIMPLIFIED_BRIDGE?}
    C -->|true| D[Simplified Bridge]
    C -->|false| E[Enhanced Bridge]
    
    B -->|Auth| F[Auth Bridge]
    B -->|Storage| G[VFS Bridge]
    B -->|Functions| H[Functions Handler]
    B -->|Debug| I[Direct DB Access]
    
    D --> J[Limited PostgREST Syntax]
    E --> K[Full PostgREST Compatibility]
    F --> L[JWT + User Management]
    G --> M[File System Operations]
    H --> N[Function Execution Simulation]
    I --> O[Raw SQL Execution]
    
    J --> P[Query Parsing]
    K --> P
    L --> Q[Auth Processing]
    M --> R[VFS Processing]
    N --> S[Function Response]
    I --> T[SQL Response]
    
    P --> U[Database Execution]
    Q --> V[Auth Database]
    R --> W[IndexedDB Operations]
    
    U --> X[Format PostgREST Response]
    V --> Y[Format Auth Response]
    W --> Z[Format Storage Response]
    S --> AA[Format Function Response]
    T --> BB[Format Debug Response]
```

## 4. Enhanced Bridge Query Processing

```mermaid
flowchart TD
    A[Enhanced Bridge Request] --> B[Parse URL Parameters]
    B --> C[Extract Query Components]
    
    C --> D{Has Embedded Resources?}
    D -->|Yes| E[Parse Embedding Syntax]
    D -->|No| F[Parse Simple Query]
    
    E --> G[Handle Multi-level Embedding]
    G --> H[Process Table-qualified Limits]
    H --> I[Handle Relationship Joins]
    
    F --> J[Parse Filters]
    J --> K[Parse Ordering]
    K --> L[Parse Pagination]
    
    I --> M[Generate Complex SQL]
    L --> N[Generate Simple SQL]
    
    M --> O{RLS Enabled?}
    N --> O
    
    O -->|Yes| P[Apply User Context Filters]
    O -->|No| Q[Execute Query Directly]
    
    P --> R[Inject RLS WHERE Clauses]
    R --> S[Execute Filtered Query]
    
    Q --> T[Execute Query]
    S --> T
    
    T --> U{Query Successful?}
    U -->|No| V[Map Database Error]
    U -->|Yes| W[Format Results]
    
    V --> X[Return Error Response]
    W --> Y[Apply PostgREST Formatting]
    Y --> Z[Return Success Response]
```

## 5. Authentication Flow

```mermaid
flowchart TD
    A[Auth Request] --> B{Auth Endpoint}
    
    B -->|/signup| C[User Registration]
    B -->|/signin| D[User Authentication]
    B -->|/signout| E[Session Termination]
    B -->|/refresh| F[Token Refresh]
    B -->|/user| G[User Info Retrieval]
    
    C --> H[Validate Registration Data]
    H --> I[Hash Password]
    I --> J[Create User Record]
    J --> K[Generate JWT Token]
    K --> L[Create Session]
    
    D --> M[Validate Credentials]
    M --> N{Credentials Valid?}
    N -->|No| O[Return 401 Error]
    N -->|Yes| P[Generate JWT Token]
    P --> Q[Create/Update Session]
    
    E --> R[Invalidate Session]
    R --> S[Clear JWT Token]
    
    F --> T[Validate Refresh Token]
    T --> U{Token Valid?}
    U -->|No| V[Return 401 Error]
    U -->|Yes| W[Generate New JWT]
    W --> X[Update Session]
    
    G --> Y[Extract User from JWT]
    Y --> Z[Return User Data]
    
    L --> AA[Return Auth Response]
    Q --> AA
    S --> BB[Return Success Response]
    X --> AA
    Z --> AA
```

## 6. Error Handling Flow

```mermaid
flowchart TD
    A[Operation Error] --> B{Error Type}
    
    B -->|Database Error| C[PostgreSQL Error]
    B -->|Validation Error| D[Request Validation Error]
    B -->|Auth Error| E[Authentication Error]
    B -->|Network Error| F[Network/Timeout Error]
    B -->|Bridge Error| G[Bridge Processing Error]
    
    C --> H[Map PG Error Code]
    H --> I{Known PG Error?}
    I -->|Yes| J[Map to HTTP Status]
    I -->|No| K[Generic 500 Error]
    
    D --> L[Extract Validation Details]
    L --> M[Return 400 Bad Request]
    
    E --> N{Auth Error Type}
    N -->|Invalid Token| O[Return 401 Unauthorized]
    N -->|Insufficient Permissions| P[Return 403 Forbidden]
    N -->|Token Expired| Q[Return 401 with Refresh Hint]
    
    F --> R[Return 503 Service Unavailable]
    
    G --> S[Log Bridge Error]
    S --> T[Return 500 Internal Error]
    
    J --> U[Format Error Response]
    K --> U
    M --> U
    O --> U
    P --> U
    Q --> U
    R --> U
    T --> U
    
    U --> V[Add CORS Headers]
    V --> W[Add Error Context]
    W --> X[Return Error Response]
```

## 7. Storage/VFS Operation Flow

```mermaid
flowchart TD
    A[Storage Request] --> B{Storage Operation}
    
    B -->|Upload| C[File Upload]
    B -->|Download| D[File Download]
    B -->|Delete| E[File Delete]
    B -->|List| F[List Objects]
    B -->|Create Bucket| G[Bucket Creation]
    
    C --> H[Validate File Data]
    H --> I[Check Bucket Permissions]
    I --> J[Store in VFS]
    J --> K[Update File Metadata]
    
    D --> L[Resolve File Path]
    L --> M{File Exists?}
    M -->|No| N[Return 404 Error]
    M -->|Yes| O[Check Access Permissions]
    O --> P[Generate Signed URL]
    P --> Q[Return File URL]
    
    E --> R[Validate Delete Permissions]
    R --> S[Remove from VFS]
    S --> T[Update Bucket Metadata]
    
    F --> U[Query VFS Index]
    U --> V[Apply Filters]
    V --> W[Format Object List]
    
    G --> X[Validate Bucket Name]
    X --> Y[Check Bucket Limits]
    Y --> Z[Create Bucket Record]
    Z --> AA[Initialize Bucket Policies]
    
    K --> BB[Return Upload Response]
    Q --> BB
    T --> BB
    W --> BB
    AA --> BB
    
    BB --> CC[Add Storage Headers]
    CC --> DD[Return Response]
```

## 8. Debugging Decision Tree

When debugging API requests, follow this decision tree:

```mermaid
flowchart TD
    A[API Request Issue] --> B{Response Received?}
    
    B -->|No| C[Check MSW Handler Match]
    C --> D{Handler Found?}
    D -->|No| E[Add Missing Handler]
    D -->|Yes| F[Check Project Resolution]
    
    B -->|Yes| G{Status Code?}
    G -->|2xx| H[Check Response Format]
    G -->|4xx| I[Check Request Validation]
    G -->|5xx| J[Check Server Errors]
    
    F --> K{Project ID Extracted?}
    K -->|No| L[Fix URL Pattern]
    K -->|Yes| M[Check Database Switch]
    
    I --> N{Auth Required?}
    N -->|Yes| O[Check JWT Token]
    N -->|No| P[Check Request Parameters]
    
    J --> Q{Database Error?}
    Q -->|Yes| R[Check SQL Generation]
    Q -->|No| S[Check Bridge Logic]
    
    H --> T{PostgREST Compatible?}
    T -->|No| U[Check Bridge Implementation]
    T -->|Yes| V[Issue Resolved]
    
    O --> W{Token Valid?}
    W -->|No| X[Fix Authentication]
    W -->|Yes| Y[Check RLS Filters]
    
    R --> Z[Debug Query Parsing]
    S --> AA[Debug Bridge Selection]
    
    Z --> BB[Fix SQL Generation]
    AA --> CC[Fix Bridge Logic]
```

## Key Insights from Flow Analysis

### 1. **Critical Decision Points**
- **Project Resolution**: Determines database context for entire request
- **Bridge Selection**: Affects query parsing and SQL generation capabilities
- **RLS Application**: Can filter results unexpectedly if user context is wrong

### 2. **Common Failure Points**
- **URL Pattern Matching**: Incorrect handler selection leads to wrong processing
- **Project Database Switching**: Stale connections cause data inconsistencies
- **Query Parsing**: Complex PostgREST syntax can fail silently

### 3. **Performance Bottlenecks**
- **Project Resolution Cache**: Cache misses cause database switching overhead
- **Complex Query Parsing**: Enhanced bridge parsing for embedded resources
- **RLS Filter Application**: User context extraction and filter injection

### 4. **Debugging Strategies**
- **Trace Request ID**: Follow single request through all flow stages
- **Log Bridge Selection**: Verify correct bridge handles request
- **Monitor Cache Performance**: Check project resolution cache hit rates
- **Validate SQL Generation**: Ensure PostgREST syntax converts correctly

These diagrams provide the visual foundation for understanding the MSW API system's complexity and serve as debugging guides for identifying where issues occur in the request processing pipeline.