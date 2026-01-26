import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts"
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { AWSSignerV4 } from "https://deno.land/x/aws_sign_v4@1.0.2/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = (await req.json()) as unknown
    const { student_id } = (typeof body === 'object' && body !== null ? body as Record<string, unknown> : {})
    if (!student_id) throw new Error('student_id is required')

    console.log(`[INIT] Comparação facial para student_id: ${student_id}`)

    // Init Clients
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const region = Deno.env.get('AWS_REGION') || 'us-east-1'
    const awsClient = new AWSSignerV4(region)

    // Fetch documents (pending or approved, we want the latest uploaded ones)
    const { data: docs, error: docsError } = await supabase
      .from('documents')
      .select('*')
      .eq('student_id', student_id)
      .in('type', ['rg', 'foto', 'selfie'])
      .order('created_at', { ascending: false })

    if (docsError) throw docsError
    
    // Group by type to get latest
    type DocumentRow = { id: string; type: string; file_url: string }
    const latestDocs: Record<string, DocumentRow> = {}
    ;((docs ?? []) as DocumentRow[]).forEach((d) => {
        if (!latestDocs[d.type]) {
            latestDocs[d.type] = d
        }
    })

    const rg = latestDocs['rg']
    const foto = latestDocs['foto']
    const selfie = latestDocs['selfie']

    // Validar apenas se tivermos pelo menos RG e Selfie
    if (!rg || !selfie) {
      console.log('Documentos insuficientes para comparação:', { 
        hasRg: !!rg, 
        hasFoto: !!foto, 
        hasSelfie: !!selfie 
      })
      return new Response(JSON.stringify({ 
        message: 'Aguardando envio de RG e Selfie',
        ready: false 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    console.log('Baixando imagens...')

    try {
      const downloadPromises = [
        downloadFile(supabase, rg.file_url),
        downloadFile(supabase, selfie.file_url)
      ]
      if (foto) downloadPromises.push(downloadFile(supabase, foto.file_url))

      const results = await Promise.all(downloadPromises)
      const rgBuffer = results[0]
      const selfieBuffer = results[1]
      const fotoBuffer = foto ? results[2] : null

      console.log('Iniciando comparação AWS Rekognition...')
      
      const matchRG = await compareTwoFaces(awsClient, region, selfieBuffer, rgBuffer)
      console.log('Selfie vs RG:', matchRG)
      
      let matchFoto = { match: true, similarity: 100, note: 'Skipped (no foto)' }
      if (foto && fotoBuffer) {
          matchFoto = await compareTwoFaces(awsClient, region, selfieBuffer, fotoBuffer)
          console.log('Selfie vs Foto:', matchFoto)
      }

      const passed = matchRG.match && matchFoto.match
      const details = {
        rg_match: matchRG,
        foto_match: matchFoto
      }

      if (passed) {
          console.log('Validação facial APROVADA')
          await supabase.from('student_profiles')
            .update({ face_validated: true })
            .eq('id', student_id)
          
          const docIdsToApprove = [rg.id, selfie.id]
          if (foto) docIdsToApprove.push(foto.id)
          
          await supabase.from('documents')
              .update({ status: 'approved' })
              .in('id', docIdsToApprove)
              .eq('status', 'pending')

          await logAudit(supabase, student_id, 'approved', details)
      } else {
          console.log('Validação facial FALHOU')
          let reason = ''
          if (!matchRG.match) reason += `Rosto não confere com RG (${Math.round(matchRG.similarity)}%). `
          if (!matchFoto.match) reason += `Rosto não confere com Foto 3x4 (${Math.round(matchFoto.similarity)}%).`
          
          await supabase.from('documents').update({
              status: 'rejected',
              rejection_reason: reason.trim()
          }).eq('id', selfie.id)

          await logAudit(supabase, student_id, 'rejected', { ...details, reason })
      }

      return new Response(JSON.stringify({ success: true, passed, details }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      console.error('[FACE] Error during download or comparison:', e)

      await logAudit(supabase, student_id, 'error', { error: message })

      return new Response(JSON.stringify({
        success: false,
        ready: false,
        error: message
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

  } catch (error: unknown) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})

async function compressImage(bytes: Uint8Array, maxSizeKB: number = 5120): Promise<Uint8Array> {
  if (bytes.length < maxSizeKB * 1024) {
    console.log(`Imagem OK (${Math.round(bytes.length/1024)}KB)`)
    return bytes
  }

  if (bytes.length > 5 * 1024 * 1024) {
    throw new Error(`Imagem muito grande (${Math.round(bytes.length/1024)}KB). Máximo: 5MB`)
  }

  console.log(`Aviso: Imagem grande (${Math.round(bytes.length/1024)}KB)`)
  return bytes
}

async function downloadFile(supabase: SupabaseClient, path: string): Promise<Uint8Array> {
  const { data: signedData, error: signedError } = await supabase.storage
    .from('documents')
    .createSignedUrl(path, 60)
  if (signedError || !signedData?.signedUrl) {
    throw new Error(`Erro ao gerar signed URL: ${signedError?.message}`)
  }
  const response = await fetch(signedData.signedUrl)
  if (!response.ok) {
    throw new Error(`Erro ao baixar arquivo: ${response.status}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  // Comprimir antes de retornar (máx 800KB)
  return await compressImage(bytes, 800)
}

async function compareTwoFaces(client: AWSSignerV4, region: string, source: Uint8Array, target: Uint8Array) {
    const url = `https://rekognition.${region}.amazonaws.com/`
    const payload = JSON.stringify({
        SourceImage: { Bytes: base64Encode(source) },
        TargetImage: { Bytes: base64Encode(target) },
        SimilarityThreshold: 80
    })
    const headers = new Headers({
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "RekognitionService.CompareFaces"
    })
    const request = new Request(url, { method: "POST", headers, body: payload })
    
    try {
        const signedRequest = await client.sign("rekognition", request)
        const response = await fetch(signedRequest)
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
            const errorMessage = (data && (data.message || data.Message)) || `HTTP ${response.status}`
            return { match: false, similarity: 0, error: errorMessage }
        }
        const match = (data.FaceMatches?.length || 0) > 0
        const similarity = match ? data.FaceMatches[0]?.Similarity : 0
        return { match, similarity: similarity || 0 }
    } catch (e: unknown) {
        console.error('Rekognition Error:', e)
        const message = e instanceof Error ? e.message : 'Unknown error'
        return { match: false, similarity: 0, error: message }
    }
}

async function logAudit(supabase: SupabaseClient, studentId: string, result: string, details: Record<string, unknown>) {
    try {
        await supabase.from('audit_logs').insert({
            action: 'face_comparison',
            resource_type: 'student_profile',
            resource_id: studentId, 
            student_id: studentId,
            details: { result, ...details }
        })
    } catch (e) {
        console.error('Audit log error:', e)
    }
}
