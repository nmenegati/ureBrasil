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
  review_data: '/gerar-carteirinha',
  completed: '/carteirinha',
};

/**
 * Hook de guarda de onboarding baseado em current_onboarding_step.
 *
 * @param requiredStep - Nome do passo esperado ou lista de passos válidos.
 * @returns { isChecking } - Booleano indicando se ainda está validando o passo atual.
 *
 * Efeitos:
 * - Busca em student_profiles o campo current_onboarding_step para o user_id atual.
 * - Se o passo atual for diferente de requiredStep, redireciona para a rota mapeada em STEP_ROUTES.
 * - Se o usuário não estiver logado ou não houver step, apenas libera a página (isChecking = false).
 *
 * Depende de:
 * - Hook useAuth para obter user.id.
 * - Tabela student_profiles.current_onboarding_step.
 * - Convenção de rotas definidas em STEP_ROUTES.
 */
export function useOnboardingGuard(requiredStep: string | string[]) {
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
        const steps = Array.isArray(requiredStep) ? requiredStep : [requiredStep];

        if (steps.includes(step)) {
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
  }, [requiredStep, user?.id, navigate]);

  return { isChecking };
}
