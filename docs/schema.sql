-- Schema gerado a partir das migrations em 2026-03-26
-- Projeto: zyfbxzjfpncxfawthsht

-- ============================================================
-- Migration: 20251124134951_26b7cb4e-cd8e-4cdb-aa51-1d3a929eb670.sql
-- ============================================================

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
-- ============================================================
-- Migration: 20251216192350_0974d9b8-a9d3-4919-8b9a-93bab1cef719.sql
-- ============================================================

-- Remover política antiga que só permite UPDATE em 'pending'
DROP POLICY IF EXISTS "Users can update their own pending documents" ON documents;

-- Criar nova política que permite UPDATE em 'pending' OU 'rejected'
CREATE POLICY "Users can update their own pending or rejected documents"
ON documents
FOR UPDATE
TO authenticated
USING (
  (student_id IN (
    SELECT student_profiles.id
    FROM student_profiles
    WHERE student_profiles.user_id = auth.uid()
  ))
  AND status IN ('pending', 'rejected')
)
WITH CHECK (
  (student_id IN (
    SELECT student_profiles.id
    FROM student_profiles
    WHERE student_profiles.user_id = auth.uid()
  ))
);
-- ============================================================
-- Migration: 20251216195120_0a67a178-bfec-4d4b-b040-f904dfaf2073.sql
-- ============================================================

-- Atualizar preços dos planos conforme especificado
UPDATE plans SET price = 44.00 WHERE type = 'geral_fisica';
UPDATE plans SET price = 44.00 WHERE type = 'direito_digital';
UPDATE plans SET price = 59.00 WHERE type = 'direito_fisica';
-- ============================================================
-- Migration: 20251217151108_b6af20db-c4cd-4310-87f1-117daa52414c.sql
-- ============================================================

-- Add avatar_url column to student_profiles
ALTER TABLE public.student_profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;
-- ============================================================
-- Migration: 20251217204839_2eb5da9f-911f-44d8-b809-8a2eb6ed90a9.sql
-- ============================================================

-- Primeiro, atualizar o registro mais recente para remover duplicidade
UPDATE student_profiles 
SET phone = '31900000001' 
WHERE id = 'acfbed13-3586-4e57-9821-5333a4a7fc20';

-- Adicionar constraint UNIQUE no telefone
ALTER TABLE student_profiles
ADD CONSTRAINT student_profiles_phone_key UNIQUE (phone);
-- ============================================================
-- Migration: 20251228151731_168f8938-fcef-4b96-b6fd-7e1fd606b910.sql
-- ============================================================

-- Atualizar trigger para ignorar pagamentos de upsell
CREATE OR REPLACE FUNCTION public.create_student_card_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_plan plans%ROWTYPE;
  v_card_number VARCHAR;
  v_valid_until DATE;
  v_is_upsell BOOLEAN;
BEGIN
  -- Só executar se status mudou para approved
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'approved') THEN
    
    -- Verificar se é pagamento de upsell (não criar nova carteirinha)
    v_is_upsell := COALESCE((NEW.metadata->>'is_upsell')::BOOLEAN, false);
    
    IF v_is_upsell THEN
      -- É upsell: apenas atualizar carteirinha existente para física
      UPDATE student_cards 
      SET is_physical = true, updated_at = NOW()
      WHERE payment_id = (NEW.metadata->>'original_payment_id')::UUID;
      
      RAISE NOTICE '✅ Carteirinha atualizada para física (upsell) para student_id %', NEW.student_id;
      RETURN NEW;
    END IF;
    
    -- Buscar dados do plano
    SELECT * INTO v_plan FROM plans WHERE id = NEW.plan_id;
    
    -- Gerar número da carteirinha
    v_card_number := generate_card_number();
    
    -- Calcular validade
    v_valid_until := calculate_card_validity(NOW());
    
    -- Inserir carteirinha (evitar duplicatas)
    INSERT INTO student_cards (
      student_id,
      payment_id,
      card_type,
      is_physical,
      card_number,
      qr_code,
      valid_until,
      status,
      issued_at
    )
    VALUES (
      NEW.student_id,
      NEW.id,
      v_plan.type,
      v_plan.is_physical,
      v_card_number,
      'URE-' || v_card_number,
      v_valid_until,
      'active',
      NOW()
    )
    ON CONFLICT (payment_id) DO NOTHING;
    
    RAISE NOTICE '✅ Carteirinha criada: % para student_id %', v_card_number, NEW.student_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Limpeza: Deletar carteirinhas criadas por pagamentos de upsell
DELETE FROM student_cards 
WHERE payment_id IN (
  SELECT id FROM payments 
  WHERE metadata->>'is_upsell' = 'true'
);

-- Limpeza: Atualizar carteirinhas originais para is_physical = true onde upsell foi aceito
UPDATE student_cards sc
SET is_physical = true
FROM payments p
WHERE p.metadata->>'is_upsell' = 'true'
  AND sc.payment_id = (p.metadata->>'original_payment_id')::UUID;
-- ============================================================
-- Migration: 20251228155329_cf244943-0598-470e-ab42-3d2e711b3ac5.sql
-- ============================================================

-- 1. Criar sequence para números de carteirinha
CREATE SEQUENCE IF NOT EXISTS card_number_seq;

-- 2. Ajustar sequence para próximo número disponível (baseado nos existentes)
DO $$
DECLARE
  max_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(card_number, '[^0-9]', '', 'g'), '')::INTEGER), 0)
  INTO max_num
  FROM student_cards;
  
  PERFORM setval('card_number_seq', max_num + 1, false);
END $$;

-- 3. Atualizar função para usar sequence (thread-safe, sem race conditions)
CREATE OR REPLACE FUNCTION public.generate_card_number()
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
  year VARCHAR(4);
  sequence_num INTEGER;
BEGIN
  year := EXTRACT(YEAR FROM NOW())::VARCHAR;
  
  -- Usar sequence garante número único mesmo em chamadas simultâneas
  sequence_num := nextval('card_number_seq');
  
  -- Formato: EST-2025-000001
  RETURN 'EST-' || year || '-' || LPAD(sequence_num::VARCHAR, 6, '0');
END;
$$;
-- ============================================================
-- Migration: 20251228185321_10486085-dc8f-4e79-ad1b-b69d775291cc.sql
-- ============================================================

-- 1. Resetar a sequência card_number_seq para o próximo valor válido
-- Primeiro, encontrar o maior número usado nas carteirinhas existentes
DO $$
DECLARE
  max_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CASE 
      WHEN card_number ~ '^EST-[0-9]{4}-[0-9]+$' 
      THEN SUBSTRING(card_number FROM 10)::INTEGER 
      ELSE 0 
    END
  ), 0) INTO max_num FROM student_cards;
  
  -- Resetar a sequência para o próximo valor
  PERFORM setval('card_number_seq', max_num, true);
  
  RAISE NOTICE 'Sequência resetada. Maior número encontrado: %. Próximo será: %', max_num, max_num + 1;
END $$;

-- 2. Melhorar a função generate_card_number() para ser mais robusta
CREATE OR REPLACE FUNCTION public.generate_card_number()
RETURNS character varying
LANGUAGE plpgsql
AS $function$
DECLARE
  year VARCHAR(4);
  sequence_num INTEGER;
  new_card_number VARCHAR;
  max_attempts INTEGER := 10;
  attempt INTEGER := 0;
BEGIN
  year := EXTRACT(YEAR FROM NOW())::VARCHAR;
  
  LOOP
    attempt := attempt + 1;
    sequence_num := nextval('card_number_seq');
    
    -- Garantir que não exceda 6 dígitos (resetar se necessário)
    IF sequence_num > 999999 THEN
      PERFORM setval('card_number_seq', 1, false);
      sequence_num := nextval('card_number_seq');
    END IF;
    
    new_card_number := 'EST-' || year || '-' || LPAD(sequence_num::VARCHAR, 6, '0');
    
    -- Verificar se já existe (evita constraint violation)
    IF NOT EXISTS (SELECT 1 FROM student_cards WHERE card_number = new_card_number) THEN
      RETURN new_card_number;
    END IF;
    
    -- Evitar loop infinito
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Não foi possível gerar número único de carteirinha após % tentativas', max_attempts;
    END IF;
  END LOOP;
END;
$function$;
-- ============================================================
-- Migration: 20251229174221_34188de2-bf2a-44c8-a295-1744ba9c78e8.sql
-- ============================================================

-- 1. Adicionar coluna usage_code na tabela student_cards
ALTER TABLE student_cards 
ADD COLUMN IF NOT EXISTS usage_code VARCHAR(8) UNIQUE;

-- 2. Criar função generate_usage_code()
CREATE OR REPLACE FUNCTION generate_usage_code()
RETURNS VARCHAR AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result VARCHAR(8) := '';
  i INTEGER;
  max_attempts INTEGER := 10;
  attempt INTEGER := 0;
BEGIN
  LOOP
    attempt := attempt + 1;
    result := '';
    
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    
    IF NOT EXISTS (SELECT 1 FROM student_cards WHERE usage_code = result) THEN
      RETURN result;
    END IF;
    
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Não foi possível gerar código único após % tentativas', max_attempts;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. Atualizar trigger auto_generate_card_data()
CREATE OR REPLACE FUNCTION auto_generate_card_data()
RETURNS TRIGGER AS $$
DECLARE
  student_data RECORD;
BEGIN
  -- Gerar card_number se não existir
  IF NEW.card_number IS NULL THEN
    NEW.card_number := generate_card_number();
  END IF;
  
  -- Gerar usage_code se não existir
  IF NEW.usage_code IS NULL THEN
    NEW.usage_code := generate_usage_code();
  END IF;
  
  -- Calcular validade se não existir
  IF NEW.valid_until IS NULL THEN
    NEW.valid_until := calculate_card_validity(NEW.issued_at);
  END IF;
  
  -- Buscar dados do estudante para QR Code
  SELECT 
    sp.full_name,
    sp.cpf,
    sp.institution,
    sp.course
  INTO student_data
  FROM student_profiles sp
  WHERE sp.id = NEW.student_id;
  
  -- Gerar QR Code com JSON completo (CPF parcialmente mascarado)
  NEW.qr_code := jsonb_build_object(
    'card_number', NEW.card_number,
    'usage_code', NEW.usage_code,
    'name', student_data.full_name,
    'cpf', CONCAT(LEFT(student_data.cpf, 3), '.***.***.', RIGHT(student_data.cpf, 2)),
    'institution', student_data.institution,
    'course', student_data.course,
    'valid_until', NEW.valid_until,
    'verification_url', 'https://ure.vendatto.com/verificar/' || NEW.card_number
  )::TEXT;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Gerar usage_code para carteirinhas existentes
UPDATE student_cards 
SET usage_code = generate_usage_code()
WHERE usage_code IS NULL;

-- 5. Atualizar QR codes existentes com JSON completo
UPDATE student_cards sc
SET qr_code = (
  SELECT jsonb_build_object(
    'card_number', sc.card_number,
    'usage_code', sc.usage_code,
    'name', sp.full_name,
    'cpf', CONCAT(LEFT(sp.cpf, 3), '.***.***.', RIGHT(sp.cpf, 2)),
    'institution', sp.institution,
    'course', sp.course,
    'valid_until', sc.valid_until,
    'verification_url', 'https://ure.vendatto.com/verificar/' || sc.card_number
  )::TEXT
  FROM student_profiles sp
  WHERE sp.id = sc.student_id
)
WHERE sc.qr_code LIKE 'URE-%' OR sc.qr_code NOT LIKE '{%';
-- ============================================================
-- Migration: 20251229175339_9625b996-251e-4183-acd7-f201d95bb2eb.sql
-- ============================================================

-- 1. Alterar coluna usage_code para VARCHAR(9)
ALTER TABLE student_cards 
ALTER COLUMN usage_code TYPE VARCHAR(9);

-- 2. Atualizar função generate_usage_code() para novo formato NNNN-LNNN
CREATE OR REPLACE FUNCTION generate_usage_code()
RETURNS VARCHAR AS $$
DECLARE
  new_code VARCHAR(9);
  code_exists BOOLEAN;
  max_attempts INTEGER := 10;
  attempt INTEGER := 0;
BEGIN
  LOOP
    attempt := attempt + 1;
    
    -- Gerar 4 números + hífen + letra + 3 números (ex: 3164-D887)
    new_code := 
      LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0') || 
      '-' ||
      CHR(65 + FLOOR(RANDOM() * 26)::INTEGER) || 
      LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0');
    
    -- Verificar se já existe
    SELECT EXISTS(
      SELECT 1 FROM student_cards WHERE usage_code = new_code
    ) INTO code_exists;
    
    -- Se não existe, retornar
    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
    
    -- Evitar loop infinito
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Não foi possível gerar código único após % tentativas', max_attempts;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. Regenerar usage_code para todas as carteirinhas existentes
UPDATE student_cards 
SET usage_code = generate_usage_code();

-- 4. Atualizar QR codes com novo usage_code
UPDATE student_cards sc
SET qr_code = (
  SELECT jsonb_build_object(
    'card_number', sc.card_number,
    'usage_code', sc.usage_code,
    'name', sp.full_name,
    'cpf', CONCAT(LEFT(sp.cpf, 3), '.***.***.', RIGHT(sp.cpf, 2)),
    'institution', sp.institution,
    'course', sp.course,
    'valid_until', sc.valid_until,
    'verification_url', 'https://ure.vendatto.com/verificar/' || sc.card_number
  )::TEXT
  FROM student_profiles sp
  WHERE sp.id = sc.student_id
);
-- ============================================================
-- Migration: 20260102205259_b724100d-d94d-4897-94c0-5e57ac2f6315.sql
-- ============================================================

-- 1. Atualizar trigger create_student_card_on_payment para status 'pending_docs'
-- FUNÇÃO: create_student_card_on_payment()
-- DISPARO: AFTER UPDATE em payments, quando status muda para 'approved'.
-- FLUXO:
--   - Ignora pagamentos marcados como upsell (metadata.is_upsell = true), atualizando
--     apenas is_physical da carteirinha original.
--   - Para pagamentos normais:
--       1) Busca o plano associado em plans.
--       2) Gera card_number e calcula valid_until.
--       3) Cria registro em student_cards com status 'pending_docs' ou 'active'
--          (dependendo da versão desta migration).
-- EFEITOS NO BANCO:
--   - INSERT em student_cards (uma carteirinha por pagamento aprovado).
-- ATENÇÃO:
--   - Depende de funções auxiliares generate_card_number() e calculate_card_validity().
CREATE OR REPLACE FUNCTION public.create_student_card_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan plans%ROWTYPE;
  v_card_number VARCHAR;
  v_valid_until DATE;
  v_is_upsell BOOLEAN;
BEGIN
  -- Só executar se status mudou para approved
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'approved') THEN
    
    -- Verificar se é pagamento de upsell (não criar nova carteirinha)
    v_is_upsell := COALESCE((NEW.metadata->>'is_upsell')::BOOLEAN, false);
    
    IF v_is_upsell THEN
      -- É upsell: apenas atualizar carteirinha existente para física
      UPDATE student_cards 
      SET is_physical = true, updated_at = NOW()
      WHERE payment_id = (NEW.metadata->>'original_payment_id')::UUID;
      
      RAISE NOTICE '✅ Carteirinha atualizada para física (upsell) para student_id %', NEW.student_id;
      RETURN NEW;
    END IF;
    
    -- Buscar dados do plano
    SELECT * INTO v_plan FROM plans WHERE id = NEW.plan_id;
    
    -- Gerar número da carteirinha
    v_card_number := generate_card_number();
    
    -- Calcular validade
    v_valid_until := calculate_card_validity(NOW());
    
    -- Inserir carteirinha com status 'pending_docs' (aguardando aprovação dos documentos)
    INSERT INTO student_cards (
      student_id,
      payment_id,
      card_type,
      is_physical,
      card_number,
      qr_code,
      valid_until,
      status,
      issued_at
    )
    VALUES (
      NEW.student_id,
      NEW.id,
      v_plan.type,
      v_plan.is_physical,
      v_card_number,
      'URE-' || v_card_number,
      v_valid_until,
      'pending_docs',  -- MUDANÇA: era 'active', agora é 'pending_docs'
      NOW()
    )
    ON CONFLICT (payment_id) DO NOTHING;
    
    RAISE NOTICE '✅ Carteirinha criada com status pending_docs: % para student_id %', v_card_number, NEW.student_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Criar nova função para ativar carteirinha quando 4 documentos são aprovados
CREATE OR REPLACE FUNCTION public.activate_student_card_on_docs_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_approved INTEGER;
  v_student RECORD;
BEGIN
  -- Só processar se status mudou para approved
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'approved') THEN
    
    -- Contar documentos aprovados para este estudante
    SELECT COUNT(*) INTO v_total_approved
    FROM documents
    WHERE student_id = NEW.student_id AND status = 'approved';
    
    RAISE NOTICE '📄 Documento aprovado para student_id %. Total aprovados: %', NEW.student_id, v_total_approved;
    
    -- Se todos 4 documentos aprovados
    IF v_total_approved >= 4 THEN
      
      -- Buscar dados completos do estudante
      SELECT * INTO v_student
      FROM student_profiles
      WHERE id = NEW.student_id;
      
      -- Ativar carteirinha e atualizar QR Code com dados completos
      UPDATE student_cards
      SET 
        status = 'active',
        qr_code = jsonb_build_object(
          'card_number', card_number,
          'usage_code', usage_code,
          'name', v_student.full_name,
          'cpf', CONCAT(LEFT(v_student.cpf, 3), '.***.***.', RIGHT(v_student.cpf, 2)),
          'institution', v_student.institution,
          'course', v_student.course,
          'valid_until', valid_until,
          'verification_url', 'https://ure.vendatto.com/verificar/' || card_number
        )::TEXT,
        updated_at = NOW()
      WHERE student_id = NEW.student_id
        AND status = 'pending_docs';
      
      RAISE NOTICE '✅ Carteirinha ativada para student_id % - Todos 4 documentos aprovados!', NEW.student_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Criar trigger para ativar carteirinha quando documentos são aprovados
DROP TRIGGER IF EXISTS on_document_approved ON documents;
CREATE TRIGGER on_document_approved
  AFTER UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION activate_student_card_on_docs_approved();

-- ============================================================
-- Migration: 20260103151557_0666cb9e-f6a5-4d55-96fc-977065594d15.sql
-- ============================================================

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
-- ============================================================
-- Migration: 20260110120000_setup_validation_v2.sql
-- ============================================================

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

-- ============================================================
-- Migration: 20260110130000_add_face_validation.sql
-- ============================================================

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

-- ============================================================
-- Migration: 20260110140000_schedule_cleanup.sql
-- ============================================================

-- Enable pg_cron extension if not enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the cleanup function to run daily at 3:00 AM
-- Note: You need to replace [PROJECT_REF] and [ANON_KEY] with actual values, 
-- or use an internal calling mechanism if available.
-- However, standard way in Supabase is using pg_net or invoking via cron.

-- Option A: Using pg_cron to call the function via HTTP (requires pg_net)
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'cleanup-rejected-docs-daily', -- name of the cron job
  '0 3 * * *',                   -- schedule: every day at 3:00 AM
  $$
  select
    net.http_post(
        url:='https://nwszukpenvkctthbsocw.supabase.co/functions/v1/cleanup-rejected-documents',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer [SUA_SERVICE_ROLE_KEY]"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- To check scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule:
-- SELECT cron.unschedule('cleanup-rejected-docs-daily');

-- ============================================================
-- Migration: 20260110150000_create_support_escalations.sql
-- ============================================================

create table if not exists public.support_escalations (
    id uuid default gen_random_uuid() primary key,
    student_id uuid references auth.users(id) on delete set null,
    tags text[] not null default '{}',
    conversation jsonb not null default '[]'::jsonb,
    status text not null default 'pending',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.support_escalations enable row level security;

create policy "Users can insert their own escalations"
    on public.support_escalations for insert
    with check (auth.uid() = student_id);

create policy "Users can view their own escalations"
    on public.support_escalations for select
    using (auth.uid() = student_id);

-- ============================================================
-- Migration: 20260111120000_update_plan_definitions.sql
-- ============================================================

-- Update Geral Digital Plan
UPDATE plans 
SET 
  name = 'Carteira Estudantil Digital (Geral)',
  description = 'Carteira estudantil válida para estudantes da educação básica (ensino infantil, fundamental e médio) e do ensino superior, incluindo cursos presenciais ou a distância.'
WHERE type = 'geral_digital';

-- Update Direito Digital Plan
UPDATE plans 
SET 
  name = 'Carteira Estudantil LexPraxis',
  description = 'Carteira estudantil exclusiva para estudantes regularmente matriculados em cursos de Direito no ensino superior.'
WHERE type = 'direito_digital';

-- ============================================================
-- Migration: 20260113_create_document_validation_triggers.sql
-- ============================================================

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

-- ============================================================
-- Migration: 20260113_create_face_comparison_trigger.sql
-- ============================================================

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

-- ============================================================
-- Migration: 20260114_add_profile_photo_url.sql
-- ============================================================

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


-- ============================================================
-- Migration: 20260114_backfill_latest_profile_photo.sql
-- ============================================================

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

-- ============================================================
-- Migration: 20260115161314_disable_rls_auth_users.sql
-- ============================================================

ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;
-- ============================================================
-- Migration: 20260115161958_allow_auth_admin_all.sql
-- ============================================================

CREATE POLICY allow_auth_admin_all ON auth.users FOR ALL TO supabase_auth_admin USING (true) WITH CHECK (true);
-- ============================================================
-- Migration: 20260115163604_disable_rls_auth_users.sql
-- ============================================================

ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;
-- ============================================================
-- Migration: 20260115_add_static_image_url.sql
-- ============================================================

ALTER TABLE student_cards
ADD COLUMN IF NOT EXISTS static_image_url TEXT;

COMMENT ON COLUMN student_cards.static_image_url IS 'URL da imagem estática (gerada após aprovação)';


-- ============================================================
-- Migration: 20260115_disable_rls_auth_users.sql
-- ============================================================

ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;
-- ============================================================
-- Migration: 20260115_disable_rls_auth_users_ok.sql
-- ============================================================

ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;
-- ============================================================
-- Migration: 20260115_fix_create_student_profile_birthdate.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_student_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_full_name TEXT := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_cpf TEXT := COALESCE(NEW.raw_user_meta_data->>'cpf', '');
  v_phone TEXT := COALESCE(NEW.raw_user_meta_data->>'phone', '');
  v_birth_text TEXT := COALESCE(NEW.raw_user_meta_data->>'birth_date', '');
  v_birth_date DATE;
BEGIN
  -- birth_date: apenas castear se formato ISO válido; caso contrário usar fallback seguro
  IF v_birth_text ~ '^\d{4}-\d{2}-\d{2}$' THEN
    v_birth_date := v_birth_text::date;
  ELSE
    v_birth_date := DATE '2000-01-01';
  END IF;

  INSERT INTO public.student_profiles (
    user_id,
    full_name,
    cpf,
    phone,
    birth_date,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    v_full_name,
    v_cpf,
    v_phone,
    v_birth_date,
    now(),
    now()
  );

  RETURN NEW;
END;
$function$;


-- ============================================================
-- Migration: 20260116120000_add_physical_card_urls.sql
-- ============================================================

ALTER TABLE student_cards
ADD COLUMN IF NOT EXISTS physical_card_front_url TEXT;

ALTER TABLE student_cards
ADD COLUMN IF NOT EXISTS physical_card_back_url TEXT;


-- ============================================================
-- Migration: 20260116123000_add_digital_card_generation.sql
-- ============================================================

ALTER TABLE student_cards
ADD COLUMN IF NOT EXISTS digital_card_generated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS generation_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_generation_error TEXT;

CREATE TABLE IF NOT EXISTS card_generation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  card_type TEXT NOT NULL,
  status TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  error_message TEXT,
  cost_cents INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE card_generation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view card generation logs"
  ON card_generation_logs FOR SELECT
  USING (
    "public"."has_any_role"(auth.uid(), ARRAY['admin'::public.user_role, 'manager'::public.user_role])
  );


-- ============================================================
-- Migration: 20260117100000_add_education_level_to_student_profiles.sql
-- ============================================================

ALTER TABLE student_profiles
ADD COLUMN IF NOT EXISTS education_level TEXT;


-- ============================================================
-- Migration: 20260125_update_profile_photo_on_approval.sql
-- ============================================================

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


-- ============================================================
-- Migration: 20260202_fix_search_path.sql
-- ============================================================

-- Função 1
CREATE OR REPLACE FUNCTION public.activate_student_card_on_docs_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total_approved INTEGER;
  v_student RECORD;
BEGIN
  -- Só processar se status mudou para approved
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'approved') THEN
    
    -- Contar documentos aprovados para este estudante
    SELECT COUNT(*) INTO v_total_approved
    FROM documents
    WHERE student_id = NEW.student_id AND status = 'approved';
    
    RAISE NOTICE '📄 Documento aprovado para student_id %. Total aprovados: %', NEW.student_id, v_total_approved;
    
    -- Se todos 4 documentos aprovados
    IF v_total_approved >= 4 THEN
      
      -- Buscar dados completos do estudante
      SELECT * INTO v_student
      FROM student_profiles
      WHERE id = NEW.student_id;
      
      -- Ativar carteirinha e atualizar QR Code com dados completos
      UPDATE student_cards
      SET 
        status = 'active',
        qr_code = jsonb_build_object(
          'card_number', card_number,
          'usage_code', usage_code,
          'name', v_student.full_name,
          'cpf', CONCAT(LEFT(v_student.cpf, 3), '.***.***.', RIGHT(v_student.cpf, 2)),
          'institution', v_student.institution,
          'course', v_student.course,
          'valid_until', valid_until,
          'verification_url', 'https://urebr.vendatto.com/verificar/' || card_number
        )::TEXT,
        updated_at = NOW()
      WHERE student_id = NEW.student_id
        AND status = 'pending_docs';
      
      RAISE NOTICE '✅ Carteirinha ativada para student_id % - Todos 4 documentos aprovados!', NEW.student_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


-- Função 2
-- FUNÇÃO: auto_generate_card_data()
-- DISPARO: BEFORE INSERT/UPDATE em student_cards (conforme triggers configurados).
-- FLUXO:
--   1) Gera card_number se ainda não houver.
--   2) Gera usage_code se ainda não houver.
--   3) Calcula valid_until se ainda não houver (usando calculate_card_validity).
--   4) Busca dados do estudante em student_profiles para montar JSON do QR Code.
--   5) Preenche qr_code com JSON serializado contendo dados mascarados do CPF e info da carteira.
-- EFEITOS NO BANCO:
--   - Usa student_profiles apenas para leitura.
--   - Atualiza campos da própria linha de student_cards (NEW.*).
-- ATENÇÃO:
--   - Não altera status da carteirinha; isso é responsabilidade de outras funções/trigger.
CREATE OR REPLACE FUNCTION auto_generate_card_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  student_data RECORD;
BEGIN
  -- Gerar card_number se não existir
  IF NEW.card_number IS NULL THEN
    NEW.card_number := generate_card_number();
  END IF;
  
  -- Gerar usage_code se não existir
  IF NEW.usage_code IS NULL THEN
    NEW.usage_code := generate_usage_code();
  END IF;
  
  -- Calcular validade se não existir
  IF NEW.valid_until IS NULL THEN
    NEW.valid_until := calculate_card_validity(NEW.issued_at);
  END IF;
  
  -- Buscar dados do estudante para QR Code
  SELECT 
    sp.full_name,
    sp.cpf,
    sp.institution,
    sp.course
  INTO student_data
  FROM student_profiles sp
  WHERE sp.id = NEW.student_id;
  
  -- Gerar QR Code com JSON completo (CPF parcialmente mascarado)
  NEW.qr_code := jsonb_build_object(
    'card_number', NEW.card_number,
    'usage_code', NEW.usage_code,
    'name', student_data.full_name,
    'cpf', CONCAT(LEFT(student_data.cpf, 3), '.***.***.', RIGHT(student_data.cpf, 2)),
    'institution', student_data.institution,
    'course', student_data.course,
    'valid_until', NEW.valid_until,
    'verification_url', 'https://urebr.vendatto.com/verificar/' || NEW.card_number
  )::TEXT;
  
  RETURN NEW;
END;
$$;


-- Função 3
CREATE OR REPLACE FUNCTION public.calculate_card_validity(issue_date timestamp with time zone)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $function$
DECLARE
  validity_date DATE;
  issue_year INTEGER;
  march_31 DATE;
BEGIN
  issue_year := EXTRACT(YEAR FROM issue_date);
  march_31 := make_date(issue_year, 3, 31);
  
  -- Se emissão for antes ou igual a 31/03 do ano atual
  IF issue_date::DATE <= march_31 THEN
    validity_date := march_31;
  ELSE
    -- Caso contrário, 31/03 do ano seguinte
    validity_date := make_date(issue_year + 1, 3, 31);
  END IF;
  
  RETURN validity_date;
END;
$function$;


-- Função 4
CREATE OR REPLACE FUNCTION public.check_cpf_exists(p_cpf text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  cpf_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM public.student_profiles 
    WHERE cpf = p_cpf
      AND deleted_at IS NULL
  ) INTO cpf_exists;
  
  RETURN cpf_exists;
END;
$function$;


-- Função 5
CREATE OR REPLACE FUNCTION public.cleanup_expired_cpf_cache()
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  DELETE FROM cpf_validations WHERE expires_at < now();
END;
$function$;


-- ============================================================
-- Migration: 20260202_secure_triggers_and_move_pgnet.sql
-- ============================================================

-- supabase/migrations/20260202_secure_triggers_and_move_pgnet.sql

-- =========================================
-- FASE 2: Segurança + Organização
-- =========================================

-- 1. MOVER pg_net PARA SCHEMA extensions
ALTER EXTENSION pg_net SET SCHEMA extensions;

-- 2. ATUALIZAR trigger_validate_document (usar Vault + search_path)
CREATE OR REPLACE FUNCTION public.trigger_validate_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
  url TEXT := 'https://zyfbxzjfpncxfawthsht.supabase.co/functions/v1/validate-document-v2';
  key TEXT;
BEGIN
  -- Buscar key do Vault
  SELECT decrypted_secret INTO key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';
  
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
$function$;

-- 3. ATUALIZAR trigger_compare_faces (usar Vault + search_path)
CREATE OR REPLACE FUNCTION public.trigger_compare_faces()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
  url TEXT := 'https://zyfbxzjfpncxfawthsht.supabase.co/functions/v1/compare-faces';
  key TEXT;
  v_count INTEGER;
BEGIN
  -- Buscar key do Vault
  SELECT decrypted_secret INTO key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';
  
  IF NEW.status = 'approved' AND NEW.type IN ('rg', 'foto', 'selfie') THEN
    
    SELECT COUNT(*) INTO v_count
    FROM documents
    WHERE student_id = NEW.student_id
      AND type IN ('rg', 'foto', 'selfie')
      AND status = 'approved';

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
$function$;


-- ============================================================
-- Migration: 20260217123000_update_verification_url.sql
-- ============================================================

-- Atualizar URL de verificação no QR code das carteirinhas

-- 1. Recriar função auto_generate_card_data com nova URL
CREATE OR REPLACE FUNCTION auto_generate_card_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  student_data RECORD;
BEGIN
  IF NEW.card_number IS NULL THEN
    NEW.card_number := generate_card_number();
  END IF;

  IF NEW.usage_code IS NULL THEN
    NEW.usage_code := generate_usage_code();
  END IF;

  IF NEW.valid_until IS NULL THEN
    NEW.valid_until := calculate_card_validity(NEW.issued_at);
  END IF;

  SELECT 
    sp.full_name,
    sp.cpf,
    sp.institution,
    sp.course
  INTO student_data
  FROM student_profiles sp
  WHERE sp.id = NEW.student_id;

  NEW.qr_code := jsonb_build_object(
    'card_number', NEW.card_number,
    'usage_code', NEW.usage_code,
    'name', student_data.full_name,
    'cpf', CONCAT(LEFT(student_data.cpf, 3), '.***.***.', RIGHT(student_data.cpf, 2)),
    'institution', student_data.institution,
    'course', student_data.course,
    'valid_until', NEW.valid_until,
    'verification_url', 'https://urebrasil.com/verificar?code=' || NEW.usage_code
  )::TEXT;

  RETURN NEW;
END;
$$;

-- 2. Recriar função activate_student_card_on_docs_approved com nova URL
CREATE OR REPLACE FUNCTION public.activate_student_card_on_docs_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_approved INTEGER;
  v_student RECORD;
BEGIN
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'approved') THEN
    SELECT COUNT(*) INTO v_total_approved
    FROM documents
    WHERE student_id = NEW.student_id AND status = 'approved';

    IF v_total_approved >= 4 THEN
      SELECT * INTO v_student
      FROM student_profiles
      WHERE id = NEW.student_id;

      UPDATE student_cards
      SET 
        status = 'active',
        qr_code = jsonb_build_object(
          'card_number', card_number,
          'usage_code', usage_code,
          'name', v_student.full_name,
          'cpf', CONCAT(LEFT(v_student.cpf, 3), '.***.***.', RIGHT(v_student.cpf, 2)),
          'institution', v_student.institution,
          'course', v_student.course,
          'valid_until', valid_until,
          'verification_url', 'https://urebrasil.com/verificar?code=' || usage_code
        )::TEXT,
        updated_at = NOW()
      WHERE student_id = NEW.student_id
        AND status = 'pending_docs';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Atualizar QR code dos registros existentes
UPDATE student_cards
SET qr_code = jsonb_set(
  qr_code,
  '{verification_url}',
  to_jsonb('https://urebrasil.com/verificar?code=' || usage_code)
)
WHERE usage_code IS NOT NULL
  AND qr_code IS NOT NULL;



