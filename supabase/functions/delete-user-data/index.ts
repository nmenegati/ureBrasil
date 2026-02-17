/**
 * delete-user-data: Remove dados de um usuário autenticado (LGPD/encerramento).
 *
 * TRIGGER: chamada HTTP autenticada (Bearer token) a partir do painel/app.
 *
 * FLUXO:
 * 1. Valida o token do Supabase e identifica o usuário autenticado.
 * 2. Busca student_profiles associado (incluindo student_cards).
 * 3. Remove/anonimiza dados relacionados:
 *    - documents (registros e arquivos em storage).
 *    - profile-photos (arquivos ligados ao user.id).
 *    - student-cards (arquivos digitais em storage).
 *    - registros em audit_logs e outras tabelas relacionadas ao student_id.
 * 4. Opcionalmente apaga ou anonimiza informações sensíveis (CPF, e‑mail).
 * 5. Retorna status 200/204 em caso de sucesso, 4xx/5xx em erro.
 *
 * EFEITOS NO BANCO:
 * - DELETE/UPDATE em student_profiles, documents, payments, audit_logs.
 * - Remoção de arquivos nos buckets documents, profile-photos, student-cards.
 *
 * ATENÇÃO:
 * - Usa SUPABASE_SERVICE_ROLE_KEY, portanto deve ser protegido por autenticação forte.
 * - Falhas em etapas individuais podem deixar dados residuais; respostas parciais não são diferenciadas.
 */
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Verificar autenticação
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    })
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Token inválido' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    })
  }

  try {
//    const authHeader = req.headers.get("Authorization");
//    if (!authHeader) {
//      return new Response(
//        JSON.stringify({ error: "Não autorizado" }),
//        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
//      );
//    }

//    const token = authHeader.replace("Bearer ", "").trim();
//    const {
//      data: { user },
//      error: userError,
//    } = await supabase.auth.getUser(token);

//    if (userError || !user) {
//      return new Response(
//        JSON.stringify({ error: "Usuário não encontrado" }),
//        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
//      );
//    }

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

      const { count, error: auditCountError } = await supabase
        .from("auditoria_cie")
        .select("*", { count: "exact", head: true })
        .eq("hash_cpf", cpfHash);

      if (auditCountError) {
        console.error('[DELETE_USER_DATA] Erro ao contar auditoria_cie:', {
          studentId,
          error: auditCountError.message,
        });
      }

      const { error: auditInsertError } = await supabase.from("auditoria_cie").insert({
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

      if (auditInsertError) {
        console.error('[DELETE_USER_DATA] Erro ao registrar auditoria_cie:', {
          studentId,
          error: auditInsertError.message,
        });
      }
    }

    const { error: markError } = await supabase.rpc("mark_payment_as_anonymized", {
      payment_student_id: studentId,
    });

    if (markError) {
      console.error('[DELETE_USER_DATA] Erro ao marcar pagamentos como anonimizados:', {
        studentId,
        error: markError.message,
      });
    }

    const { data: docs, error: docsError } = await supabase
      .from("documents")
      .select("file_url")
      .eq("student_id", studentId);

    if (docsError) {
      console.error('[DELETE_USER_DATA] Erro ao buscar documentos para remoção:', {
        studentId,
        error: docsError.message,
      });
    }

    if (docs && docs.length > 0) {
      const filePaths = docs
        .map((d) => d.file_url as string | null)
        .filter((p): p is string => !!p);

      if (filePaths.length > 0) {
        await supabase.storage.from("documents").remove(filePaths);
      }
    }
    // Apagar profile photos | profile-photos usa user.id no path
    const { data: profilePhotos } = await supabase.storage
      .from('profile-photos')
      .list(`${user.id}/foto`);
    if (profilePhotos && profilePhotos.length > 0) {
      await supabase.storage.from('profile-photos')
        .remove([`${user.id}/foto`, user.id]);
    }
    // Tentar remover "pastas" como objetos
    await supabase.storage.from('profile-photos').remove([
      `${user.id}/foto`,
      `${user.id}`
    ]);

    // Apagar student cards | student-cards também usa user.id
    const { data: cardFiles } = await supabase.storage
      .from('student-cards')
      .list(user.id);
    if (cardFiles && cardFiles.length > 0) {
      const files = cardFiles.filter(f => f.id);
      await supabase.storage.from('student-cards')
        .remove(files.map(f => `${user.id}/${f.name}`));
    }
    
    await supabase.storage.from('student-cards').remove([user.id]);

    const { error: auditDeleteError } = await supabase.from("audit_logs").delete().eq("student_id", studentId);
    if (auditDeleteError) {
      console.error('[DELETE_USER_DATA] Erro ao remover audit_logs:', {
        studentId,
        error: auditDeleteError.message,
      });
    }

    const { error: docsDeleteError } = await supabase.from("documents").delete().eq("student_id", studentId);
    if (docsDeleteError) {
      console.error('[DELETE_USER_DATA] Erro ao remover documents:', {
        studentId,
        error: docsDeleteError.message,
      });
    }

    const { error: cardsDeleteError } = await supabase.from("student_cards").delete().eq("student_id", studentId);
    if (cardsDeleteError) {
      console.error('[DELETE_USER_DATA] Erro ao remover student_cards:', {
        studentId,
        error: cardsDeleteError.message,
      });
    }

    const { error: profilesDeleteError } = await supabase.from("student_profiles").delete().eq("id", studentId);
    if (profilesDeleteError) {
      console.error('[DELETE_USER_DATA] Erro ao remover student_profiles:', {
        studentId,
        error: profilesDeleteError.message,
      });
    }
    // Apagar profile photos
    await supabase.storage.from('profile-photos').remove([`${user.id}`]);

    const { error: faceDeleteError } = await supabase.from("face_validations").delete().eq("student_id", studentId);
    if (faceDeleteError) {
      console.error('[DELETE_USER_DATA] Erro ao remover face_validations:', {
        studentId,
        error: faceDeleteError.message,
      });
    }

    const ticketsResponse = await supabase.from("support_tickets").select("id").eq("student_id", studentId);
    if (ticketsResponse.error) {
      console.error('[DELETE_USER_DATA] Erro ao buscar support_tickets:', {
        studentId,
        error: ticketsResponse.error.message,
      });
    }
    const ticketIds = ticketsResponse.data?.map(t => t.id) || [];

    const { error: messagesDeleteError } = await supabase
      .from("support_messages")
      .delete()
      .in("ticket_id", ticketIds);
    if (messagesDeleteError) {
      console.error('[DELETE_USER_DATA] Erro ao remover support_messages:', {
        studentId,
        error: messagesDeleteError.message,
      });
    }

    const { error: ticketsDeleteError } = await supabase.from("support_tickets").delete().eq("student_id", studentId);
    if (ticketsDeleteError) {
      console.error('[DELETE_USER_DATA] Erro ao remover support_tickets:', {
        studentId,
        error: ticketsDeleteError.message,
      });
    }

    const { error: escalationsDeleteError } = await supabase.from("support_escalations").delete().eq("student_id", studentId);
    if (escalationsDeleteError) {
      console.error('[DELETE_USER_DATA] Erro ao remover support_escalations:', {
        studentId,
        error: escalationsDeleteError.message,
      });
    }

    const { error: notificationsDeleteError } = await supabase.from("notifications").delete().eq("student_id", studentId);
    if (notificationsDeleteError) {
      console.error('[DELETE_USER_DATA] Erro ao remover notifications:', {
        studentId,
        error: notificationsDeleteError.message,
      });
    }

    const { error: activityDeleteError } = await supabase.from("activity_log").delete().eq("student_id", studentId);
    if (activityDeleteError) {
      console.error('[DELETE_USER_DATA] Erro ao remover activity_log:', {
        studentId,
        error: activityDeleteError.message,
      });
    }

    const { error: printsDeleteError } = await supabase.from("physical_card_prints").delete().eq("student_id", studentId);
    if (printsDeleteError) {
      console.error('[DELETE_USER_DATA] Erro ao remover physical_card_prints:', {
        studentId,
        error: printsDeleteError.message,
      });
    }

    const { error: cpfValidationsDeleteError } = await supabase
      .from("cpf_validations")
      .delete()
      .eq("cpf", profile.cpf?.replace(/\D/g, ''));
    if (cpfValidationsDeleteError) {
      console.error('[DELETE_USER_DATA] Erro ao remover cpf_validations:', {
        studentId,
        error: cpfValidationsDeleteError.message,
      });
    }

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
