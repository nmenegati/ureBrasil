## Banco de Dados – Views

> As migrações atuais não definem views explícitas para o domínio da carteirinha, mas seguem exemplos úteis.

### Exemplo: `v_student_cards`

```sql
CREATE VIEW v_student_cards AS
SELECT
  sc.id,
  sc.card_number,
  sc.usage_code,
  sc.status,
  sc.valid_until,
  sc.card_type,
  sc.digital_card_url,
  sp.full_name,
  sp.cpf,
  sp.institution,
  sp.course,
  sp.education_level,
  sp.enrollment_number
FROM student_cards sc
JOIN student_profiles sp ON sp.id = sc.student_id;
```

- **Propósito**:
  - Simplificar telas/admin que mostram dados combinados de carteirinha + perfil.

### Exemplo: `v_documents_status`

```sql
CREATE VIEW v_documents_status AS
SELECT
  d.id,
  d.student_id,
  d.type,
  d.status,
  d.rejection_reason,
  d.created_at,
  sp.full_name,
  sp.cpf
FROM documents d
JOIN student_profiles sp ON sp.id = d.student_id;
```

- **Propósito**:
  - Visualizar rapidamente o status dos documentos por estudante.

> Caso views sejam criadas no futuro, documente aqui o `CREATE VIEW`, propósito e tabelas envolvidas.