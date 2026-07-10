# Verificação: Injetar Data Atual na Validação de Documentos (Gemini)

Data: 2026-07-10
Modo: SOMENTE LEITURA (nenhum arquivo alterado)
Arquivo analisado: `supabase/functions/validate-document-v2/index.ts`

> Confirmação central: a validação de data é **100% delegada ao LLM** (Gemini 2.5 Flash via
> OpenRouter), e o prompt **nunca informa que dia é hoje**. `new Date()` só é usado para gravar
> `validated_at` no banco ([:85](supabase/functions/validate-document-v2/index.ts#L85), [:103](supabase/functions/validate-document-v2/index.ts#L103), [:639](supabase/functions/validate-document-v2/index.ts#L639)) — **nunca** é passado ao modelo. Sem referência
> temporal, o modelo trata datas de 2026 como "futuras" e rejeita documentos válidos com alta confiança.

---

## 1. PROMPT ATUAL

- **Não existe "system prompt" separado.** Toda a instrução é enviada como **um único bloco de
  texto no papel `user`**, junto da imagem/PDF ([validateWithClaudeImage:487-496](supabase/functions/validate-document-v2/index.ts#L487),
  [validateWithClaudePdf:531-543](supabase/functions/validate-document-v2/index.ts#L531)). Não há `role: 'system'`.
- **Montagem**: `getPromptForType(type, profileCtx, imageCount)` ([:164](supabase/functions/validate-document-v2/index.ts#L164)) devolve um prompt
  específico por tipo, embrulhado por um `basePrompt` ([:452-465](supabase/functions/validate-document-v2/index.ts#L452)) que apenas reforça o
  formato JSON.

- **User prompt (inclui dados do estudante?)**: SIM — o prompt de `matricula` injeta nome/instituição/curso
  ([:281-284](supabase/functions/validate-document-v2/index.ts#L281)) e o de `rg` injeta nome/CPF ([:333-336](supabase/functions/validate-document-v2/index.ts#L333)), vindos de
  `profileCtx` (`student_profiles`, select em [:153-157](supabase/functions/validate-document-v2/index.ts#L153)). **Nenhuma data de referência é injetada.**

- **Busca por data/hoje/today/current/now/Date/toLocale**: as únicas ocorrências são
  `new Date().toISOString()` para `validated_at` (gravação no banco) e strings `data:` de data-URI
  de imagem/PDF. **Zero** referência à data atual no texto enviado ao modelo.

- **Data atual informada ao modelo**: **NÃO.**

---

## 2. REGRAS DE DATA

- **Regra existente (matrícula)** — [:290](supabase/functions/validate-document-v2/index.ts#L290) e [:296](supabase/functions/validate-document-v2/index.ts#L296):
  - APROVAR SE: "Data/período **ATUAL ou recente (máximo 6 meses atrás)**"
  - REJEITAR SE: "Documento com **mais de 6 meses**"
  - Mensagens de exemplo em [:310](supabase/functions/validate-document-v2/index.ts#L310) e [:314](supabase/functions/validate-document-v2/index.ts#L314).
- **Regra existente (RG/CNH/Passaporte)** — [:342](supabase/functions/validate-document-v2/index.ts#L342), [:361](supabase/functions/validate-document-v2/index.ts#L361), [:375](supabase/functions/validate-document-v2/index.ts#L375):
  - "Valide nome, CPF (se visível) e **validade**"; REJEITAR SE "**Documento vencido**".
- **foto** e **selfie**: **não têm** regra de data.
- **Aplicável sem a data atual?**: **NÃO.** "Máximo 6 meses atrás", "atual", "vencido" são todos
  relativos a *hoje* — sem saber a data de referência, o modelo:
  - trata qualquer 2026 como futuro → rejeita como "data futura" (caso relatado do 09/07/2026);
  - não consegue calcular corretamente a janela de 6 meses.
- **Regras diferentes por tipo?**: SIM — matrícula usa janela de 6 meses; RG usa "dentro da validade"
  (data de validade impressa no próprio documento, não os 6 meses). São critérios distintos.

---

## 3. ONDE INJETAR A DATA

- **Ponto recomendado**: no **`basePrompt`** ([:452-465](supabase/functions/validate-document-v2/index.ts#L452)), que embrulha **todos** os tipos —
  assim a data de referência vale para matrícula e RG de uma vez, calculada **uma única vez** por
  requisição. (Injetar no prompt específico de matrícula também funciona, mas ficaria duplicado e
  deixaria o RG sem referência.) Como não há papel `system`, o local natural é esse texto de usuário.
- **Formato recomendado** (minimizar ambiguidade para o LLM): **texto por extenso + ISO**, e também
  a **data de corte** já calculada, para o modelo não precisar fazer aritmética de calendário:
  - Ex.: `hoje é 10 de julho de 2026 (10/07/2026, ISO 2026-07-10)`; e para matrícula,
    `a data mais antiga aceitável é 10 de janeiro de 2026 (10/01/2026)`.
  - Evitar depender só de `DD/MM/YYYY` cru (ambíguo com `MM/DD`); o mês por extenso remove a dúvida.
- **Timezone**: **America/Sao_Paulo**. O Deno roda em **UTC** por padrão — se usar `new Date()` sem
  timezone, à noite no Brasil o UTC já virou o dia seguinte, o que *reintroduziria* erro de "data futura".
  Usar explicitamente `timeZone: 'America/Sao_Paulo'`.
- **Código sugerido** (cálculo da referência, sem alterar nada agora):
  ```ts
  const tz = 'America/Sao_Paulo';
  const now = new Date();
  const hojeExtenso = now.toLocaleDateString('pt-BR', {
    timeZone: tz, day: '2-digit', month: 'long', year: 'numeric'
  }); // ex.: "10 de julho de 2026"
  const hojeISO = new Date(now.toLocaleString('en-US', { timeZone: tz }))
    .toISOString().slice(0, 10); // "2026-07-10"
  const seisMesesAtras = new Date(now);
  seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);
  const corteBR = seisMesesAtras.toLocaleDateString('pt-BR', { timeZone: tz }); // "10/01/2026"
  ```

---

## 4. MELHORIAS NO PROMPT

| Melhoria | Impacto | Prioridade |
|---|---|---|
| Injetar **data de referência** (hoje) no `basePrompt` | Resolve o falso "data futura" — causa raiz | **ALTA** |
| Fornecer a **data de corte** (6 meses atrás) já calculada | Remove aritmética de calendário do LLM (fonte de alucinação) | **ALTA** |
| Fixar **timezone America/Sao_Paulo** | Evita virada de dia em UTC reintroduzir o bug | **ALTA** |
| Instruir que **DD/MM/AAAA é padrão BR** (não MM/DD) | Evita ler 09/07 como 7 de setembro | MÉDIA |
| Definir **tolerância** para datas até ~1–2 dias à frente (timezone/emissão) | Evita rejeitar documento emitido "ontem/hoje" por diferença de fuso | MÉDIA |
| Mandar o modelo **extrair e reportar a data ANTES de julgar** (já há `extracted_data.date` em [:325](supabase/functions/validate-document-v2/index.ts#L325)) | Reduz alucinação: primeiro "encontrei 09/07/2026", depois aplica a regra | MÉDIA |
| Deixar claro que a regra de 6 meses é **relativa à data de referência** | Cálculo correto e explicável | MÉDIA |
| Manter regra de RG separada (validade impressa ≠ 6 meses) | Não confundir critérios entre tipos | BAIXA |

---

## 5. RESPOSTA DO MODELO

- **Formato**: **JSON** (`response_format: { type: 'json_object' }`, [:486](supabase/functions/validate-document-v2/index.ts#L486)/[:530](supabase/functions/validate-document-v2/index.ts#L530)),
  parseado por `parseResponse()` ([:573-618](supabase/functions/validate-document-v2/index.ts#L573)). Campos: `valid`, `confidence` (0-100),
  `recommendation` (`approved`/`rejected`/`review`), `reason`, `issues[]` (+ `extracted_data` nos
  prompts de matrícula/rg).
- **`reason`**: **texto livre** do modelo (string). O `parseResponse` só valida que é string não vazia
  ([:601-604](supabase/functions/validate-document-v2/index.ts#L601)); é ele que vira `documents.rejection_reason` quando `rejected` ([:637](supabase/functions/validate-document-v2/index.ts#L637)).
- **`recommendation`**: enum de 3 valores (mapeado para status `approved`/`rejected`/`pending` em [:621-627](supabase/functions/validate-document-v2/index.ts#L621)).
- **`confidence: 95` com `rejected`**: confirma que **não é ambiguidade** — o modelo está *convicto* de
  que a data é futura. É exatamente o sintoma de **falta de referência temporal**: dado o corte de
  conhecimento do modelo, 2026 "parece" futuro. Injetar a data hoje deve derrubar esse falso positivo.

---

## 6. OUTROS DOCUMENTOS

- **matrícula**: afetado (regra de 6 meses) — **é o caso relatado**.
- **RG/CNH/Passaporte**: **afetado potencialmente** — o prompt pede checar "validade"/"vencido"
  ([:342](supabase/functions/validate-document-v2/index.ts#L342), [:361](supabase/functions/validate-document-v2/index.ts#L361)). Sem data de referência, uma CNH com validade em 2027/2028 pode ser
  lida como "data futura suspeita" ou o modelo pode errar o cálculo de vencimento. Menos frequente que
  matrícula, mas mesma raiz.
- **foto 3x4** e **selfie**: **não afetados** (sem regra de data).
- Conclusão: injetar a data no `basePrompt` (que envolve todos) beneficia matrícula e RG de uma vez,
  sem risco para foto/selfie.

---

## 7. PROPOSTA FINAL

### DE → PARA

**DE** — `basePrompt` atual ([:452-465](supabase/functions/validate-document-v2/index.ts#L452)):
```ts
  const basePrompt = `
${specific}

IMPORTANTE: Responda APENAS com JSON válido no formato:
{
  "valid": true | false,
  "confidence": 0-100,
  "recommendation": "approved" | "rejected" | "review",
  "reason": "Explicação clara",
  "issues": ["problema1", "problema2"]
}
`
```

**PARA** — com bloco de data de referência no topo (aplicado a todos os tipos):
```ts
  const tz = 'America/Sao_Paulo';
  const _now = new Date();
  const hojeExtenso = _now.toLocaleDateString('pt-BR', { timeZone: tz, day: '2-digit', month: 'long', year: 'numeric' });
  const hojeBR = _now.toLocaleDateString('pt-BR', { timeZone: tz });
  const _corte = new Date(_now); _corte.setMonth(_corte.getMonth() - 6);
  const corteBR = _corte.toLocaleDateString('pt-BR', { timeZone: tz });

  const basePrompt = `
DATA DE REFERÊNCIA (IMPORTANTE): hoje é ${hojeExtenso} (${hojeBR}, timezone America/Sao_Paulo).
- Use SEMPRE esta data como "hoje". NÃO trate datas de ${_now.getFullYear()} como futuras.
- Datas no formato DD/MM/AAAA são padrão brasileiro (dia/mês/ano), NÃO mês/dia.
- Uma data é "futura" apenas se for POSTERIOR a ${hojeBR}. Tolere até 2 dias à frente (diferença de fuso/emissão).
- Para comprovante de matrícula: aceite datas entre ${corteBR} e ${hojeBR} (últimos 6 meses). Rejeite por antiguidade só se for ANTERIOR a ${corteBR}.
- Antes de julgar, EXTRAIA a data do documento e informe-a em extracted_data.date; só então aplique a regra.

${specific}

IMPORTANTE: Responda APENAS com JSON válido no formato:
{
  "valid": true | false,
  "confidence": 0-100,
  "recommendation": "approved" | "rejected" | "review",
  "reason": "Explicação clara",
  "issues": ["problema1", "problema2"]
}
`
```

### Respostas da seção 7 do pedido

- **(a) Resolve o 09/07/2026 rejeitado como futuro?** SIM. Com "hoje é 10/07/2026" explícito, 09/07/2026
  passa a ser *ontem* (dentro da janela) — o falso "data futura" desaparece. A tolerância de 2 dias
  ainda cobre documentos emitidos "hoje/amanhã" por diferença de fuso.
- **(b) Risco de passar a aceitar documento realmente vencido?** BAIXO e controlado: a data de corte
  (`corteBR`) é fornecida explicitamente, então a regra de 6 meses fica *mais* precisa, não mais frouxa.
  Documento anterior a `corteBR` continua sendo rejeitado — agora com cálculo correto. Vale validar com
  alguns casos reais após aplicar.
- **(c) Outros tipos afetados?** Positivamente o RG/CNH (a referência temporal ajuda a julgar validade
  sem achar que 2027/2028 é "suspeito"). foto/selfie: sem efeito (não têm regra de data).

### Observação de escopo
Esta é a correção **de prompt** (mínima, resolve o falso "data futura"). Ela é **independente** e
complementar da limitação já documentada de leitura de PDF (o modelo pode não *ler* bem a data em
PDF sem OCR — ver `docs/verificacao-rejeicao-documentos-2026-07-10.md`). Injetar a data resolve o caso
"data válida lida corretamente mas julgada como futura"; não substitui o gate/rasterização de PDF.

---

### Anexo — mapa de linhas
| Item | Linha |
|---|---|
| Montagem do prompt (`getPromptForType`) | [:164](supabase/functions/validate-document-v2/index.ts#L164), [:216](supabase/functions/validate-document-v2/index.ts#L216) |
| `basePrompt` (ponto de injeção recomendado) | [:452-465](supabase/functions/validate-document-v2/index.ts#L452) |
| Regra 6 meses (matrícula) | [:290](supabase/functions/validate-document-v2/index.ts#L290), [:296](supabase/functions/validate-document-v2/index.ts#L296) |
| Regra validade (RG) | [:342](supabase/functions/validate-document-v2/index.ts#L342), [:361](supabase/functions/validate-document-v2/index.ts#L361) |
| `extracted_data.date` (já existe) | [:325](supabase/functions/validate-document-v2/index.ts#L325) |
| Envio ao modelo (user role único) | [:487-496](supabase/functions/validate-document-v2/index.ts#L487), [:531-543](supabase/functions/validate-document-v2/index.ts#L531) |
| `parseResponse` / formato de saída | [:573-618](supabase/functions/validate-document-v2/index.ts#L573) |
| `new Date()` só p/ banco (não vai ao modelo) | [:85](supabase/functions/validate-document-v2/index.ts#L85), [:103](supabase/functions/validate-document-v2/index.ts#L103), [:639](supabase/functions/validate-document-v2/index.ts#L639) |
