## Banco de Dados – Schema Geral

> Fonte: arquivos de migração em `supabase/migrations/`.  
> Este documento resume as principais tabelas usadas pelo fluxo de carteirinha URE Brasil.

### Tabela `student_profiles`

- **Propósito**: Perfil do estudante autenticado (campos de onboarding).
- **Colunas principais**
  - `id UUID PK` – Identificador interno do perfil.
  - `user_id UUID FK → auth.users.id` – Usuário de autenticação do Supabase.
  - `full_name TEXT NOT NULL` – Nome completo do estudante.
  - `cpf TEXT NOT NULL UNIQUE` – CPF do estudante.  
    - Índice: `idx_student_profiles_cpf`.
    - Constraint: `unique_cpf` (garante unicidade; migração 20251124* remove duplicatas antes de aplicar).
  - `birth_date DATE NOT NULL` – Data de nascimento.
  - `institution TEXT` – Instituição de ensino.
  - `course TEXT` – Curso (ex.: Direito).
  - `period TEXT` – Período/Série/Semestre/Módulo descritivo.
  - `education_level TEXT` – Nível de ensino (`fundamental`, `medio`, `tecnico`, `graduacao`, `pos`, etc.).  
    - Adicionado em `20260117100000_add_education_level_to_student_profiles.sql`.
  - `enrollment_number TEXT` – Matrícula na instituição.
  - `face_validated BOOLEAN DEFAULT false` – Se a validação facial foi concluída com sucesso.
  - `terms_accepted BOOLEAN DEFAULT false` – Se o termo de veracidade foi aceito.
  - `terms_accepted_at TIMESTAMPTZ` – Data/hora da aceitação dos termos.
  - `terms_ip_address TEXT` – IP usado ao aceitar termo.
  - `terms_version TEXT` – Versão do termo aceito.
  - `profile_completed BOOLEAN DEFAULT false` – Marca fim do onboarding de perfil.
  - `profile_photo_url TEXT` – Caminho, no bucket `documents`, da foto 3x4 válida.  
    - Criado/atualizado em migrações `20260114_add_profile_photo_url.sql` e `20260125_update_profile_photo_on_approval.sql`.
  - `created_at TIMESTAMPTZ DEFAULT now()` – Criação.
  - `updated_at TIMESTAMPTZ DEFAULT now()` – Atualização.

### Tabela `student_cards`

- **Propósito**: Representa a carteirinha (digital/física) vinculada ao estudante.
- **Colunas principais**
  - `id UUID PK`
  - `student_id UUID FK → student_profiles.id`
  - `card_number TEXT UNIQUE` – Número da carteirinha (legível para usuário).
  - `usage_code TEXT UNIQUE` – Código curto para uso/validação (ex.: `3164-D887`).  
    - Criado e popularizado nas migrações 20251229* (funções de geração e backfill).
  - `qr_code TEXT` – Payload para QR (pode ser `usage_code`, URL ou card_number).
  - `status TEXT` – Status da carteirinha:
    - `pending` – Em processo de emissão.
    - `active` – Carteirinha aprovada/emitida.
    - Outros (ex.: `cancelled`, `revoked`) conforme lógica de negócio.
  - `card_type TEXT` – Tipo da carteirinha (ex.: `direito`, `geral`, plano LexPraxis).
  - `valid_until DATE` – Data de validade.
  - `digital_card_url TEXT` – URL pública da imagem digital gerada (frente).
    - Adicionada em `20260116123000_add_digital_card_generation.sql`.
  - `digital_card_generated BOOLEAN DEFAULT false` – Flag de geração da imagem digital.
  - `physical_front_url TEXT` – URL da arte frente da carteirinha física.
  - `physical_back_url TEXT` – URL da arte verso da carteirinha física.
    - Adicionadas em `20260116120000_add_physical_card_urls.sql`.
  - `static_image_url TEXT` – URL de imagem estática usada em fluxos mais antigos (Seedream).
    - Comentada em `20260115_add_static_image_url.sql`.
  - `created_at TIMESTAMPTZ`
  - `updated_at TIMESTAMPTZ`

### Tabela `documents`

- **Propósito**: Armazena metadados dos documentos enviados pelo aluno.
- **Colunas principais**
  - `id UUID PK`
  - `student_id UUID FK → student_profiles.id`
  - `type TEXT` – Tipo do documento:
    - `rg`, `foto`, `matricula`, `selfie` (fluxo atual).
  - `file_url TEXT NOT NULL` – Caminho do arquivo no bucket `documents` (ex.: `user_id/selfie/...`).
  - `file_name TEXT NOT NULL` – Nome original do arquivo.
  - `file_size BIGINT` – Tamanho em bytes.
  - `mime_type TEXT` – MIME detectado (`image/jpeg`, `application/pdf` etc).
  - `status TEXT NOT NULL` – Estado:
    - `pending`, `approved`, `rejected`.
  - `rejection_reason TEXT` – Mensagem amigável de rejeição.
  - `rejection_notes TEXT` – Notas internas do analista.
  - `rejection_reason_id UUID` – ID para catálogo de motivos.
  - `validated_at TIMESTAMPTZ` – Quando foi validado.
  - `validated_by UUID` – Usuário/admin responsável.
  - `created_at TIMESTAMPTZ DEFAULT now()`

### Tabela `face_validations`

- **Propósito**: Controla tentativas/resultados da validação facial (selfie vs documento).
- **Colunas principais**
  - `id UUID PK`
  - `student_id UUID FK → student_profiles.id`
  - `document_id UUID FK → documents.id`
  - `status TEXT` – `pending`, `matched`, `not_matched`, `error`.
  - `similarity NUMERIC`
  - `attempt_number INT`
  - `error_message TEXT`
  - `created_at TIMESTAMPTZ`

### Tabela `audit_logs`

- **Propósito**: Log genérico de ações importantes (validar documentos, atualizar status, etc.).
- **Origem**: `20260110120000_setup_validation_v2.sql`.
- **Colunas**
  - `id UUID PK DEFAULT gen_random_uuid()`
  - `created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL`
  - `student_id UUID FK → student_profiles(id)`
  - `action TEXT NOT NULL`
  - `resource_type TEXT NOT NULL`
  - `resource_id UUID`
  - `details JSONB`

### Outras tabelas relevantes (resumo)

- `plans` / `plan_definitions` – definição de planos e benefícios (atualizadas em `20260111120000_update_plan_definitions.sql`).
- `support_escalations` – escalonamentos para suporte quando a validação automática detecta problemas.
- Tabelas de pagamento PagBank – criadas nas migrações `20251228*` e `20260102205259_b724100d*` para armazenar transações e estados de pagamento.

Para detalhes completos, consulte cada migração em `supabase/migrations/` e expanda este documento conforme necessário.