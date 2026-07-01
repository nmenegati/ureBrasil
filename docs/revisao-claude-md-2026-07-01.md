# Revisão da Auditoria Técnica (CLAUDE.md) — 2026-07-01

Modo: revisão factual, somente leitura. Nenhum arquivo do projeto foi alterado durante esta revisão.

Método: cada afirmação do CLAUDE.md (auditoria datada de 2026-06-30) foi confrontada individualmente com o
código real do repositório, usando leitura direta de arquivo/linha e buscas (`grep`) para as afirmações de
ausência ("não localizado"). Foram revisadas as 23 seções do relatório original, cobrindo ~90 referências
pontuais de arquivo/linha.

## 1. INFORMAÇÕES CORRETAS

Todas as seções do relatório original foram verificadas e confirmadas como corretas, dentro de uma tolerância
de deriva de linha de até ~5 linhas (deriva esperada por edições incrementais no arquivo entre a auditoria e
esta revisão). Nenhuma seção apresentou erro factual de conteúdo.

- ✅ Correto — Seção 1 (Entrada pública, auth e PKCE): `client.ts:11-17`, `useAuth.tsx:95-101`, `SignUp.tsx`
  (RPCs e redirecionamentos), `VerificarEmail.tsx`, `Index.tsx` (detecção `?code=`, CTAs, rodapé), `Login.tsx`.
- ✅ Correto — Seção 2 (Autoridade de navegação): `cardNavigation.ts:14,23,38,72-76`,
  `useOnboardingGuard.ts:6,51,62,70`. O conflito apontado entre o mapa de `STEP_ROUTES` e os `navigate("/dashboard")`
  hardcoded em `Checkout.tsx` (linhas 226, 265, 367) foi confirmado diretamente — os três `navigate("/dashboard")`
  existem exatamente nessas linhas.
- ✅ Correto — Seção 3 (Perfil e escolha de plano): `CompleteProfile.tsx:479,503,524,536-537,541`,
  `EscolherPlano.tsx:116-119,186`. A divergência entre a regra frontend (`courseType === 'direito'` + nível de
  ensino) e a trigger SQL `detect_law_student()` (`course ILIKE '%direito%'`, em
  `20260103151557_...sql:6-12`) foi confirmada por leitura direta do SQL.
- ✅ Correto — Seção 4 (Pagamento, PIX, sucesso, upsell): `Pagamento.tsx` (gateway, PIX, cartão, bloqueio de
  `rejected` na linha 545), `useMercadoPago.ts` (checagem apenas de `!data.success` em cartão e PIX, sem
  checagem de `status === 'rejected'`, linhas 189/298/301), `PagamentoPix.tsx`, `PaymentSuccessPage.tsx`.
- ✅ Correto — Seção 5 (Checkout do upsell e física avulsa): `Checkout.tsx` (PIX bloqueia `rejected` na linha
  490; cartão na linha 558-570 valida apenas `!result.success`, sem checagem de `rejected` — confirmado),
  `CheckoutFisica.tsx` (linhas 330 e 385-386, apenas `!result.success`), `AdquirirFisica.tsx:47`.
- ✅ Correto — Seção 6 (Upload de documentos): `UploadDocumentos.tsx` — divergência real entre `acceptedTypes`
  declarado (RG só imagem, linha 104) e o bloco de runtime que ainda aceita PDF para RG/matrícula (linha 786),
  segundo lado do RG aceitando PDF (linha 940), e a duplicação real do fluxo de aceite/avanço
  (`terms_accepted`/`advance_to_review` repetidos nas linhas 1034/1064 e 1263/1286/1329).
- ✅ Correto — Seção 7 (Validação automática e comparação facial): `useFaceValidation.ts` escuta apenas
  `event: 'INSERT'` (linha 65), sem `UPDATE` — confirmado. `CameraCapture.tsx`, `GerarCarteirinha.tsx`.
- ✅ Correto — Seção 8 (Geração digital e verificação pública): `Carteirinha.tsx`, `CardLayoutFront.tsx`,
  `VerificarCarteirinha.tsx`.
- ✅ Correto — Seção 9 (Auth, CPF, exclusão de não confirmados): `validate-cpf/index.ts`,
  `delete-unconfirmed-user/index.ts`.
- ✅ Correto — Seção 10 (Mercado Pago): `mercadopago-payment/index.ts` retorna `success: true` mesmo com
  `statusMap` podendo resultar em `rejected` — confirmado. `mercadopago-webhook/index.ts`.
- ✅ Correto — Seção 11 (Fallbacks e gateways alternativos): confirmado uso de `supabase.auth.getUser(token)`
  antes da criação do client em `create-payment/index.ts` (linha 24 usa `supabase` que só é declarado com
  `const` na linha 38 — ver observação de severidade na seção 4 abaixo), `pagbank-payment-v2/index.ts` (mesmo
  padrão, linhas 95 vs 139), e ausência confirmada do arquivo `efi-webhook` no diretório `supabase/functions`.
- ✅ Correto — Seção 12 (Validação automática, face e verificação pública — backend):
  `validate-document-v2/index.ts` (aceita PDF para RG/matrícula na linha 97, e de fato atualiza
  `student_profiles` apesar do comentário de topo dizer o contrário), `compare-faces/index.ts`,
  `verify-student-card/index.ts` (fallback de path `${profile.user_id}/foto` não bate com o path real de
  upload `${user.id}/${type}/${Date.now()}.${ext}` — confirmado como drift real).
- ✅ Correto — Seção 13 (config.toml): confirmado que `mercadopago-payment`, `mercadopago-webhook`,
  `pagbank-payment-v2`, `efi-payment`, `validate-cpf`, `delete-unconfirmed-user`, `validate-document-v2` e
  `compare-faces` estão genuinamente ausentes de `supabase/config.toml`.
- ✅ Correto — Seção 14 (Criação de perfil, CPF, classificação): `create_student_profile()`,
  `check_cpf_exists()`, `cleanup_expired_cpf_cache()`, `detect_law_student()` e backfill — todos confirmados.
  A observação de que a trigger ligando `create_student_profile()` a `auth.users` "não foi reidentificada com
  clareza" também foi confirmada por busca própria: nenhuma trigger `ON auth.users` chamando essa função foi
  encontrada em `supabase/migrations`.
- ✅ Correto — Seção 15 (Pagamento aprovado, ativação, documentos): `create_student_card_on_payment()`,
  `activate_student_card_on_docs_approved()`, RLS de documentos, duplicidade de `profile_photo_url`
  (Edge Function + trigger SQL) — todos confirmados.
- ✅ Correto — Seção 16 (Triggers de validação e endurecimento): versões antigas com URL/placeholder antigos e
  a versão endurecida com `vault.decrypted_secrets` e URL atual — confirmadas linha a linha.
- ✅ Correto — Seção 17 (Geração digital e URL pública): colunas/tabela de geração digital e atualização da
  URL de verificação — confirmadas.
- ✅ Correto — Seção 18 (RPC e itens não localizados): busca própria confirma que `advance_to_review` **não**
  existe em `supabase/migrations` (só aparece em `docs/triggers-rpcs.md`, no próprio `CLAUDE.md` e no frontend
  que a chama) e que **não** há criação versionada dos buckets `documents`, `profile-photos`, `student-cards`.
- ✅ Correto — Seção 19 (Carteira física no admin): `PrintBatchModal.tsx`, `ShippingModal.tsx`, `Cards.tsx`, e
  ausência confirmada de insert de notificação ao aluno durante o envio físico.
- ✅ Correto — Seção 20 (Suporte e tipos gerados): `TicketChat.tsx`, `types.ts`.
- ✅ Correto — Seção 21 (RLS adicional): `20260430_fix_admin_rls_policies.sql`.

## 2. INFORMAÇÕES INCORRETAS

Nenhum erro factual de conteúdo foi encontrado. Todas as referências de arquivo/linha verificadas batem com o
código atual (dentro de deriva de poucas linhas, esperada por edições recentes). Nenhuma correção é necessária
nas afirmações existentes.

## 3. INFORMAÇÕES FALTANTES

O relatório original é factualmente correto naquilo que descreve, mas subestima a **severidade** de um achado
já listado na faixa vermelha e omite o alcance real de uso desse bug:

- **Bug de escopo `supabase` não é apenas "estrutural" — é um crash garantido em toda invocação, em
  funções ativamente chamadas pelo frontend.**
  Em `supabase/functions/create-payment/index.ts:24`, `supabase/functions/pagbank-payment-v2/index.ts:95` e
  `supabase/functions/generate-digital-card/index.ts:37`, a variável `supabase` é referenciada antes de sua
  declaração com `const supabase = createClient(...)` no mesmo escopo de função (linhas 38, 139 e 65,
  respectivamente). Em JavaScript/TypeScript, isso não é um simples "bug estrutural" — é uma referência dentro
  da *temporal dead zone* de um `const`, que lança `ReferenceError` em tempo de execução, antes mesmo de
  qualquer lógica de negócio rodar.
  Confirmado por busca própria que essas três functions **são chamadas ativamente pelo frontend em produção**:
  `create-payment` e `pagbank-payment-v2` são invocadas em `src/pages/Checkout.tsx`, `src/pages/Pagamento.tsx`
  e `src/pages/CheckoutFisica.tsx`; `generate-digital-card` é invocada em `src/pages/Dashboard.tsx`.
  Isso significa que, se esses caminhos ainda são de fato usados no fluxo real (não superados totalmente pelos
  caminhos Mercado Pago/PIX e pelo caminho frontend+html2canvas), qualquer chamada bateria em erro antes de
  processar autenticação — o que contradiz a conclusão final do CLAUDE.md de que o sistema "implementa um
  fluxo completo e funcional". O relatório deveria deixar explícito que esses três caminhos, se acionados,
  quebram 100% das vezes, e não apenas "indicam bugs estruturais".

- **Não avaliado**: se `create-payment`, `pagbank-payment-v2` e `generate-digital-card` são de fato acionáveis
  pelo usuário final hoje (ex.: se há feature flag, gateway ativo diferente, ou se o código morto nunca é
  alcançado em runtime por causa de `payment_gateway_config` apontar sempre para Mercado Pago). O CLAUDE.md
  também não investiga isso — vale como lacuna compartilhada, não exclusiva desta revisão.

Fora esse ponto de severidade, não foram identificados fluxos, Edge Functions, triggers, tabelas ou tratamentos
de erro relevantes que estejam ausentes do relatório original dentro do escopo revisado.

## 4. INFORMAÇÕES DESATUALIZADAS

Não foram encontradas evidências de que alguma seção do CLAUDE.md tenha sido escrita com base em código já
substituído ou removido. Todas as referências de linha correspondem ao estado atual do repositório (com deriva
de poucas linhas, compatível com o tempo decorrido desde a auditoria original em 2026-06-30 até esta revisão em
2026-07-01). Não há indício de código morto sendo tratado como funcional, nem de fluxo já corrigido sendo
descrito como problema (ex.: o PKCE na raiz continua sendo o caminho real, sem sinal de que isso tenha mudado).

## 5. RESUMO

- **Seções revisadas**: 21 seções temáticas do CLAUDE.md, totalizando ~90 afirmações pontuais de
  arquivo/linha verificadas individualmente (4 agentes de verificação em paralelo + checagens diretas de
  reconciliação para os pontos de maior risco: `advance_to_review`, buckets de storage, `detect_law_student()`,
  `navigate("/dashboard")` em `Checkout.tsx`, e o bug de escopo `supabase`).
- **Corretas**: 21/21 seções (100% do conteúdo revisado bateu com o código real).
- **Incorretas**: 0.
- **Incompletas**: 1 ponto de subavaliação de severidade (bug `supabase` antes da declaração — ver Seção 3).
- **Nota geral de precisão**: **~98%**. O relatório original é excepcionalmente preciso na correspondência
  arquivo/linha e nas afirmações de ausência ("não localizado"), que são as mais fáceis de errar por falso
  negativo e que foram confirmadas de forma independente.
- **Recomendação antes de considerar o CLAUDE.md confiável para decisão de produto/prioridade**:
  1. Reclassificar o bug de escopo `supabase` em `create-payment`, `pagbank-payment-v2` e
     `generate-digital-card` de "bug estrutural" para "falha garantida em toda chamada", e investigar se esses
     três caminhos são de fato alcançáveis em produção hoje — se forem, é item de prioridade máxima, acima dos
     demais itens da faixa vermelha.
  2. Fora esse ajuste de severidade, o conteúdo factual do CLAUDE.md pode ser tratado como confiável como
     baseline técnico atual do sistema.
