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

