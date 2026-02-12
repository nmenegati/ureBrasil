import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0'
import { corsHeaders } from '../_shared/cors.ts'

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
    // Criar cliente Supabase com service role para operações admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Criar cliente normal para verificar o usuário que está chamando
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header missing' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    )

    // Verificar se o usuário está autenticado
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('❌ User not authenticated:', userError)
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Authenticated user:', user.id)

    // Verificar se o usuário tem role de admin
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleError || !roleData || roleData.role !== 'admin') {
      console.error('❌ User is not admin:', { user: user.id, role: roleData?.role })
      return new Response(
        JSON.stringify({ error: 'Unauthorized: admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ User is admin')

    // Ler dados da requisição com validação de tipos
    const body = (await req.json()) as unknown
    if (typeof body !== 'object' || body === null) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const { targetUserId, newEmail } = body as Record<string, unknown>

    if (typeof targetUserId !== 'string' || typeof newEmail !== 'string') {
      return new Response(
        JSON.stringify({ error: 'targetUserId and newEmail are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('📧 Updating email for user:', targetUserId, 'to:', newEmail)

    // Atualizar email usando service role
    // email_confirm: true força o envio de um novo email de confirmação
    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      {
        email: newEmail,
        email_confirm: true
      }
    )

    if (updateError) {
      console.error('❌ Error updating email:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update email: ' + updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Email updated successfully')

    // Registrar ação no log de atividades
    const { error: logError } = await supabase
      .from('activity_log')
      .insert({
        user_id: user.id,
        action: 'admin_email_update',
        entity_type: 'auth_user',
        entity_id: targetUserId,
        details: {
          old_email: updateData.user?.email,
          new_email: newEmail,
          admin_id: user.id,
          timestamp: new Date().toISOString()
        }
      })

    if (logError) {
      console.error('⚠️  Failed to log activity:', logError)
      // Não falhar a requisição por causa do log
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email updated successfully. Confirmation email sent to new address.',
        user: updateData.user
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error: unknown) {
    console.error('💥 Exception in admin-update-email:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
