ALTER TABLE public.videos
  ADD COLUMN views_final integer DEFAULT NULL,
  ADD COLUMN window_expires_at timestamptz,
  ADD COLUMN window_closed boolean NOT NULL DEFAULT false;

-- Backfill window_expires_at for existing videos
UPDATE public.videos SET window_expires_at = published_at + interval '30 days' WHERE window_expires_at IS NULL;