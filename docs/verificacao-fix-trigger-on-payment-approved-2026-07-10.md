# Verificação: Bug de cast UUID na trigger on_payment_approved()

Data: 2026-07-10
Modo: SOMENTE LEITURA (nenhum arquivo alterado)

> ⚠️ **ACHADO CENTRAL — LEIA ANTES DE TUDO:**
> A função `on_payment_approved()` que aparece no erro de produção **NÃO EXISTE no repositório**.
> Uma busca exaustiva (`grep on_payment_approved` em migrations, functions, docs e código) retornou
> **zero** ocorrências além de menções em prosa. Ou seja: a função que falhou foi **criada
> diretamente no banco (SQL Editor)** e **nunca foi versionada**. Não há como "mostrar a função
> completa" a partir do repositório — só é possível reconstruí-la a partir da mensagem de erro.
>
> A função versionada equivalente é `create_student_card_on_payment()`, e ela **já contém o cast
> `::UUID` correto** ([migration 20260102205259:37](supabase/migrations/20260102205259_b724100d-d94d-4897-94c0-5e57ac2f6315.sql#L37)).
> **O bug não está no código versionado.** Isso é drift de produção — trate como tal.

---

## 1. TRIGGER on_payment_approved

- **Arquivo/migration**: **não localizada.** `on_payment_approved()` não está em `supabase/migrations/`,
  `supabase/functions/`, `docs/schema.sql` nem em nenhum arquivo do repositório.
- **Attached em**: desconhecido pelo repositório. **Não há NENHUM `CREATE TRIGGER ... ON payments`
  versionado** — todos os `CREATE TRIGGER` do repo são em `documents` ou `student_profiles`
  (verificado: `on_document_approved`, `documents_validation_trigger`, `documents_face_comparison_trigger`,
  `documents_profile_photo_trigger`, `on_document_approved_compare_faces`, `on_course_update`).
  O binding do trigger de `payments` também é drift não versionado.
- **Função completa**: **indisponível no repo.** Reconstrução a partir do erro (linha 27 = o UPDATE):

  ```sql
  -- RECONSTRUÇÃO PARCIAL (a partir da mensagem de erro — NÃO é o fonte real)
  CREATE OR REPLACE FUNCTION on_payment_approved()
  RETURNS trigger AS $$
  DECLARE
    v_original_payment_id text;   -- ->> retorna TEXT
    -- ... (demais declarações desconhecidas)
  BEGIN
    -- ...
    v_original_payment_id := NEW.metadata->>'original_payment_id';   -- TEXT, sem cast
    -- linha 27 (a que falhou):
    UPDATE student_cards
      SET is_physical = true, updated_at = NOW()
      WHERE payment_id = v_original_payment_id   -- ❌ uuid = text
        AND is_physical = false;
    -- ... (resto desconhecido)
  END;
  $$ LANGUAGE plpgsql;
  ```

  Note as **diferenças em relação à função versionada** `create_student_card_on_payment()`:
  1. usa **variável** `v_original_payment_id` (a versionada faz inline `(NEW.metadata->>'...')::UUID`);
  2. **não tem cast** `::uuid` (a versionada tem);
  3. tem cláusula extra **`AND is_physical = false`** (a versionada não tem);
  4. nome diferente.

  → São **funções distintas**. `on_payment_approved()` é uma variante paralela introduzida fora do versionamento.

- **Outras triggers na tabela payments**: não determinável pelo repositório (binding não versionado).
  **É obrigatório inspecionar o banco** (ver query na seção 4) — pode haver `on_payment_approved` E
  o trigger de `create_student_card_on_payment` coexistindo.

---

## 2. BUG

- **Linha do erro**: 27 (o `UPDATE student_cards ... WHERE payment_id = v_original_payment_id`).
- **Variável**: `v_original_payment_id` — tipo **TEXT** (resultado de `metadata->>'original_payment_id'`; o operador `->>` sempre retorna `text`).
- **Coluna**: `student_cards.payment_id` — tipo **UUID**.
- **Erro**: `operator does not exist: uuid = text` (Postgres não faz coerção implícita uuid↔text).
- **Correção mínima**: `WHERE payment_id = v_original_payment_id::uuid` (ou castar na atribuição:
  `v_original_payment_id uuid := (NEW.metadata->>'original_payment_id')::uuid;`).
  - **Seguro?** SIM, **desde que** `original_payment_id` no metadata seja sempre um UUID válido em string.
    Se algum registro tiver esse campo ausente/inválido, o `::uuid` lança `invalid input syntax for type uuid`.
    Como o campo é gravado pelo frontend/edge a partir de um id real ([CheckoutFisica.tsx:315](src/pages/CheckoutFisica.tsx#L315),
    [Checkout.tsx:483](src/pages/Checkout.tsx#L483)), no caminho normal é válido. Para robustez extra,
    o UPDATE só roda quando `is_upsell = true`, então `original_payment_id` deveria existir.
- **Outros pontos com o mesmo bug**: **não determinável** sem o corpo real da função. A reconstrução
  só expõe a linha 27. **Ao aplicar o fix, revise TODO o corpo real** (via `pg_get_functiondef`, seção 7)
  procurando qualquer outra comparação `= NEW.metadata->>'...'` contra colunas UUID (ex.: `student_id`,
  `plan_id`, `payment_id`). Na função versionada, os demais usos de UUID vêm de `NEW.id`/`NEW.student_id`
  (já UUID, sem cast necessário) — mas não se pode assumir que a variante não versionada é idêntica.

---

## 3. RELAÇÃO COM create_student_card_on_payment

- **Ambas disparam no mesmo evento?**: **provável, mas não confirmável pelo repo.** A versionada
  `create_student_card_on_payment()` é documentada como `AFTER UPDATE em payments` quando status→approved
  ([triggers-rpcs.md:50-54](docs/triggers-rpcs.md#L50)). Se `on_payment_approved()` também está ligada a
  `AFTER UPDATE ON payments`, **as duas rodam no mesmo UPDATE**.
- **Ordem de execução**: se forem dois triggers `AFTER UPDATE` na mesma tabela, o Postgres os executa em
  **ordem alfabética pelo nome do trigger** (não da função). Sem saber os nomes dos triggers em produção,
  a ordem é indeterminada aqui.
- **Conflito possível?**: para **upsell**, ambas fazem a MESMA coisa (só `UPDATE ... SET is_physical = true`).
  Redundante, mas não gera carteira duplicada. Para **não-upsell**, a versionada faz `INSERT ... ON CONFLICT
  (payment_id) DO NOTHING` — se `on_payment_approved` também inserir, o `ON CONFLICT` protege contra duplicata
  **apenas se ambas usarem o mesmo `payment_id` e o mesmo guard**. **Risco real** se a variante não versionada
  tiver lógica divergente. Precisa inspeção do corpo real.
- **Mesmo bug de cast?**: **NÃO** na versionada — `create_student_card_on_payment()` usa
  `(NEW.metadata->>'original_payment_id')::UUID` **com** cast ([:37](supabase/migrations/20260102205259_b724100d-d94d-4897-94c0-5e57ac2f6315.sql#L37),
  [:108](supabase/migrations/20251228151731_168f8938-fcef-4b96-b6fd-7e1fd606b910.sql#L108)). O bug é
  **exclusivo** da função não versionada `on_payment_approved()`.

---

## 4. COMO APLICAR

- **CREATE OR REPLACE suficiente?**: SIM para o corpo da função — `CREATE OR REPLACE FUNCTION` substitui
  a definição **sem** dropar/recriar o trigger, pois o trigger referencia a função pelo nome. **MAS**: só é
  seguro se você usar o **corpo REAL atual** (via `pg_get_functiondef`) e mudar apenas o cast — reconstruir
  "de cabeça" a partir do erro **apagaria** qualquer lógica que não conhecemos.
- **Efeito imediato?**: SIM — assim que o `CREATE OR REPLACE` roda, o próximo UPDATE usa a versão corrigida.
- **Migration necessária?**: para consertar produção **agora**, pode aplicar direto no SQL Editor. **Porém**,
  como isso é drift, é **fortemente recomendado** também: (a) versionar a função corrigida numa migration
  para o repo parar de divergir; e (b) decidir se `on_payment_approved()` deve **existir** ou ser
  **removida** em favor da versionada `create_student_card_on_payment()` (evitar duas triggers fazendo a
  mesma coisa).

**Antes de qualquer coisa, rode no banco para ver a verdade:**

```sql
-- 1) Corpo REAL da função que falhou
SELECT pg_get_functiondef('public.on_payment_approved()'::regprocedure);

-- 2) TODAS as triggers ligadas a payments (nome, função, timing, evento)
SELECT tgname,
       pg_get_triggerdef(t.oid) AS def,
       p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c   ON c.oid = t.tgrelid
JOIN pg_proc  p   ON p.oid = t.tgfoid
WHERE c.relname = 'payments' AND NOT t.tgisinternal;
```

---

## 5. SEQUÊNCIA PÓS-FIX

Ao re-rodar `UPDATE payments SET status = 'approved'` para este upsell (assumindo a correção `::uuid`
aplicada e que `on_payment_approved` é a trigger ativa no upsell):

1. `payments.status` muda `pending → approved` → dispara trigger(s) `AFTER UPDATE`.
2. `on_payment_approved()` (corrigida): `v_is_upsell`/branch de upsell → `UPDATE student_cards SET
   is_physical = true WHERE payment_id = original_payment_id::uuid AND is_physical = false`.
3. Se `create_student_card_on_payment()` também estiver ligada: para upsell (`is_upsell = true`) ela faz
   o mesmo `UPDATE ... is_physical = true` e `RETURN NEW` (não cria carteira nova).
4. **Resultado final esperado**: a carteira digital original (payment_id
   `316eb8c1-12fe-418b-92b2-aca1e73b6301`) passa a `is_physical = true`; **nenhuma** carteira nova é criada.

- **Confirmar (5b)**: é preciso verificar no banco que existe `student_cards` com
  `payment_id = '316eb8c1-12fe-418b-92b2-aca1e73b6301'`. Se **não** existir, o UPDATE afeta 0 linhas
  (silenciosamente) e a física não é marcada — nesse caso o problema é outro (carteira original ausente),
  não o cast:
  ```sql
  SELECT id, student_id, is_physical, status
  FROM student_cards
  WHERE payment_id = '316eb8c1-12fe-418b-92b2-aca1e73b6301';
  ```
- **Duplicata (5c)**: o pagamento de upsell **tem** `metadata.is_upsell` (gravado pelo fluxo de upsell —
  [useMercadoPago.ts:183](src/hooks/useMercadoPago.ts#L183), [Checkout.tsx](src/pages/Checkout.tsx)). Enquanto
  esse guard `is_upsell = true` estiver presente, **nenhuma carteira nova é inserida** — só o UPDATE de
  `is_physical`. Confirme que o metadata deste pagamento realmente contém `"is_upsell": true`
  (senão a função cai no branch de INSERT e cria carteira indevida):
  ```sql
  SELECT id, status, metadata->>'is_upsell' AS is_upsell,
         metadata->>'original_payment_id' AS original_payment_id
  FROM payments WHERE status = 'pending' AND metadata->>'is_upsell' = 'true';
  ```

---

## 6. SISTEMÁTICO

- **Afeta todos os upsells físicos?**: **SIM**, se `on_payment_approved()` (com o bug) for a trigger que
  processa o approve de upsell em produção. O cast falta na comparação `payment_id = v_original_payment_id`,
  então **qualquer** upsell cujo approve passe por essa função falharia com o mesmo `uuid = text` — a
  transação inteira aborta e o status **permanece `pending`**. Não é específico deste registro.
- **Por que só apareceu agora?**: provavelmente porque approves de upsell antes vinham por outro caminho
  (ex.: webhook usando a função versionada com cast), ou porque este é um approve manual via SQL. A função
  versionada nunca teve o bug — então o problema surge exatamente quando o approve passa pela variante
  não versionada.
- **Outros pendentes**: verificar em produção com a query da seção 5c (upsells `pending` com `is_upsell=true`).
  Todos que estiverem `pending` por causa desse erro precisarão ser re-aprovados **após** o fix.

---

## 7. SQL DE CORREÇÃO

> ⚠️ **NÃO aplique a reconstrução abaixo às cegas.** Primeiro rode
> `SELECT pg_get_functiondef('public.on_payment_approved()'::regprocedure);`, copie o corpo REAL e altere
> **apenas** o ponto do cast. A versão abaixo é uma reconstrução mínima a partir do erro e pode omitir
> lógica existente.

**Opção A — corrigir só o cast (recomendada; baseie no corpo real):**
```sql
-- Pegue o corpo atual com pg_get_functiondef e troque a linha do UPDATE por:
--   WHERE payment_id = v_original_payment_id::uuid
--     AND is_physical = false;
-- Mantenha TODO o resto idêntico ao corpo real.
CREATE OR REPLACE FUNCTION public.on_payment_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_original_payment_id text;
  -- (demais DECLAREs conforme o corpo REAL)
BEGIN
  -- (guards conforme o corpo REAL, ex.: IF NEW.status = 'approved' ... / IF is_upsell ...)
  v_original_payment_id := NEW.metadata->>'original_payment_id';

  UPDATE student_cards
     SET is_physical = true, updated_at = NOW()
   WHERE payment_id = v_original_payment_id::uuid   -- ✅ cast adicionado
     AND is_physical = false;

  RETURN NEW;
END;
$$;
```

**Opção B — mais robusta (cast na atribuição, tolera ausência):**
```sql
-- Dentro do corpo real, declare já como uuid:
--   v_original_payment_id uuid := (NEW.metadata->>'original_payment_id')::uuid;
-- e use  WHERE payment_id = v_original_payment_id ...
```

**Opção C (arquitetural) — eliminar o drift**: considerar **remover** `on_payment_approved()` e o trigger
que a chama, deixando apenas a versionada `create_student_card_on_payment()` (que já trata upsell com cast
correto e tem `ON CONFLICT`), evitando duas triggers concorrentes. Requer confirmar, via query da seção 4,
qual trigger está de fato ligada a `payments` hoje.

---

## Resumo executivo

- O erro **não vem do código versionado** — vem de `on_payment_approved()`, função **criada fora do
  versionamento** que **não existe no repo**. A versionada `create_student_card_on_payment()` já tem o
  cast `::UUID` correto e **não** tem esse bug.
- O fix é adicionar `::uuid` na comparação da linha 27 — porém **obtenha o corpo real via
  `pg_get_functiondef` antes**, pois não temos a definição completa e um CREATE OR REPLACE reconstruído
  poderia apagar lógica.
- Confirme no banco: (a) quais triggers estão ligadas a `payments`; (b) que existe `student_cards` com o
  `original_payment_id`; (c) que o pagamento pendente tem `is_upsell = true`.
- É sistemático: todo upsell cujo approve passe por essa função quebra igual. Pós-fix, re-aprovar os
  pendentes.
- Higienizar o drift: versionar a correção em migration e decidir entre manter `on_payment_approved` ou
  consolidar em `create_student_card_on_payment`.

### Anexo — mapa de arquivos
| Item | Local |
|---|---|
| `create_student_card_on_payment()` (versionada, COM cast) | [20260102205259:16-82](supabase/migrations/20260102205259_b724100d-d94d-4897-94c0-5e57ac2f6315.sql#L16), [20251228151731:2-68](supabase/migrations/20251228151731_168f8938-fcef-4b96-b6fd-7e1fd606b910.sql#L2) |
| Cast `::UUID` correto (referência) | [20260102205259:37](supabase/migrations/20260102205259_b724100d-d94d-4897-94c0-5e57ac2f6315.sql#L37) |
| `on_payment_approved()` | **não existe no repositório** (drift de produção) |
| `CREATE TRIGGER ... ON payments` | **não existe no repositório** (drift de produção) |
| metadata `original_payment_id` (origem) | [CheckoutFisica.tsx:315](src/pages/CheckoutFisica.tsx#L315), [Checkout.tsx:483](src/pages/Checkout.tsx#L483) |
| Doc da trigger versionada | [docs/triggers-rpcs.md:50-75](docs/triggers-rpcs.md#L50) |
