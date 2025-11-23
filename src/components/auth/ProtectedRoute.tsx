import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
      return;
    }

    if (user) {
      // Verificar se perfil está completo
      supabase
        .from('student_profiles')
        .select('profile_completed')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          setProfileComplete(data?.profile_completed ?? false);
          
          if (data?.profile_completed === false) {
            navigate('/complete-profile');
          }
        });
    }
  }, [user, loading, navigate]);

  if (loading || profileComplete === null) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Carregando...</div>
      </div>
    );
  }

  return user && profileComplete ? <>{children}</> : null;
}
