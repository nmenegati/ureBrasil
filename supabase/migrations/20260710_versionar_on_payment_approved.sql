-- Versionar função on_payment_approved() que existia apenas no banco.
-- Corrigido bug de cast: v_original_payment_id (TEXT) comparado com
-- payment_id (UUID) sem ::uuid nos CASOs 1 e 2.
-- Trigger associada: trigger_on_payment_approved (AFTER UPDATE ON payments)

CREATE OR REPLACE FUNCTION public.on_payment_approved()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_profile_id UUID;
  v_metadata JSONB;
  v_is_upsell BOOLEAN;
  v_is_physical_avulsa BOOLEAN;
  v_original_payment_id TEXT;
  v_plan_is_physical BOOLEAN;
BEGIN
  IF NEW.status <> 'approved' OR OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;
  v_profile_id := NEW.student_id;
  IF v_profile_id IS NULL THEN
    RETURN NEW;
  END IF;
  v_metadata := COALESCE(NEW.metadata::jsonb, '{}'::jsonb);
  v_is_upsell := COALESCE((v_metadata->>'is_upsell')::boolean, false);
  v_is_physical_avulsa := COALESCE((v_metadata->>'is_physical_avulsa')::boolean, false);
  v_original_payment_id := v_metadata->>'original_payment_id';
  -- CASO 1: Upsell físico
  IF v_is_upsell AND v_original_payment_id IS NOT NULL THEN
    UPDATE student_cards
    SET is_physical = true, updated_at = NOW()
    WHERE payment_id = v_original_payment_id::uuid
      AND is_physical = false;
    UPDATE student_profiles
    SET current_onboarding_step = 'upload_documents'
    WHERE id = v_profile_id
      AND current_onboarding_step IN ('upsell_physical', 'payment_upsell');
    RETURN NEW;
  END IF;
  -- CASO 2: Física avulsa
  IF v_is_physical_avulsa AND v_original_payment_id IS NOT NULL THEN
    UPDATE student_cards
    SET is_physical = true, updated_at = NOW()
    WHERE payment_id = v_original_payment_id::uuid
      AND is_physical = false;
    RETURN NEW;
  END IF;
  -- CASO 3: Pagamento principal (digital)
  IF NOT v_is_upsell AND NOT v_is_physical_avulsa THEN
    SELECT is_physical INTO v_plan_is_physical
    FROM plans
    WHERE id = NEW.plan_id;
    IF v_plan_is_physical THEN
      UPDATE student_profiles
      SET current_onboarding_step = 'upload_documents'
      WHERE id = v_profile_id
        AND current_onboarding_step IN ('choose_plan', 'payment');
    ELSE
      UPDATE student_profiles
      SET current_onboarding_step = 'upsell_physical'
      WHERE id = v_profile_id
        AND current_onboarding_step IN ('choose_plan', 'payment');
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$function$;

-- Garantir que o trigger existe (idempotente)
-- Nota: o trigger já existe em produção, este DROP/CREATE garante
-- que o estado do banco bata com o repo.
DROP TRIGGER IF EXISTS trigger_on_payment_approved ON payments;
CREATE TRIGGER trigger_on_payment_approved
  AFTER UPDATE ON payments
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved')
  EXECUTE FUNCTION on_payment_approved();

-- Documentação dos triggers em payments:
-- 1. on_payment_approved (AFTER INSERT OR UPDATE) → create_student_card_on_payment()
--    Cria student_card quando pagamento principal é aprovado (ou atualiza para físico em upsell)
-- 2. trigger_on_payment_approved (AFTER UPDATE, WHEN approved) → on_payment_approved()
--    Gerencia onboarding step e atualiza is_physical para upsell/física avulsa
-- 3. update_payments_updated_at (BEFORE UPDATE) → update_updated_at_column()
--    Atualiza timestamp
