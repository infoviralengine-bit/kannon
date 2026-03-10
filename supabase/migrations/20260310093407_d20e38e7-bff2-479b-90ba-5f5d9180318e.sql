ALTER TABLE public.closer_leads
  ADD COLUMN call_channel text NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN meet_link text NULL;