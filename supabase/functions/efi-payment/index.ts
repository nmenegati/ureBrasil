import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Obter access_token OAuth2 da Efi
async function getEfiAccessToken(isSandbox: boolean): Promise<string> {
  const clientId = isSandbox
    ? Deno.env.get("EFI_CLIENT_ID_SANDBOX")
    : Deno.env.get("EFI_CLIENT_ID_PROD");
  const clientSecret = isSandbox
    ? Deno.env.get("EFI_CLIENT_SECRET_SANDBOX")
    : Deno.env.get("EFI_CLIENT_SECRET_PROD");

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais Efi não configuradas");
  }

  const credentials = base64Encode(`${clientId}:${clientSecret}`);
  const baseUrl = isSandbox
    ? "https://cobrancas-h.api.efipay.com.br"
    : "https://cobrancas.api.efipay.com.br";

  const response = await fetch(`${baseUrl}/v1/authorize`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ grant_type: "client_credentials" }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Efi auth error:", error);
    throw new Error("Falha na autenticação Efi");
  }

  const data = await response.json();
  return data.access_token;
}

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
        JSON.stringify({ error: "Variáveis Supabase não configuradas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

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
        payment_token: string; // Efi usa payment_token (gerado pelo JS SDK)
        holder_name?: string;
      };
      metadata?: Record<string, unknown>;
    } | null;

    if (!body || typeof body.amount !== "number" || !body.card?.payment_token) {
      return new Response(
        JSON.stringify({ error: "Parâmetros inválidos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const amount = body.amount;
    const installments = body.installments && body.installments > 0 ? body.installments : 1;
    const amountInCents = Math.round(amount * 100);
    const paymentToken = body.card.payment_token;
    const metadata = body.metadata || {};

    // Buscar perfil
    const { data: profile } = await supabase
      .from("student_profiles")
      .select("id, plan_id, full_name, cpf, phone, cep, street, number, neighborhood, city, state")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "Perfil não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Config Efi
    const mode = (Deno.env.get("EFI_MODE") || "sandbox").toLowerCase();
    const isSandbox = mode !== "prod";
    const baseUrl = isSandbox
      ? "https://cobrancas-h.api.efipay.com.br"
      : "https://cobrancas.api.efipay.com.br";

    // 1. Obter access_token
    const accessToken = await getEfiAccessToken(isSandbox);

    // 2. Criar cobrança (charge)
    const chargeResponse = await fetch(`${baseUrl}/v1/charge/one-step`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            name: "Carteirinha URE Brasil",
            value: amountInCents,
            amount: 1,
          },
        ],
        metadata: {
          custom_id: `ure-${user.id}-${Date.now()}`,
          notification_url: `${supabaseUrl}/functions/v1/efi-webhook`,
        },
        payment: {
          credit_card: {
            customer: {
              name: profile.full_name,
              cpf: (profile.cpf as string).replace(/\D/g, ""),
              email: user.email,
              phone_number: profile.phone
                ? (profile.phone as string).replace(/\D/g, "")
                : undefined,
              birth: "1990-01-01", // Efi exige data de nascimento
              address: profile.cep
                ? {
                    street: profile.street,
                    number: profile.number,
                    neighborhood: profile.neighborhood,
                    zipcode: (profile.cep as string).replace(/\D/g, ""),
                    city: profile.city,
                    state: profile.state,
                  }
                : undefined,
            },
            installments,
            payment_token: paymentToken,
            billing_address: profile.cep
              ? {
                  street: profile.street,
                  number: profile.number,
                  neighborhood: profile.neighborhood,
                  zipcode: (profile.cep as string).replace(/\D/g, ""),
                  city: profile.city,
                  state: profile.state,
                }
              : undefined,
          },
        },
      }),
    });

    const responseJson = await chargeResponse.json();

    if (chargeResponse.status !== 200 || responseJson.code !== 200) {
      console.error("Efi error:", chargeResponse.status, responseJson);
      return new Response(
        JSON.stringify({
          success: false,
          status: chargeResponse.status,
          error: responseJson?.message || "Erro ao processar pagamento na Efi",
          details: responseJson,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const chargeData = responseJson.data;
    const chargeId = String(chargeData.charge_id);
    const chargeStatus = chargeData.status; // "waiting", "paid", etc.

    // Mapear status Efi → nosso status
    const statusMap: Record<string, string> = {
      waiting: "processing",
      paid: "approved",
      unpaid: "rejected",
      canceled: "rejected",
      refunded: "refunded",
    };

    const normalizedStatus = statusMap[chargeStatus] || "processing";

    // Salvar pagamento
    const { error: paymentError } = await supabase
      .from("payments")
      .insert({
        student_id: profile.id,
        plan_id: profile.plan_id,
        amount,
        payment_method: "credit_card",
        status: normalizedStatus,
        installments,
        gateway_name: "efi",
        gateway_charge_id: chargeId,
        gateway_reference_id: `ure-${user.id}-${Date.now()}`,
        confirmed_at: normalizedStatus === "approved" ? new Date().toISOString() : null,
        metadata: {
          ...metadata,
          efi_status: chargeStatus,
          efi_charge: chargeData,
        },
      });

    if (paymentError) {
      console.error("Erro ao salvar pagamento Efi:", paymentError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        orderId: chargeId,
        status: chargeStatus,
        raw: responseJson,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("efi-payment error:", error);
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});