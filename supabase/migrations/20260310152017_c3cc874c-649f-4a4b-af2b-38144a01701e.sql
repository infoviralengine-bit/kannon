ALTER TABLE public.creators ADD COLUMN IF NOT EXISTS onboarding_phase text DEFAULT NULL;

-- Set all existing creators as operativi
UPDATE public.creators SET onboarding_phase = 'operativi';