# Auditoria Final — URE Brasil
**Data:** 2026-04-17  
**Escopo:** Itens pendentes após todas as correções desta sessão

---

## Correções aplicadas nesta sessão (referência)

| Correção | Arquivo |
|---|---|
| HMAC-SHA256 no webhook Mercado Pago | `supabase/functions/mercadopago-webhook/index.ts` |
| console.log com dados internos | `Pagamento.tsx`, `Checkout.tsx`, `Login.tsx`, `useAdminAuth.ts` |
| Edge functions legadas removidas | `pagbank-session`, `pagbank-payment-card`, `generate-student-card`, `generate-card-image` |
| Rollback de Storage se banco falhar no upload | `UploadDocumentos.tsx` |
| Redirect PIX sem sessão (F5/fechar aba) | `PagamentoPix.tsx` |
| onboarding step `"documents"` → `"upload_documents"` | `Checkout.tsx:314` |
| `delete-unconfirmed-user` com autenticação própria | `supabase/functions/delete-unconfirmed-user/index.ts` |
| console.log expondo objeto adminUser | `src/admin/hooks/useAdminAuth.ts` |

---

## 1. SEGURANÇA — Pendências

### S1 — `delete-user-data` com `verify_jwt = false` **[P1]**

**Arquivo:** `supabase/config.toml:10`

A função faz validação manual de JWT via `auth.getUser(token)`, o que é funcionalmente correto. Porém `verify_jwt = false` remove a camada de proteção do runtime do Supabase antes do código executar — qualquer erro no bloco de validação manual deixa a função desprotegida.

**Recomendação:** mudar para `verify_jwt = true` e remover o bloco manual de validação (linhas 49–66 do index.ts), deixando o Supabase injetar o usuário via contexto. Se a validação manual for intencional por alguma razão específica, documentar o motivo no arquivo.

---

### S2 — `console.log` com dados sensíveis em edge functions **[P1]**

**Arquivo:** `supabase/functions/pagbank-payment-v2/index.ts`

Logs expondo dados em produção (visíveis no Supabase Dashboard → Logs):

```ts
// Linha 156-161 — expõe user.id e email do pagador
console.log("🔍 Debug auth:", { userId: user?.id, userEmail: user?.email, ... })

// Linha 204 — expõe dados completos do body do pagamento
console.log("🔍 [BODY]:", { ... })

// Linha 230-233 — expõe student_id e plan_id
console.log("🔍 [PROFILE]:", { student_id: profile?.id, plan_id: profile?.plan_id, ... })

// Linha 325 — expõe payload completo enviado ao PagBank (inclui CPF, nome, telefone)
console.log("🔍 [PAYLOAD]:", JSON.stringify(orderPayload, null, 2))
```

Esses logs são debug de desenvolvimento deixados em produção. O payload completo (linha 325) inclui CPF, nome completo e telefone — dado pessoal sensível (LGPD).

---

### S3 — `console.log` com dados em `validate-document-v2` **[P1]**

**Arquivo:** `supabase/functions/validate-document-v2/index.ts`

```ts
// Linhas 506-508, 560-562 — exibe resposta bruta do Claude (pode conter dados do documento)
console.log('=== RESPOSTA CLAUDE (RAW) ===')
console.log(rawContent)

// Linhas 514-517 — exibe base64 do PDF (conteúdo do documento do usuário)
console.log('=== PDF DEBUG ===')
console.log('Base64 preview:', base64.substring(0, 100))
```

Resposta bruta do Claude e preview de base64 de documento em log de produção são dados pessoais (RG, CPF, comprovante de matrícula).

---

### S4 — `console.log` com dados em painel admin **[P1]**

**Arquivo:** `src/admin/pages/AdminLogin.tsx:46,53,69`

```ts
console.log('[Admin Login] auth.uid:', data.user.id);      // user.id em login
console.log('[Admin Login] query result (by auth_user_id):', byId, byIdError);  // objeto admin
console.log('[Admin Login] query result (by email):', byEmail, byEmailError);   // objeto admin
```

**Arquivo:** `src/admin/components/Layout/AdminLayout.tsx:28,29,41,42`

```ts
console.log('[AdminGuard] adminUser:', adminUser);   // objeto adminUser completo (2x)
console.log('[AdminGuard] redirecting to:', ...)
```

Objeto `adminUser` exposto no console do browser durante navegação no painel admin.

---

### S5 — CORS `"*"` em funções de pagamento **[P2]**

Todas as edge functions retornam `"Access-Control-Allow-Origin": "*"`. Para `create-payment`, `mercadopago-payment`, `pagbank-payment-v2` e `efi-payment`, restringir à origem de produção reduz superfície de ataque cross-origin.

```ts
// Atual em todas as funções:
"Access-Control-Allow-Origin": "*"

// Recomendado para funções de pagamento:
"Access-Control-Allow-Origin": "https://urebrasil.com.br"
```

---

### S6 — `cleanup-rejected-documents` com `[SUA_SERVICE_ROLE_KEY]` hardcoded no cron **[P2]**

**Arquivo:** `supabase/migrations/20260110140000_schedule_cleanup.sql:19`

```sql
headers:='{"Authorization": "Bearer [SUA_SERVICE_ROLE_KEY]"}'::jsonb
```

O placeholder `[SUA_SERVICE_ROLE_KEY]` indica que a migration foi aplicada sem substituir o valor real. Se o cron foi executado como está, o job diário falha silenciosamente (401 na chamada HTTP) — documentos rejeitados nunca são removidos. Verificar via `SELECT * FROM cron.job;` no banco se o job está ativo e com valor correto.

---

## 2. FLUXO — Pendências

### F1 — `PaymentSuccessPage` sem redirect de fallback ao recarregar **[P1]**

**Arquivo:** `src/pages/PaymentSuccessPage.tsx:60-85`

A página tem `useOnboardingGuard("upsell_physical")` que protege o acesso por step. Porém se o usuário chegar via F5 (perdendo `location.state`), o comportamento é:
- `location.state` fica `undefined`
- Fallback cai em `localStorage.getItem("recent_payment_id")` (linha 81) — só recupera o `paymentId`, sem `planName`, `amount` ou `paymentMethod`
- A página renderiza com valores nulos: valor exibido como `R$ 0,00`, nome do plano ausente

Diferente do `PagamentoPix.tsx` (que já tem redirect com toast), esta página exibe conteúdo degradado sem aviso. O `paymentId` recuperado do localStorage ainda permite que o upsell funcione, então não é uma quebra total — mas a UX é confusa.

---

### F2 — `selected_plan_id` exclusivamente em localStorage **[P1]**

Plano selecionado em `EscolherPlano.tsx` é gravado apenas em `localStorage`. Se o usuário troca de dispositivo, abre em aba anônima ou limpa dados do browser entre a seleção e o pagamento, o plano se perde sem mensagem clara.

Não há fallback buscando o último `plan_id` associado ao perfil no banco.

---

### F3 — Polling PIX sem tratamento de falha de rede **[P2]**

**Arquivo:** `src/pages/PagamentoPix.tsx:65-68`

```ts
if (error) {
  console.error("[PIX] Erro ao consultar status:", error.message);
  return; // apenas ignora e aguarda próximo tick
}
```

Falhas de rede silenciosas. Se a conexão cair durante os 10 minutos e o pagamento for confirmado nesse intervalo, o usuário não é redirecionado. Não há contador de falhas consecutivas nem aviso de "sem conexão".

---

### F4 — Upsell físico sem proteção contra duplo pagamento **[P2]**

**Arquivo:** `src/pages/Checkout.tsx`

Antes de processar o upsell, não há verificação de pagamento já aprovado para cartão físico no banco. Um retry de rede ou duplo-clique pode gerar dois registros de pagamento para o mesmo upsell.

---

## 3. EDGE FUNCTIONS — Pendências

### E1 — Webhook para gateway Efi ausente **[P1]**

Existe `mercadopago-webhook` para confirmação assíncrona de pagamentos MP. Não há função equivalente para Efi (Gerencianet/Banco Inter). Pagamentos Efi com status `pending` ou `in_process` dependem exclusivamente do polling do frontend (que tem timeout de 10 minutos). Após o timeout, o pagamento pode ser confirmado pelo banco mas nunca atualizado no sistema.

---

### E2 — `cleanup-rejected-documents` com cron possivelmente inativo **[P2]**

Duplica S6: a migration do cron (`20260110140000_schedule_cleanup.sql`) usa placeholder `[SUA_SERVICE_ROLE_KEY]` não substituído. O pg_cron pode estar registrado mas falhando silenciosamente. Validar com:

```sql
SELECT * FROM cron.job WHERE jobname = 'cleanup-rejected-docs-daily';
SELECT * FROM cron.job_run_details WHERE jobid = <id> ORDER BY start_time DESC LIMIT 10;
```

---

### E3 — `verify-student-card` sem rate limiting explícito **[P2]**

**Arquivo:** `src/pages/VerificarCarteirinha.tsx:120`

A função é pública por design (validação de QR Code por terceiros). Não há rate limiting configurado via Supabase, o que permite enumeração automatizada de números de carteira. Mitigação via Supabase Dashboard → Edge Functions → Rate Limiting, ou validação de formato do card_number antes da consulta ao banco.

---

## 4. QUALIDADE — Itens críticos pendentes

### Q1 — `console.log` com dados em painel admin (frontend) **[P1]**

Consolidado com S4. Os logs em `AdminLogin.tsx` (3 instâncias) e `AdminLayout.tsx` (4 instâncias) expõem `user.id` e objeto `adminUser` no console do browser — visíveis para qualquer pessoa com DevTools aberto na máquina do administrador.

---

### Q2 — `select('*')` em fluxos críticos de usuário **[P2]**

Após as correções desta sessão, persistem ~35 ocorrências. As mais impactantes em fluxos do usuário final (não admin):

| Arquivo | Linha | Tabela | Dados desnecessários |
|---|---|---|---|
| `src/pages/Perfil.tsx` | 231, 259, 282, 291 | `student_profiles`, `payments`, `documents` | CPF, dados pessoais completos |
| `src/pages/UploadDocumentos.tsx` | 620, 639 | `documents` | Todos os metadados de documentos |
| `src/hooks/useProgress.ts` | 46 | `student_profiles` | CPF, endereço, dados completos do perfil |
| `src/hooks/useFaceValidation.ts` | 41 | `face_validations` | Todos os campos |

---

## Resumo executivo de prioridades

| # | Prioridade | Item | Arquivo |
|---|---|---|---|
| 1 | **P1** | `pagbank-payment-v2` logs com CPF/nome/email | `supabase/functions/pagbank-payment-v2/index.ts` |
| 2 | **P1** | `validate-document-v2` logs com conteúdo de documentos | `supabase/functions/validate-document-v2/index.ts` |
| 3 | **P1** | `AdminLogin.tsx` + `AdminLayout.tsx` logs com dados de admin | `src/admin/pages/AdminLogin.tsx`, `src/admin/components/Layout/AdminLayout.tsx` |
| 4 | **P1** | `delete-user-data` com `verify_jwt = false` | `supabase/config.toml` |
| 5 | **P1** | Webhook Efi ausente | `supabase/functions/` |
| 6 | **P1** | `PaymentSuccessPage` conteúdo degradado após F5 | `src/pages/PaymentSuccessPage.tsx` |
| 7 | **P1** | `selected_plan_id` sem fallback de banco | `src/pages/EscolherPlano.tsx` |
| 8 | **P2** | Cron `cleanup-rejected-documents` com placeholder não substituído | `supabase/migrations/20260110140000_schedule_cleanup.sql` |
| 9 | **P2** | CORS `*` em funções de pagamento | todas as edge functions |
| 10 | **P2** | `verify-student-card` sem rate limiting | Supabase Dashboard |
| 11 | **P2** | `select('*')` em Perfil, UploadDocumentos, useProgress | múltiplos arquivos |
