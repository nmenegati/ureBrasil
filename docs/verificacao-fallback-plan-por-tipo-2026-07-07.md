# Verificação: fallback de plano por `is_law_student` em Pagamento.tsx

Data: 2026-07-07
Modo: leitura factual apenas. Nenhum arquivo de código foi alterado.

## 1. FALLBACK PROPOSTO

- Quebra algo? **NÃO** (com uma ressalva de edge case no fluxo standalone físico — ver seção 4c).
  - Caminho `plan_id` existente: com `profile.plan_id` presente, o código proposto executa `planQuery.eq("id", profile.plan_id).single()` — **idêntico** ao atual (`src/pages/Pagamento.tsx:201-205`). Confirmado, sem mudança de comportamento para a maioria dos usuários.
  - Caminho `plan_id` null + `is_law_student = true` → busca `type = 'direito_digital'`.
  - Caminho `plan_id` null + `is_law_student = false` → busca `type = 'geral_digital'`.
- Plano `direito_digital` ativo único? **NÃO CONFIRMÁVEL pelo repositório.** A tabela `plans` não é criada/populada por nenhum `INSERT` versionado — só existem `UPDATE plans ... WHERE type = 'direito_digital'` em migrations (`20251216195120_...sql:3`, `20260111120000_...sql:8-13`). O `.single()` **lança erro se houver 0 ou 2+ linhas** ativas desse tipo. Precisa ser confirmado em produção (`select count(*) from plans where type='direito_digital' and is_active=true` deve retornar exatamente 1) **antes** do deploy. Mitigação já presente na proposta: o `if (planError || !planData)` cai em `navigate("/escolher-plano")`, então mesmo se a query falhar, degrada para o fallback antigo em vez de quebrar.
- Plano `geral_digital` ativo único? **Mesma situação** — não confirmável só pelo repo, mas com forte evidência indireta de que existe e é único: o UUID `a20e423f-...` já é usado hoje como `PLAN_GERAL_DIGITAL_ID` em produção sem incidentes conhecidos, e `EscolherPlano.tsx`/`Index.tsx` já fazem `.in('type', [...])` sobre ele. Confirmar do mesmo modo.
- Trigger em `plan_id`? **NÃO.** O único trigger em `student_profiles` é `on_course_update` (`supabase/migrations/20260103151557_...sql:19-23`), definido como `BEFORE INSERT OR UPDATE OF course`. Ele dispara **apenas quando a coluna `course` muda**. Um `update({ plan_id })` isolado **não toca `course`**, portanto **não aciona nenhum trigger** — o auto-assign silencioso é seguro, sem efeito colateral em `is_law_student` nem em qualquer outro campo derivado.

## 2. IMPACTO NOS OUTROS ARQUIVOS

- `cardNavigation.ts`: **PODE simplificar** — com o fallback no `Pagamento.tsx`, a linha 47-48 pode ir para `/pagamento` para ambos, pois o destino agora resolve `plan_id` nulo sozinho (sem o toast de erro que existia antes). Opcional (melhoria de UX).
- `Login.tsx`: **PODE simplificar** — mesma lógica; o bloco 107-113 pode mandar law students direto para `/pagamento`. Opcional.
- `CompleteProfile.tsx`: **PODE simplificar** — o branch de law student (linhas 520-527) pode passar a gravar `current_onboarding_step: 'payment'` e ir direto para `/pagamento`, em vez de `'choose_plan'` + `/escolher-plano`. É a mudança de maior valor (afeta todo cadastro novo), mas ainda **opcional** em termos de correção — o fallback do Pagamento cobre o caso mesmo se o step ficar `choose_plan`.

## 3. MUDANÇAS COMPLEMENTARES

| Arquivo | Prioridade | Necessária? | Risco |
|---|---|---|---|
| `src/pages/Pagamento.tsx` (fallback loadPlan) | Base | **NECESSÁRIA** (é a mudança-núcleo) | BAIXO — caminho `plan_id` existente é idêntico; fallback tem rede de segurança (`navigate('/escolher-plano')` se query falhar) |
| `src/pages/CompleteProfile.tsx` (branch law student → step `payment` + `/pagamento`) | P1 | OPCIONAL (recomendada) | BAIXO — replica o bloco `else` (528-541) trocando o tipo; elimina a passagem por `/escolher-plano` no cadastro novo |
| `src/lib/cardNavigation.ts` (linha 47-48 → `/pagamento` p/ ambos) | P2 | OPCIONAL | BAIXO — sem o fallback do Pagamento seria arriscado; com ele, seguro |
| `src/pages/Login.tsx` (linha 107-113 → `/pagamento` p/ law student) | P3 | OPCIONAL | BAIXO — idem P2 |
| `src/pages/Dashboard.tsx` (357-360, 404-405: rótulo/rota) | P4 | OPCIONAL (cosmético) | MUITO BAIXO — só rótulo "Escolher Plano"→"Pagar" e rota |
| `useOnboardingGuard.ts` / `EscolherPlano.tsx` | — | **NÃO alterar** | — mantidas como fallback; `STEP_ROUTES['choose_plan']` continua necessário p/ legados |

Observação importante: a mudança **só no `Pagamento.tsx`** já é suficiente para **não quebrar** nenhum fluxo e para transformar `plan_id` nulo em auto-resolução silenciosa. As demais (P1-P4) apenas **eliminam a passagem visual por `/escolher-plano`** — são melhoria de UX, não correção de bug.

## 4. EDGE CASES

- **Já pagou: OK.** Um law student com pagamento aprovado nunca chega ao `loadPlan` de `/pagamento` pelo fluxo normal: `goToStudentCardFlow()` verifica `hasPayment` (`src/lib/cardNavigation.ts:38`) e roteia para `/upload-documentos` ou `/carteirinha` (linhas 55-80) **antes** de qualquer lógica de plano. O `loadPlan` só roda se o usuário efetivamente abrir `/pagamento`, o que o roteamento não faz para quem já pagou.
- **Step `choose_plan`: OK.** `EscolherPlano.tsx` continua existindo e o `useOnboardingGuard` continua mapeando `choose_plan → /escolher-plano` (`useOnboardingGuard.ts:8`). Usuários legados nesse step não são afetados; e se caírem em `/pagamento`, o fallback resolve o `plan_id`.
- **Upsell físico: OK (com atenção).** O upsell reutiliza `Pagamento.tsx` via `location.state.selectedPlan` (`src/pages/Pagamento.tsx:157-169`). Nesse fluxo, o usuário **já tem pagamento digital aprovado**, logo `profile.plan_id` **já está preenchido** → o código segue o caminho `.eq("id", profile.plan_id)` (idêntico ao atual) e depois sobrescreve `name/price/is_physical` a partir de `standaloneSelectedPlan` (linhas 213-219). O fallback por tipo **não é acionado** porque `plan_id` não é nulo. Sem interferência.
- **Standalone (AdquirirFisica): OK (com ressalva teórica).** `AdquirirFisica.tsx` leva a `/checkout-fisica` (não a `/pagamento`), conforme a auditoria original (`CLAUDE.md` seção 5). Mas `Pagamento.tsx` também suporta o modo standalone via `location.state.selectedPlan.is_standalone` (linhas 168-169, 213). Nesses casos o comprador já pagou o digital antes, então `plan_id` está setado e o fallback não roda. **Ressalva teórica:** se algum dia um standalone físico for iniciado com `plan_id` nulo no perfil, o fallback derivaria o plano **digital** (`geral/direito_digital`) e o auto-assign gravaria esse `plan_id` digital no perfil — semanticamente errado. O **valor cobrado** ainda estaria correto (`cardAmountForGateway = standaloneSelectedPlan?.price ?? plan?.price`, linha 170, prioriza o preço do standalone), mas o `plan_id` persistido ficaria incoerente. Risco muito baixo (pré-condição não ocorre no fluxo real, pois standalone exige pagamento digital prévio), mas vale uma guarda: **só aplicar o fallback por tipo quando NÃO for standalone/upsell** (`if (!profile.plan_id && !isStandalonePhysical)`).

## 5. TESTES MENTAIS

| Cenário | Funciona? | Caminho |
|---|---|---|
| Law student novo, 1º acesso após CompleteProfile | SIM | `plan_id` já auto-atribuído no CompleteProfile (se P1 aplicada) → caminho `.eq("id",...)` normal. Se P1 NÃO aplicada e step=`choose_plan`, o guard levaria a `/escolher-plano`; se chegar a `/pagamento` sem plan_id, o fallback resolve `direito_digital`. |
| Law student legado sem `plan_id`, voltou ao site | SIM | Sem P2/P3, é roteado a `/escolher-plano` (fallback, funciona). Com P2/P3, vai a `/pagamento` → fallback deriva `direito_digital`, grava e cobra R$44. |
| Law student legado COM `plan_id`, voltou ao site | SIM | Caminho `.eq("id", profile.plan_id)` — idêntico ao atual. Sem P2/P3 ainda passa por `/escolher-plano` (que hoje mostra a tela — ver ressalva de downgrade da verificação anterior). |
| Geral novo, 1º acesso após CompleteProfile | SIM | `plan_id` geral já atribuído no CompleteProfile → caminho normal. Sem mudança. |
| Geral legado sem `plan_id` | POSSÍVEL, e agora tratado | Antes cairia em `toast.error` + `/escolher-plano`. Com o fallback, deriva `geral_digital`, grava e cobra R$29. Melhoria real. |
| Upsell físico após pagamento digital | SIM | `plan_id` já preenchido; fallback não roda; `name/price/is_physical` vêm de `location.state`. |
| Compra avulsa física via AdquirirFisica | SIM | Vai por `/checkout-fisica`; se passar por `Pagamento.tsx` standalone, `plan_id` já setado (pagamento digital prévio). Recomenda-se a guarda `!isStandalonePhysical` no fallback por segurança. |

## 6. RECOMENDAÇÃO FINAL

**Abordagem mínima viável:** aplicar o fallback no `Pagamento.tsx` como núcleo, com duas pequenas correções em relação ao esboço proposto:

1. **Guardar o fallback contra o fluxo standalone/upsell** — trocar a condição de derivação por `if (!profile.plan_id && !isStandalonePhysical)`, para nunca gravar um `plan_id` digital em um perfil que está comprando o físico. (Na prática o pré-requisito não ocorre, mas é barato blindar.)
2. **Manter o `navigate("/escolher-plano")` como fallback final** quando `planError || !planData` — já está no esboço e é o que garante que uma tabela `plans` mal-configurada (0 ou 2+ linhas do tipo) degrade em vez de quebrar.

**Ordem de aplicação:**
1. **Pagamento.tsx** (NECESSÁRIA) — o fallback. Sozinha, já impede qualquer quebra e cobre legados sem `plan_id`. Deploy pode parar aqui se o objetivo for só robustez.
2. **CompleteProfile.tsx** (P1, recomendada) — para que o cadastro **novo** de law student não veja mais `/escolher-plano`. É onde está o maior ganho de UX.
3. **cardNavigation.ts** e **Login.tsx** (P2/P3, opcionais) — para que law students **legados** que voltam ao site também pulem `/escolher-plano`. Seguras somente porque o passo 1 já existe.
4. **Dashboard.tsx** (P4, cosmético) — alinhar rótulo/rota.
5. **Não tocar** `EscolherPlano.tsx`, `useOnboardingGuard.ts`, `App.tsx` — permanecem como rede de segurança.

**Pré-condição de produção (bloqueante):** confirmar que `plans` tem exatamente 1 linha `is_active = true` para `direito_digital` e 1 para `geral_digital` antes do deploy. Sem isso, o `.single()` do fallback falha (mas degrada para `/escolher-plano`, não quebra).

**Risco residual:** o único ponto de atenção real é a brecha de downgrade em `EscolherPlano.tsx` (law student ainda pode escolher o plano geral se acessar a URL diretamente), herdada da verificação anterior — não é introduzida por esta mudança e continua de baixa exposição.
