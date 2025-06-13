-- supabase/migrations/20250613075800_create_schedule_function.sql

CREATE OR REPLACE FUNCTION public.schedule_campaign_jobs(
  p_campaign_id UUID,
  p_market_region TEXT,
  p_spread_days INT DEFAULT 7
)
RETURNS INT AS $$
DECLARE
    jobs_created INT := 0;
    lead_id_record RECORD;
    random_interval INTERVAL;
BEGIN
    -- To allow for re-scheduling, we first remove any existing 'scheduled' jobs for this campaign.
    -- This prevents creating duplicate jobs if a user schedules the same campaign twice.
    DELETE FROM public.campaign_jobs
    WHERE campaign_id = p_campaign_id AND status = 'scheduled';

    -- Loop through every lead that matches the target market region.
    FOR lead_id_record IN
        SELECT id FROM public.crm_leads WHERE market_region = p_market_region
    LOOP
        -- Calculate a random delay within the total spread duration (in minutes).
        -- This ensures each email is scheduled at a unique, unpredictable time.
        random_interval := (random() * p_spread_days * 24 * 60) * interval '1 minute';
        
        -- Insert the new job into the queue with its future processing time.
        INSERT INTO public.campaign_jobs (campaign_id, lead_id, status, next_processing_time)
        VALUES (
            p_campaign_id,
            lead_id_record.id,
            'scheduled',
            now() + interval '5 minutes' + random_interval -- Start sending after a 5-minute delay.
        );
        
        jobs_created := jobs_created + 1;
    END LOOP;

    -- Return the total number of jobs that were successfully scheduled.
    RETURN jobs_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;