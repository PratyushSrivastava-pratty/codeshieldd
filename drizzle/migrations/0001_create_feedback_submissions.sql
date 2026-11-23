CREATE TABLE public.feedback_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  email TEXT NOT NULL CHECK (char_length(email) BETWEEN 3 AND 255),
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general','bug','idea','praise')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.feedback_submissions TO anon, authenticated;
GRANT ALL ON public.feedback_submissions TO service_role;

ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can send feedback"
ON public.feedback_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());