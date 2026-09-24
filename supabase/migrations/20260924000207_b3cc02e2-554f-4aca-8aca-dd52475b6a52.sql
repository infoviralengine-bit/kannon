ALTER TABLE public.contract_signatures DROP COLUMN IF EXISTS onboarding_link_id;
DROP FUNCTION IF EXISTS public.get_onboarding_data(text);
DROP TABLE IF EXISTS public.onboarding_links;