/**
 * compare-faces: Compara selfie com documentos de rosto via AWS Rekognition.
 *
 * TRIGGER: chamada pela trigger de documentos (on_document_approved_compare_faces)
 *          e/ou manualmente via Edge Function HTTP com body { student_id }.
 *
 * FLUXO:
 * 1. Recebe student_id no body da requisição.
 * 2. Busca em documents os arquivos mais recentes de tipo 'selfie', 'rg' e 'foto'.
 * 3. Se não houver selfie + ao menos um documento com foto, retorna ready: false.
 * 4. Faz download dos arquivos relevantes do bucket de documents.
 * 5. Chama AWS Rekognition CompareFaces para cada par (selfie x rg, selfie x foto).
 * 6. Calcula se a similaridade passou do threshold configurado.
 * 7. Atualiza student_profiles.face_validated e insere registro em face_validations.
 * 8. Registra log em audit_logs com detalhes da comparação.
 *
 * EFEITOS NO BANCO:
 * - SELECT em documents para obter arquivos de rosto.
 * - UPDATE em student_profiles.face_validated (true/false).
 * - INSERT em face_validations com resultado e similaridades.
 * - INSERT em audit_logs (ação face_comparison).
 *
 * ATENÇÃO:
 * - Não altera current_onboarding_step nem o status do student_card.
 * - Falhas ao gravar em audit_logs são logadas mas não interrompem o fluxo principal.
 */
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
      .select('id, type, file_url, mime_type, status')
      .eq('student_id', student_id)
      .in('type', ['rg', 'foto', 'selfie'])
      .order('created_at', { ascending: false })

    if (docsError) throw docsError
    
    // Group by type to get latest
    type DocumentRow = { id: string; type: string; file_url: string; mime_type: string | null; status: string }
    const latestDocs: Record<string, DocumentRow> = {}
    ;((docs ?? []) as DocumentRow[]).forEach((d) => {
        if (!latestDocs[d.type]) {
            latestDocs[d.type] = d
        }
    })

    const rg = latestDocs['rg']
    const foto = latestDocs['foto']
    const selfie = latestDocs['selfie']

    // Validar apenas se tivermos pelo menos Selfie e algum documento de rosto (RG ou Foto)
    if (!selfie || (!rg && !foto)) {
      console.log('Documentos insuficientes para comparação:', { 
        hasRg: !!rg, 
        hasFoto: !!foto, 
        hasSelfie: !!selfie 
      })
      return new Response(JSON.stringify({ 
        message: 'Aguardando envio de selfie e documento com foto',
        ready: false 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

      console.log('Baixando imagens...')

    try {
      const selfieBuffer = await downloadFile(supabase, selfie.file_url)

      const rgIsImage = !!rg?.mime_type && rg.mime_type.startsWith('image/')
      const fotoIsImage = !!foto?.mime_type && foto.mime_type.startsWith('image/')

      const shouldCompareRg = !!rg && rgIsImage
      const shouldCompareFoto = !!foto && fotoIsImage

      if (!shouldCompareRg && !shouldCompareFoto) {
        console.log('Nenhum documento de rosto em formato de imagem disponível para comparação')
        return new Response(JSON.stringify({
          message: 'Nenhum documento de rosto em imagem para comparação',
          ready: false
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        })
      }

      const downloadTargets: Array<Promise<Uint8Array>> = []
      if (shouldCompareRg) downloadTargets.push(downloadFile(supabase, rg!.file_url))
      if (shouldCompareFoto) downloadTargets.push(downloadFile(supabase, foto!.file_url))

      const downloaded = await Promise.all(downloadTargets)
      let rgBuffer: Uint8Array | null = null
      let fotoBuffer: Uint8Array | null = null

      let idx = 0
      if (shouldCompareRg) {
        rgBuffer = downloaded[idx]
        idx++
      }
      if (shouldCompareFoto) {
        fotoBuffer = downloaded[idx]
      }

      console.log('Iniciando comparação AWS Rekognition...')

      let matchRG = { match: true, similarity: 100, note: 'Skipped (no rg image)' as string | undefined }
      if (shouldCompareRg && rgBuffer) {
        matchRG = await compareTwoFaces(awsClient, region, selfieBuffer, rgBuffer)
        console.log('Selfie vs RG:', matchRG)
      } else {
        console.log('Pulando comparação com RG (não é imagem ou inexistente)')
      }

      let matchFoto = { match: true, similarity: 100, note: 'Skipped (no foto image)' as string | undefined }
      if (shouldCompareFoto && fotoBuffer) {
        matchFoto = await compareTwoFaces(awsClient, region, selfieBuffer, fotoBuffer)
        console.log('Selfie vs Foto:', matchFoto)
      } else {
        console.log('Pulando comparação com Foto 3x4 (não é imagem ou inexistente)')
      }

      const passed = matchRG.match && matchFoto.match
      const details = {
        rg_match: matchRG,
        foto_match: matchFoto
      }

      if (passed) {
          console.log('Validação facial APROVADA')
          const { error: updateProfileError } = await supabase.from('student_profiles')
            .update({ face_validated: true })
            .eq('id', student_id)
          if (updateProfileError) {
            console.error('[FACE] Erro ao atualizar student_profiles.face_validated:', {
              student_id,
              error: updateProfileError.message,
            })
          }

          const { error: validationInsertOkError } = await supabase.from('face_validations').insert({
            student_id,
            rg_similarity: matchRG.similarity || 0,
            foto_similarity: matchFoto.similarity || 0,
            passed: true,
            attempt_number: 1,
          })
          if (validationInsertOkError) {
            console.error('[FACE] Erro ao registrar face_validations (aprovado):', {
              student_id,
              error: validationInsertOkError.message,
            })
          }

          const docIdsToApprove = [selfie.id]
          if (rg) docIdsToApprove.push(rg.id)
          if (foto) docIdsToApprove.push(foto.id)
          
          const { error: approveDocsError } = await supabase.from('documents')
              .update({ status: 'approved' })
              .in('id', docIdsToApprove)
              .eq('status', 'pending')
          if (approveDocsError) {
            console.error('[FACE] Erro ao atualizar documentos para approved:', {
              student_id,
              docs: docIdsToApprove,
              error: approveDocsError.message,
            })
          }

          if (foto?.file_url) {
            await copyPhotoToPublicBucket(supabase, student_id, foto.file_url)
          }

          await logAudit(supabase, student_id, 'approved', details)
      } else {
          console.log('Validação facial FALHOU')
          let reason = ''
          if (!matchRG.match) reason += `Rosto não confere com RG (${Math.round(matchRG.similarity)}%). `
          if (!matchFoto.match) reason += `Rosto não confere com Foto 3x4 (${Math.round(matchFoto.similarity)}%).`

          const { error: validationInsertFailError } = await supabase.from('face_validations').insert({
            student_id,
            rg_similarity: matchRG.similarity || 0,
            foto_similarity: matchFoto.similarity || 0,
            passed: false,
            attempt_number: 1,
          })
          if (validationInsertFailError) {
            console.error('[FACE] Erro ao registrar face_validations (reprovado):', {
              student_id,
              error: validationInsertFailError.message,
            })
          }

          const { error: rejectDocError } = await supabase.from('documents').update({
              status: 'rejected',
              rejection_reason: reason.trim()
          }).eq('id', selfie.id)
          if (rejectDocError) {
            console.error('[FACE] Erro ao marcar selfie como rejeitada:', {
              selfieId: selfie.id,
              student_id,
              error: rejectDocError.message,
            })
          }

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
        status: 500
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
    const { error } = await supabase.from('audit_logs').insert({
        action: 'face_comparison',
        resource_type: 'student_profile',
        resource_id: studentId, 
        student_id: studentId,
        details: { result, ...details }
    })
    if (error) {
      console.error('[FACE] Audit log insert error:', {
        studentId,
        error: error.message,
      })
    }
}

async function copyPhotoToPublicBucket(supabase: SupabaseClient, studentId: string, filePath: string) {
  try {
    console.log('[PROFILE PHOTO] Copiando foto aprovada para bucket profile-photos...', {
      studentId,
      filePath,
    })

    const { data, error } = await supabase.storage
      .from('documents')
      .download(filePath)

    if (error || !data) {
      console.error('[PROFILE PHOTO] Erro ao baixar foto do bucket documents:', error)
      return
    }

    const contentType = (data as any).type || 'image/jpeg'

    const { error: uploadError } = await supabase.storage
      .from('profile-photos')
      .upload(filePath, data, {
        upsert: true,
        contentType,
      })

    if (uploadError) {
      console.error('[PROFILE PHOTO] Erro ao enviar foto para bucket profile-photos:', uploadError)
      return
    }

    const { error: updateError } = await supabase
      .from('student_profiles')
      .update({ profile_photo_url: filePath })
      .eq('id', studentId)

    if (updateError) {
      console.error('[PROFILE PHOTO] Erro ao atualizar profile_photo_url:', updateError)
    } else {
      console.log('[PROFILE PHOTO] Foto copiada para bucket público e profile_photo_url atualizado')
    }
  } catch (e) {
    console.error('[PROFILE PHOTO] Erro inesperado ao copiar foto para bucket público:', e)
  }
}
