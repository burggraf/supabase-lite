--
-- Add user_passwords table for storing password hashes separately from users table
-- This provides better security and allows for password history tracking
--

CREATE TABLE IF NOT EXISTS auth.user_passwords (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    password_hash text NOT NULL,
    password_salt text NOT NULL,
    algorithm text DEFAULT 'PBKDF2' NOT NULL,
    iterations integer DEFAULT 100000 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    
    CONSTRAINT user_passwords_pkey PRIMARY KEY (id),
    CONSTRAINT user_passwords_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT user_passwords_user_id_unique UNIQUE (user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS user_passwords_user_id_idx ON auth.user_passwords(user_id);

-- Add table for password reset tokens
CREATE TABLE IF NOT EXISTS auth.password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    
    CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id),
    CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create index for token lookups and cleanup
CREATE INDEX IF NOT EXISTS password_reset_tokens_token_hash_idx ON auth.password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_at_idx ON auth.password_reset_tokens(expires_at);

-- Add table for tracking failed login attempts
CREATE TABLE IF NOT EXISTS auth.failed_login_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    ip_address inet,
    attempted_at timestamp with time zone DEFAULT now() NOT NULL,
    
    CONSTRAINT failed_login_attempts_pkey PRIMARY KEY (id),
    CONSTRAINT failed_login_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes for rate limiting queries
CREATE INDEX IF NOT EXISTS failed_login_attempts_user_id_idx ON auth.failed_login_attempts(user_id, attempted_at);
CREATE INDEX IF NOT EXISTS failed_login_attempts_ip_idx ON auth.failed_login_attempts(ip_address, attempted_at);