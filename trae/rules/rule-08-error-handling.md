# LEI 08: Tratamento de Erros com Contexto - Supabase + React

## MOTIVO
Erros silenciosos causam horas de debug desnecessário.
Problema real: `compare-faces` executava com sucesso nos logs mas não inseria em 
`face_validations` — sem log de erro, sem feedback no front. 2 dias perdidos.
Edge functions retornando status 200 com erro dentro do JSON, mascarando falhas.

## GATILHO
Ativado ao criar ou modificar:
- Edge Functions (`/supabase/functions/`)
- Hooks com chamadas async (`/src/hooks/`)
- Handlers de evento em páginas (handleSubmit, handleUpload, etc.)
- Componentes que fazem fetch de dados

## REGRAS

### 1. Edge Functions — NUNCA engolir erros

```typescript
// ❌ ERRADO: erro silencioso
try {
  await supabase.from('face_validations').insert({ ... });
} catch (e) {
  console.error('erro:', e);
  // Segue execução como se nada tivesse acontecido
}

// ✅ CORRETO: logar com contexto + propagar
try {
  const { error } = await supabase.from('face_validations').insert({ ... });
  if (error) {
    console.error('[FACE_VALIDATION] INSERT falhou:', {
      student_id,
      error: error.message,
      code: error.code,
      details: error.details,
    });
    // Decidir: retornar erro ou continuar sem esse dado
    return new Response(JSON.stringify({
      success: false,
      error: 'face_validation_insert_failed',
      details: error.message,
    }), { status: 500, headers: corsHeaders });
  }
} catch (e) {
  console.error('[FACE_VALIDATION] Exceção inesperada:', {
    student_id,
    error: e instanceof Error ? e.message : String(e),
    stack: e instanceof Error ? e.stack : undefined,
  });
  throw e; // Re-lançar para o handler global
}
```

### 2. Supabase Operations — SEMPRE checar `.error`

```typescript
// ❌ ERRADO: ignorar error do Supabase
const { data } = await supabase.from('student_profiles').update({ ... }).eq('id', id);
// Se der erro, data é null e código continua sem saber

// ✅ CORRETO: checar explicitamente
const { data, error } = await supabase.from('student_profiles').update({ ... }).eq('id', id);
if (error) {
  console.error('[PROFILE_UPDATE] Falha:', { id, error: error.message });
  toast.error('Erro ao atualizar perfil. Tente novamente.');
  return;
}
```

### 3. Edge Functions — Status HTTP coerente

```typescript
// ❌ ERRADO: sempre retornar 200
return new Response(JSON.stringify({ success: false, error: 'internal' }), {
  status: 200  // Front não sabe que falhou!
});

// ✅ CORRETO: status reflete o resultado
// Erro de input do usuário
return new Response(JSON.stringify({ 
  success: false, 
  error: 'missing_documents',
  message: 'Selfie não encontrada' 
}), { status: 400, headers: corsHeaders });

// Erro interno
return new Response(JSON.stringify({ 
  success: false, 
  error: 'aws_comparison_failed',
  message: 'Serviço de validação indisponível' 
}), { status: 502, headers: corsHeaders });

// Sucesso
return new Response(JSON.stringify({ 
  success: true, 
  passed: true,
  details: { similarity: 99.5 } 
}), { status: 200, headers: corsHeaders });
```

### 4. React Handlers — Toast específico + estado consistente

```typescript
// ❌ ERRADO: mensagem genérica, estado inconsistente
const handleSubmit = async () => {
  try {
    setProcessing(true);
    await doSomething();
    await doAnotherThing();
  } catch (e) {
    toast.error('Erro ao processar');
    // setProcessing nunca volta pra false se erro em doAnotherThing!
  }
};

// ✅ CORRETO: mensagens específicas + finally
const handleSubmit = async () => {
  try {
    setProcessing(true);
    
    const { error: payError } = await processPayment();
    if (payError) {
      toast.error('Erro no pagamento: ' + payError.message);
      return;
    }
    
    const { error: updateError } = await updateProfile();
    if (updateError) {
      toast.error('Pagamento OK, mas erro ao atualizar perfil. Contate suporte.');
      return;
    }
    
    toast.success('Pagamento realizado com sucesso!');
    navigate('/next-step');
  } catch (e) {
    console.error('[PAYMENT] Exceção:', e);
    toast.error('Erro inesperado. Tente novamente.');
  } finally {
    setProcessing(false); // SEMPRE executa
  }
};
```

### 5. Logs em Edge Functions — Formato padronizado

```typescript
// Padrão: [MÓDULO] Ação: { contexto }
console.log('[FACE] Iniciando comparação:', { student_id, docTypes: ['selfie', 'rg', 'foto'] });
console.log('[FACE] Resultado AWS:', { similarity: 99.5, threshold: 80, passed: true });
console.error('[FACE] Falha AWS:', { student_id, error: err.message, service: 'rekognition' });

// Para Edge Functions de pagamento:
console.log('[PAYMENT] Iniciando:', { gateway, method, amount, plan_id });
console.log('[PAYMENT] Resposta gateway:', { status: response.status, id: payment_id });
console.error('[PAYMENT] Falha gateway:', { gateway, status: 500, body: errorBody });
```

### 6. RPC Calls — Tratar retorno false

```typescript
// ❌ ERRADO: ignorar retorno
await supabase.rpc('advance_to_review', { p_student_id: id });
navigate('/next');

// ✅ CORRETO: verificar resultado
const { data, error } = await supabase.rpc('advance_to_review', { 
  p_student_id: id 
});

if (error) {
  console.error('[RPC] advance_to_review erro:', error);
  toast.error('Erro interno. Tente novamente.');
  return;
}

if (data === true) {
  window.location.href = '/gerar-carteirinha';
} else {
  toast.error('Ainda há pendências. Verifique documentos, termos e validação facial.');
}
```

## CHECKLIST ANTES DE COMMITAR
- [ ] Todo `supabase.from()` tem destructuring de `{ data, error }` com check de error?
- [ ] Todo `try/catch` tem log com contexto (módulo, IDs, detalhes)?
- [ ] Edge Functions retornam status HTTP correto (não 200 para erro)?
- [ ] Handlers React têm `finally` para resetar estados (loading, processing)?
- [ ] Toasts mostram mensagens específicas, não genéricas?
- [ ] Nenhum `catch(e) {}` vazio ou `catch(e) { pass }`?
