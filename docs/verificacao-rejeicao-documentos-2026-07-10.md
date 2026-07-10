# Verificação: Por que documentos estão sendo rejeitados?

Data: 2026-07-10
Modo: SOMENTE LEITURA (nenhum arquivo de código alterado)
Escopo: fluxo completo de upload → validação → rejeição de documentos, com foco em PDF (comprovante de matrícula).

> Nota de método: todas as afirmações abaixo referenciam arquivo:linha do repositório.
> A seção 6 (histórico do estudante) exige consulta ao banco em produção; **não há conexão de
> banco disponível neste ambiente**, portanto a query está fornecida mas não executada.

---

## 1. FLUXO DE VALIDAÇÃO

- **Upload**: componente `src/pages/UploadDocumentos.tsx` (função `handleUpload`, a partir de `:773`).
- **Formatos aceitos** (definidos em `documentConfigs`, `:92-121`):
  - `matricula` → **JPG, PNG e PDF** (`:97`)
  - `rg` → **apenas JPG/PNG** (`:104`) — PDF é bloqueado na prática pela checagem `config.acceptedTypes.includes(fileToUpload.type)` em `:830`
  - `foto` → apenas JPG/PNG (`:111`)
  - `selfie` → apenas JPG/PNG (`:118`)
- **Conversão para imagem antes de validar?** NÃO. Imagens grandes são só comprimidas (`compressImage`, `:814-819`); o **PDF é enviado como está**, sem rasterização. O arquivo vai direto ao Storage (`filePath = ${user.id}/${type}/${Date.now()}.${ext}`, `:842`) e um registro `documents` com `status: 'pending'` é criado (`:878-888`).
- **Validação**: **100% automática por IA** — não há aprovação manual no caminho principal.
  - Trigger SQL `trigger_validate_document()` dispara quando `documents.status = 'pending'` e chama a Edge Function `validate-document-v2` via `pg_net` (`supabase/migrations/20260202_secure_triggers_and_move_pgnet.sql:11-39`, condição em `:26`).
- **Serviço usado**: **OpenRouter → modelo `google/gemini-2.5-flash`**, `temperature: 0`, `response_format: json_object` (`supabase/functions/validate-document-v2/index.ts:484` imagem e `:528` PDF).

**Conclusão**: o veredito de aprovar/rejeitar é decisão do LLM Gemini. Não há OCR/regex/parser próprio no código.

---

## 2. TABELA DOCUMENTS

Campos (de `src/integrations/supabase/types.ts:78-160`):

| Campo | Observação |
|---|---|
| `status` | enum `document_status` (valores usados no runtime: `pending`, `approved`, `rejected`) |
| `rejection_reason` (text) | **SIM — este é o campo de motivo da rejeição** |
| `rejection_notes` (text) | notas adicionais (uso admin) |
| `rejection_reason_id` (fk → `rejection_reasons`) | motivo catalogado (uso admin) |
| `validated_at` | timestamp da validação |
| `validated_by` | quem validou (null quando automático) |
| `file_url`, `file_name`, `file_size`, `mime_type`, `type`, `student_id` | metadados do arquivo |

- **Campo de motivo de rejeição**: SIM — `rejection_reason` (preenchido só quando `recommendation === 'rejected'`, `validate-document-v2/index.ts:637`).
- **Campo de data do documento (`document_date`/`expiry_date`)**: **NÃO EXISTE.** A tabela não guarda nenhuma data do conteúdo do documento. Nenhuma data extraída é persistida.
- **Como o status é atualizado**: `updateDocumentStatus()` mapeia `approved→approved`, `rejected→rejected`, **`review→pending`** (`:621-640`).
- **Quem/o que atualiza**: a própria Edge Function `validate-document-v2` (automático). Admin pode atualizar manualmente via painel (seção 7), mas o caminho padrão é a IA.

> Drift observado: a Edge Function grava `validation_confidence` (`:638`) e o frontend lê/grava `file_url_back` (`:863`), **mas nenhum desses campos aparece em `types.ts`** — os tipos gerados estão desatualizados.

---

## 3. PDF vs IMAGEM

- **Tratamento diferenciado**: SIM.
  - Imagem → `validateWithClaudeImage()` envia como `image_url` data-URI (`:491`), lida pela visão do Gemini.
  - PDF → `validateWithClaudePdf()` envia como `type: 'file'` com `file_data: data:application/pdf;base64,...` (`:535-540`).
- **Conversão PDF→imagem**: NÃO. O PDF é entregue ao OpenRouter em base64, sem rasterização local.
- **Multi-página**: não há seleção de página no código; o processamento de páginas fica a cargo do parser do OpenRouter/modelo.
- **Texto embutido vs escaneado**: aqui está o ponto crítico ⬇️

**PROBLEMA IDENTIFICADO (alta probabilidade):**
Na chamada de PDF (`:527-545`) **não é passada nenhuma configuração `plugins`/`engine` de parsing** (grep por `plugins|engine|pdf-text|mistral-ocr|file-parser` retornou **zero** ocorrências em todo `supabase/functions/`). Ou seja, o parsing do PDF depende inteiramente do comportamento **default** do OpenRouter para o tipo `file`. Consequências práticas:

- Para PDF **nativo de texto** (declaração gerada pelo portal da faculdade), o engine de texto padrão costuma extrair bem — mas entrega **texto sem layout**; a data e o timbre/logo (elementos visuais que o prompt exige — "papel timbrado, logo, carimbo", `:287`) podem **não chegar ao modelo como imagem**, fazendo o Gemini concluir que "não é documento oficial" ou que "não consegue confirmar a data".
- Para PDF **escaneado/imagem** sem OCR configurado, o texto extraído pode vir **vazio ou corrompido** → o modelo não lê a data nem o nome → rejeição.
- O resultado é **não-determinístico entre PDF e imagem do mesmo documento**: a mesma matrícula enviada como JPG (lida pela visão) tende a passar, e como PDF pode falhar.

---

## 4. EDGE FUNCTIONS

Todas em `supabase/functions/` relacionadas a documento:

| Função | Propósito | Quando é chamada | Critério de rejeição | PDF vs imagem |
|---|---|---|---|---|
| `validate-document-v2` | Valida rg/matricula/foto/selfie via Gemini | Trigger `trigger_validate_document` em `documents.status='pending'` + HTTP direto | LLM retorna `recommendation: rejected`; ou tipo de arquivo inválido (`:79-113`) | Caminhos separados (`:169-175`); PDF sem OCR explícito |
| `compare-faces` | Comparação facial (rg/foto/selfie) | Trigger `trigger_compare_faces` quando ≥3 docs aprovados (`migration ...:58-75`) | Faces não conferem | só imagens |
| `cleanup-rejected-documents` | **DELETA** docs `rejected` com mais de **90 dias** (`:66-80`) | Cron/HTTP admin | não valida — apaga | n/a |
| `verify-student-card` | Verificação pública da carteirinha | HTTP público | n/a | n/a |
| `generate-digital-card` | Geração da carteirinha | HTTP | n/a | n/a |

Observações:
- **Não existem** funções `analyze-document`, `verify-document`, `check-document`, `review-document`, `approve-document`, `ocr` ou `vision` separadas. Toda a análise está em `validate-document-v2`.
- Nenhum serviço de OCR/Vision dedicado (Google Vision, AWS Textract, etc.). A "visão" é a do próprio Gemini via OpenRouter.
- Bug estrutural em `cleanup-rejected-documents:49`: usa `supabase.auth.getUser(token)` **antes** de instanciar o client (`createClient` só em `:61`) — a função quebraria se chamada; não afeta a rejeição, mas registra risco.

---

## 5. LÓGICA DE DATA

- **Como a data é extraída**: **não há extração de data no código.** Nenhum regex, nenhum parse de metadata de PDF, nenhuma coluna de data. A checagem de data é **inteiramente delegada ao prompt do LLM**.
- **Regra de validade** (prompt de `matricula`, `validate-document-v2/index.ts:290` e `:296`):
  - APROVAR se "Data/período ATUAL ou recente (**máximo 6 meses atrás**)".
  - REJEITAR se "Documento com **mais de 6 meses**".
  - **Não há** regra de "data futura" nem de "documento expirado" além dos 6 meses.
- **Comportamento quando a data não é encontrada**: **indefinido/perigoso.** Não existe fallback no código. O modelo decide livremente:
  - Se não consegue ler a data no PDF, pode retornar `rejected` (achando que não é oficial/recente) **ou** `review` (→ vira `status: pending`, ficando preso sem avançar). Ambos frustram o aluno.

**Ponto-chave para o caso relatado**: uma declaração **gerada hoje** está claramente dentro dos 6 meses — **a regra de data não deveria rejeitá-la**. Logo, se ela está sendo rejeitada, a causa provável **não é "documento expirado"**, e sim:
1. o modelo **não conseguiu ler a data** no PDF (parsing) e concluiu que não dá para confirmar recência/officialidade; **ou**
2. rejeição por **NOME/INSTITUIÇÃO divergente** do cadastro — o prompt manda ser "rigoroso" nessa conferência (`:301`), e diferença de acento, nome social, sigla vs. nome completo, ou instituição digitada diferente no cadastro dispara rejeição; **ou**
3. o parser entregou texto sem os elementos visuais (timbre/logo) → "não é documento oficial".

---

## 6. HISTÓRICO DO ESTUDANTE

**Não executável neste ambiente** (sem conexão com o banco de produção). Além disso, o schema real usa `student_id` (não `student_id` numérico) e **não possui** coluna de motivo em `documents` além de `rejection_reason`. Query correta a rodar no SQL editor do Supabase:

```sql
SELECT type, status, rejection_reason, validation_confidence,
       mime_type, created_at, validated_at
FROM documents
WHERE student_id = 'c6044eb8-aefb-43ad-8ec1-d4d3908164e0'
ORDER BY created_at DESC;
```

E para ver o veredito bruto da IA (motivo real, mesmo quando `rejection_reason` foi limpo):

```sql
SELECT resource_id, details, created_at
FROM audit_logs
WHERE action = 'document_validation'
  AND student_id = 'c6044eb8-aefb-43ad-8ec1-d4d3908164e0'
ORDER BY created_at DESC;
```

> `audit_logs.details` guarda `{ type, result, confidence, issues, reason }` gravado em `validate-document-v2/index.ts:662-677` — é a melhor fonte para saber **exatamente** por que cada documento foi rejeitado, inclusive o `mime_type` (para confirmar se foi PDF).

Recomendação: comparar `mime_type` das rejeições. Se as rejeições concentram-se em `application/pdf`, confirma a hipótese de parsing de PDF.

---

## 7. ADMIN

- **Painel existe**: SIM — `src/admin/pages/Documents.tsx`, componentes `DocumentReview/DocumentCard`, `ApprovalModal`, `RejectModal`.
- O painel lê a view `pending_documents_queue` (`Documents.tsx:21-24`) — ou seja, mostra **apenas documentos `pending`**, para revisão manual complementar.
- **A rejeição do caso foi automática ou manual?**: quase certamente **automática** (IA). A rejeição via IA seta `status='rejected'` e `validated_by=null`; rejeição manual passaria pelo `RejectModal` e preencheria `validated_by`/`rejection_reason_id`. Confirmar com a query de `audit_logs` acima (`result: 'rejected'` = automático).
- **Admin vê PDF inline?**: depende do `DocumentCard` de admin (não detalhado aqui); o arquivo é servido do bucket `documents`. Documentos auto-rejeitados **nem chegam à fila** `pending_documents_queue`, então o admin **não os revê** por padrão — o aluno precisa reenviar.

---

## 8. DIAGNÓSTICO

**Causa provável das rejeições:**
A validação é 100% feita pelo Gemini 2.5 Flash, e o **PDF é enviado sem nenhum engine de OCR/parsing configurado** (nenhum bloco `plugins`/`engine` em `validate-document-v2`). Para PDFs — que no fluxo são justamente o **comprovante de matrícula** (único tipo que aceita PDF) — o modelo frequentemente recebe texto sem layout ou conteúdo mal extraído, e:
- não consegue confirmar a **data** (concluindo que não é "atual/recente" ou não oficial), e/ou
- não "vê" timbre/logo/carimbo exigidos pelo prompt como documento oficial.

Isso explica por que **uma declaração válida gerada hoje é rejeitada**: não é a regra de 6 meses (ela passaria), e sim o **modelo não lendo corretamente o PDF**. A mesma declaração enviada como **imagem (JPG/PNG)** — lida pela visão nativa do Gemini — tende a passar.

**Problema específico com PDF**: SIM.
1. PDF entregue ao OpenRouter **sem `plugins.pdf.engine`** → parsing default, sem OCR garantido (`validate-document-v2/index.ts:527-545`).
2. Ao contrário da imagem, o PDF não passa pela visão do modelo como página renderizada, então elementos visuais (timbre, data em cabeçalho gráfico) podem se perder.
3. Nenhum fallback: se a data não é lida, o código não trata — o veredito do LLM é final (`rejected` ou `review→pending`).

**Fatores secundários (também causam rejeição de documento válido):**
- Conferência **rigorosa** de nome/instituição contra o cadastro (`:301`): acento, nome social, sigla vs. nome completo → rejeição.
- Regra dos **6 meses** para matrícula é subjetiva quando a data não é lida com clareza.
- `recommendation: 'review'` vira `status: 'pending'` — o aluno pode ficar **preso** (nem aprovado, nem rejeitado), o que também é percebido como "rejeição sem motivo".

**Recomendações (para uma fase de correção posterior — nenhuma alteração feita agora):**
1. **Confirmar a hipótese com dados**: rodar as queries da seção 6 e cruzar `status='rejected'` × `mime_type`. Se as rejeições concentram em `application/pdf`, o problema é o parsing.
2. **Rasterizar PDF → imagem** antes de validar (converter a 1ª página em PNG e mandar pela via `image_url`, igual às imagens), OU passar `plugins` com engine de OCR (`mistral-ocr`) na chamada de PDF do OpenRouter.
3. **Padronizar o caminho**: fazer PDF e imagem seguirem a mesma via visual, eliminando o comportamento divergente.
4. **Tratar `review`**: definir explicitamente o que acontece quando `recommendation='review'` para o aluno não ficar preso em `pending`.
5. **Suavizar a conferência de nome/instituição** (tolerância a acento/nome social/sigla) e/ou mandar para fila admin em vez de auto-rejeitar em caso de divergência de identidade.
6. Curto prazo/UX: orientar o aluno a **enviar foto/print (JPG) da declaração** em vez de PDF, como contorno imediato.

---

### Anexo — mapa de arquivos

| Papel | Arquivo:linha |
|---|---|
| Upload (frontend) | `src/pages/UploadDocumentos.tsx:773-912` |
| Formatos aceitos | `src/pages/UploadDocumentos.tsx:92-121` |
| Trigger de validação | `supabase/migrations/20260202_secure_triggers_and_move_pgnet.sql:11-39` |
| Validação por IA | `supabase/functions/validate-document-v2/index.ts` |
| Prompt matrícula (regra de data) | `validate-document-v2/index.ts:279-329` |
| Envio de PDF (sem OCR) | `validate-document-v2/index.ts:518-563` |
| Update de status + rejection_reason | `validate-document-v2/index.ts:620-647` |
| Audit log (motivo real) | `validate-document-v2/index.ts:662-678` |
| Limpeza (delete 90d) | `supabase/functions/cleanup-rejected-documents/index.ts:66-138` |
| Painel admin | `src/admin/pages/Documents.tsx` |
| Schema documents | `src/integrations/supabase/types.ts:78-160` |
