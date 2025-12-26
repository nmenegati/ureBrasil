import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [sessionChecked, setSessionChecked] = useState(false);

  // Marcar sessão como verificada quando loading terminar
  useEffect(() => {
    if (!loading) {
      setSessionChecked(true);
    }
  }, [loading]);

  // Só redirecionar se sessão foi verificada E não há usuário
  useEffect(() => {
    if (sessionChecked && !user) {
      navigate('/login', { replace: true });
    }
  }, [sessionChecked, user, navigate]);

  // Loading state
  if (loading || !sessionChecked) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto"></div>
          <p className="text-slate-400 mt-4">Carregando...</p>
        </div>
      </div>
    );
  }

  return user ? <>{children}</> : null;
}
