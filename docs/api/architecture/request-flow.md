# Unified Kernel Request Flow Diagrams

This document provides visual flow diagrams for understanding how requests are processed through the **Unified Kernel Architecture**. The new system provides a much cleaner, single-path execution flow compared to the previous dual-bridge system.

## 1. Overall Unified Kernel Request Flow

```mermaid
flowchart TD
    A[HTTP Request] --> B{MSW Handler Match?}
    B -->|No| C[Pass Through to Network]
    B -->|Yes| D[createApiHandler]

    D --> E[Convert MSW Request → ApiRequest]
    E --> F[Initialize ApiContext]
    F --> G[Execute Middleware Pipeline]

    G --> H[Stage 1: Error Handling Middleware]
    H --> I[Stage 2: Instrumentation Middleware]
    I --> J[Stage 3: CORS Middleware]
    J --> K[Stage 4: Project Resolution Middleware]
    K --> L[Stage 5: Authentication Middleware]
    L --> M[Stage 6: Request Parsing Middleware]
    M --> N[Stage 7: Response Formatting Middleware]

    N --> O[Execute Executor]
    O --> P{Executor Type}
    P -->|REST| Q[REST Executor]
    P -->|HEAD| R[HEAD Executor]
    P -->|RPC| S[RPC Executor]

    Q --> T[Query Engine Processing]
    R --> T
    S --> U[APIRequestOrchestrator]

    T --> V[Database Execution]
    U --> V
    V --> W[Format Response]

    W --> X{Response Type}
    X -->|JSON| Y[HttpResponse.json]
    X -->|CSV| Z[HttpResponse (raw)]
    X -->|Text| AA[HttpResponse (raw)]

    Y --> BB[Return HTTP Response]
    Z --> BB
    AA --> BB
```

## 2. Middleware Pipeline Detailed Flow

```mermaid
flowchart TD
    A[ApiRequest + ApiContext] --> B[Middleware Pipeline Entry]

    B --> C[Stage 1: Error Handling]
    C --> D{Try Block Wrapper}
    D -->|Success| E[Stage 2: Instrumentation]
    D -->|Error| F[Catch All Errors]

    F --> G[Map Error to ApiError]
    G --> H[Format Error Response]
    H --> I[Return Error Response]

    E --> J[Generate Request ID]
    J --> K[Start Performance Tracking]
    K --> L[Stage 3: CORS]

    L --> M[Set CORS Headers]
    M --> N[Handle OPTIONS Preflight]
    N --> O[Stage 4: Project Resolution]

    O --> P{Project ID in URL?}
    P -->|No| Q[Use Default Project]
    P -->|Yes| R[Extract Project ID]
    R --> S[Switch Database Context]

    Q --> T[Stage 5: Authentication]
    S --> T

    T --> U{Authorization Header?}
    U -->|No| V[Anonymous Context]
    U -->|Yes| W[Decode JWT Token]
    W --> X[Set User Context]
    W --> Y[Setup RLS Context]

    V --> Z[Stage 6: Request Parsing]
    X --> Z
    Y --> Z

    Z --> AA[Parse URL Parameters]
    AA --> BB[Parse PostgREST Syntax]
    BB --> CC[Validate Query Format]
    CC --> DD[Build ParsedQuery]
    DD --> EE[Stage 7: Response Formatting]

    EE --> FF[Call Next (Executor)]
    FF --> GG[Format Response Data]
    GG --> HH[Set Content-Type Headers]
    HH --> II[Apply PostgREST Conventions]
    II --> JJ[Return Formatted Response]
```

## 3. Query Engine Processing Flow

```mermaid
flowchart TD
    A[Query Engine.processRequest] --> B[Ensure DB Initialized]
    B --> C{Can Use Fast Path?}

    C -->|Yes| D[Fast Path Parsing]
    C -->|No| E[Full PostgREST Parsing]

    D --> F[Simple Query Processing]
    E --> G[Complex Query Processing]

    F --> H[Apply RLS Filters]
    G --> H

    H --> I{Method Type}
    I -->|POST| J[Build Insert Query]
    I -->|PATCH| K[Build Update Query]
    I -->|DELETE| L[Build Delete Query]
    I -->|GET/HEAD| M[Build Select Query]

    J --> N{UPSERT Operation?}
    N -->|Yes| O[Build Upsert Query]
    N -->|No| P[Execute Insert Query]
    O --> P

    K --> Q[Execute Update Query]
    L --> R[Execute Delete Query]
    M --> S[Execute Select Query]

    P --> T[Execute Query with Context]
    Q --> T
    R --> T
    S --> T

    T --> U{Count Requested?}
    U -->|Yes| V[Execute Count Query]
    U -->|No| W[Format Response]

    V --> X[Calculate Total Count]
    X --> Y[Add Content-Range Header]
    Y --> W

    W --> Z{Response Method}
    Z -->|GET/HEAD| AA[Format Select Response]
    Z -->|POST| BB[Format Insert Response]
    Z -->|PATCH| CC[Format Update Response]
    Z -->|DELETE| DD[Format Delete Response]

    AA --> EE[Return Formatted Response]
    BB --> EE
    CC --> EE
    DD --> EE
```

## 4. Executor Pattern Flow

```mermaid
flowchart TD
    A[Middleware Pipeline] --> B{Request Method}

    B -->|GET| C[REST Executor]
    B -->|POST to /rest/v1/table| D[REST Executor]
    B -->|POST to /rpc/function| E[RPC Executor]
    B -->|PATCH| F[REST Executor]
    B -->|DELETE| G[REST Executor]
    B -->|HEAD| H[HEAD Executor]

    C --> I[Extract Table Parameter]
    D --> I
    F --> I
    G --> I

    I --> J{Table Parameter Valid?}
    J -->|No| K[Throw ApiError: Missing Table]
    J -->|Yes| L[Call Query Engine]

    E --> M[Extract Function Name]
    M --> N{Function Name Valid?}
    N -->|No| O[Throw ApiError: Missing Function]
    N -->|Yes| P[Call APIRequestOrchestrator]

    H --> Q[Process as GET Request]
    Q --> R[Return Headers Only]

    L --> S[Query Engine Processing]
    P --> T[Function Execution]

    S --> U[Return Database Response]
    T --> V[Return Function Response]
    R --> W[Return HEAD Response]

    U --> X[Format Final Response]
    V --> X
    W --> X

    X --> Y[Return to Kernel]
```

## 5. Error Handling Flow

```mermaid
flowchart TD
    A[Error Occurs in Pipeline] --> B[Error Handling Middleware]
    B --> C{Error Type}

    C -->|ApiError| D[Use Existing ApiError]
    C -->|PostgreSQL Error| E[Map PG Error Code]
    C -->|Unknown Error| F[Create Generic ApiError]

    E --> G{Known PG Error?}
    G -->|Yes| H[Map to HTTP Status + ApiError]
    G -->|No| I[Create QUERY_ERROR ApiError]

    D --> J[Extract Error Details]
    H --> J
    I --> J
    F --> J

    J --> K[Log Error with Context]
    K --> L[Format Error Response]
    L --> M{Request ID Available?}
    M -->|Yes| N[Add Request ID to Response]
    M -->|No| O[Add Error Response]

    N --> P[Add Error Headers]
    O --> P
    P --> Q[Add CORS Headers]
    Q --> R[Return Error Response]
```

## 6. Authentication and RLS Flow

```mermaid
flowchart TD
    A[Authentication Middleware] --> B{Authorization Header?}

    B -->|No| C[Set Anonymous Context]
    B -->|Yes| D[Extract JWT Token]

    D --> E[Validate JWT Format]
    E --> F{JWT Valid?}
    F -->|No| G[Set Anonymous Context]
    F -->|Yes| H[Decode JWT Claims]

    H --> I[Extract User ID]
    I --> J[Extract Role]
    J --> K[Extract Custom Claims]
    K --> L[Set Session Context]

    C --> M[Continue Pipeline]
    G --> M
    L --> N[Apply RLS Context]

    N --> O[RLS Filtering Service]
    O --> P[Inject User Filters]
    P --> Q[Modify Query Filters]
    Q --> M

    M --> R[Request Parsing Middleware]
```

## 7. Performance Monitoring Flow

```mermaid
flowchart TD
    A[Instrumentation Middleware] --> B[Generate Request ID]
    B --> C[Record Start Time]
    C --> D[Create Request Trace]

    D --> E[Store in Active Traces Map]
    E --> F[Setup Stage Reporting]
    F --> G[Continue Pipeline]

    G --> H[Each Middleware Stage]
    H --> I[Report Stage Entry]
    I --> J[Execute Stage Logic]
    J --> K[Report Stage Exit]
    K --> L[Record Stage Timing]

    L --> M{More Stages?}
    M -->|Yes| H
    M -->|No| N[Complete Request Trace]

    N --> O[Calculate Total Duration]
    O --> P[Update Performance Metrics]
    P --> Q[Move to Completed Traces]
    Q --> R[Enable Debug Tools Access]

    R --> S[window.mswDebug.getRecentTraces()]
    S --> T[Browser Debug Console]
```

## 8. Response Format Handling Flow

```mermaid
flowchart TD
    A[Response Formatting Middleware] --> B[Execute Next (Executor)]
    B --> C[Receive Executor Response]

    C --> D{CSV Format Requested?}
    D -->|Yes| E[Format as CSV]
    D -->|No| F[Format as JSON]

    E --> G[Convert Data to CSV String]
    G --> H[Set Content-Type: text/csv]
    H --> I[Return Raw Response]

    F --> J[Apply PostgREST Conventions]
    J --> K[Add Content-Range Headers]
    K --> L[Handle Single Object Response]
    L --> M[Set Content-Type: application/json]

    I --> N[Return to Kernel]
    M --> N

    N --> O[Kernel Response Handling]
    O --> P{Content Type}
    P -->|text/csv| Q[HttpResponse(data, options)]
    P -->|application/json| R[HttpResponse.json(data, options)]

    Q --> S[Return HTTP Response]
    R --> S
```

## 9. Debugging Decision Tree

When debugging issues with the unified kernel system:

```mermaid
flowchart TD
    A[API Request Issue] --> B{Response Received?}

    B -->|No| C[Check MSW Handler Match]
    C --> D{Handler Pattern Correct?}
    D -->|No| E[Fix MSW Handler Pattern]
    D -->|Yes| F[Check Kernel Execution]

    B -->|Yes| G{Status Code?}
    G -->|2xx| H[Check Response Format]
    G -->|4xx| I[Check Request Validation]
    G -->|5xx| J[Check Internal Errors]

    F --> K[Enable Verbose Logging]
    K --> L[window.mswDebug.enableVerboseLogging()]

    I --> M[Check Middleware Pipeline]
    M --> N{Which Stage Failed?}
    N -->|Auth| O[Check JWT Token]
    N -->|Parsing| P[Check PostgREST Syntax]
    N -->|Project| Q[Check Project ID Extraction]

    J --> R[Check Error Logs]
    R --> S{ApiError Type?}
    S -->|QUERY_ERROR| T[Check SQL Generation]
    S -->|AUTH_ERROR| U[Check Authentication]
    S -->|VALIDATION_ERROR| V[Check Request Format]

    H --> W{PostgREST Compatible?}
    W -->|No| X[Check Response Formatting]
    W -->|Yes| Y[Issue Resolved]

    O --> Z[Validate JWT in Auth Middleware]
    P --> AA[Validate Query Parsing Logic]
    Q --> BB[Validate Project Resolution]
    T --> CC[Check Query Engine Logic]
    U --> DD[Check Authentication Middleware]
    V --> EE[Check Request Parsing Middleware]
```

## Key Improvements Over Bridge System

### 1. **Simplified Execution Path**
- **Previous**: Multiple bridge selection logic with complex decision trees
- **Current**: Single middleware pipeline with predictable execution order

### 2. **Better Error Handling**
- **Previous**: Scattered error handling across different bridges
- **Current**: Centralized error handling middleware with standardized `ApiError`

### 3. **Enhanced Debugging**
- **Previous**: Difficult to trace which bridge handled a request
- **Current**: Complete request tracing with `window.mswDebug` tools

### 4. **Performance Monitoring**
- **Previous**: Limited visibility into request processing time
- **Current**: Per-stage timing and comprehensive performance metrics

### 5. **Type Safety**
- **Previous**: Inconsistent typing across different bridges
- **Current**: Comprehensive TypeScript interfaces throughout pipeline

## Debugging Tools Usage

### Browser Console Commands
```javascript
// View system status
window.mswDebug.status()

// Get recent request traces
window.mswDebug.getRecentTraces()

// Enable detailed logging
window.mswDebug.enableVerboseLogging()

// View performance stats
window.mswDebug.getBridgeStats()

// Get kernel information
window.mswDebug.kernelInfo()
```

### Request Tracing Example
```javascript
// After making a request, view the trace
const traces = window.mswDebug.getRecentTraces()
const lastTrace = traces[0]

console.log('Request ID:', lastTrace.requestId)
console.log('Total Duration:', lastTrace.duration, 'ms')
console.log('Stages:')
lastTrace.stages.forEach(stage => {
  console.log(`  ${stage.stage}: ${stage.duration}ms`)
})
```

The unified kernel architecture provides a much cleaner, more debuggable request flow that eliminates the complexity of the previous bridge system while maintaining superior PostgREST compatibility.