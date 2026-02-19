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

    // === FASE 1: AUDITORIA (antes de qualquer exclusão) ===
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

    // === FASE 2: ANONIMIZAR dados retidos 5 anos ===
    const { error: markError } = await supabase.rpc("mark_payment_as_anonymized", {
      payment_student_id: studentId,
    });

    if (markError) {
      console.error('[DELETE_USER_DATA] Erro ao marcar pagamentos como anonimizados:', {
        studentId,
        error: markError.message,
      });
    }

    const { error: cardAnonError } = await supabase
      .from("student_cards")
      .update({
        student_id: null,
        qr_code: null,
        updated_at: new Date().toISOString(),
      })
      .eq("student_id", studentId);

    if (cardAnonError) {
      console.error('[DELETE_USER_DATA] Erro ao anonimizar student_cards:', {
        studentId,
        error: cardAnonError.message,
      });
    }

    // === FASE 3: REMOVER arquivos de storage ===
    const cleanBucket = async (bucket: string, prefix: string) => {
      const { data: files, error } = await supabase.storage
        .from(bucket)
        .list(prefix, { limit: 100 });

      if (error) {
        console.error('[DELETE_USER_DATA] Erro ao listar arquivos no storage:', {
          bucket,
          prefix,
          error: error.message,
        });
        return;
      }

      if (!files || files.length === 0) return;

      const fileNames = files
        .filter((f: any) => (f as any).id)
        .map((f) => `${prefix}/${f.name}`);

      if (fileNames.length > 0) {
        const { error: removeError } = await supabase.storage
          .from(bucket)
          .remove(fileNames);

        if (removeError) {
          console.error('[DELETE_USER_DATA] Erro ao remover arquivos do storage:', {
            bucket,
            prefix,
            error: removeError.message,
          });
        }
      }

      const folders = files.filter((f: any) => !(f as any).id);
      for (const folder of folders) {
        await cleanBucket(bucket, `${prefix}/${folder.name}`);
      }
    };

    await cleanBucket("profile-photos", user.id);
    await cleanBucket("student-cards", user.id);
    await cleanBucket("documents", user.id);

    // === FASE 4: DELETAR tabelas dependentes (children first) ===
    const ticketsResponse = await supabase
      .from("support_tickets")
      .select("id")
      .eq("student_id", studentId);
    if (ticketsResponse.error) {
      console.error('[DELETE_USER_DATA] Erro ao buscar support_tickets:', {
        studentId,
        error: ticketsResponse.error.message,
      });
    }
    const ticketIds = ticketsResponse.data?.map((t) => t.id) || [];

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

    const { error: ticketsDeleteError } = await supabase
      .from("support_tickets")
      .delete()
      .eq("student_id", studentId);
    if (ticketsDeleteError) {
      console.error('[DELETE_USER_DATA] Erro ao remover support_tickets:', {
        studentId,
        error: ticketsDeleteError.message,
      });
    }

    const { error: escalationsDeleteError } = await supabase
      .from("support_escalations")
      .delete()
      .eq("student_id", studentId);
    if (escalationsDeleteError) {
      console.error('[DELETE_USER_DATA] Erro ao remover support_escalations:', {
        studentId,
        error: escalationsDeleteError.message,
      });
    }

    const { error: faceDeleteError } = await supabase
      .from("face_validations")
      .delete()
      .eq("student_id", studentId);
    if (faceDeleteError) {
      console.error('[DELETE_USER_DATA] Erro ao remover face_validations:', {
        studentId,
        error: faceDeleteError.message,
      });
    }

    const { error: notificationsDeleteError } = await supabase
      .from("notifications")
      .delete()
      .eq("student_id", studentId);
    if (notificationsDeleteError) {
      console.error('[DELETE_USER_DATA] Erro ao remover notifications:', {
        studentId,
        error: notificationsDeleteError.message,
      });
    }

    const { error: activityDeleteError } = await supabase
      .from("activity_log")
      .delete()
      .eq("student_id", studentId);
    if (activityDeleteError) {
      console.error('[DELETE_USER_DATA] Erro ao remover activity_log:', {
        studentId,
        error: activityDeleteError.message,
      });
    }

    const { error: printsDeleteError } = await supabase
      .from("physical_card_prints")
      .delete()
      .eq("student_id", studentId);
    if (printsDeleteError) {
      console.error('[DELETE_USER_DATA] Erro ao remover physical_card_prints:', {
        studentId,
        error: printsDeleteError.message,
      });
    }

    const { error: cpfValidationsDeleteError } = await supabase
      .from("cpf_validations")
      .delete()
      .eq("cpf", profile.cpf?.replace(/\D/g, ""));
    if (cpfValidationsDeleteError) {
      console.error('[DELETE_USER_DATA] Erro ao remover cpf_validations:', {
        studentId,
        error: cpfValidationsDeleteError.message,
      });
    }

    const { error: auditDeleteError } = await supabase
      .from("audit_logs")
      .delete()
      .eq("student_id", studentId);
    if (auditDeleteError) {
      console.error('[DELETE_USER_DATA] Erro ao remover audit_logs:', {
        studentId,
        error: auditDeleteError.message,
      });
    }

    const { error: docsDeleteError } = await supabase
      .from("documents")
      .delete()
      .eq("student_id", studentId);
    if (docsDeleteError) {
      console.error('[DELETE_USER_DATA] Erro ao remover documents:', {
        studentId,
        error: docsDeleteError.message,
      });
    }

    // === FASE 5: DELETAR profile (parent) ===
    const { error: profilesDeleteError } = await supabase
      .from("student_profiles")
      .delete()
      .eq("id", studentId);
    if (profilesDeleteError) {
      console.error('[DELETE_USER_DATA] Erro ao remover student_profiles:', {
        studentId,
        error: profilesDeleteError.message,
      });
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    console.info("✅ [DELETE_USER_DATA] Usuário deletado (LGPD); CPF liberado para recadastro após 48h", {
      userId: user.id,
    });

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
