-- Drop the old unique constraint that only allows 1 entry per account per day
ALTER TABLE public.outreach_stats DROP CONSTRAINT IF EXISTS outreach_stats_tiktok_account_id_date_key;

-- Create new unique constraint that allows different templates per account per day
ALTER TABLE public.outreach_stats ADD CONSTRAINT outreach_stats_account_date_template_key 
  UNIQUE (tiktok_account_id, date, template_id);