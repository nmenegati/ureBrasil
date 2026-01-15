-- =====================================================
-- MIGRATION: Trigger de Comparação Facial
-- =====================================================

-- Função que verifica se todos 3 docs estão aprovados e chama compare-faces
CREATE OR REPLACE FUNCTION trigger_compare_faces()
RETURNS TRIGGER AS $$
DECLARE
  url TEXT := 'https://nwszukpenvkctthbsocw.supabase.co/functions/v1/compare-faces';
  service_key TEXT := '[COLE_SUA_SERVICE_ROLE_KEY_AQUI]';
  docs_aprovados INTEGER;
BEGIN
  -- Só dispara se status mudou para 'approved' e tipo é rg, foto ou selfie
  IF NEW.status = 'approved' AND NEW.type IN ('rg', 'foto', 'selfie') THEN
    
    -- Conta quantos docs desses 3 tipos estão aprovados
    SELECT COUNT(*) INTO docs_aprovados
    FROM documents
    WHERE student_id = NEW.student_id
      AND type IN ('rg', 'foto', 'selfie')
      AND status = 'approved';
    
    -- Se os 3 estão aprovados, dispara comparação facial
    IF docs_aprovados >= 3 THEN
      PERFORM net.http_post(
        url := url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := jsonb_build_object('student_id', NEW.student_id)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger
DROP TRIGGER IF EXISTS documents_face_comparison_trigger ON documents;
CREATE TRIGGER documents_face_comparison_trigger
  AFTER UPDATE OF status ON documents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_compare_faces();

COMMENT ON FUNCTION trigger_compare_faces IS 'Dispara compare-faces quando RG, Foto 3x4 e Selfie estão aprovados';
