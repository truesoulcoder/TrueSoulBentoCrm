-- supabase/migrations/20250613164500_create_refactored_scheduler_function.sql

-- First, drop the old function if it exists.
DROP FUNCTION IF EXISTS public.schedule_campaign_by_id_offset(uuid, interval);

-- Create the new, refactored scheduler function.
CREATE OR REPLACE FUNCTION public.schedule_campaign_jobs(p_campaign_id UUID)
RETURNS integer -- Returns the number of jobs created
LANGUAGE plpgsql
AS $function$
DECLARE
    v_campaign RECORD;
    v_market_region_name TEXT;
    v_total_jobs_created INT := 0;
BEGIN
    -- Step 1: Fetch campaign configuration and the associated market region name
    SELECT c.*, mr.name as market_region_name
    INTO v_campaign
    FROM public.campaigns c
    JOIN public.market_regions mr ON c.market_region_id = mr.id
    WHERE c.id = p_campaign_id;

    IF v_campaign IS NULL THEN
        RAISE EXCEPTION 'Campaign with ID % not found or has no market region.', p_campaign_id;
    END IF;

    -- Step 2: Delete any existing 'scheduled' jobs for this campaign to allow for a clean reschedule.
    DELETE FROM public.campaign_jobs WHERE campaign_id = p_campaign_id AND status = 'scheduled';

    -- Step 3: Use a Common Table Expression (CTE) to perform the entire scheduling logic in one go.
    WITH
    -- Get available leads in the target market that haven't already been processed for this campaign.
    available_leads AS (
        SELECT 
            cl.id
        FROM public.crm_leads cl
        WHERE cl.market_region = v_campaign.market_region_name
          AND cl.contact_email IS NOT NULL
          AND cl.id NOT IN (
              SELECT cj.lead_id FROM public.campaign_jobs cj WHERE cj.campaign_id = p_campaign_id
          )
        ORDER BY random()
        LIMIT v_campaign.daily_limit
    ),
    -- Get active senders for rotation.
    active_senders AS (
        SELECT 
            s.id,
            row_number() OVER (ORDER BY random()) as sender_num
        FROM public.senders s
        WHERE s.is_active = true
    ),
    -- Create the schedule: assign a sender and a random timestamp to each lead.
    final_schedule AS (
        SELECT
            al.id as lead_id,
            -- Assign sender via round-robin
            (SELECT s.id FROM active_senders s WHERE s.sender_num = ((row_number() OVER ()) - 1) % (SELECT count(*) FROM active_senders) + 1) as assigned_sender_id,
            -- Calculate a random time within the campaign's configured window
            (now() + interval '5 minutes' + (random() * (v_campaign.time_window_hours * 3600)) * interval '1 second') as next_processing_time
        FROM available_leads al
    ),
    -- Insert the jobs into the queue and capture the results.
    inserted_jobs AS (
        INSERT INTO public.campaign_jobs (campaign_id, lead_id, assigned_sender_id, status, next_processing_time)
        SELECT
            p_campaign_id,
            fs.lead_id,
            fs.assigned_sender_id,
            'scheduled'::public.campaign_job_status,
            fs.next_processing_time
        FROM final_schedule fs
        RETURNING id
    )
    -- Count how many jobs were created.
    SELECT count(*) INTO v_total_jobs_created FROM inserted_jobs;
    
    -- (Optional) We can add a logging step here to system_event_logs if needed.

    RETURN v_total_jobs_created;
END;
$function$;