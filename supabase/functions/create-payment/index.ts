import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validar JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ Token não fornecido');
      return new Response(JSON.stringify({ error: 'Token não fornecido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('❌ Token inválido:', authError?.message);
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { plan_id, payment_method, card_data } = await req.json();
    console.log('📦 Dados recebidos:', { plan_id, payment_method, user_id: user.id });

    // Buscar perfil do estudante
    const { data: profile, error: profileError } = await supabase
      .from('student_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('❌ Perfil não encontrado:', profileError?.message);
      return new Response(JSON.stringify({ error: 'Perfil não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar plano
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', plan_id)
      .single();

    if (planError || !plan) {
      console.error('❌ Plano não encontrado:', planError?.message);
      return new Response(JSON.stringify({ error: 'Plano não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Plano encontrado:', plan.name, '- R$', plan.price);

    // Gerar resposta mock conforme método
    let responseData: Record<string, unknown> = {};
    let paymentStatus: 'pending' | 'approved' = 'pending';
    let pixCode: string | null = null;
    let pixQrCode: string | null = null;
    let pixQrCodeBase64: string | null = null;
    let pixExpiresAt: string | null = null;

    if (payment_method === 'pix') {
      // Gerar código PIX mock
      pixCode = `00020126580014br.gov.bcb.pix0136${crypto.randomUUID().replace(/-/g, '')}5204000053039865802BR5925URE BRASIL CARTEIRINHAS6009SAO PAULO62070503***6304`;
      pixExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      
      // QR Code mock em base64 (placeholder - em produção seria gerado pelo gateway)
      pixQrCodeBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAAAXNSR0IArs4c6QAADKlJREFUeF7tnVuS3DYMRdv7X3Q6k0mNy7IovkACpP6pqu6WKIIXl4/u6Z9//vnnr/nP8ufx+dPlzy/P53/55Pl5+fmvz/yc8fXr9fX5efnz9fn6/PH1++Pz4+f5+u/v/J7x9XH5+fH17+fz9fn1+fH7z9fvz9f39+fv31+f35+/f19f/X1+/vj69evj8/fnx+f3x/fnz1++f/359fX94/3168fXn5+v37++/ny9v39/fv/5en9/fX39/ny9v79/f39/f/79/f31+/f71/d/v/7893//+Pz9+/f/Xv/3/d/3b/9//9+/v/7//fr+/f3/X/99+/X+3+/fv/9+e39+ff/v/f3+/Pr6//fr+/v7+/t/n5/fn9//fX9+//7+/Pf39/f//vn59f36/v76/vz8/fn++ev39/f3+9fH59e/v/7+/Pr88/Xz8/v39/f39/f3z8/f31/f37++fv/5+v799f3119ev31+/vr+/v79//fn6/vf79+f399ev76/v78+vr+//fr+/v74+v/77+/3z8/t/v/999+3+/v39/fn+9fv/79/v/3x+f39/f339/v719f++vn9/fn9/f/76+/7+/fn69fHf99f3t9fv//fr9++v35/ff379/Pz6/Pn5+f39+/P7+/vfH5//fn79+vr19eP76/vr1+/vr99f35+//399fv/6+vr16+f39+f31/f39/fv799f//3z+/v7+/vz8+/P79+fX/97f/35/v72+v3++/fn13+/Pn/9/O/79/f/vn59e/3+/fvr9+/fv77++v78/vr6+vXz4/v79/v/Pr++v789vv/8/vrv9+/3z+/fr///fn1+/fv36+P79+/f31+/v/78+/v7+/v363+/v74/vz+/v39//f76+/r8/vr68/Xn9+/f35/fn9+/v7+//v788/Pr+/v76/f79+/3z6/v39/fn5/f359f/7++vr++vr9/fn19//fz6/f39/e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t';
      pixQrCode = pixCode;
      
      responseData = {
        pix_qr_code: pixCode,
        pix_qr_code_base64: pixQrCodeBase64,
        pix_expires_at: pixExpiresAt
      };
      console.log('✅ PIX gerado, expira em:', pixExpiresAt);

    } else if (payment_method === 'credit_card') {
      console.log('💳 Processando cartão:', card_data?.number?.substring(0, 4) + '****');
      paymentStatus = 'approved';
      responseData = {
        success: true,
        transaction_id: `TXN_${Date.now()}_${Math.random().toString(36).substring(7)}`
      };
      console.log('✅ Cartão aprovado');

    } else if (payment_method === 'debit_card') {
      // Boleto como debit_card conforme enum do banco
      responseData = {
        boleto_url: `https://mock-boleto.example.com/${crypto.randomUUID()}`,
        boleto_barcode: `23793.38128 60000.000003 00000.000400 1 ${Date.now()}`
      };
      console.log('✅ Boleto gerado');
    }

    // Criar registro de pagamento
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        student_id: profile.id,
        plan_id: plan_id,
        amount: plan.price,
        payment_method: payment_method,
        status: paymentStatus,
        pix_code: pixCode,
        pix_qr_code: pixQrCode,
        pix_qr_code_base64: pixQrCodeBase64,
        pix_expires_at: pixExpiresAt,
        confirmed_at: paymentStatus === 'approved' ? new Date().toISOString() : null,
        metadata: { mock: true, card_last_digits: card_data?.number?.slice(-4) }
      })
      .select()
      .single();

    if (paymentError) {
      console.error('❌ Erro ao criar payment:', paymentError.message);
      return new Response(JSON.stringify({ error: 'Erro ao registrar pagamento' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('💾 Payment criado:', payment.id);

    return new Response(JSON.stringify({
      ...responseData,
      payment_id: payment.id,
      mock: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    console.error('❌ Erro inesperado:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
