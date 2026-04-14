
-- Add dealer to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'dealer';

-- Create chat_rooms table
CREATE TABLE public.chat_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  created_by UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view chat rooms" ON public.chat_rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins/supervisors can insert chat rooms" ON public.chat_rooms FOR INSERT TO authenticated WITH CHECK (is_admin_or_supervisor(auth.uid()));
CREATE POLICY "Admins can delete chat rooms" ON public.chat_rooms FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Create chat_messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view non-deleted messages" ON public.chat_messages FOR SELECT TO authenticated USING (is_deleted = false);
CREATE POLICY "Authenticated users can send messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can soft-delete own messages" ON public.chat_messages FOR UPDATE TO authenticated USING (auth.uid() = sender_id);

-- Enable realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
