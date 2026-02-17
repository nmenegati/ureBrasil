# LEI 14: Documentação como Código - Supabase + React

## MOTIVO
Código sem contexto causa confusão e decisões erradas durante manutenção.
Problema real: `handleSubmit` em UploadDocumentos fazia 3 coisas diferentes dependendo 
do estado (salvar termos, recarregar página, ou nada). Sem documentação, impossível 
saber o que esperar. `activate_student_card_on_docs_approved` tinha nome claro mas 
efeito colateral invisível (marcava card como 'active' antes do fluxo completo).

## GATILHO
Ativado ao criar ou modificar:
- Funções com mais de 10 linhas
- Hooks customizados
- Edge Functions
- Triggers e RPCs no banco
- Componentes com lógica condicional complexa

## REGRAS

### 1. Funções Complexas — Comentário de contrato no topo

```typescript
// ❌ ERRADO: nome ambíguo, sem contexto
const handleSubmit = async () => {
  if (termsAlreadyAccepted) {
    toast.success('Documentos enviados!');
    return;  // Por que retorna aqui? O que acontece depois?
  }
  // ...mais 50 linhas
};

// ✅ CORRETO: contrato claro
/**
 * Salva aceite de termos e inicia recarregamento para atualizar estado.
 * 
 * Cenários:
 * - termsAlreadyAccepted: verifica face_validated → navega ou reload
 * - primeiro aceite: salva no banco → reload após 5s para buscar face_validated
 * 
 * Pré-requisitos: allDocsUploaded = true, termsAccepted = true
 * Efeito: atualiza student_profiles.terms_accepted + metadata
 */
const handleSubmit = async () => { ... };
```

### 2. Hooks — Documentar retorno e efeitos colaterais

```typescript
// ❌ ERRADO
export function useFaceValidation(studentId) { ... }

// ✅ CORRETO
/**
 * Escuta resultado da validação facial via realtime na tabela face_validations.
 * 
 * @param studentId - ID do student_profile (não user_id)
 * @returns { result: { passed: boolean, similarity: number } | null, loading: boolean }
 * 
 * Efeitos: 
 * - Cria subscription realtime no mount
 * - Limpa subscription no unmount
 * - NÃO faz polling, depende 100% do realtime
 * 
 * Atenção: Requer que compare-faces faça INSERT em face_validations.
 * Se face_validations estiver vazia, result será sempre null.
 */
export function useFaceValidation(studentId: string | undefined) { ... }
```

### 3. Edge Functions — Header com fluxo completo

```typescript
/**
 * compare-faces: Compara selfie com RG e foto 3x4 via AWS Rekognition.
 * 
 * TRIGGER: Chamada por trigger `on_document_approved_compare_faces` na tabela documents.
 *          Dispara quando qualquer documento é aprovado.
 * 
 * FLUXO:
 * 1. Busca documentos aprovados do estudante (selfie, rg, foto)
 * 2. Se não tem selfie + pelo menos 1 doc com foto → retorna ready: false
 * 3. Download das imagens do bucket 'documents'
 * 4. Chama AWS Rekognition CompareFaces para cada par
 * 5. Se similarity >= 80% em todos os pares → passed = true
 * 6. Atualiza student_profiles.face_validated
 * 7. Insere resultado em face_validations
 * 8. Se passed: aprova documentos + copia foto para bucket profile-photos
 * 
 * EFEITOS NO BANCO:
 * - UPDATE student_profiles.face_validated = true/false
 * - INSERT face_validations (resultado + similaridades)
 * - UPDATE documents.status = 'approved' (se passed)
 * - UPLOAD profile-photos (foto 3x4 aprovada)
 * 
 * ATENÇÃO: NÃO altera current_onboarding_step. 
 * Quem faz isso é a RPC advance_to_review.
 */
```

### 4. Triggers e RPCs — Documentar no SQL

```sql
-- ❌ ERRADO: nome diz uma coisa, faz outra
CREATE FUNCTION activate_student_card_on_docs_approved()
-- Nome sugere "ativar card quando docs aprovados"
-- Mas na realidade marca card como 'active' ANTES de termos e revisão
-- Causa: loop entre /upload-documentos e /carteirinha

-- ✅ CORRETO: nome + comentário refletem comportamento real
/**
 * Trigger: Atualiza status do student_card quando 4 documentos são aprovados.
 * 
 * DISPARA: AFTER UPDATE em documents (quando status muda para 'approved')
 * 
 * COMPORTAMENTO:
 * - Conta documentos aprovados do estudante
 * - Se >= 4: atualiza student_cards de 'pending_docs' para 'active'
 * - Também preenche qr_code com dados do estudante
 * 
 * ATENÇÃO: Este trigger marca o card como 'active' independentemente de:
 * - terms_accepted (aceite de termos)
 * - face_validated (validação facial)
 * - current_onboarding_step
 * 
 * O frontend deve verificar TODAS as condições antes de mostrar a carteirinha.
 */
CREATE OR REPLACE FUNCTION activate_student_card_on_docs_approved()
```

### 5. Componentes com Estado Complexo — Mapa de estados

```typescript
/**
 * UploadDocumentos — Página de upload e validação de documentos.
 * 
 * FLUXO DO USUÁRIO:
 * 1. Upload de 4 documentos (matrícula, RG, foto 3x4, selfie)
 * 2. Documentos são validados automaticamente (IA + AWS)
 * 3. Quando 4 docs aprovados → checkbox de termos aparece
 * 4. Aceita termos → polling face_validated → navega para /gerar-carteirinha
 * 
 * ESTADOS DERIVADOS:
 * - allDocsUploaded: todos os 4 tipos têm registro (qualquer status)
 * - allDocsApproved: todos os 4 têm status 'approved'
 * - termsOk: termsAccepted || termsAlreadyAccepted
 * - faceOk: profile.face_validated === true
 * - canGenerateCard: allDocsApproved && faceOk && termsOk
 * - canSubmit: allDocsUploaded && termsOk (para botão validar)
 * 
 * GUARDS:
 * - useOnboardingGuard('upload_documents') — redireciona se step != upload_documents
 * - checkIfLocked — redireciona para /carteirinha se card ativo
 * 
 * DEPENDÊNCIAS BACKEND:
 * - validate-document-v2: valida cada doc via Claude AI
 * - compare-faces: compara selfie com docs via AWS Rekognition
 * - advance_to_review: RPC que muda step para review_data (se face+terms+docs OK)
 */
```

### 6. Nomes Descritivos — Sem abreviações ambíguas

```typescript
// ❌ ERRADO
const faceOk = !!profile?.face_validated;
const termsOk = termsAccepted || termsAlreadyAccepted;
const handleGTR = async () => { ... };

// ✅ CORRETO
const isFaceValidated = !!profile?.face_validated;
const areTermsAccepted = termsAccepted || termsAlreadyAccepted;
const handleGoToReview = async () => { ... };

// Exceção: variáveis locais curtas em escopo pequeno são OK
const { data: docs } = await supabase.from('documents')...
```

### 7. Relacionamento entre Tabelas — Manter atualizado

```
/**
 * MODELO DE DADOS RELEVANTE:
 * 
 * student_profiles (1) ──→ (N) documents
 * student_profiles (1) ──→ (N) face_validations  
 * student_profiles (1) ──→ (1) student_cards
 * payments (1) ──→ (1) student_cards (via payment_id)
 * 
 * IDs IMPORTANTES:
 * - profile.id = student_id (usado em documents, face_validations, student_cards)
 * - user.id = auth UID (usado em storage paths: documents/{user_id}/tipo/arquivo)
 * - NÃO confundir: storage usa user.id, tabelas usam profile.id
 * 
 * TRIGGERS ATIVOS:
 * - documents AFTER UPDATE → compare-faces (se doc aprovado)
 * - documents AFTER UPDATE → activate_student_card_on_docs_approved
 * - payments AFTER UPDATE → create_student_card_on_payment
 * - student_cards BEFORE INSERT → auto_generate_card_data
 */
```

## CHECKLIST ANTES DE COMMITAR
- [ ] Funções com mais de 10 linhas têm comentário explicando o "porquê"?
- [ ] Hooks documentam retorno, efeitos colaterais e dependências?
- [ ] Edge Functions têm header com fluxo, triggers e efeitos no banco?
- [ ] Nomes de variáveis são auto-explicativos sem abreviações?
- [ ] Triggers SQL têm comentário sobre quando disparam e o que fazem?
- [ ] Nenhum TODO sem contexto (aceitar apenas: TODO(#123): descrição)?
