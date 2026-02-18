import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const body = await req.json();
    
    // MP envia type: "payment" e data.id
    if (body.type !== "payment" && body.action !== "payment.updated") {
      return new Response("ignored", { status: 200 });
    }

    const paymentId = body.data?.id;
    if (!paymentId) return new Response("no id", { status: 200 });

    // Buscar pagamento atualizado na API do MP
    const accessToken = Deno.env.get("MP_ACCESS_TOKEN");
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
