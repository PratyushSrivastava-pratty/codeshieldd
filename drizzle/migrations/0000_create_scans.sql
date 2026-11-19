CREATE TABLE public.scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  language TEXT NOT NULL,
  code TEXT NOT NULL,
  issue_count INTEGER NOT NULL DEFAULT 0,
  high_count INTEGER NOT NULL DEFAULT 0,
  issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.scans TO authenticated;
GRANT ALL ON public.scans TO service_role;

ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own scans" ON public.scans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own scans" ON public.scans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own scans" ON public.scans FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX scans_user_created_idx ON public.scans (user_id, created_at DESC);