/**
 * validate-document-v2: Valida documentos enviados usando IA (Claude/OpenRouter).
 *
 * TRIGGER: chamada pelo trigger trigger_validate_document em documents
 *          (via pg_net) e também pode ser chamada diretamente via HTTP
 *          com body contendo record ou { document_id, student_id, type, file_url }.
 *
 * FLUXO:
 * 1. Recebe o registro do documento (id, type, file_url, student_id).
 * 2. Baixa o arquivo do bucket documents.
 * 3. Verifica tipo de arquivo permitido por tipo de documento (imagem/PDF).
 * 4. Envia conteúdo para o modelo via OpenRouter/Claude com prompt específico.
 * 5. Interpreta resposta da IA (aprovado/reprovado, motivos, ajustes sugeridos).
 * 6. Atualiza documents.status, rejection_reason, validated_at e outros campos derivados.
 * 7. Registra logs em audit_logs (quando aplicável) para rastreio.
 *
 * EFEITOS NO BANCO:
 * - UPDATE na tabela documents (status, rejection_reason, validated_at, metadata).
 * - INSERT opcional em audit_logs com detalhes da validação.
 *
 * ATENÇÃO:
 * - Não altera student_profiles nem student_cards diretamente.
 * - Deve sempre retornar status HTTP coerente (400 para input inválido, 502 para falhas externas).
 */
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
  // Handle CORS preflight requests
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

    // 2. Baixar arquivo do Storage (frente)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: file, error: downloadError } = await supabase
      .storage.from('documents').download(file_url)
    
    if (downloadError || !file) throw new Error(`Download: ${downloadError?.message || 'sem arquivo'}`)
    const mimeType = file.type || guessMimeType(file_url)
    const isImage = mimeType.startsWith('image/')
    const isPdf = mimeType === 'application/pdf'

    // 2b. Baixar verso se existir (file_url_back)
    let backBase64: string | null = null
    let backMimeType: string | null = null

    // Regras de tipo por documento
    if ((type === 'foto' || type === 'selfie') && !isImage) {
      await supabase
        .from('documents')
        .update({
          status: 'rejected',
          rejection_reason: 'Apenas imagens são aceitas para este tipo de documento',
          validated_at: new Date().toISOString()
        })
        .eq('id', id)

      return new Response(JSON.stringify({
        error: 'Tipo de arquivo inválido para este documento'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    if ((type === 'rg' || type === 'matricula') && !isImage && !isPdf) {
      await supabase
        .from('documents')
        .update({
          status: 'rejected',
          rejection_reason: 'Apenas imagens ou PDFs são aceitos para este documento',
          validated_at: new Date().toISOString()
        })
        .eq('id', id)

      return new Response(JSON.stringify({
        error: 'Tipo de arquivo não suportado'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    const { data: backDocRow } = await supabase
      .from('documents')
      .select('file_url_back')
      .eq('id', id)
      .maybeSingle()

    const chunkSize = 8192 // 8KB chunks

    if (type === 'rg' && backDocRow?.file_url_back) {
      const { data: backFile, error: backError } = await supabase
        .storage.from('documents').download(backDocRow.file_url_back)

      if (!backError && backFile) {
        backMimeType = backFile.type || guessMimeType(backDocRow.file_url_back)
        const backBuffer = await backFile.arrayBuffer()
        const backBytes = new Uint8Array(backBuffer)
        let backBinary = ''
        for (let i = 0; i < backBytes.length; i += chunkSize) {
          const chunk = backBytes.subarray(i, i + chunkSize)
          backBinary += String.fromCharCode(...chunk)
        }
        backBase64 = btoa(backBinary)
      }
    }

    // 3. Converter frente para base64 (Chunked para evitar RangeError)
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    
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
    
    console.log('profileCtx:', JSON.stringify(profileCtx))
    console.log('student_id usado:', student_id)

    // 5. Selecionar prompt baseado no tipo (com contexto quando aplicável)
    const imageCount = backBase64 ? 2 : 1
    const prompt = getPromptForType(type, profileCtx || {}, imageCount)
    
    // 6. Chamar Claude via OpenRouter
    let validation

    if (isImage) {
      validation = await validateWithClaudeImage(base64, mimeType, prompt, backBase64, backMimeType)
    } else if (isPdf) {
      validation = await validateWithClaudePdf(base64, prompt)
    } else {
      throw new Error('Tipo de arquivo não suportado para validação automática')
    }
    
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
  context: { full_name?: string; institution?: string; course?: string; cpf?: string } = {},
  imageCount: number = 1
): string {
  const prompts: Record<string, string> = {
    foto: `
Você é um validador de foto 3x4 para carteirinha estudantil.
Esta foto será impressa na carteirinha, então precisa ter qualidade mínima para identificação.

APROVAR SE:
- Rosto visível e centralizado
- Foto colorida (pode ser selfie de celular)
- Fundo razoavelmente neutro (não precisa ser estúdio profissional)
- Pessoa olhando para frente
- Iluminação aceitável (não precisa ser perfeita)

TOLERAR (NÃO rejeitar por isso):
- Cabelo solto, desarrumado ou qualquer estilo pessoal
- Barba, maquiagem, piercings, tatuagens visíveis
- Expressão facial neutra ou séria
- Vestimenta casual ou informal
- Aparência pessoal do usuário (não julgar estilo, higiene ou apresentação)
- Qualidade de câmera frontal de celular comum
- Fundo não perfeitamente neutro mas sem poluição visual excessiva

IMPORTANTE: Você NÃO é um consultor de imagem. Não comente sobre
cabelo, roupa, expressão ou aparência pessoal. Avalie APENAS:
rosto visível/identificável, enquadramento, iluminação e fundo.

REJEITAR APENAS SE:
- Rosto cortado/não aparece completamente
- Print de tela ou foto de foto
- Múltiplas pessoas
- Foto muito escura/borrada (ilegível)
- Óculos escuros cobrindo olhos

IMPORTANTE: Aceite fotos tiradas com celular em casa, não exija qualidade de estúdio.

TOM DAS MENSAGENS:
- Trate o usuário como "você" (nunca "o indivíduo", "a pessoa", "o titular")
- Seja gentil e objetivo, como um atendente simpático
- Foque na SOLUÇÃO, não no problema
- Lembre que esta foto vai na carteirinha impressa
- Exemplos de mensagens:
  - BOM: "Seu rosto ficou cortado na foto. Tente novamente mantendo o rosto inteiro no centro da imagem."
  - BOM: "A foto ficou escura demais. Tente em um ambiente com mais luz natural."
  - BOM: "Detectamos mais de uma pessoa na foto. A foto 3x4 deve mostrar apenas você."
  - BOM: "Remova os óculos escuros para a foto — precisamos que seus olhos fiquem visíveis."
  - BOM: "Parece ser uma foto de tela ou de outra foto. Tire uma foto nova diretamente pelo celular."
  - RUIM: "Foto rejeitada por não atender aos critérios de qualidade"
  - RUIM: "A Pessoa não está centralizada"
  - RUIM: "Imagem inadequada para documento"

JSON:
{
  "valid": boolean,
  "confidence": 0-100,
  "recommendation": "approved"|"rejected"|"review",
  "reason": "Mensagem amigável e direta com sugestão de como resolver",
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

Seja rigoroso na verificação de NOME e INSTITUIÇÃO.

TOM DAS MENSAGENS:
- Trate o usuário como "você" (nunca "o aluno", "o discente", "o indivíduo")
- Seja gentil e objetivo, como um atendente simpático
- Foque na SOLUÇÃO, não no problema
- Exemplos de mensagens:
  - BOM: "O nome no comprovante não confere com seu cadastro. Verifique se seus dados estão corretos em 'Meu Perfil' ou envie outro comprovante."
  - BOM: "A instituição no documento é diferente da informada no cadastro. Confira o nome da sua instituição em 'Meu Perfil'."
  - BOM: "O comprovante parece ter mais de 6 meses. Envie um documento mais recente da sua instituição."
  - BOM: "Não conseguimos ler o documento. Tente uma foto com melhor iluminação, sem cortes e sem reflexos."
  - BOM: "Precisamos de um documento oficial da instituição (com timbre, logo ou carimbo). Histórico escolar não é aceito."
  - RUIM: "Nome do aluno diverge do cadastro"
  - RUIM: "Comprovante rejeitado por data expirada"
  - RUIM: "Documento não atende aos critérios"

FORMATO DE RESPOSTA:
{
  "recommendation": "approved"|"rejected"|"review",
  "confidence": 0-100,
  "reason": "Mensagem amigável e direta com sugestão de como resolver",
  "extracted_data": {
    "student_name": "nome extraído",
    "institution": "instituição extraída",
    "date": "data extraída"
  },
  "issues": ["problemas"]
}
`,
    rg: `
Você é um validador de RG/CNH/PASSAPORTE para carteirinha estudantil.

DADOS FORNECIDOS DO CADASTRO:
- Nome: ${context.full_name || 'N/A'}
- CPF: ${context.cpf || 'N/A'}
- Número de imagens enviadas: ${imageCount} (1 = apenas uma face, 2 = frente e verso separados)

REGRAS POR TIPO DE DOCUMENTO:

CNH ou PASSAPORTE:
- 1 imagem é suficiente para aprovação
- Valide nome, CPF (se visível) e validade

RG — ATENÇÃO:
- Se ${imageCount} === 1: verifique se a imagem contém VISIVELMENTE os dois lados lado a lado
  - Se sim (imagem combinada com frente e verso claramente visíveis): valide normalmente
  - Se não (apenas uma face do RG): REJEITAR e o campo reason DEVE sempre começar com "VERSO_AUSENTE:" — mesmo que haja outros problemas como nome divergente. Exemplo: "VERSO_AUSENTE: Envie o verso do RG. Além disso, o nome não confere."
- Se ${imageCount} === 2: frente e verso enviados separadamente — valide normalmente

APROVAR SE:
1. CNH ou Passaporte válido com dados conferindo
2. RG com frente E verso (combinados ou separados) com dados conferindo
3. Foto do titular visível e clara
4. Nome confere com cadastro
5. CPF confere com cadastro (se visível)
6. Texto legível

REJEITAR SE:
- Nome diferente do cadastro
- CPF diferente do cadastro (se visível)
- Documento vencido
- Print de tela ou foto de foto
- Ilegível ou rasurado
- RG com apenas uma face visível (sem o verso)

Ao comparar CPFs, IGNORE toda formatação (pontos, traços, espaços). Exemplo: "780.123.254-20" e "78012325420" são o MESMO CPF.

TOM DAS MENSAGENS:
- Trate o usuário como "você" (nunca "o titular", "o portador", "o indivíduo")
- Seja gentil e objetivo, como um atendente simpático
- Foque na SOLUÇÃO, não no problema
- Exemplos de mensagens:
  - BOM: "O nome no documento não confere com o cadastro. Verifique se digitou corretamente em 'Meu Perfil' ou envie o documento correto."
  - BOM: "VERSO_AUSENTE: Envie o verso do RG"
  - BOM: "Seu documento parece estar vencido. Envie um documento dentro da validade."
  - BOM: "Não conseguimos ler o documento. Tente uma foto com melhor iluminação e sem reflexos."
  - BOM: "O CPF no documento é diferente do informado no cadastro. Confira seus dados em 'Meu Perfil'."
  - RUIM: "Documento do titular não confere com cadastro"
  - RUIM: "RG rejeitado por inconsistência de dados"
  - RUIM: "Documento ilegível"

FORMATO DE RESPOSTA:
{
  "recommendation": "approved"|"rejected"|"review",
  "confidence": 0-100,
  "reason": "Mensagem amigável e direta com sugestão de como resolver",
  "extracted_data": {
    "name": "nome extraído",
    "cpf": "cpf extraído ou null",
    "doc_number": "número do documento"
  },
  "issues": ["problemas"]
}
`,
    selfie: `
Você é um validador de selfie para verificação facial de carteirinha estudantil.
OBJETIVO: Garantir que existe um rosto humano identificável na foto.
A comparação facial será feita por outro sistema (AWS Rekognition), então sua função é apenas garantir que a foto é utilizável para comparação.

APROVAR SE:
- Existe um rosto humano visível na foto
- O rosto está minimamente reconhecível (não precisa ser perfeito)
- É uma foto real (não um desenho, print ou foto de foto)

TOLERAR (NÃO rejeitar por isso):
- Óculos de grau (são de uso contínuo) desde que olhos sejam visíveis
- Iluminação não ideal mas rosto visível
- Rosto levemente inclinado ou não 100% centralizado
- Fundo não neutro
- Qualidade de câmera frontal de celular comum
- Parte do cabelo cortada desde que rosto esteja visível
- Vestimenta casual ou informal (a selfie é apenas para comparação facial, não para documento impresso)

REJEITAR APENAS SE:
- Não há rosto humano na imagem
- Rosto completamente coberto (máscara, mão na frente)
- Óculos ESCUROS cobrindo os olhos
- Foto extremamente escura ou borrada (impossível identificar pessoa)
- Print de tela ou foto de foto/monitor
- Múltiplas pessoas (não sabe qual é o titular)
- Imagem não é uma foto (documento, texto, etc)

IMPORTANTE: Seja TOLERANTE. É melhor aprovar uma foto mediana que será
validada pelo Rekognition depois, do que rejeitar e frustrar o usuário.
Na dúvida, APROVE.

TOM DAS MENSAGENS:
- Trate o usuário como "você" (nunca "o indivíduo", "o sujeito", "a pessoa")
- Seja gentil e objetivo, como um atendente simpático
- Foque na SOLUÇÃO, não no problema
- Exemplos de mensagens:
  - BOM: "Não conseguimos identificar seu rosto. Tente novamente em um ambiente mais iluminado."
  - BOM: "Parece que seus olhos estão cobertos. Remova óculos escuros e tente novamente."
  - BOM: "Detectamos mais de uma pessoa na foto. A selfie deve mostrar apenas você."
  - RUIM: "O indivíduo não está visível"
  - RUIM: "A imagem não aparenta ser uma selfie apropriada"
  - RUIM: "Foto rejeitada por não atender aos critérios"

JSON:
{
  "valid": boolean,
  "confidence": 0-100,
  "recommendation": "approved"|"rejected"|"review",
  "reason": "Mensagem amigável e direta com sugestão de como resolver",
  "issues": ["problemas"]
}
`
  }
  
  const specific = prompts[type] || prompts.rg

  const basePrompt = `
${specific}

IMPORTANTE: Responda APENAS com JSON válido no formato:
{
  "valid": true | false,
  "confidence": 0-100,
  "recommendation": "approved" | "rejected" | "review",
  "reason": "Explicação clara",
  "issues": ["problema1", "problema2"]
}
`

  return basePrompt
}

async function validateWithClaudeImage(
  base64: string,
  mimeType: string,
  prompt: string,
  backBase64?: string | null,
  backMimeType?: string | null
) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://www.urebrasil.com.br',
      'X-Title': 'URE Brasil Document Validation',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          ...(backBase64 && backMimeType
            ? [{ type: 'image_url', image_url: { url: `data:${backMimeType};base64,${backBase64}` } }]
            : [])
        ]
      }]
    })
  })
  
  const data = await response.json()

  const messageContent = data.choices?.[0]?.message?.content
  let rawContent = ''

  if (typeof messageContent === 'string') {
    rawContent = messageContent
  } else if (Array.isArray(messageContent)) {
    rawContent = messageContent
      .map((c: any) => (typeof c === 'string' ? c : c.text ?? JSON.stringify(c)))
      .join('\n')
  } else {
    rawContent = JSON.stringify(messageContent ?? {})
  }

  return parseResponse(rawContent)
}

async function validateWithClaudePdf(base64: string, prompt: string) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://www.urebrasil.com.br',
      'X-Title': 'URE Brasil Document Validation',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'file',
            file: {
              filename: 'documento.pdf',
              file_data: `data:application/pdf;base64,${base64}`
            }
          },
        ]
      }]
    })
  })

  const data = await response.json()

  const messageContent = data.choices?.[0]?.message?.content
  let rawContent = ''

  if (typeof messageContent === 'string') {
    rawContent = messageContent
  } else if (Array.isArray(messageContent)) {
    rawContent = messageContent
      .map((c: any) => (typeof c === 'string' ? c : c.text ?? JSON.stringify(c)))
      .join('\n')
  } else {
    rawContent = JSON.stringify(messageContent ?? {})
  }

  return parseResponse(rawContent)
}

interface ValidationResult {
  valid: boolean
  confidence: number
  recommendation: 'approved' | 'rejected' | 'review'
  reason: string
  issues: string[]
}

function parseResponse(text: string): ValidationResult {
  console.log('RAW:', typeof text, text?.substring(0, 300))
  let parsed: any | null = null

  try {
    parsed = JSON.parse(text)
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0])
      } catch {
        console.error('JSON inválido mesmo após extração')
      }
    }
  }

  if (parsed && typeof parsed === 'object') {
    const valid = typeof parsed.valid === 'boolean' ? parsed.valid : false
    const confidenceRaw = Number(parsed.confidence)
    const confidence = Number.isFinite(confidenceRaw)
      ? Math.max(0, Math.min(100, confidenceRaw))
      : 0

    const rec = typeof parsed.recommendation === 'string' ? parsed.recommendation : ''
    const allowed = ['approved', 'rejected', 'review']
    const recommendation = allowed.includes(rec) ? (rec as ValidationResult['recommendation']) : 'review'

    const reason =
      typeof parsed.reason === 'string' && parsed.reason.trim().length > 0
        ? parsed.reason
        : 'Resposta inválida'

    const issues = Array.isArray(parsed.issues) ? parsed.issues.map(String) : []

    return { valid, confidence, recommendation, reason, issues }
  }

  return {
    valid: false,
    confidence: 0,
    recommendation: 'review',
    reason: 'Resposta inválida: ' + text.substring(0, 100),
    issues: []
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

function guessMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase()
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    pdf: 'application/pdf'
  }

  return mimeTypes[ext || ''] || 'application/octet-stream'
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
