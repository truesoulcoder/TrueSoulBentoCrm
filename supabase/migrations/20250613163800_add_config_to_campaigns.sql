-- supabase/migrations/20250613163800_add_config_to_campaigns.sql

-- Add a column to link a campaign directly to a market region.
-- This is more robust than relying on text matching.
ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS market_region_id UUID REFERENCES public.market_regions(id);

-- Add the configuration columns that the scheduling function will use.
-- This makes each campaign self-contained.
ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS daily_limit INT NOT NULL DEFAULT 100,
ADD COLUMN IF NOT EXISTS time_window_hours INT NOT NULL DEFAULT 8;