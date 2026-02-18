import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * NOME: Verificação pública de carteirinha estudantil
 * TRIGGER: Chamada HTTP pública (sem autenticação)
 * FLUXO:
 * 1. Recebe usage_code + birth_date via POST.
 * 2. Busca student_cards por usage_code.
 * 3. Busca student_profiles vinculado ao cartão.
 * 4. Compara birth_date informada com birth_date do profile.
 * 5. Se match → retorna dados públicos.
 * 6. Se não match → retorna erro genérico (não revela se código existe).
 * EFEITOS NO BANCO: Nenhum (somente leitura).
 * ATENÇÃO: Função PÚBLICA, sem auth. Nunca expor dados sensíveis.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Método não permitido." }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ success: false, error: "Configuração do Supabase ausente." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json().catch(() => null) as
      | { usage_code?: string | null; birth_date?: string | null }
      | null;

    const usageCodeRaw = body?.usage_code ?? "";
    const birthDateRaw = body?.birth_date ?? "";

    const usageCode = typeof usageCodeRaw === "string"
      ? usageCodeRaw.trim()
      : "";
    const birthDate = typeof birthDateRaw === "string"
      ? birthDateRaw.trim()
      : "";

    if (!usageCode || !birthDate) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Código de uso e data de nascimento são obrigatórios.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Data de nascimento em formato inválido.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const normalizedCode = usageCode.toUpperCase();

    const { data: card, error: cardError } = await supabase
      .from("student_cards")
      .select(
        `
        id,
        usage_code,
        card_number,
        status,
        valid_until,
        is_physical,
        student_id,
        student_profiles (
          full_name,
          institution,
          course,
          birth_date,
          profile_photo_url,
          cpf,
          user_id
        )
      `,
      )
      .ilike("usage_code", normalizedCode)
      .maybeSingle();

    if (cardError || !card) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Carteirinha não encontrada ou dados incorretos.",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const profile = (card as any).student_profiles as {
      full_name: string;
      institution: string | null;
      course: string | null;
      birth_date: string | null;
      profile_photo_url: string | null;
      cpf: string | null;
      user_id: string | null;
    } | null;

    const profileBirth = profile?.birth_date
      ? String(profile.birth_date).slice(0, 10)
      : null;

    if (!profileBirth || profileBirth !== birthDate) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Carteirinha não encontrada ou dados incorretos.",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let photoUrl: string | null = null;

    if (profile?.profile_photo_url) {
      const { data: signed, error: signedError } = await supabase.storage
        .from("profile-photos")
        .createSignedUrl(profile.profile_photo_url, 300);

      if (!signedError && signed?.signedUrl) {
        photoUrl = signed.signedUrl;
      }
    } else if (profile?.user_id) {
      const candidatePath = `${profile.user_id}/foto`;
      const { data: signed, error: signedError } = await supabase.storage
        .from("profile-photos")
        .createSignedUrl(candidatePath, 300);

      if (!signedError && signed?.signedUrl) {
        photoUrl = signed.signedUrl;
      }
    }

    const cpfDigits = (profile?.cpf ?? "").replace(/\D/g, "");
    const cpfLast5 = cpfDigits.slice(-5);

    const validUntilStr = card.valid_until
      ? String(card.valid_until).slice(0, 10)
      : null;

    const today = new Date().toISOString().slice(0, 10);

    let status: "valid" | "expired" | "invalid" = "invalid";

    if (card.status === "active") {
      if (validUntilStr && validUntilStr >= today) {
        status = "valid";
      } else {
        status = "expired";
      }
    } else {
      status = "invalid";
    }

    return new Response(
      JSON.stringify({
        success: true,
        student: {
          full_name: profile?.full_name ?? "",
          institution: profile?.institution ?? null,
          course: profile?.course ?? null,
          photo_url: photoUrl,
          cpf_last5: cpfLast5 || null,
          card_number: card.card_number,
          valid_until: validUntilStr,
          is_physical: card.is_physical === true,
          status,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("[VERIFY_STUDENT_CARD] Erro inesperado:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Erro interno ao verificar carteirinha.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
