-- Migration: 20260430_fix_admin_rls_policies.sql
-- Habilita RLS e adiciona policies nas tabelas que bloqueavam o painel admin.
-- Padrão: DROP IF EXISTS antes de CREATE para garantir idempotência.
-- Não remove policies pré-existentes com outros nomes.


-- ============================================================
-- 1. support_messages
-- Aluno: lê e envia mensagens dos próprios tickets.
-- Admin: acesso total.
-- TicketChat.tsx usa Realtime subscription — SELECT policy é obrigatória
-- para o canal em tempo real funcionar.
-- ============================================================

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_messages_aluno_select" ON support_messages;
CREATE POLICY "support_messages_aluno_select" ON support_messages
  FOR SELECT
  TO authenticated
  USING (
    ticket_id IN (
      SELECT id FROM support_tickets WHERE student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "support_messages_aluno_insert" ON support_messages;
CREATE POLICY "support_messages_aluno_insert" ON support_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND ticket_id IN (
      SELECT id FROM support_tickets WHERE student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "support_messages_admin_all" ON support_messages;
CREATE POLICY "support_messages_admin_all" ON support_messages
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- 2. notifications
-- RLS pode já estar habilitada — ALTER TABLE ENABLE é idempotente.
-- Aluno: lê e atualiza (mark as read) as próprias notificações (Header.tsx).
-- Admin: acesso total para broadcast (SendNotificationForm.tsx).
-- ============================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_aluno_all" ON notifications;
CREATE POLICY "notifications_aluno_all" ON notifications
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_admin_all" ON notifications;
CREATE POLICY "notifications_admin_all" ON notifications
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- 3. physical_card_prints
-- Somente painel admin acessa (PrintBatchModal, ShippingModal).
-- Edge function delete-user-data usa service_role — bypassa RLS.
-- ============================================================

ALTER TABLE physical_card_prints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "physical_card_prints_admin_all" ON physical_card_prints;
CREATE POLICY "physical_card_prints_admin_all" ON physical_card_prints
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- 4. ticket_messages (aplicado apenas se a tabela existir no banco)
-- Mesmas policies de support_messages por segurança.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ticket_messages'
  ) THEN

    EXECUTE 'ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "ticket_messages_aluno_select" ON ticket_messages';
    EXECUTE '
      CREATE POLICY "ticket_messages_aluno_select" ON ticket_messages
        FOR SELECT
        TO authenticated
        USING (
          ticket_id IN (
            SELECT id FROM support_tickets WHERE student_id = auth.uid()
          )
        )
    ';

    EXECUTE 'DROP POLICY IF EXISTS "ticket_messages_aluno_insert" ON ticket_messages';
    EXECUTE '
      CREATE POLICY "ticket_messages_aluno_insert" ON ticket_messages
        FOR INSERT
        TO authenticated
        WITH CHECK (
          sender_id = auth.uid()
          AND ticket_id IN (
            SELECT id FROM support_tickets WHERE student_id = auth.uid()
          )
        )
    ';

    EXECUTE 'DROP POLICY IF EXISTS "ticket_messages_admin_all" ON ticket_messages';
    EXECUTE '
      CREATE POLICY "ticket_messages_admin_all" ON ticket_messages
        FOR ALL
        TO authenticated
        USING (is_admin())
        WITH CHECK (is_admin())
    ';

  END IF;
END
$$;
