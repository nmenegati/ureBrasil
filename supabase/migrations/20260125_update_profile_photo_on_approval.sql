CREATE OR REPLACE FUNCTION update_profile_photo_on_foto_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'foto'
     AND NEW.status = 'approved' THEN
    UPDATE student_profiles
    SET profile_photo_url = NEW.file_url
    WHERE id = NEW.student_id
      AND (profile_photo_url IS NULL OR profile_photo_url = '');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS documents_profile_photo_trigger ON documents;
CREATE TRIGGER documents_profile_photo_trigger
  AFTER INSERT OR UPDATE OF status ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_photo_on_foto_approved();

