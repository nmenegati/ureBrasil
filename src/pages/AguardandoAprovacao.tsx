import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Mail, Home } from 'lucide-react';

interface ProfileFlags {
  manual_review_requested: boolean;
  face_validated: boolean;
}

export function AguardandoAprovacao() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [flags, setFlags] = useState<ProfileFlags | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) {
        navigate('/');
        return;
      }

      const { data } = await supabase
        .from('student_profiles')
        .select('manual_review_requested, face_validated')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!data || !data.manual_review_requested || data.face_validated) {
        navigate('/');
        return;
      }

      setFlags(data as ProfileFlags);
    };

    load();
  }, [user, navigate]);

  if (!flags) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Clock className="w-16 h-16 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Aprovação em Análise</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 text-center">
          <p className="text-lg text-gray-700">Obrigado pela sua paciência!</p>

          <p className="text-gray-600">
            Recebemos seu pedido de aprovação manual. Nossa equipe está analisando seus documentos cuidadosamente.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-center gap-2 text-blue-900">
              <Clock className="w-5 h-5" />
              <span className="font-semibold">Prazo: até 24 horas úteis</span>
            </div>

            <div className="flex items-center justify-center gap-2 text-blue-700 text-sm">
              <Mail className="w-4 h-4" />
              <span>Você receberá um e-mail assim que a análise for concluída</span>
            </div>
          </div>

          <div className="pt-4">
            <p className="text-sm text-gray-500 mb-2">Status atual</p>
            <p className="text-lg font-semibold text-blue-600">Em análise pela equipe</p>
          </div>

          <Button onClick={() => navigate('/')} variant="outline" className="mt-6">
            <Home className="w-4 h-4 mr-2" />
            Voltar ao início
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

