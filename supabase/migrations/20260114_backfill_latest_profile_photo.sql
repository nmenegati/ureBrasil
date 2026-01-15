-- =====================================================
-- MIGRATION: Backfill profile_photo_url com a Foto 3x4 aprovada mais recente
-- Data: 2026-01-14
-- =====================================================

-- Atualiza profile_photo_url para a foto 3x4 mais recente aprovada
-- Apenas quando o campo está vazio (para não sobrescrever manualmente)
ALTER TABLE student_profiles
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

UPDATE student_profiles sp
SET profile_photo_url = latest.file_url
FROM (
  SELECT DISTINCT ON (student_id) student_id, file_url
  FROM documents
  WHERE type = 'foto' AND status = 'approved'
  ORDER BY student_id, created_at DESC
) AS latest
WHERE sp.id = latest.student_id
  AND sp.profile_photo_url IS NULL;
