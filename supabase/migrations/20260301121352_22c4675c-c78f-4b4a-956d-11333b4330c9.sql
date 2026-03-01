
-- Add cap columns to campaigns
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS video_views_cap integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS monthly_spend_cap numeric(10,2) DEFAULT NULL;

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  type text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users can update own notifications (mark read)
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Admin and team can manage all notifications
CREATE POLICY "Admin and team can manage notifications"
  ON public.notifications FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'team'::app_role));
