import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import QRCode from "npm:qrcode@1.5.4";
import { Buffer } from "node:buffer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateDigitalPayload {
  userId: string;
  cardType?: "direito" | "geral";
}

function escapeForPrompt(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\r?\n/g, " ").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openRouterKey = Deno.env.get("OPENROUTER_API_KEY_GEN");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase environment variables" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!openRouterKey) {
      return new Response(
        JSON.stringify({ error: "OPENROUTER_API_KEY_GEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = (await req.json().catch(() => null)) as GenerateDigitalPayload | null;
    if (!body || !body.userId) {
      return new Response(
        JSON.stringify({ error: "Missing userId in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userId = body.userId;

    const { data: profile, error: profileError } = await supabase
      .from("student_profiles")
      .select(
        "id, full_name, cpf, birth_date, institution, course, period, enrollment_number, plan_id, profile_photo_url",
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Student profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: card, error: cardError } = await supabase
      .from("student_cards")
      .select(
        "id, student_id, card_number, usage_code, qr_code, valid_until, status, card_type, digital_card_generated, generation_attempts, digital_card_url",
      )
      .eq("student_id", profile.id)
      .eq("status", "active")
      .maybeSingle();

    if (cardError || !card) {
      return new Response(
        JSON.stringify({ error: "Active student card not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Se já existe imagem digital gerada, apenas retorna
    if (card.digital_card_generated && card.digital_card_url) {
      return new Response(
        JSON.stringify({
          success: true,
          url: card.digital_card_url,
          reused: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const attemptNumber = (card.generation_attempts as number | null) ?? 0;

    if (attemptNumber >= 3) {
      return new Response(
        JSON.stringify({ error: "Maximum generation attempts reached" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const kind: "direito" | "geral" =
      body.cardType ||
      (card.card_type && String(card.card_type).toLowerCase().includes("direito")
        ? "direito"
        : "geral");

    const frontTemplateName =
      kind === "direito" ? "direito-frente-template-v.png" : "geral-frente-template-v.png";

    const templateUrl = new URL(
      `../../../public/templates/${frontTemplateName}`,
      import.meta.url,
    );

    const templateBytes = await Deno.readFile(templateUrl);
    const templateBase64 = Buffer.from(templateBytes).toString("base64");

    let photoBase64 = "";
    if (profile.profile_photo_url) {
      const { data: photoFile } = await supabase.storage
        .from("documents")
        .download(profile.profile_photo_url as string);
      if (photoFile) {
        const arrayBuffer = await photoFile.arrayBuffer();
        photoBase64 = Buffer.from(arrayBuffer).toString("base64");
      }
    }

    const cardIdentifier =
      (card.card_number as string | null) ||
      (card.usage_code as string | null) ||
      (card.qr_code as string | null) ||
      profile.cpf;

    const qrPng = await QRCode.toBuffer(cardIdentifier || "", {
      type: "png",
      width: 256,
      margin: 0,
      color: { dark: "#000000", light: "#FFFFFF" },
    });
    const qrBase64 = qrPng.toString("base64");

    const nome = escapeForPrompt(profile.full_name);
    const institution = escapeForPrompt(profile.institution);
    const courseType = profile.course ? "Graduação" : "";
    const period =
      profile.period && profile.period.trim()
        ? escapeForPrompt(profile.period)
        : "";
    const courseName = escapeForPrompt(profile.course);
    const cpf = escapeForPrompt(profile.cpf);
    const birthDate = profile.birth_date
      ? (() => {
          const datePart = String(profile.birth_date).includes("T")
            ? String(profile.birth_date).split("T")[0]
            : String(profile.birth_date);
          const [year, month, day] = datePart.split("-");
          if (!year || !month || !day) return String(profile.birth_date);
          return `${day}/${month}/${year}`;
        })()
      : "";
    const registration = escapeForPrompt(profile.enrollment_number);
    const cardNumber = escapeForPrompt(card.card_number);

    const seedreamPrompt = `
Use a imagem base como FUNDO FIXO, sem nenhuma alteração.
Na composição final:
NÃO modificar: header, watermark da Justiça, selo 2026, cores ou texturas do fundo.
SOMENTE adicionar camadas por cima (overlays).

Overlays obrigatórios:

Imagem base (fundo):
base_image_base64: ${templateBase64}

Foto 3x4 [base64]
foto_base64: ${photoBase64}
Posição: canto superior esquerdo.

QR Code [base64]
qrcode_base64: ${qrBase64}
Posição: canto superior direito.

Textos (como overlay, sem mudar o fundo), exatamente nesta ordem:

Abaixo do QR Code:
COD. USO: ${cardNumber}

Abaixo da foto (em linhas separadas):

Nome:
${nome}

Instituição de Ensino:
${institution}
${courseType} - ${period}
${courseName}

CPF: ${cpf}
Data Nasc.: ${birthDate}
Matrícula: ${registration}

Saída esperada: mesma imagem base + overlays de foto, QR Code e textos, sem redesenhar nenhum elemento existente do fundo.
Dimensões finais: 1024x1536 (2:3).
`;

    const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "bytedance-seed/seedream-4.5",
        messages: [
          {
            role: "user",
            content: seedreamPrompt,
          },
        ],
        modalities: ["image"],
      }),
    });

    if (!openRouterResponse.ok) {
      const errorText = await openRouterResponse.text();

      await supabase
        .from("student_cards")
        .update({
          generation_attempts: attemptNumber + 1,
          last_generation_error: `OpenRouter HTTP ${openRouterResponse.status}: ${errorText.slice(0, 500)}`,
        })
        .eq("id", card.id);

      await supabase.from("card_generation_logs").insert({
        user_id: userId,
        card_type: kind,
        status: "error",
        attempt_number: attemptNumber + 1,
        error_message: `OpenRouter HTTP ${openRouterResponse.status}`,
      });

      return new Response(
        JSON.stringify({ error: "Failed to generate image via OpenRouter" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const completion = await openRouterResponse.json();

    const rawContent = (() => {
      try {
        const choice = completion?.choices?.[0];
        const messageContent = choice?.message?.content;
        if (typeof messageContent === "string") return messageContent as string;
        if (Array.isArray(messageContent)) {
          const joined = messageContent
            .map((c: unknown) => (typeof c === "string" ? c : JSON.stringify(c)))
            .join("\n");
          return joined;
        }
        return JSON.stringify(messageContent);
      } catch (_e) {
        return "";
      }
    })();

    const dataUrlMatch = rawContent.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
    const base64Image = dataUrlMatch
      ? dataUrlMatch[1]
      : rawContent.match(/([A-Za-z0-9+/=]{100,})/)?.[1];

    if (!base64Image) {
      await supabase
        .from("student_cards")
        .update({
          generation_attempts: attemptNumber + 1,
          last_generation_error: "Could not find base64 image in OpenRouter response",
        })
        .eq("id", card.id);

      await supabase.from("card_generation_logs").insert({
        user_id: userId,
        card_type: kind,
        status: "error",
        attempt_number: attemptNumber + 1,
        error_message: "Missing base64 image in response",
      });

      return new Response(
        JSON.stringify({ error: "No image returned from OpenRouter" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const pngBuffer = Buffer.from(base64Image, "base64");

    const storage = supabase.storage.from("student-cards");
    const digitalPath = `${userId}/digital.png`;

    await storage.upload(digitalPath, pngBuffer, {
      contentType: "image/png",
      upsert: true,
    });

    const { data: publicDigital } = storage.getPublicUrl(digitalPath);

    await supabase
      .from("student_cards")
      .update({
        digital_card_url: publicDigital.publicUrl,
        digital_card_generated: true,
        generation_attempts: attemptNumber + 1,
        last_generation_error: null,
      })
      .eq("id", card.id);

    await supabase.from("card_generation_logs").insert({
      user_id: userId,
      card_type: kind,
      status: "success",
      attempt_number: attemptNumber + 1,
      error_message: null,
      cost_cents: null,
    });

    return new Response(
      JSON.stringify({
        success: true,
        url: publicDigital.publicUrl,
        reused: false,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

