-- Simple auth.uid() fix using a predictable pattern
-- Since PGlite has issues with session variables, we'll use a simple approach

DROP FUNCTION IF EXISTS auth.uid();
DROP FUNCTION IF EXISTS auth.role();
DROP FUNCTION IF EXISTS auth.jwt();

-- Create a single global variable table
DROP TABLE IF EXISTS _current_user;
CREATE UNLOGGED TABLE _current_user (
  user_id UUID,
  role TEXT DEFAULT 'anon',
  claims JSONB DEFAULT '{}'::jsonb
);

-- Insert a single row that we'll always update
INSERT INTO _current_user (user_id, role) VALUES (NULL, 'anon');

-- Recreate auth functions to use this table
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT user_id FROM _current_user LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(role, 'anon') FROM _current_user LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(claims, '{}'::jsonb) FROM _current_user LIMIT 1;
$$;

-- Grant permissions
GRANT SELECT ON _current_user TO PUBLIC;
GRANT UPDATE ON _current_user TO PUBLIC;