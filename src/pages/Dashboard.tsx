import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error('Erro ao sair');
    } else {
      toast.success('Você saiu com sucesso');
      navigate('/');
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-xl p-8 shadow-2xl">
          <h1 className="text-3xl font-bold text-white mb-4">
            Bem-vindo, {user.user_metadata?.full_name || user.email}!
          </h1>
          <p className="text-slate-300 mb-8">
            Seu dashboard está em construção. Em breve você poderá gerenciar sua carteirinha, documentos e muito mais.
          </p>
          
          <div className="flex gap-4">
            <Button
              onClick={handleSignOut}
              variant="outline"
              className="bg-slate-700/50 text-white border-slate-600 hover:bg-slate-700"
            >
              Sair
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
