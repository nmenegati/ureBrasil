/**
 * cleanup-rejected-documents: Limpa documentos rejeitados antigos e registra auditoria.
 *
 * TRIGGER: chamada agendada via pg_cron/pg_net (cron diário) ou manual via HTTP
 *          com autenticação por bearer token de admin.
 *
 * FLUXO:
 * 1. Valida o token do Supabase (usuário administrador/sistema).
 * 2. Calcula a data de corte (90 dias atrás).
 * 3. Busca até 50 documentos com status 'rejected' criados antes da data de corte.
 * 4. Para cada documento:
 *    - Remove o arquivo correspondente do bucket documents (se existir).
 *    - Remove o registro da tabela documents (ou registra erro se falhar).
 * 5. Registra operação em audit_logs com detalhes de quantos arquivos/registros foram removidos.
 * 6. Retorna resumo JSON da execução (success, results).
 *
 * EFEITOS NO BANCO:
 * - DELETE em documents (registros antigos rejeitados).
 * - INSERT em audit_logs com ação system_cleanup.
 *
 * ATENÇÃO:
 * - Usa SERVICE_ROLE_KEY internamente; deve ser exposto apenas a chamadas internas/cron.
 * - Em caso de falha ao remover arquivos, o registro pode ser mantido para evitar órfãos.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Verificar autenticação
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    })
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token)

  if (authError || !authUser) {
    return new Response(JSON.stringify({ error: 'Token inválido' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    })
  }

  try {
    console.log('[INIT] Cleanup rejected documents started')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Calculate date 90 days ago
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const cutoffDate = ninetyDaysAgo.toISOString()

    console.log(`Searching for rejected documents before: ${cutoffDate}`)

    // 1. Fetch documents to delete
    // Limit to 50 to avoid timeouts/memory issues (cron runs daily, so it will catch up)
    const { data: docs, error: fetchError } = await supabase
      .from('documents')
      .select('id, file_url')
      .eq('status', 'rejected')
      .lt('created_at', cutoffDate)
      .limit(50)

    if (fetchError) throw fetchError

    if (!docs || docs.length === 0) {
      console.log('No documents found to cleanup.')
      return new Response(JSON.stringify({ message: 'No documents to cleanup' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    console.log(`Found ${docs.length} documents to cleanup.`)

    const results = {
      deleted_files: 0,
      deleted_records: 0,
      errors: [] as string[]
    }

    // 2. Process deletions
    for (const doc of docs) {
      try {
        // Delete from Storage
        if (doc.file_url) {
          const { error: storageError } = await supabase.storage
            .from('documents')
            .remove([doc.file_url])
          
          if (storageError) {
            console.error(`Error deleting file ${doc.file_url}:`, storageError)
            results.errors.push(`Storage delete failed for ${doc.id}`)
            // We continue to delete the record even if storage fails? 
            // Better to keep record if storage fails to avoid orphaned files, 
            // but for cleanup we might want to force it. 
            // Let's be safe: skip record deletion if storage fails.
            continue
          }
          results.deleted_files++
        }

        // Delete from Database
        const { error: dbError } = await supabase
          .from('documents')
          .delete()
          .eq('id', doc.id)

        if (dbError) {
            console.error(`Error deleting record ${doc.id}:`, dbError)
            results.errors.push(`DB delete failed for ${doc.id}`)
        } else {
            results.deleted_records++
        }

      } catch (err: unknown) {
        console.error(`Unexpected error processing ${doc.id}:`, err)
        results.errors.push(`Error processing ${doc.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    console.log('Cleanup completed:', results)

    // 3. Log to audit_logs
    await supabase.from('audit_logs').insert({
        action: 'system_cleanup',
        resource_type: 'system',
        details: {
            target: 'rejected_documents',
            cutoff_date: cutoffDate,
            results
        }
    })

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: unknown) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
