-- 1. Atualizar trigger create_student_card_on_payment para status 'pending_docs'
CREATE OR REPLACE FUNCTION public.create_student_card_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan plans%ROWTYPE;
  v_card_number VARCHAR;
  v_valid_until DATE;
  v_is_upsell BOOLEAN;
BEGIN
  -- Só executar se status mudou para approved
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'approved') THEN
    
    -- Verificar se é pagamento de upsell (não criar nova carteirinha)
    v_is_upsell := COALESCE((NEW.metadata->>'is_upsell')::BOOLEAN, false);
    
    IF v_is_upsell THEN
      -- É upsell: apenas atualizar carteirinha existente para física
      UPDATE student_cards 
      SET is_physical = true, updated_at = NOW()
      WHERE payment_id = (NEW.metadata->>'original_payment_id')::UUID;
      
      RAISE NOTICE '✅ Carteirinha atualizada para física (upsell) para student_id %', NEW.student_id;
      RETURN NEW;
    END IF;
    
    -- Buscar dados do plano
    SELECT * INTO v_plan FROM plans WHERE id = NEW.plan_id;
    
    -- Gerar número da carteirinha
    v_card_number := generate_card_number();
    
    -- Calcular validade
    v_valid_until := calculate_card_validity(NOW());
    
    -- Inserir carteirinha com status 'pending_docs' (aguardando aprovação dos documentos)
    INSERT INTO student_cards (
      student_id,
      payment_id,
      card_type,
      is_physical,
      card_number,
      qr_code,
      valid_until,
      status,
      issued_at
    )
    VALUES (
      NEW.student_id,
      NEW.id,
      v_plan.type,
      v_plan.is_physical,
      v_card_number,
      'URE-' || v_card_number,
      v_valid_until,
      'pending_docs',  -- MUDANÇA: era 'active', agora é 'pending_docs'
      NOW()
    )
    ON CONFLICT (payment_id) DO NOTHING;
    
    RAISE NOTICE '✅ Carteirinha criada com status pending_docs: % para student_id %', v_card_number, NEW.student_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Criar nova função para ativar carteirinha quando 4 documentos são aprovados
CREATE OR REPLACE FUNCTION public.activate_student_card_on_docs_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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
          'verification_url', 'https://ure.vendatto.com/verificar/' || card_number
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

-- 3. Criar trigger para ativar carteirinha quando documentos são aprovados
DROP TRIGGER IF EXISTS on_document_approved ON documents;
CREATE TRIGGER on_document_approved
  AFTER UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION activate_student_card_on_docs_approved();