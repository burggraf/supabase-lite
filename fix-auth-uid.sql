-- Create a table to store current session context
CREATE TABLE IF NOT EXISTS _session_context (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Drop and recreate auth.uid() function to use session table
DROP FUNCTION IF EXISTS auth.uid();

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT value::uuid FROM _session_context WHERE key = 'user_id'),
    NULL::uuid
  )
$$;

-- Also update auth.role() and auth.jwt() functions
DROP FUNCTION IF EXISTS auth.role();

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT value FROM _session_context WHERE key = 'role'),
    'anon'::text
  )
$$;

DROP FUNCTION IF EXISTS auth.jwt();

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT value::jsonb FROM _session_context WHERE key = 'claims'),
    '{}'::jsonb
  )
$$;