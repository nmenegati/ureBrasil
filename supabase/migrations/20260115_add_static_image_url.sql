ALTER TABLE student_cards
ADD COLUMN IF NOT EXISTS static_image_url TEXT;

COMMENT ON COLUMN student_cards.static_image_url IS 'URL da imagem estática (gerada após aprovação)';

