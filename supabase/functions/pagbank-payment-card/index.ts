import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    console.log('🔵 [pagbank-payment-card] Starting payment processing...')

    const PAGBANK_EMAIL = Deno.env.get('PAGBANK_EMAIL')
    const PAGBANK_TOKEN = Deno.env.get('PAGBANK_TOKEN')
    const PAGBANK_SANDBOX = Deno.env.get('PAGBANK_SANDBOX') === 'true'
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!PAGBANK_EMAIL || !PAGBANK_TOKEN) {
      console.error('❌ [pagbank-payment-card] Missing PagBank credentials')
      throw new Error('PagBank credentials not configured')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const body = await req.json()
    const {
      cardToken,
      cardholderName,
      cardholderCPF,
      cardholderPhone,
      cardholderBirthDate,
      installments,
      amount,
      planId,
      userId,
    } = body

    console.log('🔵 [pagbank-payment-card] Payment data received:', { 
      planId, 
      amount, 
      installments,
      userId 
    })

    // Validate required fields
    if (!cardToken || !amount || !planId || !userId) {
      throw new Error('Missing required payment fields')
    }

    // Get student profile
    const { data: profile, error: profileError } = await supabase
      .from('student_profiles')
      .select(`
        id, 
        full_name, 
        cpf, 
        phone,
        birth_date,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
        postal_code
      `)
      .eq('user_id', userId)
      .single()

    if (profileError || !profile) {
      console.error('❌ [pagbank-payment-card] Profile not found:', profileError)
      throw new Error('Student profile not found')
    }

    console.log('🔵 [pagbank-payment-card] Student profile found:', profile.id)

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      console.error('❌ [pagbank-payment-card] Plan not found:', planError)
      throw new Error('Plan not found')
    }

    console.log('🔵 [pagbank-payment-card] Plan found:', plan.name)

    const baseUrl = PAGBANK_SANDBOX 
      ? 'https://ws.sandbox.pagseguro.uol.com.br'
      : 'https://ws.pagseguro.uol.com.br'

    // Build payment request
    const paymentData = new URLSearchParams()
    paymentData.append('email', PAGBANK_EMAIL)
    paymentData.append('token', PAGBANK_TOKEN)
    paymentData.append('paymentMode', 'default')
    paymentData.append('paymentMethod', 'creditCard')
    paymentData.append('receiverEmail', PAGBANK_EMAIL)
    paymentData.append('currency', 'BRL')
    
    // Item details
    paymentData.append('itemId1', planId)
    paymentData.append('itemDescription1', plan.name)
    paymentData.append('itemAmount1', amount.toFixed(2))
    paymentData.append('itemQuantity1', '1')
    
    // Reference
    const reference = `PAY-${Date.now()}-${profile.id.substring(0, 8)}`
    paymentData.append('reference', reference)
    
    // Sender (buyer) info
    paymentData.append('senderName', cardholderName || profile.full_name)
    paymentData.append('senderCPF', (cardholderCPF || profile.cpf).replace(/\D/g, ''))
    paymentData.append('senderAreaCode', (cardholderPhone || profile.phone).replace(/\D/g, '').substring(0, 2))
    paymentData.append('senderPhone', (cardholderPhone || profile.phone).replace(/\D/g, '').substring(2))
    paymentData.append('senderEmail', PAGBANK_SANDBOX ? 'test@sandbox.pagseguro.com.br' : 'cliente@email.com')
    
    // Credit card data
    paymentData.append('creditCardToken', cardToken)
    paymentData.append('installmentQuantity', String(installments || 1))
    paymentData.append('installmentValue', (amount / (installments || 1)).toFixed(2))
    paymentData.append('noInterestInstallmentQuantity', String(installments || 1))
    
    // Card holder
    paymentData.append('creditCardHolderName', cardholderName || profile.full_name)
    paymentData.append('creditCardHolderCPF', (cardholderCPF || profile.cpf).replace(/\D/g, ''))
    paymentData.append('creditCardHolderBirthDate', cardholderBirthDate || '01/01/1990')
    paymentData.append('creditCardHolderAreaCode', (cardholderPhone || profile.phone).replace(/\D/g, '').substring(0, 2))
    paymentData.append('creditCardHolderPhone', (cardholderPhone || profile.phone).replace(/\D/g, '').substring(2))
    
    // Billing address (using placeholder for sandbox)
    paymentData.append('billingAddressStreet', 'Rua Teste')
    paymentData.append('billingAddressNumber', '123')
    paymentData.append('billingAddressComplement', '')
    paymentData.append('billingAddressDistrict', 'Centro')
    paymentData.append('billingAddressPostalCode', '01310100')
    paymentData.append('billingAddressCity', 'São Paulo')
    paymentData.append('billingAddressState', 'SP')
    paymentData.append('billingAddressCountry', 'BRA')

    console.log('🔵 [pagbank-payment-card] Sending payment to PagBank...')

    const paymentUrl = `${baseUrl}/v2/transactions`
    const response = await fetch(paymentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: paymentData.toString(),
    })

    const responseText = await response.text()
    console.log('🔵 [pagbank-payment-card] PagBank response status:', response.status)

    if (!response.ok) {
      console.error('❌ [pagbank-payment-card] PagBank API error:', responseText)
      
      // Parse error from XML
      const errorMatch = responseText.match(/<message>([^<]+)<\/message>/)
      const errorMessage = errorMatch ? errorMatch[1] : 'Payment processing failed'
      
      throw new Error(errorMessage)
    }

    // Parse transaction response
    const transactionCodeMatch = responseText.match(/<code>([^<]+)<\/code>/)
    const statusMatch = responseText.match(/<status>([^<]+)<\/status>/)
    
    const transactionCode = transactionCodeMatch ? transactionCodeMatch[1] : null
    const status = statusMatch ? parseInt(statusMatch[1]) : 0

    console.log('🔵 [pagbank-payment-card] Transaction:', { transactionCode, status })

    // Map PagBank status to our status
    // 1 = Aguardando pagamento, 2 = Em análise, 3 = Paga, 4 = Disponível, 5 = Em disputa, 6 = Devolvida, 7 = Cancelada
    const statusMap: Record<number, string> = {
      1: 'pending',
      2: 'processing',
      3: 'approved',
      4: 'approved',
      5: 'processing',
      6: 'refunded',
      7: 'rejected',
    }
    const paymentStatus = statusMap[status] || 'pending'

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        student_id: profile.id,
        plan_id: planId,
        amount: amount,
        payment_method: 'credit_card',
        status: paymentStatus,
        installments: installments || 1,
        gateway_name: 'pagbank',
        gateway_reference_id: reference,
        gateway_charge_id: transactionCode,
        metadata: {
          pagbank_status: status,
          sandbox: PAGBANK_SANDBOX,
        },
        confirmed_at: paymentStatus === 'approved' ? new Date().toISOString() : null,
      })
      .select()
      .single()

    if (paymentError) {
      console.error('❌ [pagbank-payment-card] Error saving payment:', paymentError)
      throw new Error('Error saving payment record')
    }

    console.log('✅ [pagbank-payment-card] Payment saved:', payment.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        paymentId: payment.id,
        transactionCode,
        status: paymentStatus,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('❌ [pagbank-payment-card] Error:', error)
    
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
