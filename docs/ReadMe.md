# docs/ — URE Brasil: Documentação e Auditorias
**Última atualização:** 2026-04-17

---

## Visão Geral do Projeto

O sistema URE Brasil é responsável por:
- Cadastro e onboarding de estudantes
- Upload e validação automática de documentos (RG, matrícula, foto 3x4, selfie)
- Integração com serviços externos (AWS Rekognition, Anthropic Claude, PagBank, Seedream/OpenRouter)
- Emissão de carteirinha estudantil digital (e física) com controle de status e logs de auditoria

**Arquitetura:** React + TypeScript + Vite + shadcn-ui + Tailwind CSS · Supabase (PostgreSQL, RLS, Edge Functions) · Supabase Auth + Storage

---

## Arquivos neste diretório

| Arquivo | Descrição | Data |
|---|---|---|
| [performance-audit.md](performance-audit.md) | Auditoria de performance (bundle, queries, render) | 2026-03-26 |
| [schema.sql](schema.sql) | Schema completo do banco (tabelas, triggers, functions, RLS) | 2026-03-26 |
| [triggers-rpcs.md](triggers-rpcs.md) | Documentação de triggers e RPCs do banco | 2026-02-17 |
| [audit-completo.md](audit-completo.md) | 1ª auditoria: segurança, fluxo, qualidade, edge functions | 2026-04-17 |
| [audit-2026-04-17.md](audit-2026-04-17.md) | 2ª auditoria: itens pós-correções iniciais | 2026-04-17 |
| [audit-final-2026-04-17.md](audit-final-2026-04-17.md) | Auditoria final: apenas itens ainda pendentes | 2026-04-17 |

---

## Status — Performance Audit

| # | Item | Prioridade | Status |
|---|---|---|---|
| 1 | Header: 4 queries sequenciais — cascade waterfall | P0 | ✅ **Resolvido** — tickets movidos para dentro de `checkPhysicalCard` |
| 2 | Dashboard: 7 queries sequenciais com `select('*')` | P0 | ⚠️ **Parcial** — `payments` corrigido; queries ainda sequenciais |
| 3 | `select('*')` em 43+ instâncias | P0 | ⚠️ **Parcial** — Header, Dashboard, Perfil (plans) corrigidos; ~35 restantes |
| 4 | Admin pages sem paginação | P0 | ⏳ **Pendente** |
| 5 | `ProfileContext` causa re-renders globais | P0 | ⏳ **Pendente** |
| 6 | `html2canvas` + `recharts` não lazy-loaded | P1 | ✅ **Resolvido** — lazy loading em Carteirinha.tsx e admin Dashboard |
| 7 | Páginas principais importadas estaticamente em App.tsx | P1 | ⏳ **Pendente** |
| 8 | Signed URLs em loop no Perfil.tsx | P1 | ⏳ **Pendente** |
| 9 | `useAuth` busca perfil a cada uso sem cache compartilhado | P1 | ⏳ **Pendente** |
| 10 | Templates PNG sem WebP | P1 | ⏳ **Pendente** |
| 11 | Radix UI fora do chunk correto no Vite | P1 | ⏳ **Pendente** |
| 12 | Google Fonts render-blocking | P2 | ⏳ **Pendente** |
| 13 | Favicon 71KB | P2 | ⏳ **Pendente** |
| 14 | `useCallback` ausente nos handlers do Header | P2 | ⏳ **Pendente** |
| 15 | Componentes monolíticos >1000 linhas | P2 | ⏳ **Pendente** |
| 16 | Ícones PWA duplicados | P2 | ⏳ **Pendente** |

---

## Status — Segurança

| Item | Arquivo | Status |
|---|---|---|
| HMAC-SHA256 ausente no webhook Mercado Pago | `supabase/functions/mercadopago-webhook/index.ts` | ✅ **Resolvido** |
| `delete-unconfirmed-user` sem autenticação própria | `supabase/functions/delete-unconfirmed-user/index.ts` | ✅ **Resolvido** — JWT + verificação de email adicionados |
| `console.log` expondo `user.id`/email em Pagamento, Checkout, Login | `src/pages/` | ✅ **Resolvido** |
| `console.log` expondo objeto `adminUser` em `useAdminAuth` | `src/admin/hooks/useAdminAuth.ts` | ✅ **Resolvido** |
| `console.log` com dados de admin em AdminLogin e AdminLayout | `src/admin/pages/AdminLogin.tsx`, `src/admin/components/Layout/AdminLayout.tsx` | ✅ **Resolvido** |
| `console.log` com CPF/nome/email no payload do PagBank | `supabase/functions/pagbank-payment-v2/index.ts` | ✅ **Resolvido** |
| `console.log` com conteúdo de documentos e resposta Claude | `supabase/functions/validate-document-v2/index.ts` | ✅ **Resolvido** |
| `delete-user-data` com `verify_jwt = false` | `supabase/config.toml` | ⏳ **Pendente** |
| CORS `"*"` em funções de pagamento | todas as edge functions | ⏳ **Pendente** |
| Cron com placeholder `[SUA_SERVICE_ROLE_KEY]` não substituído | `supabase/migrations/20260110140000_schedule_cleanup.sql` | ⏳ **Pendente** — verificar `cron.job_run_details` no banco |
| `select('*')` em AdminLogin, Perfil, UploadDocumentos, useProgress | múltiplos arquivos | ⏳ **Pendente** (~35 ocorrências) |
| RLS não confirmado em tabelas auxiliares | `activity_log`, `audit_logs`, `auditoria_cie`, etc. | ⏳ **Pendente** — verificar no Supabase Dashboard |

---

## Status — Fluxo de Aquisição

| Item | Arquivo | Status |
|---|---|---|
| `current_onboarding_step: "documents"` → `"upload_documents"` | `src/pages/Checkout.tsx:314` | ✅ **Resolvido** |
| Redirect PIX sem sessão após F5/fechar aba | `src/pages/PagamentoPix.tsx` | ✅ **Resolvido** |
| Rollback de Storage se operação de banco falhar no upload | `src/pages/UploadDocumentos.tsx` | ✅ **Resolvido** |
| `PaymentSuccessPage` exibe conteúdo degradado após F5 | `src/pages/PaymentSuccessPage.tsx` | ⏳ **Pendente** |
| `selected_plan_id` exclusivamente em localStorage sem fallback | `src/pages/EscolherPlano.tsx` | ⏳ **Pendente** |
| Polling PIX sem tratamento de falha de rede | `src/pages/PagamentoPix.tsx` | ⏳ **Pendente** |
| Upsell físico sem proteção contra duplo pagamento | `src/pages/Checkout.tsx` | ⏳ **Pendente** |
| Duas fontes de verdade: `useOnboardingGuard` vs `goToStudentCardFlow()` | `src/hooks/useOnboardingGuard.ts`, `src/lib/cardNavigation.ts` | ⏳ **Pendente** |

---

## Status — Edge Functions

| Item | Arquivo | Status |
|---|---|---|
| Legadas removidas: pagbank-session, pagbank-payment-card, generate-student-card, generate-card-image | `supabase/functions/`, `supabase/config.toml` | ✅ **Resolvido** |
| Webhook Efi ausente — pagamentos Efi ficam pendentes indefinidamente | `supabase/functions/` | ⏳ **Pendente** |
| Cron `cleanup-rejected-docs-daily` possivelmente inativo | `supabase/migrations/20260110140000_schedule_cleanup.sql` | ⏳ **Pendente** |
| `verify-student-card` sem rate limiting — enumeração de cartões | Supabase Dashboard | ⏳ **Pendente** |

---

## Próximos itens recomendados (por prioridade)

| # | Prioridade | Item |
|---|---|---|
| 1 | **P1** | `delete-user-data`: mudar `verify_jwt = false` → `true` em `config.toml` |
| 2 | **P1** | Webhook Efi: criar `supabase/functions/efi-webhook/index.ts` |
| 3 | **P1** | `PaymentSuccessPage`: redirect com toast quando `location.state` ausente |
| 4 | **P1** | `selected_plan_id`: fallback buscando `plan_id` do perfil no banco |
| 5 | **P2** | Verificar/corrigir cron `cleanup-rejected-docs-daily` no banco |
| 6 | **P2** | Rate limiting em `verify-student-card` via Supabase Dashboard |
| 7 | **P2** | CORS `"*"` → `"https://urebrasil.com.br"` nas funções de pagamento |
| 8 | **P2** | Admin pages: adicionar `.limit()` e paginação |
| 9 | **P2** | `select('*')` remanescentes: Perfil, UploadDocumentos, useProgress, AdminLogin |
| 10 | **P2** | Polling PIX: contador de falhas + aviso visual de "sem conexão" |
