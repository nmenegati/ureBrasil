-- Migration: 20260430_create_is_admin_function.sql
-- Cria função helper is_admin() para uso nas RLS policies do painel admin.
-- SECURITY DEFINER: executa com permissões do dono da função, ignorando RLS
-- da própria tabela admin_users durante a verificação.
-- STABLE: resultado é constante dentro de uma transação, permite cache pelo planner.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM admin_users
    WHERE auth_user_id = auth.uid()
      AND is_active = true
  );
$$;
