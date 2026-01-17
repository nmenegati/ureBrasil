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
    const authHeader = req.headers.get("Authorization");
    console.log("DEBUG delete-user-data - Authorization header:", authHeader ? "EXISTS" : "MISSING");
    if (!authHeader) {
      console.log("DEBUG delete-user-data - header ausente");
      return new Response(
        JSON.stringify({ error: "Não autorizado - header Authorization ausente" }),
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
    console.log("DEBUG delete-user-data - token prefix:", token.substring(0, 20) + "...");
    console.log("DEBUG delete-user-data - chamando auth.getUser");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    console.log("DEBUG delete-user-data - resultado getUser:", {
      userExists: !!user,
      error: userError?.message,
    });

    if (userError || !user) {
      console.log("DEBUG delete-user-data - usuário não encontrado");
      return new Response(
        JSON.stringify({ error: `Usuário não encontrado: ${userError?.message ?? "sem detalhes"}` }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("student_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Perfil não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const studentId = profile.id as string;

    const { data: files, error: listError } = await supabase.storage
      .from("documents")
      .list(user.id);

    if (listError) {
      console.error("Erro ao listar arquivos:", listError);
    }

    if (files && files.length > 0) {
      const filePaths = files.map((f) => `${user.id}/${f.name}`);
      const { error: removeError } = await supabase.storage.from("documents").remove(filePaths);
      if (removeError) {
        console.error("Erro ao remover arquivos:", removeError);
      }
    }

    await supabase.from("audit_logs").delete().eq("student_id", studentId);
    await supabase.from("documents").delete().eq("student_id", studentId);
    await supabase.from("student_cards").delete().eq("student_id", studentId);
    await supabase.from("payments").delete().eq("student_id", studentId);
    await supabase.from("student_profiles").delete().eq("id", studentId);

    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error("Erro ao deletar usuário:", deleteError);
      return new Response(
        JSON.stringify({ error: "Erro ao apagar usuário" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`Usuário ${user.email} deletado completamente`);

    return new Response(
      JSON.stringify({ success: true, message: "Dados apagados com sucesso" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Erro ao deletar:", error);
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
