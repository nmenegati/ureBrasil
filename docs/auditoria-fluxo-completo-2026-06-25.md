# Auditoria Completa de Fluxo — URE-Brasil

**Data**: 2026-06-25  
**Modo**: Somente leitura — nenhum arquivo foi alterado  
**Método**: Varredura automatizada de todo o código-fonte, edge functions, migrations, configs e componentes

---

## 1. Arquitetura Geral

### 1.1 Stack (versões do package.json)

| Pacote | Versão |
|--------|--------|
| React | ^18.3.1 |
| React DOM | ^18.3.1 |
| React Router DOM | ^6.30.1 |
| TypeScript | ^5.8.3 |
| Vite | ^5.4.19 |
| @supabase/supabase-js | ^2.84.0 |
| Tailwind CSS | ^3.4.17 |
| @tanstack/react-query | ^5.83.0 |
| react-hook-form | ^7.61.1 |
| zod | ^3.25.76 |
| framer-motion | ^12.23.24 |
| recharts | ^2.15.4 |
| html2canvas | ^1.4.1 |
| jspdf | ^2.5.2 |
| qrcode / qrcode.react | ^1.5.4 / ^4.2.0 |
| react-webcam | ^7.2.0 |
| sonner | ^1.7.4 |
| date-fns | ^3.6.0 |
| vite-plugin-pwa | ^1.2.0 |
| lucide-react | ^0.563.0 |
| UI: Radix UI (diversos) + shadcn/ui | Diversos |

### 1.2 Estrutura de Pastas (src/)

```
src/
├── App.tsx                          # Roteamento principal
├── App.css
├── main.tsx                         # Entrypoint
├── index.css                        # Estilos globais (Tailwind)
├── vite-env.d.ts
├── assets/                          # Imagens e logos
│   ├── logos/                       # Bandeiras de pagamento
│   └── *.png, *.webp               # Mockups, ícones, carteirinhas
├── components/
│   ├── auth/
│   │   ├── AuthLayout.tsx           # Layout das páginas de auth
│   │   └── ProtectedRoute.tsx       # Guard de autenticação
│   ├── payment/
│   │   └── CardForm.tsx             # Formulário de cartão (PagBank/Efi)
│   ├── ui/                          # Componentes shadcn/ui (~50 arquivos)
│   ├── CameraCapture.tsx            # Captura de selfie via webcam
│   ├── CardLayoutFront.tsx          # Layout visual da carteirinha
│   ├── ChatWidget.tsx               # Widget de chat com IA
│   ├── ChatWrapper.tsx              # Wrapper do chat
│   ├── Header.tsx                   # Header/navegação (~640 linhas)
│   ├── NavLink.tsx                  # Link de navegação
│   ├── NovoTicketModal.tsx          # Modal de novo ticket
│   ├── PasswordStrengthIndicator.tsx
│   ├── PolicyModal.tsx              # Modais de política/termos
│   ├── ProgressBar.tsx              # Barra de progresso
│   ├── PWAInstallBanner.tsx         # Banner de instalação PWA
│   ├── StudentCardConfirmationModal.tsx  # Modal de confirmação (CÓDIGO MORTO)
│   ├── SupportModal.tsx             # Modal de suporte (~724 linhas)
│   └── TicketChat.tsx               # Chat de ticket do usuário
├── contexts/
│   └── ProfileContext.tsx           # Context de avatar/perfil
├── hooks/
│   ├── useAuth.tsx                  # Autenticação Supabase
│   ├── useEmailVerification.tsx     # Verificação de email
│   ├── useFaceValidation.ts         # Validação facial (realtime)
│   ├── useMercadoPago.ts            # SDK Mercado Pago
│   ├── useMediaQuery.ts             # Media query hook
│   ├── use-mobile.tsx               # Detecção mobile
│   ├── useOnboardingGuard.ts        # Guard de etapas do onboarding
│   ├── usePagBankEncrypt.ts         # Criptografia PagBank (NÃO UTILIZADO)
│   ├── useProgress.ts              # Hook de progresso
│   ├── usePWAInstall.ts            # Instalação PWA
│   ├── use-toast.ts                # Toast notifications
│   └── useViaCep.tsx               # Busca CEP via ViaCep API
├── integrations/supabase/
│   ├── client.ts                    # Cliente Supabase
│   └── types.ts                     # Tipos gerados do banco
├── lib/
│   ├── cardNavigation.ts            # Lógica de navegação por etapa
│   ├── dateUtils.ts                 # Utilitários de data
│   ├── emailValidation.ts           # Validação de email descartável
│   ├── imageCompression.ts          # Compressão de imagens
│   ├── utils.ts                     # cn() do shadcn
│   └── validators.ts               # Validadores (CPF, telefone, senha)
├── pages/
│   ├── Index.tsx                    # Landing page
│   ├── Login.tsx                    # Login
│   ├── SignUp.tsx                   # Cadastro (2 etapas)
│   ├── VerificarEmail.tsx           # Verificação de email
│   ├── RecuperarSenha.tsx           # Recuperação de senha
│   ├── RedefinirSenha.tsx           # Redefinição de senha
│   ├── CompleteProfile.tsx          # Completar perfil/endereço/acadêmico
│   ├── EscolherPlano.tsx            # Seleção de plano (law students)
│   ├── Pagamento.tsx                # Pagamento (card/PIX)
│   ├── PagamentoPix.tsx             # Aguardando PIX
│   ├── Checkout.tsx                 # Checkout upsell carteirinha física
│   ├── CheckoutFisica.tsx           # Compra avulsa carteirinha física
│   ├── PaymentSuccessPage.tsx       # Sucesso + upsell modal
│   ├── MeusPagamentos.tsx           # Histórico de pagamentos
│   ├── UploadDocumentos.tsx         # Upload de 4 documentos
│   ├── StatusValidacao.tsx          # Status de validação
│   ├── AguardandoAprovacao.tsx      # Aguardando revisão manual
│   ├── GerarCarteirinha.tsx         # Confirmar dados e gerar
│   ├── Carteirinha.tsx              # Visualizar carteirinha digital
│   ├── VerificarCarteirinha.tsx      # Verificação pública
│   ├── AdquirirFisica.tsx           # Adquirir carteirinha física
│   ├── Dashboard.tsx                # Dashboard do aluno
│   ├── Perfil.tsx                   # Perfil do usuário
│   ├── MeusTickets.tsx              # Tickets do usuário
│   ├── Notificacoes.tsx             # Notificações
│   ├── AdminEditEmail.tsx           # Admin: editar email
│   ├── Termos.tsx                   # Termos de uso
│   ├── Privacidade.tsx              # Política de privacidade
│   └── NotFound.tsx                 # 404
├── admin/
│   ├── hooks/
│   │   └── useAdminAuth.ts          # Auth do admin (client-side)
│   ├── components/
│   │   ├── Layout/AdminLayout.tsx   # Layout do admin
│   │   ├── DocumentReview/          # Aprovação/rejeição de docs
│   │   ├── PaymentManagement/       # Gestão de pagamentos
│   │   ├── CardProduction/          # Produção de carteirinhas físicas
│   │   ├── TicketManagement/        # Gestão de tickets
│   │   ├── Notifications/           # Envio de notificações
│   │   ├── Logs/                    # Logs de auditoria
│   │   ├── AdminUsers/              # Gestão de admins
│   │   ├── Settings/                # Configurações (gateways)
│   │   ├── shared/MaskedCPF.tsx     # Máscara de CPF
│   │   └── DashboardCharts.tsx      # Gráficos do dashboard
│   └── pages/
│       ├── AdminLogin.tsx
│       ├── Dashboard.tsx
│       ├── Documents.tsx
│       ├── Payments.tsx
│       ├── Cards.tsx
│       ├── Tickets.tsx
│       ├── Notifications.tsx        # Super-admin only
│       ├── Logs.tsx                 # Super-admin only
│       ├── AdminUsers.tsx           # Super-admin only
│       └── Settings.tsx             # Super-admin only
└── utils/
    └── payment-helpers.ts           # Helpers de pagamento
```

### 1.3 Rotas Definidas (src/App.tsx:101-215)

#### Rotas Públicas (sem guard)

| Rota | Componente | Linha |
|------|-----------|-------|
| `/` | Index | 103 |
| `/login` | Login | 104 |
| `/signup` | SignUp | 105 |
| `/complete-profile` | CompleteProfile | 106 |
| `/verificar` | VerificarCarteirinha | 152 |
| `/verificar/:usageCode` | VerificarCarteirinha | 153 |
| `/termos` | Termos | 156 |
| `/privacidade` | Privacidade | 157 |
| `/verificar-email` | VerificarEmail | 158 |
| `/recuperar-senha` | RecuperarSenha | 159 |
| `/redefinir-senha` | RedefinirSenha | 160 |
| `/admin/login` | AdminLogin | 203 |
| `*` | NotFound | 215 |

#### Rotas Protegidas (ProtectedRoute)

| Rota | Componente | Linha |
|------|-----------|-------|
| `/escolher-plano` | EscolherPlano | 107-111 |
| `/pagamento` | Pagamento | 112-116 |
| `/pagamento/pix` | PagamentoPix | 117-121 |
| `/pagamento/sucesso` | PaymentSuccessPage | 122-126 |
| `/checkout` | Checkout | 127-131 |
| `/checkout-fisica` | CheckoutFisica | 132-136 |
| `/upload-documentos` | UploadDocumentos | 137-141 |
| `/gerar-carteirinha` | GerarCarteirinha | 142-146 |
| `/carteirinha` | Carteirinha | 147-151 |
| `/dashboard` | Dashboard | 161-165 |
| `/admin/edit-email` | AdminEditEmail | 166-170 |
| `/aguardando-aprovacao` | AguardandoAprovacao | 171-175 |
| `/adquirir-fisica` | AdquirirFisica | 176-180 |
| `/meus-pagamentos` | MeusPagamentos | 181-185 |
| `/meus-tickets` | MeusTickets | 186-190 |
| `/notificacoes` | Notificacoes | 191-195 |
| `/perfil` | Perfil | 196-200 |

#### Rotas Admin (SEM ProtectedRoute no router)

| Rota | Componente | Linha |
|------|-----------|-------|
| `/admin/dashboard` | AdminDashboardPage | 204 |
| `/admin/tickets` | AdminTicketsPage | 205 |
| `/admin/documents` | AdminDocumentsPage | 206 |
| `/admin/payments` | AdminPaymentsPage | 207 |
| `/admin/cards` | AdminCardsPage | 208 |
| `/admin/notifications` | NotificationsPage | 209 |
| `/admin/logs` | LogsPage | 210 |
| `/admin/admin-users` | AdminUsersPage | 211 |
| `/admin/settings` | AdminSettingsPage | 212 |

**Observação**: Rotas admin não têm `ProtectedRoute` no router. Cada página admin faz sua própria verificação via `useAdminAuth`, que é client-side only. Há um redirect por hostname em `App.tsx:78-83` para `console.*` → `/admin/login`, mas é trivialmente contornável.

#### ProtectedRoute (src/components/auth/ProtectedRoute.tsx)

- Usa `useAuth()` para obter `user` e `loading`
- Se `!user` após loading, redireciona para `/login` com `replace: true`
- Renderiza children apenas quando `user` é truthy

#### Onboarding Guard (src/hooks/useOnboardingGuard.ts)

- Não é usado no nível do router; consumido por páginas individuais
- Define `STEP_ROUTES` mapeando steps para rotas (linhas 6-15)
- Aceita `requiredStep` (string ou array), consulta `student_profiles.current_onboarding_step`
- Se step não corresponde, redireciona para a rota mapeada

### 1.4 Variáveis de Ambiente Utilizadas

| Variável | Arquivo:Linha | Uso |
|----------|--------------|-----|
| `VITE_SUPABASE_URL` | `client.ts:5`, `VerificarCarteirinha.tsx:103` | URL do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `client.ts:6`, `VerificarCarteirinha.tsx:105` | Chave anon do Supabase |
| `VITE_SUPABASE_ANON_KEY` | `VerificarCarteirinha.tsx:106` | Chave anon alternativa (fallback) |
| `VITE_PAGBANK_PUBLIC_KEY` | `usePagBankEncrypt.ts:18` | Chave pública PagBank (NÃO UTILIZADO) |
| `VITE_MP_PUBLIC_KEY` | `useMercadoPago.ts:90` | Chave pública Mercado Pago |
| `VITE_IS_PRODUCTION` | `useEmailVerification.tsx:5` | Flag de ambiente produção |
| `VITE_EFI_ACCOUNT_ID` | `Pagamento.tsx:72` | ID da conta Efi/Gerencianet |
| `VITE_EFI_ENV` | `Pagamento.tsx:73` | Ambiente Efi (default: "sandbox") |

### 1.5 Configurações

**Vite (vite.config.ts)**:
- Dev server: host `"::"`, porta `8080`
- Build: chunks manuais (vendor, ui, supabase)
- PWA: `registerType: "autoUpdate"`, manifest "URE Brasil", tema `#1B6B3A`
- Workbox: cache Supabase REST (NetworkFirst, 5min TTL), Storage (CacheFirst, 24h TTL)
- Alias: `@` → `./src`

**Vercel (vercel.json)**:
- SPA rewrite: `/(.*) → /index.html`
- Nenhum header, redirect ou build config adicional

**Supabase (supabase/config.toml)**:
- `project_id = "zyfbxzjfpncxfawthsht"`
- verify_jwt settings por função (ver seção 7)

---

## 2. Fluxo de Autenticação

### 2.1 SignUp (src/pages/SignUp.tsx)

**Formulário em 2 etapas:**

**Etapa 1 — Validação de CPF**:
- Campo: CPF + checkbox de consentimento
- Validação local via `validateCPF()` (lib/validators.ts)
- Verifica unicidade via `supabase.rpc('check_cpf_exists', { p_cpf })` (linhas 261-268)
- Chama edge function `validate-cpf` para consultar API CpfHub (linhas 470-471)
- Se válido: preenche nome e data de nascimento automaticamente (linhas 479-500)
- Se inválido na API: permite preenchimento manual

**Etapa 2 — Cadastro completo**:

| Campo | Validação |
|-------|-----------|
| fullName | Min 3, max 100 caracteres |
| CPF | Pré-validado na etapa 1 |
| birthDate | Formato DD/MM/YYYY, idade mínima 6 anos |
| email | Regex de formato + verificação de email descartável via `isDisposableEmail()` |
| confirmEmail | Deve coincidir com email |
| phone | 11 dígitos + unicidade via `supabase.rpc('check_phone_exists')` |
| password | 8-20 chars, validado por `validatePassword()` (maiúscula, minúscula, número) |
| confirmPassword | Deve coincidir com password |
| terms | Checkbox obrigatório |

**Submit** (linhas 532-679):
1. Faz sign out de sessão existente
2. Re-verifica unicidade de CPF e phone
3. Chama `supabase.auth.signUp()` com metadata: `{ full_name, cpf, birth_date, phone, terms_accepted: true }`
4. `emailRedirectTo: ${window.location.origin}/complete-profile`
5. Detecta email duplicado (identities array vazio)
6. Salva `pending_email` no localStorage e navega para `/verificar-email`

### 2.2 Login (src/pages/Login.tsx)

**Campos**: email, password, checkbox "rememberMe" (NÃO FUNCIONAL — estado existe mas não é passado para auth)

**Validação**: Ambos obrigatórios

**Método**: `supabase.auth.signInWithPassword({ email, password })`

**Pós-login routing** (linhas 46-163, com timeout de 10s):
1. `email_confirmed_at` null → `/verificar-email`
2. Sem perfil → `/complete-profile`
3. `manual_review_requested && !face_validated` → `/aguardando-aprovacao`
4. `!profile_completed` → `/complete-profile`
5. Sem pagamento aprovado → `/escolher-plano` (law) ou `/pagamento` (outros)
6. Card ativo → `/carteirinha`
7. Docs/face/terms incompletos → `/upload-documentos`
8. Senão → `/gerar-carteirinha`

### 2.3 Logout

- `supabase.auth.signOut()` (src/hooks/useAuth.tsx:107-110)
- Sem limpeza explícita de localStorage ou estado (Supabase SDK gerencia a sessão)

### 2.4 Recuperação de Senha

**RecuperarSenha (src/pages/RecuperarSenha.tsx)**:
- Campo: email
- Chama `supabase.auth.resetPasswordForEmail(email, { redirectTo: 'https://urebrasil.com.br/redefinir-senha' })`
- **URL de produção hardcoded** — não funciona em dev/staging

**RedefinirSenha (src/pages/RedefinirSenha.tsx)**:
- Campos: password, confirmPassword
- Escuta evento `PASSWORD_RECOVERY` ou `SIGNED_IN` no auth state change
- Timeout de 5 segundos para detectar sessão
- **Validação: mínimo 6 caracteres** — INCONSISTENTE com SignUp que exige 8+ com maiúscula/minúscula/número
- Chama `supabase.auth.updateUser({ password })`
- Redireciona para `/login` após 3 segundos

### 2.5 Proteção de Rotas

- **ProtectedRoute**: Verifica `user` do `useAuth()`. Se não autenticado, redireciona para `/login`
- **useOnboardingGuard**: Verifica `current_onboarding_step` no perfil. Se etapa incorreta, redireciona para a rota correta da etapa
- **Rotas admin**: SEM proteção no router. Proteção client-side via `useAdminAuth` dentro de cada página

---

## 3. Fluxo de Cadastro/Perfil

### 3.1 CompleteProfile (src/pages/CompleteProfile.tsx)

**Guard**: `useOnboardingGuard('complete_profile')` (linha 270)

**Campos de Endereço**:

| Campo | Validação | Obrigatório |
|-------|-----------|-------------|
| cep | 8 dígitos, busca automática via ViaCep | Sim |
| street | maxLength=70 | Sim |
| number | Apenas dígitos, max 5 | Sim |
| complement | maxLength=50 | Não |
| neighborhood | maxLength=70 | Sim |
| city | Auto-preenchido pelo CEP, disabled | Sim |
| state | Select de 27 UFs | Sim |

**Campos Acadêmicos**:

| Campo | Validação | Obrigatório |
|-------|-----------|-------------|
| educationLevel | fundamental/medio/tecnico/graduacao/pos_lato | Sim |
| institution | maxLength=70, autocomplete com 78 sugestões hardcoded | Sim |
| course | Condicional (tecnico/graduacao/pos_lato), autocomplete 54 sugestões | Condicional |
| courseType | direito/outro (apenas para graduacao/pos_lato) | Condicional |
| period | Select dinâmico por nível educacional | Sim |
| enrollmentNumber | Apenas dígitos, maxLength=11 | Sim |

**O que salva no banco** (student_profiles, linhas 470-489):
- Todos os campos de endereço e acadêmicos
- `is_law_student`: true se (graduacao/pos_lato) AND courseType==='direito'
- `profile_completed`: true (incondicional)
- `updated_at`: timestamp

**Pós-submit** (linhas 501-524):
- Law student → `current_onboarding_step: 'choose_plan'`, navega para `/escolher-plano`
- Não law student → auto-atribui plano `PLAN_GERAL_DIGITAL_ID` (`a20e423f-c222-47b0-814f-e532f1bbe0c4`), navega para `/pagamento`

### 3.2 Validação de CPF

- **Frontend** (src/lib/validators.ts): Validação algorítmica de dígitos verificadores
- **Edge function** (validate-cpf): Consulta API CpfHub com rate limiting (10/hora por IP) e cache em tabela `cpf_validations`
- **Unicidade**: RPC `check_cpf_exists` + constraint UNIQUE `unique_cpf` na tabela

### 3.3 Estado do Perfil

- `profile_completed` é setado para `true` incondicionalmente ao submeter o formulário (não há percentual incremental)
- Completude é binária: completo ou não completo
- O `useOnboardingGuard` verifica `current_onboarding_step` para determinar em qual etapa o usuário está

### 3.4 ProfileContext (src/contexts/ProfileContext.tsx)

- Provê `avatarUrl`, `fullName`, `updateAvatar`, `refreshProfile`
- Carrega de `student_profiles`: `avatar_url`, `full_name`, `profile_photo_url`
- Se `profile_photo_url` existe, cria signed URL do bucket `documents` (300s expiry)
- Fallback para `avatar_url`

---

## 4. Fluxo de Pagamento (COMPLETO)

### 4.1 Seleção de Plano (src/pages/EscolherPlano.tsx)

- **Guard**: `useOnboardingGuard('choose_plan')`
- **Não-law students**: Auto-redirecionados com plano `PLAN_GERAL_DIGITAL_ID` para `/pagamento`
- **Law students**: Veem 2 planos (`geral_digital`, `direito_digital`) da tabela `plans` (where `is_active=true`)
- Preços e nomes vêm do banco; features são hardcoded em `digitalPlansConfig`
- Info de upsell físico (`fisica_upsell`) exibida no rodapé
- Submit: salva `plan_id` em localStorage e `student_profiles.plan_id` no banco

### 4.2 Gateways Ativos

| Gateway | Status | Arquivo |
|---------|--------|---------|
| **Mercado Pago** | FUNCIONAL (card + PIX) | useMercadoPago.ts, mercadopago-payment/index.ts |
| **PagBank** | FUNCIONAL (card) mas com VIOLAÇÃO PCI | pagbank-payment-v2/index.ts |
| **Efi/Gerencianet** | FUNCIONAL (card) | efi-payment/index.ts |

Gateway ativo é determinado pela tabela `payment_gateway_config` (src/pages/Pagamento.tsx:236-256). Default fallback: `pagbank`.

### 4.3 Criação de Pagamento

**Por Cartão de Crédito/Débito**:

| Gateway | Fluxo | Edge Function | Problema |
|---------|-------|---------------|----------|
| Mercado Pago | SDK cria iframes seguros → token → edge function | `mercadopago-payment` | Amount vem do client |
| PagBank | Dados raw do cartão enviados ao servidor | `pagbank-payment-v2` | **VIOLAÇÃO PCI-DSS**: PAN, CVV, expiry enviados ao server |
| Efi | SDK gera payment_token client-side → edge function | `efi-payment` | Amount vem do client; birth hardcoded "1990-01-01" |

**Por PIX**:
- Mercado Pago: edge function `mercadopago-payment` com `payment_method: 'pix'`
- Outros gateways: edge function `create-payment` com `payment_method: 'pix'`
- Retorna `pix_code` + `qr_code_base64` → navega para `/pagamento/pix`
- Polling a cada 5 segundos por até 10 minutos

**Parcelamento** (Pagamento.tsx:301-306):
- Planos ≥ R$100: até 12x
- Planos ≥ R$50: até 6x
- Demais: até 3x
- Débito: sempre 1x

### 4.4 Webhooks

| Webhook | Edge Function | HMAC | verify_jwt | O que atualiza |
|---------|--------------|------|-----------|----------------|
| Mercado Pago | `mercadopago-webhook` | SHA256 com `MP_WEBHOOK_SECRET` | **NÃO CONFIGURADO** (default true) | `payments.status` |

**PROBLEMA CRÍTICO**: `mercadopago-webhook` não está no config.toml, então `verify_jwt` é `true` por default. Webhooks do Mercado Pago não enviam JWT do Supabase, então as chamadas serão rejeitadas. **Este webhook provavelmente não funciona em produção.**

### 4.5 Status de Pagamento

**Enum `payment_status`**: `pending` | `processing` | `approved` | `rejected` | `refunded`

**Transições**:
- Card (MP): `pending` → MP processa → status direto da resposta
- Card (PagBank/Efi): `pending` → resposta da API → status mapeado
- PIX: `pending` → polling a cada 5s → `approved` (via webhook ou polling)
- Mock (create-payment sandbox): `pending` → `approved` imediato

### 4.6 Upsell Carteirinha Física

- **Quando aparece**: Após pagamento do plano digital, em `PaymentSuccessPage.tsx` (modal após 2s)
- **Preço**: Vem do plano `fisica_upsell` no banco
- **Aceitar**: Salva dados de upsell no localStorage, navega para `/checkout` com estado
- **Recusar**: Avança para `upload_documents`
- **Checkout upsell** (Checkout.tsx): Mesmo fluxo de pagamento; ao sucesso, seta `student_cards.is_physical = true`

### 4.7 Página de Sucesso (PaymentSuccessPage.tsx)

- Mostra confirmação de pagamento
- Dispara evento de conversão Google Ads (`AW-18167800155`)
- Abre modal de upsell após 2s
- **No F5**: Recarrega dados do banco; se pagamento existe e está approved, mostra a tela normalmente

### 4.8 `usePagBankEncrypt.ts` — NÃO UTILIZADO

Este hook carrega o SDK PagBank para criptografia client-side de dados de cartão. **Não é importado em nenhum componente do projeto.** Dados de cartão PagBank são enviados em texto plano para a edge function `pagbank-payment-v2`.

---

## 5. Fluxo de Documentos

### 5.1 Upload

**4 documentos obrigatórios** (UploadDocumentos.tsx:92-121):

| Tipo | Label | Formatos | Max |
|------|-------|----------|-----|
| `matricula` | Comprovante de Matrícula | JPEG, PNG, PDF | 3MB |
| `rg` | Documento de Identidade | JPEG, PNG | 3MB |
| `foto` | Foto 3x4 | JPEG, PNG | 5MB |
| `selfie` | Selfie do Rosto | JPEG, PNG | 5MB |

**Processo de upload** (linhas 752-912):
1. Valida tipo e tamanho
2. Comprime se imagem > 1MB (via `imageCompression.ts`)
3. Upload para Supabase Storage bucket `documents` em `{user_id}/{type}/{timestamp}.{ext}`
4. Insere/atualiza registro na tabela `documents` com status `pending`
5. RG aceita upload de verso (segundo lado) via `handleAddRgSecondSide`

**Selfie** (CameraCapture.tsx): Webcam frontal via `react-webcam`, resolução ideal 720x960, guia oval visual, sem detecção facial client-side.

### 5.2 Validação por IA (Edge Function validate-document-v2)

- **Trigger**: `documents_validation_trigger` — disparado após INSERT ou UPDATE de status na tabela `documents`
- **Modelo**: OpenRouter → Gemini 2.5 Flash
- **O que valida**: Prompts específicos por tipo de documento (se é um RG válido, se a matrícula é legível, se a foto é adequada, se a selfie mostra o rosto)
- **Resultado**: `{ valid, confidence, recommendation, reason, issues }`
- **Atualiza**: `documents.status` para `approved` ou `rejected` com motivo

### 5.3 Validação Facial (Edge Function compare-faces)

- **Trigger**: `on_document_approved_compare_faces` — disparado após UPDATE de status para `approved` na tabela `documents`
- **Serviço**: AWS Rekognition `CompareFaces`
- **Compara**: selfie vs RG e selfie vs foto 3x4
- **Resultado**: Similarity scores e `passed` boolean
- **Atualiza**: `student_profiles.face_validated`, insere em `face_validations`
- **Copia**: Fotos aprovadas para bucket público `profile-photos`

**Hook useFaceValidation.ts**:
- Consulta tabela `face_validations` para resultado mais recente
- Subscription realtime para INSERT events na tabela

### 5.4 Status dos Documentos

**Enum `document_status`**: `pending` | `approved` | `rejected`

**Transições**:
- Upload → `pending`
- Trigger validate-document-v2 → `approved` ou `rejected` (com motivo)
- Rejeição → usuário pode re-uploadar → volta para `pending`

### 5.5 Rejeição/Reenvio

- Documento rejeitado mostra badge "Rejeitado" com motivo
- Botão "Reenviar" reaparece para o tipo rejeitado
- Ao re-uploadar: reseta status para `pending`, limpa campos de rejeição, re-triggera validação

### 5.6 Termos e Avanço

Após 4 documentos aprovados:
1. Exibe checkbox de termos com link para política
2. Ao aceitar: registra IP (via ipify.org), `terms_accepted=true`, `terms_accepted_at`, `terms_ip_address`, `terms_version='1.0'`
3. Se `face_validated=true`: chama RPC `advance_to_review` → `/gerar-carteirinha`
4. Se não face-validated: polling a cada 3s por até 45s
5. Timeout: botão "Solicitar validação manual" → seta `manual_review_requested=true` → `/aguardando-aprovacao`

---

## 6. Geração de Carteirinha

### 6.1 Digital

**Pré-requisitos** (GerarCarteirinha.tsx:104-118):
- 4 documentos aprovados
- Face validation passada
- Termos aceitos

**Confirmação** (GerarCarteirinha.tsx:134-153):
- `handleConfirmGenerate` NÃO cria o card record (isso é feito por trigger/backend)
- Apenas atualiza `current_onboarding_step: 'completed'` e navega para `/carteirinha`

**Geração da imagem** (Carteirinha.tsx:170-269):
- Client-side via `html2canvas` → gera PNG da carteirinha renderizada
- Upload para Supabase Storage `student-cards/{userId}/digital-card-front.png`
- URL pública salva em `student_cards.digital_card_url`
- Auto-gera na primeira visita quando `!card.digital_card_url`

### 6.2 card_number vs usage_code

| Campo | Formato | Geração | Uso |
|-------|---------|---------|-----|
| `card_number` | Sequencial numérico | DB function `generate_card_number()` | Exibido na verificação |
| `usage_code` | `URE-XXXXXX` | DB function `generate_usage_code()` | QR code, verificação pública |

### 6.3 QR Code

- **Biblioteca**: `qrcode` (npm)
- **Conteúdo**: `https://urebrasil.com.br/verificar/{usage_code}` (Carteirinha.tsx:154)
- **Config**: Error correction level medium, scale 4

### 6.4 Verificação Pública (verify-student-card)

- **Edge function**: `verify-student-card` com `verify_jwt: false` (intencionalmente pública)
- **Input**: `usage_code` + `birth_date` (segundo fator)
- **Retorna**: nome, instituição, curso, CPF mascarado (últimos 5 dígitos), card_number, validade, foto (signed URL), tipo (física/digital), status
- **Frontend**: `VerificarCarteirinha.tsx` — formulário público com meta `noindex,nofollow`

### 6.5 Física

- **AdquirirFisica.tsx**: Carrega plano `fisica_avulsa` do banco, navega para `/checkout-fisica`
- **CheckoutFisica.tsx**: Mesmo fluxo de pagamento dos demais gateways
- **Produção**: Gerenciada pelo admin em `Cards.tsx` — pipeline: Queue → Printed → Shipped → Delivered
- **Rastreamento**: Via `ShippingModal` que registra código de rastreio

### 6.6 Card Layout (CardLayoutFront.tsx)

- Componente presentacional com template de fundo
- Dois modos: `"direito"` (direito) e `"geral"` (geral)
- Exibe: foto, QR code, usage_code, nome, CPF, nascimento, instituição, nível educacional, período, curso, matrícula, validade

---

## 7. Edge Functions (TODAS)

### Resumo

| # | Nome | verify_jwt | O que faz |
|---|------|-----------|-----------|
| 1 | admin-update-email | `true` | Admin atualiza email de usuário via Auth Admin API |
| 2 | chat-support | default `true` | Chatbot híbrido FAQ + LLM (GPT-4o-mini via OpenRouter) |
| 3 | cleanup-rejected-documents | default `true` | Cron: limpa docs rejeitados >90 dias |
| 4 | compare-faces | default `true` | AWS Rekognition: compara selfie vs RG/foto |
| 5 | create-payment | `true` | Processador mock/sandbox de pagamentos |
| 6 | delete-unconfirmed-user | default `true` | Deleta usuário com email não confirmado |
| 7 | delete-user-data | **`false`** | LGPD: deleção completa de dados do usuário |
| 8 | efi-payment | default `true` | Pagamento via Efi/Gerencianet |
| 9 | generate-digital-card | `true` | Gera imagem da carteirinha via OpenRouter (Seedream) |
| 10 | mercadopago-payment | default `true` | Pagamento via Mercado Pago (card + PIX) |
| 11 | mercadopago-webhook | default `true` ⚠️ | Webhook do Mercado Pago — **PROVAVELMENTE QUEBRADO** |
| 12 | pagbank-payment-v2 | default `true` | Pagamento via PagBank — **VIOLAÇÃO PCI** |
| 13 | validate-cpf | default `true` | Valida CPF via API CpfHub com rate limiting |
| 14 | validate-document-v2 | default `true` | Valida documento via IA (Gemini 2.5 Flash) |
| 15 | verify-student-card | `false` | Verificação pública de carteirinha |

### Detalhes por Edge Function

#### 1. admin-update-email
- **Chamada por**: `AdminEditEmail.tsx:121`
- **Input**: `{ targetUserId, newEmail }`
- **Auth**: Bearer token + verificação de role admin via `user_roles`
- **Problema**: Referencia variável `supabase` antes de declará-la (linha 20). Seta `email_confirm: true` bypass de verificação de email.

#### 2. chat-support
- **Chamada por**: `ChatWidget.tsx:107`
- **Input**: `{ message, history?, context? }`
- **Resposta**: `{ reply, shouldEscalate, escalationTags?, source: 'faq'|'llm' }`
- **Problema**: Service_role client criado em escopo global; escalation inserts bypassam RLS.

#### 3. cleanup-rejected-documents
- **Chamada por**: pg_cron job (diário, 3h AM)
- **Input**: Nenhum
- **Problema**: Variável `supabase` referenciada antes da declaração.

#### 4. compare-faces
- **Chamada por**: DB trigger `on_document_approved_compare_faces`
- **Input**: `{ student_id }`
- **Resposta**: `{ success, passed, details: { rg_match, foto_match } }`
- **Sem auth check explícito**: Depende de verify_jwt default + trigger com service_role key.

#### 5. create-payment
- **Chamada por**: `Checkout.tsx:496`, `Pagamento.tsx:416`, `CheckoutFisica.tsx:334`
- **Input**: `{ plan_id, payment_method, card_data?, metadata?, amount? }`
- **Resposta**: `{ success, payment_id, mock: true, ...pix_data }`
- **CRÍTICO**: Upsell payments marcados `approved` imediatamente com `amount || 15` vindo do client. Attacker pode enviar `amount: 0`.

#### 6. delete-unconfirmed-user
- **Chamada por**: `VerificarEmail.tsx:51`
- **Input**: `{ email }`
- **Problema**: Usa `listUsers()` para buscar ALL users — performance/DoS com muitos usuários.

#### 7. delete-user-data
- **Chamada por**: `Perfil.tsx:567`
- **Input**: Nenhum (usa ID do usuário autenticado)
- **Problema**: `verify_jwt = false` — auth manual no código. Service_role client criado antes do auth check.

#### 8. efi-payment
- **Chamada por**: `Pagamento.tsx:523`, `CheckoutFisica.tsx:414`
- **Input**: `{ amount, installments?, card: { payment_token, holder_name? }, metadata? }`
- **Problema**: Amount do client não validado; birth hardcoded "1990-01-01".

#### 9. generate-digital-card
- **Chamada por**: `Dashboard.tsx:314`
- **Input**: `{ userId, cardType? }`
- **Problema**: `userId` vem do body, não do token. Qualquer user autenticado pode gerar card de outro. Prompt enviado para OpenRouter contém CPF e dados pessoais.

#### 10. mercadopago-payment
- **Chamada por**: `useMercadoPago.ts:172,285`
- **Input**: `{ payment_method, amount, plan_id, installments?, card_token?, payer_email?, payer_doc_number?, ... }`
- **Resposta**: `{ success, payment_id, status, mp_status, pix_qr_code?, pix_qr_code_base64? }`
- **Problema**: Amount do client sem validação server-side.

#### 11. mercadopago-webhook
- **Chamada por**: Servidores do Mercado Pago
- **Auth**: HMAC-SHA256 com `MP_WEBHOOK_SECRET`
- **Resposta**: `"ok"` com status 200
- **CRÍTICO**: verify_jwt default true → webhooks do MP não enviam JWT → chamadas rejeitadas.

#### 12. pagbank-payment-v2
- **Chamada por**: `Checkout.tsx:575`, `Pagamento.tsx:550`, `CheckoutFisica.tsx:429`
- **Input**: `{ amount, installments?, card: { number, exp_month, exp_year, security_code, holder_name }, metadata? }`
- **CRÍTICO**: PAN, CVV, expiry enviados raw ao servidor. Violação PCI-DSS.

#### 13. validate-cpf
- **Chamada por**: `SignUp.tsx:470`
- **Input**: `{ cpf }`
- **Resposta**: `{ valid, nome, dataNascimento, genero?, fromCache }`
- **Rate limiting**: 10 tentativas/hora por IP. Cache em `cpf_validations`.

#### 14. validate-document-v2
- **Chamada por**: DB trigger `documents_validation_trigger`
- **Input**: `{ record: { id, type, file_url, student_id } }`
- **Resposta**: `{ success, validation: { valid, confidence, recommendation, reason, issues } }`

#### 15. verify-student-card
- **Chamada por**: `VerificarCarteirinha.tsx:120` (fetch direto, não supabase.functions.invoke)
- **Input**: `{ usage_code, birth_date }`
- **Resposta**: `{ success, student: { full_name, institution, course, photo_url, cpf_last5, card_number, valid_until, is_physical, status } }`
- **Problema**: Sem rate limiting; birth_date é segundo fator fraco.

---

## 8. Banco de Dados

### 8.1 Tabelas Principais

| Tabela | Fonte |
|--------|-------|
| `student_profiles` | types.ts:430 |
| `documents` | types.ts:78 |
| `payments` | types.ts:161 |
| `plans` | types.ts:262 |
| `student_cards` | types.ts:335 |
| `support_tickets` | types.ts:579 |
| `support_messages` | types.ts:534 |
| `activity_log` | types.ts:17 |
| `user_roles` | types.ts:679 |
| `webhook_logs` | types.ts:703 |
| `system_settings` | types.ts:649 |
| `rejection_reasons` | types.ts:301 |
| `audit_logs` | migration 20260110120000 |
| `face_validations` | compare-faces/index.ts |
| `support_escalations` | migration 20260110150000 |
| `card_generation_logs` | migration 20260116123000 |
| `cpf_validations` | validate-cpf/index.ts |
| `cpf_rate_limits` | validate-cpf/index.ts |
| `chat_faq` | chat-support/index.ts |
| `notifications` | migration 20260430 |
| `physical_card_prints` | migration 20260430 |
| `admin_users` | migration 20260430 |
| `auditoria_cie` | delete-user-data/index.ts |
| `payment_gateway_config` | Pagamento.tsx:236 |

### 8.2 Views

| View | Descrição |
|------|-----------|
| `admin_dashboard` | Stats agregados |
| `admin_tickets_summary` | Tickets com info do estudante |
| `pending_documents_queue` | Docs pendentes com info do estudante |
| `physical_cards_to_print` | Cards que precisam de impressão física |
| `student_full_status` | Status completo do estudante |

### 8.3 RLS

| Tabela | RLS |
|--------|-----|
| `audit_logs` | ✅ Habilitado |
| `support_escalations` | ✅ Habilitado (users insert/select own) |
| `card_generation_logs` | ✅ Habilitado (admin/manager select) |
| `support_messages` | ✅ Habilitado (student own + admin all) |
| `notifications` | ✅ Habilitado (user own + admin all) |
| `physical_card_prints` | ✅ Habilitado (admin only) |
| **`auth.users`** | ❌ **DESABILITADO** (migration 20260115161314) |
| Demais tabelas (student_profiles, documents, payments, plans, student_cards, etc.) | **NÃO VERIFICÁVEL** — migrations disponíveis não cobrem criação destas tabelas |

### 8.4 Triggers

| Trigger | Tabela | Evento | Função |
|---------|--------|--------|--------|
| `documents_validation_trigger` | documents | AFTER INSERT/UPDATE OF status | `trigger_validate_document()` |
| `on_document_approved_compare_faces` | documents | AFTER UPDATE OF status | `trigger_compare_faces()` |
| `documents_profile_photo_trigger` | documents | AFTER INSERT/UPDATE OF status | `update_profile_photo_on_foto_approved()` |

### 8.5 Functions do Banco

| Função | Tipo |
|--------|------|
| `calculate_card_validity(issue_date)` | Retorna data de validade |
| `check_cpf_exists(p_cpf)` | Retorna boolean |
| `check_phone_exists(p_phone)` | Retorna boolean |
| `generate_card_number()` | Retorna string |
| `generate_usage_code()` | Retorna string |
| `has_any_role(_roles, _user_id)` | Retorna boolean |
| `has_role(_role, _user_id)` | Retorna boolean |
| `is_admin()` | SECURITY DEFINER — verifica admin_users |
| `trigger_validate_document()` | SECURITY DEFINER — chama validate-document-v2 |
| `trigger_compare_faces()` | SECURITY DEFINER — chama compare-faces |
| `update_profile_photo_on_foto_approved()` | SECURITY DEFINER |
| `auto_generate_card_data()` | Gera card_number e usage_code |
| `activate_student_card_on_docs_approved()` | SECURITY DEFINER |
| `advance_to_review(p_student_id)` | Verifica docs/face/terms e avança step |
| `mark_payment_as_anonymized(payment_student_id)` | LGPD |
| `switch_active_gateway(gateway_name)` | Admin: troca gateway ativo |

### 8.6 Indexes

| Index | Tabela(coluna) |
|-------|---------------|
| `idx_student_profiles_cpf` | student_profiles(cpf) |
| `idx_documents_status` | documents(status) |
| `idx_documents_student_id` | documents(student_id) |
| `idx_documents_type` | documents(type) |
| UNIQUE `unique_cpf` | student_profiles(cpf) |

### 8.7 Extensions

- `pg_net` — Requisições HTTP do banco (para chamar edge functions de triggers)
- `pg_cron` — Jobs agendados

### 8.8 Cron Jobs

- `cleanup-rejected-docs-daily`: 3h AM diário → chama cleanup-rejected-documents

### 8.9 Enums

| Enum | Valores |
|------|---------|
| `card_status` | pending_docs, pending_payment, processing, active, expired, cancelled |
| `card_type` | geral_digital, geral_fisica, direito_digital, direito_fisica |
| `document_status` | pending, approved, rejected |
| `document_type` | rg, endereco, matricula, foto, selfie |
| `payment_method` | pix, credit_card, debit_card |
| `payment_status` | pending, processing, approved, rejected, refunded |
| `shipping_status` | pending, processing, shipped, delivered, failed |
| `ticket_status` | open, in_progress, waiting_user, resolved, closed |
| `user_role` | user, admin, manager |

---

## 9. Integrações Externas

### 9.1 Mercado Pago

- **SDK**: JS v2 carregada via CDN (`sdk.mercadopago.com/js/v2`) — `useMercadoPago.ts:28-41`
- **API**: REST API do Mercado Pago via edge function `mercadopago-payment`
- **Chave**: `VITE_MP_PUBLIC_KEY` (env var); fallback placeholder `TEST-xxxxxxxx-...`
- **Ambiente**: Determinado pela chave (TEST- prefix = sandbox)
- **Webhook**: `mercadopago-webhook` com HMAC-SHA256 — **provavelmente não funcional** (verify_jwt default true)

### 9.2 PagBank

- **SDK client**: `usePagBankEncrypt.ts` carrega SDK de `assets.pagseguro.com.br` — **NÃO UTILIZADO**
- **API**: REST API via edge function `pagbank-payment-v2`
- **Chave**: `VITE_PAGBANK_PUBLIC_KEY` (env var, não utilizada)
- **Ambiente**: Baseado em `PAGBANK_ENV` (env var do Supabase)
- **Status real**: Funcional para cartão, mas com **violação PCI-DSS** (dados raw do cartão)

### 9.3 Efi (Gerencianet)

- **SDK**: JS carregada via CDN em Pagamento.tsx:69-93
- **API**: REST API via edge function `efi-payment` com OAuth2
- **Config**: `VITE_EFI_ACCOUNT_ID` e `VITE_EFI_ENV` (default "sandbox")
- **Status real**: Funcional para cartão; birth date hardcoded "1990-01-01"

### 9.4 OpenRouter / Gemini

- **Modelo para docs**: Gemini 2.5 Flash via OpenRouter (`validate-document-v2`)
- **Modelo para chat**: GPT-4o-mini via OpenRouter (`chat-support`)
- **Modelo para card**: Seedream via OpenRouter (`generate-digital-card`)
- **Chaves**: `OPENROUTER_API_KEY`, `OPENROUTER_CHAT_KEY` (env vars Supabase)

### 9.5 AWS Rekognition

- **Serviço**: `CompareFaces` (`compare-faces/index.ts`)
- **Credenciais**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` (env vars Supabase)
- **Uso**: Comparação facial selfie vs RG e selfie vs foto 3x4

### 9.6 CpfHub

- **API**: Validação de CPF (`validate-cpf/index.ts`)
- **Chave**: `CPFHUB_API_KEY` (env var Supabase)
- **Rate limiting**: 10 req/hora por IP, com cache em `cpf_validations`

### 9.7 Vercel

- **Deploy config**: `vercel.json` — SPA rewrite apenas
- **Nenhuma configuração** de headers, env vars ou build settings no vercel.json

### 9.8 Domínio

- Produção: `urebrasil.com.br` (hardcoded em RecuperarSenha.tsx:27 e Carteirinha.tsx:154)
- Admin: Subdomínio `console.*` detectado em App.tsx:78-83

### 9.9 Outros

- **ViaCep**: Busca de endereço por CEP (`useViaCep.tsx`)
- **ipify.org**: Obtenção de IP para registro de aceite de termos
- **Microsoft Clarity**: Tracking com ID `x83cfgvf97` (index.html:13-24)
- **Google Ads**: Conversão com ID `AW-18167800155` (index.html:5-12)

---

## 10. Estado de Qualidade

### 10.1 Código Morto / Não Utilizado

| Item | Arquivo | Descrição |
|------|---------|-----------|
| `usePagBankEncrypt.ts` | `src/hooks/usePagBankEncrypt.ts` | Hook completo de criptografia PagBank — **não importado em nenhum lugar** |
| `StudentCardConfirmationModal.tsx` | `src/components/StudentCardConfirmationModal.tsx` | Modal de confirmação de carteirinha — **não usado no fluxo atual** |
| Import morto `usePagBankEncrypt` | `src/admin/pages/Payments.tsx:8` | Import existe mas não é usado |
| Checkbox `rememberMe` | `src/pages/Login.tsx:16` | Estado existe mas nunca é passado para auth |
| Enum value `endereco` | `document_type` enum | Tipo de documento "endereco" definido no enum mas não usado no fluxo de upload |

### 10.2 TODO / FIXME / HACK

**Zero instâncias** encontradas em `src/`. Codebase limpo de marcadores de tarefa.

### 10.3 console.log em Produção

**12 chamadas console.log** em 3 arquivos:
- `SendNotificationForm.tsx:182,191` — Debug de envio de notificação (2)
- `RecipientCounter.tsx:26,31,36,103,105` — Debug pesado (5)
- `PaymentSuccessPage.tsx:125,129,137,141,153` — Debug de conversão Google Ads (5)

**~70 chamadas console.error/warn** — Legitimamente para logging de erros, mas sem serviço centralizado de error reporting.

### 10.4 TypeScript: `: any`

**43 ocorrências** em 16 arquivos:
- `useMercadoPago.ts`: 9 — SDK do MP sem tipos
- `Pagamento.tsx`: 6 — Handling de formulário de pagamento
- `CheckoutFisica.tsx`: 5
- `Checkout.tsx`: 4
- `Logs.tsx`: 3 — Linhas de log tipadas como `any`
- `Dashboard.tsx` (admin): 3
- `Header.tsx`: 2 — `notifications` como `any[]`, supabase cast to `any`
- Outros: 11

### 10.5 Error Boundaries

**NENHUM Error Boundary** encontrado no projeto. Qualquer erro de renderização React não tratado resultará em tela branca para o usuário.

### 10.6 Loading States

- **Presentes**: A maioria das páginas tem loading states com spinners (skeleton/spinner patterns vistos em praticamente todas as páginas)
- **Ausentes**: Não há fallback de `Suspense` no nível do App para lazy-loaded routes (lazy loading usado mas sem Suspense boundary visível no App.tsx)

### 10.7 Imports Não Resolvidos

- `src/admin/pages/Payments.tsx:8` — import de `usePagBankEncrypt` não utilizado

### 10.8 Performance

- `Header.tsx`: Waterfall de 4+ chamadas Supabase em cada page load para usuários autenticados (notifications, profile, physical card, plan prices)
- `UploadDocumentos.tsx`: Polling a cada 5s para status de documentos (pode ser substituído por realtime subscription)
- `PagamentoPix.tsx`: Polling a cada 5s para status de pagamento

---

## 11. Segurança

### 11.1 verify_jwt por Edge Function

| Função | verify_jwt | Risco |
|--------|-----------|-------|
| admin-update-email | ✅ true | OK |
| chat-support | default true | OK |
| cleanup-rejected-documents | default true | OK |
| compare-faces | default true | OK (chamado por trigger) |
| create-payment | ✅ true | OK |
| delete-unconfirmed-user | default true | OK |
| **delete-user-data** | ❌ **false** | ⚠️ Auth manual no código |
| efi-payment | default true | OK |
| generate-digital-card | ✅ true | OK |
| mercadopago-payment | default true | OK |
| **mercadopago-webhook** | default true ⚠️ | ❌ **QUEBRADO** — webhooks não enviam JWT |
| pagbank-payment-v2 | default true | OK |
| validate-cpf | default true | OK |
| validate-document-v2 | default true | OK (chamado por trigger) |
| verify-student-card | ❌ false | OK (intencionalmente público) |

### 11.2 RLS Status

- `auth.users`: **RLS DESABILITADO** (migration 20260115161314)
- Tabelas core (`student_profiles`, `documents`, `payments`, `student_cards`, `plans`): **NÃO VERIFICÁVEL** pelas migrations disponíveis (provavelmente configurado no dashboard do Supabase)
- Tabelas auxiliares: RLS habilitado com políticas adequadas

### 11.3 Exposição de Chaves/Secrets

- ✅ Nenhuma API key, secret ou token hardcoded em `src/`
- ✅ Todas as chaves sensíveis usam env vars
- ℹ️ Google Ads ID e Clarity ID hardcoded em `index.html` (aceitável — são IDs públicos de tracking)
- ⚠️ `VITE_MP_PUBLIC_KEY` tem fallback placeholder `TEST-xxxxxxxx-...` — falha silenciosamente se env var ausente

### 11.4 CORS Config

- **`Access-Control-Allow-Origin: '*'`** em `supabase/functions/_shared/cors.ts:2`
- Wildcard CORS em TODAS as edge functions
- Aceitável para endpoints públicos (verify-student-card) mas excessivamente permissivo para funções de pagamento e admin

### 11.5 Rate Limiting

- ✅ `validate-cpf`: 10 tentativas/hora por IP
- ❌ `verify-student-card`: Sem rate limiting — brute force possível em usage_code + birth_date
- ❌ `delete-unconfirmed-user`: Sem rate limiting — `listUsers()` busca TODOS os usuários
- ❌ Demais edge functions: Sem rate limiting visível

### 11.6 Sanitização de Inputs

- ✅ CPF: Validação algorítmica + API
- ✅ Email: Regex + verificação de domínio descartável
- ✅ Senha: Força mínima no signup (mas inconsistente no reset)
- ⚠️ Dados de formulário (nome, instituição, curso): Sem sanitização — salvos raw no banco
- ❌ **Payment amounts**: Vêm do client sem validação server-side contra preço do plano

### 11.7 Problemas Adicionais

- **PCI-DSS**: `pagbank-payment-v2` recebe PAN, CVV, expiry em texto plano
- **IDOR**: `generate-digital-card` aceita `userId` do body — qualquer user pode gerar card de outro
- **Variável não declarada**: Múltiplas edge functions referenciam `supabase` antes da declaração (admin-update-email:20, cleanup-rejected-documents:49, create-payment:24, pagbank-payment-v2:95, generate-digital-card:37)
- **Project ID mismatch**: Migrations antigas (20260110*) usam project ID `nwszukpenvkctthbsocw`, config.toml tem `zyfbxzjfpncxfawthsht`. Corrigido em migration posterior.
- **Admin sem proteção no router**: Rotas admin acessíveis por URL direta; proteção é client-side only via useAdminAuth

---

## 12. O que Pode Ser Melhorado

### P0 — Crítico / Segurança

| # | Item | Arquivo | Descrição |
|---|------|---------|-----------|
| 1 | **Violação PCI-DSS** | `pagbank-payment-v2/index.ts:157-166` | Dados raw de cartão (PAN, CVV, expiry) enviados ao servidor. Deve usar tokenização client-side via `usePagBankEncrypt.ts` (que já existe mas não é usado) |
| 2 | **Payment amounts do client** | `create-payment:83`, `efi-payment:108`, `mercadopago-payment:103`, `pagbank-payment-v2:180` | Valores de pagamento vêm do frontend sem validação server-side contra preço do plano no banco. Attacker pode enviar amount=0 |
| 3 | **Webhook MP quebrado** | `mercadopago-webhook/index.ts` | verify_jwt default true impede webhooks do MP de funcionar. Adicionar `verify_jwt = false` no config.toml |
| 4 | **IDOR em generate-digital-card** | `generate-digital-card/index.ts:75` | `userId` aceito do body permite gerar carteirinha de qualquer usuário. Deve usar ID do token |
| 5 | **auth.users RLS desabilitado** | `20260115161314_disable_rls_auth_users.sql` | RLS desabilitado na tabela auth.users |
| 6 | **Admin routes sem proteção no router** | `App.tsx:204-212` | Rotas admin não têm ProtectedRoute; proteção é client-side only |
| 7 | **delete-user-data verify_jwt=false** | `config.toml:10` | JWT desabilitado no gateway para endpoint de deleção de dados. Auth manual no código, mas viola defesa em profundidade |

### P1 — Importante / Funcionalidade Quebrada

| # | Item | Arquivo | Descrição |
|---|------|---------|-----------|
| 8 | **Variável `supabase` não declarada** | Múltiplas edge functions | 5 edge functions referenciam `supabase` antes da declaração — pode causar runtime errors |
| 9 | **Inconsistência de senha** | `RedefinirSenha.tsx:56` vs `SignUp.tsx` | Reset aceita 6 chars; signup exige 8+ com complexidade |
| 10 | **URL de produção hardcoded** | `RecuperarSenha.tsx:27` | `https://urebrasil.com.br/redefinir-senha` não funciona em dev/staging |
| 11 | **Efi birth hardcoded** | `efi-payment/index.ts:167` | Data de nascimento hardcoded "1990-01-01" para todos os clientes |
| 12 | **delete-unconfirmed-user listUsers()** | `delete-unconfirmed-user/index.ts:61` | Busca TODOS os usuários para encontrar um — DoS risk com muitos users |
| 13 | **Sem Error Boundary** | Todo o projeto | Erro de renderização React = tela branca sem feedback |
| 14 | **Dados pessoais no prompt de IA** | `generate-digital-card/index.ts:217` | CPF e nome completo enviados para OpenRouter no prompt do Seedream |

### P2 — Melhoria / Qualidade

| # | Item | Arquivo | Descrição |
|---|------|---------|-----------|
| 15 | **43 usos de `: any`** | 16 arquivos | Perda de type safety, especialmente em fluxos de pagamento |
| 16 | **Hook morto** | `usePagBankEncrypt.ts` | Código completo não utilizado |
| 17 | **Componente morto** | `StudentCardConfirmationModal.tsx` | Não utilizado no fluxo atual |
| 18 | **Import morto** | `admin/pages/Payments.tsx:8` | Import de usePagBankEncrypt não usado |
| 19 | **12 console.log em produção** | 3 arquivos | Debug logs expostos ao usuário |
| 20 | **Wildcard CORS** | `_shared/cors.ts:2` | `Access-Control-Allow-Origin: *` em todas as funções |
| 21 | **Header waterfall** | `Header.tsx` | 4+ queries Supabase em cascata em cada page load |
| 22 | **Polling vs Realtime** | `UploadDocumentos.tsx`, `PagamentoPix.tsx` | Polling a cada 5s poderia ser Supabase Realtime |
| 23 | **Sem rate limiting** | `verify-student-card`, `delete-unconfirmed-user` | Endpoints sem proteção contra brute force |
| 24 | **rememberMe não funcional** | `Login.tsx:16` | Estado declarado mas nunca usado |
| 25 | **Sem error reporting centralizado** | Todo o projeto | ~70 console.error sem Sentry/equivalente |
| 26 | **Sem Suspense boundary** | `App.tsx` | Lazy-loaded routes sem fallback de Suspense |
| 27 | **`complete-profile` público** | `App.tsx:106` | Rota sem ProtectedRoute (tem guard interno mas inconsistente com o padrão) |
| 28 | **Luhn validation ausente** | `payment-helpers.ts:33-58` | validateCardForm verifica length mas não faz Luhn check no número do cartão |
| 29 | **Fallback MP key** | `useMercadoPago.ts:90` | Placeholder `TEST-xxxxxxxx-...` como fallback — falha silenciosa |
| 30 | **`supabase as any` no admin** | `useAdminAuth.ts`, `AdminLogin.tsx`, `Logs.tsx`, etc. | Cast para contornar tipos não gerados — reduz type safety |

---

*Relatório gerado automaticamente em 2026-06-25. Nenhum arquivo foi alterado durante esta auditoria.*
