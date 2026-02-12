import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Autenticar usuário
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Sessão inválida");

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

    // 3. Buscar perfil do estudante
    const { data: profile } = await supabase
      .from("student_profiles")
      .select("id, full_name, cpf, phone, cep, street, number, neighborhood, city, state")
      .eq("user_id", user.id)
      .single();

    if (!profile) throw new Error("Perfil não encontrado");

    // 4. Determinar ambiente
    const mode = Deno.env.get("MP_MODE") || "sandbox";
    const accessToken = mode === "production"
      ? Deno.env.get("MP_PROD_ACCESS_TOKEN")
      : Deno.env.get("MP_ACCESS_TOKEN");

    if (!accessToken) throw new Error("MP_ACCESS_TOKEN não configurado");

    // 5. Montar payload Mercado Pago
    let mpPayload: any = {
      transaction_amount: Number(amount),
      description,
      external_reference: `ure_${profile.id}_${Date.now()}`,
      payer: {
        email: payer_email || user.email,
        first_name: profile.full_name?.split(" ")[0] || "Estudante",
        last_name: profile.full_name?.split(" ").slice(1).join(" ") || "URE",
        identification: {
          type: payer_doc_type,
          number: payer_doc_number || profile.cpf?.replace(/\D/g, ""),
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

    // 6. Enviar para Mercado Pago
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

    // 7. Mapear status MP → nosso status
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

    // 8. Preparar dados PIX (se aplicável)
    let pixData: any = {};
    if (payment_method === "pix" && mpData.point_of_interaction?.transaction_data) {
      const txData = mpData.point_of_interaction.transaction_data;
      pixData = {
        pix_qr_code: txData.qr_code || null,
        pix_qr_code_base64: txData.qr_code_base64 || null,
        pix_expires_at: mpData.date_of_expiration || null,
      };
    }

    // 9. Salvar no banco
    const { data: payment, error: insertError } = await supabase
      .from("payments")
      .insert({
        student_id: profile.id,
        plan_id,
        amount: Number(amount),
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
          is_upsell,
          original_payment_id,
          idempotency_key: idempotencyKey,
        },
        ...pixData,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Erro INSERT:", insertError);
      throw new Error("Erro ao salvar pagamento");
    }

    // 10. Retornar resposta
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
