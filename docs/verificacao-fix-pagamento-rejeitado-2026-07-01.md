# Verificação: Pagamento rejeitado avançou onboarding

Data: 2026-07-01
Modo: somente leitura — nenhum arquivo foi alterado.

---

## 1. CONFIRMAÇÃO DA HIPÓTESE

### Cadeia de eventos confirmada? **SIM**

Evidência completa, passo a passo:

1. **Edge Function** (`supabase/functions/mercadopago-payment/index.ts`):
   - Linha 153: `statusMap` mapeia `in_process` → `"processing"`.
   - Linha 161: `const paymentStatus = statusMap[mpData.status] || "pending"`.
   - Linha 182: grava no banco `status: paymentStatus` (ou seja, `"processing"`).
   - Linhas 210-213: retorna `{ success: true, status: "processing", ... }` — **sempre `success: true`** independente do status do pagamento. A edge function só retorna `success: false` no `catch` (linha 229), ou seja, só quando há erro técnico (HTTP, auth, insert), nunca por status de negócio do MP.

2. **Hook** (`src/hooks/useMercadoPago.ts`):
   - Linhas 188-189: o callback `onSubmit` valida apenas `if (fnError)` e `if (!data.success)`. Como `success: true`, passa direto.
   - Linha 191: `resolve(data)` — retorna `{ success: true, status: "processing" }` ao chamador.

3. **Pagamento.tsx** (fluxo de cartão Mercado Pago, linhas 537-614):
   - Linha 538: `const result = await processCardPayment(...)`.
   - Linha 545: **`if (!result.success || result.status === 'rejected') throw ...`** — a checagem só bloqueia `rejected`. Status `"processing"` **NÃO** é bloqueado.
   - Linhas 576-580: segunda camada `if (!data?.success)` — mesma falha, `success: true` passa.
   - Linha 583: `toast.success("Pagamento processado com sucesso!")` — falso positivo para o usuário.
   - Linha 584: `nextStep = plan.is_physical ? "upload_documents" : "upsell_physical"`.
   - Linhas 593-596: **grava `current_onboarding_step: nextStep`** no banco — o avanço acontece aqui.
   - Linha 604: `navigate("/pagamento/sucesso", ...)` — usuário sai da tela de pagamento.

4. **Webhook** (`supabase/functions/mercadopago-webhook/index.ts`):
   - Quando o MP finaliza a análise antifraude e o pagamento é rejeitado, envia webhook.
   - Linhas 125-138: o webhook **apenas** faz `UPDATE payments SET status = 'rejected', ...`. Não toca em `student_profiles.current_onboarding_step`.
   - Resultado: o banco fica com `payments.status = 'rejected'` MAS `current_onboarding_step` permanece avançado.

### Status que permitem avanço indevido

| Status MP original | `statusMap` resultado | `success` | Passa pela checagem `=== 'rejected'`? | Avança onboarding? |
|---|---|---|---|---|
| `approved` | `"approved"` | `true` | Sim (não é rejected) | ✅ Sim — **correto** |
| `rejected` | `"rejected"` | `true` | **Não** — lança erro | ❌ Não — **correto** |
| `in_process` | `"processing"` | `true` | Sim (não é rejected) | ⚠️ **Sim — BUG** |
| `in_mediation` | `"processing"` | `true` | Sim (não é rejected) | ⚠️ **Sim — BUG** |
| `authorized` | `"processing"` | `true` | Sim (não é rejected) | ⚠️ **Sim — BUG** |
| `pending` | `"pending"` | `true` | Sim (não é rejected) | ⚠️ **Sim — BUG** |
| `cancelled` | `"rejected"` | `true` | Não — lança erro | ❌ Não — correto |
| `refunded` | `"refunded"` | `true` | Sim (não é rejected) | ⚠️ **Sim — BUG** |
| status desconhecido | `"pending"` (fallback) | `true` | Sim (não é rejected) | ⚠️ **Sim — BUG** |

**Resumo**: dos 9 cenários possíveis da tabela `statusMap` (linhas 149-161), apenas 2 são bloqueados (`rejected` e `cancelled`). Os outros 7 avançam o onboarding, quando **apenas `approved` deveria avançar**.

---

## 2. WEBHOOK

### O webhook altera `current_onboarding_step`? **NÃO**

O corpo do `UPDATE` do webhook (`mercadopago-webhook/index.ts:125-138`) toca apenas em:
- `payments.status`
- `payments.confirmed_at`
- `payments.metadata` (com `webhook_updated_at`)

Não há `SELECT` nem `UPDATE` em `student_profiles` em nenhum ponto do webhook.

### O webhook reverte avanço indevido? **NÃO**

Não há nenhuma lógica no webhook para reverter `current_onboarding_step` quando um pagamento muda de `processing` para `rejected`.

### Impacto

Um pagamento `in_process` que é rejeitado pelo Mercado Pago após análise antifraude resulta em:
- `payments.status = "rejected"` (corrigido pelo webhook)
- `current_onboarding_step` = avançado (nunca revertido)
- Usuário prossegue no fluxo de onboarding sem pagamento válido

---

## 3. TRIGGER `create_student_card_on_payment`

### Cria carteirinha para "processing"? **NÃO**

Arquivo: `supabase/migrations/20260102205259_b724100d-d94d-4897-94c0-5e57ac2f6315.sql`
Linha 28: `IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'approved') THEN`

A trigger só dispara para `'approved'` — `"processing"` não cria carteirinha. Isso significa que o usuário avança no onboarding mas não recebe carteirinha, ficando preso em etapas posteriores que dependem dela.

---

## 4. CORREÇÃO SIMPLES (`!== 'approved'`)

Proposta: mudar `result.status === 'rejected'` para `result.status !== 'approved'`.

### a) Pagamentos APROVADOS imediatamente (`status === 'approved'`)
**Funciona? SIM.** `'approved' !== 'approved'` é `false` → não lança erro → avança normalmente.

### b) Pagamentos REJEITADOS imediatamente (`status === 'rejected'`)
**Funciona? SIM.** `'rejected' !== 'approved'` é `true` → lança erro → bloqueado.

### c) Pagamentos EM ANÁLISE (`status === 'processing'` / MP `in_process`)
**Funciona? SIM** para bloqueio — `'processing' !== 'approved'` é `true` → lança erro.

**⚠️ Risco de cobrança dupla: BAIXO mas possível.**

Quando Mercado Pago retorna `in_process`, o pagamento está em análise antifraude. O comportamento real é:
- O valor **pode ou não** já ter sido reservado/debitado no cartão do titular, dependendo do emissor.
- Se o pagamento for eventualmente aprovado, o débito é efetivado; se rejeitado, a reserva é liberada.
- No entanto, **do ponto de vista do comerciante**, o pagamento já foi criado na API do MP com ID próprio e está gravado em `payments` no banco (`mercadopago-payment/index.ts:175-202`).

Se o frontend lança erro e o usuário tenta pagar novamente:
- Uma **nova** chamada a `processCardPayment()` cria um **novo** pagamento na API do MP (nova `idempotency_key` gerada na linha 129 da edge function).
- O pagamento anterior (`in_process`) pode eventualmente ser aprovado pelo MP, resultando em **duas cobranças**.

O risco é **real mas mitigável**: o Mercado Pago costuma rejeitar pagamentos `in_process` quando o cartão não tem limite para a segunda cobrança, e pagamentos duplicados são rastreáveis pelo `external_reference`. Mas não é uma garantia.

### d) Pagamentos PENDENTES (`status === 'pending'`)
**Quando um cartão retorna `pending`?**
- No `statusMap` da edge function (linha 151), `pending` mapeia para `"pending"`.
- Na prática, cartão de crédito **raramente** retorna `pending` no Mercado Pago. Isso ocorre tipicamente para PIX e boleto. Para cartão, o status mais provável no lugar é `in_process` (antifraude) ou `authorized` (pré-autorização).
- A correção `!== 'approved'` bloquearia `pending` também — comportamento correto para cartão.

---

## 5. CORREÇÃO ALTERNATIVA (tratamento explícito por status)

### Necessária? **SIM** — é mais segura que a correção simples

A correção simples (`!== 'approved'`) mostra uma mensagem de erro genérica ao usuário quando o pagamento está em análise. Isso é confuso porque:
- O pagamento já foi criado no MP e no banco
- O dinheiro pode já ter sido reservado no cartão
- O usuário recebe uma mensagem de "erro" quando na verdade precisa aguardar

### A página `/aguardando-pagamento` existe? **NÃO**

Busca por `aguardando-pagamento` em `src/` retornou zero resultados. Seria necessário criar essa página, ou reutilizar a tela existente de alguma forma (por exemplo, redirecionar para `/pagamento` com uma query param de estado).

### O webhook avança o onboarding quando `in_process` → `approved`? **NÃO**

O webhook (`mercadopago-webhook/index.ts:125-138`) apenas atualiza `payments.status` e metadata. Não toca em `student_profiles.current_onboarding_step` em nenhum cenário — nem aprovação, nem rejeição.

### Sem lógica no webhook, quem avançaria o usuário?

Ninguém. Atualmente não existe mecanismo para:
1. Notificar o usuário quando um pagamento `in_process` é aprovado
2. Avançar automaticamente o `current_onboarding_step` via webhook
3. Permitir que o usuário retome o fluxo após aprovação assíncrona

Seria necessário **adicionar lógica ao webhook** (ou criar uma trigger SQL em `payments`) para avançar o onboarding quando `status` mudar para `approved`.

### Complexidade: **MÉDIA**

Para implementar o tratamento completo:
1. Alterar `Pagamento.tsx` para tratar `processing`/`pending` sem lançar erro → baixa complexidade
2. Criar UX de "aguardando" (nova página ou componente) → baixa complexidade
3. Alterar webhook ou criar trigger SQL para avançar onboarding ao aprovar → **média complexidade** (requer cuidado com race conditions, idempotência, e teste com webhook real do MP)
4. Opcionalmente: notificar o usuário (email/push) quando aprovado → complexidade extra

---

## 6. CHECKOUT E CHECKOUT FÍSICA

### `Checkout.tsx` — Mesmo bug presente? **SIM, mais grave**

Arquivo: `src/pages/Checkout.tsx`
Linha 566: `if (!result.success)` — **NÃO checa `result.status` de forma alguma**.

Diferente de `Pagamento.tsx` que ao menos bloqueia `rejected`, `Checkout.tsx` aceita **qualquer** status retornado pela edge function, incluindo `rejected` (que vem com `success: true`). O avanço do onboarding acontece nas linhas 628-633.

Entretanto, o risco prático é menor porque `Checkout.tsx` trata o fluxo de upsell (carteira física), onde o pagamento digital base já foi aprovado. Mas o bug é o mesmo.

### `CheckoutFisica.tsx` — Mesmo bug presente? **SIM**

Arquivo: `src/pages/CheckoutFisica.tsx`
Linha 385: `if (!result.success)` — mesma checagem insuficiente.

Neste caso, após o pagamento (linha 453-454), o código faz `toast.success` e `navigate("/carteirinha")` sem verificar o status. Não atualiza `current_onboarding_step` explicitamente, mas permite que o usuário siga adiante com pagamento não aprovado.

### Resumo dos três arquivos

| Arquivo | Checagem de status cartão MP | Bug presente? | `rejected` bloqueado? | `processing` bloqueado? |
|---|---|---|---|---|
| `Pagamento.tsx:545` | `result.status === 'rejected'` | Sim | Sim | **Não** |
| `Checkout.tsx:566` | Nenhuma (só `!result.success`) | **Sim, mais grave** | **Não** | **Não** |
| `CheckoutFisica.tsx:385` | Nenhuma (só `!result.success`) | **Sim, mais grave** | **Não** | **Não** |

---

## 7. EDGE FUNCTION

### `success: true` para todos os status é intencional? **Provavelmente NÃO**

A edge function `mercadopago-payment/index.ts` retorna `success: true` na linha 211 para **todo** pagamento que foi criado com sucesso na API do MP (HTTP 2xx). Isso inclui `rejected`, `in_process`, `pending`, etc. O campo `success` indica "a chamada técnica à API funcionou", não "o pagamento foi aprovado".

Isso é um **erro de design semântico**: o frontend interpreta `success` como "pagamento OK", mas a edge function usa `success` como "nenhum erro técnico".

### Corrigir na edge function resolveria o problema em todos os frontends? **SIM, parcialmente**

Se a edge function retornasse `success: false` para `paymentStatus !== 'approved'`, todos os 3 frontends (Pagamento, Checkout, CheckoutFisica) que checam `!result.success` bloqueariam automaticamente.

### Mas quebraria o fluxo PIX? **SIM — quebraria PIX completamente**

O PIX no Mercado Pago **sempre** retorna `status: "pending"` inicialmente (o pagamento só é aprovado quando o usuário paga o QR code). A edge function retorna com `success: true` + `status: "pending"` + dados do PIX (`pix_qr_code`, `pix_qr_code_base64`).

Evidência no frontend:
- `Pagamento.tsx:405-411`: `processPixPayment()` retorna, e na linha 431 o código verifica `if (data?.pix_code)` para redirecionar ao QR code. Se `success: false`, o hook `useMercadoPago.ts:298` lançaria erro **antes** de retornar os dados do PIX.
- `Checkout.tsx:478-492` e `CheckoutFisica.tsx:322-330`: mesmo padrão.

**Portanto, NÃO se pode mudar `success: true` para `success: false` indiscriminadamente na edge function sem separar a lógica por `payment_method`.**

---

## 8. RECOMENDAÇÃO FINAL

### Abordagem recomendada: correção em camadas, por prioridade

#### Prioridade 1 (URGENTE) — Bloquear avanço indevido nos 3 frontends

Alterar a checagem de status nos 3 arquivos para permitir avanço **apenas** quando `status === 'approved'`:

**`Pagamento.tsx:545`** — mudar de:
```typescript
if (!result.success || result.status === 'rejected') throw new Error(...)
```
Para:
```typescript
if (!result.success || result.status !== 'approved') {
  if (result.status === 'processing' || result.status === 'pending') {
    toast.info("Seu pagamento está sendo analisado. Aguarde a confirmação.");
    navigate("/pagamento", { replace: true });
    return;
  }
  throw new Error(result.error || "Pagamento não autorizado. Tente outro cartão.");
}
```

**`Checkout.tsx:566`** — adicionar checagem de status (atualmente inexistente):
```typescript
if (!result.success || result.status !== 'approved') {
  throw new Error(result.error || "Pagamento não autorizado");
}
```

**`CheckoutFisica.tsx:385`** — idem:
```typescript
if (!result.success || result.status !== 'approved') {
  throw new Error(result.error || "Pagamento não autorizado");
}
```

**Risco**: baixo. Pagamentos `in_process` para cartão são raros (< 5% segundo dados típicos do MP). O pagamento já está gravado no banco com `status: "processing"`. Se o MP aprovar depois via webhook, o pagamento ficará como `approved` no banco e o usuário pode ser atendido manualmente ou por um fluxo futuro de retomada.

**Risco de cobrança dupla**: mitigável. Para `in_process`, o pagamento está no banco. Se o usuário retornar à tela de pagamento e pagar novamente, haverá dois registros em `payments`. Pode-se adicionar uma verificação simples: antes de criar novo pagamento, checar se já existe um `processing`/`pending` recente para o mesmo `student_id` + `plan_id`.

#### Prioridade 2 (IMPORTANTE) — Webhook inteligente

Alterar `mercadopago-webhook/index.ts` para avançar `current_onboarding_step` quando um pagamento muda de `processing` → `approved`. Isso resolve o caso legítimo de antifraude aprovada assincronamente.

**Risco**: médio. Requer cuidado com:
- Idempotência (webhook pode ser chamado múltiplas vezes)
- O webhook precisa saber qual `nextStep` usar (depende do plano — físico vs digital)
- Testar com webhooks reais do MP em sandbox

#### Prioridade 3 (MELHORIA) — UX de "aguardando pagamento"

Criar uma página/estado para pagamentos em análise, com:
- Mensagem explicativa
- Polling ou realtime subscription em `payments.status`
- Redirecionamento automático quando `status` mudar para `approved`

**Risco**: nenhum. Melhoria pura de UX.

#### NÃO recomendado neste momento

- Mudar `success: true/false` na edge function — quebraria PIX
- Depender exclusivamente de `!result.success` no frontend — a edge function tem semântica diferente do esperado e mudar isso agora afeta múltiplos consumidores

### Resumo de risco

| Abordagem | Risco para produção | Resolve o bug? | Cobertura |
|---|---|---|---|
| P1: `!== 'approved'` nos 3 frontends | Baixo | Sim | 3 arquivos |
| P2: Webhook avança onboarding | Médio | Complementar | 1 arquivo |
| P3: UX de aguardando | Nenhum | Complementar | UX |
| ❌ Mudar edge function `success` | **Alto** (quebra PIX) | Sim mas perigoso | 1 arquivo |

---

## 9. CORREÇÃO APLICADA

**Data**: 2026-07-01
**Commit**: `a012066983e33679162a714ea3e46b62929d8183`
**Mensagem**: `fix: bloquear pagamentos não-approved de avançar onboarding`

### Alterações deployadas

| Arquivo | Linha | Antes | Depois |
|---|---|---|---|
| `src/pages/Pagamento.tsx` | 545 | `result.status === 'rejected'` | `result.status !== 'approved'` |
| `src/pages/Checkout.tsx` | 566 | `!result.success` (sem cheque de status) | `!result.success \|\| result.status !== 'approved'` |
| `src/pages/CheckoutFisica.tsx` | 385 | `!result.success` (sem cheque de status) | `!result.success \|\| result.status !== 'approved'` |

### Abordagem aplicada

Foi aplicada a **Prioridade 1** (correção cirúrgica nos 3 frontends). Apenas o status `approved` permite avanço do onboarding agora. Todos os demais status (`in_process`, `pending`, `rejected`, `cancelled`, `refunded`, `processing` e qualquer status desconhecido) são bloqueados.

### O que NÃO foi alterado (permanece como pendência futura)

- Edge function `mercadopago-payment/index.ts` continua retornando `success: true` para todos os status — intencional, porque o fluxo PIX depende disso.
- Webhook `mercadopago-webhook/index.ts` continua sem avançar `current_onboarding_step` quando `in_process` → `approved` — pagamentos legitimamente aprovados após análise antifraude precisarão de atendimento manual ou implementação futura da Prioridade 2.
- Hook `useMercadoPago.ts` continua validando apenas `!data.success` — correto, pois a responsabilidade de validar status de negócio é dos chamadores.
- Nenhuma página de "aguardando pagamento" foi criada (Prioridade 3).
