
-- Settings key/value table
CREATE TABLE public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage settings
CREATE POLICY "Admins can manage settings"
  ON public.settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Insert defaults
INSERT INTO public.settings (key, value) VALUES
  ('client_cpm_default', '2.00'),
  ('creator_fixed_default', '200.00'),
  ('creator_cpm_default', '0.50'),
  ('creator_monthly_fixed_default', '200.00'),
  ('creator_min_videos_default', '5'),
  ('apify_api_key', ''),
  ('apify_frequency', 'every_2_hours');
