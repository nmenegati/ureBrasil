## Backend – Edge Functions (Supabase)

> Diretório: `supabase/functions/`

### `_shared/cors.ts`

- Utilitário para aplicar CORS uniforme aos handlers.

### `admin-update-email`

- **Arquivo**: `supabase/functions/admin-update-email/index.ts`
- **Propósito**: atualizar e-mail de um usuário (auth.users) via endpoint seguro.
- **Entrada**: `{ user_id, new_email }`
- **Saída**: dados atualizados ou erro.

### `chat-support`

- **Arquivo**: `.../chat-support/index.ts`
- **Propósito**: endpoint de suporte conversacional (chat) integrado ao widget no frontend.

### `cleanup-rejected-documents`

- **Arquivo**: `.../cleanup-rejected-documents/index.ts`
- **Propósito**: remover periodicamente documentos rejeitados antigos do Storage e da tabela `documents`.

### `compare-faces`

- **Propósito**: comparar selfie vs documento com AWS Rekognition.
- **Entrada**: `student_id`, URLs de selfie e foto do RG.
- **Saída**: `status`, `similarity`, logs.
- **Afeta**: `face_validations`, `student_profiles.face_validated`, possivelmente `documents`.

### `create-payment`, `pagbank-session`, `pagbank-payment-v2`, `pagbank-payment-card`

- **Propósito**: gerar sessão PagBank, iniciar pagamentos, receber webhooks e atualizar status interno de pagamento.

### `delete-unconfirmed-user`, `delete-user-data`

- **Propósito**:
  - limpar usuários que não confirmaram e-mail,
  - executar LGPD (remoção de dados do usuário e seus relacionamentos).

### `generate-card-image`

- **Propósito**: gerar a arte da carteirinha (imagem) usando modelo externo (Seedream/OpenRouter) ou pipeline interno e salvar no Storage.

### `generate-digital-card`

- **Propósito**: orquestrar a geração da carteirinha digital (servidor), definindo template, chamando serviço de imagem e salvando URL em `student_cards.digital_card_url`.

### `generate-student-card`

- **Propósito**: apoiar fluxos de carteirinha física (gerar artes frente/verso, registrar pedido).

### `validate-cpf`

- **Propósito**: validar CPF (formato, duplicidade, possivelmente serviços externos).

### `validate-document-v2`

- **Propósito**: núcleo da validação de documentos.
- **Entrada**: `{ record: Document }` (via trigger).
- **Fluxo**:
  - Carrega arquivo em Storage.
  - Usa Claude para análise textual/estrutural.
  - Usa `compare-faces` para selfie.
  - Atualiza `documents` e escreve em `audit_logs`.