-- Shared sync queue mirror so admins can see every user's offline-queued entries
CREATE TABLE public.sync_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_entry_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  user_email TEXT,
  target_table TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '[]'::jsonb,
  label TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  CONSTRAINT sync_queue_status_check CHECK (status IN ('pending','syncing','failed','succeeded')),
  CONSTRAINT sync_queue_unique_client UNIQUE (user_id, client_entry_id)
);

CREATE INDEX idx_sync_queue_status ON public.sync_queue(status);
CREATE INDEX idx_sync_queue_user ON public.sync_queue(user_id);
CREATE INDEX idx_sync_queue_created ON public.sync_queue(created_at DESC);

ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "Admins can view all sync queue entries"
  ON public.sync_queue FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all sync queue entries"
  ON public.sync_queue FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete sync queue entries"
  ON public.sync_queue FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Supervisors: view-only (UI redacts payload)
CREATE POLICY "Supervisors can view all sync queue entries"
  ON public.sync_queue FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role));

-- Users: insert/view/delete own entries (so client can mirror local queue)
CREATE POLICY "Users can insert own sync queue entries"
  ON public.sync_queue FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own sync queue entries"
  ON public.sync_queue FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own sync queue entries"
  ON public.sync_queue FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sync queue entries"
  ON public.sync_queue FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- updated_at trigger
CREATE TRIGGER update_sync_queue_updated_at
  BEFORE UPDATE ON public.sync_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();