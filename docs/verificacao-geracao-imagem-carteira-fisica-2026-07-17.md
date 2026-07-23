# Verificação: Geração de Imagem para Carteira Física (Horizontal)

Data: 2026-07-17
Modo: somente leitura. Nenhum arquivo de código foi alterado (este relatório é o único arquivo criado).

Fontes lidas:
- `src/components/CardLayoutFront.tsx`
- `src/pages/Carteirinha.tsx`
- `src/admin/components/CardProduction/PrintBatchModal.tsx`
- `src/integrations/supabase/types.ts`
- `supabase/migrations/20260430_fix_admin_rls_policies.sql`
- `package.json`
- Templates em `public/templates/` (imagens vertical e horizontal, geral e direito)

---

## 1. CARDLAYOUTFRONT

Arquivo: `src/components/CardLayoutFront.tsx` (componente único, só a FRENTE).

- **Props** (`CardLayoutFrontProps`, `:1-16`):
  `mode` ("direito" | "geral"), `templateSrc`, `fullName`, `cpf`, `birthDate`, `institution`, `educationLabel`, `period`, `course`, `enrollmentNumber`, `usageCode`, `validUntil`, `photoUrl`, `qrImageUrl`.

- **Posições CSS (todas relativas ao container, layout VERTICAL):**
  - Foto: `absolute left-[10.5%] top-[18%] w-[36%] aspect-[3/3.6]` (`:33`) — `object-cover`.
  - QR: bloco `absolute right-[11%] top-[20%] w-[24%]` (`:47`), imagem `w-[82px] h-[82px]` fixa (`:53`).
  - COD. USO: dentro do bloco do QR, logo abaixo dele (`:59-62`).
  - Bloco de textos (nome, CPF, nasc., instituição, educationLabel+período, curso, matrícula): `absolute left-[10.5%] right-[8%] top-[51%]` (`:65-91`).
  - Validade ("VÁLIDO ATÉ"): `absolute left-[20%] bottom-[9%]` (`:93-96`).

- **Observação:** a foto usa `aspect-[3/3.6]` e larguras percentuais, mas o QR usa tamanho FIXO em px (`82px`) — isso funciona porque o container digital tem `maxWidth: 384px`. Num render horizontal 1011px o QR de 82px ficaria proporcionalmente minúsculo. **Precisa virar `%` no layout horizontal.**

- **CardLayoutBack: NÃO existe.** Não há `CardLayoutBack.tsx`. O verso, tanto na digital quanto na física, é sempre a imagem estática do template (`*-verso-template-*.png`), renderizada direto via `<img>` (`Carteirinha.tsx:404-415`). Confirma o requisito de que o verso físico não precisa ser gerado.

---

## 2. TEMPLATE HORIZONTAL

Templates existentes (`public/templates/`):
- `geral-frente-template-h.png` (vazio) e `geral-frente-modelo-h.png` (preenchido)
- `direito-frente-template-h.png` (vazio) e `direito-frente-modelo-h.png` (preenchido)
- `geral-verso-template-h.png`, `direito-verso-template-h.png` (versos estáticos horizontais)

O layout horizontal é **diferente do vertical**. No horizontal (com base no modelo, dimensão ~1011×639, valores aproximados em % do template):

| Elemento | left | top | width | height |
|---|---|---|---|---|
| Foto 3x4 | ~8% | ~27% | ~21% | ~42% |
| Nome | ~32% | ~27% | — | — |
| CPF | ~32% | ~33% | — | — |
| Data Nasc. | ~32% | ~38% | — | — |
| Instituição (label + nome) | ~32% | ~46% | — | — |
| Curso / educationLabel+período | ~32% | ~52–60% | — | — |
| Matrícula | ~32% | ~65% | — | — |
| QR Code | ~11% | ~73% | ~15% | (quadrado) |
| COD. USO | ~31% | ~77% | — | — |
| Validade ("2026 / VALIDADE MÊS/ANO") | pré-desenhada no template (canto inf. direito) | ~78% | — | — |

Diferenças estruturais vs. vertical:
- **Foto + textos ficam lado a lado** (foto à esquerda, bloco de texto à direita/topo), enquanto no vertical o texto fica ABAIXO da foto.
- **QR + COD. USO ficam no rodapé esquerdo** (abaixo da foto), não ao lado da foto no topo como no vertical.
- **Validade já vem impressa no template horizontal** ("2026 / VALIDADE MARÇO/2027" no canto inferior direito). No vertical o componente escreve "VÁLIDO ATÉ" dinamicamente. → No horizontal, ou a validade é estática (ano fixo no PNG) ou precisará de um template por safra. **Ponto de atenção:** o `validUntil` dinâmico do componente atual NÃO tem lugar óbvio no horizontal; hoje o ano está "chapado" no template.

- **Diferença direito vs. geral:** apenas identidade visual — o horizontal de direito tem cabeçalho "CARTEIRA DO ESTUDANTE DE DIREITO", selo **OAB**, marca d'água da estátua da Justiça e borda vermelha; o geral tem cabeçalho verde simples. **As posições dos campos (foto, textos, QR, COD.USO) são essencialmente as mesmas** nos dois. Mesmo padrão observado no par vertical (só muda selo/logo/cor).

---

## 3. VIEW `physical_cards_to_print`

- **Definição SQL: NÃO localizada em `supabase/migrations/`.** Busca por `physical_cards_to_print` só retorna: `types.ts`, `Cards.tsx`, `PrintQueue.tsx`, `PrintBatchModal.tsx`, e o doc de auditoria — **nenhum arquivo `.sql`**. A view existe no banco mas **não é versionada**. Para ver a query real, rodar no banco:
  `SELECT pg_get_viewdef('physical_cards_to_print', true);`

- **Campos que a view TEM hoje** (por `types.ts:783-808`):
  `card_id, card_number, cep, city, complement, course, cpf, full_name, institution, issued_at, neighborhood, number, period, phone, plan_name, plan_type, rg, shipping_status, state, street, valid_until`.

- **Campos NECESSÁRIOS para gerar a imagem que a view NÃO TEM:**
  `birth_date`, `profile_photo_url`, `usage_code`, `enrollment_number`, `education_level`.

- **Existem nas tabelas base?**
  - `birth_date` → **SIM**, `student_profiles.birth_date` (`types.ts:433`).
  - `profile_photo_url` → **SIM no runtime** (lido em `Carteirinha.tsx:88,116` e escrito por trigger `20260125_update_profile_photo_on_approval.sql`), **porém AUSENTE do `types.ts` gerado** (student_profiles `:430-461` não lista `profile_photo_url`). É drift de types.ts, não ausência real da coluna. Confirmar com `\d student_profiles`.
  - `usage_code` → **SIM**, `student_cards.usage_code` (`types.ts:352`). Hoje o PrintBatchModal já busca isso separadamente por `card_id`.
  - `enrollment_number` → **SIM**, `student_profiles.enrollment_number` (`types.ts:441`).
  - `education_level` → **SIM**, `student_profiles.education_level` (`types.ts:440`).

- **Pode estender a view?** **SIM**, via `CREATE OR REPLACE VIEW`. Ressalva do PostgreSQL: `CREATE OR REPLACE VIEW` só adiciona colunas **no fim** e não pode remover/reordenar/retipar colunas existentes; adicionar 5 colunas no fim é seguro. Como a definição atual não é versionada, o passo correto é: (1) capturar `pg_get_viewdef`, (2) versionar a definição atual + as 5 colunas novas numa migration nova.

- **Query estendida proposta** (esqueleto — a lista de joins/colunas base deve espelhar o `pg_get_viewdef` real; abaixo o essencial a acrescentar):
```sql
-- 20260717_extend_physical_cards_to_print.sql
CREATE OR REPLACE VIEW physical_cards_to_print AS
SELECT
  sc.id            AS card_id,
  sc.card_number,
  sc.usage_code,                    -- novo
  sc.valid_until,
  sc.shipping_status,
  sc.issued_at,
  sc.card_type     AS plan_type,
  p.full_name,
  p.cpf,
  p.rg,
  p.birth_date,                     -- novo
  p.phone,
  p.institution,
  p.course,
  p.period,
  p.education_level,                -- novo
  p.enrollment_number,             -- novo
  p.profile_photo_url,             -- novo
  p.cep, p.city, p.complement, p.neighborhood, p.number, p.state, p.street,
  pl.name          AS plan_name
FROM student_cards sc
JOIN student_profiles p ON p.id = sc.student_id
LEFT JOIN plans pl ON pl.id = p.plan_id
WHERE sc.is_physical = true;        -- espelhar o filtro real da view atual
```
> Depois de estender a view, **regenerar `types.ts`** (ou ajustar manualmente) para incluir as colunas novas — hoje o modal já usa `supabase as any` em pontos, mas os campos novos precisam do tipo.

---

## 4. PRINTBATCHMODAL

Arquivo: `src/admin/components/CardProduction/PrintBatchModal.tsx`.

- **Fluxo atual (`handleConfirm`, por item):**
  1. Busca `usage_code, valid_until` em `student_cards` por `card_id` (`:46-50`).
  2. Gera QR (`QRCode.toDataURL`) apontando para `console.urebrasil.com.br/ativar?code=...` (`:53-64`). ⚠️ Note: URL de ativação diferente da usada na digital (`urebrasil.com.br/verificar/{usage_code}` em `Carteirinha.tsx:154`) — **drift de URL de verificação/ativação**.
  3. Gera **PDF texto-puro** com jsPDF (sem imagem da carteira) (`:66-107`).
  4. Upload do PDF no bucket `documents`, path `physical-cards/{card_id}/{fileName}` (`:112-116`).
  5. `getPublicUrl` → `pdfUrl` (`:123-127`).
  6. Insert em `physical_card_prints` (`{card_id, pdf_url, status:'printed', created_at, printed_by}`) via `supabase as any` (`:129-138`).
  7. Update `student_cards.shipping_status = 'printed'` (`:140-146`).
  8. Insert em `admin_actions` (`{action_type:'card_batch_printed', card_id, performed_by, details, created_at}`) via `supabase as any` (`:148-156`).

- **`physical_card_prints` — schema:** **tabela NÃO está no `types.ts`** (por isso os `supabase as any`) e o `CREATE TABLE` **não está em migrations** — só a RLS aparece (`20260430_fix_admin_rls_policies.sql:76-83`, `physical_card_prints_admin_all`, admin-only). Colunas conhecidas por uso:
  - Insert (PrintBatchModal): `card_id`, `pdf_url`, `status`, `created_at`, `printed_by`.
  - Update (ShippingModal, por auditoria): `shipping_code`, `tracking_code`.
  → Tabela existe no banco mas não versionada. Para trocar por PNG basta reusar a coluna `pdf_url` (ou renomear para algo genérico) — considerar adicionar coluna `image_url`/`png_url` em migration, ou reaproveitar `pdf_url` guardando a URL do PNG (menos limpo, mas sem alteração de schema).

- **O que MANTER na nova versão (PNG):**
  - Upload no storage (mudar `pdfBlob`→`pngBlob`, `contentType:'image/png'`, extensão `.png`).
  - Insert em `physical_card_prints`.
  - Update `shipping_status = 'printed'`.
  - Insert em `admin_actions`.
  - O QR: reaproveitar `QRCode.toDataURL` (**alinhar a URL** com a da digital para consistência de verificação).

---

## 5. FOTO DO ALUNO

- **Coluna:** `student_profiles.profile_photo_url` — armazena um **path** no storage (não URL completa).
- **Bucket:** primário `profile-photos` (via `getPublicUrl`); fallback `documents` (via `createSignedUrl`, 600s). Ver `Carteirinha.tsx:121-138`.
- **Como carregar (padrão já testado, `Carteirinha.tsx:114-142`):**
```ts
const { data: pub } = supabase.storage.from('profile-photos').getPublicUrl(path);
let url = pub?.publicUrl ?? null;
if (!url) {
  const { data } = await supabase.storage.from('documents').createSignedUrl(path, 600);
  url = data?.signedUrl ?? null;
}
```
- **Permissão no admin:** o admin usa o mesmo `supabase` client. `profile-photos` via `getPublicUrl` é público (sem RLS de leitura). O fallback `documents` via `createSignedUrl` depende de o admin ter policy de leitura no bucket `documents`. Para geração de imagem via `html2canvas`/Canvas, a URL precisa permitir CORS — `getPublicUrl` do bucket público resolve; signed URL do Supabase também envia headers CORS corretos.

---

## 6. html2canvas

- **Instalado: SIM** — `html2canvas@^1.4.1` (`package.json:51`). Já usado em `Carteirinha.tsx:197` com `import()` dinâmico, `scale:2, useCORS:true, backgroundColor:'#ffffff'`.
- **Scale para 300 DPI:** o template horizontal já tem **1011px ≈ 85,6mm ≈ 300 DPI**. Portanto:
  - `scale: 1` → 1011px → **já 300 DPI** (mínimo aceitável).
  - `scale: 2` → 2022×1278 → **~600 DPI** (margem confortável, recomendado).
  - `scale: 3` → ~900 DPI (exagero para gráfica; peso maior de PNG).
  → **Recomendado `scale: 2`** (mesmo padrão da digital, resultado ~600 DPI).
- **Limitação cross-origin:** com `useCORS: true` e imagens do bucket público (`profile-photos`) ou signed URL, funciona. Riscos: se a foto vier de host sem header CORS, o canvas fica "tainted" e `toBlob` falha. Mitigar carregando a foto como `data:` URL antes do render (fetch→blob→FileReader) se houver falha. O template (`/templates/*.png`) é same-origin, sem problema.

---

## 7. CANVAS API DIRETA

- **Viabilidade: alta.** Fluxo: `new Image()` do template → `drawImage` no canvas 1011×639 (ou ×2) → `drawImage` da foto na caixa 3x4 → `drawImage` do QR → `fillText` para nome/CPF/nasc./instituição/curso/matrícula/COD.USO → `toBlob('image/png')`.
- **vs html2canvas para impressão:** Canvas API dá resultado **mais previsível/determinístico** (sem depender do engine de layout do browser, sem quirks de fontes web, sem taint surprises se as imagens forem pré-carregadas como data URL). Custo: **posicionamento e quebra de linha manuais** (medir texto com `measureText`, gerenciar wrap da instituição/curso, acentuação, kerning). O CardLayoutFront resolve wrap "de graça" via CSS.
- **Componente:** para a opção React, criar **novo** `CardLayoutFrontHorizontal.tsx` (posições e ordem dos blocos são diferentes o suficiente do vertical que reaproveitar o mesmo componente com `if` deixaria o JSX confuso). Alternativa: um componente com prop `orientation` e dois conjuntos de classes — porém arquivo separado é mais limpo dado que QR/COD.USO mudam de zona.

---

## 8. DOWNLOAD (individual + lote)

- **JSZip ou similar: NÃO instalado** (não está em `package.json`; libs presentes: `jspdf`, `qrcode`, `html2canvas`).
- **Recomendação individual:** `canvas.toBlob` → `URL.createObjectURL` → `<a download="card-{card_number}.png">` → `click()` → `revokeObjectURL`. Simples e imediato.
- **Recomendação lote:** duas opções, em ordem de simplicidade:
  1. **Upload de todos no storage + registrar URLs** (reaproveita 100% o fluxo atual do PrintBatchModal): gera cada PNG, sobe para `documents/physical-cards/{card_id}/`, grava `physical_card_prints`, atualiza status. O admin baixa pela lista de URLs. **Sem dependência nova.** ✅ recomendado como primeiro passo.
  2. **ZIP client-side** com `jszip` (adicionar dependência) para baixar um único `.zip` com todos os PNGs. Melhor UX de download em massa, mas adiciona lib. Fazer só se o volume justificar.
  - Baixar N PNGs soltos de uma vez dispara N prompts de download no browser — evitar.

---

## 9. RECOMENDAÇÃO

- **Opção escolhida: A** (novo componente React `CardLayoutFrontHorizontal.tsx` + `html2canvas`), no ADMIN, exportando PNG.

- **Justificativa:**
  - Reaproveita um pipeline **já testado em produção** (a digital usa exatamente esse caminho, incluindo `useCORS`, foto do storage e QR).
  - Wrap de texto (instituição/curso longos, acentuação) sai "de graça" via CSS — o maior custo da Opção B (Canvas API) é justamente reimplementar isso à mão.
  - O template horizontal já está em ~300 DPI; `scale:2` entrega ~600 DPI, suficiente para gráfica.
  - Opção C (Edge Function + Sharp) adiciona infra server-side nova, composição manual de texto (mesmo custo da B) e deploy — desproporcional para o volume atual e para uma tela de admin.
  - **Fallback recomendado:** se aparecer inconsistência de fontes/quebra entre máquinas do admin, migrar SÓ a etapa de render para **Canvas API (Opção B)** mantendo o resto do fluxo. Guardar isso como plano B, não bloquear a entrega.

- **Complexidade estimada: Média** (~1 a 1,5 dia). Maior parte é acertar as posições do layout horizontal e estender a view/migration.

- **Arquivos a criar/alterar:**
  - **Criar** `src/admin/components/CardProduction/CardLayoutFrontHorizontal.tsx` — layout horizontal (posições da seção 2; QR e foto em `%`, não px fixo).
  - **Alterar** `src/admin/components/CardProduction/PrintBatchModal.tsx` — trocar geração jsPDF por render off-screen do componente horizontal + `html2canvas(scale:2)` → PNG; manter upload/insert/update/admin_actions; alinhar URL do QR com a digital.
  - **Criar migration** `supabase/migrations/20260717_extend_physical_cards_to_print.sql` — versionar a view atual (capturada via `pg_get_viewdef`) + colunas `birth_date, profile_photo_url, usage_code, enrollment_number, education_level`.
  - **Regenerar/ajustar** `src/integrations/supabase/types.ts` — refletir campos novos da view (e, idealmente, corrigir o drift de `profile_photo_url` em `student_profiles` e adicionar a tabela `physical_card_prints`).
  - **Opcional** `package.json` — `jszip` só se for adotado download em ZIP para lote.
  - **Verificar/versionar** o `CREATE TABLE physical_card_prints` (hoje sem migration) — não é bloqueante para a feature, mas é dívida de governança relevante.

---

## Pendências / pontos de atenção descobertos

1. **`physical_card_prints` sem migration versionada** — só a RLS existe (`20260430`). Tabela criada fora da trilha SQL. Governança.
2. **`physical_cards_to_print` (view) sem migration versionada** — precisa capturar `pg_get_viewdef` antes de estender.
3. **`profile_photo_url` ausente do `types.ts`** (drift) — existe no runtime/trigger, mas o tipo gerado de `student_profiles` não lista. Corrigir ao regenerar tipos.
4. **URL de QR divergente:** PrintBatchModal usa `console.urebrasil.com.br/ativar?code=` vs. digital usa `urebrasil.com.br/verificar/{usage_code}`. Definir qual é a correta para a física antes de gerar as imagens definitivas.
5. **Validade no template horizontal é estática** ("2026 / VALIDADE MARÇO/2027" chapado no PNG). O `validUntil` dinâmico do fluxo digital não tem posição no horizontal — decidir se a validade é fixa por safra de template ou se será sobreposta dinamicamente.
6. **QR com tamanho fixo em px** no CardLayoutFront (`82px`) — no horizontal precisa ser `%` para escalar com `scale:2`.
