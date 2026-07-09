# Verificação: Pixel de Conversão (Meta + Google Ads)

Data: 2026-07-08
Modo: leitura factual apenas. Nenhum arquivo alterado.

## Resumo executivo (as duas causas-raiz)

1. **Meta Pixel:** o evento `Purchase` **NÃO existe em lugar nenhum do código**. O `index.html` só dispara `fbq('init', ...)` e `fbq('track', 'PageView')`. Por isso o Meta marca visualização de página/tráfego, mas nunca compra.
2. **Google Ads:** o evento de conversão existe **somente** em `PaymentSuccessPage.tsx` e funciona para **cartão**, mas é **bloqueado para PIX** — o método dominante no Brasil. O PIX chega em `/pagamento/sucesso` via `window.location.href` (reload de página inteira), o que **descarta o `location.state`**; e o primeiro guard da conversão é justamente `if (!hasLocationState) return`. Resultado: pagamentos PIX nunca disparam a conversão do Google Ads.

Não há Google Tag Manager no projeto (nenhum `GTM-XXXX`) — o tracking é feito por gtag.js e fbq inline no `index.html`.

## 1. INDEX.HTML

- GTM ID: **NÃO EXISTE** — não há container GTM. (Há uma referência a `googletagmanager.com/gtag/js`, mas é o loader do gtag.js, não o GTM.)
- gtag ID (Google Ads): **`AW-18167800155`** (`index.html:5,11`).
- Meta Pixel ID: **`982937931195255`** (`index.html:35`, `fbq('init', ...)`, e no noscript `:95`).
- Microsoft Clarity: `x83cfgvf97` (`:23`) — analytics, não conversão.
- Carregamento: **`<head>`** para gtag, Clarity e Meta Pixel (`:4-38`). O noscript do Meta está no `<body>` (`:93-96`). Todos carregam antes do `#root`/`main.tsx`.
- `window.gtag`: o `index.html:8` define `function gtag(){dataLayer.push(arguments);}` em script clássico (não-module) → vira `window.gtag`. **Está disponível no runtime.**
- `window.fbq`: `index.html:28` faz `n=f.fbq=function(){...}` com `f=window` → **`window.fbq` disponível no runtime.**

## 2. META PIXEL — PURCHASE

- Evento implementado? **NÃO.** Busca em todo o `src/` por `fbq`/`Purchase`/`track` não retornou nenhuma chamada de conversão. O único `fbq` do projeto está no `index.html` (init + PageView). `AdquirirFisica.tsx:45` tem uma função `handlePurchase`, mas é apenas o handler do botão que navega para o checkout — **não** chama `fbq`.
- `window.fbq` disponível? **SIM** (definido no snippet do `index.html`). Pode ser chamado como `window.fbq('track', 'Purchase', {...})`.
- Local correto para implementar: **`PaymentSuccessPage.tsx`**, junto/ao lado do `useEffect` da conversão do Google Ads (`:123-154`), reutilizando os mesmos `amount`/`paymentId`. Dados recomendados:
  - `fbq('track', 'Purchase', { value: amount, currency: 'BRL', content_ids: [paymentId], content_type: 'product' })`.
  - **Atenção:** implementar no `PaymentSuccessPage` **sozinho** herda o mesmo defeito do PIX (state perdido). O ideal é disparar tanto no ponto de confirmação de cartão quanto no de PIX (ver seção 8), ou corrigir antes a passagem de state do PIX.

## 3. GOOGLE ADS — CONVERSÃO

- Evento implementado? **SIM**, exclusivamente em `PaymentSuccessPage.tsx:147-152` (`window.gtag("event", "conversion", {...})`). Não há gtag de conversão em nenhum outro arquivo (`Checkout.tsx`, `CheckoutFisica.tsx`, `Pagamento.tsx`, `PagamentoPix.tsx` **não** têm evento de conversão).
- Guards que podem bloquear (`PaymentSuccessPage.tsx:123-139`):

  | Guard | Linha | Pode bloquear? | Cenário |
  |---|---|---|---|
  | `if (!hasLocationState) return` | :124 | **SIM — é a causa-raiz do PIX** | `hasLocationState = location.state != null` (`:58`). Toda navegação que não passe `location.state` do React Router bloqueia. O PIX chega via `window.location.href` (reload) → `location.state` é `null` → bloqueado. |
  | `if (typeof amount !== "number" || !paymentId) return` | :128 | SIM | `amount` e `paymentId` vêm de `location.state` (`:70-83`). Sem state, `amount` fica `null` (o fallback de localStorage em `:88-91` recupera **só** `paymentId`, nunca `amount`) → bloqueado. |
  | `if (typeof window.gtag !== "function") return` | :136 | Improvável | `window.gtag` existe (script no head). Só bloquearia se o gtag.js fosse barrado por adblock/CSP. |

- `send_to` correto? O código usa **`AW-18167800155/wkviCI-zia8cENvCitdD`** (`:145,148`). O prefixo `AW-18167800155` bate com o `gtag('config')` do `index.html:11`. O rótulo de conversão (`wkviCI-zia8cENvCitdD`) **não é verificável pelo código** — precisa ser conferido no painel do Google Ads (Ferramentas → Conversões → a ação específica). Registrar como ponto a validar.
- Logs de debug `[GADS CONV]`: aparecem em produção (são `console.log`, não removidos por build). Peça ao Newton abrir o console durante uma compra de teste:
  - Se aparecer `[GADS CONV] bloqueado: sem location.state` → confirma o bug do PIX.
  - Se aparecer `[GADS CONV] disparado com sucesso` (cartão) mas a conversão não contabiliza no Google Ads → problema de configuração do rótulo/`send_to` no painel.

## 4. FLUXO PÓS-PAGAMENTO

| Origem | Destino | Como navega | State passado? | amount? | paymentId? | Conversão dispara? |
|---|---|---|---|---|---|---|
| `Pagamento.tsx` cartão digital (`:617`) | `/pagamento/sucesso` | React Router `navigate(..., {state})` | **SIM** | SIM (`:620`) | SIM (`:621`) | **SIM** (se `window.gtag` ok e paymentId definido) |
| `Pagamento.tsx` PIX com `pix_code` (`:445`) | `/pagamento/pix` → depois `PagamentoPix` | `navigate("/pagamento/pix", {state:{returnTo:"/pagamento/sucesso"}})` | state só até a tela do PIX | — | — | (ainda não; depende do próximo passo) |
| `PagamentoPix.tsx` após aprovação (`:87`) | `/pagamento/sucesso` (`returnTo`) | **`window.location.href`** (reload total) | **NÃO** (state descartado no reload) | **NÃO** | só via localStorage `recent_payment_id` (`:82`) | **NÃO — bloqueado no guard `:124`** |
| `Pagamento.tsx` PIX **sem** `pix_code` (`:477`) | `/pagamento/sucesso` | React Router `navigate(..., {state})` | SIM (`:480-481`) | SIM | SIM | SIM (mas é branch atípico/fallback do gateway) |
| `Checkout.tsx` (upsell físico) | `/dashboard` (auditado) | `navigate` | — | — | — | **NÃO** (sem gtag; não passa pelo PaymentSuccessPage) |
| `CheckoutFisica.tsx` (física avulsa) | — | — | — | — | — | **NÃO** (sem gtag) |

Observação: o `PaymentSuccessPage` sempre grava `recent_payment_id` no localStorage (`:86`) e, sem state, recupera **apenas** o `paymentId` — nunca o `amount`. Como o guard `:124` já barra antes por falta de state, esse fallback não ajuda a conversão.

## 5. GTM / DATALAYER

- dataLayer usado? **SIM, mas só indiretamente** — o `index.html:7-8` inicializa `window.dataLayer` e o shim `gtag()` faz `dataLayer.push(arguments)`. **Não há** nenhum `dataLayer.push` manual no código-fonte (`src/`), e **não há GTM** consumindo esse dataLayer.
- Checar no painel: como não existe GTM, **não há configuração de conversão "escondida" no GTM** a recuperar. Toda a lógica de conversão está no código. Ponto a checar continua sendo o **Google Ads** (rótulo/ação de conversão `wkviCI-zia8cENvCitdD`, janela de conversão, status "Ativa/Recebendo conversões").

## 6. OUTROS EVENTOS

- Signup (Lead): **NÃO** há `fbq('track','Lead')` nem conversão no cadastro (`SignUp.tsx` não aparece nos greps de fbq/gtag).
- CompleteProfile: **NÃO** há evento de tracking/conversão.
- Qualquer evento customizado: **NÃO** — o único `PageView` é o do `index.html`, e não há SPA pageview tracking em mudança de rota (nenhum `fbq('track','PageView')` / `gtag('event','page_view')` por rota no React Router). Ou seja, mesmo PageViews de rotas internas da SPA podem estar subnotificados (só a carga inicial conta).

## 7. DIAGNÓSTICO

- **a) Meta Pixel Purchase: NÃO implementado.** Nenhum `fbq('track','Purchase')` existe. É a causa direta de "não marca compras" no Meta. `window.fbq` existe e está pronto para uso. Implementar em `PaymentSuccessPage.tsx` (e/ou nos pontos de confirmação de cartão e PIX).
- **b) Google Ads Conversion: implementado, mas falha para PIX.** Funciona para **cartão** (state passado via `navigate` em `Pagamento.tsx:617`). Falha para **PIX** porque `PagamentoPix.tsx:87` usa `window.location.href` (reload) e o `PaymentSuccessPage.tsx:124` exige `location.state`. `window.gtag` existe. Correção: garantir que `amount` + `paymentId` cheguem ao PaymentSuccessPage no fluxo PIX (ou disparar a conversão no próprio ponto de confirmação do PIX). Upsell/física não têm conversão alguma.
- **c) GTM: não se aplica.** Não há GTM no projeto; nada a recuperar no painel do GTM. O que precisa ser verificado manualmente é o **painel do Google Ads** (o rótulo de conversão e se a ação está ativa) e o **Events Manager do Meta** (se o pixel está recebendo, e futuramente o Purchase).

## 8. RECOMENDAÇÕES (priorizadas)

> Somente leitura — não implementadas. Lista de correções sugeridas.

1. **[P0 — corrige PIX no Google Ads] Preservar `amount`/`paymentId` no retorno do PIX.**
   Hoje `PagamentoPix.tsx:87` faz `window.location.href = returnTo`, perdendo o state. Opções:
   - (a) Trocar por `navigate(returnTo, { state: { paymentId, amount, planName, paymentMethod: 'pix', ... } })` (React Router), preservando o state — o `amount` já está disponível em `PagamentoPix.tsx` (`:41`, `paymentData.amount`).
   - (b) Se o reload for necessário por algum motivo (ex.: revalidar sessão), passar os dados por querystring ou gravar `amount` no localStorage junto com `recent_payment_id` **e** relaxar o guard `:124` para aceitar o fallback de localStorage (recuperando `amount` também).
   A opção (a) é a mais limpa e alinhada ao fluxo de cartão.

2. **[P0 — corrige Meta] Implementar `fbq('track','Purchase', { value, currency:'BRL', content_ids:[paymentId] })`.**
   Adicionar no mesmo ponto onde a conversão do Google Ads dispara com sucesso, para cartão e PIX. Declarar `fbq` no `Window` (como já é feito com `gtag`). Cuidado com StrictMode/duplo-mount: idealmente disparar uma única vez por `paymentId` (guardar em `localStorage`/`ref` para evitar contar 2x).

3. **[P1] Evitar dupla contagem e disparo perdido.**
   O `useEffect` de conversão depende de `[amount, paymentId, hasLocationState]`. Em React 18 StrictMode (dev) roda 2x; em produção roda 1x, mas convém deduplicar por `transaction_id`/`paymentId` (marcar em localStorage que a conversão daquele `paymentId` já foi enviada) — vale para Google Ads e Meta.

4. **[P1] Cobrir upsell e física.**
   `Checkout.tsx` (upsell físico) e `CheckoutFisica.tsx` (física avulsa) não disparam nenhuma conversão. Se essas vendas devem contar como conversão/receita, adicionar os eventos (Google Ads + Meta Purchase) nesses fluxos também, com o `value` correto de cada uma.

5. **[P2 — verificação manual, não-código] Conferir no painel do Google Ads.**
   Validar que a ação de conversão `AW-18167800155/wkviCI-zia8cENvCitdD` existe, está **Ativa**, com contagem/valor configurados e dentro da janela de conversão. Um `send_to` com rótulo errado faz o evento disparar no browser sem contabilizar.

6. **[P2 — verificação manual] Conferir no Events Manager do Meta.**
   Confirmar recebimento de `PageView` e, após a correção, do `Purchase`. Considerar a **Conversions API (CAPI)** server-side (via webhook de pagamento aprovado) para robustez contra adblock/iOS — o pagamento aprovado já é conhecido no backend (`mercadopago-webhook`), o que permitiria enviar Purchase server-side de forma confiável.

7. **[P3] Teste guiado com Newton.**
   Fazer 1 compra de teste por **cartão** e 1 por **PIX**, com o console aberto, e reportar quais mensagens `[GADS CONV] ...` aparecem. Isso confirma empiricamente o diagnóstico (esperado: cartão = "disparado com sucesso"; PIX = "bloqueado: sem location.state").

### Nota sobre a causa da percepção "não marca conversão"
Como PIX é o meio de pagamento dominante no público-alvo, e PIX está 100% bloqueado no Google Ads + Meta não tem Purchase algum, o efeito líquido é que a esmagadora maioria das compras não gera conversão — coerente com o sintoma relatado. Cartão via Google Ads é o único caminho que hoje deveria estar funcionando.
