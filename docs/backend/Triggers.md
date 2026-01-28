## Banco de Dados – Triggers

### Trigger `documents_validation_trigger`

- **Tabela**: `documents`
- **Evento**: `AFTER INSERT OR UPDATE OF status`
- **Função**: `trigger_validate_document()`
- **Definição (simplificada)**:

```sql
CREATE OR REPLACE FUNCTION trigger_validate_document()
RETURNS TRIGGER AS $$
DECLARE
  url TEXT := 'https://<project-ref>.supabase.co/functions/v1/validate-document-v2';
  key TEXT := '[SERVICE_ROLE_KEY]';
BEGIN
  IF NEW.status = 'pending' THEN
    PERFORM net.http_post(
      url := url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || key
      ),
      body := jsonb_build_object('record', row_to_json(NEW))
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS documents_validation_trigger ON documents;
CREATE TRIGGER documents_validation_trigger
  AFTER INSERT OR UPDATE OF status ON documents
  FOR EACH ROW EXECUTE FUNCTION trigger_validate_document();
```

- **Propósito**:
  - Disparar a **Edge Function `validate-document-v2`** sempre que um documento entrar em `pending`.
  - Encapsular a chamada HTTP no próprio banco, garantindo que qualquer inserção/atualização siga o fluxo de validação automática.

### Triggers de criação/atualização de carteirinha

- Migrações:
  - `20251228151731_168f8938-fcef-4b96-b6fd-7e1fd606b910.sql`
  - `20251228185321_10486085-dc8f-4e79-ad1b-b69d775291cc.sql`
  - `20260102205259_b724100d-d94d-4897-94c0-5e57ac2f6315.sql`

**Resumo:**

- Criam/alteram triggers que:
  - geram `card_number` sequencial,
  - geram `usage_code`,
  - criam ou atualizam linhas em `student_cards` quando:
    - um pagamento é confirmado,
    - um plano é escolhido,
    - há necessidade de backfill.

### Triggers de perfil/foto

- Migrações:
  - `20260114_backfill_latest_profile_photo.sql`
  - `20260125_update_profile_photo_on_approval.sql`

**Resumo:**

- Copiam a `file_url` aprovada de documentos `foto` para `student_profiles.profile_photo_url`.
- Assim, a foto 3x4 aprovada fica diretamente disponível para:
  - geração da carteirinha,
  - exibição no frontend sem ler `documents` toda hora.