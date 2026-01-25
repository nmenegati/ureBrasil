ALTER TABLE student_cards
ADD COLUMN IF NOT EXISTS physical_card_front_url TEXT;

ALTER TABLE student_cards
ADD COLUMN IF NOT EXISTS physical_card_back_url TEXT;

