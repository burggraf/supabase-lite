# Research: Application Server with WebVM

**Phase**: 0 - Research and Clarifications  
**Date**: 2025-09-17  
**Status**: Complete

## Research Questions Addressed

### 1. WebVM Integration and Capabilities

**Question**: How can WebVM be integrated into a React web application for hosting applications?

**Decision**: Use WebVM as a lazy-loaded component with PostMessage communication bridge  
**Rationale**: 
- WebVM runs x86 binaries via WebAssembly with CheerpX virtualization engine
- Provides complete Linux environment in browser without server dependencies
- Supports customizable Docker builds for runtime environments
- Can be embedded as iframe or direct integration via JavaScript

**Alternatives considered**: 
- Docker containers (rejected - not browser compatible)
- Node.js server runtime (rejected - violates browser-only requirement)
- WebContainers (considered but WebVM provides more complete Linux environment)

### 2. WebVM State Persistence

**Question**: How can WebVM state be saved and restored across browser sessions?

**Decision**: Implement state snapshot/restore using IndexedDB for filesystem persistence  
**Rationale**:
- WebVM provides virtual block-based filesystem that can be serialized
- Browser IndexedDB can store large binary data for filesystem images
- Initialization time optimization through cached state restoration
- Aligns with existing VFS persistence architecture

**Alternatives considered**:
- localStorage (rejected - size limitations)
- In-memory only (rejected - no persistence requirement)
- External storage (rejected - browser-only constraint)

### 3. MSW Routing to WebVM Applications

**Question**: How can MSW route /app/{app-id} requests to applications running inside WebVM?

**Decision**: Implement WebVM Bridge service with PostMessage protocol for HTTP request forwarding  
**Rationale**:
- MSW handlers can intercept /app/* requests and forward to WebVM via PostMessage
- WebVM applications can run HTTP servers on localhost that receive forwarded requests
- Response data flows back through PostMessage bridge to MSW response
- Maintains full HTTP compatibility (headers, cookies, POST data)

**Alternatives considered**:
- Direct TCP proxy (rejected - browser limitations)
- WebSocket tunneling (complex, unnecessary overhead)
- IFRAME embedding (rejected - limited HTTP feature support)

### 4. Runtime Environment Installation

**Question**: How can different runtime environments be installed on-demand in WebVM?

**Decision**: Pre-built runtime Docker images loaded dynamically with lazy initialization  
**Rationale**:
- WebVM supports customizable Dockerfiles for different runtime environments
- Runtime images can be stored remotely and downloaded on first use
- Each runtime (Node.js, Python, Next.js, Static) gets dedicated WebVM instance
- Installation persists in WebVM filesystem across sessions

**Alternatives considered**:
- Single WebVM with multiple runtimes (rejected - resource conflicts)
- Client-side runtime compilation (rejected - complexity and size)
- Server-side runtime provision (rejected - browser-only requirement)

### 5. Supabase Edge Functions Runtime Integration

**Question**: Can Supabase Edge Functions runtime run inside WebVM without Docker?

**Decision**: Not feasible for initial implementation - defer to future enhancement  
**Rationale**:
- Supabase Edge Runtime requires Rust toolchain and Deno runtime
- Docker dependency makes it incompatible with browser WebVM environment
- Runtime is in beta with breaking changes expected
- Complexity exceeds current project scope

**Alternatives considered**:
- Custom Deno runtime build (rejected - maintenance overhead)
- Edge Functions simulation layer (considered for future)
- JavaScript-only runtime subset (possible future implementation)

### 6. WebVM Networking Limitations

**Question**: How do WebVM applications access external APIs and Supabase services?

**Decision**: Implement API proxy service through MSW for external network access  
**Rationale**:
- WebVM networking limited by browser security model
- MSW can proxy HTTP requests from WebVM applications to external services
- Supabase APIs (/rest/v1, /auth, etc.) remain accessible through proxy
- Maintains security while enabling full application functionality

**Alternatives considered**:
- Tailscale integration (rejected - requires user authentication)
- Direct browser network access (impossible - browser security)
- CORS proxy (limited, doesn't solve all networking needs)

### 7. Multiple Application Concurrency

**Question**: Should multiple applications run simultaneously or limit to one active app?

**Decision**: Single active application with quick switching capability  
**Rationale**:
- WebVM resource overhead (memory, CPU) in browser environment
- Simplified state management and debugging
- Faster application switching with state preservation
- Reduces complexity of inter-app communication

**Alternatives considered**:
- Multiple concurrent WebVM instances (rejected - resource intensive)
- Application scheduling (complex, unnecessary)
- Resource-limited concurrency (adds complexity without clear benefit)

## Technical Implementation Strategy

### WebVM Integration Architecture
1. **Lazy Loading**: WebVM components load only when Application Server is accessed
2. **Bridge Service**: PostMessage communication layer between main app and WebVM
3. **State Persistence**: IndexedDB storage for WebVM filesystem snapshots
4. **Runtime Management**: Dynamic runtime environment loading and caching

### MSW Integration Points
1. **Route Handlers**: New MSW handlers for /app/{app-id} pattern matching
2. **Request Forwarding**: HTTP request proxy to WebVM applications
3. **Response Bridge**: Async response handling from WebVM back to MSW
4. **API Access**: Transparent proxy for Supabase API access from WebVM apps

### Data Flow
```
Browser Request → MSW Handler → WebVM Bridge → WebVM App → Response Bridge → MSW Response
```

## Risk Assessment

### High Risk
- WebVM browser compatibility across different browsers
- Performance impact of WebAssembly runtime in browser
- Complex debugging of applications running inside WebVM

### Medium Risk  
- State serialization/deserialization reliability
- Memory usage with multiple runtime environments
- HTTP feature compatibility through PostMessage bridge

### Low Risk
- Integration with existing VFS and MSW systems
- UI component development for application management
- File upload and deployment mechanisms

## Next Steps
Proceed to Phase 1 (Design & Contracts) with all research questions resolved and technical approach validated.