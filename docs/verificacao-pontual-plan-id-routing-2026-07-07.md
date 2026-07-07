# Verificação pontual: roteamento por `plan_id` ao remover escolha de plano

Data: 2026-07-07
Modo: leitura factual apenas. Nenhum arquivo de código foi alterado.

## 1. cardNavigation.ts

- Trocar para `/pagamento` direto (remover o `if/else` das linhas 47-51): **ARRISCADO — mas o dano é degradação de UX, não quebra funcional.**
- Motivo:
  - `goToStudentCardFlow()` (`src/lib/cardNavigation.ts:12-16`) faz `select("id, profile_completed, is_law_student, education_level, manual_review_requested, face_validated, terms_accepted")` — **não inclui `plan_id`**. Portanto, este arquivo hoje não tem como saber se o law student já tem plano atribuído.
  - Se mandar todos para `/pagamento` sem garantir `plan_id`: um law student **que passou pelo `CompleteProfile` alterado** (com auto-assign) terá `plan_id` no perfil → `Pagamento.tsx` carrega normalmente ✅.
  - Mas um law student **legado / com fluxo interrompido** (perfil completo, sem pagamento, `plan_id IS NULL`) chega em `/pagamento`, que detecta `plan_id` nulo e faz `toast.error("Nenhum plano selecionado")` + `navigate("/escolher-plano")` (`src/pages/Pagamento.tsx:189-193`). Ou seja: **volta exatamente para a tela que queremos evitar**, agora com um flash de toast de erro no caminho. Não trava, mas é pior UX do que ir direto para `/escolher-plano`.
  - Conclusão: a Opção A isolada (só trocar a rota) não é a mais segura. Ver seção 5.

## 2. Login.tsx

- `plan_id` no select do perfil? **NÃO.** `src/pages/Login.tsx:68-72` faz `select('id, profile_completed, is_law_student, education_level, manual_review_requested, face_validated, terms_accepted')` — mesmo conjunto de campos de `cardNavigation.ts`, sem `plan_id`.
- Auto-assign necessário? **SIM, para cobrir legados com segurança.** Sem auto-assign (ou sem confirmar `plan_id`), o mesmo problema da seção 1 se aplica: law student legado sem `plan_id` iria para `/pagamento` → erro → bounce de volta para `/escolher-plano`. Para a mudança ser "direto ao pagamento" de verdade (e não um desvio disfarçado), o `plan_id` precisa ser garantido aqui também. Isso exige adicionar `plan_id` ao select (linha 70) e a lógica de resolução/gravação do plano de Direito quando nulo.

## 3. EscolherPlano.tsx com plan_id existente

- Detecta `plan_id` e pula direto para `/pagamento`? **Só para NÃO-law students. Para law students: NÃO.**
  - O único ponto que checa `plan_id` e redireciona (`src/pages/EscolherPlano.tsx:98-112`) está dentro de `if (!profile.is_law_student)`. Para não-Direito, se `plan_id` já existe, ele nem regrava — apenas `navigate('/pagamento')`.
  - Para law student (`is_law_student = true`), a execução **cai fora desse bloco** e segue para carregar os planos (linhas 114-165) e renderizar a tela de escolha, **ignorando completamente se já existe `plan_id`**.
- Permite trocar de plano? **SIM.** A tela mostra os cards `geral_digital` e `direito_digital` (montados em `digitalPlansConfig`, linhas 19-49) e `handleSelectPlan` (linhas 175-209) sobrescreve `student_profiles.plan_id` com qualquer opção escolhida. Ou seja, hoje um law student com `plan_id = direito_digital` já gravado ainda pode **rebaixar** para o plano geral nessa tela. Isso é justamente o comportamento que a mudança de negócio quer eliminar.
  - Implicação: enquanto `EscolherPlano.tsx` for mantida como fallback **sem alteração**, ela continua sendo uma porta pela qual um law student pode escolher o plano geral (mais barato). Se o objetivo de negócio é forçar law students ao plano de Direito, manter a página como fallback puro **não fecha essa brecha** — mas na prática ela só é alcançável por bounce de erro ou acesso direto à URL, não pelo fluxo normal.

## 4. Pagamento.tsx com plan_id null

- Como carrega o plano: `src/pages/Pagamento.tsx:183-205` — `select("plan_id, ...")` de `student_profiles`, depois busca a linha em `plans` por `id = profile.plan_id`.
- Comportamento com `plan_id` null: bloco `if (profileError || !profile?.plan_id)` em `src/pages/Pagamento.tsx:189-193` → `toast.error("Nenhum plano selecionado")` seguido de `navigate("/escolher-plano")`. **Não é loader infinito nem tela de erro terminal** — é um redirect com toast.
- UX aceitável como fallback? **Aceitável como rede de segurança de último recurso, NÃO como caminho esperado.** Um toast de erro vermelho seguido de redirect é ruído para o usuário; tolerável se raríssimo (bug/estado corrompido), mas inaceitável se for o caminho normal de todo law student legado. Por isso o `plan_id` deve ser garantido *antes* de chegar aqui.

## 5. RECOMENDAÇÃO

- **Opção B (auto-assign inline), com uma nuance de implementação.**
- Justificativa:
  - A Opção A (mandar todos para `/pagamento` e "confiar que Pagamento.tsx lida com null") na prática transforma o fallback de erro em caminho normal para todo law student legado sem `plan_id`: eles veriam `toast.error("Nenhum plano selecionado")` e seriam jogados de volta para `/escolher-plano` — o oposto do objetivo. O `Pagamento.tsx` "lida" com null, mas lidando = bounce para a tela que queremos remover.
  - A Opção B garante que, ao chegar em `/pagamento`, o `plan_id` de Direito já está no perfil, então o carregamento é limpo e sem toast de erro. Cobre tanto o cadastro novo quanto o legado.
  - Nuance para não espalhar a query em 3 arquivos: `cardNavigation.ts` e `Login.tsx` hoje **não fazem SELECT em `plans`**, e replicar a lógica de resolução em três lugares (`CompleteProfile.tsx`, `cardNavigation.ts`, `Login.tsx`) cria drift. Recomendo **extrair uma função utilitária única** (ex.: `ensureLawPlanAssigned(profile)` em um helper), que: (1) recebe/carrega `plan_id` e `is_law_student`; (2) se law student e `plan_id` nulo, resolve o `id` do tipo `direito_digital` via query dinâmica (`from('plans').select('id').eq('type','direito_digital').eq('is_active',true).single()` — conforme decidido na verificação anterior, sem hardcode) e grava em `student_profiles`; (3) retorna. Chamar essa função nos três pontos antes de rotear para `/pagamento`.
  - Ajustes de select necessários: adicionar `plan_id` ao `select` em `Login.tsx:70` e em `cardNavigation.ts:14` para que a função possa checar sem um round-trip extra.
- Riscos residuais:
  1. **Brecha do downgrade em `EscolherPlano.tsx`** (seção 3): mantida como fallback sem alteração, ela ainda permite a um law student escolher o plano geral se acessar `/escolher-plano` diretamente. Baixo risco de exposição (não está no fluxo feliz), mas é uma inconsistência com a regra de negócio nova. Se isso for inaceitável, `EscolherPlano.tsx` precisaria de um guard extra (redirecionar law student com `plan_id` já definido direto para `/pagamento`) — fora do escopo mínimo desta mudança.
  2. **Dependência da query dinâmica**: se não existir exatamente 1 linha `is_active = true` com `type = 'direito_digital'` em produção, a resolução falha. Precisa ser confirmado em produção antes do deploy (a auditoria anterior já registrou que o seed de `plans` não é versionado). Mitigação: em caso de falha da query, cair no fallback atual (`navigate('/escolher-plano')`) em vez de gravar um `plan_id` inválido.
  3. **Concorrência de gravação**: os três pontos podem tentar gravar `plan_id` — mas como a gravação é idempotente (só grava se nulo, sempre o mesmo `id` por `type`), não há risco de estado inconsistente.
