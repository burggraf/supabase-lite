# Supabase Lite CLI

Command-line interface for Supabase Lite - a browser-based PostgreSQL database powered by PGlite. This CLI provides psql-compatible functionality to query and manage your browser-based database from the command line.

## Installation

```bash
npm install -g supabase-lite
```

## Usage

### Connect to Database

```bash
# Connect to default local instance
supabase-lite psql --url http://localhost:5173

# Connect to production instance
supabase-lite psql --url https://supabase-lite.pages.dev

# Connect to specific project
supabase-lite psql --url http://localhost:5173/abc123def456
```

### Interactive SQL Session

Once connected, you can run SQL queries interactively:

```sql
-- List tables
\dt

-- Describe table structure
\d users

-- Execute SQL queries
SELECT * FROM auth.users LIMIT 5;

-- Multi-line queries are supported
SELECT id, email, created_at 
FROM auth.users 
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

### Meta Commands

- `\q` - Quit the session
- `\l` - List databases/projects
- `\dt` - List tables
- `\d <table>` - Describe table structure
- `\?` - Show help

## Development

```bash
# Clone and build
git clone https://github.com/burggraf/supabase-lite.git
cd supabase-lite/packages/supabase-lite
npm install
npm run build

# Run locally
npm start psql --url http://localhost:5173

# Run tests
npm test
```

## Architecture

The CLI communicates with Supabase Lite instances via HTTP, using the `/debug/sql` endpoint for query execution. Results are formatted in a table format similar to psql.

See `docs/supabase-lite-cli-architecture.md` for detailed architecture documentation.