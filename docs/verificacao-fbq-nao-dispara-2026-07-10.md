# Verificação: Por que o fbq('track', 'Purchase') não dispara em produção

Data: 2026-07-10
Modo: SOMENTE LEITURA (nenhum arquivo alterado)
Commit auditado: 9690840 ("evento compra na meta pixel", 2026-07-08)

> Todas as afirmações referenciam arquivo:linha. Não há acesso ao Meta Events Manager
> nem ao banco de produção neste ambiente; a análise é do código-fonte.

---

## Resumo antecipado

Os **guards estão corretos** e o **fbq está definido** em runtime (o PageView prova isso).
Os dois `fbq('track','Purchase')` **disparam quando são alcançados**. O problema **não é
race condition nem guard** — é **arquitetural**: no fluxo **PIX** (método dominante no Brasil)
o evento só é executado se o comprador **ainda estiver na aba do checkout** quando o polling
de 5s detectar a aprovação. Como PIX é confirmado de forma assíncrona (o usuário sai do
navegador, paga no app do banco e **frequentemente não volta**), o `fbq` **nunca chega a
rodar** — mesmo que o pagamento seja confirmado pelo webhook no servidor. Não há
Conversions API (server-side) como fallback. Essa é a causa dominante das compras
confirmadas sem conversão no Meta.

---

## 1. RACE CONDITION PIX

Bloco exato ([PagamentoPix.tsx:76-100](src/pages/PagamentoPix.tsx#L76)):

```
76  if (data?.status === "approved") {
77    if (pollRef.current) clearInterval(pollRef.current);
78    setPaymentConfirmed(true);
81    if (paymentId) localStorage.setItem("recent_payment_id", paymentId);
86    if (typeof window.fbq === 'function' && returnTo === '/pagamento/sucesso') {
87      window.fbq('track', 'Purchase', { value: amount, currency: 'BRL', ... });
88    }
96    toast.success(successMessage || "Pagamento confirmado!");
97    setTimeout(() => {
98      window.location.href = returnTo || "/upload-documentos";
99    }, 2000);
100 }
```

- **Linhas/operações entre o fbq e o redirect**: o `window.location.href` está dentro de um
  **`setTimeout(..., 2000)`** — ou seja, há **2 segundos** de folga entre o `fbq` e o hard reload.
- **Risco de navegação antes do beacon**: **BAIXO.** O snippet padrão do Meta envia o evento
  por imagem/`fetch` que parte imediatamente na chamada `fbq(...)`; os 2s de `setTimeout` são
  mais que suficientes para o beacon sair antes do `window.location.href`. **A hipótese de race
  condition está, na prática, mitigada pelo próprio setTimeout.**
- **fbq síncrono ou assíncrono**: a chamada `fbq(...)` é síncrona (empilha na `n.queue` ou
  chama `callMethod`); o envio de rede é disparado de imediato. Snippet é o **padrão** (pixel
  via `fbevents.js`), não usa `sendBeacon` customizado.
- **navigate() do cartão tem o mesmo risco?**: **NÃO.** `navigate()` (react-router) é client-side,
  **não destrói a página** ([Pagamento.tsx:629](src/pages/Pagamento.tsx#L629)) — o fbq em
  [:619-627](src/pages/Pagamento.tsx#L619) tem tempo de sobra.

---

## 2. GUARD returnTo

- **Guard** ([PagamentoPix.tsx:86](src/pages/PagamentoPix.tsx#L86)): `returnTo === '/pagamento/sucesso'`.
- **De onde vem `returnTo`**: de `location.state` ([PagamentoPix.tsx:24-25](src/pages/PagamentoPix.tsx#L24)),
  passado no `navigate("/pagamento/pix", { state: { ... returnTo } })` em
  [Pagamento.tsx:446-455](src/pages/Pagamento.tsx#L446).
- **Valor para compra digital normal** ([Pagamento.tsx:452](src/pages/Pagamento.tsx#L452)):
  `returnTo: plan.is_physical ? "/upload-documentos" : "/pagamento/sucesso"`.
  Para um plano **digital** (`is_physical = false`), `returnTo = "/pagamento/sucesso"` — **exatamente**
  o valor exigido pelo guard, **sem** trailing slash nem query. **Guard passa.** ✅
- **Pode ser undefined?**: SIM em cenários de borda — se o usuário recarregar a página de PIX
  (F5 perde `location.state`) ou chegar por link direto, `returnTo` vira `undefined` e o guard
  bloqueia o fbq silenciosamente. Mas no fluxo normal (navegação vinda de Pagamento.tsx) tem valor.
- **Guard está correto**: SIM para o caminho feliz. **Efeito colateral desejado**: para compra
  **física** o `returnTo` é `/upload-documentos`, então o guard **corretamente NÃO** dispara
  Purchase (a compra digital é o evento de conversão). Consistente.

Conclusão da seção: **o guard returnTo NÃO é a causa** para compra digital normal.

---

## 3. GUARD window.fbq

Snippet ([index.html:26-37](index.html#L26)):
```
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){...};...}(window, document, ...)
fbq('init', '982937931195255');
fbq('track', 'PageView');
```
- `n = f.fbq = function(){...}` com `f = window` → **`window.fbq` É uma função**. `typeof window.fbq === 'function'` → **true**.
- **Risco de falha do guard**: **BAIXO.** O snippet é inline no `<head>` e roda **antes** do bundle React;
  quando o usuário chega à tela de pagamento (após navegação/interação), `window.fbq` já existe há muito.
  Mesmo antes de `fbevents.js` terminar de carregar, o stub enfileira (`n.queue.push`) e faz flush depois.
- **Ordem de carregamento**: snippet Meta (head, síncrono) **antes** do React app. Não há corrida.

Conclusão: **o guard window.fbq NÃO é a causa**. O PageView funcionando confirma que fbq está operante.

---

## 4. VARIÁVEIS NO ESCOPO

| Variável | Arquivo:linha | Origem / valor no momento do fbq | OK? |
|---|---|---|---|
| `paymentAmount` (cartão) | [Pagamento.tsx:387](src/pages/Pagamento.tsx#L387) | const no início do `handlePayment`; número | ✅ |
| `paymentId` (cartão) | [Pagamento.tsx:615-616](src/pages/Pagamento.tsx#L615) | `data.payment_id \|\| data.orderId \|\| data.id \|\| undefined` — **pode ser undefined** | ⚠️ tolerável |
| `plan.name` (cartão) | state [Pagamento.tsx:132](src/pages/Pagamento.tsx#L132) | `plan` já carregado; tem valor | ✅ |
| `amount` (PIX) | [PagamentoPix.tsx:41](src/pages/PagamentoPix.tsx#L41) | `paymentData?.amount ?? 0`; vem de [Pagamento.tsx:450](src/pages/Pagamento.tsx#L450) | ✅ |
| `paymentId` (PIX) | [PagamentoPix.tsx:44](src/pages/PagamentoPix.tsx#L44) | `paymentData?.payment_id` | ✅ (se state presente) |
| `returnTo` (PIX) | [PagamentoPix.tsx:25](src/pages/PagamentoPix.tsx#L25) | `/pagamento/sucesso` p/ digital | ✅ |

- `content_ids: [undefined]` (se paymentId faltar) **não** faz o Meta descartar o Purchase — `value`
  e `currency` estão presentes e válidos. É um problema de qualidade de dado, **não** de disparo.
- **Nenhuma variável obrigatória é undefined no fluxo normal.** Não é a causa.

---

## 5. ERROS SILENCIOSOS

- **try/catch envolvente (cartão)**: SIM — todo o `handlePayment` está em `try {` ([:376](src/pages/Pagamento.tsx#L376))
  … `catch (err: any)` ([:641](src/pages/Pagamento.tsx#L641)). O fbq ([:619-627](src/pages/Pagamento.tsx#L619)) está dentro.
- **try/catch envolvente (PIX)**: o fbq está **dentro do callback do `setInterval`** ([:65-101](src/pages/PagamentoPix.tsx#L65)),
  que **não** tem try/catch próprio. Um throw ali seria um unhandled rejection no callback async, mas
  **o fbq é guardado por `typeof`, então não lança**.
- **Erro seria engolido?**: irrelevante — o `typeof window.fbq === 'function'` impede o TypeError.
  Não há evidência de exceção engolida derrubando o disparo. **Não é a causa.**

---

## 6. FLUXO REAL PÓS-PIX (linha por linha)

A partir de `data?.status === "approved"` ([PagamentoPix.tsx:76](src/pages/PagamentoPix.tsx#L76)):

1. `clearInterval(pollRef.current)` — para o polling (:77)
2. `setPaymentConfirmed(true)` — setState (**re-render**, ver abaixo) (:78)
3. `localStorage.setItem("recent_payment_id", paymentId)` (:82)
4. **`fbq('track','Purchase', {...})`** — guardado por typeof + returnTo (:86-94)
5. `toast.success(...)` (:96)
6. `setTimeout(() => window.location.href = returnTo, 2000)` — hard redirect após 2s (:97-99)

- **fbq está antes de todas as operações de navegação/redirect?**: SIM — antes do `setTimeout`/redirect.
- **setState antes do fbq desmonta o componente?**: NÃO. `setPaymentConfirmed(true)` (:78) agenda um
  re-render, mas o callback do interval continua executando **sincronicamente** até o fim (o React não
  interrompe a função no meio); o fbq na linha 86 roda na mesma execução. O componente **não** é
  desmontado antes — a rota só muda no `window.location.href` 2s depois. **Sem perda por re-render.**

Portanto, **quando este bloco roda, o fbq dispara**. O problema é **este bloco frequentemente NÃO roda**
(ver seção 9).

---

## 7. COMPARAÇÃO COM O GTAG (Google Ads)

- **gtag**: está em `useEffect` na [PaymentSuccessPage.tsx](src/pages/PaymentSuccessPage.tsx) (dispara ao
  **montar** a página de sucesso, que é alcançada por `navigate()` no cartão preservando `state`).
- **fbq**: está em **handler assíncrono** (callback do polling PIX / bloco pós-aprovação do cartão),
  **antes** de chegar à página de sucesso.
- **Diferença de timing crítica**: o gtag do cartão dispara **depois** de a página de sucesso montar —
  então depende de o usuário **chegar** lá (via `navigate`, que sempre ocorre no cartão). O fbq **PIX**
  dispara **na própria tela de PIX**, que exige o usuário **estar presente** no momento da aprovação.
  Para PIX, o comprador tipicamente **não está** — enquanto o cartão é síncrono e o usuário está.
- **Debug log no fbq?**: **NÃO** — nenhum `console.log` acompanha os dois `fbq` (o gtag tem
  `console.log("[GADS CONV]")`). Isso dificultou o diagnóstico e mascara a não-execução.

---

## 8. SNIPPET META PIXEL ([index.html:25-38](index.html#L25) e :95)

- **Pixel ID**: `982937931195255` (init em :35 e noscript em :95 — **coerentes**).
- **fbq('init', ...)**: SIM (:35).
- **fbq('track', 'PageView')**: SIM (:36).
- **Script URL**: `https://connect.facebook.net/en_US/fbevents.js` (:34) — padrão, `async`.
- **Posição**: snippet JS no **`<head>`** (inline, :26-37); fallback `<noscript><img .../></noscript>`
  no **`<body>`** (:95 — movido para o body no commit fece9e7). **Correto.**
- **CSP**: **não há** `Content-Security-Policy` no index.html (grep sem resultado) → o beacon para
  `facebook.com/tr` / `connect.facebook.net` **não** é bloqueado por CSP.

Snippet está **correto e funcional** — consistente com o PageView aparecendo no Meta.

---

## 9. DIAGNÓSTICO

### Causa mais provável (dominante) — PIX assíncrono + tracking client-side
O `fbq` do PIX está **preso ao ciclo de vida da aba do checkout**: só roda se o `setInterval`
de 5s ([PagamentoPix.tsx:65](src/pages/PagamentoPix.tsx#L65)) detectar `status === "approved"`
**enquanto a página está aberta e em foreground**. No PIX real:
- o comprador **sai do navegador** para pagar no app do banco e, na maioria das vezes, **não retorna**
  à aba do site;
- navegadores mobile **congelam/estrangulam `setInterval`** em abas em segundo plano — mesmo que ele
  volte, pode perder janelas de polling;
- há **expiração de 10 min** ([:124-129](src/pages/PagamentoPix.tsx#L124)) que encerra o polling.

Resultado: o **webhook do Mercado Pago** confirma o pagamento no banco (a compra existe e o onboarding
avança), mas o **evento de browser nunca é executado** → **compra confirmada sem conversão no Meta**.
Como PIX é o meio dominante no Brasil, isso explica "várias compras, nenhuma conversão".

### Causa secundária — ausência de Conversions API (server-side)
O **único** sinal de Purchase é o Pixel client-side. Não existe envio server-side (Conversions API)
a partir do webhook confirmado. Sem esse fallback, toda compra em que o usuário não está na aba é perdida —
não só PIX, mas qualquer fechamento de aba/ad-blocker/ITP.

### O que NÃO é a causa (descartado com evidência)
- Race condition PIX → **mitigada** pelos 2s de `setTimeout` (seção 1).
- Guard `returnTo` → **passa** para digital (`/pagamento/sucesso`, seção 2).
- Guard `window.fbq` → **função definida**, PageView prova (seção 3).
- Variáveis undefined → não no fluxo normal (seção 4).
- Erro engolido por try/catch → typeof impede throw (seção 5).
- CSP → **inexistente** (seção 8).

> Observação sobre o **cartão**: o fbq do cartão ([Pagamento.tsx:619](src/pages/Pagamento.tsx#L619))
> é síncrono, com o usuário presente, e **deve** disparar. Se compras de cartão também não aparecem,
> a explicação mais provável é o **mix de vendas** (predomínio de PIX) e/ou ad-blocker/ITP — não um
> bug de código no caminho do cartão. Sem acesso ao Events Manager não é possível separar, mas o
> caminho do cartão está tecnicamente correto.

---

## 10. CORREÇÃO PROPOSTA

### Correção A (RECOMENDADA, robusta) — Meta Conversions API server-side no webhook
Enviar o evento `Purchase` a partir de [mercadopago-webhook](supabase/functions/mercadopago-webhook/index.ts)
quando o pagamento vira `approved`, **independente de o browser estar aberto**. É o padrão da indústria
para PIX/pagamentos assíncronos.

- **DE**: conversão só client-side (Pixel), perdida quando o usuário não está na aba.
- **PARA**: no webhook, ao confirmar `approved`, `POST` para
  `https://graph.facebook.com/v19.0/982937931195255/events` com `event_name: "Purchase"`,
  `action_source: "website"`, `event_id` = id do pagamento (para **deduplicar** com o Pixel),
  `custom_data: { value, currency: "BRL" }` e `user_data` hasheado (email/telefone disponíveis no perfil).
- Requer `META_ACCESS_TOKEN` (System User token) nas secrets. Passar o **mesmo `event_id`** no Pixel
  (`fbq('track','Purchase', {...}, { eventID })`) evita contagem dupla quando ambos disparam.

### Correção B (rápida, parcial) — garantir robustez do disparo client-side
1. **Reduzir perda por redirect no PIX** — trocar `window.location.href` por `navigate()` (SPA, não
   destrói a página) quando o destino é interno, mantendo o beacon vivo:
   - **DE** ([PagamentoPix.tsx:97-99](src/pages/PagamentoPix.tsx#L97)):
     `setTimeout(() => { window.location.href = returnTo || "/upload-documentos"; }, 2000);`
   - **PARA**: `setTimeout(() => { navigate(returnTo || "/upload-documentos"); }, 2000);`
     (já há `navigate` importado). Reduz o risco residual e evita reload desnecessário.
2. **Adicionar logs de debug** (paridade com o gtag) para observabilidade:
   - **DE**: fbq sem log.
   - **PARA**: `console.log("[META CONV] Purchase", { value, paymentId, returnTo })` antes de cada `fbq`.
3. **Tornar o guard returnTo resiliente a reload** (opcional): derivar "é compra digital" de algo
   persistente (ex.: `paymentData`/plano) em vez de depender só de `location.state`, que se perde em F5.

### Observação importante
A Correção B **não resolve** o caso central (usuário que paga o PIX e nunca volta) — para isso, apenas a
**Correção A (server-side CAPI)** captura a conversão de forma confiável. B é complementar/higiênica.

---

### Anexo — mapa de arquivos

| Papel | Arquivo:linha |
|---|---|
| fbq Purchase (PIX) | [PagamentoPix.tsx:86-94](src/pages/PagamentoPix.tsx#L86) |
| Polling PIX + redirect | [PagamentoPix.tsx:65-101](src/pages/PagamentoPix.tsx#L65) |
| returnTo (origem) | [Pagamento.tsx:452](src/pages/Pagamento.tsx#L452) |
| fbq Purchase (cartão) | [Pagamento.tsx:619-627](src/pages/Pagamento.tsx#L619) |
| try/catch handlePayment | [Pagamento.tsx:376](src/pages/Pagamento.tsx#L376) / [:641](src/pages/Pagamento.tsx#L641) |
| Snippet Meta Pixel | [index.html:25-38](index.html#L25), [:95](index.html#L95) |
| Webhook (ponto p/ CAPI) | supabase/functions/mercadopago-webhook/index.ts |
