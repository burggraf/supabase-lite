# Supabase Lite CLI Architecture

## Overview

The Supabase Lite CLI is a command-line interface designed to interact with browser-based PostgreSQL databases powered by PGlite. The primary goal is to provide psql-compatible functionality while maintaining extensibility for future Supabase CLI features.

## Architecture Principles

1. **Modular Design**: Each component has a single responsibility and can be tested independently
2. **Extensible Command Structure**: Built to support future Supabase CLI commands beyond psql
3. **HTTP-based Communication**: Uses REST API to communicate with browser instances
4. **User-friendly Interface**: Provides familiar psql-like experience with helpful error messages

## Core Components

### 1. CLI Parser (`src/cli.ts`)
- **Responsibility**: Main entry point, command parsing, and routing
- **Technology**: Commander.js for argument parsing and command structure
- **Extensibility**: Supports adding new commands (db, functions, storage, etc.)

### 2. URL Parser (`src/lib/url-parser.ts`)
- **Responsibility**: Parse and validate connection URLs
- **Supported URL Formats**:
  - `http://localhost:5173` - Default local project
  - `https://supabase-lite.pages.dev` - Production instance
  - `http://localhost:5173/abc123def456` - Specific project by UUID
- **Features**: URL validation, project ID extraction, endpoint construction

### 3. SQL Client (`src/lib/sql-client.ts`)
- **Responsibility**: HTTP communication with Supabase Lite instances
- **Protocol**: POST requests to `/debug/sql` endpoint
- **Features**: 
  - Connection management and validation
  - SQL query execution
  - Error handling and response parsing
  - Support for project-specific queries

### 4. Result Formatter (`src/lib/result-formatter.ts`)
- **Responsibility**: Format query results for display
- **Features**:
  - Table-style output similar to psql
  - Column alignment and truncation
  - Row count and timing information
  - Error message formatting

### 5. REPL Interface (`src/lib/repl.ts`)
- **Responsibility**: Interactive command-line interface
- **Features**:
  - Multi-line SQL statement support
  - Command history and editing
  - Meta-command processing (\dt, \d, \q, etc.)
  - Auto-completion (future enhancement)

### 6. psql Command (`src/commands/psql.ts`)
- **Responsibility**: Main psql command implementation
- **Features**:
  - Interactive and non-interactive modes
  - Meta-command processing
  - Connection establishment
  - Query execution and result display

## Communication Protocol

### HTTP Endpoint Communication
```
POST /debug/sql
Content-Type: application/json

{
  "sql": "SELECT * FROM auth.users LIMIT 5;"
}
```

### Response Format
```json
{
  "data": [
    {"id": "1", "email": "user@example.com", "created_at": "2024-01-01T00:00:00Z"}
  ],
  "rowCount": 1,
  "fields": [
    {"name": "id", "type": "uuid"},
    {"name": "email", "type": "text"},
    {"name": "created_at", "type": "timestamptz"}
  ]
}
```

### Project-Specific Queries
For specific projects, the URL includes the project ID:
```
POST /abc123def456/debug/sql
```

## Command Structure

### Current Commands
- `supabase-lite psql --url <url>` - Start interactive SQL session

### Future Commands (Architecture Ready)
- `supabase-lite db` - Database management
  - `supabase-lite db list` - List databases
  - `supabase-lite db create <name>` - Create database
  - `supabase-lite db drop <name>` - Drop database
- `supabase-lite functions` - Edge functions management
- `supabase-lite storage` - Storage bucket operations
- `supabase-lite auth` - Authentication management
- `supabase-lite migrations` - Database migrations

## Meta Commands

Meta commands are psql-compatible shortcuts processed by the REPL:

- `\q` - Quit the session
- `\l` - List databases/projects
- `\dt` - List tables in current schema
- `\dt *.*` - List all tables in all schemas
- `\d <table>` - Describe table structure
- `\dn` - List schemas
- `\du` - List users/roles
- `\?` - Show help for meta commands

## Error Handling

### Connection Errors
- URL validation and reachability checks
- Clear error messages for common connection issues
- Fallback suggestions for troubleshooting

### Query Errors
- PostgreSQL error message parsing and formatting
- Context-aware error hints
- Syntax error highlighting (future enhancement)

## Testing Strategy

### Unit Tests
- URL parser validation
- Result formatter output
- Meta command parsing
- Error handling scenarios

### Integration Tests
- HTTP client communication
- End-to-end query execution
- REPL command processing

### Manual Testing
- Interactive session testing
- Different URL format validation
- Error condition verification

## Extensibility Patterns

### Adding New Commands
1. Create command file in `src/commands/`
2. Implement command handler with Commander.js pattern
3. Register command in main CLI parser
4. Add tests and documentation

### Adding New Meta Commands
1. Add command parser in REPL interface
2. Implement command logic in appropriate module
3. Add to help system and documentation

### Supporting New Database Features
1. Extend SQL client for new endpoints
2. Update result formatter for new response types
3. Add new meta commands as needed

## Security Considerations

- No credential storage in CLI (relies on browser authentication)
- HTTPS validation for production URLs
- Input sanitization for SQL queries (handled by PGlite)
- No direct file system access from CLI

## Performance Considerations

- Streaming large result sets (future enhancement)
- Connection pooling for multiple queries
- Query result caching for meta commands
- Async processing for non-blocking operations

This architecture provides a solid foundation for the initial psql functionality while maintaining flexibility for future Supabase CLI feature additions.