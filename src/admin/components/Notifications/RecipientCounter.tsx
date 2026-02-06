import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface NotificationFilters {
  state?: string;
  city?: string;
  educationLevels: string[];
  cardTypes: string[];
  isPhysical?: boolean | null;
  cardStatuses: string[];
  isLawStudent?: boolean;
}

interface RecipientCounterProps {
  sendType: 'all' | 'filtered';
  filters: NotificationFilters;
  render?: (info: { loading: boolean; count: number | null }) => JSX.Element | null;
}

export function RecipientCounter({ sendType, filters, render }: RecipientCounterProps) {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      console.log('[NOTIF] Contador - sendType:', sendType, 'filters:', filters);

      if (sendType === 'all') {
        setLoading(true);
        const client = supabase as any;
        console.log('[NOTIF] Buscando destinatários (todos)...');
        const { count: total, error } = await client
          .from('student_profiles')
          .select('*', { count: 'exact', head: true })
          .not('user_id', 'is', null);
        console.log('[NOTIF] Resultado (todos):', { error, count: total });
        setCount(total || 0);
        setLoading(false);
        return;
      }

      setLoading(true);
      const client = supabase as any;

      let query = client
        .from('student_profiles')
        .select('id, user_id', { count: 'exact', head: true })
        .not('user_id', 'is', null);

      if (filters.state) {
        query = query.eq('state', filters.state);
      }

      if (filters.city) {
        query = query.ilike('city', `%${filters.city}%`);
      }

      if (filters.educationLevels.length > 0) {
        query = query.in('education_level', filters.educationLevels);
      }

      if (filters.isLawStudent === true) {
        query = query.eq('is_law_student', true);
      }

      const needsCardJoin =
        filters.cardTypes.length > 0 ||
        filters.cardStatuses.length > 0 ||
        filters.isPhysical != null;

      if (needsCardJoin) {
        query = client
          .from('student_profiles')
          .select('id, user_id, student_cards!inner(status,card_type,is_physical)', {
            count: 'exact',
            head: true,
          })
          .not('user_id', 'is', null);

        if (filters.state) {
          query = query.eq('state', filters.state);
        }
        if (filters.city) {
          query = query.ilike('city', `%${filters.city}%`);
        }
        if (filters.educationLevels.length > 0) {
          query = query.in('education_level', filters.educationLevels);
        }
        if (filters.isLawStudent === true) {
          query = query.eq('is_law_student', true);
        }
        if (filters.cardTypes.length > 0) {
          query = query.in('student_cards.card_type', filters.cardTypes);
        }
        if (filters.cardStatuses.length > 0) {
          query = query.in('student_cards.status', filters.cardStatuses);
        }
        if (filters.isPhysical != null) {
          query = query.eq('student_cards.is_physical', filters.isPhysical);
        }
      }

      console.log('[NOTIF] Buscando destinatários (filtrado)...');
      const { count: total, error } = await query;
      console.log('[NOTIF] Resultado (filtrado):', { error, count: total });

      setCount(total || 0);
      setLoading(false);
    };

    load();
  }, [sendType, filters]);

  if (render) {
    return render({ loading, count });
  }

  if (loading || count === null) {
    return (
      <p className="text-xs text-slate-500">
        Calculando destinatários…
      </p>
    );
  }

  return (
    <p className="text-xs text-slate-600">
      {count === 0
        ? 'Nenhum usuário corresponde aos filtros selecionados.'
        : `${count} usuário${count === 1 ? '' : 's'} será${count === 1 ? '' : 'ão'} notificado${count === 1 ? '' : 's'}.`}
    </p>
  );
}
