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

### Command Line Options

#### Database Connection (psql)

```bash
# Interactive mode (default)
supabase-lite psql -u http://localhost:5173

# Execute single command
supabase-lite psql -u http://localhost:5173 -c "SELECT * FROM auth.users;"

# Execute SQL script from file
supabase-lite psql -u http://localhost:5173 -f schema.sql

# Execute file with error handling options
supabase-lite psql -u http://localhost:5173 -f migration.sql --continue-on-error --show-progress

# Quiet mode (suppress connection messages)
supabase-lite psql -u http://localhost:5173 -f script.sql --quiet
```

#### Project Administration (admin)

```bash
# List all projects
supabase-lite admin list-projects -u http://localhost:5173

# Create a new project
supabase-lite admin create-project "My New Project" -u http://localhost:5173

# Delete a project (with confirmation)
supabase-lite admin delete-project abc123def456 -u http://localhost:5173

# Delete a project (skip confirmation)
supabase-lite admin delete-project abc123def456 -u http://localhost:5173 --yes
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

### SQL File Execution

Execute complex multi-statement SQL scripts:

```sql
-- Example: schema.sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2)
);

INSERT INTO products (name, price) VALUES 
  ('Widget A', 19.99),
  ('Widget B', 29.99);

SELECT * FROM products;
```

```bash
# Execute the script
supabase-lite psql -u http://localhost:5173 -f schema.sql
```

**File Execution Features:**
- **Multi-statement support**: Execute multiple SQL statements in sequence
- **Comment handling**: Properly handles line comments (`--`) and block comments (`/* */`)
- **Error handling**: Use `--continue-on-error` to continue execution after failures
- **Progress tracking**: Use `--show-progress` to see execution status for long scripts
- **Detailed results**: View execution time and results for each statement

### Project Management

The admin command provides comprehensive project management capabilities:

#### List Projects
```bash
supabase-lite admin list-projects -u http://localhost:5173
```
Shows a table with:
- Project name and ID
- Active/inactive status  
- Creation date and last accessed date
- Total number of projects

#### Create Projects
```bash
supabase-lite admin create-project "My New Project" -u http://localhost:5173
```
Creates a new project with:
- **Name validation**: 2-50 characters, alphanumeric plus spaces, hyphens, underscores
- **Unique names**: Prevents duplicate project names
- **Automatic activation**: New projects become the active project
- **Connection info**: Shows how to connect to the new project

#### Delete Projects
```bash
# With confirmation prompt
supabase-lite admin delete-project abc123def456 -u http://localhost:5173

# Skip confirmation (use with caution)
supabase-lite admin delete-project abc123def456 -u http://localhost:5173 --yes
```
Safely deletes projects with:
- **Project verification**: Confirms project exists before deletion
- **Safety prompts**: Interactive confirmation unless `--yes` flag is used
- **Clear warnings**: Shows exactly what will be deleted
- **Permanent deletion**: All project data is permanently removed

### Meta Commands

- `\q` - Quit the session
- `\l` - List databases/projects
- `\dt` - List tables in current schema
- `\dt *.*` - List all tables in all schemas  
- `\d <table>` - Describe table structure
- `\dn` - List schemas
- `\du` - List users/roles
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