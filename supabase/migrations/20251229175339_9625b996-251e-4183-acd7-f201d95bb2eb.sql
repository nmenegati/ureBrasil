-- 1. Alterar coluna usage_code para VARCHAR(9)
ALTER TABLE student_cards 
ALTER COLUMN usage_code TYPE VARCHAR(9);

-- 2. Atualizar função generate_usage_code() para novo formato NNNN-LNNN
CREATE OR REPLACE FUNCTION generate_usage_code()
RETURNS VARCHAR AS $$
DECLARE
  new_code VARCHAR(9);
  code_exists BOOLEAN;
  max_attempts INTEGER := 10;
  attempt INTEGER := 0;
BEGIN
  LOOP
    attempt := attempt + 1;
    
    -- Gerar 4 números + hífen + letra + 3 números (ex: 3164-D887)
    new_code := 
      LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0') || 
      '-' ||
      CHR(65 + FLOOR(RANDOM() * 26)::INTEGER) || 
      LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0');
    
    -- Verificar se já existe
    SELECT EXISTS(
      SELECT 1 FROM student_cards WHERE usage_code = new_code
    ) INTO code_exists;
    
    -- Se não existe, retornar
    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
    
    -- Evitar loop infinito
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Não foi possível gerar código único após % tentativas', max_attempts;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. Regenerar usage_code para todas as carteirinhas existentes
UPDATE student_cards 
SET usage_code = generate_usage_code();

-- 4. Atualizar QR codes com novo usage_code
UPDATE student_cards sc
SET qr_code = (
  SELECT jsonb_build_object(
    'card_number', sc.card_number,
    'usage_code', sc.usage_code,
    'name', sp.full_name,
    'cpf', CONCAT(LEFT(sp.cpf, 3), '.***.***.', RIGHT(sp.cpf, 2)),
    'institution', sp.institution,
    'course', sp.course,
    'valid_until', sc.valid_until,
    'verification_url', 'https://ure.vendatto.com/verificar/' || sc.card_number
  )::TEXT
  FROM student_profiles sp
  WHERE sp.id = sc.student_id
);