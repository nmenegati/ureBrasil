ALTER TABLE student_cards
ADD COLUMN IF NOT EXISTS digital_card_generated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS generation_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_generation_error TEXT;

CREATE TABLE IF NOT EXISTS card_generation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  card_type TEXT NOT NULL,
  status TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  error_message TEXT,
  cost_cents INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE card_generation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view card generation logs"
  ON card_generation_logs FOR SELECT
  USING (
    "public"."has_any_role"(auth.uid(), ARRAY['admin'::public.user_role, 'manager'::public.user_role])
  );

