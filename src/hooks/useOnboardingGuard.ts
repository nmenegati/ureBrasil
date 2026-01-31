import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const STEP_ORDER = [
  'complete_profile',
  'choose_plan',
  'payment',
  'upsell_physical',
  'payment_upsell',
  'upload_documents',
  'pending_validation',
  'review_data',
  'completed',
] as const;

const STEP_ROUTES: Record<string, string> = {
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

const CRITICAL_STEPS = [
  'complete_profile',
  'choose_plan',
  'payment',
  'upsell_physical',
  'payment_upsell',
] as const;

export function useOnboardingGuard(requiredStep: string) {
  const auth = useAuth() as any;
  const profile = auth?.profile;
  const navigate = useNavigate();

  useEffect(() => {
    if (!profile?.current_onboarding_step) return;

    const currentIndex = STEP_ORDER.indexOf(profile.current_onboarding_step);
    const requiredIndex = STEP_ORDER.indexOf(requiredStep as any);

    if (currentIndex === -1 || requiredIndex === -1) return;

    // Usuário está em step anterior → redireciona para step atual
    if (currentIndex < requiredIndex) {
      const redirectTo = STEP_ROUTES[profile.current_onboarding_step] || '/';
      console.log(
        `[Guard] Redirecionando: ${requiredStep} → ${profile.current_onboarding_step}`,
      );
      navigate(redirectTo, { replace: true });
      return;
    }

    // Bloquear voltar para steps críticos (pagamento / upsell / etc.)
    if (
      currentIndex > requiredIndex &&
      CRITICAL_STEPS.includes(requiredStep as any)
    ) {
      const redirectTo = STEP_ROUTES[profile.current_onboarding_step] || '/';
      console.log(
        `[Guard] Impedindo retorno para step crítico ${requiredStep}, mantendo em ${profile.current_onboarding_step}`,
      );
      navigate(redirectTo, { replace: true });
    }
  }, [profile?.current_onboarding_step, requiredStep, navigate]);
}
