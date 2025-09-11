# MSW API Documentation

## Overview

This documentation covers the Mock Service Worker (MSW) API system that provides Supabase-compatible endpoints for Supabase Lite. The MSW API has grown into a complex system with multiple bridges, sophisticated request routing, and comprehensive Supabase compatibility.

**Purpose**: Enable confident debugging, refactoring, and feature development by providing complete understanding of all API code paths and execution flows.

## Quick Navigation

### 🏗️ Architecture
- **[System Overview](./architecture/overview.md)** - High-level system design and components
- **[Request Flow](./architecture/request-flow.md)** - Visual diagrams of request processing
- **[Bridge Comparison](./architecture/bridge-comparison.md)** - Comparison of Enhanced vs Simplified bridges

### 🐛 Debugging
- **[Tracing Guide](./debugging/tracing-guide.md)** - Step-by-step API call tracing
- **[Common Issues](./debugging/common-issues.md)** - Known problems and solutions
- **[Instrumentation](./debugging/instrumentation.md)** - Debugging tools and logging setup

### 📚 Reference
- **[MSW Handlers](./reference/handlers.md)** - Complete handler documentation
- **[Bridge APIs](./reference/bridges.md)** - Bridge interface specifications
- **[Project Resolution](./reference/project-resolution.md)** - Project switching logic

## System Summary

### Key Components
- **3 Bridge Implementations**: Enhanced (full PostgREST), Simplified (optimized subset), Legacy (deprecated)
- **Project Resolution**: Multi-tenant database switching with caching
- **MSW Handlers**: 50+ endpoints covering REST, Auth, Storage, Functions, and App Hosting
- **Database Integration**: PGlite with connection pooling and schema management

### Current Challenges
- **Complex Execution Paths**: Multiple bridges create different behavior patterns
- **Debugging Difficulty**: Hard to trace which code path handles specific requests
- **Maintenance Burden**: 4,000+ lines of handlers with repetitive patterns
- **State Management**: Project switching and caching create complex state interactions

## Quick Debugging Checklist

### 🔍 Tracing an API Request
1. **Identify the URL pattern** - Check which MSW handler matches
2. **Check project resolution** - Verify project ID extraction and database switching
3. **Determine bridge selection** - Enhanced vs Simplified based on `USE_SIMPLIFIED_BRIDGE` flag
4. **Trace query parsing** - Follow PostgREST syntax processing
5. **Check database execution** - Verify SQL generation and parameter handling
6. **Validate response formatting** - Ensure PostgREST-compatible output

### 🚨 Common Issues
- **Bridge mismatch**: Request routed to wrong bridge implementation
- **Project resolution failure**: Database not switched correctly
- **Query parsing errors**: PostgREST syntax not handled properly
- **RLS enforcement issues**: User context not applied correctly
- **CORS problems**: Missing headers or incorrect preflight handling

### 🛠️ Essential Files
```
src/mocks/
├── handlers.ts              # Main handler definitions (4,000+ lines)
├── enhanced-bridge.ts       # Advanced PostgREST compatibility
├── simplified-bridge.ts     # Optimized subset implementation
├── project-resolver.ts      # Project switching logic
└── supabase-bridge.ts       # Legacy implementation
```

## Documentation Goals

1. **Reduce debugging time by 70%** through clear execution path tracing
2. **Enable confident refactoring** with complete component understanding
3. **Simplify feature addition** by providing clear integration patterns
4. **Improve maintainability** through better code organization insights

## Contributing to This Documentation

When modifying the MSW API:

1. **Update relevant documentation sections** immediately
2. **Add new code paths** to the request flow diagrams
3. **Document debugging approaches** for new features
4. **Validate all links** and examples work correctly

---

**Note**: This documentation reflects the MSW API system as of the analysis date. For the most current code, always refer to the source files in `src/mocks/`.