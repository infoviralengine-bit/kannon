
CREATE POLICY "Operator can update tiktok_accounts"
ON public.tiktok_accounts FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'operator'::app_role))
WITH CHECK (has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Operator can delete tiktok_accounts"
ON public.tiktok_accounts FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Operator can delete videos"
ON public.videos FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Operator can update creators"
ON public.creators FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'operator'::app_role))
WITH CHECK (has_role(auth.uid(), 'operator'::app_role));
