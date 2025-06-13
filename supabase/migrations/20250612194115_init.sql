-- Auth Schema (Essential Tables)
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    encrypted_password TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE auth.audit_log_entries (
    id UUID PRIMARY KEY,
    payload JSON,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address VARCHAR(64)
);

-- Public Schema with Triggers
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_app_settings_timestamp
BEFORE UPDATE ON public.application_settings
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- Key Functions
CREATE OR REPLACE FUNCTION public.generate_short_id()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
    result TEXT := '';
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Security Policies (RLS Example)
ALTER TABLE public.file_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY file_imports_policy ON public.file_imports
    USING (user_id = auth.uid());
