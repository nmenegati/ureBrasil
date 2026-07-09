# Verificação: Troca de Plano de Usuário (Geral → Direito)

Data: 2026-07-08
Modo: leitura factual apenas. Nenhum arquivo alterado. As queries SQL da seção 10 são propostas para execução manual no Supabase SQL Editor — não foram executadas.

## Achado central

O que determina o template da carteirinha (geral vs direito) é **um único campo: `student_cards.card_type`**. Tanto o caminho de runtime ativo (frontend `Carteirinha.tsx`) quanto a Edge Function paralela (`generate-digital-card`) derivam o layout de `card_type.toLowerCase().includes('direito')`. O `student_profiles.plan_id` e o `payments.plan_id` **não** entram diretamente na escolha do template — o `card_type` foi "congelado" no registro de `student_cards` no momento em que o pagamento foi aprovado (trigger copiou `plans.type`). Portanto, a alteração obrigatória e suficiente para o objetivo é `student_cards.card_type`. As demais são de consistência.

## 1. STUDENT_PROFILES

- Campos a alterar: **`plan_id`** (trocar do plano `geral_digital` para `direito_digital`), por consistência — é lido por `Pagamento.tsx:203-204`, `Perfil.tsx:300-304` e serve de fonte caso a carteira precise ser recriada. **Não** é o campo que define o template.
- `is_law_student`: **NÃO alterar** — o estudante já é de Direito, então já deve estar `true` (classificação vem de `course ILIKE '%direito%'` via trigger `detect_law_student()` e/ou da classificação frontend em `CompleteProfile.tsx:479`). Confirmar em produção, mas não deve precisar de mudança.
- `education_level` / `course` / `course_type`: **NÃO alterar** — refletem a realidade acadêmica do estudante (que sempre foi Direito); o erro foi só na escolha do plano, não nos dados acadêmicos.
- Triggers disparadas ao alterar `plan_id`: **NÃO.** O único trigger em `student_profiles` é `on_course_update`, definido como `BEFORE INSERT OR UPDATE OF course` (`supabase/migrations/20260103151557_...sql:19-23`). Ele só dispara quando a coluna **`course`** muda. Um `UPDATE` de `plan_id` (e/ou `updated_at`) **não** aciona nenhum trigger.

## 2. STUDENT_CARDS

- Registro existe? **SIM (esperado).** A trigger `create_student_card_on_payment()` (`supabase/migrations/20260102205259_...sql:16`) cria a carteira com `status = 'pending_docs'` assim que o primeiro pagamento (o R$29) foi aprovado. Como o estudante está na etapa de upload, o card existe em `pending_docs` e `digital_card_url` ainda é `NULL`. **Confirmar em produção quantas linhas de `student_cards` existem para este `student_id`** (ver Riscos, seção 9 — o pagamento complementar de R$15 pode ter criado um segundo card).
- `card_type`: vem de `v_plan.type` na trigger (`...20260102205259_...sql:67`), ou seja, foi copiado de `plans.type` no momento da criação. Hoje = `'geral_digital'`.
- Campos a alterar: **`card_type`** de `'geral_digital'` → `'direito_digital'`. **Este é o campo obrigatório e suficiente** para o template correto.
- Outros campos de `student_cards`:
  - `is_physical`: **NÃO alterar** — permanece `false` (carteira digital). A troca é digital→digital.
  - `qr_code`: **NÃO alterar** — é montado (na ativação, `...20260102205259_...sql:116-125`) só com dados do perfil (`card_number`, `usage_code`, `full_name`, `cpf` mascarado, `institution`, `course`, `valid_until`, `verification_url`). **Não contém o tipo geral/direito.**
  - `card_number`, `usage_code`, `valid_until`, `status`, `payment_id`: **NÃO alterar** — independentes do tipo.

## 3. PAYMENTS

- Precisa alterar? **NÃO obrigatório** (apenas opcional/histórico).
- Motivo: nenhuma lógica downstream lê `payments.plan_id` para determinar o tipo de carteira. As únicas leituras de `plan_id` relacionadas a pagamento no código são: `useMercadoPago.ts:176,289` (grava o `plan_id` no momento de criar o pagamento) e `Checkout.tsx:401` (`originalPayment?.plan_id` como id do addon físico no upsell). Nenhuma recalcula `card_type`. O `card_type` já foi materializado em `student_cards` e é de lá que todo o fluxo lê.
- Pagamento complementar (R$15): **não é rastreável apenas pelo repositório** — depende de como foi lançado em produção. Ver Riscos (seção 9): se foi inserido como novo `payments` com `status='approved'` e **sem** `metadata.is_upsell=true`, a trigger `create_student_card_on_payment` pode ter criado uma **segunda** carteira. Verificar.

## 4. GERAÇÃO DA CARTEIRINHA

- Campo que determina o template: **`student_cards.card_type`** (checagem `.includes('direito')`).
- Fonte do campo: materializado de `plans.type` pela trigger na criação do card.
- Rastreamento confirmado:
  - a) `src/pages/Carteirinha.tsx:328-336` — caminho de runtime ATIVO (html2canvas). `isLawCard = card.card_type.toLowerCase().includes('direito')` → `mode` e as imagens `direito-frente/verso-template-v.png`. Passa `mode` para `CardLayoutFront`/`Back` (`:380`). **Não** lê `plan_id`; **não** reescreve `card_type` (só grava `digital_card_url` e `digital_card_generated` em `:238-240`).
  - b) `src/pages/GerarCarteirinha.tsx` — **não usa `card_type` nem `plan_id`**. Apenas valida 4 docs + face + termos e navega para `/carteirinha` (`:99-149`). Irrelevante para o template.
  - c) `supabase/functions/generate-digital-card/index.ts:129-133` — caminho paralelo/alternativo. `kind = body.cardType || (card.card_type.includes('direito') ? 'direito' : 'geral')`. Também deriva de `card_type`. (Seleciona `plan_id` do perfil em `:80`, mas **não** o usa para escolher o template.)
  - d) `src/components/CardLayoutFront.tsx:2` e `CardLayoutBack.tsx` — recebem `mode: "direito" | "geral"` como prop, vindo de `Carteirinha.tsx`. Não consultam banco.
- Conclusão: alterar `student_cards.card_type` para `direito_digital` **antes** de o estudante gerar a carteira é suficiente para que o template de Direito seja usado, em qualquer um dos dois caminhos de geração.

## 5. QR CODE

- Afetado pela troca? **NÃO.** O `qr_code` (montado na trigger de ativação, `...20260102205259_...sql:116-125`) só contém dados do perfil e não inclui geral/direito. Alterar `card_type` não altera o `qr_code`.
- Verificação pública (`supabase/functions/verify-student-card/index.ts:97-118`): o `select` traz `is_physical` mas **não** traz `card_type`. A verificação pública não expõe nem depende do tipo geral/direito. Portanto **não é afetada** pela troca. (Continua mostrando `is_physical=false`, correto.)

## 6. ADMIN

- Afetado pela troca? **SIM, de forma esperada/correta** (não é problema).
- Onde: filtros de notificação usam `student_cards.card_type` — `src/admin/components/Notifications/SendNotificationForm.tsx:130,147` e `RecipientCounter.tsx:74,93` (`query.in('student_cards.card_type', filters.cardTypes)`). Após a troca, o estudante passa a ser contado/segmentado como carteira de Direito nesses filtros — comportamento desejado.
- `src/admin/pages/Cards.tsx`: **não referencia `card_type`** — segmenta filas por `shipping_status` (produção física), não por tipo digital. Sem impacto.

## 7. ALTERAÇÕES NECESSÁRIAS

| Tabela | Campo | De → Para | Obrigatório |
|---|---|---|---|
| `student_cards` | `card_type` | `geral_digital` → `direito_digital` | **SIM** (define o template) |
| `student_profiles` | `plan_id` | (id geral_digital) → (id direito_digital) | Recomendado (consistência; lido por Pagamento/Perfil e usado se o card for recriado) |
| `payments` | `plan_id` | (id geral_digital) → (id direito_digital) | Opcional (só histórico; nada downstream recalcula tipo a partir dele) |
| `student_profiles` | `is_law_student` | já `true` | **NÃO** (já correto — confirmar) |
| `student_profiles` | `education_level` / `course` | inalterado | **NÃO** (dados acadêmicos reais) |
| `student_cards` | `is_physical` | `false` | **NÃO** (troca é digital→digital) |
| `student_cards` | `qr_code` / `card_number` / `usage_code` / `valid_until` | inalterado | **NÃO** (independentes do tipo) |

## 8. ORDEM DE EXECUÇÃO

Não há dependência estrita de ordem, porque nenhum `UPDATE` aqui dispara trigger em cascata (a única trigger em `student_profiles` é `UPDATE OF course`; triggers de `student_cards` não existem para `card_type`; triggers de `payments` só reagem a `status`, não a `plan_id`). Ordem sugerida por clareza:

1. **VERIFICAR primeiro** (SELECTs da seção 10.0): quantas linhas em `student_cards` para o estudante, o `status`/`digital_card_url` atual, e o estado de `is_law_student`/`plan_id`.
2. `UPDATE student_profiles.plan_id` → direito_digital.
3. `UPDATE student_cards.card_type` → `'direito_digital'` (restringindo ao card digital ainda não gerado).
4. (Opcional) `UPDATE payments.plan_id` do pagamento original.
5. Reconferir com o SELECT final.

Efeito colateral de trigger ao alterar campos: **nenhum** (confirmado acima).

## 9. RISCOS

- **[ALTO] Segundo `student_card` criado pelo pagamento complementar (R$15).** A trigger `create_student_card_on_payment` faz `INSERT ... ON CONFLICT (payment_id) DO NOTHING`. O conflito é por `payment_id`, não por `student_id` — então, se o R$15 foi lançado como um novo `payments` aprovado **sem** `metadata.is_upsell=true`, a trigger terá criado uma **segunda** carteira (provavelmente ainda com `card_type` derivado do plano daquele pagamento). Mitigação: **contar as linhas de `student_cards` do estudante antes de qualquer UPDATE** (SELECT 10.0). Se houver 2, decidir qual manter (a de `pending_docs` / sem `digital_card_url`) e remover/ignorar a duplicada — o `UPDATE` de `card_type` deve mirar exatamente a carteira digital que ele vai gerar. Se o R$15 foi um ajuste manual sem novo `payments` aprovado, não há card extra.
- **[BAIXO] `plan_id` alterado durante o upload de documentos.** O fluxo de upload (`UploadDocumentos.tsx`) e a ativação por documentos (trigger `on_document_approved`) **não leem `plan_id`** — operam sobre `documents`/`student_cards` por `student_id`. Trocar `plan_id` não interfere no upload em andamento.
- **[BAIXO] Conflito entre `card_type` novo e `plan_id` do payment original.** Não há recomputação de `card_type` a partir de `payments.plan_id` em lugar nenhum do runtime; o card_type é lido direto de `student_cards`. Divergência entre `payments.plan_id` (histórico) e `student_cards.card_type` (novo) é apenas cosmética/contábil. Mitigação: atualizar `payments.plan_id` também se quiser coerência de relatórios financeiros.
- **[BAIXO] Ativação automática da carteirinha.** A trigger `activate_student_card_on_docs_approved` só muda `status`→`active` e reescreve `qr_code` (sem tipo). Ela **não** toca `card_type`. Então, mesmo que a ativação ocorra depois do UPDATE, o `card_type = 'direito_digital'` é preservado. Ordem entre "aprovar 4º documento" e "trocar card_type" é indiferente para o tipo.
- **[MÉDIO] Pré-condição de unicidade dos planos.** As subqueries usam `WHERE type = 'direito_digital' AND is_active = true`. Confirmar que existe **exatamente 1** linha ativa desse tipo (e do geral) — já validado em contexto anterior, mas reconfirmar. Se houver 0 ou 2+, a subquery com `LIMIT 1` pode pegar o errado; preferir garantir unicidade.

## 10. SQL FINAL

> Substituir `:user_id` pelo UUID do estudante. Rodar os SELECTs de diagnóstico **antes** dos UPDATEs. Idealmente executar dentro de uma transação (`BEGIN; ... COMMIT;`) após conferir os SELECTs.

```sql
-- ============================================================
-- 10.0 DIAGNÓSTICO (rodar PRIMEIRO — não altera nada)
-- ============================================================

-- Perfil: confirmar is_law_student e plan_id atual
SELECT id AS student_id, user_id, full_name, is_law_student, education_level, course, plan_id
FROM student_profiles
WHERE user_id = ':user_id';

-- Cartões do estudante: quantos existem? (detecta o 2º card do R$15)
SELECT sc.id, sc.card_type, sc.is_physical, sc.status, sc.digital_card_url,
       sc.payment_id, sc.card_number, sc.created_at
FROM student_cards sc
JOIN student_profiles sp ON sp.id = sc.student_id
WHERE sp.user_id = ':user_id'
ORDER BY sc.created_at;

-- Pagamentos do estudante: entender original + complementar
SELECT p.id, p.status, p.amount, p.plan_id, p.metadata, p.created_at
FROM payments p
JOIN student_profiles sp ON sp.id = p.student_id
WHERE sp.user_id = ':user_id'
ORDER BY p.created_at;

-- Planos ativos (confirmar unicidade)
SELECT id, type, name, price, is_active FROM plans
WHERE type IN ('geral_digital','direito_digital') AND is_active = true;

-- ============================================================
-- 10.1 ALTERAÇÕES (rodar só após conferir o diagnóstico)
-- ============================================================
BEGIN;

-- (1) Perfil → plano de Direito (consistência)
UPDATE student_profiles
SET plan_id = (SELECT id FROM plans WHERE type = 'direito_digital' AND is_active = true LIMIT 1),
    updated_at = NOW()
WHERE user_id = ':user_id';

-- (2) OBRIGATÓRIO: card_type da carteira DIGITAL ainda não gerada → direito
--     Restrições evitam tocar carteira física ou já gerada, e evitam ambiguidade
--     caso exista um 2º card (revisar o diagnóstico 10.0 antes).
UPDATE student_cards
SET card_type = 'direito_digital',
    updated_at = NOW()
WHERE student_id = (SELECT id FROM student_profiles WHERE user_id = ':user_id')
  AND is_physical = false
  AND digital_card_url IS NULL;

-- (3) OPCIONAL: coerência histórica do pagamento original (não afeta template)
-- UPDATE payments
-- SET plan_id = (SELECT id FROM plans WHERE type = 'direito_digital' AND is_active = true LIMIT 1)
-- WHERE student_id = (SELECT id FROM student_profiles WHERE user_id = ':user_id')
--   AND status = 'approved'
--   AND COALESCE((metadata->>'is_upsell')::boolean, false) = false;

-- Conferir o resultado antes de confirmar:
SELECT sc.card_type, sc.is_physical, sc.status, sc.digital_card_url
FROM student_cards sc
JOIN student_profiles sp ON sp.id = sc.student_id
WHERE sp.user_id = ':user_id';

COMMIT;
-- (usar ROLLBACK; em vez de COMMIT se o SELECT acima não bater com o esperado)
```

### Observações finais
- A alteração **imprescindível** é apenas a (2) `student_cards.card_type`. As demais são de consistência/relatório.
- Fazer a troca **antes** de o estudante gerar a carteira (ele está no upload) garante que o template de Direito seja usado sem necessidade de regenerar nada. Se ele já tivesse `digital_card_url` preenchido, seria preciso também limpar esse campo (`digital_card_url = NULL`, `digital_card_generated = false`) para forçar regeração — **não é o caso aqui**, mas fica registrado.
- Reforço do risco ALTO: rodar o diagnóstico 10.0 e confirmar que existe **uma única** carteira digital `pending_docs` para o estudante antes de aplicar o UPDATE.
