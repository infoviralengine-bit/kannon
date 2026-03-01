CREATE OR REPLACE FUNCTION public.bulk_update_video_views(
  p_ids uuid[],
  p_views integer[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  FOR i IN 1..array_length(p_ids, 1) LOOP
    UPDATE videos SET views = p_views[i] WHERE id = p_ids[i];
  END LOOP;
END;
$$;