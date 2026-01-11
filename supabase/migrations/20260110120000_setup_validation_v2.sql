-- Create audit_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    student_id UUID REFERENCES student_profiles(id),
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    details JSONB
);

-- Enable RLS on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Ensure pg_net extension is enabled for HTTP requests
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- Function to trigger the Edge Function
CREATE OR REPLACE FUNCTION trigger_validate_document()
RETURNS TRIGGER AS $$
DECLARE
  -- URL da Edge Function (Projeto ID: nwszukpenvkctthbsocw)
  url TEXT := 'https://nwszukpenvkctthbsocw.supabase.co/functions/v1/validate-document-v2';
  -- IMPORTANTE: Substitua abaixo pela sua SERVICE_ROLE_KEY do Supabase Dashboard > Project Settings > API
  key TEXT := '[COLE SUA SERVICE_ROLE_KEY]';
BEGIN
  -- Dispara apenas se o status for 'pending' (novo documento ou reenvio)
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
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS documents_validation_trigger ON documents;
CREATE TRIGGER documents_validation_trigger
  AFTER INSERT OR UPDATE OF status ON documents
  FOR EACH ROW EXECUTE FUNCTION trigger_validate_document();
