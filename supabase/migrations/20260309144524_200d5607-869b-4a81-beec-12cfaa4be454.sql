
-- 1. Add new roles to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'outreach';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'closer';
