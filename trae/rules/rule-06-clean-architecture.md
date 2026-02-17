# LEI 06: Arquitetura Limpa - Supabase + React

## MOTIVO
Evitar componentes React com 1000+ linhas misturando UI, lógica de negócio e chamadas ao banco.
Problema real: `UploadDocumentos.tsx` com 1169 linhas, `Checkout.tsx` com lógica de pagamento 
embutida no componente, tornando debug e manutenção extremamente difíceis.

## GATILHO
Ativado ao criar ou modificar:
- Páginas React (`/src/pages/`)
- Componentes com lógica de negócio (`/src/components/`)
- Edge Functions (`/supabase/functions/`)
- Hooks customizados (`/src/hooks/`)

## ESTRUTURA DE CAMADAS

```
src/
├── pages/           → Apenas layout, renderização e orquestração de hooks
├── components/      → UI pura, recebe props, sem lógica de banco
├── hooks/           → Encapsulam chamadas Supabase, estado e efeitos
├── services/        → Lógica de negócio pura (cálculos, validações, formatações)
└── utils/           → Funções auxiliares genéricas

supabase/functions/  → Edge Functions: validar input, chamar serviço externo, retornar resultado
```

## REGRAS

### 1. Páginas (pages/) — Máximo ~200 linhas de lógica própria
- Renderizam componentes e usam hooks
- NÃO fazem `supabase.from(...)` diretamente (exceto em hooks inline simples)
- NÃO contêm funções auxiliares como `formatPrice`, `toTitleCase` etc.

### 2. Hooks (hooks/) — Encapsulam toda interação com Supabase
- Um hook por domínio: `useStudentProfile`, `useDocuments`, `useFaceValidation`, `usePayment`
- Retornam: `{ data, loading, error, refetch, actions }`
- Gerenciam realtime, polling e cleanup internamente

### 3. Services (services/) — Lógica de negócio sem dependências React
- Funções puras: recebem dados, retornam resultado
- Testáveis sem renderizar componentes
- Exemplos: cálculo de parcelas, validação de formulário, formatação de preço

### 4. Edge Functions — Uma responsabilidade por função
- Validar input → processar → retornar
- NÃO misturar múltiplas operações não relacionadas
- Erros devem retornar JSON estruturado com `{ success, error, details }`

## EXEMPLO ERRADO (situação real do projeto)

```typescript
// pages/UploadDocumentos.tsx — 1169 linhas!
export default function UploadDocumentos() {
  // 20+ estados
  const [profile, setProfile] = useState(null);
  const [documents, setDocuments] = useState({});
  const [uploading, setUploading] = useState({});
  // ...

  // Fetch profile dentro da página
  const fetchProfile = async () => {
    const { data } = await supabase.from('student_profiles')...
  };

  // Fetch documents dentro da página
  const fetchDocuments = async () => {
    const { data } = await supabase.from('documents')...
  };

  // Upload com validação, compressão e feedback — tudo junto
  const handleUpload = async (file, type) => {
    // 80+ linhas de lógica
  };

  // Pagamento, termos, validação facial — tudo no mesmo componente
  const handleSubmit = async () => { ... };
  const handleGoToReview = async () => { ... };
  const handleManualValidation = async () => { ... };

  // 500+ linhas de JSX
  return ( ... );
}
```

## EXEMPLO CORRETO

```typescript
// hooks/useStudentProfile.ts
export function useStudentProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('student_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    setProfile(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { profile, loading, refetch: fetch };
}

// hooks/useDocumentUpload.ts
export function useDocumentUpload(profileId: string, userId: string) {
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  
  const upload = async (file: File, type: DocumentType) => {
    // Toda lógica de validação, compressão e upload encapsulada
  };

  return { uploading, upload };
}

// services/payment.ts — lógica pura
export function calculateInstallments(price: number): number {
  if (price >= 100) return 12;
  if (price >= 50) return 6;
  return 3;
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL'
  }).format(price);
}

// pages/UploadDocumentos.tsx — orquestra hooks e renderiza
export default function UploadDocumentos() {
  const { profile, loading } = useStudentProfile(user?.id);
  const { documents, previews, refetch } = useDocuments(profile?.id);
  const { uploading, upload } = useDocumentUpload(profile?.id, user?.id);

  return (
    <div>
      {documentConfigs.map(config => (
        <DocumentCard
          key={config.type}
          config={config}
          doc={documents[config.type]}
          onUpload={upload}
        />
      ))}
    </div>
  );
}
```

## CHECKLIST ANTES DE COMMITAR
- [ ] Página tem menos de 300 linhas?
- [ ] Lógica de banco está em hook, não no componente?
- [ ] Funções auxiliares (format, validate, calculate) estão em services/?
- [ ] Edge Function faz apenas uma operação principal?
