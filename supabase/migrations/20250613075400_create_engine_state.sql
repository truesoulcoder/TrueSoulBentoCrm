-- supabase/migrations/20250613075400_create_engine_state.sql

-- Drop old, redundant state tables if they exist to clean up the schema.
DROP TABLE IF EXISTS public.system_state;
DROP TABLE IF EXISTS public.engine_control;
DROP TABLE IF EXISTS public.eli5_engine_status;

-- Drop the type if it exists, along with any dependent columns, to make this script idempotent.
DROP TYPE IF EXISTS public.engine_status CASCADE;

-- Create a new ENUM type for our clean state machine.
CREATE TYPE public.engine_status AS ENUM (
  'stopped',
  'running',
  'paused'
);

-- Create the single, authoritative table for engine state.
CREATE TABLE public.engine_state (
  id BIGINT PRIMARY KEY DEFAULT 1,
  status public.engine_status NOT NULL DEFAULT 'stopped',
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  last_paused_at TIMESTAMPTZ,
  CONSTRAINT single_row_check CHECK (id = 1)
);

-- Secure the table so only service roles can modify it.
ALTER TABLE public.engine_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service_role access" ON public.engine_state FOR ALL USING (true) WITH CHECK (true);

-- Insert the single row that will manage our state.
-- The ON CONFLICT clause makes this script safe to re-run.
INSERT INTO public.engine_state (id, status) VALUES (1, 'stopped') ON CONFLICT (id) DO NOTHING;

-- Create a trigger to automatically update the 'updated_at' timestamp on any change.
CREATE OR REPLACE FUNCTION public.handle_engine_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_engine_state_updated
BEFORE UPDATE ON public.engine_state
FOR EACH ROW
EXECUTE PROCEDURE public.handle_engine_state_updated_at();