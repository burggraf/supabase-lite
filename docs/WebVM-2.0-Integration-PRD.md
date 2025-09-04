# WebVM 2.0 Integration PRD: Browser-Native Edge Functions Runtime

## Executive Summary

This Product Requirements Document (PRD) outlines the integration of WebVM 2.0 with Supabase Lite to enable **complete browser-native execution of Edge Functions**. By leveraging WebVM's x86 virtualization engine and Deno runtime capabilities, we can eliminate the current MSW-based Edge Functions simulation and provide a true serverless runtime environment that operates entirely within the browser.

## Problem Statement

### Current Limitations

1. **Simulation vs. Reality**: Current Edge Functions implementation uses MSW (Mock Service Worker) to simulate function execution, limiting functionality and authenticity
2. **No External API Access**: Simulated functions cannot make real HTTP requests to external APIs
3. **Limited Runtime Environment**: Missing Deno-specific APIs, imports, and runtime features
4. **Development Friction**: Developers cannot test real-world Edge Function behavior locally
5. **Deployment Gap**: Significant differences between local testing and production deployment

### Business Impact

- **Developer Experience**: Poor local development experience for Edge Functions
- **Feature Completeness**: Incomplete Supabase compatibility affects adoption
- **Market Positioning**: Competitors offer better local development tools
- **User Trust**: Simulation-based testing creates deployment surprises

## Solution Overview

### Vision

Integrate WebVM 2.0 to host a real Deno runtime within the browser, providing:

- **True Edge Functions Runtime**: Real Deno environment with full API access
- **Network Connectivity**: External API calls via WebVM's networking layer
- **Database Integration**: Seamless connection to local PGlite instance
- **Production Parity**: Identical behavior between local testing and production

### Core Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Browser Environment                           │
├─────────────────────────────────────────────────────────────────┤
│  Supabase Lite UI          │    WebVM 2.0 Container            │
│  ┌─────────────────────┐   │    ┌─────────────────────────────┐ │
│  │ Edge Functions UI   │◄──┼────┤ Deno Runtime Environment   │ │
│  │ - Code Editor       │   │    │ ┌─────────────────────────┐ │ │
│  │ - Function Manager  │   │    │ │ Supabase Edge Runtime   │ │ │
│  │ - Testing Console   │   │    │ │ (Rust + Deno Core)     │ │ │
│  └─────────────────────┘   │    │ └─────────────────────────┘ │ │
│  ┌─────────────────────┐   │    │ ┌─────────────────────────┐ │ │
│  │ PGlite Database     │◄──┼────┤ │ HTTP Client (for APIs)  │ │ │
│  │ - Auth Schema       │   │    │ │ - fetch() support       │ │ │
│  │ - Storage Schema    │   │    │ │ - WebSocket support     │ │ │
│  │ - Custom Tables     │   │    │ │ - TLS/SSL support       │ │ │
│  └─────────────────────┘   │    │ └─────────────────────────┘ │ │
├─────────────────────────────┼────────────────────────────────────┤
│  MSW Handlers              │    │ Network Bridge              │ │
│  ┌─────────────────────┐   │    │ ┌─────────────────────────┐ │ │
│  │ Database API Bridge │◄──┼────┤ │ Internal HTTP Requests  │ │ │
│  │ - PostgREST API     │   │    │ │ to localhost:5173       │ │ │
│  │ - Auth API          │   │    │ │ (via Tailscale)         │ │ │
│  │ - Storage API       │   │    │ └─────────────────────────┘ │ │
│  └─────────────────────┘   │    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Technical Requirements

### 1. WebVM 2.0 Integration

#### 1.1 Core Installation & Setup
- **Integration Method**: Embed WebVM 2.0 as a browser component
- **License Requirement**: Obtain appropriate license for organizational use
- **Custom Image**: Build custom Linux image with Deno and Supabase Edge Runtime pre-installed
- **Resource Allocation**: Configure memory, CPU, and storage limits for WebVM instance

#### 1.2 Deno Runtime Environment
- **Deno Version**: Latest stable Deno runtime (1.40+)
- **Supabase Edge Runtime**: Install and configure Supabase's open-source Edge Runtime
- **TypeScript Support**: Full TypeScript compilation and execution
- **NPM/JSR Support**: Module resolution from npm and JSR registries

#### 1.3 Networking Configuration
- **Tailscale Integration**: Configure Tailscale for external network access
- **Local API Access**: Bridge WebVM to localhost:5173 for database/auth APIs
- **DNS Resolution**: Enable DNS resolution for external services
- **TLS/SSL**: Support for HTTPS connections to external APIs

### 2. Edge Functions Runtime

#### 2.1 Function Execution Environment
```typescript
// Example function running in WebVM Deno runtime
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js'

// Access to real Deno APIs
Deno.serve(async (req: Request) => {
  // Real HTTP requests to external APIs
  const externalResponse = await fetch('https://api.github.com/users/octocat')
  const userData = await externalResponse.json()
  
  // Connection to local PGlite database via MSW bridge
  const supabase = createClient('http://localhost:5173', 'your-anon-key')
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', userData.login)
    .single()
  
  return new Response(JSON.stringify({
    github_data: userData,
    profile_data: profile
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

#### 2.2 Function Lifecycle Management
- **Deployment**: Deploy function code to WebVM filesystem
- **Startup**: Initialize Deno process with function code
- **Request Routing**: Route HTTP requests from UI to WebVM Deno process
- **Response Handling**: Stream responses back to UI
- **Process Management**: Restart/reload functions on code changes

#### 2.3 Development Tools Integration
- **Hot Reload**: Automatic function restart on code changes
- **Console Logging**: Stream Deno console output to UI
- **Error Handling**: Capture and display runtime errors
- **Performance Monitoring**: Track function execution metrics

### 3. Database Integration

#### 3.1 PGlite Bridge
- **Connection Proxy**: WebVM accesses PGlite via HTTP proxy on localhost:5173
- **Authentication**: Automatic JWT token injection for user context
- **Connection Pooling**: Efficient database connection management
- **Transaction Support**: Full transaction support across HTTP bridge

#### 3.2 Supabase Client Compatibility
- **Client Library**: Support for @supabase/supabase-js within functions
- **Auth Context**: Automatic user authentication context injection
- **RLS Enforcement**: Row Level Security applied to function database queries
- **Real-time Subscriptions**: Support for real-time database subscriptions

### 4. Network Architecture

#### 4.1 Internal Communication
```
WebVM Deno Runtime ──HTTP──► localhost:5173/rest/v1/* (Database API)
                   ──HTTP──► localhost:5173/auth/v1/* (Auth API)
                   ──HTTP──► localhost:5173/storage/v1/* (Storage API)
```

#### 4.2 External Communication
```
WebVM Deno Runtime ──HTTPS──► External APIs (GitHub, OpenAI, etc.)
                   ──WSS────► External WebSocket services
                   ──DNS────► Domain name resolution
```

#### 4.3 Security Considerations
- **Sandbox Isolation**: WebVM provides process isolation
- **Network Policies**: Configure allowed external domains
- **Resource Limits**: CPU, memory, and network bandwidth limits
- **Timeout Controls**: Request timeout and function execution limits

## Implementation Plan

### Phase 1: WebVM Foundation (2-3 weeks)

#### Week 1: WebVM Integration
- [ ] Research and evaluate WebVM 2.0 licensing options
- [ ] Create custom Linux image with Deno and Edge Runtime
- [ ] Integrate WebVM component into Supabase Lite UI
- [ ] Implement basic WebVM lifecycle management (start/stop/restart)
- [ ] Configure Tailscale networking for external access

#### Week 2: Deno Runtime Setup
- [ ] Install and configure Deno in WebVM environment
- [ ] Set up Supabase Edge Runtime in WebVM
- [ ] Implement function deployment mechanism
- [ ] Create HTTP request routing from UI to WebVM
- [ ] Test basic function execution (hello world)

#### Week 3: Database Bridge
- [ ] Implement HTTP bridge for PGlite database access
- [ ] Configure MSW handlers for WebVM → PGlite communication
- [ ] Test database queries from WebVM Deno functions
- [ ] Implement authentication context passing
- [ ] Verify RLS enforcement works through bridge

### Phase 2: Enhanced Runtime (2-3 weeks)

#### Week 4: Advanced Function Features
- [ ] Implement environment variables management
- [ ] Add support for function secrets
- [ ] Enable external HTTP requests from functions
- [ ] Implement function logging and error capture
- [ ] Add performance monitoring and metrics

#### Week 5: Development Tools
- [ ] Implement hot reload for function development
- [ ] Create console output streaming to UI
- [ ] Build error handling and debugging tools
- [ ] Add function execution tracing
- [ ] Implement function testing framework

#### Week 6: External Integration Testing
- [ ] Test external API calls (GitHub, OpenAI, weather APIs)
- [ ] Verify database operations work correctly
- [ ] Test authentication flows end-to-end
- [ ] Performance testing and optimization
- [ ] Security testing and hardening

### Phase 3: Production Readiness (1-2 weeks)

#### Week 7: Optimization & Polish
- [ ] Optimize WebVM startup time
- [ ] Implement function caching mechanisms
- [ ] Add comprehensive error handling
- [ ] Create monitoring and alerting
- [ ] Documentation and user guides

#### Week 8: Integration & Testing
- [ ] Full integration testing with all Supabase Lite features
- [ ] Performance benchmarking against production Edge Functions
- [ ] Security audit and penetration testing
- [ ] User acceptance testing
- [ ] Deployment preparation

## User Experience

### 1. Developer Workflow

#### Function Development
1. **Create Function**: Use existing Edge Functions UI to create new function
2. **Write Code**: Use Monaco editor with full TypeScript IntelliSense
3. **Test Locally**: Functions execute in real Deno runtime with external API access
4. **Debug Issues**: View real-time console logs and error messages
5. **Deploy Changes**: Hot reload enables instant testing of code changes

#### Testing External APIs
```typescript
// Example: Testing GitHub API integration
Deno.serve(async (req: Request) => {
  try {
    // Real HTTP request to GitHub API
    const response = await fetch('https://api.github.com/repos/microsoft/vscode', {
      headers: {
        'Authorization': `token ${Deno.env.get('GITHUB_TOKEN')}`,
        'User-Agent': 'Supabase-Edge-Function'
      }
    })
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }
    
    const repoData = await response.json()
    
    // Store in local database
    const { data, error } = await supabase
      .from('github_repos')
      .insert({
        name: repoData.name,
        stars: repoData.stargazers_count,
        updated_at: repoData.updated_at
      })
    
    return new Response(JSON.stringify({ success: true, data }))
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
})
```

### 2. UI Enhancements

#### WebVM Status Panel
- **Runtime Status**: Display WebVM and Deno runtime status
- **Resource Usage**: Show CPU, memory, and network usage
- **Network Status**: Display Tailscale connection status
- **Function Health**: Show active functions and their status

#### Enhanced Debugging
- **Real-time Logs**: Stream console output from Deno functions
- **Network Inspector**: View external HTTP requests and responses
- **Performance Metrics**: Function execution time and resource usage
- **Error Stack Traces**: Full error context with line numbers

## Technical Specifications

### 1. System Requirements

#### Browser Compatibility
- **Chrome**: Version 90+ (recommended)
- **Firefox**: Version 88+ (limited support)
- **Safari**: Version 14+ (limited support)
- **Edge**: Version 90+ (full support)

#### Performance Requirements
- **Memory**: 1GB additional RAM for WebVM
- **CPU**: Modern multi-core processor recommended
- **Storage**: 500MB for WebVM image and runtime
- **Network**: Stable internet connection for Tailscale

### 2. Configuration Options

#### WebVM Configuration
```typescript
interface WebVMConfig {
  memory: string          // '1G', '2G', etc.
  cpu: number            // Number of CPU cores
  image: string          // Custom Linux image path
  networking: {
    enabled: boolean
    tailscale: {
      authKey: string
      exitNode?: string
    }
  }
  storage: {
    persistent: boolean
    size: string         // '1G', '2G', etc.
  }
}
```

#### Edge Runtime Configuration
```typescript
interface EdgeRuntimeConfig {
  deno: {
    version: string      // Deno version to use
    permissions: string[]// Allowed Deno permissions
    importMap?: string   // Import map for module resolution
  }
  functions: {
    timeout: number      // Function timeout in seconds
    memory: string       // Memory limit per function
    concurrency: number  // Max concurrent executions
  }
  database: {
    url: string         // PGlite bridge URL
    maxConnections: number
  }
}
```

### 3. API Specifications

#### Function Execution API
```typescript
// POST /functions/{functionName}
interface FunctionInvocation {
  method: string
  headers: Record<string, string>
  body?: unknown
  context: {
    user?: {
      id: string
      email: string
      role: string
    }
    project: {
      id: string
      name: string
    }
  }
}

interface FunctionResponse {
  status: number
  headers: Record<string, string>
  body: unknown
  logs: string[]
  metrics: {
    duration: number
    memory: number
    cpu: number
  }
}
```

#### WebVM Management API
```typescript
// WebVM lifecycle management
interface WebVMManager {
  start(): Promise<void>
  stop(): Promise<void>
  restart(): Promise<void>
  getStatus(): WebVMStatus
  deployFunction(name: string, code: string): Promise<void>
  deleteFunction(name: string): Promise<void>
  invokeFunction(name: string, request: FunctionInvocation): Promise<FunctionResponse>
}
```

## Security Considerations

### 1. Isolation & Sandboxing

#### WebVM Isolation
- **Process Isolation**: Each WebVM instance runs in isolated process
- **Memory Isolation**: WebVM cannot access browser memory
- **Filesystem Isolation**: WebVM filesystem is separate from browser storage
- **Network Isolation**: Controlled network access via Tailscale

#### Function Sandboxing
- **Deno Permissions**: Strict permission model for function execution
- **Resource Limits**: CPU, memory, and execution time limits
- **Network Policies**: Whitelist of allowed external domains
- **File Access**: Restricted filesystem access within WebVM

### 2. Data Security

#### Database Access
- **Authentication**: All database queries require valid JWT tokens
- **Authorization**: RLS policies enforced on all database operations
- **Encryption**: Database connections use encrypted channels
- **Audit Logging**: All database operations are logged

#### External API Access
- **Secret Management**: Secure storage and injection of API keys
- **TLS Enforcement**: All external requests must use HTTPS
- **Request Logging**: External requests are logged for audit
- **Rate Limiting**: Protection against excessive external API calls

## Monitoring & Observability

### 1. Metrics Collection

#### Function Metrics
- **Execution Time**: Function response time percentiles
- **Memory Usage**: Peak and average memory consumption
- **CPU Usage**: Function CPU utilization
- **Error Rate**: Function error rate and types
- **Throughput**: Requests per second

#### WebVM Metrics
- **System Resources**: CPU, memory, disk usage
- **Network Stats**: Bandwidth usage, connection count
- **Function Health**: Active functions, restart count
- **Performance**: VM boot time, function cold start time

### 2. Logging Strategy

#### Structured Logging
```typescript
interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  source: 'webvm' | 'deno' | 'function'
  functionName?: string
  message: string
  metadata?: Record<string, unknown>
  traceId?: string
}
```

#### Log Aggregation
- **Function Logs**: Console output from Deno functions
- **System Logs**: WebVM system events and errors
- **Access Logs**: HTTP requests to functions
- **Performance Logs**: Execution metrics and timing

## Success Metrics

### 1. Technical Metrics

#### Performance Targets
- **Function Cold Start**: < 500ms for simple functions
- **Function Warm Start**: < 50ms for cached functions
- **WebVM Boot Time**: < 10 seconds from initialization
- **Memory Overhead**: < 1GB additional RAM usage
- **External API Response**: < 2x production latency

#### Reliability Targets
- **Function Uptime**: 99.9% availability
- **WebVM Stability**: < 1 crash per 24 hours
- **Error Rate**: < 1% of function executions fail
- **Data Consistency**: 100% database integrity

### 2. User Experience Metrics

#### Developer Satisfaction
- **Setup Time**: < 5 minutes to first function execution
- **Development Speed**: 50% faster iteration than current MSW approach
- **Feature Parity**: 95% compatibility with production Edge Functions
- **Bug Reduction**: 80% fewer deployment surprises

#### Usage Metrics
- **Adoption Rate**: % of developers using WebVM vs. MSW simulation
- **Function Complexity**: Average lines of code per function
- **External Integration**: % of functions using external APIs
- **Testing Coverage**: % of functions tested before deployment

## Risks & Mitigations

### 1. Technical Risks

#### WebVM Stability
- **Risk**: WebVM crashes or becomes unstable during development
- **Mitigation**: Implement automatic restart, comprehensive error handling
- **Fallback**: Graceful degradation to MSW simulation mode

#### Performance Impact
- **Risk**: WebVM significantly slows down development workflow
- **Mitigation**: Optimize WebVM image, implement smart caching
- **Fallback**: Allow developers to disable WebVM for simple functions

#### Browser Compatibility
- **Risk**: WebVM doesn't work consistently across browsers
- **Mitigation**: Extensive browser testing, progressive enhancement
- **Fallback**: Feature detection and MSW fallback for unsupported browsers

### 2. Business Risks

#### Licensing Costs
- **Risk**: WebVM commercial licensing is too expensive
- **Mitigation**: Negotiate volume pricing, explore open-source alternatives
- **Fallback**: Limited WebVM usage for premium features only

#### Development Timeline
- **Risk**: Integration takes longer than planned
- **Mitigation**: Phased rollout, MVP approach, dedicated team
- **Fallback**: Ship basic WebVM integration first, iterate on features

#### User Adoption
- **Risk**: Developers prefer current MSW approach
- **Mitigation**: Clear documentation, migration guides, feature demos
- **Fallback**: Support both approaches during transition period

## Dependencies & Requirements

### 1. External Dependencies

#### WebVM 2.0
- **License**: Commercial license for organizational use
- **Version**: Latest stable release (2.0+)
- **Support**: Technical support agreement
- **Updates**: Regular updates and security patches

#### Tailscale
- **Account**: Tailscale account for networking
- **Configuration**: VPN setup for WebVM networking
- **Security**: Proper network policies and access control

#### Supabase Edge Runtime
- **Source**: GitHub repository (MIT license)
- **Build**: Custom build for WebVM environment
- **Dependencies**: Rust toolchain, Deno runtime

### 2. Internal Dependencies

#### Existing Codebase
- **MSW Handlers**: Modify existing handlers for WebVM bridge
- **Edge Functions UI**: Enhance UI for WebVM integration
- **Database Layer**: Ensure compatibility with HTTP bridge
- **Authentication**: JWT token management for WebVM access

#### Infrastructure
- **Build System**: CI/CD pipeline for custom WebVM images
- **Development Environment**: Docker setup for WebVM testing
- **Documentation**: Comprehensive setup and usage guides

## Conclusion

The integration of WebVM 2.0 with Supabase Lite represents a significant advancement in browser-native development tools. By providing a true Deno runtime environment within the browser, we can offer developers an authentic Edge Functions development experience that matches production behavior.

This implementation will:

1. **Eliminate Development Friction**: Real runtime environment reduces deployment surprises
2. **Enable Advanced Use Cases**: External API integration and complex function logic
3. **Improve Developer Confidence**: True-to-production testing environment
4. **Establish Market Leadership**: First-of-its-kind browser-native serverless development

The phased implementation approach ensures manageable development cycles while delivering incremental value to users. The comprehensive monitoring and fallback strategies mitigate technical risks while ensuring reliable operation.

Success of this integration will position Supabase Lite as the premier browser-based development platform for serverless applications, significantly enhancing our competitive position in the local development tools market.