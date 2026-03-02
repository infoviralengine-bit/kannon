
-- Fix 1: Add authorization check to bulk_update_video_views
CREATE OR REPLACE FUNCTION public.bulk_update_video_views(p_ids uuid[], p_views integer[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow admin/team to bulk update
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team')) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  FOR i IN 1..array_length(p_ids, 1) LOOP
    UPDATE videos SET views = p_views[i] WHERE id = p_ids[i];
  END LOOP;
END;
$$;

-- Fix 2: Add SELECT policy for creators to view their own tiktok_accounts
CREATE POLICY "Creators can view own tiktok_accounts"
ON public.tiktok_accounts
FOR SELECT
TO authenticated
USING (
  creator_id IN (
    SELECT id FROM public.creators WHERE profile_id = auth.uid()
  )
);
