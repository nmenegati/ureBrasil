# Verificação: Implementar fbq('track', 'Purchase') — Meta Pixel

Data: 2026-07-08
Modo: leitura factual apenas. Nenhum arquivo alterado. A seção 8 é proposta de código — não foi implementada.

## Contexto confirmado

- `window.fbq` existe no runtime (snippet em `index.html:26-37`), hoje só dispara `init` + `PageView`.
- Nenhum `fbq('track','Purchase')` em `src/`.
- A conversão do Google Ads já existe em `PaymentSuccessPage.tsx:123-154` e sofre do bug do PIX (state perdido). **Qualquer solução de Meta deve resolver PIX junto**, senão herda o mesmo furo.

## 1. PONTOS DE DISPARO

| Página | Evento de pagamento | Navegação | State disponível no destino? | Passa por PaymentSuccessPage? | fbq viável aqui? |
|---|---|---|---|---|---|
| `Pagamento.tsx` cartão digital (`:596-627`) | cartão aprovado | `navigate("/pagamento/sucesso", {state})` | **SIM** (amount `:620`, paymentId `:621`) | SIM | SIM |
| `Pagamento.tsx` PIX c/ `pix_code` (`:444-454`) | gera QR; aprovação é assíncrona | `navigate("/pagamento/pix", {returnTo:"/pagamento/sucesso"})` | — (confirmação ocorre depois) | SIM (depois) | não (ainda não aprovado) |
| `PagamentoPix.tsx` (`:76-88`) | **PIX aprovado no polling** | `window.location.href = returnTo` (reload) | **NÃO** (state descartado) | SIM, mas sem state | **SIM** — aqui `amount` (`:41`) e `paymentId` (`:44`) existem no momento da confirmação |
| `PaymentSuccessPage.tsx` (`:123-154`) | visualização pós-aprovação (digital) | — | cartão: sim / PIX: não | é a própria página | SIM (é o ponto de convergência do funil digital) |
| `Checkout.tsx` upsell (`:544-545`, PIX `:516-524`) | upsell físico aprovado | `navigate("/upload-documentos")` / PIX `returnTo:"/upload-documentos"` | — | **NÃO** | SIM, se quiser contar o upsell (amount = `resolvedUpsell.amount`) |
| `CheckoutFisica.tsx` avulsa (`:364-365`, PIX `:350-359`) | física avulsa aprovada | `navigate("/carteirinha")` / PIX `returnTo:"/carteirinha"` | — | **NÃO** | SIM, se quiser contar a avulsa (amount = `plan.price`) |

Fato central: **o funil digital (cartão + PIX) converge em `/pagamento/sucesso`** — cartão via `navigate` (com state), PIX via `window.location.href` (sem state). Upsell e física avulsa **não** passam por lá.

## 2. MELHOR LOCAL

- Opção recomendada: **C (centralizar no `PaymentSuccessPage.tsx`) + fallback de localStorage para o `amount`**, aplicando de uma vez ao `gtag` e ao `fbq`.
- Justificativa:
  - O PaymentSuccessPage é o **único ponto de convergência do funil digital** (cartão e PIX). Colocar os dois pixels lá = 1 arquivo, 1 dedupe, 1 guard.
  - O bug do PIX é "amount/paymentId não chegam" porque o reload apaga o `location.state`. O `PagamentoPix.tsx` **já grava `recent_payment_id` no localStorage** (`:82`); basta gravar também `amount`/`planName` e fazer o PaymentSuccessPage ler do localStorage quando `location.state` estiver vazio. Isso corrige **gtag e fbq simultaneamente** sem mexer no comportamento de reload (`window.location.href`), que é a mudança de maior risco.
  - Opção A (só PaymentSuccessPage, sem fallback) mantém o PIX quebrado. Opção B (disparar em cada página) duplica código em 2-4 arquivos e tem o risco de "contar compra antes da confirmação real" — no cartão, o `fbq` iria antes de qualquer verificação de página; e ainda assim precisaria de dedupe. C é o melhor equilíbrio.
  - **Alternativa igualmente válida e mais "correta" a longo prazo:** aplicar o P0 do relatório anterior (trocar `window.location.href` por `navigate(..., {state})` em `PagamentoPix.tsx:87`) e então usar a Opção A pura. Fica mais limpo (sem localStorage), mas mexe no fluxo de reload do PIX — se esse reload existe para revalidar sessão, há risco. Por isso recomendo **C** como caminho de menor risco; se o time confirmar que o reload não é necessário, migrar para A.

## 3. DADOS DO EVENTO

- `value`:
  - Cartão: `paymentAmount` (passado como `amount` no state, `Pagamento.tsx:620`).
  - PIX: `paymentData.amount` (`PagamentoPix.tsx:41`).
  - Upsell: `resolvedUpsell.amount` (`Checkout.tsx`). Física avulsa: `plan.price` (`CheckoutFisica.tsx`).
  - No PaymentSuccessPage, `amount` vem do state (`:82`) — na Opção C, também do localStorage no fluxo PIX.
- `content_name`: **dinâmico** — usar `planName` (já disponível no state, `PaymentSuccessPage.tsx:81`), com fallback fixo `"Carteira Estudantil URE"` quando ausente (ex.: PIX sem state, se não persistirmos planName).
- `content_ids`: `[paymentId]` — disponível (state ou localStorage `recent_payment_id`).
- PII: **NÃO.** `value`, `currency`, `content_ids` (id de transação), `content_name` (nome de produto) não são dados pessoais. **Não enviar** email, CPF, nome do aluno, telefone — nenhum desses entra no payload proposto. (O Meta Advanced Matching hasheado é opcional e fica fora do escopo.)

## 4. DEDUPLICAÇÃO

- `eventID` viável com `paymentId`? **SIM.** O `paymentId` (payment/transaction id do gateway) é único por transação — bom `eventID` para o Meta e bom `transaction_id` para o Google Ads (já usado assim em `:151`). Isso também casa com uma futura Conversions API server-side (mesmo `eventID` no browser e no servidor → o Meta deduplica os dois lados).
- Recarregar o PaymentSuccessPage dispara de novo? **HOJE, para cartão: risco real.** O `useEffect` depende de `[amount, paymentId, hasLocationState]`; num reload com state ainda presente (ou, na Opção C, com localStorage presente) ele **re-dispararia**. Precisa de trava.
- Prevenção de dupla contagem (proposta):
  - Trava em `localStorage`, chave por transação, ex.: `purchase_tracked_<paymentId>`. Antes de disparar, checar; se já marcado, não dispara. Após disparar, marcar.
  - Passar `eventID: paymentId` ao `fbq` (4º argumento) como segunda camada de dedupe do lado do Meta.
  - Observação React 18 StrictMode: em **dev** o efeito monta 2x; a trava de localStorage já cobre isso. Em produção monta 1x.

## 5. DECLARAÇÃO DE TIPO

- Existe? **Parcial.** `PaymentSuccessPage.tsx:13-17` declara só `gtag` em `Window`. **Não** há declaração de `fbq` em nenhum lugar do projeto.
- Onde adicionar: **no mesmo bloco `declare global` de `PaymentSuccessPage.tsx`** (Opção C mantém tudo nesse arquivo):
  ```typescript
  declare global {
    interface Window {
      gtag?: (...args: unknown[]) => void;
      fbq?: (...args: unknown[]) => void;
    }
  }
  ```
  (Se no futuro o fbq for usado em Checkout/CheckoutFisica também, mover essa interface para um `src/types/global.d.ts` compartilhado para evitar redeclaração.)

## 6. CHECKOUT / FÍSICA

- Upsell (`Checkout.tsx`): **disparar? Recomendado SIM, como Purchase separado**, se o time quer que a receita do upsell conte nas campanhas. É uma segunda transação com `value = resolvedUpsell.amount` e seu próprio `paymentId`. Como não passa por PaymentSuccessPage, exigiria um `fbq` próprio no ponto de confirmação (`:544`, cartão) e no retorno do PIX. **P1 / opcional** — fora do fix mínimo do funil digital.
- Física avulsa (`CheckoutFisica.tsx`): **mesma lógica**, `value = plan.price`, `paymentId` próprio, disparo em `:364` (cartão) e no retorno do PIX. **P1 / opcional.**
- Dados disponíveis nesses componentes? **SIM** (`amount`/`price` e o id do pagamento retornado pela função). Precisariam da mesma trava de dedupe e guard de `window.fbq`.

## 7. RISCOS

| Risco | Severidade | Mitigação |
|---|---|---|
| `fbq` bloquear/atrasar navegação | Baixa | O snippet do Meta é assíncrono (enfileira chamadas e carrega o script com `async`); `fbq(...)` só faz `push` na fila. Não bloqueia. Ainda assim, disparar **após** a navegação/confirmação, não antes. |
| `window.fbq` ausente (adblock/iOS/CSP) | Média | Guard obrigatório `if (typeof window.fbq === 'function')` antes de chamar. Sem o guard, `window.fbq(...)` lançaria `TypeError` e poderia quebrar o efeito. |
| Interferência com o `gtag` existente | Nenhuma | São globais independentes (`window.fbq` vs `window.gtag`). Podem coexistir no mesmo `useEffect`. |
| Dupla contagem em reload / StrictMode | Média | Trava `localStorage` por `paymentId` + `eventID`. (ver seção 4) |
| Performance | Desprezível | 1 chamada síncrona de enfileiramento por compra. |
| LGPD/consentimento | Média (pré-existente) | O pixel **já carrega e dispara PageView sem consentimento** hoje (`index.html`) — o Purchase não muda a postura de compliance, apenas adiciona um evento ao pixel que já roda. **Não é introduzido por esta mudança**, mas registro: idealmente haver um gerenciador de consentimento (CMP) controlando `init`/eventos; fora do escopo deste fix. O payload proposto não envia PII, o que reduz exposição. |
| Contar compra que não ocorreu | Baixa (na Opção C) | Em C, o disparo é na página de sucesso, após o pagamento já estar aprovado (o funil só chega lá com aprovação). Em B seria maior. |

## 8. IMPLEMENTAÇÃO PROPOSTA (Opção C)

> Proposta de código — **não aplicada**. Dois arquivos: `PagamentoPix.tsx` (persistir amount/planName para o fluxo PIX) e `PaymentSuccessPage.tsx` (ler com fallback, deduplicar, disparar gtag + fbq).

### 8.1 `src/pages/PagamentoPix.tsx` — persistir dados antes do reload

DE (`:80-88`):
```typescript
        // Salvar payment_id para PaymentSuccessPage poder ler
        if (paymentId) {
          localStorage.setItem("recent_payment_id", paymentId);
        }

        toast.success(successMessage || "Pagamento confirmado!");
        setTimeout(() => {
          window.location.href = returnTo || "/upload-documentos";
        }, 2000);
```
PARA:
```typescript
        // Salvar dados para PaymentSuccessPage poder ler (state é perdido no reload)
        if (paymentId) {
          localStorage.setItem("recent_payment_id", paymentId);
          localStorage.setItem("recent_payment_amount", String(amount ?? ""));
        }

        toast.success(successMessage || "Pagamento confirmado!");
        setTimeout(() => {
          window.location.href = returnTo || "/upload-documentos";
        }, 2000);
```
(Nota: `amount` já existe em `:41`. Se quiser `content_name` dinâmico no PIX, persistir também um `recent_payment_plan_name` — opcional; sem ele, cai no fallback fixo.)

### 8.2 `src/pages/PaymentSuccessPage.tsx` — tipo, leitura com fallback e disparo unificado

**(a) Declaração de tipo** — DE (`:13-17`):
```typescript
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}
```
PARA:
```typescript
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}
```

**(b) Fallback de `amount` no localStorage** — no `useEffect` de leitura (`:87-92`), DE:
```typescript
    } else {
      const recentPaymentId = localStorage.getItem("recent_payment_id");
      if (recentPaymentId) {
        setPaymentId(recentPaymentId);
      }
    }
```
PARA:
```typescript
    } else {
      const recentPaymentId = localStorage.getItem("recent_payment_id");
      const recentAmount = localStorage.getItem("recent_payment_amount");
      if (recentPaymentId) {
        setPaymentId(recentPaymentId);
      }
      if (recentAmount && !Number.isNaN(Number(recentAmount))) {
        setAmount(Number(recentAmount));
      }
    }
```

**(c) Efeito de conversão** — DE (`:123-154`, resumido):
```typescript
  useEffect(() => {
    if (!hasLocationState) {
      console.log("[GADS CONV] bloqueado: sem location.state");
      return;
    }
    if (typeof amount !== "number" || !paymentId) { /* log */ return; }
    if (typeof window.gtag !== "function") { /* log */ return; }
    window.gtag("event", "conversion", {
      send_to: "AW-18167800155/wkviCI-zia8cENvCitdD",
      value: amount,
      currency: "BRL",
      transaction_id: paymentId,
    });
  }, [amount, paymentId, hasLocationState]);
```
PARA (remove o guard de `hasLocationState`, adiciona dedupe e fbq):
```typescript
  useEffect(() => {
    // Requer dados válidos (via state OU fallback de localStorage)
    if (typeof amount !== "number" || !paymentId) {
      console.log("[CONV] aguardando amount/paymentId", { amount, paymentId });
      return;
    }

    // Deduplicação: não disparar 2x para a mesma transação (reload/StrictMode)
    const dedupeKey = `purchase_tracked_${paymentId}`;
    if (localStorage.getItem(dedupeKey)) {
      console.log("[CONV] já disparado para", paymentId);
      return;
    }

    // Google Ads
    if (typeof window.gtag === "function") {
      window.gtag("event", "conversion", {
        send_to: "AW-18167800155/wkviCI-zia8cENvCitdD",
        value: amount,
        currency: "BRL",
        transaction_id: paymentId,
      });
      console.log("[GADS CONV] disparado", { paymentId, amount });
    } else {
      console.log("[GADS CONV] window.gtag indisponível");
    }

    // Meta Pixel
    if (typeof window.fbq === "function") {
      window.fbq(
        "track",
        "Purchase",
        {
          value: amount,
          currency: "BRL",
          content_ids: [paymentId],
          content_type: "product",
          content_name: planName || "Carteira Estudantil URE",
        },
        { eventID: paymentId },
      );
      console.log("[META CONV] Purchase disparado", { paymentId, amount });
    } else {
      console.log("[META CONV] window.fbq indisponível");
    }

    // Marca como disparado (após ambos)
    localStorage.setItem(dedupeKey, "1");
  }, [amount, paymentId, planName]);
```

Notas da proposta:
- `hasLocationState` deixa de ser guard de bloqueio; a condição real passa a ser "tenho `amount` numérico + `paymentId`" (que agora chegam também via localStorage no fluxo PIX). A variável `hasLocationState` (`:58`) pode ser removida se não for usada em outro lugar — verificar antes.
- A trava `purchase_tracked_<paymentId>` cobre reload e StrictMode e serve para os dois pixels.
- `eventID: paymentId` prepara dedupe com uma futura Conversions API server-side.
- Guards de `typeof window.xxx === "function"` evitam `TypeError` sob adblock.
- Nenhum PII no payload.

### 8.3 (Opcional / P1) Upsell e física avulsa
Se quiser contabilizar essas vendas, replicar o disparo (com o mesmo guard + dedupe por `paymentId`) nos pontos de confirmação de `Checkout.tsx` (`:544`, e retorno do PIX) e `CheckoutFisica.tsx` (`:364`, e retorno do PIX), usando `value = resolvedUpsell.amount` / `plan.price`. Como esses fluxos não passam por PaymentSuccessPage, o disparo tem de ser local a eles. Recomendo, se for fazer, extrair um helper `trackPurchase({ paymentId, amount, planName })` em `src/lib/` para não duplicar a lógica de guard/dedupe/gtag/fbq nos 3 lugares.

## Recomendação final
Aplicar a **Opção C** (8.1 + 8.2): corrige de uma só vez a conversão do Google Ads **e** adiciona o Meta Purchase, cobrindo cartão e PIX, com deduplicação e sem tocar no comportamento de reload do PIX. Upsell/física ficam como P1 opcional via helper compartilhado. Depois, validar com uma compra de teste (cartão e PIX) observando os logs `[GADS CONV]`/`[META CONV]` no console e o Events Manager do Meta (Test Events).
