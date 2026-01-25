import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import sharp from "npm:sharp@0.33.4";
import QRCode from "npm:qrcode@1.5.4";
import { Buffer } from "node:buffer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CardKind = "direito" | "geral";

interface GeneratePayload {
  userId: string;
  cardType?: CardKind;
}

function escapeXml(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(input: string | null | undefined, maxLength: number): string {
  if (!input) return "";
  if (input.length <= maxLength) return input;
  return input.slice(0, maxLength - 1) + "…";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase environment variables" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = (await req.json().catch(() => null)) as GeneratePayload | null;

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
        "id, full_name, cpf, birth_date, institution, course, enrollment_number, plan_id, profile_photo_url",
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
      .select("id, card_number, usage_code, qr_code, valid_until, card_type, student_id")
      .eq("student_id", profile.id)
      .eq("status", "active")
      .maybeSingle();

    if (cardError || !card) {
      return new Response(
        JSON.stringify({ error: "Active student card not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const kind: CardKind =
      body.cardType ||
      (card.card_type && String(card.card_type).toLowerCase().includes("direito")
        ? "direito"
        : "geral");

    const frontTemplateName =
      kind === "direito" ? "direito-frente-template-v.png" : "geral-frente-template-v.png";
    const backTemplateName =
      kind === "direito" ? "direito-verso-template-v.png" : "geral-verso-template-v.png";

    const frontTemplateUrl = new URL(
      `../../../public/templates/${frontTemplateName}`,
      import.meta.url,
    );
    const backTemplateUrl = new URL(
      `../../../public/templates/${backTemplateName}`,
      import.meta.url,
    );

    const frontTemplateBuffer = await Deno.readFile(frontTemplateUrl);
    const backTemplateBuffer = await Deno.readFile(backTemplateUrl);

    let photoBuffer: Buffer | null = null;

    if (profile.profile_photo_url) {
      const { data: photoFile } = await supabase.storage
        .from("documents")
        .download(profile.profile_photo_url as string);
      if (photoFile) {
        const arrayBuffer = await photoFile.arrayBuffer();
        photoBuffer = Buffer.from(arrayBuffer);
      }
    }

    const cardIdentifier =
      (card.card_number as string | null) ||
      (card.usage_code as string | null) ||
      (card.qr_code as string | null) ||
      profile.cpf;

    const qrPng = await QRCode.toBuffer(cardIdentifier || "", {
      type: "png",
      width: 175,
      margin: 0,
      color: { dark: "#000000", light: "#FFFFFF" },
    });

    let photoComposite: Buffer | null = null;

    if (photoBuffer) {
      const maskSvg = Buffer.from(
        `<svg width="255" height="320" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="255" height="320" rx="15" ry="15" fill="white"/></svg>`,
      );

      photoComposite = await sharp(photoBuffer)
        .resize(255, 320, { fit: "cover" })
        .composite([{ input: maskSvg, blend: "dest-in" }])
        .png()
        .toBuffer();
    }

    const nome = truncate(profile.full_name, 64);
    const instituicao = truncate(profile.institution, 80);
    const curso = truncate(profile.course, 80);
    const linhaInstituicao0 = instituicao;
    const linhaInstituicao1 = curso ? "Graduação" : "";
    const linhaInstituicao2 = curso || "";

    const cpf = profile.cpf;
    const dataNasc = new Date(profile.birth_date).toLocaleDateString("pt-BR");
    const matricula = profile.enrollment_number || "";
    const codUso = (card.usage_code as string | null) || (card.card_number as string | null) || "";

    const svgText = `
<svg width="638" height="1016" xmlns="http://www.w3.org/2000/svg">
  <style>
    .label { font-family: Arial, sans-serif; font-weight: 700; fill: #000000; }
    .value { font-family: Arial, sans-serif; font-weight: 400; fill: #000000; }
    .center { text-anchor: middle; }
  </style>
  <text x="63" y="540" class="label" font-size="20">Nome:</text>
  <text x="63" y="570" class="value" font-size="22">${escapeXml(nome)}</text>
  <text x="63" y="615" class="label" font-size="20">Instituição de Ensino:</text>
  <text x="63" y="645" class="value" font-size="18">${escapeXml(linhaInstituicao0)}</text>
  <text x="63" y="667" class="value" font-size="18">${escapeXml(linhaInstituicao1)}</text>
  <text x="63" y="689" class="value" font-size="18">${escapeXml(linhaInstituicao2)}</text>
  <text x="63" y="748" class="label" font-size="20">CPF:</text>
  <text x="120" y="748" class="value" font-size="20">${escapeXml(cpf)}</text>
  <text x="63" y="782" class="label" font-size="20">Data Nasc.:</text>
  <text x="210" y="782" class="value" font-size="20">${escapeXml(dataNasc)}</text>
  <text x="63" y="816" class="label" font-size="20">Matrícula:</text>
  <text x="185" y="816" class="value" font-size="20">${escapeXml(matricula)}</text>
  <text x="417" y="418" class="label center" font-size="16">COD. USO:</text>
  <text x="483" y="451" class="value center" font-size="24">${escapeXml(codUso)}</text>
</svg>
`;

    const composites = [];

    if (photoComposite) {
      composites.push({
        input: photoComposite,
        left: 65,
        top: 182,
      } as sharp.OverlayOptions);
    }

    composites.push({
      input: qrPng,
      left: 390,
      top: 218,
    } as sharp.OverlayOptions);

    composites.push({
      input: Buffer.from(svgText),
      left: 0,
      top: 0,
    } as sharp.OverlayOptions);

    const frontPng = await sharp(frontTemplateBuffer)
      .composite(composites)
      .png()
      .toBuffer();

    const storage = supabase.storage.from("student-cards");
    const frontPath = `${userId}/frente.png`;
    const backPath = `${userId}/verso.png`;

    await storage.upload(frontPath, frontPng, {
      contentType: "image/png",
      upsert: true,
    });

    await storage.upload(backPath, backTemplateBuffer, {
      contentType: "image/png",
      upsert: true,
    });

    const { data: publicFront } = storage.getPublicUrl(frontPath);
    const { data: publicBack } = storage.getPublicUrl(backPath);

    await supabase
      .from("student_cards")
      .update({
        physical_card_front_url: publicFront.publicUrl,
        physical_card_back_url: publicBack.publicUrl,
      })
      .eq("id", card.id);

    return new Response(
      JSON.stringify({
        success: true,
        frontUrl: publicFront.publicUrl,
        backUrl: publicBack.publicUrl,
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

