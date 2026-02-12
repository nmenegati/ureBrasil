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
    const templatePrefix = isLawStudent ? 'direito-' : 'geral-'
    
    console.log(`Tipo de carteirinha: ${isLawStudent ? 'Direito (LexPraxis)' : 'Geral'}`)
    console.log(`Templates: ${templatePrefix}frente-template-v.png, ${templatePrefix}verso-template-v.png`)
    
    // TODO: Implementar geração de imagem com canvas
    // Placeholder apenas registra e retorna tipo
    
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
