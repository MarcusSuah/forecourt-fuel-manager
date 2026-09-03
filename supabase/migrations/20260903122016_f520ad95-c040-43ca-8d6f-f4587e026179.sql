REVOKE ALL ON FUNCTION public.block_if_credentials_pending() FROM anon, PUBLIC;

DROP POLICY IF EXISTS "Authenticated users can view chat rooms" ON public.chat_rooms;

CREATE POLICY "Users can view rooms in their scope"
ON public.chat_rooms
FOR SELECT
TO authenticated
USING (
  branch_id IS NULL
  OR public.can_view_branch(auth.uid(), branch_id)
);