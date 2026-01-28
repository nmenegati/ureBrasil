## URE Brasil - Documentação Completa

Este diretório contém a documentação técnica do projeto **URE Brasil - Carteirinha Estudantil Digital**, organizada por domínio (banco de dados, backend, frontend, fluxos de negócio, configurações e integrações externas).

### Visão Geral

O sistema URE Brasil é responsável por:
- Cadastro e onboarding de estudantes
- Upload e validação automática de documentos (RG, matrícula, foto 3x4, selfie)
- Integração com serviços externos (AWS Rekognition, Anthropic Claude, PagBank, Seedream/OpenRouter)
- Emissão de carteirinha estudantil digital (e física) com controle de status e logs de auditoria

Arquitetura principal:
- **Frontend**: React + TypeScript + Vite + shadcn-ui + Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Row-Level Security, Edge Functions)
- **Autenticação**: Supabase Auth
- **Storage**: Supabase Storage (buckets para documentos e carteirinhas)
- **Integrações**: AWS, Anthropic, PagBank, Seedream/OpenRouter

### Estrutura da Documentação

- `database/`
  - Schema de tabelas, funções SQL, triggers, views e políticas de RLS
- `backend/`
  - Edge Functions (API serverless) e contratos de entrada/saída
- `frontend/`
  - Rotas, páginas, componentes e hooks customizados
- `flows/`
  - Fluxos de negócio ponta-a-ponta (auth, onboarding, validação, geração de carteirinha)
- `configs/`
  - Variáveis de ambiente, buckets de storage e parâmetros sensíveis
- `integrations/`
  - Integrações com serviços externos (AWS Rekognition, Anthropic Claude, PagBank, Seedream)

### Como Usar Esta Documentação

1. **Entender o domínio**  
   Comece pelos arquivos em `flows/` para ter uma visão de alto nível dos processos de:
   - Autenticação e sessão
   - Onboarding do estudante
   - Validação de documentos
   - Geração da carteirinha

2. **Explorar o modelo de dados**  
   Consulte `database/schema.md` e `database/rls.md` para entender:
   - Quais tabelas existem e o propósito de cada coluna
   - Como os relacionamentos são feitos
   - Quais políticas de segurança (RLS) protegem cada tabela

3. **Mapear o backend**  
   Em `backend/edge-functions.md` você encontra:
   - Lista das Edge Functions
   - O que cada uma faz e como é chamada
   - Quais secrets e integrações externas utiliza

4. **Mapear o frontend**  
   Use:
   - `frontend/routes.md` para entender as rotas da aplicação
   - `frontend/pages.md` para ver o comportamento de cada página
   - `frontend/components.md` e `frontend/hooks.md` para conhecer as abstrações reutilizáveis

5. **Configurações e Infra**  
   Em `configs/env-variables.md` e `configs/storage-buckets.md` estão os itens necessários para subir o projeto em outro ambiente (chaves, URLs, buckets).

6. **Integrações externas**  
   Os arquivos em `integrations/` descrevem os contratos e fluxos de:
   - Validação de documentos com Claude e AWS
   - Pagamentos com PagBank
   - Geração de carteirinha com Seedream/OpenRouter

Sempre que adicionar ou alterar uma funcionalidade relevante, atualize os arquivos correspondentes nesta pasta para manter o contexto do projeto transferível e auditável.