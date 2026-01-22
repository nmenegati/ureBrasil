import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHash } from "https://deno.land/std@0.119.0/hash/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function hashCpf(cpf: string): string {
  const clean = cpf.replace(/\D/g, "");
  return createHash("sha256").update(clean).digest("hex");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "").trim();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: profile } = await supabase
      .from("student_profiles")
      .select("*, student_cards(*)")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "Perfil não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const studentId = profile.id as string;
    const card = (profile as any).student_cards?.[0];

    if (card) {
      const cpfHash = hashCpf(profile.cpf as string);

      const { count } = await supabase
        .from("auditoria_cie")
        .select("*", { count: "exact", head: true })
        .eq("hash_cpf", cpfHash);

      await supabase.from("auditoria_cie").insert({
        hash_cpf: cpfHash,
        data_emissao: card.issued_at,
        data_expiracao: card.valid_until,
        id_ure: card.card_number,
        tipo_carteirinha: profile.is_law_student ? "direito" : "geral",
        status_validade: "excluido",
        motivo_exclusao: "usuario_solicitou",
        quantidade_exclusoes_anteriores: count || 0,
        timestamp_exclusao_lgpd: new Date().toISOString(),
      });
    }

    await supabase.rpc("mark_payment_as_anonymized", {
      payment_student_id: studentId,
    });

    const { data: docs } = await supabase
      .from("documents")
      .select("file_url")
      .eq("student_id", studentId);

    if (docs && docs.length > 0) {
      const filePaths = docs
        .map((d) => d.file_url as string | null)
        .filter((p): p is string => !!p);

      if (filePaths.length > 0) {
        await supabase.storage.from("documents").remove(filePaths);
      }
    }

    await supabase.from("audit_logs").delete().eq("student_id", studentId);
    await supabase.from("documents").delete().eq("student_id", studentId);
    await supabase.from("student_cards").delete().eq("student_id", studentId);
    await supabase.from("student_profiles").delete().eq("id", studentId);

    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    console.log(`✅ Usuário ${user.email} deletado (LGPD) - CPF liberado para recadastro após 48h`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Dados pessoais excluídos conforme LGPD.\nCPF liberado para recadastro após 48h.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("❌ Erro ao deletar:", error);
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
