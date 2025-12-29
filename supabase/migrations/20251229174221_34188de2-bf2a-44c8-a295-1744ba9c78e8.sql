-- 1. Adicionar coluna usage_code na tabela student_cards
ALTER TABLE student_cards 
ADD COLUMN IF NOT EXISTS usage_code VARCHAR(8) UNIQUE;

-- 2. Criar função generate_usage_code()
CREATE OR REPLACE FUNCTION generate_usage_code()
RETURNS VARCHAR AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result VARCHAR(8) := '';
  i INTEGER;
  max_attempts INTEGER := 10;
  attempt INTEGER := 0;
BEGIN
  LOOP
    attempt := attempt + 1;
    result := '';
    
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    
    IF NOT EXISTS (SELECT 1 FROM student_cards WHERE usage_code = result) THEN
      RETURN result;
    END IF;
    
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Não foi possível gerar código único após % tentativas', max_attempts;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. Atualizar trigger auto_generate_card_data()
CREATE OR REPLACE FUNCTION auto_generate_card_data()
RETURNS TRIGGER AS $$
DECLARE
  student_data RECORD;
BEGIN
  -- Gerar card_number se não existir
  IF NEW.card_number IS NULL THEN
    NEW.card_number := generate_card_number();
  END IF;
  
  -- Gerar usage_code se não existir
  IF NEW.usage_code IS NULL THEN
    NEW.usage_code := generate_usage_code();
  END IF;
  
  -- Calcular validade se não existir
  IF NEW.valid_until IS NULL THEN
    NEW.valid_until := calculate_card_validity(NEW.issued_at);
  END IF;
  
  -- Buscar dados do estudante para QR Code
  SELECT 
    sp.full_name,
    sp.cpf,
    sp.institution,
    sp.course
  INTO student_data
  FROM student_profiles sp
  WHERE sp.id = NEW.student_id;
  
  -- Gerar QR Code com JSON completo (CPF parcialmente mascarado)
  NEW.qr_code := jsonb_build_object(
    'card_number', NEW.card_number,
    'usage_code', NEW.usage_code,
    'name', student_data.full_name,
    'cpf', CONCAT(LEFT(student_data.cpf, 3), '.***.***.', RIGHT(student_data.cpf, 2)),
    'institution', student_data.institution,
    'course', student_data.course,
    'valid_until', NEW.valid_until,
    'verification_url', 'https://ure.vendatto.com/verificar/' || NEW.card_number
  )::TEXT;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Gerar usage_code para carteirinhas existentes
UPDATE student_cards 
SET usage_code = generate_usage_code()
WHERE usage_code IS NULL;

-- 5. Atualizar QR codes existentes com JSON completo
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
)
WHERE sc.qr_code LIKE 'URE-%' OR sc.qr_code NOT LIKE '{%';