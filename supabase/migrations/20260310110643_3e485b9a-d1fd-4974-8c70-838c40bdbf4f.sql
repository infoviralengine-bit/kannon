CREATE POLICY "Closer can view active contracts"
  ON public.contracts FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'closer'::app_role) AND is_active = true);