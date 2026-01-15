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
    
    // 4. Selecionar prompt baseado no tipo
    const prompt = getPromptForType(type)
    
    // 5. Chamar Claude via OpenRouter
    const validation = await validateWithClaude(base64, file.type, prompt)
    
    console.log('Resultado da validação:', validation)

    // 6. Atualizar status no banco
    await updateDocumentStatus(supabase, id, validation)
    
    // 6.1. Se for foto 3x4 aprovada, atualizar foto de perfil
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
    
    // 7. Registrar audit log
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

function getPromptForType(type: string): string {
  const prompts: Record<string, string> = {
    rg: `Você é especialista em validação de documentos brasileiros.
Analise este RG/CNH e responda APENAS JSON válido.
CRITÉRIOS:

AUTENTICIDADE: Foto de documento original? Elementos de segurança? Cores oficiais?
QUALIDADE: Nítida? Completa? Sem cortes/sombras?
DADOS: Nome, CPF/RG, foto, órgão emissor, data nascimento legíveis?
MANIPULAÇÃO: Sinais de edição/photoshop? Proporções corretas?

REJEITAR SE:

Print/screenshot
Foto de foto
Rasgado/danificado
Editado
Desfocado/escuro

JSON:
{
"valid": boolean,
"confidence": 0-100,
"recommendation": "approved"|"rejected"|"review",
"reason": "explicação detalhada",
"issues": ["lista de problemas"]
}`,
    matricula: `Analise este comprovante de matrícula e responda APENAS JSON.
CRITÉRIOS:

AUTENTICIDADE: Documento oficial? Logo/cabeçalho? Original ou print?
QUALIDADE: Legível? Completo?
DADOS: Nome aluno, instituição, curso, período, data?
VALIDADE: Recente (máx 6 meses)?

REJEITAR SE:

Print de sistema
Ilegível
Faltando dados essenciais
Nome não confere
Muito antigo (>6 meses)

JSON:
{
"valid": boolean,
"confidence": 0-100,
"recommendation": "approved"|"rejected"|"review",
"reason": "explicação",
"issues": ["problemas"]
}`,
    foto: `Analise esta foto 3x4 e responda APENAS JSON.
CRITÉRIOS:

FORMATO: Proporção 3x4? Rosto centralizado? Ombros até cabeça?
FUNDO: Neutro (branco/azul/cinza)? Sem objetos?
QUALIDADE: Nítida? Bem iluminada? Sem sombras fortes?
PESSOA: Uma pessoa? Rosto descoberto? Expressão neutra?

REJEITAR SE:

Selfie casual
Fundo colorido/com objetos
Foto de foto
Baixa qualidade
Acessórios cobrindo rosto
Mais de uma pessoa

JSON:
{
"valid": boolean,
"confidence": 0-100,
"recommendation": "approved"|"rejected"|"review",
"reason": "explicação",
"issues": ["problemas"]
}`,
    selfie: `Analise esta selfie com documento e responda APENAS JSON.
CRITÉRIOS:

VISIBILIDADE: Documento visível? Foto no RG legível? Dados identificáveis?
PESSOA: Segurando documento? Rosto visível? Documento próximo ao rosto?
QUALIDADE: Nítida? Boa luz? Sem reflexos?
AUTENTICIDADE: Selfie real? Não é print? Pessoa ao vivo?

REJEITAR SE:

Documento invisível/ilegível
Print/screenshot
Baixa qualidade
Documento coberto
Não segurando documento
Foto de foto

IMPORTANTE: Será usada para comparação facial.
JSON:
{
"valid": boolean,
"confidence": 0-100,
"recommendation": "approved"|"rejected"|"review",
"reason": "explicação",
"issues": ["problemas"]
}`
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
