-- Função 1
CREATE OR REPLACE FUNCTION public.activate_student_card_on_docs_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total_approved INTEGER;
  v_student RECORD;
BEGIN
  -- Só processar se status mudou para approved
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'approved') THEN
    
    -- Contar documentos aprovados para este estudante
    SELECT COUNT(*) INTO v_total_approved
    FROM documents
    WHERE student_id = NEW.student_id AND status = 'approved';
    
    RAISE NOTICE '📄 Documento aprovado para student_id %. Total aprovados: %', NEW.student_id, v_total_approved;
    
    -- Se todos 4 documentos aprovados
    IF v_total_approved >= 4 THEN
      
      -- Buscar dados completos do estudante
      SELECT * INTO v_student
      FROM student_profiles
      WHERE id = NEW.student_id;
      
      -- Ativar carteirinha e atualizar QR Code com dados completos
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
          'verification_url', 'https://urebr.vendatto.com/verificar/' || card_number
        )::TEXT,
        updated_at = NOW()
      WHERE student_id = NEW.student_id
        AND status = 'pending_docs';
      
      RAISE NOTICE '✅ Carteirinha ativada para student_id % - Todos 4 documentos aprovados!', NEW.student_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


-- Função 2
CREATE OR REPLACE FUNCTION auto_generate_card_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
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
    'verification_url', 'https://urebr.vendatto.com/verificar/' || NEW.card_number
  )::TEXT;
  
  RETURN NEW;
END;
$$;


-- Função 3
CREATE OR REPLACE FUNCTION public.calculate_card_validity(issue_date timestamp with time zone)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $function$
DECLARE
  validity_date DATE;
  issue_year INTEGER;
  march_31 DATE;
BEGIN
  issue_year := EXTRACT(YEAR FROM issue_date);
  march_31 := make_date(issue_year, 3, 31);
  
  -- Se emissão for antes ou igual a 31/03 do ano atual
  IF issue_date::DATE <= march_31 THEN
    validity_date := march_31;
  ELSE
    -- Caso contrário, 31/03 do ano seguinte
    validity_date := make_date(issue_year + 1, 3, 31);
  END IF;
  
  RETURN validity_date;
END;
$function$;


-- Função 4
CREATE OR REPLACE FUNCTION public.check_cpf_exists(p_cpf text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  cpf_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM public.student_profiles 
    WHERE cpf = p_cpf
      AND deleted_at IS NULL
  ) INTO cpf_exists;
  
  RETURN cpf_exists;
END;
$function$;


-- Função 5
CREATE OR REPLACE FUNCTION public.cleanup_expired_cpf_cache()
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  DELETE FROM cpf_validations WHERE expires_at < now();
END;
$function$;

