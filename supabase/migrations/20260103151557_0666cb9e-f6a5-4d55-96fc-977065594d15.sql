-- Adicionar coluna para identificar estudante de Direito
ALTER TABLE student_profiles 
ADD COLUMN IF NOT EXISTS is_law_student BOOLEAN DEFAULT false;

-- Função para detectar se curso é Direito
CREATE OR REPLACE FUNCTION detect_law_student()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.course ILIKE '%direito%' THEN
    NEW.is_law_student := true;
  ELSE
    NEW.is_law_student := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger que executa na inserção/atualização do curso
DROP TRIGGER IF EXISTS on_course_update ON student_profiles;
CREATE TRIGGER on_course_update
  BEFORE INSERT OR UPDATE OF course ON student_profiles
  FOR EACH ROW
  EXECUTE FUNCTION detect_law_student();

-- Atualizar registros existentes
UPDATE student_profiles 
SET is_law_student = (course ILIKE '%direito%')
WHERE course IS NOT NULL;