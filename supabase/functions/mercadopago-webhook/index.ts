import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// SHA-256 hex (Meta CAPI exige user_data hasheado, normalizado: trim + lowercase)
async function sha256Hash(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Envia evento Purchase via Meta Conversions API. Isolado e não-bloqueante:
// qualquer falha aqui é logada e NUNCA afeta o fluxo de pagamento.
async function sendMetaPurchase(
  paymentId: string,
  amount: number,
  studentProfile: { full_name: string | null; phone: string | null; user_id: string | null },
  email: string | null
): Promise<void> {
  const accessToken = Deno.env.get("META_ACCESS_TOKEN");
  if (!accessToken) {
    console.log("[META CAPI] META_ACCESS_TOKEN não configurado, pulando");
    return;
  }
  const pixelId = Deno.env.get("META_PIXEL_ID") || "982937931195255";

  const nameParts = (studentProfile.full_name || "").trim().toLowerCase().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  const userData: Record<string, string> = {
    country: await sha256Hash("br"),
  };
  if (firstName) userData.fn = await sha256Hash(firstName);
  if (lastName) userData.ln = await sha256Hash(lastName);
  if (studentProfile.user_id) userData.external_id = await sha256Hash(studentProfile.user_id);
  if (email) userData.em = await sha256Hash(email);
  if (studentProfile.phone) {
    const cleanPhone = studentProfile.phone.replace(/\D/g, "");
    const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : "55" + cleanPhone;
    userData.ph = await sha256Hash(fullPhone);
  }

  const payload = {
    data: [{
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1000),
      event_id: paymentId,
      event_source_url: "https://www.urebrasil.com.br/pagamento/sucesso",
      action_source: "website",
      user_data: userData,
      custom_data: {
        value: amount,
        currency: "BRL",
        content_ids: [paymentId],
        content_type: "product",
        content_name: "Carteira Estudantil URE",
      },
    }],
  };

  const url = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => ({}));
    console.log("[META CAPI] Evento enviado:", JSON.stringify({
      success: response.ok,
      status: response.status,
      events_received: (result as Record<string, unknown>).events_received,
      payment_id: paymentId,
    }));
  } catch (error) {
    console.log("[META CAPI] Erro (não-bloqueante):", error instanceof Error ? error.message : String(error));
  } finally {
    clearTimeout(timeoutId);
  }
}

serve(async (req) => {
  // === VALIDAÇÃO HMAC-SHA256 (Mercado Pago Webhooks v2) ===
  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");

  if (!xSignature || !xRequestId) {
    return new Response("unauthorized", { status: 401 });
  }

  // x-signature formato: "ts=<timestamp>,v1=<hash>"
  const sigParts = Object.fromEntries(
    xSignature.split(",").map((part) => {
      const idx = part.indexOf("=");
      return [part.slice(0, idx).trim(), part.slice(idx + 1).trim()];
    })
  );
  const ts = sigParts["ts"];
  const v1 = sigParts["v1"];

  if (!ts || !v1) {
    return new Response("unauthorized", { status: 401 });
  }

  // Lê o body uma única vez como texto para evitar consumir o stream duas vezes
  const bodyText = await req.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const paymentId = (body.data as Record<string, unknown>)?.id;

  // Template oficial MP: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
  const manifest = `id:${paymentId};request-id:${xRequestId};ts:${ts};`;

  const secret = Deno.env.get("MP_WEBHOOK_SECRET");
  if (!secret) {
    console.error("[WEBHOOK_MP] MP_WEBHOOK_SECRET não configurado");
    return new Response("server error", { status: 500 });
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(manifest));
  const computedHash = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (computedHash !== v1) {
    console.warn("[WEBHOOK_MP] Assinatura HMAC inválida", { xRequestId });
    return new Response("unauthorized", { status: 401 });
  }
  // === FIM DA VALIDAÇÃO ===

  try {
    // MP envia type: "payment" e data.id
    if (body.type !== "payment" && body.action !== "payment.updated") {
      return new Response("ignored", { status: 200 });
    }

    if (!paymentId) return new Response("no id", { status: 200 });

    // Buscar pagamento atualizado na API do MP
    const mode = Deno.env.get("MP_MODE") || "sandbox";
    const accessToken = mode === "production"
      ? Deno.env.get("MP_PROD_ACCESS_TOKEN")
      : Deno.env.get("MP_ACCESS_TOKEN");
    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("[WEBHOOK_MP] Erro ao consultar MP API:", { 
        paymentId, 
        status: mpResponse.status, 
        body: mpData 
      });
      return new Response("mp api error", { status: 200 });
    }

    // Mapear status
    const statusMap: Record<string, string> = {
      approved: "approved",
      pending: "pending",
      in_process: "processing",
      rejected: "rejected",
      cancelled: "rejected",
      refunded: "refunded",
    };

    const newStatus = statusMap[mpData.status] || "pending";

    // Atualizar no banco
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: existingPayment, error: fetchError } = await supabase
      .from("payments")
      .select("id, student_id, amount, metadata")
      .eq("gateway_charge_id", String(paymentId))
      .eq("gateway_name", "mercadopago")
      .single();

    if (fetchError) {
      console.error("[WEBHOOK_MP] Erro ao buscar payment:", { paymentId, error: fetchError.message });
    }

    const existingMetadata = (existingPayment?.metadata as Record<string, unknown>) || {};

    const { error: updateError } = await supabase
      .from("payments")
      .update({
        status: newStatus,
        confirmed_at: newStatus === "approved" ? new Date().toISOString() : null,
        metadata: {
          ...existingMetadata,
          mp_status: mpData.status,
          mp_status_detail: mpData.status_detail,
          webhook_updated_at: new Date().toISOString(),
        },
      })
      .eq("gateway_charge_id", String(paymentId))
      .eq("gateway_name", "mercadopago");

    if (updateError) {
      console.error("[WEBHOOK_MP] Erro ao atualizar payment:", { paymentId, error: updateError.message });
    }

    // Meta Conversions API — Purchase server-side (captura PIX mesmo com browser fechado).
    // Isolado: qualquer falha aqui NUNCA afeta o processamento do pagamento.
    if (newStatus === "approved" && !updateError && existingPayment?.id) {
      try {
        const { data: profile } = await supabase
          .from("student_profiles")
          .select("full_name, phone, user_id")
          .eq("id", existingPayment.student_id)
          .maybeSingle();

        if (profile) {
          let email: string | null = null;
          if (profile.user_id) {
            const { data: authData } = await supabase.auth.admin.getUserById(profile.user_id);
            email = authData?.user?.email ?? null;
          }
          // Fire-and-forget garantido: waitUntil mantém o fetch vivo após o Response.
          EdgeRuntime.waitUntil(
            sendMetaPurchase(
              String(existingPayment.id),
              Number(existingPayment.amount ?? mpData.transaction_amount ?? 0),
              profile,
              email
            ).catch((err) =>
              console.log("[META CAPI] Fire-and-forget error:", err instanceof Error ? err.message : String(err))
            )
          );
        }
      } catch (metaError) {
        console.log("[META CAPI] Erro ao preparar dados:", metaError instanceof Error ? metaError.message : String(metaError));
      }
    }

    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("error", { status: 500 });
  }
});
