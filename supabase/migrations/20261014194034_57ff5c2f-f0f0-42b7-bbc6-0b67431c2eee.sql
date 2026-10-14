CREATE POLICY "Operator can delete campaign_creators" ON public.campaign_creators FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'operator'::app_role));
CREATE POLICY "Operator can delete creators" ON public.creators FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'operator'::app_role));

CREATE OR REPLACE FUNCTION public.delete_creator_cascade(p_creator_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'team'::app_role) OR public.has_role(auth.uid(),'operator'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  DELETE FROM public.videos WHERE tiktok_account_id IN (SELECT id FROM public.tiktok_accounts WHERE creator_id = p_creator_id);
  DELETE FROM public.tiktok_accounts WHERE creator_id = p_creator_id;
  DELETE FROM public.campaign_creators WHERE creator_id = p_creator_id;
  DELETE FROM public.payments WHERE creator_id = p_creator_id;
  DELETE FROM public.creators WHERE id = p_creator_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.delete_creator_cascade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_creator_cascade(uuid) TO authenticated;