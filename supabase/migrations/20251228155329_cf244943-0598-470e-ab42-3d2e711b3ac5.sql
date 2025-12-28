-- 1. Criar sequence para números de carteirinha
CREATE SEQUENCE IF NOT EXISTS card_number_seq;

-- 2. Ajustar sequence para próximo número disponível (baseado nos existentes)
DO $$
DECLARE
  max_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(card_number, '[^0-9]', '', 'g'), '')::INTEGER), 0)
  INTO max_num
  FROM student_cards;
  
  PERFORM setval('card_number_seq', max_num + 1, false);
END $$;

-- 3. Atualizar função para usar sequence (thread-safe, sem race conditions)
CREATE OR REPLACE FUNCTION public.generate_card_number()
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
  year VARCHAR(4);
  sequence_num INTEGER;
BEGIN
  year := EXTRACT(YEAR FROM NOW())::VARCHAR;
  
  -- Usar sequence garante número único mesmo em chamadas simultâneas
  sequence_num := nextval('card_number_seq');
  
  -- Formato: EST-2025-000001
  RETURN 'EST-' || year || '-' || LPAD(sequence_num::VARCHAR, 6, '0');
END;
$$;