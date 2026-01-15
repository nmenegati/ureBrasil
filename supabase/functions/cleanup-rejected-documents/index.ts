import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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
