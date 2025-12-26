import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔵 [pagbank-session] Starting session generation...')

    const PAGBANK_EMAIL = Deno.env.get('PAGBANK_EMAIL')
    const PAGBANK_TOKEN = Deno.env.get('PAGBANK_TOKEN')
    const PAGBANK_SANDBOX = Deno.env.get('PAGBANK_SANDBOX') === 'true'

    if (!PAGBANK_EMAIL || !PAGBANK_TOKEN) {
      console.error('❌ [pagbank-session] Missing PagBank credentials')
      throw new Error('PagBank credentials not configured')
    }

    const baseUrl = PAGBANK_SANDBOX 
      ? 'https://ws.sandbox.pagseguro.uol.com.br'
      : 'https://ws.pagseguro.uol.com.br'

    const sessionUrl = `${baseUrl}/v2/sessions?email=${encodeURIComponent(PAGBANK_EMAIL)}&token=${encodeURIComponent(PAGBANK_TOKEN)}`

    console.log('🔵 [pagbank-session] Calling PagBank API...', { sandbox: PAGBANK_SANDBOX })

    const response = await fetch(sessionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    const responseText = await response.text()
    console.log('🔵 [pagbank-session] PagBank response status:', response.status)

    if (!response.ok) {
      console.error('❌ [pagbank-session] PagBank API error:', responseText)
      throw new Error(`PagBank API error: ${response.status}`)
    }

    // Parse XML response to extract session ID
    // Response format: <?xml version="1.0" encoding="ISO-8859-1"?><session><id>...</id></session>
    const sessionIdMatch = responseText.match(/<id>([^<]+)<\/id>/)
    
    if (!sessionIdMatch || !sessionIdMatch[1]) {
      console.error('❌ [pagbank-session] Could not extract session ID from response:', responseText)
      throw new Error('Could not extract session ID')
    }

    const sessionId = sessionIdMatch[1]
    console.log('✅ [pagbank-session] Session created successfully')

    return new Response(
      JSON.stringify({ success: true, sessionId }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('❌ [pagbank-session] Error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
