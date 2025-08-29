--
-- PostgreSQL database dump
--
-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.5 (Homebrew)
SET statement_timeout = 0;

SET lock_timeout = 0;

SET idle_in_transaction_session_timeout = 0;

SET transaction_timeout = 0;

SET client_encoding = 'UTF8';

SET standard_conforming_strings = ON;

SELECT
    pg_catalog.set_config('search_path', '', FALSE);

SET check_function_bodies = FALSE;

SET xmloption = content;

SET client_min_messages = warning;

SET row_security = OFF;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: supabase_admin
--
CREATE SCHEMA auth;

ALTER SCHEMA auth OWNER TO supabase_admin;

--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: postgres
--
CREATE SCHEMA extensions;

ALTER SCHEMA extensions OWNER TO postgres;

--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: supabase_admin
--
CREATE SCHEMA graphql;

ALTER SCHEMA graphql OWNER TO supabase_admin;

--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: supabase_admin
--
CREATE SCHEMA graphql_public;

ALTER SCHEMA graphql_public OWNER TO supabase_admin;

--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: pgbouncer
--
CREATE SCHEMA pgbouncer;

ALTER SCHEMA pgbouncer OWNER TO pgbouncer;

--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: supabase_admin
--
CREATE SCHEMA realtime;

ALTER SCHEMA realtime OWNER TO supabase_admin;

--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: supabase_admin
--
CREATE SCHEMA storage;

ALTER SCHEMA storage OWNER TO supabase_admin;

--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: supabase_admin
--
CREATE SCHEMA vault;

ALTER SCHEMA vault OWNER TO supabase_admin;

--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--
-- CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;
--
-- Name: EXTENSION pg_graphql; Type: COMMENT; Schema: -; Owner:
--
-- COMMENT ON EXTENSION pg_graphql IS 'pg_graphql: GraphQL support';
--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;
--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner:
--
-- COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';
--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--
-- CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner:
--
-- COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';
--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--
-- CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;
--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner:
--
-- COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';
--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner:
--
-- COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';
--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--
CREATE TYPE auth.aal_level AS ENUM(
    'aal1',
    'aal2',
    'aal3'
);

ALTER TYPE auth.aal_level OWNER TO supabase_auth_admin;

--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--
CREATE TYPE auth.code_challenge_method AS ENUM(
    's256',
    'plain'
);

ALTER TYPE auth.code_challenge_method OWNER TO supabase_auth_admin;

--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--
CREATE TYPE auth.factor_status AS ENUM(
    'unverified',
    'verified'
);

ALTER TYPE auth.factor_status OWNER TO supabase_auth_admin;

--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--
CREATE TYPE auth.factor_type AS ENUM(
    'totp',
    'webauthn',
    'phone'
);

ALTER TYPE auth.factor_type OWNER TO supabase_auth_admin;

--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--
CREATE TYPE auth.one_time_token_type AS ENUM(
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);

ALTER TYPE auth.one_time_token_type OWNER TO supabase_auth_admin;

--
-- Name: action; Type: TYPE; Schema: realtime; Owner: supabase_admin
--
CREATE TYPE realtime.action AS ENUM(
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);

ALTER TYPE realtime.action OWNER TO supabase_admin;

--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: supabase_admin
--
CREATE TYPE realtime.equality_op AS ENUM(
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in'
);

ALTER TYPE realtime.equality_op OWNER TO supabase_admin;

--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: supabase_admin
--
CREATE TYPE realtime.user_defined_filter AS (
    column_name text,
    op realtime.equality_op,
    value text
);

ALTER TYPE realtime.user_defined_filter OWNER TO supabase_admin;

--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: supabase_admin
--
CREATE TYPE realtime.wal_column AS (
    name text,
    type_name text,
    type_oid oid,
    value jsonb,
    is_pkey boolean,
    is_selectable boolean
);

ALTER TYPE realtime.wal_column OWNER TO supabase_admin;

--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: supabase_admin
--
CREATE TYPE realtime.wal_rls AS (
    wal jsonb,
    is_rls_enabled boolean,
    subscription_ids uuid[],
    errors text[]
);

ALTER TYPE realtime.wal_rls OWNER TO supabase_admin;

--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--
CREATE FUNCTION auth.email()
    RETURNS text
    LANGUAGE sql
    STABLE
    AS $$
    SELECT
        coalesce(nullif(current_setting('request.jwt.claim.email', TRUE), ''),(nullif(current_setting('request.jwt.claims', TRUE), '')::jsonb ->> 'email'))::text
$$;

ALTER FUNCTION auth.email() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--
COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';

--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--
CREATE FUNCTION auth.jwt()
    RETURNS jsonb
    LANGUAGE sql
    STABLE
    AS $$
    SELECT
        coalesce(nullif(current_setting('request.jwt.claim', TRUE), ''), nullif(current_setting('request.jwt.claims', TRUE), ''))::jsonb
$$;

ALTER FUNCTION auth.jwt() OWNER TO supabase_auth_admin;

--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--
CREATE FUNCTION auth.role()
    RETURNS text
    LANGUAGE sql
    STABLE
    AS $$
    SELECT
        coalesce(nullif(current_setting('request.jwt.claim.role', TRUE), ''),(nullif(current_setting('request.jwt.claims', TRUE), '')::jsonb ->> 'role'))::text
$$;

ALTER FUNCTION auth.role() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--
COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';

--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--
CREATE FUNCTION auth.uid()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $$
    SELECT
        coalesce(nullif(current_setting('request.jwt.claim.sub', TRUE), ''),(nullif(current_setting('request.jwt.claims', TRUE), '')::jsonb ->> 'sub'))::uuid
$$;

ALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--
COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';

--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--
CREATE FUNCTION extensions.grant_pg_cron_access()
    RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF EXISTS(
        SELECT
        FROM
            pg_event_trigger_ddl_commands() AS ev
            JOIN pg_extension AS ext ON ev.objid = ext.oid
        WHERE
            ext.extname = 'pg_cron') THEN
    GRANT usage ON SCHEMA cron TO postgres WITH GRANT option;
    ALTER DEFAULT privileges IN SCHEMA cron GRANT ALL ON tables TO postgres WITH GRANT option;
    ALTER DEFAULT privileges IN SCHEMA cron GRANT ALL ON functions TO postgres WITH GRANT option;
    ALTER DEFAULT privileges IN SCHEMA cron GRANT ALL ON sequences TO postgres WITH GRANT option;
    ALTER DEFAULT privileges FOR USER supabase_admin IN SCHEMA cron GRANT ALL ON sequences TO postgres WITH GRANT option;
    ALTER DEFAULT privileges FOR USER supabase_admin IN SCHEMA cron GRANT ALL ON tables TO postgres WITH GRANT option;
    ALTER DEFAULT privileges FOR USER supabase_admin IN SCHEMA cron GRANT ALL ON functions TO postgres WITH GRANT option;
    GRANT ALL privileges ON ALL tables IN SCHEMA cron TO postgres WITH GRANT option;
    REVOKE ALL ON TABLE cron.job FROM postgres;
    GRANT SELECT ON TABLE cron.job TO postgres WITH GRANT option;
END IF;
END;
$$;

ALTER FUNCTION extensions.grant_pg_cron_access() OWNER TO supabase_admin;

--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--
COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';

--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--
/*
CREATE FUNCTION extensions.grant_pg_graphql_access()
 RETURNS event_trigger
 LANGUAGE plpgsql
 AS $_$
DECLARE
 func_is_graphql_resolve bool;
BEGIN
 func_is_graphql_resolve =(
 SELECT
 n.proname = 'resolve'
 FROM
 pg_event_trigger_ddl_commands() AS ev
 LEFT JOIN pg_catalog.pg_proc AS n ON ev.objid = n.oid);
 IF func_is_graphql_resolve THEN
 -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
 DROP FUNCTION IF EXISTS graphql_public.graphql;
 CREATE OR REPLACE FUNCTION graphql_public.graphql("operationName" text DEFAULT NULL, query text DEFAULT NULL, variables jsonb DEFAULT NULL, extensions jsonb DEFAULT NULL )
 RETURNS jsonb
 LANGUAGE sql
 AS $$
 SELECT
 graphql.resolve(
 query := query,
 variables := coalesce(variables, '{}' ),
 "operationName" := "operationName",
 extensions := extensions
 );
 $$;
 -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
 -- function in the extension so we need to grant permissions on existing entities AND
 -- update default permissions to any others that are created after `graphql.resolve`
 GRANT usage ON SCHEMA graphql TO postgres, anon, authenticated, service_role;
 GRANT SELECT ON ALL tables IN SCHEMA graphql TO postgres, anon, authenticated, service_role;
 GRANT EXECUTE ON ALL functions IN SCHEMA graphql TO postgres, anon, authenticated, service_role;
 GRANT ALL ON ALL sequences IN SCHEMA graphql TO postgres, anon, authenticated, service_role;
 ALTER DEFAULT privileges IN SCHEMA graphql GRANT ALL ON tables TO postgres, anon, authenticated, service_role;
 ALTER DEFAULT privileges IN SCHEMA graphql GRANT ALL ON functions TO postgres, anon, authenticated, service_role;
 ALTER DEFAULT privileges IN SCHEMA graphql GRANT ALL ON sequences TO postgres, anon, authenticated, service_role;
 -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
 GRANT usage ON SCHEMA graphql_public TO postgres WITH GRANT option;
 GRANT usage ON SCHEMA graphql TO postgres WITH GRANT option;
END IF;
END;
$_$;

ALTER FUNCTION extensions.grant_pg_graphql_access() OWNER TO supabase_admin;

--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--
COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';
 */
--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--
CREATE FUNCTION extensions.grant_pg_net_access()
    RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF EXISTS(
        SELECT
            1
        FROM
            pg_event_trigger_ddl_commands() AS ev
            JOIN pg_extension AS ext ON ev.objid = ext.oid
        WHERE
            ext.extname = 'pg_net') THEN
    IF NOT EXISTS(
        SELECT
            1
        FROM
            pg_roles
        WHERE
            rolname = 'supabase_functions_admin') THEN
    CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
END IF;
    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    IF EXISTS(
        SELECT
        FROM
            pg_extension
        WHERE
            extname = 'pg_net'
            -- all versions in use on existing projects as of 2025-02-20
            -- version 0.12.0 onwards don't need these applied
            AND extversion IN('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')) THEN
    ALTER FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
    ALTER FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
    ALTER FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
    ALTER FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
    REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
    REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
END IF;
END IF;
END;
$$;

ALTER FUNCTION extensions.grant_pg_net_access() OWNER TO supabase_admin;

--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--
COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';

--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--
CREATE FUNCTION extensions.pgrst_ddl_watch()
    RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    cmd record;
BEGIN
    FOR cmd IN
    SELECT
        *
    FROM
        pg_event_trigger_ddl_commands()
        LOOP
            IF cmd.command_tag IN ('CREATE SCHEMA', 'ALTER SCHEMA', 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE', 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE', 'CREATE VIEW', 'ALTER VIEW', 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW', 'CREATE FUNCTION', 'ALTER FUNCTION', 'CREATE TRIGGER', 'CREATE TYPE', 'ALTER TYPE', 'CREATE RULE', 'COMMENT')
                -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
                AND cmd.schema_name IS DISTINCT FROM 'pg_temp' THEN
                NOTIFY pgrst,
                'reload schema';
            END IF;
        END LOOP;
END;
$$;

ALTER FUNCTION extensions.pgrst_ddl_watch() OWNER TO supabase_admin;

--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--
CREATE FUNCTION extensions.pgrst_drop_watch()
    RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    obj record;
BEGIN
    FOR obj IN
    SELECT
        *
    FROM
        pg_event_trigger_dropped_objects()
        LOOP
            IF obj.object_type IN ('schema', 'table', 'foreign table', 'view', 'materialized view', 'function', 'trigger', 'type', 'rule') AND obj.is_temporary IS FALSE -- no pg_temp objects
                THEN
                NOTIFY pgrst,
                'reload schema';
            END IF;
        END LOOP;
END;
$$;

ALTER FUNCTION extensions.pgrst_drop_watch() OWNER TO supabase_admin;

--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--
/*
CREATE FUNCTION extensions.set_graphql_placeholder()
 RETURNS event_trigger
 LANGUAGE plpgsql
 AS $_$
DECLARE
 graphql_is_dropped bool;
BEGIN
 graphql_is_dropped =(
 SELECT
 ev.schema_name = 'graphql_public'
 FROM
 pg_event_trigger_dropped_objects() AS ev
 WHERE
 ev.schema_name = 'graphql_public');
 IF graphql_is_dropped THEN
 CREATE OR REPLACE FUNCTION graphql_public.graphql("operationName" text DEFAULT NULL, query text DEFAULT NULL, variables jsonb DEFAULT NULL, extensions jsonb DEFAULT NULL )
 RETURNS jsonb
 LANGUAGE plpgsql
 AS $$
DECLARE
 server_version float;
BEGIN
 server_version =(
 SELECT
 (SPLIT_PART((
 SELECT
 version()), ' ', 2))::float);
 IF server_version >= 14 THEN
 RETURN jsonb_build_object('errors', jsonb_build_array(jsonb_build_object('message', 'pg_graphql extension is not enabled.')));
 ELSE
 RETURN jsonb_build_object('errors', jsonb_build_array(jsonb_build_object('message', 'pg_graphql is only available on projects running Postgres 14 onwards.')));
 END IF;
END;
 $$;
END IF;
END;
$_$;
 */
-- ALTER FUNCTION extensions.set_graphql_placeholder() OWNER TO supabase_admin;
--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--
-- COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';
--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: supabase_admin
--
CREATE FUNCTION pgbouncer.get_auth(p_usename text)
    RETURNS TABLE(
        username text,
        PASSWORD text)
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $_$
BEGIN
    RAISE debug 'PgBouncer auth request: %',
    p_usename;
    RETURN query
    SELECT
        rolname::text,
        CASE WHEN rolvaliduntil < now() THEN
            NULL
        ELSE
            rolpassword::text
        END
    FROM
        pg_authid
    WHERE
        rolname = $1
        AND rolcanlogin;
END;
$_$;

ALTER FUNCTION pgbouncer.get_auth(p_usename text) OWNER TO supabase_admin;

--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--
CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT(1024 * 1024))
    RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Regclass of the table e.g. public.notes
    entity_ regclass =(quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;
    -- I, U, D, T: insert, update ...
    action realtime.action =(
        CASE wal ->> 'action'
        WHEN 'I' THEN
            'INSERT'
        WHEN 'U' THEN
            'UPDATE'
        WHEN 'D' THEN
            'DELETE'
        ELSE
            'ERROR'
        END);
    -- Is row level security enabled for the table
    is_rls_enabled bool = relrowsecurity
FROM
    pg_class
WHERE
    oid = entity_;
    subscriptions realtime.subscription[] = array_agg(subs)
FROM
    realtime.subscription subs
WHERE
    subs.entity = entity_;
    -- Subscription vars
    roles regrole[] = array_agg(DISTINCT us.claims_role::text)
FROM
    unnest(subscriptions) us;
    working_role regrole;
    claimed_role regrole;
    claims jsonb;
    subscription_id uuid;
    subscription_has_access bool;
    visible_to_subscription_ids uuid[] = '{}';
    -- structured info for wal's columns
    columns realtime.wal_column[];
    -- previous identity values for update/delete
    old_columns realtime.wal_column[];
    error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;
    -- Primary jsonb output for record
    output jsonb;
BEGIN
    PERFORM
        set_config('role', NULL, TRUE);
    columns = array_agg((x ->> 'name', x ->> 'type', x ->> 'typeoid', realtime.cast((x -> 'value') #>> '{}', coalesce((x ->> 'typeoid')::regtype, -- null when wal2json version <= 2.4
(x ->> 'type')::regtype)),(pks ->> 'name') IS NOT NULL, TRUE)::realtime.wal_column)
FROM
    jsonb_array_elements(wal -> 'columns') x
    LEFT JOIN jsonb_array_elements(wal -> 'pk') pks ON (x ->> 'name') =(pks ->> 'name');
    old_columns = array_agg((x ->> 'name', x ->> 'type', x ->> 'typeoid', realtime.cast((x -> 'value') #>> '{}', coalesce((x ->> 'typeoid')::regtype, -- null when wal2json version <= 2.4
(x ->> 'type')::regtype)),(pks ->> 'name') IS NOT NULL, TRUE)::realtime.wal_column)
FROM
    jsonb_array_elements(wal -> 'identity') x
    LEFT JOIN jsonb_array_elements(wal -> 'pk') pks ON (x ->> 'name') =(pks ->> 'name');
    FOR working_role IN
    SELECT
        *
    FROM
        unnest(roles)
        LOOP
            -- Update `is_selectable` for columns and old_columns
            columns = array_agg((c.name, c.type_name, c.type_oid, c.value, c.is_pkey, pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT'))::realtime.wal_column)
        FROM
            unnest(columns) c;
            old_columns = array_agg((c.name, c.type_name, c.type_oid, c.value, c.is_pkey, pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT'))::realtime.wal_column)
        FROM
            unnest(old_columns) c;
            IF action <> 'DELETE' AND count(1) = 0
            FROM
                unnest(columns) c
WHERE
    c.is_pkey THEN
                RETURN NEXT (jsonb_build_object('schema', wal ->> 'schema', 'table', wal ->> 'table', 'type', action), is_rls_enabled,
                    -- subscriptions is already filtered by entity
(
                        SELECT
                            array_agg(s.subscription_id)
                        FROM unnest(subscriptions) AS s
                        WHERE
                            claims_role = working_role), ARRAY['Error 400: Bad Request, no primary key'])::realtime.wal_rls;
                -- The claims role does not have SELECT permission to the primary key of entity
            ELSIF action <> 'DELETE'
                    AND sum(c.is_selectable::int) <> count(1)
                FROM
                    unnest(columns) c
WHERE
    c.is_pkey THEN
    RETURN NEXT (jsonb_build_object('schema', wal ->> 'schema', 'table', wal ->> 'table', 'type', action), is_rls_enabled,(
            SELECT
                array_agg(s.subscription_id)
            FROM
                unnest(subscriptions) AS s
            WHERE
                claims_role = working_role), ARRAY['Error 401: Unauthorized'])::realtime.wal_rls;
            ELSE
                output = jsonb_build_object('schema', wal ->> 'schema', 'table', wal ->> 'table', 'type', action, 'commit_timestamp', to_char(((wal ->> 'timestamp')::timestamptz at time zone 'utc'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'columns',(
                SELECT
                    jsonb_agg(jsonb_build_object('name', pa.attname, 'type', pt.typname)
                ORDER BY pa.attnum ASC)
                FROM pg_attribute pa
                JOIN pg_type pt ON pa.atttypid = pt.oid
                WHERE
                    attrelid = entity_
                    AND attnum > 0
                    AND pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')))
                -- Add "record" key for insert and update
                || CASE WHEN action IN ('INSERT', 'UPDATE') THEN
                    jsonb_build_object('record',(
                            SELECT
                                jsonb_object_agg(
                                    -- if unchanged toast, get column name and value from old record
                                    coalesce((c).name,(oc).name), CASE WHEN (c).name IS NULL THEN
                                    (oc).value
                                ELSE
                                    (c).value
                                END)
                        FROM unnest(columns) c
                    FULL OUTER JOIN unnest(old_columns) oc ON (c).name =(oc).name
                WHERE
                    coalesce((c).is_selectable,(oc).is_selectable)
                    AND (NOT error_record_exceeds_max_size
                        OR (octet_length((c).value::text) <= 64))))
                ELSE
                    '{}'::jsonb
                END
                -- Add "old_record" key for update and delete
                || CASE WHEN action = 'UPDATE' THEN
                    jsonb_build_object('old_record',(
                            SELECT
                                jsonb_object_agg((c).name,(c).value)
                        FROM unnest(old_columns) c
                    WHERE (c).is_selectable
                    AND (NOT error_record_exceeds_max_size
                        OR (octet_length((c).value::text) <= 64))))
                WHEN action = 'DELETE' THEN
                    jsonb_build_object('old_record',(
                            SELECT
                                jsonb_object_agg((c).name,(c).value)
                        FROM unnest(old_columns) c
                    WHERE (c).is_selectable
                    AND (NOT error_record_exceeds_max_size
                        OR (octet_length((c).value::text) <= 64))
                    AND (NOT is_rls_enabled
                        OR (c).is_pkey) -- if RLS enabled, we can't secure deletes so filter to pkey
))
                ELSE
                    '{}'::jsonb
                END;
                -- Create the prepared statement
                IF is_rls_enabled AND action <> 'DELETE' THEN
                    IF (
                        SELECT
                            1
                        FROM
                            pg_prepared_statements
                        WHERE
                            name = 'walrus_rls_stmt'
                        LIMIT 1) > 0 THEN
                        DEALLOCATE walrus_rls_stmt;
                    END IF;
                    EXECUTE realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
                END IF;
                visible_to_subscription_ids = '{}';
                FOR subscription_id,
                claims IN (
                    SELECT
                        subs.subscription_id,
                        subs.claims
                    FROM
                        unnest(subscriptions) subs
                    WHERE
                        subs.entity = entity_
                        AND subs.claims_role = working_role
                        AND (realtime.is_visible_through_filters(columns, subs.filters)
                            OR (action = 'DELETE'
                                AND realtime.is_visible_through_filters(old_columns, subs.filters))))
                    LOOP
                        IF NOT is_rls_enabled OR action = 'DELETE' THEN
                            visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
                        ELSE
                            -- Check if RLS allows the role to see the record
                            PERFORM
                                -- Trim leading and trailing quotes from working_role because set_config
                                -- doesn't recognize the role as valid if they are included
                                set_config('role', trim(BOTH '"' FROM working_role::text), TRUE),
                                set_config('request.jwt.claims', claims::text, TRUE);
                            EXECUTE 'execute walrus_rls_stmt' INTO subscription_has_access;
                            IF subscription_has_access THEN
                                visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
                            END IF;
                        END IF;
                    END LOOP;
                PERFORM
                    set_config('role', NULL, TRUE);
                RETURN NEXT (output,
                    is_rls_enabled,
                    visible_to_subscription_ids,
                    CASE WHEN error_record_exceeds_max_size THEN
                        ARRAY['Error 413: Payload Too Large']
                    ELSE
                        '{}'
                    END)::realtime.wal_rls;
            END IF;
        END LOOP;
    PERFORM
        set_config('role', NULL, TRUE);
END;
$$;

ALTER FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) OWNER TO supabase_admin;

--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--
CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW' ::text)
    RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM
            realtime.send(row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;

ALTER FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) OWNER TO supabase_admin;

--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--
CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[])
    RETURNS text
    LANGUAGE sql
    AS $$
    /*
     Builds a sql string that, if executed, creates a prepared statement to
     tests retrive a row from *entity* by its primary key columns.
     Example
     select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
     */
    SELECT
        'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}'), ' and ') || '
              )'
    FROM
        unnest(columns) pkc
WHERE
    pkc.is_pkey
GROUP BY
    entity
$$;

ALTER FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) OWNER TO supabase_admin;

--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--
CREATE FUNCTION realtime."cast"(val text, type_ regtype)
    RETURNS jsonb
    LANGUAGE plpgsql
    IMMUTABLE
    AS $$
DECLARE
    res jsonb;
BEGIN
    EXECUTE format('select to_jsonb(%L::' || type_::text || ')', val) INTO res;
    RETURN res;
END
$$;

ALTER FUNCTION realtime."cast"(val text, type_ regtype) OWNER TO supabase_admin;

--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--
CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text)
    RETURNS boolean
    LANGUAGE plpgsql
    IMMUTABLE
    AS $$
/*
 Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
 */
DECLARE
    op_symbol text =(
        CASE WHEN op = 'eq' THEN
            '='
        WHEN op = 'neq' THEN
            '!='
        WHEN op = 'lt' THEN
            '<'
        WHEN op = 'lte' THEN
            '<='
        WHEN op = 'gt' THEN
            '>'
        WHEN op = 'gte' THEN
            '>='
        WHEN op = 'in' THEN
            '= any'
        ELSE
            'UNKNOWN OP'
        END);
    res boolean;
BEGIN
    EXECUTE format('select %L::' || type_::text || ' ' || op_symbol || ' ( %L::' ||(
            CASE WHEN op = 'in' THEN
                type_::text || '[]'
            ELSE
                type_::text
            END) || ')', val_1, val_2) INTO res;
    RETURN res;
END;
$$;

ALTER FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) OWNER TO supabase_admin;

--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--
CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[])
    RETURNS boolean
    LANGUAGE sql
    IMMUTABLE
    AS $_$
    /*
     Should the record be visible (true) or filtered out (false) after *filters* are applied
     */
    SELECT
        -- Default to allowed when no filters present
        $2 IS NULL -- no filters. this should not happen because subscriptions has a default
        OR array_length($2, 1) IS NULL -- array length of an empty array is null
        OR bool_and(coalesce(realtime.check_equality_op(op := f.op, type_ := coalesce(col.type_oid::regtype, -- null when wal2json version <= 2.4
                        col.type_name::regtype),
                    -- cast jsonb to text
                    val_1 := col.value #>> '{}', val_2 := f.value), FALSE -- if null, filter does not match
))
    FROM
        unnest(filters) f
    JOIN unnest(columns) col ON f.column_name = col.name;
$_$;

ALTER FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) OWNER TO supabase_admin;

--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--
CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer)
    RETURNS SETOF realtime.wal_rls
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
    WITH pub AS(
        SELECT
            concat_ws(',', CASE WHEN bool_or(pubinsert) THEN
                    'insert'
                ELSE
                    NULL
                END, CASE WHEN bool_or(pubupdate) THEN
                    'update'
                ELSE
                    NULL
                END, CASE WHEN bool_or(pubdelete) THEN
                    'delete'
                ELSE
                    NULL
                END) AS w2j_actions,
            coalesce(string_agg(realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass), ',') FILTER(WHERE ppt.tablename IS NOT NULL
                    AND ppt.tablename NOT LIKE '% %'), '') w2j_add_tables
        FROM
            pg_publication pp
        LEFT JOIN pg_publication_tables ppt ON pp.pubname = ppt.pubname
    WHERE
        pp.pubname = publication
    GROUP BY
        pp.pubname
    LIMIT 1
),
w2j AS(
    SELECT
        x.*,
        pub.w2j_add_tables
    FROM
        pub,
        pg_logical_slot_get_changes(slot_name, NULL, max_changes, 'include-pk', 'true', 'include-transaction', 'false', 'include-timestamp', 'true', 'include-type-oids', 'true', 'format-version', '2', 'actions', pub.w2j_actions, 'add-tables', pub.w2j_add_tables) x
)
SELECT
    xyz.wal,
    xyz.is_rls_enabled,
    xyz.subscription_ids,
    xyz.errors
FROM
    w2j,
    realtime.apply_rls(wal := w2j.data::jsonb, max_record_bytes := max_record_bytes) xyz(wal, is_rls_enabled, subscription_ids, errors)
WHERE
    w2j.w2j_add_tables <> ''
    AND xyz.subscription_ids[1] IS NOT NULL
$$;

ALTER FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) OWNER TO supabase_admin;

--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--
CREATE FUNCTION realtime.quote_wal2json(entity regclass)
    RETURNS text
    LANGUAGE sql
    IMMUTABLE STRICT
    AS $$
    SELECT
(
            SELECT
                string_agg('' || ch, '')
            FROM
                unnest(string_to_array(nsp.nspname::text, NULL))
                WITH ORDINALITY x(ch, idx)
            WHERE
                NOT(x.idx = 1
                    AND x.ch = '"')
                AND NOT(x.idx = array_length(string_to_array(nsp.nspname::text, NULL), 1)
                    AND x.ch = '"')) || '.' ||(
            SELECT
                string_agg('' || ch, '')
            FROM
                unnest(string_to_array(pc.relname::text, NULL))
                WITH ORDINALITY x(ch, idx)
            WHERE
                NOT(x.idx = 1
                    AND x.ch = '"')
                AND NOT(x.idx = array_length(string_to_array(nsp.nspname::text, NULL), 1)
                    AND x.ch = '"'))
    FROM
        pg_class pc
        JOIN pg_namespace nsp ON pc.relnamespace = nsp.oid
    WHERE
        pc.oid = entity
$$;

ALTER FUNCTION realtime.quote_wal2json(entity regclass) OWNER TO supabase_admin;

--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--
CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT TRUE)
    RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    BEGIN
        -- Set the topic configuration
        EXECUTE format('SET LOCAL realtime.topic TO %L', topic);
        -- Attempt to insert the message
        INSERT INTO realtime.messages(payload, event, topic, private, extension)
            VALUES(payload, event, topic, private, 'broadcast');
    EXCEPTION
        WHEN OTHERS THEN
            -- Capture and notify the error
            RAISE WARNING 'ErrorSendingBroadcastMessage: %', SQLERRM;
    END;
END;

$$;

ALTER FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) OWNER TO supabase_admin;

--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--
CREATE FUNCTION realtime.subscription_check_filters()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
/*
 Validates that the user defined filters for a subscription:
 - refer to valid columns that the claimed role may access
 - values are coercable to the correct column type
 */
DECLARE
    col_names text[] = coalesce(array_agg(c.column_name ORDER BY c.ordinal_position), '{}'::text[])
FROM
    information_schema.columns c
WHERE
    format('%I.%I', c.table_schema, c.table_name)::regclass = NEW.entity
    AND pg_catalog.has_column_privilege((NEW.claims ->> 'role'), format('%I.%I', c.table_schema, c.table_name)::regclass, c.column_name, 'SELECT');
    FILTER realtime.user_defined_filter;
    col_type regtype;
    in_val jsonb;
BEGIN
    FOR FILTER IN
    SELECT
        *
    FROM
        unnest(NEW.filters)
        LOOP
            -- Filtered column is valid
            IF NOT filter.column_name = ANY (col_names) THEN
                RAISE EXCEPTION 'invalid column for filter %', filter.column_name;
            END IF;
            -- Type is sanitized and safe for string interpolation
            col_type =(
                SELECT
                    atttypid::regtype
                FROM
                    pg_catalog.pg_attribute
                WHERE
                    attrelid = NEW.entity
                    AND attname = filter.column_name);
            IF col_type IS NULL THEN
                RAISE EXCEPTION 'failed to lookup type for column %', filter.column_name;
            END IF;
            -- Set maximum number of entries for in filter
            IF filter.op = 'in'::realtime.equality_op THEN
                in_val = realtime.cast(filter.value,(col_type::text || '[]')::regtype);
                IF coalesce(jsonb_array_length(in_val), 0) > 100 THEN
                    RAISE EXCEPTION 'too many values for `in` filter. Maximum 100';
                END IF;
            ELSE
                -- raises an exception if value is not coercable to type
                PERFORM
                    realtime.cast(filter.value, col_type);
            END IF;
        END LOOP;
    -- Apply consistent order to filters so the unique constraint on
    -- (subscription_id, entity, filters) can't be tricked by a different filter order
    NEW.filters = coalesce(array_agg(f ORDER BY f.column_name, f.op, f.value), '{}')
FROM
    unnest(NEW.filters) f;
    RETURN new;
END;
$$;

ALTER FUNCTION realtime.subscription_check_filters() OWNER TO supabase_admin;

--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: supabase_admin
--
CREATE FUNCTION realtime.to_regrole (role_name text)
    RETURNS regrole
    LANGUAGE sql
    IMMUTABLE
    AS $$
    SELECT
        role_name::regrole
$$;

ALTER FUNCTION realtime.to_regrole(role_name text) OWNER TO supabase_admin;

--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--
CREATE FUNCTION realtime.topic()
    RETURNS text
    LANGUAGE sql
    STABLE
    AS $$
    SELECT
        nullif(current_setting('realtime.topic', TRUE), '')::text;
$$;

ALTER FUNCTION realtime.topic() OWNER TO supabase_realtime_admin;

--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--
CREATE FUNCTION storage.can_insert_object(bucketid text, name text, OWNER uuid, metadata jsonb)
    RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO "storage"."objects"("bucket_id", "name", "owner", "metadata")
        VALUES(bucketid, name, owner, metadata);
    -- hack to rollback the successful insert
    RAISE sqlstate 'PT200'
    USING message = 'ROLLBACK', detail = 'rollback successful insert';
END
$$;

ALTER FUNCTION storage.can_insert_object(bucketid text, name text, OWNER uuid, metadata jsonb) OWNER TO supabase_storage_admin;

--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--
CREATE FUNCTION storage.extension(name text)
    RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    SELECT
        string_to_array(name, '/') INTO _parts;
    SELECT
        _parts[array_length(_parts, 1)] INTO _filename;
    -- @todo return the last part instead of 2
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;

ALTER FUNCTION storage.extension(name text) OWNER TO supabase_storage_admin;

--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--
CREATE FUNCTION storage.filename(name text)
    RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    _parts text[];
BEGIN
    SELECT
        string_to_array(name, '/') INTO _parts;
    RETURN _parts[array_length(_parts, 1)];
END
$$;

ALTER FUNCTION storage.filename(name text) OWNER TO supabase_storage_admin;

--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--
CREATE FUNCTION storage.foldername(name text)
    RETURNS text[]
    LANGUAGE plpgsql
    AS $$
DECLARE
    _parts text[];
BEGIN
    SELECT
        string_to_array(name, '/') INTO _parts;
    RETURN _parts[1:array_length(_parts, 1) - 1];
END
$$;

ALTER FUNCTION storage.foldername(name text) OWNER TO supabase_storage_admin;

--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--
CREATE FUNCTION storage.get_size_by_bucket()
    RETURNS TABLE(
        size bigint,
        bucket_id text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN query
    SELECT
        sum((metadata ->> 'size')::int) AS size,
        obj.bucket_id
    FROM
        "storage".objects AS obj
    GROUP BY
        obj.bucket_id;
END
$$;

ALTER FUNCTION storage.get_size_by_bucket() OWNER TO supabase_storage_admin;

--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--
CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text)
    RETURNS TABLE(
        key text,
        id text,
        created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE 'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
    USING prefix_param,
    delimiter_param,
    max_keys,
    next_key_token,
    bucket_id,
    next_upload_token;
END;
$_$;

ALTER FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer, next_key_token text, next_upload_token text) OWNER TO supabase_storage_admin;

--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--
CREATE FUNCTION storage.list_objects_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text)
    RETURNS TABLE(
        name text,
        id uuid,
        metadata jsonb,
        updated_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE 'SELECT DISTINCT ON(name COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                        substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1)))
                    ELSE
                        name
                END AS name, id, metadata, updated_at
            FROM
                storage.objects
            WHERE
                bucket_id = $5 AND
                name ILIKE $1 || ''%'' AND
                CASE
                    WHEN $6 != '''' THEN
                    name COLLATE "C" > $6
                ELSE true END
                AND CASE
                    WHEN $4 != '''' THEN
                        CASE
                            WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                                substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                name COLLATE "C" > $4
                            END
                    ELSE
                        true
                END
            ORDER BY
                name COLLATE "C" ASC) as e order by name COLLATE "C" LIMIT $3'
    USING prefix_param,
    delimiter_param,
    max_keys,
    next_token,
    bucket_id,
    start_after;
END;
$_$;

ALTER FUNCTION storage.list_objects_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer, start_after text, next_token text) OWNER TO supabase_storage_admin;

--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--
CREATE FUNCTION storage.operation()
    RETURNS text
    LANGUAGE plpgsql
    STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', TRUE);
END;
$$;

ALTER FUNCTION storage.operation() OWNER TO supabase_storage_admin;

--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--
CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name' ::text, sortorder text DEFAULT 'asc' ::text)
    RETURNS TABLE(
        name text,
        id uuid,
        updated_at timestamp with time zone,
        created_at timestamp with time zone,
        last_accessed_at timestamp with time zone,
        metadata jsonb)
    LANGUAGE plpgsql
    STABLE
    AS $_$
DECLARE
    v_order_by text;
    v_sort_order text;
BEGIN
    CASE WHEN sortcolumn = 'name' THEN
        v_order_by = 'name';
    WHEN sortcolumn = 'updated_at' THEN
        v_order_by = 'updated_at';
    WHEN sortcolumn = 'created_at' THEN
        v_order_by = 'created_at';
    WHEN sortcolumn = 'last_accessed_at' THEN
        v_order_by = 'last_accessed_at';
    ELSE
        v_order_by = 'name';
    END CASE;
    CASE WHEN sortorder = 'asc' THEN
        v_sort_order = 'asc';
    WHEN sortorder = 'desc' THEN
        v_sort_order = 'desc';
    ELSE
        v_sort_order = 'asc';
    END CASE;
    v_order_by = v_order_by || ' ' || v_sort_order; RETURN query EXECUTE 'with folders as (
       select path_tokens[$1] as folder
       from storage.objects
         where objects.name ilike $2 || $3 || ''%''
           and bucket_id = $4
           and array_length(objects.path_tokens, 1) <> $1
       group by folder
       order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6'
    USING levels, prefix, search, bucketname, limits, offsets;
    END;
$_$; ALTER FUNCTION storage.search(prefix text, bucketname text, limits integer, levels integer, offsets integer, search text, sortcolumn text, sortorder text) OWNER TO supabase_storage_admin;
--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--
CREATE FUNCTION storage.update_updated_at_column()
    RETURNS TRIGGER LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now(); RETURN NEW;
    END;

$$;

ALTER FUNCTION storage.update_updated_at_column() OWNER TO supabase_storage_admin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--
CREATE TABLE auth.audit_log_entries(
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);

ALTER TABLE auth.audit_log_entries OWNER TO supabase_auth_admin;

--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--
COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';

--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--
CREATE TABLE auth.flow_state(
    id uuid NOT NULL,
    user_id uuid,
    auth_code text NOT NULL,
    code_challenge_method auth.code_challenge_method NOT NULL,
    code_challenge text NOT NULL,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone
);

ALTER TABLE auth.flow_state OWNER TO supabase_auth_admin;

--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--
COMMENT ON TABLE auth.flow_state IS 'stores metadata for pkce logins';

--
-- Name: identities; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--
CREATE TABLE auth.identities(
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS(lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);

ALTER TABLE auth.identities OWNER TO supabase_auth_admin;

--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--
COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';

--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--
COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';

--
-- Name: instances; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--
CREATE TABLE auth.instances(
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

ALTER TABLE auth.instances OWNER TO supabase_auth_admin;

--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--
COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';

--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--
CREATE TABLE auth.mfa_amr_claims(
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);

ALTER TABLE auth.mfa_amr_claims OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--
COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';

--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--
CREATE TABLE auth.mfa_challenges(
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);

ALTER TABLE auth.mfa_challenges OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--
COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';

--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--
CREATE TABLE auth.mfa_factors(
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid
);

ALTER TABLE auth.mfa_factors OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--
COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';

--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--
CREATE TABLE auth.one_time_tokens(
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK((char_length(token_hash) > 0))
);

ALTER TABLE auth.one_time_tokens OWNER TO supabase_auth_admin;

--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--
CREATE TABLE auth.refresh_tokens(
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id uuid, --character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);

ALTER TABLE auth.refresh_tokens OWNER TO supabase_auth_admin;

--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--
COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: supabase_auth_admin
--
CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE auth.refresh_tokens_id_seq
    OWNER TO supabase_auth_admin;

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: supabase_auth_admin
--
ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;

--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--
CREATE TABLE auth.saml_providers(
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK(((metadata_url = NULL::text) OR(char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK((char_length(metadata_xml) > 0))
);

ALTER TABLE auth.saml_providers OWNER TO supabase_auth_admin;

--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--
COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';

--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--
CREATE TABLE auth.saml_relay_states(
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK((char_length(request_id) > 0))
);

ALTER TABLE auth.saml_relay_states OWNER TO supabase_auth_admin;

--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--
COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';

--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--
CREATE TABLE auth.schema_migrations(
    version character varying(255) NOT NULL
);

ALTER TABLE auth.schema_migrations OWNER TO supabase_auth_admin;

--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--
COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';

--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--
CREATE TABLE auth.sessions(
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text
);

ALTER TABLE auth.sessions OWNER TO supabase_auth_admin;

--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--
COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';

--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--
COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';

--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--
CREATE TABLE auth.sso_domains(
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    DOMAIN text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK((char_length(DOMAIN) > 0))
);

ALTER TABLE auth.sso_domains OWNER TO supabase_auth_admin;

--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--
COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';

--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--
CREATE TABLE auth.sso_providers(
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK(((resource_id = NULL::text) OR(char_length(resource_id) > 0)))
);

ALTER TABLE auth.sso_providers OWNER TO supabase_auth_admin;

--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--
COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';

--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--
COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';

--
-- Name: users; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--
CREATE TABLE auth.users(
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    ROLE character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS(LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT FALSE NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT FALSE NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK(((email_change_confirm_status >= 0) AND(email_change_confirm_status <= 2)))
);

ALTER TABLE auth.users OWNER TO supabase_auth_admin;

--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--
COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';

--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--
COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';

--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: supabase_realtime_admin
--
CREATE TABLE realtime.messages(
    topic text NOT NULL,
    EXTENSION text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT FALSE,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
)
PARTITION BY RANGE(inserted_at);

ALTER TABLE realtime.messages OWNER TO supabase_realtime_admin;

--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: supabase_admin
--
CREATE TABLE realtime.schema_migrations(
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);

ALTER TABLE realtime.schema_migrations OWNER TO supabase_admin;

--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: supabase_admin
--
CREATE TABLE realtime.subscription(
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}' ::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS(realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE realtime.subscription OWNER TO supabase_admin;

--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: supabase_admin
--
ALTER TABLE realtime.subscription
    ALTER COLUMN id
    ADD GENERATED ALWAYS AS IDENTITY(SEQUENCE NAME
        realtime.subscription_id_seq START WITH 1 INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1);

--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--
CREATE TABLE storage.buckets(
    id text NOT NULL,
    name text NOT NULL,
    OWNER uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT FALSE,
    avif_autodetection boolean DEFAULT FALSE,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text
);

ALTER TABLE storage.buckets OWNER TO supabase_storage_admin;

--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: supabase_storage_admin
--
COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';

--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--
CREATE TABLE storage.migrations(
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE storage.migrations OWNER TO supabase_storage_admin;

--
-- Name: objects; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--
CREATE TABLE storage.objects(
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    OWNER uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS(string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb
);

ALTER TABLE storage.objects OWNER TO supabase_storage_admin;

--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: supabase_storage_admin
--
COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';

--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--
CREATE TABLE storage.s3_multipart_uploads(
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb
);

ALTER TABLE storage.s3_multipart_uploads OWNER TO supabase_storage_admin;

--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--
CREATE TABLE storage.s3_multipart_uploads_parts(
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE storage.s3_multipart_uploads_parts OWNER TO supabase_storage_admin;

--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.refresh_tokens
    ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--
-- COPY auth.audit_log_entries (instance_id, id, payload, created_at, ip_address) FROM stdin;
-- \.
--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--
-- COPY auth.flow_state (id, user_id, auth_code, code_challenge_method, code_challenge, provider_type, provider_access_token, provider_refresh_token, created_at, updated_at, authentication_method, auth_code_issued_at) FROM stdin;
-- \.
--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--
-- COPY auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id) FROM stdin;
-- \.
--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--
-- COPY auth.instances (id, uuid, raw_base_config, created_at, updated_at) FROM stdin;
-- \.
--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--
-- COPY auth.mfa_amr_claims (session_id, created_at, updated_at, authentication_method, id) FROM stdin;
-- \.
--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--
-- COPY auth.mfa_challenges (id, factor_id, created_at, verified_at, ip_address, otp_code, web_authn_session_data) FROM stdin;
-- \.
--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--
-- COPY auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret, phone, last_challenged_at, web_authn_credential, web_authn_aaguid) FROM stdin;
-- \.
--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--
-- COPY auth.one_time_tokens (id, user_id, token_type, token_hash, relates_to, created_at, updated_at) FROM stdin;
-- \.
--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--
-- COPY auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) FROM stdin;
-- \.
--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--
-- COPY auth.saml_providers (id, sso_provider_id, entity_id, metadata_xml, metadata_url, attribute_mapping, created_at, updated_at, name_id_format) FROM stdin;
-- \.
--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--
-- COPY auth.saml_relay_states (id, sso_provider_id, request_id, for_email, redirect_to, created_at, updated_at, flow_state_id) FROM stdin;
-- \.
--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--
/*
COPY auth.schema_migrations (version) FROM stdin;
20171026211738
20171026211808
20171026211834
20180103212743
20180108183307
20180119214651
20180125194653
00
20210710035447
20210722035447
20210730183235
20210909172000
20210927181326
20211122151130
20211124214934
20211202183645
20220114185221
20220114185340
20220224000811
20220323170000
20220429102000
20220531120530
20220614074223
20220811173540
20221003041349
20221003041400
20221011041400
20221020193600
20221021073300
20221021082433
20221027105023
20221114143122
20221114143410
20221125140132
20221208132122
20221215195500
20221215195800
20221215195900
20230116124310
20230116124412
20230131181311
20230322519590
20230402418590
20230411005111
20230508135423
20230523124323
20230818113222
20230914180801
20231027141322
20231114161723
20231117164230
20240115144230
20240214120130
20240306115329
20240314092811
20240427152123
20240612123726
20240729123726
20240802193726
20240806073726
20241009103726
20250717082212
\.
 */
--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--
-- COPY auth.sessions (id, user_id, created_at, updated_at, factor_id, aal, not_after, refreshed_at, user_agent, ip, tag) FROM stdin;
-- \.
--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--
-- COPY auth.sso_domains (id, sso_provider_id, domain, created_at, updated_at) FROM stdin;
-- \.
--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--
-- COPY auth.sso_providers (id, resource_id, created_at, updated_at, disabled) FROM stdin;
-- \.
--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--
-- COPY auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) FROM stdin;
-- \.
--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: realtime; Owner: supabase_admin
--
/*
COPY realtime.schema_migrations (version, inserted_at) FROM stdin;
20211116024918	2025-08-15 15:43:08
20211116045059	2025-08-15 15:43:10
20211116050929	2025-08-15 15:43:12
20211116051442	2025-08-15 15:43:14
20211116212300	2025-08-15 15:43:16
20211116213355	2025-08-15 15:43:18
20211116213934	2025-08-15 15:43:20
20211116214523	2025-08-15 15:43:22
20211122062447	2025-08-15 15:43:24
20211124070109	2025-08-15 15:43:26
20211202204204	2025-08-15 15:43:27
20211202204605	2025-08-15 15:43:29
20211210212804	2025-08-15 15:43:35
20211228014915	2025-08-15 15:43:36
20220107221237	2025-08-15 15:43:38
20220228202821	2025-08-15 15:43:40
20220312004840	2025-08-15 15:43:42
20220603231003	2025-08-15 15:43:44
20220603232444	2025-08-15 15:43:46
20220615214548	2025-08-15 15:43:48
20220712093339	2025-08-15 15:43:50
20220908172859	2025-08-15 15:43:52
20220916233421	2025-08-15 15:43:53
20230119133233	2025-08-15 15:43:55
20230128025114	2025-08-15 15:43:58
20230128025212	2025-08-15 15:43:59
20230227211149	2025-08-15 15:44:01
20230228184745	2025-08-15 15:44:03
20230308225145	2025-08-15 15:44:05
20230328144023	2025-08-15 15:44:06
20231018144023	2025-08-15 15:44:08
20231204144023	2025-08-15 15:44:11
20231204144024	2025-08-15 15:44:13
20231204144025	2025-08-15 15:44:15
20240108234812	2025-08-15 15:44:16
20240109165339	2025-08-15 15:44:18
20240227174441	2025-08-15 15:44:21
20240311171622	2025-08-15 15:44:24
20240321100241	2025-08-15 15:44:27
20240401105812	2025-08-15 15:44:32
20240418121054	2025-08-15 15:44:35
20240523004032	2025-08-15 15:44:41
20240618124746	2025-08-15 15:44:43
20240801235015	2025-08-15 15:44:44
20240805133720	2025-08-15 15:44:46
20240827160934	2025-08-15 15:44:48
20240919163303	2025-08-15 15:44:50
20240919163305	2025-08-15 15:44:52
20241019105805	2025-08-15 15:44:54
20241030150047	2025-08-15 15:45:00
20241108114728	2025-08-15 15:45:03
20241121104152	2025-08-15 15:45:04
20241130184212	2025-08-15 15:45:07
20241220035512	2025-08-15 15:45:08
20241220123912	2025-08-15 15:45:10
20241224161212	2025-08-15 15:45:12
20250107150512	2025-08-15 15:45:13
20250110162412	2025-08-15 15:45:15
20250123174212	2025-08-15 15:45:17
20250128220012	2025-08-15 15:45:19
20250506224012	2025-08-15 15:45:20
20250523164012	2025-08-15 15:45:22
20250714121412	2025-08-15 15:45:24
\.
 */
--
-- Data for Name: subscription; Type: TABLE DATA; Schema: realtime; Owner: supabase_admin
--
-- COPY realtime.subscription (id, subscription_id, entity, filters, claims, created_at) FROM stdin;
-- \.
--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--
-- COPY storage.buckets (id, name, owner, created_at, updated_at, public, avif_autodetection, file_size_limit, allowed_mime_types, owner_id) FROM stdin;
-- \.
--
-- Data for Name: migrations; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--
/*
COPY storage.migrations (id, name, hash, executed_at) FROM stdin;
0	create-migrations-table	e18db593bcde2aca2a408c4d1100f6abba2195df	2025-08-15 15:40:33.621999
1	initialmigration	6ab16121fbaa08bbd11b712d05f358f9b555d777	2025-08-15 15:40:33.933175
2	storage-schema	5c7968fd083fcea04050c1b7f6253c9771b99011	2025-08-15 15:40:34.022379
3	pathtoken-column	2cb1b0004b817b29d5b0a971af16bafeede4b70d	2025-08-15 15:40:34.108439
4	add-migrations-rls	427c5b63fe1c5937495d9c635c263ee7a5905058	2025-08-15 15:40:34.524389
5	add-size-functions	79e081a1455b63666c1294a440f8ad4b1e6a7f84	2025-08-15 15:40:34.540162
6	change-column-name-in-get-size	f93f62afdf6613ee5e7e815b30d02dc990201044	2025-08-15 15:40:34.547064
7	add-rls-to-buckets	e7e7f86adbc51049f341dfe8d30256c1abca17aa	2025-08-15 15:40:34.553085
8	add-public-to-buckets	fd670db39ed65f9d08b01db09d6202503ca2bab3	2025-08-15 15:40:34.558857
9	fix-search-function	3a0af29f42e35a4d101c259ed955b67e1bee6825	2025-08-15 15:40:34.566919
10	search-files-search-function	68dc14822daad0ffac3746a502234f486182ef6e	2025-08-15 15:40:34.574043
11	add-trigger-to-auto-update-updated_at-column	7425bdb14366d1739fa8a18c83100636d74dcaa2	2025-08-15 15:40:34.582633
12	add-automatic-avif-detection-flag	8e92e1266eb29518b6a4c5313ab8f29dd0d08df9	2025-08-15 15:40:34.606856
13	add-bucket-custom-limits	cce962054138135cd9a8c4bcd531598684b25e7d	2025-08-15 15:40:34.612847
14	use-bytes-for-max-size	941c41b346f9802b411f06f30e972ad4744dad27	2025-08-15 15:40:34.619019
15	add-can-insert-object-function	934146bc38ead475f4ef4b555c524ee5d66799e5	2025-08-15 15:40:34.708808
16	add-version	76debf38d3fd07dcfc747ca49096457d95b1221b	2025-08-15 15:40:34.730991
17	drop-owner-foreign-key	f1cbb288f1b7a4c1eb8c38504b80ae2a0153d101	2025-08-15 15:40:34.738485
18	add_owner_id_column_deprecate_owner	e7a511b379110b08e2f214be852c35414749fe66	2025-08-15 15:40:34.756407
19	alter-default-value-objects-id	02e5e22a78626187e00d173dc45f58fa66a4f043	2025-08-15 15:40:34.768982
20	list-objects-with-delimiter	cd694ae708e51ba82bf012bba00caf4f3b6393b7	2025-08-15 15:40:34.784586
21	s3-multipart-uploads	8c804d4a566c40cd1e4cc5b3725a664a9303657f	2025-08-15 15:40:34.795996
22	s3-multipart-uploads-big-ints	9737dc258d2397953c9953d9b86920b8be0cdb73	2025-08-15 15:40:34.846433
23	optimize-search-function	9d7e604cddc4b56a5422dc68c9313f4a1b6f132c	2025-08-15 15:40:34.880847
24	operation-function	8312e37c2bf9e76bbe841aa5fda889206d2bf8aa	2025-08-15 15:40:34.889093
25	custom-metadata	d974c6057c3db1c1f847afa0e291e6165693b990	2025-08-15 15:40:34.898616
\.
 */
--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--
-- COPY storage.objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata, version, owner_id, user_metadata) FROM stdin;
-- \.
--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--
-- COPY storage.s3_multipart_uploads (id, in_progress_size, upload_signature, bucket_id, key, version, owner_id, created_at, user_metadata) FROM stdin;
-- \.
--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--
-- COPY storage.s3_multipart_uploads_parts (id, upload_id, size, part_number, bucket_id, key, etag, owner_id, version, created_at) FROM stdin;
-- \.
--
-- Data for Name: secrets; Type: TABLE DATA; Schema: vault; Owner: supabase_admin
--
-- COPY vault.secrets (id, name, description, secret, key_id, nonce, created_at, updated_at) FROM stdin;
-- \.
--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--
SELECT
    pg_catalog.setval('auth.refresh_tokens_id_seq', 1, FALSE);

--
-- Name: subscription_id_seq; Type: SEQUENCE SET; Schema: realtime; Owner: supabase_admin
--
SELECT
    pg_catalog.setval('realtime.subscription_id_seq', 1, FALSE);

--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY(id);

--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY(id);

--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY(id);

--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY(id);

--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE(provider_id, provider);

--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY(id);

--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE(session_id, authentication_method);

--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY(id);

--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE(last_challenged_at);

--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY(id);

--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY(id);

--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY(id);

--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE(token);

--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE(entity_id);

--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY(id);

--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY(id);

--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY(version);

--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY(id);

--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY(id);

--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY(id);

--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE(phone);

--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY(id);

--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_realtime_admin
--
ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY(id, inserted_at);

--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--
ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY(id);

--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--
ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY(version);

--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--
ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY(id);

--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--
ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE(name);

--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--
ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY(id);

--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--
ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY(id);

--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--
ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY(id);

--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--
ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY(id);

--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree(instance_id);

--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree(confirmation_token)
WHERE((confirmation_token)::text !~ '^[0-9 ]*$'::text);

--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree(email_change_token_current)
WHERE((email_change_token_current)::text !~ '^[0-9 ]*$'::text);

--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree(email_change_token_new)
WHERE((email_change_token_new)::text !~ '^[0-9 ]*$'::text);

--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree(user_id, created_at);

--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree(created_at DESC);

--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE INDEX identities_email_idx ON auth.identities USING btree(email text_pattern_ops);

--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--
COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';

--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE INDEX identities_user_id_idx ON auth.identities USING btree(user_id);

--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE INDEX idx_auth_code ON auth.flow_state USING btree(auth_code);

--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree(user_id, authentication_method);

--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree(created_at DESC);

--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree(friendly_name, user_id)
WHERE(TRIM(BOTH FROM friendly_name) <> ''::text);

--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree(user_id);

--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING HASH(relates_to);

--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING HASH(token_hash);

--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree(user_id, token_type);

--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree(reauthentication_token)
WHERE((reauthentication_token)::text !~ '^[0-9 ]*$'::text);

--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree(recovery_token)
WHERE((recovery_token)::text !~ '^[0-9 ]*$'::text);

--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree(instance_id);

--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree(instance_id, user_id);

--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree(parent);

--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree(session_id, revoked);

--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree(updated_at DESC);

--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree(sso_provider_id);

--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree(created_at DESC);

--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree(for_email);

--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree(sso_provider_id);

--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree(not_after DESC);

--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree(user_id);

--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree(lower(DOMAIN));

--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree(sso_provider_id);

--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree(lower(resource_id));

--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree(resource_id text_pattern_ops);

--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree(user_id, phone);

--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree(user_id, created_at);

--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree(email)
WHERE(is_sso_user = FALSE);

--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--
COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';

--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE INDEX users_instance_id_email_idx ON auth.users USING btree(instance_id, lower((email)::text));

--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE INDEX users_instance_id_idx ON auth.users USING btree(instance_id);

--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--
CREATE INDEX users_is_anonymous_idx ON auth.users USING btree(is_anonymous);

--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: supabase_admin
--
CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree(entity);

--
-- Name: subscription_subscription_id_entity_filters_key; Type: INDEX; Schema: realtime; Owner: supabase_admin
--
CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_key ON realtime.subscription USING btree(subscription_id, entity, filters);

--
-- Name: bname; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--
CREATE UNIQUE INDEX bname ON storage.buckets USING btree(name);

--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--
CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree(bucket_id, name);

--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--
CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree(bucket_id, key, created_at);

--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--
CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree(bucket_id, name COLLATE "C");

--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--
CREATE INDEX name_prefix_search ON storage.objects USING btree(name text_pattern_ops);

--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: supabase_admin
--
CREATE TRIGGER tr_check_filters
    BEFORE INSERT OR UPDATE ON realtime.subscription
    FOR EACH ROW
    EXECUTE FUNCTION realtime.subscription_check_filters();

--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--
CREATE TRIGGER update_objects_updated_at
    BEFORE UPDATE ON storage.objects
    FOR EACH ROW
    EXECUTE FUNCTION storage.update_updated_at_column();

--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY(user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY(session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;

--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY(factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;

--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY(user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY(user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY(session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;

--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY(sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;

--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY(flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;

--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY(sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;

--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY(user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY(sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;

--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--
ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY(bucket_id) REFERENCES storage.buckets(id);

--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--
ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY(bucket_id) REFERENCES storage.buckets(id);

--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--
ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY(bucket_id) REFERENCES storage.buckets(id);

--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--
ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY(upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;

--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: supabase_realtime_admin
--
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--
ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--
ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--
ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: postgres
--
CREATE PUBLICATION supabase_realtime WITH(publish = 'insert, update, delete, truncate');

ALTER PUBLICATION supabase_realtime OWNER TO postgres;

--
-- Name: SCHEMA auth; Type: ACL; Schema: -; Owner: supabase_admin
--
GRANT USAGE ON SCHEMA auth TO anon;

GRANT USAGE ON SCHEMA auth TO authenticated;

GRANT USAGE ON SCHEMA auth TO service_role;

GRANT ALL ON SCHEMA auth TO supabase_auth_admin;

GRANT ALL ON SCHEMA auth TO dashboard_user;

GRANT USAGE ON SCHEMA auth TO postgres;

--
-- Name: SCHEMA extensions; Type: ACL; Schema: -; Owner: postgres
--
GRANT USAGE ON SCHEMA extensions TO anon;

GRANT USAGE ON SCHEMA extensions TO authenticated;

GRANT USAGE ON SCHEMA extensions TO service_role;

GRANT ALL ON SCHEMA extensions TO dashboard_user;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--
GRANT USAGE ON SCHEMA public TO postgres;

GRANT USAGE ON SCHEMA public TO anon;

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT USAGE ON SCHEMA public TO service_role;

--
-- Name: SCHEMA realtime; Type: ACL; Schema: -; Owner: supabase_admin
--
GRANT USAGE ON SCHEMA realtime TO postgres;

GRANT USAGE ON SCHEMA realtime TO anon;

GRANT USAGE ON SCHEMA realtime TO authenticated;

GRANT USAGE ON SCHEMA realtime TO service_role;

GRANT ALL ON SCHEMA realtime TO supabase_realtime_admin;

--
-- Name: SCHEMA storage; Type: ACL; Schema: -; Owner: supabase_admin
--
GRANT USAGE ON SCHEMA storage TO postgres WITH GRANT OPTION;

GRANT USAGE ON SCHEMA storage TO anon;

GRANT USAGE ON SCHEMA storage TO authenticated;

GRANT USAGE ON SCHEMA storage TO service_role;

GRANT ALL ON SCHEMA storage TO supabase_storage_admin;

GRANT ALL ON SCHEMA storage TO dashboard_user;

--
-- Name: SCHEMA vault; Type: ACL; Schema: -; Owner: supabase_admin
--
GRANT USAGE ON SCHEMA vault TO postgres WITH GRANT OPTION;

GRANT USAGE ON SCHEMA vault TO service_role;

--
-- Name: FUNCTION email(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--
GRANT ALL ON FUNCTION auth.email() TO dashboard_user;

--
-- Name: FUNCTION jwt(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--
GRANT ALL ON FUNCTION auth.jwt() TO postgres;

GRANT ALL ON FUNCTION auth.jwt() TO dashboard_user;

--
-- Name: FUNCTION role(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--
GRANT ALL ON FUNCTION auth.role() TO dashboard_user;

--
-- Name: FUNCTION uid(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--
GRANT ALL ON FUNCTION auth.uid() TO dashboard_user;

--
-- Name: FUNCTION armor(bytea); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.armor(bytea) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.armor(bytea) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.armor(bytea) TO dashboard_user;
--
-- Name: FUNCTION armor(bytea, text[], text[]); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.armor(bytea, text[], text[]) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.armor(bytea, text[], text[]) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.armor(bytea, text[], text[]) TO dashboard_user;
--
-- Name: FUNCTION crypt(text, text); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.crypt(text, text) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.crypt(text, text) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.crypt(text, text) TO dashboard_user;
--
-- Name: FUNCTION dearmor(text); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.dearmor(text) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.dearmor(text) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.dearmor(text) TO dashboard_user;
--
-- Name: FUNCTION decrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) TO dashboard_user;
--
-- Name: FUNCTION decrypt_iv(bytea, bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) TO dashboard_user;
--
-- Name: FUNCTION digest(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.digest(bytea, text) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.digest(bytea, text) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.digest(bytea, text) TO dashboard_user;
--
-- Name: FUNCTION digest(text, text); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.digest(text, text) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.digest(text, text) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.digest(text, text) TO dashboard_user;
--
-- Name: FUNCTION encrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) TO dashboard_user;
--
-- Name: FUNCTION encrypt_iv(bytea, bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) TO dashboard_user;
--
-- Name: FUNCTION gen_random_bytes(integer); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.gen_random_bytes(integer) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.gen_random_bytes(integer) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.gen_random_bytes(integer) TO dashboard_user;
--
-- Name: FUNCTION gen_random_uuid(); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.gen_random_uuid() FROM postgres;
-- GRANT ALL ON FUNCTION extensions.gen_random_uuid() TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.gen_random_uuid() TO dashboard_user;
--
-- Name: FUNCTION gen_salt(text); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.gen_salt(text) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.gen_salt(text) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.gen_salt(text) TO dashboard_user;
--
-- Name: FUNCTION gen_salt(text, integer); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.gen_salt(text, integer) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.gen_salt(text, integer) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.gen_salt(text, integer) TO dashboard_user;
--
-- Name: FUNCTION grant_pg_cron_access(); Type: ACL; Schema: extensions; Owner: supabase_admin
--
-- REVOKE ALL ON FUNCTION extensions.grant_pg_cron_access() FROM supabase_admin;
-- GRANT ALL ON FUNCTION extensions.grant_pg_cron_access() TO supabase_admin WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.grant_pg_cron_access() TO dashboard_user;
--
-- Name: FUNCTION grant_pg_graphql_access(); Type: ACL; Schema: extensions; Owner: supabase_admin
--
-- GRANT ALL ON FUNCTION extensions.grant_pg_graphql_access() TO postgres WITH GRANT OPTION;
--
-- Name: FUNCTION grant_pg_net_access(); Type: ACL; Schema: extensions; Owner: supabase_admin
--
-- REVOKE ALL ON FUNCTION extensions.grant_pg_net_access() FROM supabase_admin;
-- GRANT ALL ON FUNCTION extensions.grant_pg_net_access() TO supabase_admin WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.grant_pg_net_access() TO dashboard_user;
--
-- Name: FUNCTION hmac(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.hmac(bytea, bytea, text) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.hmac(bytea, bytea, text) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.hmac(bytea, bytea, text) TO dashboard_user;
--
-- Name: FUNCTION hmac(text, text, text); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.hmac(text, text, text) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.hmac(text, text, text) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.hmac(text, text, text) TO dashboard_user;
--
-- Name: FUNCTION pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT ROWS bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT ROWS bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT ROWS bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) TO dashboard_user;
--
-- Name: FUNCTION pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) TO dashboard_user;
--
-- Name: FUNCTION pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) TO dashboard_user;
--
-- Name: FUNCTION pgp_armor_headers(text, OUT key text, OUT value text); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) TO dashboard_user;
--
-- Name: FUNCTION pgp_key_id(bytea); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.pgp_key_id(bytea) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.pgp_key_id(bytea) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.pgp_key_id(bytea) TO dashboard_user;
--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) TO dashboard_user;
--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) TO dashboard_user;
--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) TO dashboard_user;
--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) TO dashboard_user;
--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) TO dashboard_user;
--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) TO dashboard_user;
--
-- Name: FUNCTION pgp_pub_encrypt(text, bytea); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) TO dashboard_user;
--
-- Name: FUNCTION pgp_pub_encrypt(text, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) TO dashboard_user;
--
-- Name: FUNCTION pgp_pub_encrypt_bytea(bytea, bytea); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) TO dashboard_user;
--
-- Name: FUNCTION pgp_pub_encrypt_bytea(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) TO dashboard_user;
--
-- Name: FUNCTION pgp_sym_decrypt(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) TO dashboard_user;
--
-- Name: FUNCTION pgp_sym_decrypt(bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) TO dashboard_user;
--
-- Name: FUNCTION pgp_sym_decrypt_bytea(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) TO dashboard_user;
--
-- Name: FUNCTION pgp_sym_decrypt_bytea(bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) TO dashboard_user;
--
-- Name: FUNCTION pgp_sym_encrypt(text, text); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) TO dashboard_user;
--
-- Name: FUNCTION pgp_sym_encrypt(text, text, text); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) TO dashboard_user;
--
-- Name: FUNCTION pgp_sym_encrypt_bytea(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) TO dashboard_user;
--
-- Name: FUNCTION pgp_sym_encrypt_bytea(bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) TO dashboard_user;
--
-- Name: FUNCTION pgrst_ddl_watch(); Type: ACL; Schema: extensions; Owner: supabase_admin
--
-- GRANT ALL ON FUNCTION extensions.pgrst_ddl_watch() TO postgres WITH GRANT OPTION;
--
-- Name: FUNCTION pgrst_drop_watch(); Type: ACL; Schema: extensions; Owner: supabase_admin
--
-- GRANT ALL ON FUNCTION extensions.pgrst_drop_watch() TO postgres WITH GRANT OPTION;
--
-- Name: FUNCTION set_graphql_placeholder(); Type: ACL; Schema: extensions; Owner: supabase_admin
--
-- GRANT ALL ON FUNCTION extensions.set_graphql_placeholder() TO postgres WITH GRANT OPTION;
--
-- Name: FUNCTION uuid_generate_v1(); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.uuid_generate_v1() FROM postgres;
-- GRANT ALL ON FUNCTION extensions.uuid_generate_v1() TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.uuid_generate_v1() TO dashboard_user;
--
-- Name: FUNCTION uuid_generate_v1mc(); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.uuid_generate_v1mc() FROM postgres;
-- GRANT ALL ON FUNCTION extensions.uuid_generate_v1mc() TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.uuid_generate_v1mc() TO dashboard_user;
--
-- Name: FUNCTION uuid_generate_v3(namespace uuid, name text); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) TO dashboard_user;
--
-- Name: FUNCTION uuid_generate_v4(); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.uuid_generate_v4() FROM postgres;
-- GRANT ALL ON FUNCTION extensions.uuid_generate_v4() TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.uuid_generate_v4() TO dashboard_user;
--
-- Name: FUNCTION uuid_generate_v5(namespace uuid, name text); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) FROM postgres;
-- GRANT ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) TO dashboard_user;
--
-- Name: FUNCTION uuid_nil(); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.uuid_nil() FROM postgres;
-- GRANT ALL ON FUNCTION extensions.uuid_nil() TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.uuid_nil() TO dashboard_user;
--
-- Name: FUNCTION uuid_ns_dns(); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.uuid_ns_dns() FROM postgres;
-- GRANT ALL ON FUNCTION extensions.uuid_ns_dns() TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.uuid_ns_dns() TO dashboard_user;
--
-- Name: FUNCTION uuid_ns_oid(); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.uuid_ns_oid() FROM postgres;
-- GRANT ALL ON FUNCTION extensions.uuid_ns_oid() TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.uuid_ns_oid() TO dashboard_user;
--
-- Name: FUNCTION uuid_ns_url(); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.uuid_ns_url() FROM postgres;
-- GRANT ALL ON FUNCTION extensions.uuid_ns_url() TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.uuid_ns_url() TO dashboard_user;
--
-- Name: FUNCTION uuid_ns_x500(); Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON FUNCTION extensions.uuid_ns_x500() FROM postgres;
-- GRANT ALL ON FUNCTION extensions.uuid_ns_x500() TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION extensions.uuid_ns_x500() TO dashboard_user;
--
-- Name: FUNCTION graphql("operationName" text, query text, variables jsonb, extensions jsonb); Type: ACL; Schema: graphql_public; Owner: supabase_admin
--
-- GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO postgres;
-- GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO anon;
-- GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO authenticated;
-- GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO service_role;
--
-- Name: FUNCTION get_auth(p_usename text); Type: ACL; Schema: pgbouncer; Owner: supabase_admin
--
REVOKE ALL ON FUNCTION pgbouncer.get_auth(p_usename text) FROM PUBLIC;

GRANT ALL ON FUNCTION pgbouncer.get_auth(p_usename text) TO pgbouncer;

GRANT ALL ON FUNCTION pgbouncer.get_auth(p_usename text) TO postgres;

--
-- Name: FUNCTION apply_rls(wal jsonb, max_record_bytes integer); Type: ACL; Schema: realtime; Owner: supabase_admin
--
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO postgres;

GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO dashboard_user;

GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO anon;

GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO authenticated;

GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO service_role;

GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO supabase_realtime_admin;

--
-- Name: FUNCTION broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text); Type: ACL; Schema: realtime; Owner: supabase_admin
--
GRANT ALL ON FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) TO postgres;

GRANT ALL ON FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) TO dashboard_user;

--
-- Name: FUNCTION build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]); Type: ACL; Schema: realtime; Owner: supabase_admin
--
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO postgres;

GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO dashboard_user;

GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO anon;

GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO authenticated;

GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO service_role;

GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO supabase_realtime_admin;

--
-- Name: FUNCTION "cast"(val text, type_ regtype); Type: ACL; Schema: realtime; Owner: supabase_admin
--
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO postgres;

GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO dashboard_user;

GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO anon;

GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO authenticated;

GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO service_role;

GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO supabase_realtime_admin;

--
-- Name: FUNCTION check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text); Type: ACL; Schema: realtime; Owner: supabase_admin
--
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO postgres;

GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO dashboard_user;

GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO anon;

GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO authenticated;

GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO service_role;

GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO supabase_realtime_admin;

--
-- Name: FUNCTION is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]); Type: ACL; Schema: realtime; Owner: supabase_admin
--
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO postgres;

GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO dashboard_user;

GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO anon;

GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO authenticated;

GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO service_role;

GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO supabase_realtime_admin;

--
-- Name: FUNCTION list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer); Type: ACL; Schema: realtime; Owner: supabase_admin
--
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO postgres;

GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO dashboard_user;

GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO anon;

GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO authenticated;

GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO service_role;

GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO supabase_realtime_admin;

--
-- Name: FUNCTION quote_wal2json(entity regclass); Type: ACL; Schema: realtime; Owner: supabase_admin
--
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO postgres;

GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO dashboard_user;

GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO anon;

GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO authenticated;

GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO service_role;

GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO supabase_realtime_admin;

--
-- Name: FUNCTION send(payload jsonb, event text, topic text, private boolean); Type: ACL; Schema: realtime; Owner: supabase_admin
--
GRANT ALL ON FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) TO postgres;

GRANT ALL ON FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) TO dashboard_user;

--
-- Name: FUNCTION subscription_check_filters(); Type: ACL; Schema: realtime; Owner: supabase_admin
--
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO postgres;

GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO dashboard_user;

GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO anon;

GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO authenticated;

GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO service_role;

GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO supabase_realtime_admin;

--
-- Name: FUNCTION to_regrole(role_name text); Type: ACL; Schema: realtime; Owner: supabase_admin
--
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO postgres;

GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO dashboard_user;

GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO anon;

GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO authenticated;

GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO service_role;

GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO supabase_realtime_admin;

--
-- Name: FUNCTION topic(); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--
GRANT ALL ON FUNCTION realtime.topic() TO postgres;

GRANT ALL ON FUNCTION realtime.topic() TO dashboard_user;

--
-- Name: FUNCTION _crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea); Type: ACL; Schema: vault; Owner: supabase_admin
--
-- GRANT ALL ON FUNCTION vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) TO service_role;
--
-- Name: FUNCTION create_secret(new_secret text, new_name text, new_description text, new_key_id uuid); Type: ACL; Schema: vault; Owner: supabase_admin
--
-- GRANT ALL ON FUNCTION vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) TO service_role;
--
-- Name: FUNCTION update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid); Type: ACL; Schema: vault; Owner: supabase_admin
--
-- GRANT ALL ON FUNCTION vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) TO postgres WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) TO service_role;
--
-- Name: TABLE audit_log_entries; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--
GRANT ALL ON TABLE auth.audit_log_entries TO dashboard_user;

GRANT INSERT, REFERENCES, DELETE, TRIGGER, TRUNCATE, MAINTAIN, UPDATE ON TABLE auth.audit_log_entries TO postgres;

GRANT SELECT ON TABLE auth.audit_log_entries TO postgres WITH GRANT OPTION;

--
-- Name: TABLE flow_state; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--
GRANT INSERT, REFERENCES, DELETE, TRIGGER, TRUNCATE, MAINTAIN, UPDATE ON TABLE auth.flow_state TO postgres;

GRANT SELECT ON TABLE auth.flow_state TO postgres WITH GRANT OPTION;

GRANT ALL ON TABLE auth.flow_state TO dashboard_user;

--
-- Name: TABLE identities; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--
GRANT INSERT, REFERENCES, DELETE, TRIGGER, TRUNCATE, MAINTAIN, UPDATE ON TABLE auth.identities TO postgres;

GRANT SELECT ON TABLE auth.identities TO postgres WITH GRANT OPTION;

GRANT ALL ON TABLE auth.identities TO dashboard_user;

--
-- Name: TABLE instances; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--
GRANT ALL ON TABLE auth.instances TO dashboard_user;

GRANT INSERT, REFERENCES, DELETE, TRIGGER, TRUNCATE, MAINTAIN, UPDATE ON TABLE auth.instances TO postgres;

GRANT SELECT ON TABLE auth.instances TO postgres WITH GRANT OPTION;

--
-- Name: TABLE mfa_amr_claims; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--
GRANT INSERT, REFERENCES, DELETE, TRIGGER, TRUNCATE, MAINTAIN, UPDATE ON TABLE auth.mfa_amr_claims TO postgres;

GRANT SELECT ON TABLE auth.mfa_amr_claims TO postgres WITH GRANT OPTION;

GRANT ALL ON TABLE auth.mfa_amr_claims TO dashboard_user;

--
-- Name: TABLE mfa_challenges; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--
GRANT INSERT, REFERENCES, DELETE, TRIGGER, TRUNCATE, MAINTAIN, UPDATE ON TABLE auth.mfa_challenges TO postgres;

GRANT SELECT ON TABLE auth.mfa_challenges TO postgres WITH GRANT OPTION;

GRANT ALL ON TABLE auth.mfa_challenges TO dashboard_user;

--
-- Name: TABLE mfa_factors; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--
GRANT INSERT, REFERENCES, DELETE, TRIGGER, TRUNCATE, MAINTAIN, UPDATE ON TABLE auth.mfa_factors TO postgres;

GRANT SELECT ON TABLE auth.mfa_factors TO postgres WITH GRANT OPTION;

GRANT ALL ON TABLE auth.mfa_factors TO dashboard_user;

--
-- Name: TABLE one_time_tokens; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--
GRANT INSERT, REFERENCES, DELETE, TRIGGER, TRUNCATE, MAINTAIN, UPDATE ON TABLE auth.one_time_tokens TO postgres;

GRANT SELECT ON TABLE auth.one_time_tokens TO postgres WITH GRANT OPTION;

GRANT ALL ON TABLE auth.one_time_tokens TO dashboard_user;

--
-- Name: TABLE refresh_tokens; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--
GRANT ALL ON TABLE auth.refresh_tokens TO dashboard_user;

GRANT INSERT, REFERENCES, DELETE, TRIGGER, TRUNCATE, MAINTAIN, UPDATE ON TABLE auth.refresh_tokens TO postgres;

GRANT SELECT ON TABLE auth.refresh_tokens TO postgres WITH GRANT OPTION;

--
-- Name: SEQUENCE refresh_tokens_id_seq; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--
GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq
    TO dashboard_user;

GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq
    TO postgres;

--
-- Name: TABLE saml_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--
GRANT INSERT, REFERENCES, DELETE, TRIGGER, TRUNCATE, MAINTAIN, UPDATE ON TABLE auth.saml_providers TO postgres;

GRANT SELECT ON TABLE auth.saml_providers TO postgres WITH GRANT OPTION;

GRANT ALL ON TABLE auth.saml_providers TO dashboard_user;

--
-- Name: TABLE saml_relay_states; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--
GRANT INSERT, REFERENCES, DELETE, TRIGGER, TRUNCATE, MAINTAIN, UPDATE ON TABLE auth.saml_relay_states TO postgres;

GRANT SELECT ON TABLE auth.saml_relay_states TO postgres WITH GRANT OPTION;

GRANT ALL ON TABLE auth.saml_relay_states TO dashboard_user;

--
-- Name: TABLE schema_migrations; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--
GRANT SELECT ON TABLE auth.schema_migrations TO postgres WITH GRANT OPTION;

--
-- Name: TABLE sessions; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--
GRANT INSERT, REFERENCES, DELETE, TRIGGER, TRUNCATE, MAINTAIN, UPDATE ON TABLE auth.sessions TO postgres;

GRANT SELECT ON TABLE auth.sessions TO postgres WITH GRANT OPTION;

GRANT ALL ON TABLE auth.sessions TO dashboard_user;

--
-- Name: TABLE sso_domains; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--
GRANT INSERT, REFERENCES, DELETE, TRIGGER, TRUNCATE, MAINTAIN, UPDATE ON TABLE auth.sso_domains TO postgres;

GRANT SELECT ON TABLE auth.sso_domains TO postgres WITH GRANT OPTION;

GRANT ALL ON TABLE auth.sso_domains TO dashboard_user;

--
-- Name: TABLE sso_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--
GRANT INSERT, REFERENCES, DELETE, TRIGGER, TRUNCATE, MAINTAIN, UPDATE ON TABLE auth.sso_providers TO postgres;

GRANT SELECT ON TABLE auth.sso_providers TO postgres WITH GRANT OPTION;

GRANT ALL ON TABLE auth.sso_providers TO dashboard_user;

--
-- Name: TABLE users; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--
GRANT ALL ON TABLE auth.users TO dashboard_user;

GRANT INSERT, REFERENCES, DELETE, TRIGGER, TRUNCATE, MAINTAIN, UPDATE ON TABLE auth.users TO postgres;

GRANT SELECT ON TABLE auth.users TO postgres WITH GRANT OPTION;

--
-- Name: TABLE pg_stat_statements; Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON TABLE extensions.pg_stat_statements FROM postgres;
-- GRANT ALL ON TABLE extensions.pg_stat_statements TO postgres WITH GRANT OPTION;
-- GRANT ALL ON TABLE extensions.pg_stat_statements TO dashboard_user;
--
-- Name: TABLE pg_stat_statements_info; Type: ACL; Schema: extensions; Owner: postgres
--
-- REVOKE ALL ON TABLE extensions.pg_stat_statements_info FROM postgres;
-- GRANT ALL ON TABLE extensions.pg_stat_statements_info TO postgres WITH GRANT OPTION;
-- GRANT ALL ON TABLE extensions.pg_stat_statements_info TO dashboard_user;
--
-- Name: TABLE messages; Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--
GRANT ALL ON TABLE realtime.messages TO postgres;

GRANT ALL ON TABLE realtime.messages TO dashboard_user;

GRANT SELECT, INSERT, UPDATE ON TABLE realtime.messages TO anon;

GRANT SELECT, INSERT, UPDATE ON TABLE realtime.messages TO authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE realtime.messages TO service_role;

--
-- Name: TABLE schema_migrations; Type: ACL; Schema: realtime; Owner: supabase_admin
--
GRANT ALL ON TABLE realtime.schema_migrations TO postgres;

GRANT ALL ON TABLE realtime.schema_migrations TO dashboard_user;

GRANT SELECT ON TABLE realtime.schema_migrations TO anon;

GRANT SELECT ON TABLE realtime.schema_migrations TO authenticated;

GRANT SELECT ON TABLE realtime.schema_migrations TO service_role;

GRANT ALL ON TABLE realtime.schema_migrations TO supabase_realtime_admin;

--
-- Name: TABLE subscription; Type: ACL; Schema: realtime; Owner: supabase_admin
--
GRANT ALL ON TABLE realtime.subscription TO postgres;

GRANT ALL ON TABLE realtime.subscription TO dashboard_user;

GRANT SELECT ON TABLE realtime.subscription TO anon;

GRANT SELECT ON TABLE realtime.subscription TO authenticated;

GRANT SELECT ON TABLE realtime.subscription TO service_role;

GRANT ALL ON TABLE realtime.subscription TO supabase_realtime_admin;

--
-- Name: SEQUENCE subscription_id_seq; Type: ACL; Schema: realtime; Owner: supabase_admin
--
GRANT ALL ON SEQUENCE realtime.subscription_id_seq
    TO postgres;

GRANT ALL ON SEQUENCE realtime.subscription_id_seq
    TO dashboard_user;

GRANT USAGE ON SEQUENCE realtime.subscription_id_seq
    TO anon;

GRANT USAGE ON SEQUENCE realtime.subscription_id_seq
    TO authenticated;

GRANT USAGE ON SEQUENCE realtime.subscription_id_seq
    TO service_role;

GRANT ALL ON SEQUENCE realtime.subscription_id_seq
    TO supabase_realtime_admin;

--
-- Name: TABLE buckets; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--
GRANT ALL ON TABLE storage.buckets TO anon;

GRANT ALL ON TABLE storage.buckets TO authenticated;

GRANT ALL ON TABLE storage.buckets TO service_role;

GRANT ALL ON TABLE storage.buckets TO postgres WITH GRANT OPTION;

--
-- Name: TABLE objects; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--
GRANT ALL ON TABLE storage.objects TO anon;

GRANT ALL ON TABLE storage.objects TO authenticated;

GRANT ALL ON TABLE storage.objects TO service_role;

GRANT ALL ON TABLE storage.objects TO postgres WITH GRANT OPTION;

--
-- Name: TABLE s3_multipart_uploads; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--
GRANT ALL ON TABLE storage.s3_multipart_uploads TO service_role;

GRANT SELECT ON TABLE storage.s3_multipart_uploads TO authenticated;

GRANT SELECT ON TABLE storage.s3_multipart_uploads TO anon;

--
-- Name: TABLE s3_multipart_uploads_parts; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--
GRANT ALL ON TABLE storage.s3_multipart_uploads_parts TO service_role;

GRANT SELECT ON TABLE storage.s3_multipart_uploads_parts TO authenticated;

GRANT SELECT ON TABLE storage.s3_multipart_uploads_parts TO anon;

--
-- Name: TABLE secrets; Type: ACL; Schema: vault; Owner: supabase_admin
--
-- GRANT SELECT, REFERENCES, DELETE, TRUNCATE ON TABLE vault.secrets TO postgres WITH GRANT OPTION;
-- GRANT SELECT, DELETE ON TABLE vault.secrets TO service_role;
--
-- Name: TABLE decrypted_secrets; Type: ACL; Schema: vault; Owner: supabase_admin
--
-- GRANT SELECT, REFERENCES, DELETE, TRUNCATE ON TABLE vault.decrypted_secrets TO postgres WITH GRANT OPTION;
-- GRANT SELECT, DELETE ON TABLE vault.decrypted_secrets TO service_role;
--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO dashboard_user;

--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO dashboard_user;

--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO dashboard_user;

--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: extensions; Owner: supabase_admin
--
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON SEQUENCES TO postgres WITH GRANT OPTION;

--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: extensions; Owner: supabase_admin
--
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON FUNCTIONS TO postgres WITH GRANT OPTION;

--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: extensions; Owner: supabase_admin
--
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON TABLES TO postgres WITH GRANT OPTION;

--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON SEQUENCES TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON SEQUENCES TO dashboard_user;

--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON FUNCTIONS TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON FUNCTIONS TO dashboard_user;

--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON TABLES TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON TABLES TO dashboard_user;

--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO service_role;

--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--
/*
CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
 WHEN TAG IN('DROP EXTENSION')
 EXECUTE FUNCTION extensions.set_graphql_placeholder();

ALTER EVENT TRIGGER issue_graphql_placeholder OWNER TO supabase_admin;
 */
--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--
/*
CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
 WHEN TAG IN('CREATE EXTENSION')
 EXECUTE FUNCTION extensions.grant_pg_cron_access();

ALTER EVENT TRIGGER issue_pg_cron_access OWNER TO supabase_admin;
 */
--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--
/*
CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
 WHEN TAG IN('CREATE FUNCTION')
 EXECUTE FUNCTION extensions.grant_pg_graphql_access();

ALTER EVENT TRIGGER issue_pg_graphql_access OWNER TO supabase_admin;
 */
--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--
/*
CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
 WHEN TAG IN('CREATE EXTENSION')
 EXECUTE FUNCTION extensions.grant_pg_net_access();

ALTER EVENT TRIGGER issue_pg_net_access OWNER TO supabase_admin;
 */
--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--
/*
CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
 EXECUTE FUNCTION extensions.pgrst_ddl_watch();

ALTER EVENT TRIGGER pgrst_ddl_watch OWNER TO supabase_admin;
 */
--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--
/*
CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
 EXECUTE FUNCTION extensions.pgrst_drop_watch();

ALTER EVENT TRIGGER pgrst_drop_watch OWNER TO supabase_admin;
 */
--
-- PostgreSQL database dump complete
--
