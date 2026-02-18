-- Atualizar URL de verificação no QR code das carteirinhas

-- 1. Recriar função auto_generate_card_data com nova URL
CREATE OR REPLACE FUNCTION auto_generate_card_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  student_data RECORD;
BEGIN
  IF NEW.card_number IS NULL THEN
    NEW.card_number := generate_card_number();
  END IF;

  IF NEW.usage_code IS NULL THEN
    NEW.usage_code := generate_usage_code();
  END IF;

  IF NEW.valid_until IS NULL THEN
    NEW.valid_until := calculate_card_validity(NEW.issued_at);
  END IF;

  SELECT 
    sp.full_name,
    sp.cpf,
    sp.institution,
    sp.course
  INTO student_data
  FROM student_profiles sp
  WHERE sp.id = NEW.student_id;

  NEW.qr_code := jsonb_build_object(
    'card_number', NEW.card_number,
    'usage_code', NEW.usage_code,
    'name', student_data.full_name,
    'cpf', CONCAT(LEFT(student_data.cpf, 3), '.***.***.', RIGHT(student_data.cpf, 2)),
    'institution', student_data.institution,
    'course', student_data.course,
    'valid_until', NEW.valid_until,
    'verification_url', 'https://urebrasil.com/verificar?code=' || NEW.usage_code
  )::TEXT;

  RETURN NEW;
END;
$$;

-- 2. Recriar função activate_student_card_on_docs_approved com nova URL
CREATE OR REPLACE FUNCTION public.activate_student_card_on_docs_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_approved INTEGER;
  v_student RECORD;
BEGIN
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'approved') THEN
    SELECT COUNT(*) INTO v_total_approved
    FROM documents
    WHERE student_id = NEW.student_id AND status = 'approved';

    IF v_total_approved >= 4 THEN
      SELECT * INTO v_student
      FROM student_profiles
      WHERE id = NEW.student_id;

      UPDATE student_cards
      SET 
        status = 'active',
        qr_code = jsonb_build_object(
          'card_number', card_number,
          'usage_code', usage_code,
          'name', v_student.full_name,
          'cpf', CONCAT(LEFT(v_student.cpf, 3), '.***.***.', RIGHT(v_student.cpf, 2)),
          'institution', v_student.institution,
          'course', v_student.course,
          'valid_until', valid_until,
          'verification_url', 'https://urebrasil.com/verificar?code=' || usage_code
        )::TEXT,
        updated_at = NOW()
      WHERE student_id = NEW.student_id
        AND status = 'pending_docs';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Atualizar QR code dos registros existentes
UPDATE student_cards
SET qr_code = jsonb_set(
  qr_code,
  '{verification_url}',
  to_jsonb('https://urebrasil.com/verificar?code=' || usage_code)
)
WHERE usage_code IS NOT NULL
  AND qr_code IS NOT NULL;

