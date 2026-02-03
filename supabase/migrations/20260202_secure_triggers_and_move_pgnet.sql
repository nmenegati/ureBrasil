-- supabase/migrations/20260202_secure_triggers_and_move_pgnet.sql

-- =========================================
-- FASE 2: Segurança + Organização
-- =========================================

-- 1. MOVER pg_net PARA SCHEMA extensions
ALTER EXTENSION pg_net SET SCHEMA extensions;

-- 2. ATUALIZAR trigger_validate_document (usar Vault + search_path)
CREATE OR REPLACE FUNCTION public.trigger_validate_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
  url TEXT := 'https://zyfbxzjfpncxfawthsht.supabase.co/functions/v1/validate-document-v2';
  key TEXT;
BEGIN
  -- Buscar key do Vault
  SELECT decrypted_secret INTO key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';
  
  IF NEW.status = 'pending' THEN
    PERFORM net.http_post(
      url := url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || key
      ),
      body := jsonb_build_object('record', row_to_json(NEW))
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. ATUALIZAR trigger_compare_faces (usar Vault + search_path)
CREATE OR REPLACE FUNCTION public.trigger_compare_faces()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
  url TEXT := 'https://zyfbxzjfpncxfawthsht.supabase.co/functions/v1/compare-faces';
  key TEXT;
  v_count INTEGER;
BEGIN
  -- Buscar key do Vault
  SELECT decrypted_secret INTO key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';
  
  IF NEW.status = 'approved' AND NEW.type IN ('rg', 'foto', 'selfie') THEN
    
    SELECT COUNT(*) INTO v_count
    FROM documents
    WHERE student_id = NEW.student_id
      AND type IN ('rg', 'foto', 'selfie')
      AND status = 'approved';

    IF v_count >= 3 THEN
      PERFORM net.http_post(
        url := url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || key
        ),
        body := jsonb_build_object('student_id', NEW.student_id)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

