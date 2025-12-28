-- 1. Resetar a sequência card_number_seq para o próximo valor válido
-- Primeiro, encontrar o maior número usado nas carteirinhas existentes
DO $$
DECLARE
  max_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CASE 
      WHEN card_number ~ '^EST-[0-9]{4}-[0-9]+$' 
      THEN SUBSTRING(card_number FROM 10)::INTEGER 
      ELSE 0 
    END
  ), 0) INTO max_num FROM student_cards;
  
  -- Resetar a sequência para o próximo valor
  PERFORM setval('card_number_seq', max_num, true);
  
  RAISE NOTICE 'Sequência resetada. Maior número encontrado: %. Próximo será: %', max_num, max_num + 1;
END $$;

-- 2. Melhorar a função generate_card_number() para ser mais robusta
CREATE OR REPLACE FUNCTION public.generate_card_number()
RETURNS character varying
LANGUAGE plpgsql
AS $function$
DECLARE
  year VARCHAR(4);
  sequence_num INTEGER;
  new_card_number VARCHAR;
  max_attempts INTEGER := 10;
  attempt INTEGER := 0;
BEGIN
  year := EXTRACT(YEAR FROM NOW())::VARCHAR;
  
  LOOP
    attempt := attempt + 1;
    sequence_num := nextval('card_number_seq');
    
    -- Garantir que não exceda 6 dígitos (resetar se necessário)
    IF sequence_num > 999999 THEN
      PERFORM setval('card_number_seq', 1, false);
      sequence_num := nextval('card_number_seq');
    END IF;
    
    new_card_number := 'EST-' || year || '-' || LPAD(sequence_num::VARCHAR, 6, '0');
    
    -- Verificar se já existe (evita constraint violation)
    IF NOT EXISTS (SELECT 1 FROM student_cards WHERE card_number = new_card_number) THEN
      RETURN new_card_number;
    END IF;
    
    -- Evitar loop infinito
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Não foi possível gerar número único de carteirinha após % tentativas', max_attempts;
    END IF;
  END LOOP;
END;
$function$;