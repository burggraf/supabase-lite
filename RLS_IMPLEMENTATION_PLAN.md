# Row Level Security (RLS) Implementation Plan for Supabase Lite

## Executive Summary

This document outlines a comprehensive plan to implement full Row Level Security (RLS) support in Supabase Lite, ensuring 100% compatibility with Supabase's RLS behavior while maintaining browser-only operation. The implementation will properly enforce RLS policies at the database level and provide both `anon` and `service_role` API keys for different access levels.

## Current State Analysis

### ✅ What's Working
- JWT extraction from `Authorization: Bearer <token>` headers
- User identification from JWT payload (`sub` field)
- Database has auth helper functions (`auth.uid()`, `auth.jwt()`, `auth.role()`)
- Basic infrastructure for RLS exists in EnhancedSupabaseAPIBridge

### ❌ Critical Issues
1. **Database has `row_security = off`** (sql_scripts/seed.sql:15)
2. **No RLS policies defined** for any tables
3. **RLS filtering is bypassed** (enhanced-bridge.ts:204 returns unmodified query)
4. **No session variables set** before query execution
5. **Hardcoded table whitelist** (only 'profiles' and 'user_data')
6. **No role-based API key handling** (anon vs service_role)

## Implementation Goals

1. **Full RLS Enforcement**: Enable and enforce RLS policies at the database level
2. **Supabase Compatibility**: 100% compatible with Supabase.js client library
3. **Dual API Key System**: Implement both `anon` and `service_role` keys
4. **Session Context**: Set proper JWT claims as PostgreSQL session variables
5. **Simple Implementation**: Keep the solution as simple as possible while maintaining compatibility

## Detailed Implementation Steps

### Phase 1: Database-Level RLS Setup

#### 1.1 Enable Row Security (Critical)
- **File**: `sql_scripts/seed.sql`
- **Changes**:
  - Remove `SET row_security = off;` (line 15)
  - Uncomment RLS enablement for auth tables (lines 467-474)
  - Add RLS enablement for all public tables

#### 1.2 Create Database Roles
- **New File**: `sql_scripts/roles.sql`
- **Implementation**:
  ```sql
  -- Create roles if they don't exist
  DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
      CREATE ROLE anon NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
      CREATE ROLE authenticated NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
      CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
    END IF;
  END $$;
  
  -- Grant permissions
  GRANT USAGE ON SCHEMA public TO anon, authenticated;
  GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
  ```

#### 1.3 Create Default RLS Policies
- **New File**: `sql_scripts/default_policies.sql`
- **Implementation**:
  - Basic policies for auth.users (users can see their own record)
  - Policies for public tables based on user_id columns
  - Template policies for common patterns

### Phase 2: Session Context Management

#### 2.1 Modify DatabaseManager
- **File**: `src/lib/database/connection.ts`
- **Add Method**: `setSessionContext(claims: any)`
- **Implementation**:
  ```typescript
  async setSessionContext(claims: any) {
    const role = claims?.role || 'anon';
    const userId = claims?.sub || null;
    
    // Set session variables for RLS
    await this.db.query(`
      SET LOCAL role TO ${role};
      SET LOCAL request.jwt.claims TO '${JSON.stringify(claims)}';
      SET LOCAL request.jwt.claim.sub TO '${userId}';
      SET LOCAL request.jwt.claim.role TO '${role}';
    `);
  }
  ```

#### 2.2 Wrap Query Execution
- **Modify**: `DatabaseManager.query()` method
- **Implementation**:
  - Accept optional `context` parameter with JWT claims
  - Set session context before executing query
  - Reset context after query execution

### Phase 3: API Key System Implementation

#### 3.1 Generate API Keys
- **New File**: `src/lib/auth/api-keys.ts`
- **Implementation**:
  ```typescript
  // Generate deterministic keys based on project
  export function generateApiKeys(projectId: string) {
    const secret = 'supabase-lite-jwt-secret'; // In production, use crypto.randomBytes
    
    // Anon key - role: anon
    const anonPayload = {
      role: 'anon',
      iss: 'supabase-lite',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60) // 10 years
    };
    
    // Service role key - role: service_role
    const servicePayload = {
      role: 'service_role',
      iss: 'supabase-lite',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60)
    };
    
    return {
      anon: signJWT(anonPayload, secret),
      service_role: signJWT(servicePayload, secret)
    };
  }
  ```

#### 3.2 API Key Validation
- **File**: `src/mocks/enhanced-bridge.ts`
- **Modify**: Request processing to handle apikey header
- **Implementation**:
  - Check if apikey is anon or service_role JWT
  - Extract role from apikey JWT
  - Merge with user JWT if present
  - Pass combined context to database

### Phase 4: Enhanced Bridge RLS Integration

#### 4.1 Fix RLS Filtering
- **File**: `src/mocks/enhanced-bridge.ts`
- **Fix Line 204**: Remove bypass, implement proper RLS
- **Implementation**:
  ```typescript
  private async applyRLSFiltering(table: string, query: any, headers: any) {
    // Extract full context from headers
    const apiKey = headers['apikey'];
    const authHeader = headers['authorization'];
    
    // Determine role from API key
    const apiKeyRole = this.extractRoleFromApiKey(apiKey);
    
    // If service_role, bypass RLS
    if (apiKeyRole === 'service_role') {
      return query; // Service role bypasses RLS
    }
    
    // Extract user context from auth header if present
    const userContext = this.extractUserContext(authHeader);
    
    // Combine contexts
    const context = {
      role: userContext ? 'authenticated' : apiKeyRole || 'anon',
      sub: userContext?.sub,
      ...userContext
    };
    
    // Query will be executed with context in DatabaseManager
    return { ...query, _context: context };
  }
  ```

#### 4.2 Remove Hardcoded Table Lists
- **Remove**: Hardcoded checks for specific tables
- **Implementation**: Apply RLS to ALL tables uniformly

### Phase 5: Database Query Execution with Context

#### 5.1 Modify Query Handlers
- **Files**: All CRUD handlers in enhanced-bridge.ts
- **Implementation**:
  ```typescript
  private async handleSelect(request: any) {
    const { table, query } = request;
    const context = query._context;
    delete query._context;
    
    // Build SQL with query parameters
    const sql = this.buildSelectSQL(table, query);
    
    // Execute with context
    const result = await this.databaseManager.query(sql, [], context);
    
    return result;
  }
  ```

### Phase 6: Testing & Validation

#### 6.1 Create RLS Test Suite
- **New File**: `src/lib/database/__tests__/rls.test.ts`
- **Tests**:
  - Anon role can't access protected data
  - Authenticated users see only their data
  - Service role bypasses RLS
  - Policies work correctly for CRUD operations

#### 6.2 Integration Tests
- **New File**: `test-app/rls-tests.js`
- **Tests**:
  - Supabase.js client with anon key
  - Supabase.js client with service_role key
  - User authentication flow
  - RLS policy enforcement

### Phase 7: UI Integration

#### 7.1 API Keys Display
- **New Component**: `src/components/settings/ApiKeys.tsx`
- **Features**:
  - Display generated anon and service_role keys
  - Copy to clipboard functionality
  - Usage examples

#### 7.2 RLS Policy Editor
- **New Component**: `src/components/database/RLSPolicyEditor.tsx`
- **Features**:
  - List tables with RLS status
  - Enable/disable RLS per table
  - Create/edit/delete policies
  - Policy templates

## Migration Strategy

### For Existing Projects
1. Generate default API keys on first load
2. Enable RLS on all tables (with warning)
3. Create permissive policies by default
4. Provide migration wizard for policy setup

### For New Projects
1. RLS enabled by default on all tables
2. API keys generated automatically
3. Basic policies created for auth tables
4. Guided setup for custom policies

## Security Considerations

1. **JWT Secret**: Store securely in localStorage with encryption
2. **Service Role Key**: Display with warnings about security
3. **RLS Bypass**: Only service_role can bypass RLS
4. **Session Isolation**: Each query runs in isolated session
5. **Policy Validation**: Validate policy SQL before execution

## Performance Optimizations

1. **Connection Pooling**: Reuse PGlite connections
2. **Session Caching**: Cache session setup for same context
3. **Policy Indexing**: Auto-create indexes for policy columns
4. **Query Plan Cache**: Cache query plans for common patterns

## Documentation Requirements

1. **API Keys Guide**: How to use anon vs service_role
2. **RLS Tutorial**: Step-by-step RLS setup
3. **Policy Examples**: Common policy patterns
4. **Migration Guide**: Moving from no-RLS to RLS
5. **Security Best Practices**: Safe key handling

## Success Metrics

1. ✅ `curl` with anon key returns empty array for RLS-protected tables
2. ✅ `curl` with service_role key returns all data
3. ✅ Supabase.js client works identically to production Supabase
4. ✅ All existing tests pass with RLS enabled
5. ✅ Performance impact < 10% for typical queries

## Implementation Timeline

- **Phase 1-2**: Database & Session Setup (2 days)
- **Phase 3-4**: API Key System (1 day)
- **Phase 5**: Query Execution (1 day)
- **Phase 6**: Testing (2 days)
- **Phase 7**: UI Integration (2 days)
- **Documentation**: (1 day)

**Total Estimated Time**: 9 days

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Feature flag for RLS enable/disable |
| Performance degradation | Query optimization and caching |
| Complex policy errors | Policy validation and templates |
| JWT secret exposure | Encryption and security warnings |

## Conclusion

This implementation plan provides a clear path to full RLS support in Supabase Lite while maintaining 100% compatibility with Supabase's API. The approach prioritizes simplicity, security, and performance while ensuring a smooth migration path for existing users.