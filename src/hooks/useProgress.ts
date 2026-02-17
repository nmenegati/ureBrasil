import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Progress {
  current_step: 'profile' | 'payment' | 'documents' | 'complete';
  progress_percentage: number;
  profile_completed: boolean;
  payment_completed: boolean;
  documents_completed: boolean;
  documents_approved_count: number;
  face_validated: boolean;
  face_validation_attempts: number;
  card_status: string | null;
  digital_card_url: string | null;
}

/**
 * Hook para acompanhar o progresso geral do onboarding do estudante.
 *
 * @param userId - user_id do auth (não o student_id).
 * @returns { progress, loading } - progress é o registro de student_progress para o usuário.
 *
 * Efeitos:
 * - Busca inicialmente o registro em student_progress para o user_id informado.
 * - Cria subscription realtime em:
 *   - student_profiles (filtrado por user_id),
 *   - documents,
 *   - payments,
 *   e refaz a consulta sempre que houver mudanças.
 * - Remove o canal realtime no unmount do componente.
 *
 * Depende de:
 * - View/tabela public.student_progress agregando estado de perfil, documentos, pagamentos e carteirinha.
 * - Triggers ou jobs que mantenham student_progress consistente com as tabelas base.
 */
export function useProgress(userId: string | undefined) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchProgress = async () => {
      const { data, error } = await supabase
        .from('student_progress')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('[useProgress] Erro ao buscar progresso do estudante:', {
          userId,
          error: error.message,
        });
      } else if (data) {
        setProgress(data as Progress);
      }
      setLoading(false);
    };

    fetchProgress();

    const channel = supabase
      .channel('progress-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_profiles',
          filter: `user_id=eq.${userId}`,
        },
        fetchProgress
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
        },
        fetchProgress
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments',
        },
        fetchProgress
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { progress, loading };
}

