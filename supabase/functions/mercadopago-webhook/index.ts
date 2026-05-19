import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      .select("metadata")
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

    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("error", { status: 500 });
  }
});
