# Verificação: Remover Aceitação de PDF no Upload de Documentos

Data: 2026-07-10
Modo: SOMENTE LEITURA (nenhum arquivo de código alterado)
Objetivo: mapear tudo que precisa mudar para aceitar apenas imagens (JPG/PNG) no upload de documentos, removendo PDF.

> Todas as afirmações referenciam arquivo:linha. Consultas ao banco de produção não são
> executáveis neste ambiente; onde relevante, isso está indicado.

---

## 1. COMPONENTES DE UPLOAD

Único fluxo de upload de **documentos do onboarding**: `src/pages/UploadDocumentos.tsx`.

| Componente | Arquivo:linha | Formatos aceitos |
|---|---|---|
| Config `matricula` | `src/pages/UploadDocumentos.tsx:97` | **JPG, PNG, PDF** |
| Config `rg` | `src/pages/UploadDocumentos.tsx:104` | JPG, PNG |
| Config `foto` | `src/pages/UploadDocumentos.tsx:111` | JPG, PNG |
| Config `selfie` | `src/pages/UploadDocumentos.tsx:118` | JPG, PNG |
| `<input type="file" accept={config.acceptedTypes.join(',')}>` | `src/pages/UploadDocumentos.tsx:535-536` | deriva das configs acima |
| Validação no `handleUpload` | `src/pages/UploadDocumentos.tsx:786-804` | permite PDF para `rg`/`matricula` (`:788`) |
| Segundo lado do RG (`handleAddRgSecondSide`) | `src/pages/UploadDocumentos.tsx:940` | **aceita PDF** (`secondFile.type !== 'application/pdf'`) |
| Helper text de formatos | `src/pages/UploadDocumentos.tsx:445-448` | mostra os `acceptedTypes` ao usuário |

**Outros `type="file"` no projeto (NÃO são documentos do onboarding — fora do escopo):**
- `src/components/SupportModal.tsx:413-414` → anexo de suporte, `accept="image/jpeg,image/png"` (já sem PDF)
- `src/components/TicketChat.tsx:220`, `src/components/NovoTicketModal.tsx:189` → anexos de chat/ticket
- `src/admin/components/PaymentManagement/MarkPaidModal.tsx:118` → comprovante de pagamento (admin)

Nenhum desses toca no fluxo de validação por IA. Não há dropzone de biblioteca externa; o único "drop" é o `handleDrop` manual em `UploadDocumentos.tsx:150-161`.

---

## 2. CAMPOS QUE ACEITAM PDF

| Campo | Aceita PDF hoje? | Aceita imagem? | Único? |
|---|---|---|---|
| Comprovante de matrícula | **SIM** (`:97`, `:788`) | SIM | — |
| RG / identidade (upload principal) | NÃO — bloqueado em `:830` (`acceptedTypes` do RG não inclui PDF) | SIM | — |
| RG (segundo lado, `handleAddRgSecondSide`) | **SIM** (`:940`) — inconsistência | SIM | — |
| Foto 3x4 | NÃO | SIM | — |
| Selfie | NÃO (só câmera) | SIM | — |

**O comprovante de matrícula é o único campo com PDF na config principal**, MAS o **segundo lado do RG também aceita PDF** por um check independente (`:940`) que não passa pela lista `acceptedTypes`. Ou seja: **não é totalmente único** — há dois caminhos que aceitam PDF.

> Observação: o backend (`validate-document-v2/index.ts:97`) aceita PDF para `rg` **e** `matricula`. Então, embora o RG principal bloqueie PDF no front, o backend continuaria aceitando um PDF de RG enviado por outra via (ex.: segundo lado ou chamada direta).

---

## 3. VALIDAÇÃO FRONTEND

- **Onde valida**: no `handleUpload`, **antes do upload** ao Storage:
  - Tipo por documento: `:779-797` (foto/selfie só imagem; rg/matricula imagem ou PDF).
  - Tamanho: `:799-803` (máx 3MB para rg/matricula) e novamente `:827-829` (`config.maxSizeMB`).
  - Whitelist final: `:830` `if (!config.acceptedTypes.includes(fileToUpload.type)) throw 'Tipo de arquivo não aceito'`.
  - O `accept` do input (`:536`) apenas filtra o seletor nativo — **não** é validação de segurança.
- **Mensagem de erro** (formato inválido):
  - matrícula: `"Apenas imagens ou PDFs são aceitos para Matrícula"` (`:794`)
  - rg: `"Apenas imagens JPG ou PNG são aceitas para o RG"` (`:793`)
  - foto/selfie: `"Apenas imagens são aceitas para este documento"` (`:781`)
  - genérica (whitelist): `"Tipo de arquivo não aceito"` (`:831`)
- **Validação de tamanho**: SIM — máx 3MB (rg/matricula) / 5MB (foto/selfie), `:799-803` e `:827`.
- **Mostra formatos aceitos ao usuário**: SIM — helper text derivado de `acceptedTypes` em `:445-448` (renderiza "JPEG, PNG, PDF • Máx 3MB" para matrícula).

---

## 4. VALIDAÇÃO BACKEND

- **Edge function valida mime**: SIM, parcialmente. `validate-document-v2`:
  - `mimeType = file.type || guessMimeType(file_url)` (`:70`), `isImage`/`isPdf` (`:71-72`).
  - Rejeita não-imagem para foto/selfie (`:79-95`).
  - Para rg/matricula, rejeita **apenas** se não for imagem **nem** PDF (`:97-113`) — ou seja, **PDF é aceito** para ambos.
- **Risco de upload via API direta**: SIM. Se o frontend remover PDF mas o backend (`:97`) continuar aceitando PDF para rg/matricula, um PDF enviado direto ao Storage + insert em `documents` (RLS permite o próprio aluno) ainda seria validado como PDF. Para fechar de verdade, é preciso endurecer o backend.
- **Storage policy de mime type**: **NÃO EXISTE.** Grep por `allowed_mime_types`/`storage.buckets`/`file_size_limit` nas migrations retornou **zero** ocorrências — a criação do bucket `documents` não está versionada e não há restrição de mime no servidor. Qualquer mime é aceito pelo Storage.

---

## 5. EDGE FUNCTION — TRATAMENTO PDF

Bloco de diferenciação (`supabase/functions/validate-document-v2/index.ts`):

- Detecção: `:70-72`
- Gate de tipo por documento: `:79-113` (rg/matricula aceitam PDF em `:97`)
- Roteamento imagem vs PDF: `:169-175`
  ```
  if (isImage)      → validateWithClaudeImage(...)   // envia como image_url (visão)  :169-170
  else if (isPdf)   → validateWithClaudePdf(...)     // envia como type:'file' (texto) :171-172
  else              → throw 'Tipo não suportado'      :173-174
  ```
- Função de imagem: `validateWithClaudeImage` `:468-516` → `image_url` data-URI `:491`
- Função de PDF: `validateWithClaudePdf` `:518-563` → `type: 'file'`, `file_data: data:application/pdf;base64` `:536-539` (**esta é a via que falha** — sem OCR/visão)
- `guessMimeType` inclui `pdf` `:649-660`

**Pode remover o bloco de PDF?**
- **Recomendado NÃO deletar, e sim converter em rejeição defensiva.** Se a política passa a ser "só imagem", o caminho seguro é: para rg/matricula, tratar PDF como tipo inválido (rejeitar com mensagem amigável), em vez de mandar ao Gemini. Isso:
  - fecha o vetor de API direta (seção 4),
  - garante rejeição **clara** ("envie foto/print, não PDF") em vez de rejeição errática da IA.
- A função `validateWithClaudePdf` (`:518-563`) e o `guessMimeType` do pdf podem ser removidos **depois** que o gate rejeitar PDF, mas mantê-los é inofensivo. Nenhum outro tipo usa PDF.
- **Validação de mime antes do Gemini**: existe hoje (`:79-113`), mas hoje ela **permite** PDF para rg/matricula — é exatamente essa condição (`:97`) que precisaria inverter.

---

## 6. PDFs EXISTENTES

Como PDFs aprovados/enviados são exibidos hoje:

| Local | Renderização | PDF é exibido? |
|---|---|---|
| Upload (aluno) — preview | `UploadDocumentos.tsx:647-655`: só gera signed URL se `mime_type.startsWith('image/')` | **NÃO** — PDF nunca teve preview |
| Perfil (aluno) — miniatura | `Perfil.tsx:266-276` e `:1266-1288`: thumbnail só para `isImage` | **NÃO** |
| Admin — DocumentCard | `DocumentCard.tsx:109-119` e `:163-171`: sempre `<img src=...>` | **NÃO** (PDF vira imagem quebrada / "Sem pré-visualização") |

- **Visualização afetada pela mudança**: NÃO — nenhum componente renderiza PDF inline hoje. PDFs já são "invisíveis" na UI (sem thumbnail, sem iframe/embed).
- **Download afetado**: NÃO — o arquivo permanece no bucket `documents`; nenhum fluxo de download é alterado ao mudar apenas o `accept`/gate de upload. Documentos PDF já aprovados continuam no Storage e acessíveis por signed/public URL.
- **Admin renderiza PDF inline?** NÃO — apenas `<img>`. PDFs já apareciam como "Sem pré-visualização" / imagem quebrada. A mudança não piora isso.

Conclusão: remover PDF **não quebra** nada de PDFs já existentes, porque a UI nunca soube exibir PDF de qualquer forma.

---

## 7. ALTERAÇÕES NECESSÁRIAS

| Arquivo | O que mudar | Linhas |
|---|---|---|
| `src/pages/UploadDocumentos.tsx` | Remover `'application/pdf'` do `acceptedTypes` de matrícula | `:97` |
| `src/pages/UploadDocumentos.tsx` | Simplificar validação rg/matricula para só imagem (remover `isPDF`/ramo PDF) e ajustar mensagem de matrícula (`"Apenas imagens ou PDFs..."` → `"Apenas imagens JPG ou PNG..."`) | `:786-797` |
| `src/pages/UploadDocumentos.tsx` | Remover verificação `fileIsPDF` se ficar sem uso | `:823` |
| `src/pages/UploadDocumentos.tsx` | Segundo lado do RG: remover aceite de PDF (`&& secondFile.type !== 'application/pdf'` → só imagem) | `:940` |
| `src/pages/UploadDocumentos.tsx` | (Automático) helper text `:446` passa a mostrar só "JPEG, PNG" — nada a fazer, deriva de `acceptedTypes` | `:445-448` |
| `supabase/functions/validate-document-v2/index.ts` | Inverter gate `:97`: rejeitar PDF para rg/matricula (tratar como tipo inválido, com mensagem amigável) — **fecha o vetor de API direta** | `:97-113` |
| `supabase/functions/validate-document-v2/index.ts` | (Opcional) remover `validateWithClaudePdf` e ramo `isPdf` após o gate rejeitar PDF | `:171-172`, `:518-563` |
| Storage (bucket `documents`) | (Opcional, defesa extra) adicionar `allowed_mime_types` = imagens no bucket via migration | não versionado hoje |

Sem mudanças necessárias em: previews (Perfil/Upload/Admin), download, `types.ts`, triggers.

---

## 8. RISCOS

| Risco | Severidade | Mitigação |
|---|---|---|
| Aluno com PDF já baixado tenta enviar e recebe erro | Baixa | Erro **é claro e síncrono** (toast antes do upload, `:794`/`:831`). Ajustar a mensagem de matrícula para instruir "envie uma **foto ou print** da declaração (JPG/PNG)". |
| Mensagem atual não orienta a solução | Média | Mensagem hoje diz "Apenas imagens JPG ou PNG" — **melhorar** para explicar que print/foto do PDF resolve. Sem isso, aluno pode não entender por que o PDF "parou de funcionar". |
| PDFs já aprovados ficarem inacessíveis | **Nenhuma** | Arquivos permanecem no Storage; nenhuma UI exibia PDF inline mesmo antes. Download por URL segue funcionando. |
| Upload de PDF via API direta continua passando | Média | Endurecer backend (`validate-document-v2:97`) para rejeitar PDF; opcional `allowed_mime_types` no bucket. Só mudar o frontend **não** fecha o vetor. |
| Segundo lado do RG ainda aceita PDF (`:940`) | Média | Incluir `:940` na mudança — senão o RG (que deveria ser só imagem) continua com brecha de PDF. |
| Algum fluxo depende de PDF (merge/multi-página) | **Nenhuma** | Não há merge de páginas nem viewer multi-página; o PDF era enviado inteiro ao OpenRouter. Nenhuma dependência funcional de PDF. |
| Documento `pending` que era PDF (em análise no momento da mudança) | Baixa | O registro já existe; a mudança afeta só novos uploads. Se rejeitado, aluno reenvia como imagem. |

---

### Resumo executivo

- **PDF entra por 2 caminhos no front**: matrícula (`:97`) e segundo lado do RG (`:940`) — não é só a matrícula.
- **Nenhuma UI exibe PDF inline** (Perfil, Upload e Admin só renderizam `<img>` para `mime_type` de imagem) → remover PDF **não afeta** visualização/download de nada existente.
- **Backend aceita PDF para rg e matrícula** (`validate-document-v2:97`) e **não há mime policy no Storage** → mudar só o frontend deixa o vetor de API direta aberto; para fechar de verdade, inverter o gate `:97`.
- Alterações são pequenas e localizadas (1 página frontend + 1 gate na edge function; migration de bucket é opcional). Principal cuidado de UX: **mensagem clara** orientando o aluno a enviar foto/print JPG/PNG.
