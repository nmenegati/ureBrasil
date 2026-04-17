# Auditoria Técnica Completa — URE Brasil

**Data:** 2026-04-17  
**Escopo:** Segurança, fluxo de aquisição, qualidade de código, edge functions  
**Alterações:** Nenhuma — documento apenas

---

## 1. SEGURANÇA

### 1.1 Dados sensíveis expostos no frontend

#### CRÍTICO — `delete-user-data` sem verificação JWT no gateway

**Arquivo:** `supabase/config.toml:15–16`

```toml
[functions.delete-user-data]
verify_jwt = false
```

A função que deleta todos os dados do usuário (LGPD) está configurada sem verificação de JWT no gateway do Supabase. Qualquer requisição HTTP sem token pode atingir o endpoint `/functions/v1/delete-user-data`.

A função faz validação manual interna (lê o Bearer header), o que é uma camada adicional — mas a inconsistência entre config e código é um risco real: qualquer refatoração que remova a checagem interna expõe a deleção em massa sem autenticação.

**Impacto:** Deleção arbitrária de contas e dados de estudantes.

---

#### ALTO — Chaves expostas no `.env` versionado

**Arquivo:** `.env`

```
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGci..."  ← anon key completa
VITE_MP_PUBLIC_KEY="TEST-a68a36e6-..."        ← Mercado Pago public key
VITE_SUPABASE_URL="https://zyfbxzjfpncx..."  ← URL do projeto
```

O prefixo `VITE_` expõe essas variáveis no bundle de produção — isso é esperado para a anon key e MP public key. O risco real está no `.env` estar versionado no git: qualquer colaborador (ou vazamento do repositório) tem acesso imediato. A anon key combinada com RLS fraco (ver 1.2) é o vetor de ataque mais provável.

---

#### ALTO — `verify-student-card` chamado via URL direta sem SDK

**Arquivo:** `src/pages/VerificarCarteirinha.tsx:120`

```ts
`${supabaseUrl}/functions/v1/verify-student-card`
```

Chamada direta via `fetch()` sem `supabase.functions.invoke()`. Não há evidência de que essa function tenha `verify_jwt = true` no `config.toml` (ausente). Endpoint de verificação de carteirinhas potencialmente público sem rate limiting — suscetível a brute force em pares `(card_number, birth_date)`.

---

### 1.2 RLS — Row Level Security

#### Tabelas COM RLS confirmado nas migrations:

| Tabela | Arquivo de migration | Políticas |
|---|---|---|
| `documents` | `20251216192350_*.sql:5` | UPDATE para docs pending/rejected do próprio usuário |
| `audit_logs` | `20260110120000_*.sql:13` | ENABLE RLS (políticas não detalhadas) |
| `card_generation_logs` | `20260116123000_*.sql:17–19` | Apenas admins podem visualizar |

#### Tabelas SEM `ENABLE ROW LEVEL SECURITY` nas migrations:

| Tabela | Risco |
|---|---|
| `student_profiles` | Qualquer usuário autenticado pode ler perfis de outros estudantes |
| `payments` | Pagamentos de outros usuários acessíveis |
| `student_cards` | Carteirinhas de outros usuários acessíveis |
| `support_tickets` | Tickets de outros usuários acessíveis |
| `notifications` | Notificações de outros usuários acessíveis |
| `plans` | Leitura pública (aceitável), mas escrita sem proteção |

> **Nota:** As políticas podem ter sido criadas diretamente no dashboard do Supabase sem migration. A ausência nas migrations não garante ausência no banco — mas indica que não há rastreabilidade dessas políticas.

#### auth.users — RLS explicitamente desabilitado

Dois arquivos de migration desabilitam RLS na tabela `auth.users`:
- `20260115161314_*.sql`
- `20260115_disable_rls_auth_users.sql`
- `20260115_disable_rls_auth_users_ok.sql`

Seguido de uma política permissiva:
```sql
-- 20260115161958_allow_auth_admin_all.sql
CREATE POLICY allow_auth_admin_all ON auth.users
  FOR ALL TO supabase_auth_admin USING (true) WITH CHECK (true);
```

Isso é gerenciado pelo Supabase Auth internamente e é um padrão documentado — mas os múltiplos arquivos de migration tentando desabilitar o RLS sugerem que houve problemas durante o desenvolvimento.

---

### 1.3 Funções SECURITY DEFINER

Funções que executam como `postgres` (bypassando RLS):

| Migration | Função |
|---|---|
| `20251228151731_*.sql` | Trigger function (não identificada) |
| `20260102205259_*.sql` | 2 funções |
| `20260113_create_document_validation_triggers.sql` | Trigger de validação de documentos |
| `20260113_create_face_comparison_trigger.sql` | Trigger de face comparison |
| `20260115_fix_create_student_profile_birthdate.sql` | Função de criação de perfil |
| `20260125_update_profile_photo_on_approval.sql` | Atualização de foto |
| `20260202_fix_search_path.sql` | 2 funções |

Funções `SECURITY DEFINER` são necessárias para operações que precisam burlar RLS de forma controlada. O risco existe se alguma aceitar input não sanitizado do usuário.

---

## 2. FLUXO DE AQUISIÇÃO

### 2.1 Pontos onde o usuário pode ficar preso

#### CRÍTICO — Login com 4 queries sequenciais sem timeout global

**Arquivo:** `src/pages/Login.tsx`

Após o `signIn()`, a função de roteamento pós-login executa até 4 queries sequenciais (profile → payments → cards → documents) para decidir para onde redirecionar. Existe um timeout de 10 segundos (`Promise.race`) mas ele cobre apenas algumas queries, não toda a cadeia.

Se qualquer query travar, o usuário vê spinner indefinidamente sem mensagem de erro ou opção de sair.

**Redirect inconsistente:** parte dos redirects usa `window.location.href` (reload completo) e parte usa `navigate()` (SPA). Isso causa perda de estado React em alguns caminhos.

---

#### CRÍTICO — `current_onboarding_step = "documents"` não mapeado

**Arquivo:** `src/pages/Checkout.tsx:314` *(corrigido em sessão anterior)*

O valor `"documents"` (sem prefixo `upload_`) era gravado no banco mas não existia no `STEP_ROUTES`. O guard redirecionava para `/` (landing). O usuário clicava "Começar Agora", o `goToStudentCardFlow()` recalculava corretamente e mandava para `/upload-documentos`. Fluxo funcionava, mas com redirect desnecessário pela landing.

**Status:** Corrigido para `"upload_documents"` na sessão anterior.

---

#### ALTO — Usuário sem feedback após falha de pagamento

**Arquivo:** `src/pages/Pagamento.tsx:641`

Quando o pagamento falha (ex: cartão recusado, timeout de rede), o erro é exibido via toast e `setProcessing(false)` é chamado. Mas:
- O formulário não é resetado
- Não há botão explícito de "Tentar novamente"
- O PIX não tem timeout — se o usuário não paga, a tela fica aguardando indefinidamente

---

#### ALTO — Upload de documento sem rollback

**Arquivo:** `src/pages/UploadDocumentos.tsx:854–882`

O upload tem duas etapas: Storage → banco. Se o Storage sucess e o banco falha, o arquivo fica órfão no Storage. Se o banco sucede e o Storage falha, o registro aponta para um arquivo inexistente. Não há rollback ou verificação de consistência.

---

#### MÉDIO — Reload de página ao aceitar termos pode perder estado de polling

**Arquivo:** `src/pages/UploadDocumentos.tsx:1054`

```ts
window.location.reload()
```

Chamado após aceitar os termos. Se a validação facial estava em polling no momento, o intervalo é cancelado pelo reload e o usuário precisa aguardar o próximo ciclo de polling.

---

### 2.2 Estados inconsistentes entre banco e frontend

#### Duas fontes de verdade para o passo atual

- `useOnboardingGuard` usa `student_profiles.current_onboarding_step`
- `goToStudentCardFlow()` (landing, `src/lib/cardNavigation.ts`) **ignora** o `current_onboarding_step` e recalcula o passo a partir do estado real dos dados (profile, payments, documents, cards)

Se o banco ficar desatualizado (ex: trigger não disparou), as duas lógicas podem discordar e o usuário é enviado para rotas diferentes dependendo do ponto de entrada.

---

#### Plan ID: localStorage vs banco

**EscolherPlano.tsx:101,186** grava o `selected_plan_id` no localStorage E no banco (`student_profiles.plan_id`).  
**Pagamento.tsx:183–204** lê **somente do banco** — o localStorage é código morto para esse par.

O localStorage gravado nunca é lido por nenhum arquivo e nunca é limpo. Não causa bug, mas é ruído.

---

### 2.3 Tratamento de erros por etapa

| Etapa | Arquivo | Exibe erro ao usuário? | Tem retry? | Pode ficar preso? |
|---|---|---|---|---|
| Login / redirect | `Login.tsx` | toast genérico | Não | **Sim** (query trava) |
| Completar perfil | `CompleteProfile.tsx` | toast | Não | Não |
| Selecionar plano | `EscolherPlano.tsx` | toast | Não | Não |
| Pagamento (cartão) | `Pagamento.tsx` | toast + detalhes | Não | Parcialmente |
| Pagamento (PIX) | `Pagamento.tsx` | toast | Não | **Sim** (sem timeout) |
| Upload documento | `UploadDocumentos.tsx` | toast | Não | Não |
| Validação facial | `UploadDocumentos.tsx` | badge + mensagem | Manual | **Sim** (45s limite) |
| Gerar carteirinha | `GerarCarteirinha.tsx` | toast | Não | Não |
| Exibir carteirinha | `Carteirinha.tsx` | toast | Não | Não |

---

## 3. QUALIDADE DO CÓDIGO

### 3.1 Componentes com mais de 500 linhas

| Arquivo | Linhas | Principal problema |
|---|---|---|
| `src/pages/UploadDocumentos.tsx` | **1513** | Upload, polling, face validation, termos — tudo num componente |
| `src/pages/Perfil.tsx` | **1391** | Formulários pessoais, endereço, acadêmico, pagamentos, carteirinha |
| `src/pages/Index.tsx` | **1275** | Hero, carousel, depoimentos, pricing, FAQ — sem lazy sub-componentes |
| `src/pages/Checkout.tsx` | **1152** | Lógica de upsell, MP, EFI, PIX, atualizações de step |
| `src/pages/SignUp.tsx` | **1146** | Cadastro + validações de CPF, email, telefone, senha |
| `src/pages/Pagamento.tsx` | **1122** | Pagamento via 3 gateways diferentes |
| `src/pages/CompleteProfile.tsx` | **1066** | Formulário + validações + endereço via ViaCEP |
| `src/pages/CheckoutFisica.tsx` | **904** | Checkout avulso (carteira física sem plano) |
| `src/pages/Dashboard.tsx` | **836** | Progress, upsell modal, card display, info |
| `src/components/SupportModal.tsx` | **723** | Chat + abertura de ticket num modal |
| `src/admin/components/Notifications/SendNotificationForm.tsx` | **524** | Formulário + filtros + envio |
| `src/components/Header.tsx` | **578** | Queries + dropdown + mobile menu + notificações |

---

### 3.2 Lógica duplicada

#### Redirect pós-login vs `goToStudentCardFlow`

A lógica de "descobrir em qual etapa o usuário está" existe em dois lugares separados:

| Local | Arquivo | Queries feitas |
|---|---|---|
| Roteamento pós-login | `src/pages/Login.tsx:60–152` | profile → payments → cards → documents |
| CTA da landing | `src/lib/cardNavigation.ts:4–81` | profile → payments → documents → cards |

Ambas fazem as mesmas 4 queries e tomam as mesmas decisões de redirect com lógica quase idêntica. Se o fluxo mudar (ex: nova etapa), ambos precisam ser atualizados.

---

#### Carregamento de plano duplicado

`Pagamento.tsx:183–211` e `Checkout.tsx:142–200` têm lógica praticamente idêntica:
1. Buscar `student_profiles` com `plan_id`
2. Validar se `plan_id` existe
3. Buscar detalhes do plano em `plans`

Sem hook compartilhado.

---

#### Carregamento de perfil duplicado

`ProfileContext.tsx` e `useAuth.tsx` fazem queries independentes para `student_profiles` do mesmo usuário em toda sessão autenticada (ver auditoria de performance — 2 round-trips desnecessários por navegação).

---

### 3.3 `console.log` / `console.error` em produção

**Total encontrado:** ~70 ocorrências em arquivos de produção.

Seleção dos mais críticos (que expõem dados internos):

| Arquivo | Linha | O que expõe |
|---|---|---|
| `AdminLogin.tsx` | 46, 53, 69 | `auth.uid` do admin, resultado de queries internas |
| `AdminLayout.tsx` | 28, 29, 41, 42 | Estado do `adminUser`, rota de redirect |
| `RecipientCounter.tsx` | 26, 31, 36, 103, 105 | Filtros de notificação, contagem de destinatários |
| `SendNotificationForm.tsx` | 181, 190 | Corpo completo das notificações enviadas |
| `Pagamento.tsx` | 430, 586, 641, 645, 657 | Contexto de erro de pagamento com detalhes de gateway |
| `UploadDocumentos.tsx` | 643, 705, 733, 1047, 1073 | IDs de estudante, erros de RPC |
| `Checkout.tsx` | 344, 401, 419, 445 | Estado de onboarding, erros de pagamento |
| `Login.tsx` | 158 | Erro de roteamento pós-login |

Em produção, qualquer usuário com DevTools aberto pode ler IDs internos, erros de gateway e fluxos de onboarding.

---

## 4. EDGE FUNCTIONS

### 4.1 Mapa de uso — ativas vs possivelmente abandonadas

| Function | `config.toml` | Invocada no frontend | Via trigger/webhook | Status |
|---|---|---|---|---|
| `admin-update-email` | ✅ `verify_jwt=true` | `AdminEditEmail.tsx:121` | — | ✅ Em uso |
| `create-payment` | ✅ `verify_jwt=true` | `Checkout.tsx:510`, `CheckoutFisica.tsx:334` | — | ✅ Em uso |
| `pagbank-session` | ✅ `verify_jwt=true` | Não encontrada | — | ⚠️ Possivelmente abandonada |
| `pagbank-payment-card` | ✅ `verify_jwt=true` | Não encontrada | — | ⚠️ Possivelmente abandonada |
| `delete-user-data` | ⚠️ `verify_jwt=false` | `Perfil.tsx:567` | — | ✅ Em uso (ver risco) |
| `generate-student-card` | ✅ `verify_jwt=true` | Não encontrada | — | ⚠️ Possivelmente substituída |
| `generate-digital-card` | ✅ `verify_jwt=true` | `Dashboard.tsx:314` | — | ✅ Em uso |
| `mercadopago-payment` | ❌ Sem config | `useMercadoPago.ts:172,285` | — | ✅ Em uso (sem config explícita) |
| `efi-payment` | ❌ Sem config | `CheckoutFisica.tsx:414`, `Pagamento.tsx:537` | — | ✅ Em uso (sem config explícita) |
| `pagbank-payment-v2` | ❌ Sem config | `CheckoutFisica.tsx:429` | — | ✅ Em uso (sem config explícita) |
| `validate-document-v2` | ❌ Sem config | Não invocada diretamente | Via trigger de Storage | ✅ Em uso (backend) |
| `compare-faces` | ❌ Sem config | Não invocada diretamente | Via trigger/pg_net | ✅ Em uso (backend) |
| `verify-student-card` | ❌ Sem config | `VerificarCarteirinha.tsx:120` (fetch direto) | — | ✅ Em uso |
| `mercadopago-webhook` | ❌ Sem config | Não invocada (webhook externo) | Mercado Pago → Supabase | ✅ Em uso |
| `delete-unconfirmed-user` | ❌ Sem config | `VerificarEmail.tsx:51` | — | ✅ Em uso |
| `validate-cpf` | ❌ Sem config | `SignUp.tsx:470` | — | ✅ Em uso |
| `generate-card-image` | ❌ Sem config | Não encontrada | — | ⚠️ Possivelmente abandonada |
| `cleanup-rejected-documents` | ❌ Sem config | Não encontrada | Cron? | ⚠️ Sem evidência de uso |
| `chat-support` | ❌ Sem config | `ChatWidget.tsx:107` | — | ✅ Em uso |

**Funções sem `config.toml`:** por padrão o Supabase usa `verify_jwt = true` — então as funções sem config explícita provavelmente estão seguras, mas isso não é garantido em todos os ambientes.

---

### 4.2 Funções com problemas de tratamento de erro

#### `generate-student-card` — possivelmente substituída por `generate-digital-card`

Ambas existem. O frontend invoca apenas `generate-digital-card` (Dashboard.tsx). `generate-student-card` está configurada no `config.toml` mas sem invocação no frontend. Pode ser uma versão legada não removida.

---

#### `pagbank-session` e `pagbank-payment-card` — possivelmente abandonadas

Configuradas no `config.toml` com `verify_jwt = true`, mas nenhum arquivo em `src/` as invoca. O frontend usa `pagbank-payment-v2` para PagBank. As versões originais podem ser código legado.

---

#### `mercadopago-webhook` — sem validação de assinatura visível

Webhooks do Mercado Pago devem ser validados via HMAC (header `x-signature`). Sem leitura completa do arquivo não é possível confirmar, mas é um ponto de atenção crítico — webhook sem validação de assinatura pode ser explorado para marcar pagamentos como aprovados artificialmente.

---

#### `cleanup-rejected-documents` — sem evidência de agendamento

A function existe mas não há configuração de cron nem invocação no frontend. Se não estiver agendada via Supabase Cron (dashboard), nunca executa.

---

## 5. RESUMO EXECUTIVO

### Por severidade

| Severidade | Quantidade | Itens principais |
|---|---|---|
| **Crítico** | 3 | `delete-user-data` sem JWT no gateway; login sem timeout global; step "documents" sem mapeamento (corrigido) |
| **Alto** | 8 | RLS não confirmado em 5 tabelas; `verify-student-card` possivelmente público; PIX sem timeout; upload sem rollback; console.log expondo dados internos; lógica de redirect duplicada |
| **Médio** | 6 | Fontes de verdade duplicadas (onboarding step); reload de página na validação facial; functions legadas não removidas; webhook sem validação de assinatura confirmada; `cleanup-rejected-documents` possivelmente sem agendamento |
| **Baixo** | 4 | localStorage morto (selected_plan_id); componentes >500 linhas; localStorage de plan nunca limpo; `generate-card-image` possivelmente abandonada |

---

### Prioridade de ação recomendada

1. **Imediato:** Confirmar se `delete-user-data` tem validação interna robusta — ou adicionar `verify_jwt = true` no config.toml e validar que o fluxo LGPD ainda funciona
2. **Imediato:** Confirmar RLS nas tabelas `student_profiles`, `payments`, `student_cards`, `support_tickets` diretamente no dashboard do Supabase
3. **Imediato:** Adicionar rate limiting ou token de verificação no endpoint `verify-student-card`
4. **Curto prazo:** Adicionar timeout global no fluxo de roteamento pós-login + mensagem clara de erro
5. **Curto prazo:** Remover `console.log` de produção (especialmente nos componentes admin)
6. **Curto prazo:** Confirmar validação de assinatura HMAC no `mercadopago-webhook`
7. **Médio prazo:** Unificar lógica de redirect em um único utilitário compartilhado
8. **Médio prazo:** Remover ou documentar functions legadas (`pagbank-session`, `pagbank-payment-card`, `generate-student-card`, `generate-card-image`)
9. **Médio prazo:** Adicionar timeout + mensagem no fluxo PIX
10. **Médio prazo:** Verificar se `cleanup-rejected-documents` está agendada
