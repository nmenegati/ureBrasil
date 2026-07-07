# Verificação: Remover escolha de plano para estudantes de Direito

Data: 2026-07-07
Modo: leitura factual apenas. Nenhum arquivo de código foi alterado.

## 1. ID DO PLANO DIREITO

- UUID: **não localizado no repositório versionado**.
- Fonte: nenhuma. Foi feita busca por `INSERT INTO plans`, por `CREATE TABLE plans` e pelo próprio UUID de `PLAN_GERAL_DIGITAL_ID` (`a20e423f-c222-47b0-814f-e532f1bbe0c4`) em todo `supabase/migrations` e `supabase/functions` — nenhum resultado. A tabela `plans` só aparece em migrations como `UPDATE plans ... WHERE type = 'direito_digital'` (`supabase/migrations/20251216195120_...sql:3`, `supabase/migrations/20260111120000_update_plan_definitions.sql:8-13`, refletido também em `docs/schema.sql:61,787-792`). Isso confirma o achado da auditoria original (`CLAUDE.md`, seção 18): a criação/seed de `plans` não está versionada — foi feita direto no dashboard/produção.
- `src/pages/EscolherPlano.tsx:114-119` e `src/pages/Index.tsx:167-189` já buscam o plano dinamicamente por `type` (`.in('type', ['geral_digital', 'direito_digital', 'fisica_upsell'])`), não por UUID fixo. Ou seja, **já existe precedente de query dinâmica por `type` no próprio código**, ao lado do padrão hardcoded usado só para `geral_digital`.
- Abordagem recomendada: **query dinâmica** (`supabase.from('plans').select('id').eq('type', 'direito_digital').eq('is_active', true).single()`), não hardcode.
  - Motivo: não há como confirmar com segurança, só lendo o repositório, qual é o UUID real em produção — hardcodar um valor não verificado é o próprio tipo de risco que esta auditoria existe para evitar. Além disso, o padrão hardcoded de `PLAN_GERAL_DIGITAL_ID` já é replicado em 4 arquivos (`CompleteProfile.tsx:486`, `Login.tsx:52`, `EscolherPlano.tsx:74`) — adicionar um quinto valor mágico (e um segundo por tipo de plano) aumenta a superfície de drift caso o preço/plano seja recriado no dashboard com novo ID. A query por `type` é exatamente o que `EscolherPlano.tsx` e `Index.tsx` já fazem hoje para o mesmo propósito.
  - Antes de implementar, é necessário confirmar em produção (via SQL Editor do Supabase, fora do escopo desta auditoria de leitura) que existe exatamente 1 linha `is_active = true` com `type = 'direito_digital'`.

## 2. MAPA DE REFERÊNCIAS a choose_plan / escolher-plano

| Arquivo | Linha | O que faz | Ação necessária |
|---|---|---|---|
| `src/App.tsx` | 24, 107-111 | Registra rota `/escolher-plano` com `ProtectedRoute` | Nenhuma — manter rota registrada |
| `src/hooks/useOnboardingGuard.ts` | 8 | Mapeia `choose_plan: '/escolher-plano'` em `STEP_ROUTES` | Manter (usuários legados com step `choose_plan` continuam precisando ser roteados) |
| `src/pages/CompleteProfile.tsx` | 519-527 | Bloco `if (isLawStudent)`: seta `current_onboarding_step: 'choose_plan'` e `navigate('/escolher-plano')` | **Alterar** — replicar o padrão do bloco `else`, com plano de Direito |
| `src/pages/Login.tsx` | 107-109 | Pós-login sem pagamento aprovado: se `is_law_student`, `window.location.href = '/escolher-plano'` | **Alterar** — indo direto para `/pagamento`, mas só depois de garantir `plan_id` setado (ver seção 4) |
| `src/lib/cardNavigation.ts` | 47-48 | `goToStudentCardFlow()`: sem pagamento aprovado, se `isLawStudent`, `navigate("/escolher-plano")` | **Alterar** — mesmo cuidado de `plan_id` garantido |
| `src/pages/Dashboard.tsx` | 357-360, 404-405 | Botão/label da etapa "Pagamento" no dashboard: se `isLawStudent`, mostra "Escolher Plano" e navega para `/escolher-plano` | **Alterar** — trocar rótulo e rota para `/pagamento` |
| `src/pages/Pagamento.tsx` | 127, 191, 209, 226, 643 | Guard aceita step `["choose_plan", "payment"]`; fallback em erro de perfil/plano navega para `/escolher-plano`; botão de erro "Escolher Plano" | Manter como fallback de erro — ver seção 5 (não precisa remover `choose_plan` do guard, só deixa de ser o caminho normal) |
| `src/pages/Checkout.tsx` | 714 | Fallback "Plano não encontrado" no upsell físico: botão leva a `/escolher-plano` | Manter — fallback genérico de erro, não parte do fluxo de onboarding principal |
| `src/pages/EscolherPlano.tsx` | toda a página | Página de seleção; já auto-redireciona não-Direito para `/pagamento` (linhas 97-112); para Direito, busca planos dinamicamente e deixa escolher | **Manter como fallback/página órfã** (ver seção 7) — não precisa ser alterada para a mudança funcionar |
| `src/components/ChatWrapper.tsx` | 13-16, 22-29 | Lista `/escolher-plano` nas rotas onde o chat aparece e nas perguntas sugeridas | Manter — página continua existindo e acessível |
| `supabase/functions/chat-support/index.ts` | 234 | Mapeia rota `/escolher-plano` para label "Escolha do Plano" em contexto de suporte | Manter — sem impacto funcional |
| `public/robots.txt` | 23 | `Disallow: /escolher-plano` | Manter — página não deve ser indexada de qualquer forma |

## 3. CompleteProfile.tsx

- Mudança necessária: substituir o bloco `if (isLawStudent) { ...navigate('/escolher-plano') }` (linhas 519-527) por uma lógica simétrica ao `else` (529-541), mas resolvendo o `plan_id` do tipo `direito_digital` via query (não hardcode — ver seção 1) antes do update. Estrutura alvo:
  ```
  if (isLawStudent) {
    const { data: direitoPlan } = await supabase.from('plans').select('id').eq('type', 'direito_digital').eq('is_active', true).single();
    // set plan_id: direitoPlan.id, current_onboarding_step: 'payment'
    // navigate/redirect para /pagamento
  } else {
    // bloco atual, sem mudança
  }
  ```
- `localStorage.setItem('selected_plan_id', ...)` necessário? **NÃO**. Foi confirmado por busca em todo o repositório que `selected_plan_id` é escrito em 4 lugares (`CompleteProfile.tsx:530`, `Login.tsx:112`, `EscolherPlano.tsx:101,186`) mas **nunca lido em nenhum arquivo `.ts`/`.tsx`**. `Pagamento.tsx` (linhas 183-211) lê o plano exclusivamente de `student_profiles.plan_id` no banco, nunca de `localStorage`. Essa dead-code já está documentada em auditorias anteriores (`docs/audit-completo.md:347` — "localStorage morto (selected_plan_id)"). Não copiar esse `setItem` para o novo bloco de Direito; é ruído sem função.
- `window.location.href` vs `navigate()` — motivo técnico: existe um padrão consistente no código — sempre que a página seguinte depende de um `current_onboarding_step`/`plan_id` **recém-escrito no banco** e é protegida por um guard que faz fetch fresco no mount (`useOnboardingGuard`, `Pagamento.tsx` `loadPlan()`), o código usa `window.location.href` (reload completo), não `navigate()` do React Router. Esse padrão aparece em `Login.tsx:56,78,90,109,113,146`, `CompleteProfile.tsx:541` (bloco não-Direito), `UploadDocumentos.tsx:1075,1291,1334` e `PagamentoPix.tsx:87`. O bloco atual de Direito é a exceção — usa `navigate('/escolher-plano')` (linha 527), possivelmente porque a página de destino não fazia a leitura crítica de `plan_id` imediatamente (quem decidia o plano final era a própria `EscolherPlano.tsx`). Ao mudar o destino para `/pagamento`, que **depende diretamente do `plan_id` recém-gravado**, a alteração deve seguir o padrão dominante e usar `window.location.href = '/pagamento'`, não `navigate()`, para evitar qualquer risco de estado de cliente (Supabase/React context) desatualizado entre o `update` e o fetch da página seguinte.

## 4. cardNavigation.ts

- `plan_id` garantido quando este código roda? **NÃO necessariamente.** `goToStudentCardFlow()` é chamado a partir da landing (`Index.tsx:157`) sempre que existe uma sessão de usuário — ou seja, roda toda vez que um usuário de Direito **já cadastrado** volta ao site, não só na primeira passagem pelo `CompleteProfile`. Hoje, para esse usuário, a função apenas navega para `/escolher-plano`, e é a própria página de escolha que finalmente grava o `plan_id`. Se a decisão de plano deixar de existir nessa página, `cardNavigation.ts` precisa **também** resolver e gravar o `plan_id` do tipo `direito_digital` (com a mesma lógica de "só atualiza se `plan_id` ainda não tiver um definido", como já faz `EscolherPlano.tsx:99-109`) antes de navegar para `/pagamento` — ou `Pagamento.tsx` vai falhar com "Nenhum plano selecionado" (linha 189-193) para qualquer usuário de Direito que não passou pelo `CompleteProfile` alterado (ex.: perfil criado antes da mudança, ou fluxo interrompido).
- Mudança segura? **Só é segura se acompanhada da garantia de `plan_id`** descrita acima. Trocar apenas a linha 48 de `navigate("/escolher-plano")` para `navigate("/pagamento")`, sem replicar a lógica de resolução de plano, quebra o fluxo para usuários de Direito que chegam a este ponto sem `plan_id` definido.

## 5. Pagamento.tsx — origem do plano

- Fonte primária: `student_profiles.plan_id`, lido em `src/pages/Pagamento.tsx:183-187`, depois usado para buscar a linha completa em `plans` por `id` (linhas 201-205).
- Fallback: **nenhum.** Não há leitura de `localStorage.selected_plan_id` neste arquivo (confirmado por grep — a chave nunca é lida em nenhum lugar do projeto). Se `profile.plan_id` for `null`/`undefined`, cai direto no bloco de erro.
- Risco se `plan_id` null: `toast.error("Nenhum plano selecionado")` e `navigate("/escolher-plano")` (linhas 189-193). Ou seja, **hoje isso já funciona como uma rede de segurança** — mesmo que a etapa de auto-atribuição falhe, o usuário não fica travado, apenas é levado de volta à página de escolha (que continua existindo). Essa rede de segurança é o argumento central para **não deletar `EscolherPlano.tsx`** (seção 7).

## 6. useOnboardingGuard.ts

- Impacto de remover o step `choose_plan` do fluxo **novo**: nenhum imediato, porque o guard (`useOnboardingGuard.ts:6-15`) não precisa ser alterado — `STEP_ROUTES['choose_plan']` continua mapeado para `/escolher-plano`, e essa rota continua existindo e funcional. Novos usuários de Direito simplesmente nunca mais receberão `current_onboarding_step = 'choose_plan'` gravado, então na prática esse branch do guard fica "morto" para novos cadastros, mas sem quebrar nada.
- Usuários existentes com `current_onboarding_step = 'choose_plan'`: **SEM RISCO funcional**, contanto que `EscolherPlano.tsx` seja mantida como está. Esses usuários, ao serem redirecionados pelo guard (de qualquer outra página) ou ao acessar `/escolher-plano` diretamente, ainda vão cair na página, que ainda faz a query dinâmica de planos e permite escolher — nada nesse arquivo precisa mudar para isso continuar funcionando. Não há como, só pela leitura do código, saber **quantos** usuários estão hoje nesse estado — isso exige uma query em produção (`select count(*) from student_profiles where current_onboarding_step = 'choose_plan'`), fora do escopo de uma auditoria somente-leitura de repositório.

## 7. EscolherPlano.tsx

- Recomendação: **MANTER como fallback**, não remover.
- Justificativa:
  1. É o destino de erro de `Pagamento.tsx` quando `plan_id` é nulo (linhas 191, 209, 226) e de `Checkout.tsx` quando o plano não é encontrado (linha 714) — removê-la quebraria esses caminhos de erro já existentes.
  2. É o destino de `STEP_ROUTES['choose_plan']` em `useOnboardingGuard.ts:8` — necessário para não deixar usuários legados presos.
  3. A própria página já contém a lógica de auto-redirecionamento para não-Direito (linhas 97-112) e a busca dinâmica de planos para Direito (linhas 114-165) — ela **não precisa de nenhuma alteração de código** para a mudança pedida funcionar; ela só deixa de ser alcançada pelo caminho feliz normal.
  4. Se alguém acessar a URL diretamente: o guard `useOnboardingGuard('choose_plan')` (linha 52) redireciona para a rota do step atual do usuário (via `STEP_ROUTES`) se o step não for `choose_plan` — ou seja, comportamento seguro e inalterado.

## 8. App.tsx

- Rota protegida? **SIM.** `src/App.tsx:107-111` envolve `<EscolherPlano />` em `<ProtectedRoute>`.
- Risco de manter: **baixo**. A rota continua existindo, protegida por autenticação, e a própria página já tem seus próprios guards de step e de `is_law_student`. Não há necessidade de removê-la do roteador.

## 9. USUÁRIOS EXISTENTES

- Migration SQL necessária? **Não obrigatória, mas recomendável como limpeza posterior** (não bloqueante para o lançamento da mudança). Como detalhado nas seções 5-7, a rede de segurança já existente (guard + fallback em `Pagamento.tsx`) absorve o caso de usuários com `current_onboarding_step = 'choose_plan'` sem qualquer alteração de schema.
- Se, ainda assim, quiser eliminar o estado intermediário para consistência de dados: campos a atualizar seriam `plan_id` (preenchido com o ID do tipo correto, resolvido por `is_law_student`) e `current_onboarding_step = 'payment'`, apenas para linhas onde `current_onboarding_step = 'choose_plan'` **e** `plan_id IS NULL`. Isso deveria ser feito via query direta em produção (Supabase SQL editor), não via arquivo de migration versionado — não há precedente no repositório de migrations que façam backfill condicional de dados de usuário por segmento de negócio (as migrations lidas fazem apenas `UPDATE plans`, que é dado de catálogo, não dado de usuário).

## 10. PLANO DE ALTERAÇÕES

1. **`src/pages/CompleteProfile.tsx` (linhas 519-527)** — RISCO: MÉDIO
   - DE: grava `current_onboarding_step: 'choose_plan'` e `navigate('/escolher-plano')`.
   - PARA: resolve o `id` do plano `direito_digital` via query (`supabase.from('plans').select('id').eq('type','direito_digital').eq('is_active', true).single()`), grava `plan_id` + `current_onboarding_step: 'payment'` no mesmo `update()`, e usa `window.location.href = '/pagamento'` (não `navigate()`), espelhando o bloco `else` já existente.
   - Não replicar `localStorage.setItem('selected_plan_id', ...)` — é código morto, não necessário.

2. **`src/lib/cardNavigation.ts` (linhas 47-48)** — RISCO: ALTO se feito isoladamente
   - DE: `navigate("/escolher-plano")` para `isLawStudent`.
   - PARA: antes de navegar, resolver e gravar `plan_id` (se ainda `null`) do plano `direito_digital`, igual à lógica de auto-atribuição hoje em `EscolherPlano.tsx:97-112`, depois `navigate("/pagamento")`.
   - Risco alto se apenas a rota for trocada sem essa resolução: qualquer usuário de Direito que passe por este caminho sem `plan_id` definido cai no erro "Nenhum plano selecionado" em `Pagamento.tsx`.

3. **`src/pages/Login.tsx` (linhas 107-113)** — RISCO: MÉDIO
   - DE: `if (profile.is_law_student) { window.location.href = '/escolher-plano'; }`.
   - PARA: mesma resolução de `plan_id` de Direito (idealmente extraída para uma função utilitária compartilhada com `CompleteProfile.tsx` e `cardNavigation.ts`, para não triplicar a lógica) + `window.location.href = '/pagamento'`.

4. **`src/pages/Dashboard.tsx` (linhas 357-360, 404-405)** — RISCO: BAIXO
   - DE: rótulo "Escolha seu Plano"/"Escolher Plano" e rota `/escolher-plano` quando `isLawStudent`.
   - PARA: unificar rótulo/rota com o caminho não-Direito (`/pagamento`), já que a escolha deixa de existir.

5. **Nenhuma alteração obrigatória em**: `EscolherPlano.tsx`, `useOnboardingGuard.ts`, `App.tsx`, `Pagamento.tsx`, `Checkout.tsx`, `ChatWrapper.tsx`, `chat-support/index.ts`, `robots.txt` — todos continuam funcionando como fallback/rede de segurança sem mudança de código.

6. **Migration SQL para usuários existentes** — RISCO: BAIXO, opcional
   - Não bloqueante. Pode ser feita depois, como limpeza, via query direta em produção (não arquivo de migration versionado), atualizando `plan_id` + `current_onboarding_step` apenas de quem estiver preso em `choose_plan` com `plan_id IS NULL`.

Ordem de aplicação sugerida: (1) extrair/definir a função de resolução do `plan_id` de Direito por query dinâmica → (2) aplicar em `CompleteProfile.tsx` → (3) aplicar em `cardNavigation.ts` e `Login.tsx` (pontos que atendem usuários já cadastrados) → (4) ajustar rótulos em `Dashboard.tsx` → (5) validar manualmente com uma conta de Direito de teste todo o caminho (cadastro novo, login de usuário já em `choose_plan`, e o caso de erro/fallback) antes de considerar migration de limpeza de dados.
