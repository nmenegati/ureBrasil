import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export const STEP_ROUTES: Record<string, string> = {
  complete_profile: '/complete-profile',
  choose_plan: '/escolher-plano',
  payment: '/pagamento',
  upsell_physical: '/pagamento/sucesso',
  payment_upsell: '/checkout',
  upload_documents: '/upload-documentos',
  pending_validation: '/status-validacao',
  review_data: '/gerar-carteirinha',
  completed: '/carteirinha',
};

export function useOnboardingGuard(requiredStep: string) {
  const { user } = useAuth() as any;
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const checkStep = async () => {

      if (!user?.id) {
        setIsChecking(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('student_profiles')
          .select('current_onboarding_step')
          .eq('user_id', user.id)
          .maybeSingle();

        if (cancelled) return;

        if (error || !data?.current_onboarding_step) {
          setIsChecking(false);
          return;
        }

        const step = data.current_onboarding_step as string;

        if (step === requiredStep) {
          setIsChecking(false);
          return;
        }

        const redirectTo = STEP_ROUTES[step] || '/';
        navigate(redirectTo, { replace: true });
      } catch {
        if (!cancelled) {
          setIsChecking(false);
        }
      }
    };

    checkStep();

    return () => {
      cancelled = true;
    };
  }, [requiredStep, user?.id]);

  return { isChecking };
}
