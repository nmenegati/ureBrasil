/**
 * RPCs e Triggers documentados (Lei 14)
 *
 * Este arquivo centraliza a documentação de funções que não possuem
 * definição SQL explícita ou cujo contexto é disperso em múltiplas migrations.
 */

## RPC `advance_to_review`

- **Objetivo**: validar se o estudante pode avançar do passo de upload de documentos
  para a etapa de revisão/geração da carteirinha.
- **Parâmetros**:
  - `p_student_id UUID` – ID de `student_profiles` (student_id).
- **Fluxo esperado**:
  1. Verifica se existem 4 documentos aprovados para o `student_id`.
  2. Verifica se `student_profiles.face_validated = true`.
  3. Verifica se `student_profiles.terms_accepted = true` (e registra versão/metadata).
  4. Se todas as condições forem atendidas:
     - Atualiza `student_profiles.current_onboarding_step` para `review_data`.
     - Retorna `true`.
  5. Caso contrário, não altera o passo e retorna `false`.
- **Efeitos no banco**:
  - `UPDATE student_profiles SET current_onboarding_step = 'review_data' ...`
  - Leitura em `documents`, `student_profiles` e possivelmente `student_cards`.
- **Atenção**:
  - Não deve ativar carteirinha nem alterar status de `student_cards`.
  - O frontend depende estritamente do retorno `true`/`false` para decidir navegação.

## Trigger `activate_student_card_on_docs_approved`

- **Função**: `public.activate_student_card_on_docs_approved()`
- **Disparo**:
  - `AFTER UPDATE` em `documents`, quando `status` muda para `'approved'`.
- **Fluxo**:
  1. Ao aprovar um documento, conta quantos documentos com `status = 'approved'`
     existem para o mesmo `student_id`.
  2. Se `v_total_approved >= 4`:
     - Busca dados completos do estudante em `student_profiles`.
     - Atualiza `student_cards` com:
       - `status = 'active'` para cartões em `pending_docs`.
       - `qr_code` preenchido com JSON contendo card_number, usage_code, dados mascarados,
         instituição, curso, validade e URL de verificação.
  3. Registra `RAISE NOTICE` no log com o total de documentos aprovados.
- **Efeitos no banco**:
  - `UPDATE student_cards SET status = 'active', qr_code = ... WHERE student_id = ...`.
- **Atenção**:
  - Não verifica `terms_accepted` nem `face_validated`; a aplicação precisa considerar
    essas flags antes de exibir a carteirinha ao usuário.

## Trigger `create_student_card_on_payment`

- **Função**: `public.create_student_card_on_payment()`
- **Disparo**:
  - `AFTER UPDATE` em `payments`, quando `status` muda para `'approved'`.
- **Fluxo**:
  1. Verifica se o pagamento é upsell (`metadata.is_upsell = true`):
     - Se for upsell:
       - Atualiza apenas o registro existente em `student_cards`, marcando
         `is_physical = true` baseado em `metadata.original_payment_id`.
       - Não cria uma nova carteirinha.
  2. Se não for upsell:
     - Busca plano em `plans` pelo `plan_id`.
     - Gera `card_number` (via `generate_card_number()`).
     - Calcula `valid_until` (via `calculate_card_validity()`).
     - Cria registro em `student_cards` com:
       - `student_id`, `payment_id`, `card_type`, `is_physical` do plano.
       - `card_number`, `qr_code`, `valid_until`, `status` (`active` ou `pending_docs`,
         de acordo com a migration vigente) e `issued_at`.
     - Evita duplicidade com `ON CONFLICT (payment_id) DO NOTHING`.
- **Efeitos no banco**:
  - `INSERT` em `student_cards` para pagamentos de plano digital.
  - `UPDATE` em `student_cards` para pagamentos de upsell físico.
- **Atenção**:
  - Depende de funções auxiliares `generate_card_number` e `calculate_card_validity`.
  - Deve ser mantida em sincronia com o fluxo de triggers de documentos e `advance_to_review`.

## Trigger `auto_generate_card_data`

- **Função**: `auto_generate_card_data()`
- **Disparo**:
  - Geralmente `BEFORE INSERT`/`BEFORE UPDATE` em `student_cards` (ver migrations).
- **Fluxo**:
  1. Se `card_number` estiver vazio, chama `generate_card_number()` e preenche NEW.card_number.
  2. Se `usage_code` estiver vazio, chama `generate_usage_code()` e preenche NEW.usage_code.
  3. Se `valid_until` estiver vazio, calcula validade com `calculate_card_validity(issued_at)`.
  4. Busca em `student_profiles` os dados do estudante (nome, CPF, instituição, curso).
  5. Monta `NEW.qr_code` como JSON serializado com dados mascarados de CPF, card_number,
     usage_code, instituição, curso, validade e URL de verificação.
- **Efeitos no banco**:
  - Usa `student_profiles` apenas para leitura.
  - Normaliza campos de `student_cards` antes de persistir.
- **Atenção**:
  - Não deve alterar `status` da carteirinha; apenas completa dados derivados.
  - A URL de verificação é sensível à mudança de domínio; revisar ao mudar ambiente.

