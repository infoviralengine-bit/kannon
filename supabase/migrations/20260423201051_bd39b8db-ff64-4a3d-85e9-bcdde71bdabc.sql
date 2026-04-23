CREATE TABLE IF NOT EXISTS public.video_formats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_formats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and team can manage video_formats"
ON public.video_formats
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role));

CREATE POLICY "Campaign manager can manage video_formats"
ON public.video_formats
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'campaign_manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'campaign_manager'::app_role));

INSERT INTO public.video_formats (name) VALUES
  ('Direct Hook'),
  ('Storytelling'),
  ('UGC'),
  ('Tutorial'),
  ('Trending Sound'),
  ('Testimonial')
ON CONFLICT (name) DO NOTHING;