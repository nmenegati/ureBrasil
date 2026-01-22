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
    let rawBody: unknown = null;
    try {
      rawBody = await req.json();
    } catch (_e) {
      rawBody = null;
    }

    const authHeader = req.headers.get("Authorization");

    console.log("🔍 [START] Recebido:", {
      hasAuth: !!authHeader,
      method: req.method,
      bodyKeys:
        rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
          ? Object.keys(rawBody as Record<string, unknown>)
          : [],
    });

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Variáveis de ambiente do Supabase não configuradas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace("Bearer ", "").trim();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

// ← ADICIONAR AQUI
    console.log("🔍 Debug auth:", {
      hasToken: !!token,
      hasUser: !!user,
      userError: userError?.message,
      userId: user?.id,
      userEmail: user?.email
    });

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = rawBody as {
      amount?: number;
      installments?: number;
      card?: {
        number: string;
        exp_month: string;
        exp_year: string;
        security_code: string;
        holder_name: string;
      };
      metadata?: Record<string, unknown>;
    } | null;

    if (!body || typeof body.amount !== "number" || !body.card) {
      return new Response(
        JSON.stringify({ error: "Parâmetros inválidos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const amount = body.amount;
    const installments = body.installments && body.installments > 0 ? body.installments : 1;
    const amountInCents = Math.round(amount * 100);
    const card = body.card;
    const metadata = body.metadata || {};

    console.log("🔍 [BODY]:", {
      amount,
      amountInCents,
      installments,
      hasCard: !!card,
      metadata,
    });

    const { data: profile } = await supabase
      .from("student_profiles")
      .select(
        "id, plan_id, full_name, cpf, phone, cep, street, number, neighborhood, city, state",
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "Perfil não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("🔍 [PROFILE]:", {
      hasProfile: !!profile,
      student_id: profile?.id,
      plan_id: profile?.plan_id,
    });

    const mode = (Deno.env.get("PAGBANK_MODE") || "sandbox").toLowerCase();
    const isSandbox = mode !== "prod";
    const baseUrl = isSandbox
      ? "https://sandbox.api.pagseguro.com"
      : "https://api.pagseguro.com";

    const apiKey = isSandbox
      ? Deno.env.get("PAGBANK_SANDBOX_KEY")
      : Deno.env.get("PAGBANK_PROD_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Chave PagBank não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const referenceId = `ure-${user.id}-${Date.now()}`;

    const orderPayload = {
      reference_id: referenceId,
      customer: {
        name: profile.full_name,
        email: user.email,
        tax_id: (profile.cpf as string).replace(/\D/g, ""),
        phones: profile.phone
          ? [
              {
                country: "55",
                area: (profile.phone as string).replace(/\D/g, "").substring(0, 2),
                number: (profile.phone as string).replace(/\D/g, "").substring(2),
                type: "MOBILE",
              },
            ]
          : [],
        address: profile.cep
          ? {
              postal_code: (profile.cep as string).replace(/\D/g, ""),
              street: profile.street,
              number: profile.number,
              locality: profile.neighborhood,
              city: profile.city,
              region_code: profile.state,
              country: "BRA",
            }
          : undefined,
      },
      items: [
        {
          name: "Carteirinha URE Brasil",
          quantity: 1,
          unit_amount: amountInCents,  // ← TROCAR AQUI
        },
      ],
      charges: [
        {
          amount: {
            value: amountInCents,  // ← E AQUI
            currency: "BRL",
          },
          payment_method: {
            type: "CREDIT_CARD",
            installments,
            capture: true,
            card: {
              number: card.number.replace(/\s/g, ""),
              exp_month: card.exp_month,
              exp_year: card.exp_year,
              security_code: card.security_code,
              holder: {
                name: card.holder_name,
              },
            },
          },
          metadata,
        },
      ],
    };

    console.log("MODE:", Deno.env.get("PAGBANK_MODE"));
    console.log("KEY:", Deno.env.get("PAGBANK_SANDBOX_KEY") ? "OK" : "MISSING");

    console.log("🔍 [PAGBANK] Enviando:", {
      baseUrl,
      referenceId,
      amountInCents,
    });

    const response = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    const responseText = await response.text();
    let responseJson: any = null;

    try {
      responseJson = responseText ? JSON.parse(responseText) : null;
    } catch (_e) {
      responseJson = { raw: responseText };
    }

    if (!response.ok) {
      console.error("PagBank /orders error:", response.status, responseJson);
      return new Response(
        JSON.stringify({
          success: false,
          status: response.status,
          error: responseJson?.message || "Erro ao processar pagamento no PagBank",
          details: responseJson,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const orderId = responseJson.id || responseJson.reference_id;

    console.log("🔍 [ORDER_ID]:", {
      raw_id: responseJson.id,
      raw_reference: responseJson.reference_id,
      orderId_final: orderId,
      orderId_type: typeof orderId,
    });

    const charge = Array.isArray(responseJson.charges)
      ? responseJson.charges[0]
      : null;
    const chargeStatus = charge?.status || responseJson.status;

    const normalizedStatus =
      typeof chargeStatus === "string" ? chargeStatus.toUpperCase() : "";

    if (normalizedStatus === "PAID") {
      const cardNumberClean = card.number.replace(/\s/g, "");
      const lastDigits = cardNumberClean.slice(-4) || null;

      const orderIdString = typeof orderId === "string" ? orderId : String(orderId ?? "");

      console.log("🔍 [PRE-INSERT]:", {
        orderId_value: orderIdString,
        orderId_length: orderIdString.length,
        orderId_charCodes: Array.from(orderIdString.substring(0, 10)).map((c) =>
          c.charCodeAt(0)
        ),
        gateway_reference_id: orderIdString,
      });

      const { error: paymentError } = await supabase
        .from("payments")
        .insert({
          student_id: profile.id,
          plan_id: profile.plan_id,
          amount,
          payment_method: "credit_card",
          status: "approved",
          installments,
          card_last_digits: lastDigits,
          gateway_name: "pagbank",
          gateway_reference_id: orderId,
          confirmed_at: new Date().toISOString(),
          metadata: {
            ...metadata,
            pagbank_status: chargeStatus,
            pagbank_charge: charge,
          },
        });

      if (paymentError) {
        console.error("Erro ao salvar pagamento PagBank:", paymentError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        orderId,
        status: chargeStatus,
        raw: responseJson,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("pagbank-payment-v2 error:", error);
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
