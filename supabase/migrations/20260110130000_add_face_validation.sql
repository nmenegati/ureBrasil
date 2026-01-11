-- Add face_validated column to student_profiles
ALTER TABLE student_profiles 
ADD COLUMN IF NOT EXISTS face_validated BOOLEAN DEFAULT false;

-- Function to trigger face comparison
CREATE OR REPLACE FUNCTION trigger_compare_faces()
RETURNS TRIGGER AS $$
DECLARE
  url TEXT := 'https://nwszukpenvkctthbsocw.supabase.co/functions/v1/compare-faces';
  key TEXT := '[COLE SUA SERVICE_ROLE_KEY]';
  v_count INTEGER;
BEGIN
  -- Check if we have all 3 required docs approved for this student
  -- We only trigger if the current update is approving one of the relevant docs
  IF NEW.status = 'approved' AND NEW.type IN ('rg', 'foto', 'selfie') THEN
    
    SELECT COUNT(*) INTO v_count
    FROM documents
    WHERE student_id = NEW.student_id
      AND type IN ('rg', 'foto', 'selfie')
      AND status = 'approved';

    -- If all 3 are approved (including the one just updated), trigger comparison
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
$$ LANGUAGE plpgsql;

-- Trigger definition
DROP TRIGGER IF EXISTS on_document_approved_compare_faces ON documents;
CREATE TRIGGER on_document_approved_compare_faces
  AFTER UPDATE OF status ON documents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_compare_faces();
