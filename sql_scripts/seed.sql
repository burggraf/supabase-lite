--
-- Supabase Lite Database Initialization Script
-- Based on Supabase default schema and roles
-- Adapted for PGlite compatibility
--

-- Set basic configuration
SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- =============================================================================
-- ROLES (Simulated for PGlite - actual role management not fully supported)
-- =============================================================================

-- Note: PGlite doesn't support full role management, but we'll create these
-- statements for documentation and potential future compatibility

-- Core roles (commented out as PGlite doesn't support most role operations)
-- CREATE ROLE anon;
-- CREATE ROLE authenticated; 
-- CREATE ROLE authenticator;
-- CREATE ROLE dashboard_user;
-- CREATE ROLE pgbouncer;
-- CREATE ROLE service_role;
-- CREATE ROLE supabase_admin;
-- CREATE ROLE supabase_auth_admin;
-- CREATE ROLE supabase_etl_admin;
-- CREATE ROLE supabase_read_only_user;
-- CREATE ROLE supabase_realtime_admin;
-- CREATE ROLE supabase_replication_admin;
-- CREATE ROLE supabase_storage_admin;

-- =============================================================================
-- SCHEMAS
-- =============================================================================

-- Create Supabase schemas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS graphql;
CREATE SCHEMA IF NOT EXISTS graphql_public;
CREATE SCHEMA IF NOT EXISTS pgbouncer;
CREATE SCHEMA IF NOT EXISTS realtime;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS vault;

-- Grant permissions to postgres role (PGlite default)
-- ALTER SCHEMA auth OWNER TO supabase_admin;
-- ALTER SCHEMA extensions OWNER TO postgres;
-- ALTER SCHEMA graphql OWNER TO supabase_admin;
-- ALTER SCHEMA graphql_public OWNER TO supabase_admin;
-- ALTER SCHEMA pgbouncer OWNER TO pgbouncer;
-- ALTER SCHEMA realtime OWNER TO supabase_admin;
-- ALTER SCHEMA storage OWNER TO supabase_admin;
-- ALTER SCHEMA vault OWNER TO supabase_admin;

-- =============================================================================
-- EXTENSIONS (Only PGlite-supported ones)
-- =============================================================================

-- Note: Most PostgreSQL extensions are not supported in PGlite
-- We'll use built-in functions instead

-- UUID generation (use gen_random_uuid() which is built-in)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Cryptographic functions (not supported in PGlite)
-- CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Unsupported extensions (commented out):
-- CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;
-- CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- =============================================================================
-- AUTH SCHEMA TYPES
-- =============================================================================

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);

-- =============================================================================
-- AUTH SCHEMA TABLES
-- =============================================================================

-- Users table
CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
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
    phone text,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::text,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_phone_key UNIQUE (phone)
);

-- Identities table
CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    CONSTRAINT identities_pkey PRIMARY KEY (id),
    CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider),
    CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Sessions table
CREATE TABLE auth.sessions (
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
    tag text,
    CONSTRAINT sessions_pkey PRIMARY KEY (id),
    CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Refresh tokens table
CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid,
    CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id),
    CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE
);

-- Schema migrations table
CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL,
    CONSTRAINT schema_migrations_pkey PRIMARY KEY (version)
);

-- Audit log entries table
CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL,
    CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id)
);

-- Instances table
CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT instances_pkey PRIMARY KEY (id)
);

-- MFA factors table
CREATE TABLE auth.mfa_factors (
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
    web_authn_aaguid uuid,
    CONSTRAINT mfa_factors_pkey PRIMARY KEY (id),
    CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- MFA challenges table  
CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb,
    CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id),
    CONSTRAINT mfa_challenges_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE
);

-- MFA AMR claims table
CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    CONSTRAINT amr_id_pk PRIMARY KEY (id),
    CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE
);

-- One-time tokens table
CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id),
    CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Flow state table
CREATE TABLE auth.flow_state (
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
    auth_code_issued_at timestamp with time zone,
    CONSTRAINT flow_state_pkey PRIMARY KEY (id)
);

-- SSO providers table
CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT sso_providers_pkey PRIMARY KEY (id)
);

-- SSO domains table
CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT sso_domains_pkey PRIMARY KEY (id),
    CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE
);

-- SAML providers table
CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT saml_providers_pkey PRIMARY KEY (id),
    CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE
);

-- SAML relay states table
CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id),
    CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE,
    CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE
);

-- =============================================================================
-- STORAGE SCHEMA (Basic structure)
-- =============================================================================

-- Storage buckets table
CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    CONSTRAINT buckets_pkey PRIMARY KEY (id)
);

-- Storage objects table
CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    version text,
    owner_id text,
    user_metadata jsonb,
    CONSTRAINT objects_pkey PRIMARY KEY (id),
    CONSTRAINT objects_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id)
);

-- Storage migrations table
CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT now(),
    CONSTRAINT migrations_pkey PRIMARY KEY (id)
);

-- =============================================================================
-- REALTIME SCHEMA (Basic structure)
-- =============================================================================

-- Realtime schema migrations
CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone,
    CONSTRAINT schema_migrations_pkey PRIMARY KEY (version)
);

-- =============================================================================
-- INDEXES (Critical ones for performance)
-- =============================================================================

-- Auth indexes
CREATE INDEX IF NOT EXISTS users_instance_id_idx ON auth.users(instance_id);
CREATE INDEX IF NOT EXISTS users_instance_id_email_idx ON auth.users(instance_id, lower(email));
CREATE INDEX IF NOT EXISTS users_email_partial_key ON auth.users(email) WHERE is_sso_user = false;
CREATE INDEX IF NOT EXISTS identities_email_idx ON auth.identities(email);
CREATE INDEX IF NOT EXISTS identities_user_id_idx ON auth.identities(user_id);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON auth.sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_not_after_idx ON auth.sessions(not_after DESC);
CREATE INDEX IF NOT EXISTS refresh_tokens_instance_id_idx ON auth.refresh_tokens(instance_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens(instance_id, user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_parent_idx ON auth.refresh_tokens(parent);
CREATE INDEX IF NOT EXISTS refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens(session_id, revoked);
CREATE INDEX IF NOT EXISTS refresh_tokens_updated_at_idx ON auth.refresh_tokens(updated_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_instance_id_idx ON auth.audit_log_entries(instance_id);
CREATE INDEX IF NOT EXISTS mfa_factors_user_id_idx ON auth.mfa_factors(user_id);

-- Storage indexes
CREATE INDEX IF NOT EXISTS bname ON storage.buckets(name);
CREATE INDEX IF NOT EXISTS bucketid_objname ON storage.objects(bucket_id, name);
CREATE INDEX IF NOT EXISTS name_prefix_search ON storage.objects(name);

-- =============================================================================
-- SAMPLE DATA (Basic setup)
-- =============================================================================

-- Insert schema migration records for auth
INSERT INTO auth.schema_migrations (version) VALUES 
    ('20171026211738'),
    ('20171026211808'),
    ('20171026211834'),
    ('20180103212743'),
    ('20180108183307'),
    ('20180119214651'),
    ('20180125194653'),
    ('20180209173617');

-- Insert default storage migrations
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES 
    (0, 'create-migrations-table', 'e18db15504ca87ae5e29ba90e099893d', now()),
    (1, 'create-buckets-table', 'e18db15504ca87ae5e29ba90e099893e', now()),
    (2, 'create-objects-table', 'e18db15504ca87ae5e29ba90e099893f', now());

-- Insert realtime schema migration
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES 
    (20210706140551, now());

-- =============================================================================
-- SECURITY (Basic RLS setup - commented as PGlite doesn't support full RLS)
-- =============================================================================

-- Enable RLS on auth tables (may not work in PGlite)
-- ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Storage RLS
-- ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- FUNCTIONS AND TRIGGERS (Simplified for PGlite)
-- =============================================================================

-- Basic trigger function for updated_at timestamps
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON auth.users 
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON auth.sessions 
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON storage.buckets 
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON storage.objects 
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- =============================================================================
-- COMPLETION MESSAGE
-- =============================================================================

-- Create a simple view to verify setup
CREATE VIEW public.supabase_setup_status AS
SELECT 
    'Supabase Lite Database' as name,
    'Initialized successfully' as status,
    now() as initialized_at;

-- Create sample tables for development (no public.users - use auth.users instead)
CREATE TABLE IF NOT EXISTS public.posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT,
    author_email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Success message
DO $$ 
BEGIN 
    RAISE NOTICE 'Supabase Lite database initialized successfully!';
    RAISE NOTICE 'Schemas created: auth, storage, realtime, extensions, graphql, graphql_public, pgbouncer, vault';
    RAISE NOTICE 'Auth tables created with proper structure';
    RAISE NOTICE 'Basic triggers and functions installed';
    RAISE NOTICE 'Sample development tables created (no public.users - use auth.users)';
END $$;