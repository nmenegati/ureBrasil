-- =====================================================
-- MIGRATION: Adicionar profile_photo_url e popular a partir da Foto 3x4 aprovada
-- Data: 2026-01-14
-- =====================================================

-- 1) Adicionar coluna se não existir
ALTER TABLE student_profiles
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

-- 2) Popular a coluna com fotos 3x4 aprovadas existentes
UPDATE student_profiles sp
SET profile_photo_url = d.file_url
FROM documents d
WHERE d.student_id = sp.id
  AND d.type = 'foto'
  AND d.status = 'approved'
  AND sp.profile_photo_url IS NULL;

-- 3) Comentários
COMMENT ON COLUMN student_profiles.profile_photo_url IS 'URL da Foto 3x4 aprovada usada como foto do perfil e da carteirinha';

