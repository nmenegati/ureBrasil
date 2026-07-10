Always work directly on main branch. Never create feature branches.

# Auditoria Tecnica Real do Sistema URE Brasil

Data da auditoria: 2026-06-30

## Escopo e metodo

- Modo de trabalho: leitura factual do repositorio e consolidacao do relatorio apenas neste arquivo.
- Fontes auditadas: frontend React/Vite, integracao Supabase, Edge Functions, migrations SQL, docs auxiliares, admin e fluxo de suporte.
- Regra aplicada: todo item abaixo referencia arquivo e linha(s) localizadas durante a leitura. Quando algo nao foi localizado, isso esta dito explicitamente como "nao localizado".
- Objetivo: descrever o fluxo real do sistema, o que esta implementado, o que depende de trigger/RPC/webhook e onde existem drift, lacunas ou risco operacional.

## Resumo executivo

- O fluxo principal esta centrado em `student_profiles.current_onboarding_step`, em `goToStudentCardFlow()` e no polling/consulta da tabela `payments`.
- O callback PKCE real esta na landing `/`, nao em `/complete-profile`, e o client Supabase esta de fato com `flowType: 'pkce'`.
- O caminho de geracao digital atualmente ativo no runtime e frontend (`html2canvas` + upload em bucket), enquanto a Edge Function `generate-digital-card` existe como caminho alternativo/paralelo.
- O Mercado Pago pode retornar `success: true` com `status: rejected`, e ainda ha pontos do frontend que tratam apenas `success`.
- O upload de RG esta desalinhado entre UX declarada e runtime/backend: a UI principal foi endurecida em parte, mas ainda existem caminhos que aceitam PDF para RG no frontend e na validacao backend.
- A trilha SQL versionada mostra triggers e endurecimento de seguranca relevantes, mas nao foi localizada a definicao SQL de `advance_to_review` nem a criacao versionada dos buckets usados em runtime.

## Mudancas da sessao 2026-07-10

Registro datado das alteracoes feitas nesta sessao. Cada item aponta arquivo/linha atual quando aplicavel.

### 1. Meta Pixel — evento Purchase (commit 9690840, 2026-07-08)

- Adicionado `fbq('track', 'Purchase', {...})` em dois pontos, apos aprovacao do pagamento:
  - Cartao: `src/pages/Pagamento.tsx:619-627` (guard `typeof window.fbq === 'function'`), antes do `navigate('/pagamento/sucesso')` em `:629`.
  - PIX: `src/pages/PagamentoPix.tsx:86-94` (guard `typeof window.fbq === 'function' && returnTo === '/pagamento/sucesso'`), dentro do callback de polling, antes do `window.location.href` em `:98`.
- Payload usa `value: paymentAmount` (nao `plan.price`) e `content_ids: [paymentId]` (const local; no cartao vem de `data.payment_id || data.orderId || data.id` em `Pagamento.tsx:615-616`, pode ser `undefined`).
- Declaracao de tipo `fbq?: (...args: unknown[]) => void` adicionada ao `declare global` em `src/pages/Pagamento.tsx:66`.
- Guard PIX so dispara no funil digital: `returnTo` vem de `location.state` (`PagamentoPix.tsx:25`) e vale `/pagamento/sucesso` para plano digital (`Pagamento.tsx:452`); para compra fisica vale `/upload-documentos`, entao Purchase corretamente NAO dispara.
- Snippet do pixel em `index.html:26-37` (`<head>`, ID `982937931195255`), noscript em `:95` (`<body>`). Nao ha CSP no `index.html`.
- LIMITACAO CONHECIDA (faixa vermelha): o `fbq` client-side do PIX so executa se o comprador continua na aba do checkout quando o polling de 5s detecta `approved`. Como no PIX o usuario paga no app do banco e frequentemente nao volta (e navegadores mobile congelam `setInterval` em aba de fundo), o evento nao roda — mesmo com o pagamento confirmado pelo webhook. A race com `window.location.href` e BAIXA (ha `setTimeout(..., 2000)` antes do redirect); a causa real e arquitetural, nao timing. Ver `docs/verificacao-fbq-nao-dispara-2026-07-10.md`.

### 2. Upload de documentos — remocao de PDF (commit df0b878, 2026-07-10)

- `src/pages/UploadDocumentos.tsx`: removido `'application/pdf'` de `acceptedTypes` da matricula (`:97`); agora todos os campos aceitam apenas `image/jpeg`/`image/png`.
- Corrigido bug em que o segundo lado do RG (`handleAddRgSecondSide`, `:940`) aceitava PDF — agora so imagem, consistente com os demais campos.
- Condicao de validacao rg/matricula simplificada para `if (!isImage)` com mensagem clara: "Envie uma foto ou captura de tela do documento (JPG ou PNG). PDF nao e aceito."
- Removidas variaveis mortas: `isPDF`, `fileIsPDF`, `fileIsImage`. Helper text (`:446`) passa a exibir so "JPEG, PNG" automaticamente (deriva de `acceptedTypes`).
- Nenhuma UI renderiza PDF inline (Perfil/Upload/Admin so exibem `<img>` para `mime_type` de imagem), entao PDFs ja enviados nao sao afetados na visualizacao/download.
- PENDENTE (faixa vermelha ainda aberta): o backend `supabase/functions/validate-document-v2/index.ts:97` continua aceitando PDF para rg/matricula, e nao ha `allowed_mime_types` no bucket `documents` — upload de PDF via API direta ainda passa. Gate de backend nao foi feito nesta sessao.
- Contexto do drift original de motivo de rejeicao de PDF em `docs/verificacao-rejeicao-documentos-2026-07-10.md` e da remocao em `docs/verificacao-remover-pdf-upload-2026-07-10.md`.

### 3. Trigger `on_payment_approved()` — fix de cast UUID + versionamento (2026-07-10)

- Bug corrigido: `v_original_payment_id` (TEXT, de `metadata->>'original_payment_id'`) era comparado com `student_cards.payment_id` (UUID) sem `::uuid`, causando `operator does not exist: uuid = text` e abortando a transacao — o upsell fisico nunca saia de `pending`.
- A funcao `on_payment_approved()` NAO era versionada (existia so no banco de producao). Agora versionada em `supabase/migrations/20260710_versionar_on_payment_approved.sql`, com o cast `::uuid` no CASO 1 (upsell fisico) e CASO 2 (fisica avulsa). O CASO 3 (pagamento principal digital) nao era afetado.
- A migration tambem versiona o trigger `trigger_on_payment_approved` (`AFTER UPDATE ON payments`, `WHEN NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved'`), com `DROP TRIGGER IF EXISTS` idempotente.
- Analise completa em `docs/verificacao-fix-trigger-on-payment-approved-2026-07-10.md`.

### 4. Triggers em `payments` (coexistencia — documentar naming confuso)

Existem funcoes/triggers distintas reagindo ao approve de `payments`:

- Trigger `on_payment_approved` (nome do trigger) → chama a funcao **`create_student_card_on_payment()`** (versionada desde o inicio em `supabase/migrations/20260102205259_*.sql:16` e `20251228151731_*.sql:2`). Faz INSERT da carteira no pagamento principal e UPDATE `is_physical` no upsell; ja usa `(NEW.metadata->>'original_payment_id')::UUID` com cast correto e `ON CONFLICT (payment_id) DO NOTHING`.
- Trigger `trigger_on_payment_approved` → chama a funcao **`on_payment_approved()`** (versionada agora). Gerencia `current_onboarding_step` e atualiza `is_physical` para upsell/fisica avulsa.
- Trigger `update_payments_updated_at` (`BEFORE UPDATE`) → `update_updated_at_column()`.
- ATENCAO ao naming: o trigger chamado `on_payment_approved` NAO chama a funcao `on_payment_approved()` — ele chama `create_student_card_on_payment()`. Sao coisas diferentes de mesmo nome-base. Para upsell as duas funcoes atualizam `is_physical = true` (redundante, mas sem duplicar carteira gracas ao guard `is_upsell`/`ON CONFLICT`). O binding real deve ser confirmado no banco com `SELECT ... FROM pg_trigger` antes de mexer.

### Pendencias abertas apos esta sessao

- Meta Conversions API server-side (a partir de `mercadopago-webhook`) para capturar Purchase de PIX quando o browser nao esta aberto — o pixel client-side nao cobre esse caso.
- Google Ads: a conversao de PIX tem o MESMO problema do `fbq` (gtag client-side em `PaymentSuccessPage.tsx` depende do usuario chegar na pagina de sucesso) — precisa de Enhanced Conversions/CAPI server-side.
- Gate de backend para PDF em `supabase/functions/validate-document-v2/index.ts:97` e, opcionalmente, `allowed_mime_types` no bucket `documents`.

## Fluxo real do frontend

### 1. Entrada publica, auth e PKCE

- O client Supabase esta configurado com PKCE em `src/integrations/supabase/client.ts:11-17`, com `detectSessionInUrl` em `:15`, `flowType: 'pkce'` em `:16` e `storage: localStorage` em `:17`.
- O `signUp()` envia `emailRedirectTo: ${window.location.origin}/complete-profile` em `src/hooks/useAuth.tsx:95-101`, mas o callback real continua precisando ser tratado na raiz.
- O cadastro em `src/pages/SignUp.tsx` faz RPC `check_cpf_exists` em `:263`, RPC `check_phone_exists` em `:357`, Edge Function `validate-cpf` em `:470`, chama `signUp()` em `:644`, grava `pending_email` em `:667` e redireciona para `/verificar-email` em `:670`.
- A pagina `src/pages/VerificarEmail.tsx` le `pending_email` em `:15`, reenviando email com `supabase.auth.resend()` em `:27`, e pode apagar usuario nao confirmado via Edge Function `delete-unconfirmed-user` em `:51`, limpando `pending_email` em `:61`.
- A landing `src/pages/Index.tsx` detecta `?code=` em `:72`, abre uma janela de graca com `pkceGraceExpired` em `:73`, chama `goToStudentCardFlow(navigate)` em `:157` quando o usuario aparece e, se a graca expira sem usuario, navega para `/login` em `:164`.
- A CTA principal da hero usa scroll para `#planos` em `src/pages/Index.tsx:198`, e os demais CTAs seguem a mesma logica de `scrollIntoView()` em `:382`.
- O rodape publico exposto na landing contem Instagram em `src/pages/Index.tsx:1193`, Facebook em `:1202`, WhatsApp em `:1213` e `mailto:contato@ure.com.br` em `:1292`.
- O login em `src/pages/Login.tsx` manda nao confirmados de volta para `/verificar-email` a partir de `:55`, e quando nao ha pagamento aprovado redireciona Direito para `/escolher-plano` em `:109` ou nao-Direito para `/pagamento` com `selected_plan_id` em `:112-113`. NOTA (2026-07-07): esse branch de `Login.tsx` NAO foi alterado e continua sendo um fallback — para novos cadastros o caminho principal deixou de passar por `/escolher-plano` (ver secao 3), mas usuarios legados sem pagamento que voltam por aqui ainda caem em `/escolher-plano`, que segue funcional; `Pagamento.tsx` tambem passou a auto-resolver o plano quando `plan_id` e null (ver secao 4).

### 2. Autoridade de navegacao e onboarding

- A autoridade central de decisao apos login/callback esta em `src/lib/cardNavigation.ts`, que consulta `student_profiles` em `:14`, bloqueia revisao manual em `:23`, considera pagamento aprovado por `const hasPayment = ... status === "approved"` em `:38`, e considera carteira pronta por `digital_card_url`/`status === "active"` em `:72-76`. Sem pagamento aprovado, ainda roteia Direito para `/escolher-plano` em `:47-48` e nao-Direito para `/pagamento`. NOTA (2026-07-07): esse branch NAO foi alterado — permanece como fallback para usuarios legados; o caminho principal de novos cadastros nao passa mais por `/escolher-plano` (ver secao 3).
- O guarda formal por etapa esta em `src/hooks/useOnboardingGuard.ts`, com `STEP_ROUTES` em `:6`, leitura de `current_onboarding_step` em `:51`, extracao do valor em `:62` e fallback para `STEP_ROUTES[step] || '/'` em `:70`.
- Observacao relevante: o mapa oficial de etapas esta no hook acima, mas `Checkout.tsx` ainda usa fallback para `/dashboard`, o que conflita com esse mapa real.

### 3. Conclusao de perfil e escolha de plano

- Em `src/pages/CompleteProfile.tsx`, a classificacao frontend de estudante de Direito e feita por combinacao de nivel de ensino + `courseType === 'direito'` em `:479`.
- A mesma tela salva `is_law_student` em `src/pages/CompleteProfile.tsx:503`.
- ✅ ATUALIZADO (2026-07-07): o branch por `is_law_student` no pos-submit de `CompleteProfile.tsx` foi UNIFICADO — Direito e nao-Direito seguem o MESMO caminho. Em `:520` monta `planType = isLawStudent ? 'direito_digital' : 'geral_digital'`, busca o plano por `type` via query dinamica (`.eq('type', planType).eq('is_active', true).single()`) em `:521`, faz auto-assign de `plan_id` + `current_onboarding_step: 'payment'` no perfil, e sempre redireciona com `window.location.href = '/pagamento'` em `:538`. NAO existe mais o passo `choose_plan` nem `navigate('/escolher-plano')` para novos cadastros de Direito. A const `PLAN_GERAL_DIGITAL_ID` (`:486`) permanece no arquivo mas nao e mais usada nesse bloco; o `localStorage.setItem('selected_plan_id', ...)` (codigo morto, nunca lido) foi removido.
- `src/pages/EscolherPlano.tsx` foi MANTIDA como fallback de seguranca (nao deletada), mas NAO e mais o caminho principal do fluxo de novos cadastros. Ela ainda le planos em `:116-119` (`geral_digital`, `direito_digital`, `fisica_upsell`) e grava `selected_plan_id` em `:186`; continua sendo alvo de `STEP_ROUTES['choose_plan']` (`src/hooks/useOnboardingGuard.ts:8`) para usuarios legados que ja tenham esse step gravado, e do fallback de erro de `Pagamento.tsx`/`Checkout.tsx`.
- Drift relevante: essa regra frontend de Direito (`CompleteProfile.tsx:479`) difere da trigger SQL `detect_law_student()`, que marca apenas por `course ILIKE '%direito%'`.

### 4. Pagamento principal, PIX, sucesso e upsell

- `src/pages/Pagamento.tsx` inicializa `activeGateway` localmente como `"pagbank"` em `:147`, mas busca o gateway ativo em `payment_gateway_config` em `:238`.
- ✅ ATUALIZADO (2026-07-07): o bloco `loadPlan` de `Pagamento.tsx` agora resolve o plano de forma resiliente. O select do perfil inclui `is_law_student` em `:185`. Se `plan_id` existe, o caminho e IDENTICO ao anterior (`planQuery.eq("id", profile.plan_id)`). Se `plan_id` e null, faz fallback buscando o plano por `type` derivado de `is_law_student` (`direito_digital`/`geral_digital`, `is_active = true`) em `:207`, e faz auto-assign silencioso do `plan_id` no perfil em `:218` com guard `!isStandalonePhysical` (para nao gravar plano digital em compra fisica avulsa). O fallback final em erro de plano continua sendo `navigate("/escolher-plano")` em `:214`; quando o perfil nao carrega, passou a mandar para `/login` em vez de `/escolher-plano`. Efeito: um estudante de Direito legado sem `plan_id` que chegue direto em `/pagamento` e cobrado corretamente (R$44) sem passar pela tela de escolha.
- No fluxo PIX Mercado Pago, `processPixPayment()` e chamado em `src/pages/Pagamento.tsx:405`; depois o fluxo define `nextStep` em `:444`, atualiza `current_onboarding_step` em `:455` e decide a rota em `:459`.
- No fluxo de cartao Mercado Pago, `processCardPayment()` e chamado em `src/pages/Pagamento.tsx:538`, com bloqueio de `status !== 'approved'` em `:545` (corrigido em 2026-07-01; antes bloqueava apenas `=== 'rejected'`), depois repetindo a atualizacao de `nextStep` em `:584-599`.
- O hook `src/hooks/useMercadoPago.ts` usa a Edge Function `mercadopago-payment` no cartao em `:172-174` e hoje rejeita apenas `!data.success` em `:189`.
- O mesmo hook usa `payment_method: 'pix'` em `src/hooks/useMercadoPago.ts:285-287` e faz a mesma validacao apenas por `!data.success` em `:298` e novamente em `:301`, sem bloqueio explicito de `status === 'rejected'`.
- A tela `src/pages/PagamentoPix.tsx` polla `payments.status` em `:65-70`, considera confirmado apenas quando `status === "approved"` em `:76`, salva `recent_payment_id` logo depois e retorna para `returnTo || "/upload-documentos"` no fluxo normal.
- A pagina `src/pages/PaymentSuccessPage.tsx` persiste `recent_payment_id` em `:86`, busca o plano `fisica_upsell` em `:102`, usa logs de conversao Google Ads entre `:125-153`, navega para `/checkout` em `:201` e limpa `recent_payment_id` em `:216`.
- A conversao Google Ads nessa pagina depende de `location.state`, conforme os bloqueios logados em `src/pages/PaymentSuccessPage.tsx:125-153`.

### 5. Checkout do upsell e compra avulsa da fisica

- `src/pages/Checkout.tsx` usa `CHECKOUT_RESOLVE_RETRY_KEY` em `:64`, inicia `activeGateway` como `"pagbank"` em `:131` e ainda navega para `/dashboard` em `:226`, `:265` e `:367`.
- No PIX Mercado Pago do upsell, `processPixPayment()` e chamado em `src/pages/Checkout.tsx:478`, com bloqueio de `status === 'rejected'` em `:490`.
- No cartao Mercado Pago do upsell, `processCardPayment()` e chamado em `src/pages/Checkout.tsx:558`, com bloqueio de `result.status !== 'approved'` em `:566` (corrigido em 2026-07-01; antes verificava apenas `!result.success`); depois o fluxo marca `is_physical: true` em `:611` e move o onboarding para `upload_documents` em `:631`.
- `src/pages/CheckoutFisica.tsx` inicia `activeGateway` como `"pagbank"` em `:94`, monta metadata com `is_physical_avulsa: true` em `:311` e `original_payment_id` em `:315`, bloqueia PIX por `!result.success` em `:330` e o pagamento de cartao por `!result.success || result.status !== 'approved'` em `:385` (corrigido em 2026-07-01; antes verificava apenas `!result.success`).
- A entrada da compra avulsa esta em `src/pages/AdquirirFisica.tsx`, que leva para `/checkout-fisica` em `:47`.

## Upload, validacao, face e carteirinha

### 6. Upload de documentos

- `src/pages/UploadDocumentos.tsx` declara `matricula` com `acceptedTypes` incluindo PDF em `:97`, e `rg` apenas com imagens em `:104`.
- Apesar disso, o runtime ainda aceita PDF para `rg` e `matricula` no bloco `if (type === 'rg' || type === 'matricula')` em `src/pages/UploadDocumentos.tsx:786`, e o toast de RG endurecido aparece em `:793`.
- O segundo lado do RG ainda aceita PDF em `src/pages/UploadDocumentos.tsx:940`.
- O upload principal monta `filePath = ${user.id}/${type}/${Date.now()}.${ext}` em `src/pages/UploadDocumentos.tsx:842`, e o verso do RG usa `${user.id}/rg-back/...` em `:969`.
- O aceite de termos grava `terms_accepted: true` em `src/pages/UploadDocumentos.tsx:1034`, chama a RPC `advance_to_review` em `:1064`, loga erro em `:1069` e navega para `/gerar-carteirinha` em `:1075`.
- Ha duplicacao do fluxo de aceite/avanco: alem do submit principal, a mesma tela repete `terms_accepted: true` em `src/pages/UploadDocumentos.tsx:1263`, reaproveita `advance_to_review` em `:1286` e `:1329`, e redireciona novamente em `:1291` e `:1334`.

### 7. Validacao automatica e comparacao facial

- `src/hooks/useFaceValidation.ts` consulta a tabela `face_validations` em `:40` e abre subscription `postgres_changes` em `:63`, mas escuta apenas `event: 'INSERT'` em `:65`.
- `src/components/CameraCapture.tsx` forca `facingMode: "user"` em `:22`, gera um `File` JPEG em `:48` e usa `screenshotFormat="image/jpeg"` em `:92`.
- A etapa de revisao final em `src/pages/GerarCarteirinha.tsx` conta documentos aprovados em `:104`, exige 4 docs em `:110`, atualiza `current_onboarding_step: 'completed'` em `:142` e navega para `/carteirinha` em `:149`.

### 8. Geracao da carteirinha digital e verificacao publica

- O fluxo ativo da carteirinha em `src/pages/Carteirinha.tsx` busca `student_cards` em `:98-99`, obtem `profile_photo_url` por `getPublicUrl()` em `:123`, gera QR com `QRCode.toDataURL()` em `:156`, renderiza a imagem com `html2canvas` em `:197-198`, e grava `digital_card_url`/`digital_card_generated` em `student_cards` em `:237-240`.
- O proprio componente evita regenerar se ja houver `digital_card_url` em `src/pages/Carteirinha.tsx:274`, e considera a existencia do digital em `:327`.
- O layout da frente e montado por `src/components/CardLayoutFront.tsx`, recebendo `validUntil` em `:13`, `photoUrl` em `:14`, `qrImageUrl` em `:15`, renderizando a foto em `:34-36`, o QR em `:49-51` e a validade em `:95`.
- A verificacao publica chama a Edge Function `verify-student-card` em `src/pages/VerificarCarteirinha.tsx:120`, enviando `usage_code` em `:129`, `birth_date` em `:130` e marcando `meta robots = noindex,nofollow` em `:77`.

## Edge Functions, webhooks e backend real

### 9. Auth, CPF e exclusao de nao confirmados

- `supabase/functions/validate-cpf/index.ts` usa `cpf_rate_limits` em `:91`, limita a 10 tentativas por hora em `:99`, usa cache em `cpf_validations` em `:145-156`, chama CPFHub em `:175` e regrava o cache em `:189`.
- `supabase/functions/delete-unconfirmed-user/index.ts` exige `Authorization` em `:37`, valida o usuario chamador via `supabase.auth.getUser(token)` em `:45`, compara email do caller em `:54` e remove o usuario com `auth.admin.deleteUser()` em `:88`.

### 10. Mercado Pago

- `supabase/functions/mercadopago-payment/index.ts` escolhe ambiente por `MP_MODE` em `:94`, usa `MP_PROD_ACCESS_TOKEN` em `:96` ou `MP_ACCESS_TOKEN` em `:97`, converte status do gateway por `statusMap` em `:149-161` e retorna `success: true` em `:211`.
- Implicacao direta: o frontend nao pode confiar apenas em `success`; precisa validar tambem `status`.
- `supabase/functions/mercadopago-webhook/index.ts` valida a assinatura por `manifest` em `:39`, usa `MP_MODE` em `:75`, escolhe token por `:77-78` e grava `webhook_updated_at` em `:134` ao atualizar `payments`.

### 11. Fallbacks e gateways alternativos

- `supabase/functions/create-payment/index.ts` comeca com `serve(async (req) => {` em `:8`, tenta `supabase.auth.getUser(token)` antes de criar o client em `:24`, usa `PAGBANK_ENV` em `:36` e so depois instancia `createClient()` em `:38`.
- `supabase/functions/pagbank-payment-v2/index.ts` repete o mesmo problema: chama `supabase.auth.getUser(token)` antes do client em `:95`, cria o client apenas em `:139`, repete auth em `:145` e so trata persistencia quando `normalizedStatus === "PAID"` em `:366`.
- `supabase/functions/efi-payment/index.ts` aponta `notification_url` para `.../functions/v1/efi-webhook` em `:155`; a function `efi-webhook` nao foi localizada no repositorio auditado.

### 12. Validacao automatica, face e verificacao publica

- `supabase/functions/validate-document-v2/index.ts` ainda aceita PDF para `rg`/`matricula` em `:97`, chama OpenRouter em `:475` e `:519`, usa o modelo `google/gemini-2.5-flash` em `:484` e `:528`, atualiza `profile_photo_url` em `:184-193` e grava `validation_confidence` em `:638`.
- Isso contradiz o comentario de topo do proprio arquivo, porque na pratica a function altera `student_profiles`.
- `supabase/functions/compare-faces/index.ts` le documentos RG/foto/selfie em `:60-63`, marca `face_validated: true` em `:189`, grava uma linha em `face_validations` em `:198` e depois segue aprovando/rejeitando documentos em `:216` e `:253`.
- `supabase/functions/verify-student-card/index.ts` documenta a entrada `usage_code + birth_date` em `:14-15`, normaliza o codigo em `:58`, procura o card por `usage_code` em `:119`, tenta primeiro `createSignedUrl(profile.profile_photo_url, 300)` em `:167` e, se nao houver foto, cai no fallback `candidatePath = ${profile.user_id}/foto` em `:173`, gerando URL assinada em `:176`.
- O fallback acima nao bate com o path real do upload frontend, que usa `${user.id}/${type}/${Date.now()}.${ext}`.
- `supabase/functions/generate-digital-card/index.ts` tambem chama `supabase.auth.getUser(token)` antes de instanciar `createClient()` em `:37` vs `:65`, le `digital_card_generated` no select em `:95`, grava `card_generation_logs` em `:264`, `:311` e `:347`, e atualiza `digital_card_generated: true` em `:341`.

### 13. Configuracao de functions

- `supabase/config.toml` declara explicitamente apenas `admin-update-email` em `:3-4`, `create-payment` em `:6-7`, `delete-user-data` em `:9-10`, `generate-digital-card` em `:12-13` e `verify-student-card` em `:15-16`.
- Nao foram encontradas entradas explicitas no `config.toml` para functions realmente usadas no runtime, como `mercadopago-payment`, `mercadopago-webhook`, `pagbank-payment-v2`, `efi-payment`, `validate-cpf`, `delete-unconfirmed-user`, `validate-document-v2` e `compare-faces`.

## Banco, SQL, triggers, RLS e storage

### 14. Criacao de perfil, CPF e classificacao

- A function SQL `create_student_profile()` esta em `supabase/migrations/20260115_fix_create_student_profile_birthdate.sql:1`, le `birth_date` de metadata em `:10-17` e insere em `student_profiles` em `:20-33`.
- Nesta passada de auditoria, a trigger de ligacao dessa function com `auth.users` nao foi reidentificada com a mesma clareza que a function em si.
- A function `check_cpf_exists()` esta em `supabase/migrations/20260202_fix_search_path.sql:150`, filtrando `deleted_at IS NULL` em `:163`; a limpeza de cache `cleanup_expired_cpf_cache()` esta em `:172`.
- A classificacao SQL de Direito esta em `supabase/migrations/20260103151557_0666cb9e-f6a5-4d55-96fc-977065594d15.sql:6-12`, com trigger executada em `:23` e backfill em `:27`.

### 15. Pagamento aprovado, ativacao do card e documentos

- A trigger/função `create_student_card_on_payment()` esta em `supabase/migrations/20260102205259_b724100d-d94d-4897-94c0-5e57ac2f6315.sql:16`, reagindo a `NEW.status = 'approved'` em `:28`.
- A ativacao por documentos esta em `activate_student_card_on_docs_approved()` no mesmo arquivo em `:85`, checando novamente `NEW.status = 'approved'` em `:95`, exigindo `v_total_approved >= 4` em `:105` e sendo ligada pela trigger `on_document_approved` em `:140-143`.
- A politica RLS que permite ao aluno atualizar apenas documentos proprios pendentes/rejeitados esta em `supabase/migrations/20251216192350_0974d9b8-a9d3-4919-8b9a-93bab1cef719.sql:5-15`.
- A atualizacao automatica de `profile_photo_url` no banco tambem existe em `supabase/migrations/20260125_update_profile_photo_on_approval.sql:1-19`, logo ha redundancia entre SQL e Edge Function para esse campo.

### 16. Triggers de validacao e endurecimento

- A versao antiga de `trigger_validate_document()` esta em `supabase/migrations/20260113_create_document_validation_triggers.sql:9-28`, usando URL do projeto antigo em `:12` e placeholder de service key em `:13`, com trigger ligada em `:38-42`.
- A versao antiga de `trigger_compare_faces()` esta em `supabase/migrations/20260113_create_face_comparison_trigger.sql:6-24`, tambem usando projeto antigo em `:9`, placeholder em `:10` e disparo com `docs_aprovados >= 3` em `:24`, ligada em `:41-45`.
- O endurecimento posterior esta em `supabase/migrations/20260202_secure_triggers_and_move_pgnet.sql`, movendo `pg_net` para `extensions` em `:8`, recriando `trigger_validate_document()` em `:11-23` e `trigger_compare_faces()` em `:42-55`, agora usando `vault.decrypted_secrets` e a URL do projeto atual `zyfbxzjfpncxfawthsht`.

### 17. Geracao digital e URL publica de verificacao

- O schema extra da geracao digital esta em `supabase/migrations/20260116123000_add_digital_card_generation.sql:2-6`, adicionando `digital_card_generated`, `generation_attempts`, `last_generation_error` e criando `card_generation_logs`.
- A URL publica de verificacao foi atualizada para `https://urebrasil.com/verificar?code=` em `supabase/migrations/20260217123000_update_verification_url.sql:41`, `:79` e `:96`.

### 18. RPC e itens nao localizados no versionamento

- A documentacao de `advance_to_review` esta em `docs/triggers-rpcs.md:8-23`, dizendo que a RPC exige `face_validated = true`, `terms_accepted = true` e avanca `current_onboarding_step` para `review_data`.
- Porem, a definicao SQL versionada de `advance_to_review` nao foi localizada no diretorio `supabase/migrations` durante esta auditoria; uma busca direta por `advance_to_review` nao retornou matches.
- Tambem nao foi localizada, na trilha versionada lida, a criacao explicita dos buckets `documents`, `profile-photos` e `student-cards`, embora o runtime use esses buckets de forma clara.

## Admin, producao fisica e suporte

### 19. Fluxo da carteira fisica no admin

- `src/admin/components/CardProduction/PrintBatchModal.tsx` grava em `physical_card_prints` em `:131`, salva `pdf_url` em `:134`, `printed_by` em `:137` e atualiza `student_cards.shipping_status = 'printed'` em `:143`.
- `src/admin/components/CardProduction/ShippingModal.tsx` grava `shipping_code` em `:47`, marca `shipping_status = 'shipped'` em `:49`, atualiza `physical_card_prints` em `:61` e persiste `tracking_code` em `:64`.
- `src/admin/pages/Cards.tsx` modela `ShippingStatus` com extensao manual de `'printed'` em `:13` e segmenta filas por `pending` em `:42`, `printed` em `:50`, `shipped` em `:58` e `delivered` em `:66`.
- Na trilha auditada, nao foi localizado insert explicito de notificacao ao aluno durante o envio fisico.

### 20. Suporte e tipos gerados

- O chat do aluno em `src/components/TicketChat.tsx` le mensagens em `support_messages` em `:36`, abre realtime por `postgres_changes` em `:52` e grava novas mensagens em `:119`.
- Os tipos gerados em `src/integrations/supabase/types.ts` incluem `support_messages` em `:534`, `support_tickets` em `:579`, `webhook_logs` em `:703` e a RPC `check_phone_exists` em `:840`.
- Apesar disso, continuam existindo sinais de drift entre `types.ts` e o runtime observado, porque varias tabelas/campos usados nos fluxos auditados nao apareceram com a mesma evidencia nesse arquivo gerado.

### 21. RLS adicional

- `supabase/migrations/20260430_fix_admin_rls_policies.sql` habilita RLS em `physical_card_prints` em `:76` e cria a policy admin-only em `:79-83`.
- O mesmo arquivo tambem habilita RLS em `support_messages` em `:15` e reutiliza `is_admin()` em `:42-43`, reforcando que o repositorio mistura politicas de aluno e camadas admin na mesma trilha de migrations.

## Achados por risco

### Faixa vermelha

- ✅ CORRIGIDO (2026-07-01, commit a012066): `src/pages/Pagamento.tsx:545`, `src/pages/Checkout.tsx:566` e `src/pages/CheckoutFisica.tsx:385` agora bloqueiam qualquer status diferente de `approved` (antes, Pagamento bloqueava apenas `rejected`, e Checkout/CheckoutFisica nao verificavam status). O hook `src/hooks/useMercadoPago.ts` (`:189`, `:298`, `:301`) continua validando apenas `!data.success`, mas isso e esperado porque a validacao de status de negocio e responsabilidade do chamador (Pagamento/Checkout/CheckoutFisica), nao do hook.
- `supabase/functions/mercadopago-payment/index.ts:211` retorna `success: true` mesmo quando o `statusMap` pode resultar em `rejected`, conforme `:149-161`.
- `src/pages/UploadDocumentos.tsx:786` e `:940` ainda aceitam PDF para RG, enquanto `supabase/functions/validate-document-v2/index.ts:97` tambem aceita PDF para RG no backend.
- `supabase/functions/create-payment/index.ts:24-38`, `supabase/functions/pagbank-payment-v2/index.ts:95-145` e `supabase/functions/generate-digital-card/index.ts:37-65` usam `supabase` antes de instanciar o client, indicando bugs estruturais reais nesses caminhos.
- `supabase/functions/efi-payment/index.ts:155` depende de `efi-webhook`, que nao foi localizado no repositorio auditado.
- `supabase/functions/verify-student-card/index.ts:173-176` usa fallback de foto que nao bate com o path real de upload do frontend (`src/pages/UploadDocumentos.tsx:842` e `:969`).

### Faixa amarela

- `src/pages/Checkout.tsx:226`, `:265` e `:367` ainda usam `/dashboard`, mas a autoridade oficial de onboarding esta em `src/hooks/useOnboardingGuard.ts:6-70`.
- A classificacao de estudante de Direito diverge entre frontend (`src/pages/CompleteProfile.tsx:479`) e SQL (`supabase/migrations/20260103151557_0666cb9e-f6a5-4d55-96fc-977065594d15.sql:6-12`).
- `src/hooks/useFaceValidation.ts:63-65` escuta apenas `INSERT`, nao `UPDATE`, o que pode atrasar reflexo visual de mudancas posteriores em `face_validations`.
- `supabase/config.toml:3-16` esta incompleto frente ao inventario real de functions usadas no runtime.
- Ha duplicidade de atualizacao de `profile_photo_url` entre Edge Function (`supabase/functions/validate-document-v2/index.ts:184-193`) e trigger SQL (`supabase/migrations/20260125_update_profile_photo_on_approval.sql:1-19`).
- Existem dois caminhos de geracao digital coexistindo: frontend ativo em `src/pages/Carteirinha.tsx:197-240` e Edge Function paralela em `supabase/functions/generate-digital-card/index.ts:95-347`.

### Faixa amarela para governanca/versionamento

- A SQL de `advance_to_review` esta documentada em `docs/triggers-rpcs.md:8-23`, mas nao foi localizada em `supabase/migrations`.
- A criacao versionada dos buckets `documents`, `profile-photos` e `student-cards` nao foi localizada na trilha SQL lida, embora o runtime dependa deles explicitamente.
- O arquivo gerado `src/integrations/supabase/types.ts` contem parte do schema relevante, mas nao representa com a mesma clareza varias entidades/campos usados pelo runtime auditado.

## Conclusao factual

- O sistema implementa um fluxo completo e funcional de captura de lead, autenticacao PKCE, perfil, pagamento, upload, validacao automatica, comparacao facial, revisao, geracao de carteirinha e verificacao publica.
- A autoridade principal do onboarding hoje esta distribuida entre `current_onboarding_step`, `goToStudentCardFlow()`, triggers SQL de documentos/pagamentos e algumas Edge Functions.
- Os maiores riscos reais nao estao na existencia do fluxo, mas nos desalinhamentos entre frontend/backend/schema: tratamento de `rejected`, aceitação de PDF para RG, drift de config/types, webhooks faltantes e caminhos estruturais alternativos quebrados ou paralelos.
- O caminho digital ativo em producao, com base no codigo auditado, e frontend + `html2canvas` + storage bucket; a function server-side de geracao existe, mas nao aparenta ser a trilha dominante do runtime atual.
- O repositrio versionado tem evidencias fortes de endurecimento progressivo do banco e dos triggers, mas ainda deixa lacunas de rastreabilidade em RPCs e buckets que o runtime usa de forma critica.
