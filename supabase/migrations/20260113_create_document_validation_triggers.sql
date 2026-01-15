-- =====================================================
-- MIGRATION: Triggers de Validação de Documentos
-- =====================================================

-- 1. Habilitar extensão pg_net (para chamadas HTTP)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Criar função que chama Edge Function validate-document-v2
CREATE OR REPLACE FUNCTION trigger_validate_document()
RETURNS TRIGGER AS $$
DECLARE
  url TEXT := 'https://nwszukpenvkctthbsocw.supabase.co/functions/v1/validate-document-v2';
  service_key TEXT := '[COLE_SUA_SERVICE_ROLE_KEY_AQUI]';
BEGIN
  -- Só dispara se status for 'pending'
  IF NEW.status = 'pending' THEN
    -- Chamada assíncrona via pg_net
    PERFORM net.http_post(
      url := url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'document_id', NEW.id,
        'student_id', NEW.student_id,
        'type', NEW.type,
        'file_url', NEW.file_url
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Criar trigger em documents
DROP TRIGGER IF EXISTS documents_validation_trigger ON documents;
CREATE TRIGGER documents_validation_trigger
  AFTER INSERT OR UPDATE OF status ON documents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_validate_document();

-- 4. Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_student_id ON documents(student_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);

-- 5. Comentários
COMMENT ON FUNCTION trigger_validate_document IS 'Chama Edge Function validate-document-v2 quando documento fica pending';
COMMENT ON TRIGGER documents_validation_trigger ON documents IS 'Dispara validação automática de documentos';
