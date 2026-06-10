ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS period_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.contracts
SET period_overrides = jsonb_build_object('3', jsonb_build_object('end', '2026-06-08'))
WHERE id IN (
  '19a9d172-2bd0-48ec-96ae-51ac647cbc62', -- Contratto Premium
  'ed5040ff-cc40-4786-9f2b-4e4de0f64c4c'  -- Contratto FZ
);