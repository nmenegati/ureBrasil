/**
 * mercadopago-payment: Cria pagamentos via Mercado Pago (cartão ou PIX).
 *
 * TRIGGER: chamada HTTP autenticada a partir do frontend (Authorization: Bearer access_token).
 *
 * FLUXO:
 * 1. Valida o token do Supabase e identifica o usuário.
 * 2. Carrega student_profiles para obter dados do pagador (nome, CPF, endereço).
 * 3. Lê o body com dados do pagamento (amount, plan_id, card_token, payment_method_id...).
 * 4. Monta e envia a requisição para a API do Mercado Pago (cartão ou PIX).
 * 5. Registra o resultado em payments e vincula a planos/carteirinhas conforme metadata.
 * 6. Retorna ao frontend JSON com status do pagamento e dados adicionais (ex.: PIX QR code).
 *
 * EFEITOS NO BANCO:
 * - SELECT em student_profiles para obter dados do estudante.
 * - INSERT/UPDATE em payments (dependendo da implementação interna).
 * - Pode disparar triggers que criam/atualizam student_cards.
 *
 * ATENÇÃO:
 * - Usa SERVICE_ROLE_KEY e deve ser exposta apenas a clientes autenticados.
 * - metadata pode incluir flags como is_upsell, is_physical_avulsa e original_payment_id;
 *   é responsabilidade de outras funções/triggers interpretar essas flags.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // 1. Autenticar usuário
  // Client ANTES do auth check
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verificar autenticação
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    })
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Token inválido' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    })
  }

  try {

    // 2. Ler body
    const body = await req.json();
    const {
      payment_method,  // "credit_card" ou "pix"
      amount,          // em REAIS (ex: 29.00)
      plan_id,
      installments = 1,
      card_token,      // token gerado pelo SDK MP.js (só para cartão)
      payment_method_id, // "visa", "master", etc (só para cartão)
      issuer_id,       // banco emissor (só para cartão)
      payer_email,
      payer_doc_type = "CPF",
      payer_doc_number,
      description = "Carteirinha Estudantil URE Brasil",
      // Flags de contexto
      is_upsell = false,
      original_payment_id = null,
      metadata = {},
    } = body;

    // 3. Buscar perfil do estudante (inclui plan_id para validação de preço)
    const { data: profile } = await supabase
      .from("student_profiles")
      .select("id, full_name, cpf, phone, cep, street, number, neighborhood, city, state, plan_id")
      .eq("user_id", user.id)
      .single();

    if (!profile) throw new Error("Perfil não encontrado");

    // 4. VALIDAÇÃO SERVER-SIDE: determinar tipo de compra e preço correto
    // Flags podem vir no nível de cima OU dentro de metadata (cada tela monta diferente).
    const effectiveIsUpsell = is_upsell === true || metadata?.is_upsell === true;
    const effectiveIsAvulsa = metadata?.is_physical_avulsa === true;
    const effectiveOriginalPaymentId =
      original_payment_id ||
      (typeof metadata?.original_payment_id === "string" ? metadata.original_payment_id : null);

    let validatedIsUpsell = false;
    let validatedIsAvulsa = false;
    let validatedOriginalPaymentId: string | null = null;
    let resolvedPlanId: string | null = null;
    let serverAmount: number;

    if (effectiveIsUpsell && effectiveOriginalPaymentId) {
      const { data: origPayment } = await supabase
        .from("payments")
        .select("id, student_id, status")
        .eq("id", effectiveOriginalPaymentId)
        .single();

      if (origPayment && origPayment.student_id === profile.id && origPayment.status === "approved") {
        validatedIsUpsell = true;
        validatedOriginalPaymentId = origPayment.id;
      } else {
        console.error(`🚫 UPSELL RECUSADO: student_id=${profile.id} original_payment_id=${effectiveOriginalPaymentId} motivo=${!origPayment ? "não encontrado" : origPayment.student_id !== profile.id ? "pertence a outro aluno" : "status=" + origPayment.status}`);
        return new Response(JSON.stringify({ success: false, error: "Pagamento original não encontrado ou não pertence a este aluno" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!validatedIsUpsell && effectiveIsAvulsa && effectiveOriginalPaymentId) {
      const { data: origPayment } = await supabase
        .from("payments")
        .select("id, student_id, status")
        .eq("id", effectiveOriginalPaymentId)
        .single();

      if (origPayment && origPayment.student_id === profile.id && origPayment.status === "approved") {
        validatedIsAvulsa = true;
        validatedOriginalPaymentId = origPayment.id;
      } else {
        console.error(`🚫 AVULSA RECUSADA: student_id=${profile.id} original_payment_id=${effectiveOriginalPaymentId} motivo=${!origPayment ? "não encontrado" : origPayment.student_id !== profile.id ? "pertence a outro aluno" : "status=" + origPayment.status}`);
        return new Response(JSON.stringify({ success: false, error: "Pagamento original não encontrado ou não pertence a este aluno" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (validatedIsUpsell) {
      const { data: upsellPlan } = await supabase
        .from("plans")
        .select("id, price")
        .eq("type", "fisica_upsell")
        .eq("is_active", true)
        .single();

      if (!upsellPlan) {
        return new Response(JSON.stringify({ success: false, error: "Plano de upsell não encontrado ou inativo" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      serverAmount = upsellPlan.price;
      resolvedPlanId = upsellPlan.id;
    } else if (validatedIsAvulsa) {
      const { data: avulsaPlan } = await supabase
        .from("plans")
        .select("id, price")
        .eq("type", "fisica_avulsa")
        .eq("is_active", true)
        .single();

      if (!avulsaPlan) {
        return new Response(JSON.stringify({ success: false, error: "Plano de carteira física não encontrado ou inativo" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      serverAmount = avulsaPlan.price;
      resolvedPlanId = avulsaPlan.id;
    } else {
      if (!profile.plan_id) {
        return new Response(JSON.stringify({ success: false, error: "Nenhum plano vinculado ao perfil" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: mainPlan } = await supabase
        .from("plans")
        .select("id, price")
        .eq("id", profile.plan_id)
        .eq("is_active", true)
        .single();

      if (!mainPlan) {
        return new Response(JSON.stringify({ success: false, error: "Plano não encontrado ou inativo" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      serverAmount = mainPlan.price;
      resolvedPlanId = mainPlan.id;
    }

    if (typeof amount === "number" && Number(amount) !== serverAmount) {
      console.warn(`⚠️ AMOUNT MISMATCH: student_id=${profile.id} body_amount=${amount} server_amount=${serverAmount} is_upsell=${validatedIsUpsell} is_avulsa=${validatedIsAvulsa}`);
    }

    // 5. Determinar ambiente
    const mode = Deno.env.get("MP_MODE") || "sandbox";
    const accessToken = mode === "production"
      ? Deno.env.get("MP_PROD_ACCESS_TOKEN")
      : Deno.env.get("MP_ACCESS_TOKEN");

    if (!accessToken) throw new Error("MP_ACCESS_TOKEN não configurado");

    // 6. Montar payload Mercado Pago (valor do SERVIDOR, dados do BANCO)
    const payerCpf = profile.cpf?.replace(/\D/g, "") || "";
    let mpPayload: any = {
      transaction_amount: serverAmount,
      description,
      external_reference: `ure_${profile.id}_${Date.now()}`,
      payer: {
        email: user.email,
        first_name: profile.full_name?.split(" ")[0] || "Estudante",
        last_name: profile.full_name?.split(" ").slice(1).join(" ") || "URE",
        identification: {
          type: "CPF",
          number: payerCpf,
        },
      },
    };

    if (payment_method === "credit_card") {
      // CARTÃO: usar token gerado pelo SDK
      mpPayload.token = card_token;
      mpPayload.installments = Number(installments);
      mpPayload.payment_method_id = payment_method_id; // "visa", "master"
      if (issuer_id) mpPayload.issuer_id = issuer_id;
    } else if (payment_method === "pix") {
      // PIX: só precisa do payment_method_id
      mpPayload.payment_method_id = "pix";
    }

    // 7. Enviar para Mercado Pago
    const idempotencyKey = crypto.randomUUID();

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(mpPayload),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Erro MP:", JSON.stringify(mpData));
      throw new Error(mpData.message || `Erro Mercado Pago: ${mpResponse.status}`);
    }

    // 8. Mapear status MP → nosso status
    const statusMap: Record<string, string> = {
      approved: "approved",
      pending: "pending",
      authorized: "processing",
      in_process: "processing",
      in_mediation: "processing",
      rejected: "rejected",
      cancelled: "rejected",
      refunded: "refunded",
      charged_back: "refunded",
    };

    const paymentStatus = statusMap[mpData.status] || "pending";

    // 9. Preparar dados PIX (se aplicável)
    let pixData: any = {};
    if (payment_method === "pix" && mpData.point_of_interaction?.transaction_data) {
      const txData = mpData.point_of_interaction.transaction_data;
      pixData = {
        pix_qr_code: txData.qr_code || null,
        pix_qr_code_base64: txData.qr_code_base64 || null,
        pix_expires_at: mpData.date_of_expiration || null,
      };
    }

    // 10. Salvar no banco (valores validados pelo servidor)
    const { data: payment, error: insertError } = await supabase
      .from("payments")
      .insert({
        student_id: profile.id,
        plan_id: resolvedPlanId,
        amount: serverAmount,
        payment_method: payment_method === "credit_card" ? "credit_card" : "pix",
        status: paymentStatus,
        gateway_name: "mercadopago",
        gateway_charge_id: String(mpData.id),
        gateway_reference_id: mpPayload.external_reference,
        card_last_digits: mpData.card?.last_four_digits || null,
        card_brand: mpData.payment_method_id || null,
        installments: payment_method === "credit_card" ? Number(installments) : null,
        confirmed_at: paymentStatus === "approved" ? new Date().toISOString() : null,
        metadata: {
          ...metadata,
          mp_status: mpData.status,
          mp_status_detail: mpData.status_detail,
          mp_payment_type: mpData.payment_type_id,
          is_upsell: validatedIsUpsell,
          is_physical_avulsa: validatedIsAvulsa,
          original_payment_id: validatedOriginalPaymentId,
          idempotency_key: idempotencyKey,
          ...(typeof amount === "number" && Number(amount) !== serverAmount
            ? { body_amount_override: amount }
            : {}),
        },
        ...pixData,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Erro INSERT:", insertError);
      throw new Error("Erro ao salvar pagamento");
    }

    // 11. Retornar resposta
    return new Response(JSON.stringify({
      success: true,
      payment_id: payment.id,
      status: paymentStatus,
      mp_status: mpData.status,
      mp_status_detail: mpData.status_detail,
      // PIX: retornar QR Code
      ...(payment_method === "pix" ? {
        pix_qr_code: pixData.pix_qr_code,
        pix_qr_code_base64: pixData.pix_qr_code_base64,
        pix_expires_at: pixData.pix_expires_at,
      } : {}),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro geral:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
