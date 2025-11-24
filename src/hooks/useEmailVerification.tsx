import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';

const IS_PRODUCTION = import.meta.env.VITE_IS_PRODUCTION === 'true';

// Rotas que requerem email confirmado em produção
const PROTECTED_ROUTES = [
  '/pagamento',
  '/emitir-carteirinha',
  '/finalizar-pedido'
];

export function useEmailVerification() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [shouldBlock, setShouldBlock] = useState(false);

  useEffect(() => {
    if (!user) {
      setShouldBlock(false);
      return;
    }

    // Verificar se está em rota protegida
    const isProtectedRoute = PROTECTED_ROUTES.some(route => 
      location.pathname.startsWith(route)
    );

    // Bloquear se: em produção + rota protegida + email não confirmado
    const needsVerification = IS_PRODUCTION && 
                             isProtectedRoute && 
                             !user.email_confirmed_at;

    setShouldBlock(needsVerification);

    if (needsVerification) {
      navigate('/verificar-email');
    }
  }, [user, location.pathname, navigate]);

  return {
    isEmailVerified: !!user?.email_confirmed_at,
    shouldBlock,
    isProduction: IS_PRODUCTION
  };
}
