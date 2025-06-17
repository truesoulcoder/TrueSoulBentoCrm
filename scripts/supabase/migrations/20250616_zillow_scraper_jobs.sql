-- Create zillow_scraper_jobs table to queue and track scraper jobs
CREATE TABLE public.zillow_scraper_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  zillow_url TEXT NOT NULL,
  user_agent TEXT,
  output_directory TEXT,
  error_message TEXT,
  properties_scraped INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add RLS policies
ALTER TABLE public.zillow_scraper_jobs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all authenticated users to view all jobs
CREATE POLICY "Allow authenticated users to view all jobs" 
  ON public.zillow_scraper_jobs
  FOR SELECT 
  TO authenticated
  USING (true);

-- Create policy to allow authenticated users to insert their own jobs
CREATE POLICY "Allow authenticated users to insert their own jobs" 
  ON public.zillow_scraper_jobs
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Create policy to allow authenticated users to update jobs they created
CREATE POLICY "Allow authenticated users to update their own jobs" 
  ON public.zillow_scraper_jobs
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = created_by);

-- Add function to automatically update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to automatically update updated_at
CREATE TRIGGER update_zillow_scraper_jobs_updated_at
BEFORE UPDATE ON public.zillow_scraper_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
