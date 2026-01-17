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
    const { student_id } = await req.json()
    if (!student_id) {
      return new Response(JSON.stringify({ error: 'student_id required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    
    const { data: card } = await supabase
      .from('student_cards')
      .select(`
        *,
        student_profiles (
          full_name,
          institution,
          course,
          profile_photo_url,
          plan_id
        )
      `)
      .eq('student_id', student_id)
      .maybeSingle()
    
    if (!card) {
      throw new Error('Card not found')
    }
    
    const isLawStudent = card.student_profiles?.plan_id === 'lexpraxis'
    const templatePrefix = isLawStudent ? 'direito-' : ''
    
    console.log(`Tipo de carteirinha: ${isLawStudent ? 'Direito (LexPraxis)' : 'Geral'}`)
    console.log(`Templates: ${templatePrefix}frente-template.png, ${templatePrefix}verso-template.png`)
    
    // TODO: Implementar geração de imagem com canvas
    // Placeholder apenas registra e retorna tipo
    // Templates disponíveis:
    // Geral: /public/templates/frente-template.png, /public/templates/verso-template.png
    // Direito: /public/templates/frente-template-direito.png, /public/templates/verso-template-direito.png
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Estrutura preparada',
      template_type: isLawStudent ? 'direito' : 'geral'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Erro:', message)
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})

