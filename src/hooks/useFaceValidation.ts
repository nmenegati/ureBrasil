import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FaceValidationResult {
  id?: string;
  student_id?: string;
  rg_similarity: number;
  foto_similarity: number;
  passed: boolean;
  attempt_number: number;
  manual_review_requested?: boolean;
  created_at: string;
}

/**
 * Hook para acompanhar o resultado da validação facial de um estudante.
 *
 * @param studentId - ID da tabela student_profiles (não é o user_id do auth).
 * @returns { result, loading } - result é o último registro em face_validations para o studentId.
 *
 * Efeitos:
 * - Faz uma consulta inicial em face_validations buscando o registro mais recente.
 * - Cria uma subscription realtime (postgres_changes) para INSERTs em face_validations
 *   filtrados por student_id e atualiza o result automaticamente.
 * - Remove o canal realtime no unmount do componente.
 *
 * Depende de:
 * - Tabela public.face_validations com coluna student_id e created_at.
 * - Edge function compare-faces e triggers que inserem registros em face_validations.
 */
export function useFaceValidation(studentId: string | undefined) {
  const [result, setResult] = useState<FaceValidationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;

    const fetchLatest = async () => {
      const { data, error } = await supabase
        .from('face_validations')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setResult(data as FaceValidationResult);
      }
      setLoading(false);
    };

    fetchLatest();

    const channel = supabase
      .channel('face-validation-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'face_validations',
          filter: `student_id=eq.${studentId}`,
        },
        fetchLatest
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId]);

  return { result, loading };
}
