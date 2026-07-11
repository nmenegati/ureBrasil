# Verificação: Meta Conversions API Server-Side no Webhook

Data: 2026-07-11
Modo: SOMENTE LEITURA (nenhum arquivo alterado)
Arquivo-alvo: `supabase/functions/mercadopago-webhook/index.ts`

> Objetivo: disparar `Purchase` server-side (Meta CAPI) no webhook quando o pagamento vira
> `approved`, capturando conversões de PIX mesmo quando o browser não está aberto (causa raiz
> documentada em `docs/verificacao-fbq-nao-dispara-2026-07-10.md`).

---

## 1. WEBHOOK ATUAL

- **Ponto de aprovação**: o status é calculado em [:104](supabase/functions/mercadopago-webhook/index.ts#L104) (`newStatus = statusMap[mpData.status]`) e persistido no `UPDATE`
  em [:125-138](supabase/functions/mercadopago-webhook/index.ts#L125) (`confirmed_at` setado quando `approved`, [:129](supabase/functions/mercadopago-webhook/index.ts#L129)). **O disparo Meta deve entrar
  logo após esse UPDATE ter sucesso, dentro do bloco `try` (linha ~142), antes do `return "ok"` em [:144](supabase/functions/mercadopago-webhook/index.ts#L144).**
- **Dados disponíveis nesse momento**:
  - Da API do MP (`mpData`, [:83](supabase/functions/mercadopago-webhook/index.ts#L83)): `mpData.status`, `mpData.transaction_amount` (valor), `mpData.id`, possivelmente `mpData.external_reference` e `mpData.payer.email`.
  - Do banco: o SELECT atual ([:112-117](supabase/functions/mercadopago-webhook/index.ts#L112)) busca **apenas `metadata`** — **NÃO** traz `student_id`, `amount`, `plan_id` nem o `id` interno.
- **SELECT adicional necessário: SIM.** Para o evento Meta preciso de `payments.id` (para dedup),
  `student_id`, `amount`, `metadata`. O ideal é **estender o SELECT já existente** ([:113-117](supabase/functions/mercadopago-webhook/index.ts#L113)) de
  `select("metadata")` para `select("id, student_id, amount, metadata")` — sem custo de round-trip extra.
- **Chamada HTTP externa já existe?**: SIM — o webhook já faz `fetch` para a API do MP ([:79](supabase/functions/mercadopago-webhook/index.ts#L79)).
  Há padrão de `fetch` e de `crypto.subtle` (HMAC, [:48-55](supabase/functions/mercadopago-webhook/index.ts#L48)) para reaproveitar.

---

## 2. META CONVERSIONS API

- **Pixel ID**: `982937931195255` (de `index.html:35`, `fbq('init', ...)`; também no noscript `:95`).
  É público — pode ser hardcoded ou vir de secret. Recomendo secret/env para consistência.
- **Secrets existentes do Meta**: **NÃO.** Grep por `META_/FACEBOOK_/FB_/facebook` em `supabase/functions/`
  retornou **zero**. Só há menções no frontend (`index.html`, `Index.tsx` — link do rodapé) e em docs.
  É preciso criar `META_ACCESS_TOKEN` (System User token do Events Manager).
- **Hashing SHA-256 em Deno**: **SIM, nativo.** `crypto.subtle.digest('SHA-256', ...)` está disponível e
  o webhook **já usa** `crypto.subtle` para o HMAC ([:48-58](supabase/functions/mercadopago-webhook/index.ts#L48)). Não precisa de lib externa. O CAPI exige os
  campos de PII (`em`, `ph`, `fn`, `ln`, `external_id`) como **SHA-256 hex, minúsculo, com trim/normalização**.
- **Endpoint**: `POST https://graph.facebook.com/v19.0/982937931195255/events?access_token=<TOKEN>`.

---

## 3. DADOS DO ESTUDANTE

- **`student_profiles` NÃO tem coluna `email`** (campos: `full_name`, `phone`, `cpf`, `user_id`, endereço —
  `types.ts:430-460`). **O email vive em `auth.users`.** Para `user_data.em` é preciso
  `supabase.auth.admin.getUserById(profile.user_id)` (o webhook já usa a service role key, [:107-110](supabase/functions/mercadopago-webhook/index.ts#L107)).
- **Query adicional recomendada** (após ter `student_id` do payment):
  ```sql
  SELECT full_name, phone, user_id
  FROM student_profiles
  WHERE id = <student_id>;
  ```
  e, para o email: `auth.admin.getUserById(user_id)` → `user.email`.
- **Reaproveitar SELECT existente?**: parcialmente — estender o SELECT de payments para trazer `student_id`;
  depois 1 SELECT em `student_profiles` + 1 `getUserById`. São 2 chamadas extras, aceitáveis (só quando `approved`).
- **Campos mínimos viáveis**: mesmo sem email, o CAPI aceita o evento com `ph` (telefone) + `external_id`
  (hash do `user_id`) + `country`. Email melhora o match quality, mas não é obrigatório. `terms_ip_address`
  (`student_profiles`) existe mas é o IP do aceite de termos, não do pagamento — uso opcional/discutível.

---

## 4. INSERÇÃO NO WEBHOOK

- **Ponto de inserção**: dentro do `try`, **após** o `UPDATE` de [:125-138](supabase/functions/mercadopago-webhook/index.ts#L125) e **somente se** `newStatus === 'approved'`
  (e sem `updateError`), antes do `return "ok"` ([:144](supabase/functions/mercadopago-webhook/index.ts#L144)).
- **Fire-and-forget possível?**: SIM — Supabase Edge Functions (Deno) expõem **`EdgeRuntime.waitUntil(promise)`**,
  que mantém a tarefa viva após o `Response` sem bloquear o MP. É a forma recomendada:
  `EdgeRuntime.waitUntil(sendMetaPurchase(...))`.
  - **Alternativa** (se preferir simplicidade): `await sendMetaPurchase(...)` dentro de **try/catch isolado**
    com **timeout via `AbortController`** (ex. 3s). Adiciona latência pequena, mas é 100% seguro.
- **Timeout do MP**: o Mercado Pago espera a resposta do webhook por ~22s e **reenvia** se não receber 2xx.
  Como o webhook **já retorna 200 mesmo em erros internos** ([:91](supabase/functions/mercadopago-webhook/index.ts#L91), [:144](supabase/functions/mercadopago-webhook/index.ts#L144)), não há risco de reenvio por causa do Meta —
  desde que o envio Meta **nunca** faça o handler lançar/retornar não-2xx. Use `waitUntil` ou timeout curto.
- **Processamento atual é síncrono** até o `return "ok"`; não há resposta antecipada. `waitUntil` resolve isso.

---

## 5. DEDUPLICAÇÃO CLIENT + SERVER

- **fbq atual envia `eventID`?**: **NÃO.** Os dois disparos client-side passam só o objeto de dados, sem o
  4º parâmetro: `Pagamento.tsx:620-626` e `PagamentoPix.tsx:87-93`. Sem `eventID`, quando o client-side
  eventualmente dispara (cartão, browser aberto) **e** o server-side também, o Meta **conta 2x**.
- **`paymentId` consistente client/server?**: **SIM.** O `mercadopago-payment` retorna `payment_id: payment.id`
  ([:212](supabase/functions/mercadopago-payment/index.ts#L212)) = **UUID interno de `payments`**. O client usa esse valor em `content_ids` (`Pagamento.tsx:623`,
  `PagamentoPix.tsx:90`). O webhook consegue o **mesmo** `payments.id` estendendo o SELECT (seção 1). Logo,
  **ambos podem usar `payments.id` como `event_id`** — dedup perfeita.
- **Precisa atualizar o client?**: **SIM** (mudança pequena, recomendada junto): adicionar o 4º parâmetro
  `{ eventID: paymentId }` aos dois `fbq('track','Purchase', {...}, { eventID: paymentId })`. Sem isso, o
  cartão (onde o client funciona) pode duplicar contra o server.

---

## 6. ESCOPO — quais pagamentos disparar

- **Recomendação: disparar server-side para TODOS os `approved`** (digital geral/direito, upsell físico,
  física avulsa), com `value = payment.amount` e `event_id = payment.id`. Cada pagamento é uma linha
  distinta com id próprio → são **eventos Purchase distintos** (receita adicional real do upsell), sem
  duplicar entre si.
- **Diferença vs. client-side**: o guard client `returnTo === '/pagamento/sucesso'` ([PagamentoPix.tsx:86](src/pages/PagamentoPix.tsx#L86))
  restringe o pixel ao funil digital. **Não replicar essa restrição no server** — o server deve contar
  todas as vendas, pois o objetivo é otimização de campanha por receita real.
- **Cuidado de dedup entre canais**: como digital e upsell têm ids diferentes, e cada um tem seu próprio
  `event_id`, não há risco de o server "somar em dobro". O único ponto de dedup necessário é client×server
  do MESMO pagamento (resolvido pelo `event_id` compartilhado, seção 5).
- **Enviar só quando `newStatus === 'approved'`** e transição real (idealmente checar que não estava
  approved antes) — para não reenviar em cada webhook. Mesmo que reenvie, o Meta dedup por `event_id`+`event_name`
  protege.

---

## 7. SECRETS

- **Usados hoje pelo webhook**: `MP_WEBHOOK_SECRET` ([:41](supabase/functions/mercadopago-webhook/index.ts#L41)), `MP_MODE` ([:75](supabase/functions/mercadopago-webhook/index.ts#L75)), `MP_PROD_ACCESS_TOKEN`/`MP_ACCESS_TOKEN`
  ([:77-78](supabase/functions/mercadopago-webhook/index.ts#L77)), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` ([:108-109](supabase/functions/mercadopago-webhook/index.ts#L108)).
- **Novos necessários**:
  - `META_ACCESS_TOKEN` — **obrigatório, secret** (System User token, Events Manager > Configurações > CAPI).
  - `META_PIXEL_ID` — opcional (é público; pode hardcodar `982937931195255`). Recomendo env por higiene.
  - (Opcional) `META_TEST_EVENT_CODE` — para validar no "Test Events" do Events Manager antes de produção.
- **Como configurar**:
  ```bash
  supabase secrets set META_ACCESS_TOKEN=EAAG...  META_PIXEL_ID=982937931195255
  # (opcional durante testes) supabase secrets set META_TEST_EVENT_CODE=TEST12345
  ```

---

## 8. RISCOS

| Risco | Severidade | Mitigação |
|---|---|---|
| `fetch` Meta falha (timeout/500/token inválido) | Média | **try/catch isolado**; logar e seguir. **Nunca** deixar lançar — o handler já retorna 200 sempre ([:144](supabase/functions/mercadopago-webhook/index.ts#L144)). |
| Latência do Meta atrasa resposta ao MP (reenvio → duplo processamento) | Média | Usar `EdgeRuntime.waitUntil` (não bloqueia) **ou** `await` com `AbortController` timeout ~3s. |
| MP reenvia webhook (retry) → Purchase enviado 2x | Baixa | Meta **dedup por `event_id`+`event_name`**; enviar só quando `newStatus==='approved'`. |
| Client-side dispara + server-side dispara o mesmo pagamento | Média | `event_id = payments.id` idêntico nos dois; **adicionar `eventID` no fbq client** (seção 5). |
| Rate limit do Meta | Baixa | Volume é 1 evento/compra; logar erro e seguir (sem retry agressivo). Opcional: fila/retry leve depois. |
| SHA-256 CPU-bound em burst | Baixa | 1 pagamento = ~5 hashes triviais; irrelevante mesmo em burst moderado. |
| LGPD — enviar email/telefone hasheado ao Meta | Baixa | Equivalente ao que o pixel client-side já faz; CAPI usa SHA-256 (pseudonimização). Garantir cobertura na política de privacidade. |
| Estender SELECT/adicionar getUserById quebrar o webhook | **Alta se malfeito** | Manter dentro do try; se faltar email, seguir com telefone/external_id; nunca abortar o UPDATE por causa do Meta. |

---

## 9. IMPLEMENTAÇÃO PROPOSTA

> Toda a lógica Meta em função isolada, chamada via `EdgeRuntime.waitUntil`, sem afetar o retorno do webhook.

### 9.1 Helpers (novos, topo do arquivo)
```ts
async function sha256Hex(input: string): Promise<string> {
  const norm = input.trim().toLowerCase();
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(norm));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sendMetaPurchase(opts: {
  paymentId: string; amount: number; email?: string | null;
  phone?: string | null; fullName?: string | null; userId?: string | null;
}) {
  const token = Deno.env.get('META_ACCESS_TOKEN');
  const pixelId = Deno.env.get('META_PIXEL_ID') || '982937931195255';
  if (!token) { console.warn('[META_CAPI] META_ACCESS_TOKEN ausente — pulando'); return; }

  const [first, ...rest] = (opts.fullName || '').trim().split(/\s+/);
  const user_data: Record<string, string[]> = {};
  const add = async (k: string, v?: string | null) => { if (v) user_data[k] = [await sha256Hex(v)]; };
  await add('em', opts.email || undefined);
  await add('ph', opts.phone ? opts.phone.replace(/\D/g, '') : undefined);
  await add('fn', first || undefined);
  await add('ln', rest.length ? rest.join(' ') : undefined);
  await add('external_id', opts.userId || undefined);
  user_data['country'] = [await sha256Hex('br')];

  const payload = {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: opts.paymentId,            // dedup com o fbq client
      event_source_url: 'https://www.urebrasil.com.br/pagamento/sucesso',
      action_source: 'website',
      user_data,
      custom_data: {
        value: Number(opts.amount), currency: 'BRL',
        content_ids: [opts.paymentId], content_type: 'product',
        content_name: 'Carteira Estudantil URE',
      },
    }],
    // test_event_code: Deno.env.get('META_TEST_EVENT_CODE'), // só em teste
  };

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 3000);
  try {
    const r = await fetch(
      `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${token}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: ctrl.signal });
    if (!r.ok) console.error('[META_CAPI] erro', r.status, await r.text());
  } catch (e) {
    console.error('[META_CAPI] falha no envio (ignorada):', e instanceof Error ? e.message : e);
  } finally { clearTimeout(t); }
}
```

### 9.2 DE → PARA no fluxo do webhook

**DE** — SELECT atual ([:112-117](supabase/functions/mercadopago-webhook/index.ts#L112)):
```ts
const { data: existingPayment, error: fetchError } = await supabase
  .from("payments")
  .select("metadata")
  .eq("gateway_charge_id", String(paymentId))
  .eq("gateway_name", "mercadopago")
  .single();
```
**PARA** (estende os campos, sem round-trip extra):
```ts
const { data: existingPayment, error: fetchError } = await supabase
  .from("payments")
  .select("id, student_id, amount, metadata")
  .eq("gateway_charge_id", String(paymentId))
  .eq("gateway_name", "mercadopago")
  .single();
```

**DE** — após o `UPDATE`, antes do `return "ok"` ([:140-144](supabase/functions/mercadopago-webhook/index.ts#L140)):
```ts
    if (updateError) {
      console.error("[WEBHOOK_MP] Erro ao atualizar payment:", { paymentId, error: updateError.message });
    }

    return new Response("ok", { status: 200 });
```
**PARA** (dispara Meta só em approved, isolado, não bloqueante):
```ts
    if (updateError) {
      console.error("[WEBHOOK_MP] Erro ao atualizar payment:", { paymentId, error: updateError.message });
    }

    // Meta Conversions API — Purchase server-side (captura PIX sem browser)
    if (newStatus === "approved" && !updateError && existingPayment?.id) {
      try {
        let email: string | null = null;
        let fullName: string | null = null;
        let phone: string | null = null;
        let userId: string | null = null;
        if (existingPayment.student_id) {
          const { data: prof } = await supabase
            .from("student_profiles")
            .select("full_name, phone, user_id")
            .eq("id", existingPayment.student_id)
            .maybeSingle();
          fullName = prof?.full_name ?? null;
          phone = prof?.phone ?? null;
          userId = prof?.user_id ?? null;
          if (userId) {
            const { data: authUser } = await supabase.auth.admin.getUserById(userId);
            email = authUser?.user?.email ?? null;
          }
        }
        EdgeRuntime.waitUntil(sendMetaPurchase({
          paymentId: String(existingPayment.id),
          amount: Number(existingPayment.amount ?? mpData.transaction_amount ?? 0),
          email, phone, fullName, userId,
        }));
      } catch (e) {
        console.error("[META_CAPI] preparação falhou (ignorada):", e instanceof Error ? e.message : e);
      }
    }

    return new Response("ok", { status: 200 });
```

### 9.3 Client-side (dedup) — DE → PARA
- `src/pages/Pagamento.tsx:620-626` **DE** `window.fbq('track', 'Purchase', { ... })`
  **PARA** `window.fbq('track', 'Purchase', { ... }, { eventID: paymentId })`
- `src/pages/PagamentoPix.tsx:87-93` **DE** `window.fbq('track', 'Purchase', { ... })`
  **PARA** `window.fbq('track', 'Purchase', { ... }, { eventID: paymentId })`

---

## Resumo executivo

- **Ponto de disparo**: após o UPDATE approved ([:138](supabase/functions/mercadopago-webhook/index.ts#L138)), via `EdgeRuntime.waitUntil` (não bloqueia o MP), em try/catch isolado — falha no Meta **nunca** afeta o pagamento.
- **Dados**: estender o SELECT de payments para `id, student_id, amount, metadata`; buscar `full_name/phone/user_id` em `student_profiles` e `email` via `auth.admin.getUserById` (não há coluna email no perfil).
- **Hashing**: `crypto.subtle.digest('SHA-256')` nativo — já usado no arquivo.
- **Dedup**: `event_id = payments.id` no server + adicionar `{ eventID: paymentId }` nos dois `fbq` client-side (hoje **não** enviam eventID).
- **Escopo**: disparar para todos os `approved` (digital + upsell + física); não replicar o guard `returnTo` do client.
- **Secrets**: criar `META_ACCESS_TOKEN` (obrigatório) e opcionalmente `META_PIXEL_ID`.
- **Config.toml**: o `mercadopago-webhook` não está declarado no `supabase/config.toml` (já era assim); manter como está, mas garantir que as secrets sejam aplicadas ao projeto.
