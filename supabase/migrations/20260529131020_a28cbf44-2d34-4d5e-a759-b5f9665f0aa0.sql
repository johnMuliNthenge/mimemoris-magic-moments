
CREATE POLICY "Only host can insert OTP"
ON public.collaboration_otp
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.collaboration_sessions cs
          WHERE cs.id = collaboration_id AND cs.host_user_id = auth.uid())
);

CREATE POLICY "Only host can update OTP"
ON public.collaboration_otp
FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.collaboration_sessions cs
          WHERE cs.id = collaboration_id AND cs.host_user_id = auth.uid())
);

CREATE POLICY "Only host can delete OTP"
ON public.collaboration_otp
FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.collaboration_sessions cs
          WHERE cs.id = collaboration_id AND cs.host_user_id = auth.uid())
);

DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins may write roles"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (public.has_role(auth.uid(), 'admin') OR current_setting('request.method', true) = 'GET')
WITH CHECK (public.has_role(auth.uid(), 'admin'));
