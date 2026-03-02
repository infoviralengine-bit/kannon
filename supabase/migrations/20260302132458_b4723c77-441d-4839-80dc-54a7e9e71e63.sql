-- 1. Fix bulk_update_video_views with input validation
CREATE OR REPLACE FUNCTION public.bulk_update_video_views(p_ids uuid[], p_views integer[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team')) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_ids IS NULL OR p_views IS NULL THEN
    RAISE EXCEPTION 'Arrays cannot be NULL';
  END IF;

  IF array_length(p_ids, 1) IS DISTINCT FROM array_length(p_views, 1) THEN
    RAISE EXCEPTION 'Arrays must have same length';
  END IF;

  FOR i IN 1..array_length(p_ids, 1) LOOP
    IF p_views[i] < 0 THEN
      RAISE EXCEPTION 'Views must be non-negative';
    END IF;
    UPDATE videos SET views = p_views[i] WHERE id = p_ids[i];
  END LOOP;
END;
$$;

-- 2. Add SELECT policy for creators on videos table
CREATE POLICY "Creators can view own videos"
  ON public.videos
  FOR SELECT
  TO authenticated
  USING (
    tiktok_account_id IN (
      SELECT ta.id
      FROM public.tiktok_accounts ta
      JOIN public.creators c ON c.id = ta.creator_id
      WHERE c.profile_id = auth.uid()
    )
  );