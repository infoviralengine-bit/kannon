
-- Drop existing restrictive ALL policies that lack WITH CHECK
DROP POLICY IF EXISTS "Admin and team can manage payment_cycles" ON public.payment_cycles;
DROP POLICY IF EXISTS "Admin and team can manage client_payments" ON public.client_payments;
DROP POLICY IF EXISTS "Admin and team can manage creator_payments" ON public.creator_payments;

-- payment_cycles
CREATE POLICY "Admin and team can select payment_cycles" ON public.payment_cycles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team'));
CREATE POLICY "Admin and team can insert payment_cycles" ON public.payment_cycles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team'));
CREATE POLICY "Admin and team can update payment_cycles" ON public.payment_cycles FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team')) WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team'));
CREATE POLICY "Admin and team can delete payment_cycles" ON public.payment_cycles FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team'));

-- client_payments
CREATE POLICY "Admin and team can select client_payments" ON public.client_payments FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team'));
CREATE POLICY "Admin and team can insert client_payments" ON public.client_payments FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team'));
CREATE POLICY "Admin and team can update client_payments" ON public.client_payments FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team')) WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team'));
CREATE POLICY "Admin and team can delete client_payments" ON public.client_payments FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team'));

-- creator_payments (keep existing creator SELECT policy)
DROP POLICY IF EXISTS "Creators can view own creator_payments" ON public.creator_payments;
CREATE POLICY "Admin and team can select creator_payments" ON public.creator_payments FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team'));
CREATE POLICY "Admin and team can insert creator_payments" ON public.creator_payments FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team'));
CREATE POLICY "Admin and team can update creator_payments" ON public.creator_payments FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team')) WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team'));
CREATE POLICY "Admin and team can delete creator_payments" ON public.creator_payments FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'team'));
CREATE POLICY "Creators can view own creator_payments" ON public.creator_payments FOR SELECT TO authenticated USING (creator_id IN (SELECT id FROM creators WHERE profile_id = auth.uid()));
