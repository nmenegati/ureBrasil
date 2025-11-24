-- Phase 1: Garantir CPF único em student_profiles

-- Primeiro, verificar e remover duplicatas de CPF (se houver)
-- Manter apenas o registro mais antigo de cada CPF duplicado (por created_at)
DELETE FROM public.student_profiles
WHERE id NOT IN (
  SELECT DISTINCT ON (cpf) id
  FROM public.student_profiles
  ORDER BY cpf, created_at ASC
);

-- Adicionar constraint UNIQUE no CPF
ALTER TABLE public.student_profiles
ADD CONSTRAINT unique_cpf UNIQUE (cpf);

-- Adicionar índice para busca rápida por CPF (usado pelo admin)
CREATE INDEX IF NOT EXISTS idx_student_profiles_cpf ON public.student_profiles(cpf);

-- Log de alteração
COMMENT ON CONSTRAINT unique_cpf ON public.student_profiles IS 'Garante que cada CPF seja único no sistema. Implementado para prevenir fraudes e facilitar busca por CPF no painel admin.';