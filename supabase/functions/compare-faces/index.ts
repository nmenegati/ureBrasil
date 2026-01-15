import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts"
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { RekognitionClient, CompareFacesCommand } from "https://esm.sh/@aws-sdk/client-rekognition@3.451.0"

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

    const rekognition = new RekognitionClient({
      region: Deno.env.get('AWS_REGION') || 'us-east-1',
      credentials: {
        accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY')!
      }
    })

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
    // Download images
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
    
    // Compare Selfie vs RG
    const matchRG = await compareTwoFaces(rekognition, selfieBuffer, rgBuffer)
    console.log('Selfie vs RG:', matchRG)
    
    let matchFoto = { match: true, similarity: 100, note: 'Skipped (no foto)' }
    if (foto && fotoBuffer) {
        // Compare Selfie vs Foto 3x4
        matchFoto = await compareTwoFaces(rekognition, selfieBuffer, fotoBuffer)
        console.log('Selfie vs Foto:', matchFoto)
    }

    // Regra: Deve bater com RG (obrigatório) e Foto (se existir)
    const passed = matchRG.match && matchFoto.match
    const details = {
      rg_match: matchRG,
      foto_match: matchFoto
    }

    if (passed) {
        console.log('Validação facial APROVADA')
        // Success: Mark profile as validated
        await supabase.from('student_profiles')
          .update({ face_validated: true })
          .eq('id', student_id)
        
        // Optional: Auto-approve documents if they were pending
        const docIdsToApprove = [rg.id, selfie.id]
        if (foto) docIdsToApprove.push(foto.id)
        
        await supabase.from('documents')
            .update({ status: 'approved' })
            .in('id', docIdsToApprove)
            .eq('status', 'pending')

        await logAudit(supabase, student_id, 'approved', details)
    } else {
        console.log('Validação facial FALHOU')
        // Fail: Reject Selfie (usually the one being verified)
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

  } catch (error: unknown) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})

async function compressImage(bytes: Uint8Array, maxSizeKB: number = 1024): Promise<Uint8Array> {
  try {
    if (bytes.length < maxSizeKB * 1024) {
      return bytes
    }
    console.log(`Imagem grande (${Math.round(bytes.length/1024)}KB), comprimindo...`)

    const tempInput = await Deno.makeTempFile({ suffix: '.jpg' })
    const tempOutput = await Deno.makeTempFile({ suffix: '.jpg' })

    try {
      await Deno.writeFile(tempInput, bytes)

      // Comprimir com ImageMagick (convert)
      const process = Deno.run({
        cmd: ['convert', tempInput, '-resize', '800x800>', '-quality', '85', tempOutput],
        stdout: 'null',
        stderr: 'null'
      })

      await process.status()
      process.close?.()

      const compressed = await Deno.readFile(tempOutput)
      console.log(`Comprimido: ${Math.round(bytes.length/1024)}KB → ${Math.round(compressed.length/1024)}KB`)
      return compressed
    } finally {
      await Deno.remove(tempInput).catch(() => {})
      await Deno.remove(tempOutput).catch(() => {})
    }
  } catch (e) {
    console.warn('Compressão falhou, usando bytes originais:', e)
    return bytes
  }
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

async function compareTwoFaces(client: RekognitionClient, source: Uint8Array, target: Uint8Array) {
    const command = new CompareFacesCommand({
        SourceImage: { Bytes: source },
        TargetImage: { Bytes: target },
        SimilarityThreshold: 80 // 80% confidence
    })
    
    try {
        const response = await client.send(command)
        const match = (response.FaceMatches?.length || 0) > 0
        const similarity = match ? response.FaceMatches![0].Similarity : 0
        return { match, similarity: similarity || 0 }
    } catch (e: unknown) {
        console.error('Rekognition Error:', e)
        // If no faces found in source or target, it throws InvalidParameterException
        const name = (typeof e === 'object' && e && 'name' in e) ? (e as { name: string }).name : ''
        const message = e instanceof Error ? e.message : 'Unknown error'
        if (name === 'InvalidParameterException') {
            return { match: false, similarity: 0, error: 'Face not detected in one of the images' }
        }
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
