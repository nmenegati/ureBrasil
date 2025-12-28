-- Atualizar trigger para ignorar pagamentos de upsell
CREATE OR REPLACE FUNCTION public.create_student_card_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
    
    -- Inserir carteirinha (evitar duplicatas)
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
      'active',
      NOW()
    )
    ON CONFLICT (payment_id) DO NOTHING;
    
    RAISE NOTICE '✅ Carteirinha criada: % para student_id %', v_card_number, NEW.student_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Limpeza: Deletar carteirinhas criadas por pagamentos de upsell
DELETE FROM student_cards 
WHERE payment_id IN (
  SELECT id FROM payments 
  WHERE metadata->>'is_upsell' = 'true'
);

-- Limpeza: Atualizar carteirinhas originais para is_physical = true onde upsell foi aceito
UPDATE student_cards sc
SET is_physical = true
FROM payments p
WHERE p.metadata->>'is_upsell' = 'true'
  AND sc.payment_id = (p.metadata->>'original_payment_id')::UUID;