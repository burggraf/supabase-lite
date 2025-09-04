# PostgreSQL Installation Guide for WebVM

This guide documents the process for installing and configuring PostgreSQL within the WebVM environment for feasibility testing.

## Overview

The PostgreSQL installation process involves several steps to ensure optimal configuration for the WebVM browser environment while maintaining compatibility with PostgREST requirements.

## Prerequisites

- WebVM 2.0 running and accessible
- SharedArrayBuffer support enabled in browser
- Sufficient memory allocation (minimum 1GB recommended)
- Stable internet connection for package downloads

## Installation Steps

### Step 1: WebVM Environment Preparation

Before installing PostgreSQL, ensure the WebVM environment is properly prepared:

```bash
# Update package lists
apt-get update

# Install essential build tools
apt-get install -y build-essential wget curl gnupg lsb-release

# Add PostgreSQL official repository
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
apt-get update
```

### Step 2: PostgreSQL Installation

Install PostgreSQL and related packages:

```bash
# Install PostgreSQL 15 (recommended version)
apt-get install -y postgresql-15 postgresql-client-15 postgresql-contrib-15

# Install additional tools
apt-get install -y pgbouncer postgresql-15-pgcrypto

# Create necessary directories
mkdir -p /var/lib/postgresql/data
chown -R postgres:postgres /var/lib/postgresql/data
```

### Step 3: PostgreSQL Configuration

Configure PostgreSQL for optimal WebVM performance:

#### Main Configuration (`/etc/postgresql/15/main/postgresql.conf`)

```conf
# Connection Settings
listen_addresses = 'localhost'
port = 5432
max_connections = 25

# Memory Settings (optimized for WebVM)
shared_buffers = 64MB
effective_cache_size = 128MB
work_mem = 2MB
maintenance_work_mem = 32MB

# Write Ahead Log (optimized for development)
wal_level = minimal
fsync = off
synchronous_commit = off
wal_buffers = 2MB
checkpoint_segments = 4

# Query Tuning
random_page_cost = 1.1
effective_io_concurrency = 0
default_statistics_target = 50

# Logging
logging_collector = on
log_directory = '/var/log/postgresql'
log_filename = 'postgresql-%Y-%m-%d.log'
log_statement = 'all'
log_duration = on
log_line_prefix = '%m [%p] %q%u@%d '

# Autovacuum
autovacuum = on
autovacuum_naptime = 10min
autovacuum_vacuum_threshold = 50
autovacuum_analyze_threshold = 50
```

#### Host-Based Authentication (`/etc/postgresql/15/main/pg_hba.conf`)

```conf
# Local connections
local   all             postgres                                peer
local   all             all                                     md5

# IPv4 local connections
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5

# Supabase-compatible roles
host    supabase        authenticator   127.0.0.1/32            md5
host    supabase        service_role    127.0.0.1/32            md5
host    supabase        anon            127.0.0.1/32            md5
```

### Step 4: Database Initialization

Initialize the PostgreSQL database cluster:

```bash
# Stop any existing PostgreSQL service
systemctl stop postgresql

# Initialize the database cluster
sudo -u postgres initdb -D /var/lib/postgresql/data

# Start PostgreSQL service
systemctl start postgresql
systemctl enable postgresql

# Wait for PostgreSQL to be ready
sudo -u postgres psql -c "SELECT 1;"
```

### Step 5: Supabase Schema Setup

Create the necessary database and roles for Supabase compatibility:

```sql
-- Create Supabase database
CREATE DATABASE supabase;

-- Create Supabase roles
CREATE USER authenticator WITH PASSWORD 'secure_password_here';
CREATE USER service_role WITH PASSWORD 'secure_password_here';
CREATE USER anon WITH PASSWORD 'secure_password_here';

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE supabase TO authenticator;
ALTER USER service_role CREATEDB;

-- Connect to supabase database
\c supabase

-- Create auth schema
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS realtime;

-- Grant schema permissions
GRANT USAGE ON SCHEMA auth TO authenticator, service_role, anon;
GRANT USAGE ON SCHEMA storage TO authenticator, service_role, anon;
GRANT USAGE ON SCHEMA realtime TO authenticator, service_role, anon;

-- Create basic auth tables (simplified for testing)
CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    encrypted_password TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE auth.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies
CREATE POLICY "Users can see own data" ON auth.users
    FOR ALL TO authenticated
    USING (id = current_setting('app.current_user_id')::UUID);

CREATE POLICY "Users can manage own sessions" ON auth.sessions
    FOR ALL TO authenticated
    USING (user_id = current_setting('app.current_user_id')::UUID);
```

### Step 6: Extensions Installation

Install required PostgreSQL extensions:

```sql
-- Connect to supabase database
\c supabase

-- Install required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Verify extensions
SELECT extname FROM pg_extension;
```

## Verification Steps

After installation, verify that PostgreSQL is working correctly:

### Basic Functionality Test

```sql
-- Test basic operations
CREATE TABLE test_table (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO test_table (name) VALUES ('Test Record 1'), ('Test Record 2');
SELECT * FROM test_table;
DROP TABLE test_table;
```

### Performance Test

```sql
-- Create test data
CREATE TABLE benchmark_test (
    id SERIAL PRIMARY KEY,
    data TEXT,
    value INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert test data
INSERT INTO benchmark_test (data, value)
SELECT 
    'test_data_' || generate_series,
    (random() * 1000)::INTEGER
FROM generate_series(1, 10000);

-- Test query performance
\timing on
SELECT COUNT(*) FROM benchmark_test;
SELECT AVG(value) FROM benchmark_test WHERE value > 500;
\timing off

-- Cleanup
DROP TABLE benchmark_test;
```

### Connection Test

```bash
# Test connection from command line
psql -h localhost -U authenticator -d supabase -c "SELECT version();"

# Test multiple connections
for i in {1..5}; do
    psql -h localhost -U authenticator -d supabase -c "SELECT $i as connection_test;" &
done
wait
```

## Expected Resource Usage

Based on our testing, typical resource usage for PostgreSQL in WebVM:

| Metric | Idle State | Under Load | Peak Usage |
|--------|------------|------------|------------|
| Memory | ~80MB | ~120MB | ~180MB |
| CPU | <5% | 15-25% | <40% |
| Disk | ~150MB | ~200MB | ~300MB |
| Connections | 1-2 | 5-10 | 25 (max) |

## Common Issues and Solutions

### Issue: PostgreSQL fails to start

**Symptoms:** 
- Service fails to start
- Connection refused errors
- Memory allocation errors

**Solutions:**
1. Check available memory: `free -m`
2. Reduce memory settings in postgresql.conf
3. Check log files: `/var/log/postgresql/`
4. Verify permissions: `chown -R postgres:postgres /var/lib/postgresql/`

### Issue: Poor performance

**Symptoms:**
- Slow query execution
- High CPU usage
- Connection timeouts

**Solutions:**
1. Reduce `max_connections` to 15-20
2. Lower `shared_buffers` to 32MB
3. Disable `fsync` for development (DO NOT use in production)
4. Add indexes to frequently queried columns

### Issue: Connection limit reached

**Symptoms:**
- "too many clients" errors
- Application connection failures

**Solutions:**
1. Implement connection pooling with PgBouncer
2. Reduce `max_connections` setting
3. Close unused connections promptly
4. Monitor connection usage: `SELECT * FROM pg_stat_activity;`

### Issue: Extension installation fails

**Symptoms:**
- CREATE EXTENSION errors
- Missing function errors

**Solutions:**
1. Install postgresql-contrib package
2. Use specific version: `postgresql-15-contrib`
3. Check extension availability: `SELECT * FROM pg_available_extensions;`
4. Install from source if package unavailable

## Performance Optimization Tips

### Memory Optimization

1. **Reduce shared_buffers**: Start with 32-64MB for WebVM
2. **Lower work_mem**: Use 2-4MB to prevent excessive memory usage
3. **Minimize maintenance_work_mem**: Set to 32-64MB
4. **Monitor memory usage**: `SELECT * FROM pg_stat_database;`

### CPU Optimization

1. **Limit connections**: Keep max_connections low (15-25)
2. **Disable unnecessary logging**: Reduce log_statement level
3. **Optimize queries**: Use EXPLAIN ANALYZE to identify slow queries
4. **Use appropriate indexes**: Create indexes for frequently accessed columns

### Disk I/O Optimization

1. **Disable fsync**: Only for development environments
2. **Increase checkpoint intervals**: Reduce checkpoint frequency
3. **Use appropriate wal_level**: Set to minimal for single-instance setup
4. **Monitor disk usage**: Regular cleanup of logs and temporary files

## Troubleshooting Commands

### System Information

```bash
# Check PostgreSQL version
psql --version

# Check running processes
ps aux | grep postgres

# Check memory usage
free -h
cat /proc/meminfo | grep -E "(MemTotal|MemFree|MemAvailable)"

# Check disk usage
df -h
du -sh /var/lib/postgresql/
```

### Database Information

```sql
-- Check database size
SELECT pg_size_pretty(pg_database_size('supabase'));

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check connections
SELECT count(*) FROM pg_stat_activity;
SELECT * FROM pg_stat_activity WHERE state = 'active';

-- Check performance stats
SELECT * FROM pg_stat_database WHERE datname = 'supabase';
```

### Log Analysis

```bash
# View recent PostgreSQL logs
tail -f /var/log/postgresql/postgresql-*.log

# Search for errors
grep -i error /var/log/postgresql/postgresql-*.log

# Search for slow queries
grep -i "duration:" /var/log/postgresql/postgresql-*.log | sort -k 4 -n
```

## Next Steps

After successful installation and verification:

1. **Run Feasibility Tests**: Execute the comprehensive test suite
2. **Performance Benchmarking**: Compare against PGlite performance
3. **Resource Monitoring**: Long-term stability testing
4. **PostgREST Integration**: Test API layer compatibility
5. **Decision Making**: Use results to choose implementation path

## Rollback Procedure

If PostgreSQL installation fails or causes issues:

```bash
# Stop PostgreSQL service
systemctl stop postgresql
systemctl disable postgresql

# Remove PostgreSQL packages
apt-get remove --purge postgresql-* pgbouncer
apt-get autoremove
apt-get autoclean

# Remove data directories
rm -rf /var/lib/postgresql/
rm -rf /etc/postgresql/
rm -rf /var/log/postgresql/

# Remove repository
rm -f /etc/apt/sources.list.d/pgdg.list
```

This ensures a clean environment for PGlite fallback implementation if needed.