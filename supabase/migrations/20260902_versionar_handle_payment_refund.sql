-- Versionar função handle_payment_refund() aplicada diretamente em produção.
-- v4.1:
-- 1. Usa metadata (is_upsell / is_physical_avulsa) como discriminador.
-- 2. Remove heurística por student_id para add-on sem original_payment_id.
-- 3. Só trata como principal se existir student_card vinculada ao payment_id.

CREATE OR REPLACE FUNCTION public.handle_payment_refund()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_metadata JSONB;
  v_is_upsell BOOLEAN;
  v_is_physical_avulsa BOOLEAN;
  v_original_payment_id UUID;
  v_target_card_id UUID;
BEGIN
  IF NEW.status <> 'refunded' OR OLD.status = 'refunded' THEN
    RETURN NEW;
  END IF;

  v_metadata := COALESCE(NEW.metadata::jsonb, '{}'::jsonb);
  v_is_upsell := COALESCE((v_metadata->>'is_upsell')::boolean, false);
  v_is_physical_avulsa := COALESCE((v_metadata->>'is_physical_avulsa')::boolean, false);

  IF v_is_upsell OR v_is_physical_avulsa THEN
    BEGIN
      v_original_payment_id := (v_metadata->>'original_payment_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_original_payment_id := NULL;
    END;

    IF v_original_payment_id IS NOT NULL THEN
      UPDATE student_cards
      SET is_physical = false,
          physical_card_front_url = NULL,
          physical_card_back_url = NULL
      WHERE payment_id = v_original_payment_id;
    ELSE
      RAISE LOG 'handle_payment_refund: add-on sem original_payment_id - payment_id %, student_id %. Nenhuma acao tomada.', NEW.id, NEW.student_id;
    END IF;

    RETURN NEW;
  END IF;

  SELECT id INTO v_target_card_id
  FROM student_cards
  WHERE payment_id = NEW.id
  LIMIT 1;

  IF v_target_card_id IS NOT NULL THEN
    UPDATE student_cards
    SET status = 'cancelled',
        digital_card_url = NULL
    WHERE payment_id = NEW.id;

    UPDATE student_profiles
    SET current_onboarding_step = 'payment'
    WHERE id = NEW.student_id;
  ELSE
    RAISE LOG 'handle_payment_refund: pagamento % sem flags de upsell e sem carteira vinculada. Caso ambiguo - nenhuma acao tomada.', NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Garantir que o trigger existe (idempotente)
DROP TRIGGER IF EXISTS trigger_payment_refund ON public.payments;
CREATE TRIGGER trigger_payment_refund
  AFTER UPDATE ON public.payments
  FOR EACH ROW
  WHEN (NEW.status = 'refunded' AND OLD.status IS DISTINCT FROM 'refunded')
  EXECUTE FUNCTION public.handle_payment_refund();

-- Documentação dos triggers em payments:
-- 1. on_payment_approved (AFTER UPDATE, WHEN approved) → on_payment_approved()
--    Atualiza onboarding e is_physical para upsell/física avulsa.
-- 2. trigger_payment_refund (AFTER UPDATE, WHEN refunded) → handle_payment_refund()
--    Reverte add-on físico ou cancela carteira principal quando há vínculo por payment_id.
