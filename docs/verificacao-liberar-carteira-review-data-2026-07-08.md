# Verificação: Liberar Geração de Carteira (review_data → completed)

Data: 2026-07-08
Modo: leitura factual apenas. Nenhum arquivo alterado. Nenhum SQL executado.

## Achado central

Existem **dois caminhos de geração da imagem digital**, e o mais importante para este caso é que **NENHUM depende de forçar `current_onboarding_step`**:

1. **Dashboard → botão "Gerar Minha Carteirinha Digital"** → invoca a **Edge Function `generate-digital-card`** ([Dashboard.tsx:314-319](src/pages/Dashboard.tsx#L314-L319)). **Não exige `step = completed`** — só exige `canGenerateDigitalCard` (card active + pagamento aprovado + 4 docs + `face_validated` + sem `digital_card_url`). Para este aluno, **todas essas condições já estão satisfeitas**.
2. **`/carteirinha` → geração client-side via `html2canvas`** ([Carteirinha.tsx:271-278](src/pages/Carteirinha.tsx#L271-L278)). **Exige `step = completed`** (guard em [:65](src/pages/Carteirinha.tsx#L65)), alcançado passando pela tela de revisão `/gerar-carteirinha` e confirmando.

Conclusão antecipada: **não é necessário mexer no banco.** O aluno consegue gerar a carteira agora, pelo fluxo normal, e o template será o de Direito (o `card_type` já é `direito_digital` e `is_law_student = true`).

## 1. STEP review_data

- Rota: **`/gerar-carteirinha`** ([useOnboardingGuard.ts:13](src/hooks/useOnboardingGuard.ts#L13): `review_data: '/gerar-carteirinha'`).
- Ação do usuário: é a **tela de revisão final dos dados** ([GerarCarteirinha.tsx](src/pages/GerarCarteirinha.tsx)). O componente carrega o perfil, valida que há 4 documentos aprovados + `face_validated` + `terms_accepted`, e mostra os dados para conferência. **Não é revisão manual da equipe** — é uma confirmação do próprio aluno. (A revisão manual da equipe é outra coisa: `/aguardando-aprovacao`, acionada por `manual_review_requested`.)
- Step seguinte: **`completed`**. Ao clicar em confirmar/gerar, `handleConfirmGenerate` faz `update({ current_onboarding_step: 'completed' })` e navega para `/carteirinha` ([GerarCarteirinha.tsx:140-149](src/pages/GerarCarteirinha.tsx#L140-L149)). **Esse handler não gera a imagem** — só avança o step e redireciona; a geração ocorre depois, em `/carteirinha`.

## 2. GERAÇÃO DA IMAGEM

- Disparada por: **ação do usuário na UI**, por um de dois caminhos (ver Achado central). **Não há trigger de banco** que gere a imagem, e o step mudar para `completed` **não** dispara geração por si só.
- Edge function: **`generate-digital-card` EXISTE** ([supabase/functions/generate-digital-card/index.ts](supabase/functions/generate-digital-card/index.ts)) e é **efetivamente chamada** pelo Dashboard ([Dashboard.tsx:314](src/pages/Dashboard.tsx#L314)) — passando `{ userId, cardType: isLawStudent ? 'direito' : 'geral' }`. Ela grava `digital_card_generated = true` e o `digital_card_url`. O template é decidido por `body.cardType || card.card_type.includes('direito')` ([index.ts:129-133](supabase/functions/generate-digital-card/index.ts#L129-L133)) → aqui resulta **direito** por ambos os critérios.
- Também existe o caminho `html2canvas` em `/carteirinha` ([Carteirinha.tsx:170-269](src/pages/Carteirinha.tsx#L170-L269)), que grava `digital_card_url` + `digital_card_generated = true` ([:238-255](src/pages/Carteirinha.tsx#L238-L255)) usando `card_type` para o template.
- Depende de step? **Depende do caminho:**
  - Caminho Dashboard/edge function: **NÃO** depende de step.
  - Caminho `/carteirinha` (html2canvas): **SIM**, exige `step = completed` (senão o guard redireciona de volta para `/gerar-carteirinha`).

## 3. TELA DE REVISÃO

- Componente: **`src/pages/GerarCarteirinha.tsx`** (guard `useOnboardingGuard('review_data')`).
- Ação de confirmar: `handleConfirmGenerate` → `update current_onboarding_step = 'completed'` + `navigate('/carteirinha')`. **Não gera a imagem diretamente** — a geração acontece ao aterrissar em `/carteirinha`.
- Obrigatória? **NÃO, se usar o caminho do Dashboard.** O botão "Gerar Minha Carteirinha Digital" do Dashboard chama a edge function e gera **sem** passar por essa tela e **sem** `step = completed`. A tela de revisão só é obrigatória se optar pelo caminho `html2canvas` de `/carteirinha` (que exige `completed`).

## 4. DASHBOARD

- O texto literal "em revisão" **não existe** no `Dashboard.tsx` (busca no `src/` não encontrou). O que o aluno vê depende dos flags:
  - Bloco de status do card ([:580-600](src/pages/Dashboard.tsx#L580-L600)): como `card_number` existe e `status = 'active'`, `hasCardGenerated = true` ([:423-426](src/pages/Dashboard.tsx#L423-L426)) → mostra **"Ativa"**.
  - Bloco de ação do card digital ([:654-688](src/pages/Dashboard.tsx#L654-L688)): como `digital_card_url` é `null` e `canGenerateDigitalCard = true`, mostra o botão **"Gerar Minha Carteirinha Digital"** ([:664-671](src/pages/Dashboard.tsx#L664-L671)).
  - A percepção de "em revisão" provavelmente vem do **onboarding estar em `review_data`** (a etapa de revisão), não de um rótulo literal. O importante: o aluno **já tem o botão de gerar disponível**.
- "Em revisão"/estado baseado em: combinação de `student_cards.status` (`active` → "Ativa") + `digital_card_url` (null → ainda oferece gerar) + `canGenerateDigitalCard` (que exige `face_validated`). **Não** é baseado em `current_onboarding_step` para exibir o card.
- Carteira visível quando: o **link/imagem** ("Ver Carteirinha Digital", [:654-662](src/pages/Dashboard.tsx#L654-L662)) aparece quando **`digital_card_url` deixa de ser null** — ou seja, após a geração. Não depende de `step`. O tile "Carteirinha" já é clicável para `/carteirinha` porque `hasCardGenerated` é true — mas `/carteirinha` tem guard de `completed`, então clicar nele hoje (step=review_data) redirecionaria para `/gerar-carteirinha`.

## 5. CAMINHO RECOMENDADO

- Opção: **D (nenhuma alteração no banco) — o aluno gera pela UI normal.** Preferencialmente pelo **botão do Dashboard "Gerar Minha Carteirinha Digital"** (mais direto; usa a edge function; não precisa de `completed`).
- Passos exatos:
  1. O aluno faz login e vai ao **Dashboard**.
  2. Clica em **"Gerar Minha Carteirinha Digital"** → confirma no modal → a Edge Function `generate-digital-card` roda com `cardType: 'direito'` (porque `is_law_student = true`) → grava `digital_card_url` + `digital_card_generated = true`.
  3. O botão passa a mostrar **"Ver Carteirinha Digital"** e a carteira fica disponível.
  - **Caminho alternativo equivalente (B):** login → é roteado para `/gerar-carteirinha` (revisão) → clica em gerar/confirmar → `step = completed` → `/carteirinha` → `html2canvas` gera a imagem com o template de Direito. Também não precisa de SQL.
- **Por que NÃO a Opção A (forçar `step = completed` via SQL):** forçar o step **não gera a imagem** — apenas destrava o guard de `/carteirinha`. A imagem só é criada quando o aluno efetivamente aciona um dos dois caminhos. Ou seja, o SQL sozinho não resolve e ainda cria um estado levemente inconsistente (`completed` com `digital_card_generated = false`). Desnecessário.
- **Por que NÃO a Opção C (curl manual na edge function):** é possível, mas é justamente o que o **botão do Dashboard já faz** de forma segura e autenticada. Invocar manualmente exigiria montar auth/JWT e não traz vantagem sobre a Opção D.

## 6. RISCOS

| Risco | Severidade | Mitigação |
|---|---|---|
| Forçar `step = completed` por SQL não gerar a imagem (expectativa falsa) | Média | Não usar Opção A. Usar o botão do Dashboard (Opção D) — gera de fato via edge function. |
| Estado inconsistente `completed` + `digital_card_generated = false` (se forçar SQL e o aluno não visitar `/carteirinha`) | Baixa | Não forçar o step; deixar a UI avançar o step naturalmente. |
| Template errado por causa da troca geral→direito | **Nenhuma** | `card_type = 'direito_digital'` e `is_law_student = true`. Ambos os caminhos resolvem para Direito: Dashboard passa `cardType:'direito'`; edge function ainda confirma via `card.card_type.includes('direito')`; `html2canvas` usa `card_type`. |
| `canGenerateDigitalCard` bloqueado por `face_validated = false` | Baixa | Como o aluno está em `review_data`, o `advance_to_review` já exigiu `face_validated = true` e `terms_accepted = true` (docs/triggers-rpcs.md). Se, por algum motivo, o botão aparecer desabilitado com "Validação facial em andamento", verificar `student_profiles.face_validated` — mas o esperado é já estar `true`. |
| A geração `html2canvas` depende de dados do `review_data` | Nenhuma | A revisão não preenche dados novos — só confere. `/carteirinha` lê perfil + `student_cards` (já `active`) + gera QR; nada exclusivo do review_data. |
| Aluno acessa `/carteirinha` hoje (step=review_data) e é redirecionado | Baixa/esperado | Guard `useOnboardingGuard('completed')` redireciona para `/gerar-carteirinha`. É o comportamento correto; ele confirma lá e segue. Ou usa o botão do Dashboard, que não passa por esse guard. |

## Resumo

- O aluno **não está travado** e **não precisa de intervenção no banco**. Ele já reúne todas as condições (`card active`, pagamento aprovado, 4 docs, `face_validated`, `card_type = direito_digital`).
- **Ação recomendada:** orientar o aluno a clicar em **"Gerar Minha Carteirinha Digital"** no Dashboard (ou concluir a tela `/gerar-carteirinha`). A carteira será gerada com o **template de Direito**, sem risco decorrente da troca de plano.
- Só se houvesse impedimento real (ex.: `face_validated = false`) é que caberia investigar o dado específico — mas nada indica isso para um perfil já em `review_data`.
