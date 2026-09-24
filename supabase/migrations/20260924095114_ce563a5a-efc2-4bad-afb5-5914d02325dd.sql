ALTER TABLE public.company_documents
ADD COLUMN IF NOT EXISTS occurred_at timestamp with time zone;

UPDATE public.company_documents
SET occurred_at = created_at
WHERE occurred_at IS NULL;

ALTER TABLE public.company_documents
ALTER COLUMN occurred_at SET DEFAULT now(),
ALTER COLUMN occurred_at SET NOT NULL;