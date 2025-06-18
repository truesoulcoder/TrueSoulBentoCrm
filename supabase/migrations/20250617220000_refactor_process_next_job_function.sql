-- supabase/migrations/20250617220000_refactor_process_next_job_function.sql

-- Drop the old function that has an architectural conflict.
DROP FUNCTION IF EXISTS public.process_next_campaign_job();

-- Create the new, corrected function.
-- This version's only responsibilities are to atomically find, lock, and update the next job,
-- and then return its ID to the campaign worker. It no longer makes HTTP calls.
CREATE OR REPLACE FUNCTION public.process_next_campaign_job()
RETURNS uuid -- Return the job ID
LANGUAGE plpgsql
AS $$
DECLARE
  job_id_to_process uuid;
  engine_is_running boolean;
BEGIN
  -- Check if the engine is running from the correct table.
  SELECT status = 'running'
  INTO engine_is_running
  FROM public.engine_state
  WHERE id = 1;

  IF NOT engine_is_running THEN
    -- If the engine is not running, return NULL immediately.
    RETURN NULL;
  END IF;

  -- Find the next due job, lock the row to prevent race conditions,
  -- update its status, and return its ID all in one atomic operation.
  WITH next_job AS (
    SELECT id
    FROM public.campaign_jobs
    WHERE
      status = 'scheduled'
      AND next_processing_time <= now()
    ORDER BY next_processing_time ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.campaign_jobs
  SET status = 'processing'
  WHERE id = (SELECT id FROM next_job)
  RETURNING id INTO job_id_to_process;

  -- Return the ID of the job we locked and updated.
  -- The campaign worker will now handle triggering the API.
  RETURN job_id_to_process;

END;
$$;