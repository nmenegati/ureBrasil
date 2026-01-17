import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[INIT] Validação iniciada')
    
    // 1. Receber corpo da requisição (webhook ou chamada direta do trigger)
    const body = await req.json()
    let id: string, type: string, file_url: string, student_id: string
    if (body && typeof body === 'object' && 'record' in body && body.record) {
      ({ id, type, file_url, student_id } = body.record)
    } else {
      ({ document_id: id, type, file_url, student_id } = body)
    }
    if (!id || !student_id || !type || !file_url) {
      throw new Error('Campos obrigatórios faltando: document_id, student_id, type, file_url')
    }
    
    if (!id || !file_url) {
      throw new Error('Dados incompletos no webhook')
    }

    console.log(`Processando documento ${id} do tipo ${type}`)

    // 2. Baixar arquivo do Storage
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: file, error: downloadError } = await supabase
      .storage.from('documents').download(file_url)
    
    if (downloadError) throw new Error(`Download: ${downloadError.message}`)
    
    // 3. Converter para base64 (Chunked para evitar RangeError)
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    const chunkSize = 8192 // 8KB chunks
    
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize)
      binary += String.fromCharCode(...chunk)
    }
    
    const base64 = btoa(binary)
    
    // 4. Contexto do perfil para prompts que exigem conferência
    const { data: profileCtx } = await supabase
      .from('student_profiles')
      .select('full_name, institution, course, cpf')
      .eq('id', student_id)
      .maybeSingle()
    
    // 5. Selecionar prompt baseado no tipo (com contexto quando aplicável)
    const prompt = getPromptForType(type, profileCtx || {})
    
    // 6. Chamar Claude via OpenRouter
    const validation = await validateWithClaude(base64, file.type, prompt)
    
    console.log('Resultado da validação:', validation)

    // 7. Atualizar status no banco
    await updateDocumentStatus(supabase, id, validation)
    
    // 7.1. Se for foto 3x4 aprovada, atualizar foto de perfil
    if (type === 'foto' && validation.recommendation === 'approved') {
      console.log('[PROFILE PHOTO] Atualizando profile_photo_url com file_url da foto 3x4 aprovada')
      const { error: photoError } = await supabase
        .from('student_profiles')
        .update({ profile_photo_url: file_url })
        .eq('id', student_id)
      
      if (photoError) {
        console.error('[PROFILE PHOTO] Erro ao atualizar profile_photo_url:', photoError)
      } else {
        console.log('[PROFILE PHOTO] profile_photo_url atualizado com sucesso')
      }
    }
    
    // 8. Registrar audit log
    await logAudit(supabase, student_id, id, type, validation)
    
    return new Response(JSON.stringify({ success: true, validation }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: unknown) {
    console.error('[ERROR]', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

function getPromptForType(
  type: string,
  context: { full_name?: string; institution?: string; course?: string; cpf?: string } = {}
): string {
  const prompts: Record<string, string> = {
    foto: `
Você é um validador de foto 3x4 para carteirinha estudantil.

APROVAR SE:
- Rosto visível e centralizado
- Foto colorida (pode ser selfie de celular)
- Fundo razoavelmente neutro (não precisa ser estúdio profissional)
- Pessoa olhando para frente
- Iluminação aceitável (não precisa ser perfeita)

REJEITAR APENAS SE:
- Rosto cortado/não aparece completamente
- Print de tela ou foto de foto
- Múltiplas pessoas
- Foto muito escura/borrada (ilegível)
- Óculos escuros cobrindo olhos

IMPORTANTE: Aceite fotos tiradas com celular em casa, não exija qualidade de estúdio.

JSON:
{
  "valid": boolean,
  "confidence": 0-100,
  "recommendation": "approved"|"rejected"|"review",
  "reason": "Explicação clara",
  "issues": ["problemas"]
}
`,
    matricula: `
Você é um validador de comprovante de matrícula estudantil.

DADOS FORNECIDOS DO CADASTRO:
- Nome: ${context.full_name || 'N/A'}
- Instituição: ${context.institution || 'N/A'}
- Curso: ${context.course || 'N/A'}

APROVAR SE:
1. Documento oficial da instituição (papel timbrado, logo, carimbo)
2. Nome do aluno CONFERE com cadastro (tolerância: sobrenomes, abreviações)
3. Nome da instituição CONFERE com cadastro (tolerância: siglas, nomes parciais)
4. Data/período ATUAL ou recente (máximo 6 meses atrás)
5. Legível e não é print de tela

REJEITAR SE:
- Nome do aluno DIFERENTE do cadastro
- Instituição DIFERENTE do cadastro
- Documento com mais de 6 meses
- Print de tela ou foto de tela
- Ilegível ou adulterado
- Não é documento oficial (ex: histórico escolar não serve)

FORMATO DE RESPOSTA:
{
  "recommendation": "approved"|"rejected"|"review",
  "confidence": 0-100,
  "reason": "Explicação clara",
  "extracted_data": {
    "student_name": "nome extraído",
    "institution": "instituição extraída",
    "date": "data extraída"
  },
  "issues": ["problemas"]
}

Seja rigoroso na verificação de NOME e INSTITUIÇÃO.
`,
    rg: `
Você é um validador de RG/CNH para carteirinha estudantil.

DADOS FORNECIDOS DO CADASTRO:
- Nome: ${context.full_name || 'N/A'}
- CPF: ${context.cpf || 'N/A'}

APROVAR SE:
1. RG ou CNH válido (frente E verso se RG)
2. Documento dentro da validade
3. Foto do titular visível e clara
4. Nome no documento CONFERE com cadastro
5. CPF no documento CONFERE com cadastro (se visível)
6. Texto legível

REJEITAR SE:
- Nome DIFERENTE do cadastro
- CPF DIFERENTE do cadastro (se visível)
- Documento vencido
- Print de tela ou foto de foto
- Ilegível ou rasurado
- Apenas um lado do RG (precisa frente E verso)

FORMATO DE RESPOSTA:
{
  "recommendation": "approved"|"rejected"|"review",
  "confidence": 0-100,
  "reason": "Explicação clara",
  "extracted_data": {
    "name": "nome extraído",
    "cpf": "cpf extraído ou null",
    "doc_number": "número do documento"
  },
  "issues": ["problemas"]
}

Seja rigoroso na verificação de NOME e CPF.
`,
    selfie: `
Analise esta selfie com documento e responda APENAS JSON.
CRITÉRIOS:

VISIBILIDADE: Documento visível? Foto no RG legível? Dados identificáveis?
PESSOA: Segurando documento? Rosto visível? Documento próximo ao rosto?
QUALIDADE: Nítida? Boa luz? Sem reflexos?
AUTENTICIDADE: Selfie real? Não é print? Pessoa ao vivo?

REJEITAR SE:
Documento invisível/ilegível; Print/screenshot; Baixa qualidade; Documento coberto; Não segurando documento; Foto de foto

IMPORTANTE: Será usada para comparação facial.
JSON:
{
  "valid": boolean,
  "confidence": 0-100,
  "recommendation": "approved"|"rejected"|"review",
  "reason": "explicação",
  "issues": ["problemas"]
}
`
  }
  return prompts[type] || prompts.rg
}

async function validateWithClaude(base64: string, mimeType: string, prompt: string) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://ure.vendatto.com',
      'X-Title': 'URE Brasil Document Validation',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` }}
        ]
      }]
    })
  })
  
  const data = await response.json()
  const text = data.choices?.[0]?.message?.content || '{}'
  
  return parseResponse(text)
}

interface ValidationResult {
  valid: boolean
  confidence: number
  recommendation: 'approved' | 'rejected' | 'review'
  reason: string
  issues: string[]
}

function parseResponse(raw: string): ValidationResult {
  try {
    let clean = raw.replace(/```json\n?/g, '').replace(/```/g, '').trim()
    const match = clean.match(/\{[\s\S]*\}/)
    if (match) clean = match[0]
    
    const result = JSON.parse(clean) as Partial<ValidationResult>
    
    // Validar campos
    const valid = result.valid ?? false
    const confidence = Math.max(0, Math.min(100, Number(result.confidence) || 0))
    const recommendation = (result.recommendation && ['approved','rejected','review'].includes(result.recommendation))
      ? result.recommendation : 'review'
    const reason = result.reason || 'Resposta inválida'
    const issues = Array.isArray(result.issues) ? result.issues : []
    
    return { valid, confidence, recommendation, reason, issues }
  } catch {
    return {
      valid: false,
      confidence: 0,
      recommendation: 'review',
      reason: 'Erro ao processar IA',
      issues: ['parse_error']
    }
  }
}

async function updateDocumentStatus(supabase: SupabaseClient, docId: string, validation: ValidationResult) {
  const statusMap: Record<string, string> = {
    approved: 'approved',
    rejected: 'rejected',
    review: 'pending'
  }
  
  const newStatus = statusMap[validation.recommendation]
  
  console.log('=== UPDATE DEBUG ===')
  console.log('validation.recommendation:', validation.recommendation)
  console.log('newStatus (mapped):', newStatus)
  console.log('validation.confidence:', validation.confidence)
  console.log('validation.reason:', validation.reason)
  
  const { data, error } = await supabase.from('documents').update({
    status: newStatus,
    rejection_reason: validation.recommendation === 'rejected' ? validation.reason : null,
    validation_confidence: validation.confidence,
    validated_at: new Date().toISOString()
  }).eq('id', docId).select()

  if (error) {
    console.error('Error updating document:', error)
  } else {
    console.log('Update successful:', data)
  }
}

async function logAudit(supabase: SupabaseClient, studentId: string, docId: string, docType: string, validation: ValidationResult) {
  const { error } = await supabase.from('audit_logs').insert({
    action: 'document_validation',
    resource_type: 'document',
    resource_id: docId,
    student_id: studentId, // Adding student_id if the table supports it, otherwise details
    details: {
      type: docType,
      result: validation.recommendation,
      confidence: validation.confidence,
      issues: validation.issues,
      reason: validation.reason
    }
  })

  if (error) console.error('Error logging audit:', error)
}
