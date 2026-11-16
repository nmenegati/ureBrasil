# Technical Map — URE-Brasil

## 1. Estrutura

### Primeiro nível

| Pasta | Arquivos | Nota |
|---|---:|---|
| `docs/` | 34 | documentação técnica e auditorias |
| `public/` | 25 | assets públicos e ícones PWA |
| `src/` | 198 | app React do aluno + admin embarcado |
| `supabase/` | 65 | edge functions, migrations e config |
| `trae/` | 3 | artefatos auxiliares |
| `.claude/` | 2 | config auxiliar |

### `src/`

| Pasta | Arquivos |
|---|---:|
| `assets/` | 41 |
| `components/` | 69 |
| `contexts/` | 1 |
| `hooks/` | 12 |
| `integrations/` | 2 |
| `lib/` | 6 |
| `pages/` | 29 |
| `admin/` | 32 |
| `utils/` | 1 |

## 2. Páginas

Rotas definidas em [src/App.tsx](file:///d:/!Vendatto/PROJETOS/URE/URE-Brasil/src/App.tsx).

| Arquivo | Rota | Função | Dependências críticas |
|---|---|---|---|
| `Index.tsx` | `/` | landing page e entrada comercial | `student_profiles`, `student_cards`, `plans` |
| `Login.tsx` | `/login` | autenticação e retomada do fluxo | Auth, `student_profiles`, `payments`, `student_cards`, `documents` |
| `SignUp.tsx` | `/signup` | cadastro inicial com validação de CPF | `validate-cpf`, Auth |
| `CompleteProfile.tsx` | `/complete-profile` | completa dados pessoais, acadêmicos e endereço | `student_profiles`, `plans` |
| `EscolherPlano.tsx` | `/escolher-plano` | seleção do plano da carteirinha | `student_profiles`, `plans` |
| `Pagamento.tsx` | `/pagamento` | pagamento principal PIX/cartão | `plans`, `student_profiles`, `payment_gateway_config`, `create-payment`, `efi-payment`, `pagbank-payment-v2`, Mercado Pago via hook |
| `PagamentoPix.tsx` | `/pagamento/pix` | exibe QR PIX e acompanha status | `payments` |
| `PaymentSuccessPage.tsx` | `/pagamento/sucesso` | confirma pagamento e abre upsell físico | `payments`, `plans`, `student_profiles` |
| `Checkout.tsx` | `/checkout` | checkout do upsell físico | `payment_gateway_config`, `plans`, `student_profiles`, `payments`, `student_cards`, `create-payment`, `efi-payment`, `pagbank-payment-v2`, Mercado Pago via hook |
| `CheckoutFisica.tsx` | `/checkout-fisica` | compra avulsa da carteira física | `student_profiles`, `student_cards`, `plans`, `payment_gateway_config`, `create-payment`, `efi-payment`, `pagbank-payment-v2` |
| `UploadDocumentos.tsx` | `/upload-documentos` | upload e reenvio de documentos | `student_profiles`, `student_cards`, `documents`, bucket `documents` |
| `GerarCarteirinha.tsx` | `/gerar-carteirinha` | conferência final antes da emissão | `student_profiles`, `student_cards`, bucket `documents` |
| `Carteirinha.tsx` | `/carteirinha` | exibe, baixa e regenera a carteirinha digital | `student_profiles`, `student_cards`, buckets `profile-photos`, `documents`, `student-cards` |
| `VerificarCarteirinha.tsx` | `/verificar`, `/verificar/:usageCode` | verificação pública por código + data | `verify-student-card` |
| `Dashboard.tsx` | `/dashboard` | painel principal do aluno | `student_cards`, `payments`, `plans`, `student_profiles`, `documents`, `generate-digital-card` |
| `Perfil.tsx` | `/perfil` | edição de perfil, foto, endereço e conta | `student_profiles`, `payments`, `student_cards`, `plans`, buckets `profile-photos`/`documents`, `delete-user-data` |
| `MeusPagamentos.tsx` | `/meus-pagamentos` | histórico de pagamentos | `student_profiles`, `payments` |
| `MeusTickets.tsx` | `/meus-tickets` | tickets de suporte do aluno | `support_tickets` |
| `Notificacoes.tsx` | `/notificacoes` | lista e marca notificações como lidas | `notifications` |
| `AdquirirFisica.tsx` | `/adquirir-fisica` | entrada para física avulsa | `plans` |
| `AguardandoAprovacao.tsx` | `/aguardando-aprovacao` | espera análise e avanço do onboarding | `student_profiles` |
| `AdminEditEmail.tsx` | `/admin/edit-email` | troca de e-mail via função administrativa | `student_profiles`, `admin-update-email` |
| `VerificarEmail.tsx` | `/verificar-email` | bloqueio por e-mail não confirmado | `delete-unconfirmed-user`, Auth |
| `RecuperarSenha.tsx` | `/recuperar-senha` | solicita reset de senha | Auth |
| `RedefinirSenha.tsx` | `/redefinir-senha` | define nova senha | Auth |
| `Termos.tsx` | `/termos` | termos de uso | estática |
| `Privacidade.tsx` | `/privacidade` | política de privacidade | estática |
| `NotFound.tsx` | `*` | fallback 404 | sem dependências |
| `StatusValidacao.tsx` | sem rota em `App.tsx` | página legada de polling de validação | `documents`, `student_profiles` |

## 3. Edge Functions

Config principal em [supabase/config.toml](file:///d:/!Vendatto/PROJETOS/URE/URE-Brasil/supabase/config.toml). `_shared/` é pasta de helpers, não function deployável.

| Function | Método | O que faz | Tabelas | APIs externas | verify_jwt |
|---|---|---|---|---|---|
| `admin-update-email` | POST | altera e-mail via admin e grava log | `user_roles`, `activity_log` | Supabase Auth Admin | `true` |
| `chat-support` | POST | responde FAQ/chat e escala suporte | `chat_faq`, `plans`, `support_escalations` | OpenRouter | default repo |
| `cleanup-rejected-documents` | POST | limpa documentos rejeitados e audita | `documents`, `audit_logs` | none | default repo |
| `compare-faces` | POST | compara selfie x RG/foto e aprova/rejeita | `documents`, `student_profiles`, `face_validations`, `audit_logs` | AWS Rekognition | default repo |
| `create-payment` | POST | cria pagamento interno/PIX e persiste | `student_profiles`, `payments`, `plans` | none | `true` |
| `delete-unconfirmed-user` | POST | remove usuário não confirmado | `student_profiles` | Supabase Auth Admin | default repo |
| `delete-user-data` | POST | exclusão LGPD/anônima dados e storage | `student_profiles`, `student_cards`, `support_*`, `notifications`, `activity_log`, `audit_logs`, `cpf_validations` | Supabase Auth/Storage | `false` |
| `efi-payment` | POST | processa cartão via Efi | `student_profiles`, `payments` | EfiPay | default repo |
| `generate-digital-card` | POST | gera PNG da carteirinha digital e salva | `student_profiles`, `student_cards`, `card_generation_logs` | OpenRouter | `true` |
| `mercadopago-payment` | POST | cria pagamento PIX/cartão Mercado Pago | `student_profiles`, `payments` | Mercado Pago | default repo |
| `mercadopago-webhook` | POST | sincroniza status MP e dispara pixel | `payments`, `student_profiles` | Mercado Pago, Meta Conversions | default repo |
| `pagbank-payment-v2` | POST | processa cartão via PagBank | `student_profiles`, `payments` | PagBank | default repo |
| `validate-cpf` | POST | valida CPF com cache, rate-limit e fallback duplo | `cpf_rate_limits`, `cpf_validations` | APICPF, CPFHub | default repo |
| `validate-document-v2` | POST | valida documentos com IA e atualiza status | `documents`, `student_profiles`, `audit_logs` | OpenRouter / Gemini | default repo |
| `verify-student-card` | POST | valida carteirinha pública e resolve foto | `student_cards` + join em `student_profiles` | none | `false` |

## 4. Componentes principais

| Componente | Papel | Reuso |
|---|---|---|
| `Header.tsx` | header app/landing com menu, avatar, notificações, PWA e suporte | 24 páginas |
| `ProgressBar.tsx` | barra visual do onboarding | 8 páginas |
| `SupportModal.tsx` | tickets e conversa com suporte | 3 páginas + Header |
| `PasswordStrengthIndicator.tsx` | indicador visual de força de senha | 3 páginas |
| `payment/CardForm.tsx` | formulário custom de cartão | 3 páginas |
| `PWAInstallBanner.tsx` | banner global de instalação PWA | montado no `App.tsx` |
| `auth/ProtectedRoute.tsx` | guarda de autenticação | rotas protegidas |
| `auth/AuthLayout.tsx` | layout de autenticação | login/cadastro |
| `ui/*` | primitives shadcn/Radix (`button`, `input`, `card`, `alert`, `dialog`, etc.) | reuso amplo |

## 5. Integrações

| Arquivo | Papel |
|---|---|
| `src/integrations/supabase/client.ts` | cliente Supabase tipado com PKCE, `persistSession`, `autoRefreshToken`, `localStorage` |
| `src/integrations/supabase/types.ts` | tipos gerados do schema `public` |

### Tabelas tipadas

`activity_log`, `documents`, `payments`, `plans`, `rejection_reasons`, `student_cards`, `student_profiles`, `support_messages`, `support_tickets`, `system_settings`, `user_roles`, `webhook_logs`

### Views tipadas

`admin_dashboard`, `admin_tickets_summary`, `pending_documents_queue`, `physical_cards_to_print`, `student_full_status`

### Drift observado

O runtime também usa tabelas/views não tipadas localmente, como `notifications`, `face_validations`, `student_progress`, `payment_gateway_config`, `audit_logs`, `cpf_validations`, `cpf_rate_limits`, `card_generation_logs`, `chat_faq`, `support_escalations`.

## 6. `src/lib/`

| Arquivo | Exports principais |
|---|---|
| `imageCompression.ts` | `compressImage` — comprime imagem antes de upload |
| `utils.ts` | `cn` — merge de classes Tailwind |
| `validators.ts` | `validateCPF`, `formatCPF`, `validateEmail`, `formatPhone`, `formatCEP`, `formatEnrollmentNumber`, `formatBirthDateBR`, `parseBirthDateBR`, `isDisposableEmailDomain`, `validatePassword` |
| `cardNavigation.ts` | `goToStudentCardFlow` — redireciona para o passo correto da carteirinha |
| `dateUtils.ts` | `formatBirthDate`, `formatDateTime`, `formatDate` |
| `emailValidation.ts` | `isDisposableEmail` — bloqueio de e-mail descartável |

Nota: há util fora de `lib` em `src/utils/payment-helpers.ts` com máscaras de cartão, validade e `formatPrice`.

## 7. Hooks

| Hook | O que faz |
|---|---|
| `useAuth.tsx` | gerencia sessão/Auth Supabase e carrega `student_profiles` |
| `useEmailVerification.tsx` | bloqueia rotas protegidas quando o e-mail não foi confirmado |
| `useFaceValidation.ts` | acompanha o último resultado de `face_validations` em realtime |
| `useProgress.ts` | lê `student_progress` e refaz consulta via realtime |
| `useViaCep.tsx` | consulta endereço pelo ViaCEP |
| `useOnboardingGuard.ts` | guarda de onboarding baseada em `current_onboarding_step` |
| `useMercadoPago.ts` | carrega SDK MP, monta card form e invoca `mercadopago-payment` |
| `usePagBankEncrypt.ts` | carrega SDK PagSeguro/PagBank e criptografa cartão |
| `usePWAInstall.ts` | controla disponibilidade e prompt de instalação PWA |
| `use-mobile.tsx` | detector simples de viewport mobile |
| `useMediaQuery.ts` | wrapper genérico de `matchMedia` |
| `use-toast.ts` | estado global local de toasts |

## 8. Contexts

| Context | O que provê | Onde é usado |
|---|---|---|
| `ProfileContext.tsx` | `avatarUrl`, `fullName`, `updateAvatar`, `refreshProfile` | `ProfileProvider` envolve todo o app em `App.tsx`; consumido por `Header` e fluxos de perfil |

## 9. Configurações relevantes

- `vite.config.ts`: `@vitejs/plugin-react-swc`, `vite-plugin-pwa`, alias `@ -> ./src`, `manualChunks` para `vendor`, `ui`, `supabase`
- PWA: manifesto `URE Brasil`, `start_url: /carteirinha`, `display: standalone`, cache de REST Supabase (`NetworkFirst`) e Storage (`CacheFirst`)
- `package.json`: principais deps `react`, `react-router-dom`, `@supabase/supabase-js`, `@tanstack/react-query`, Radix/shadcn, `html2canvas`, `jspdf`, `qrcode`, `react-webcam`, `zod`, `date-fns`, `next-themes`, `framer-motion`

### Frontend envs usados

`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_ANON_KEY`, `VITE_MP_PUBLIC_KEY`, `VITE_PAGBANK_PUBLIC_KEY`, `VITE_EFI_ACCOUNT_ID`, `VITE_EFI_ENV`, `VITE_IS_PRODUCTION`

### Edge envs usados

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `MP_MODE`, `MP_ACCESS_TOKEN`, `MP_PROD_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `META_ACCESS_TOKEN`, `META_PIXEL_ID`, `PAGBANK_ENV`, `PAGBANK_MODE`, `PAGBANK_SANDBOX_KEY`, `PAGBANK_PROD_KEY`, `EFI_MODE`, `EFI_CLIENT_ID_SANDBOX`, `EFI_CLIENT_ID_PROD`, `EFI_CLIENT_SECRET_SANDBOX`, `EFI_CLIENT_SECRET_PROD`, `AWS_REGION`, `OPENROUTER_API_KEY`, `OPENROUTER_CHAT_KEY`, `OPENROUTER_API_KEY_GEN`, `APICPF_API_KEY`, `CPFHUB_API_KEY`

## 10. Fluxos críticos

| Fluxo | Resumo |
|---|---|
| Onboarding do aluno | `SignUp` -> `CompleteProfile` -> `EscolherPlano` -> `Pagamento` -> (`PaymentSuccessPage` ou `UploadDocumentos`) -> `GerarCarteirinha` -> `Carteirinha`; o passo vive em `student_profiles.current_onboarding_step` |
| Geração de carteira digital | acontece no client em `Carteirinha.tsx` (html2canvas + upload em `student-cards`) e via edge `generate-digital-card` (OpenRouter + PNG + update em `student_cards`) |
| Pagamento | PIX/cartão são orquestrados em `Pagamento`, `Checkout` e `CheckoutFisica`; gateways ativos usam Mercado Pago, PagBank ou Efi |
| Validação de documentos | upload em `UploadDocumentos` -> análise em `validate-document-v2` -> comparação facial em `compare-faces` -> avanço do onboarding |
| Verificação pública da carteira | `VerificarCarteirinha.tsx` chama `verify-student-card`, que valida `usage_code` + data de nascimento e resolve a foto com fallback `profile-photos -> documents` |
