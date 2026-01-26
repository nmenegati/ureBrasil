import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ProgressBar } from '@/components/ProgressBar';

interface StudentProfile {
  id: string;
  full_name: string;
  cpf: string;
  birth_date: string;
  institution: string | null;
  course: string | null;
  period: string | null;
  education_level: string | null;
  enrollment_number: string | null;
}

interface CardData {
  card_number: string;
  valid_until: string;
  status: string;
}

export default function Carteirinha() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [card, setCard] = useState<CardData | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const { data: profileData } = await supabase
        .from('student_profiles')
        .select('id, full_name, cpf, birth_date, institution, course, period, education_level, enrollment_number')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profileData) {
        navigate('/complete-profile');
        return;
      }

      const { data: cardData } = await supabase
        .from('student_cards')
        .select('card_number, valid_until, status')
        .eq('student_id', profileData.id)
        .eq('status', 'active')
        .maybeSingle();

      setProfile(profileData as StudentProfile);
      setCard(cardData as CardData | null);
      setLoading(false);
    };

    load();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          <p className="text-sm text-muted-foreground">Carregando carteirinha...</p>
        </div>
      </div>
    );
  }

  const formatEducationLevel = (level: string | null) => {
    if (!level) return 'Não informado';
    const map: Record<string, string> = {
      fundamental: 'Fundamental',
      medio: 'Médio',
      tecnico: 'Técnico',
      graduacao: 'Graduação',
      pos: 'Pós-graduação',
      mestrado: 'Mestrado',
      doutorado: 'Doutorado',
    };
    return map[level] || level;
  };

  if (!profile || !card) {
    return (
      <div className="min-h-screen bg-background">
        <Header variant="app" />
        <main className="container mx-auto px-4 py-10 max-w-xl">
          <Card>
            <CardHeader>
              <CardTitle>Carteirinha não encontrada</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-700">
              <p>
                Não encontramos uma carteirinha ativa para o seu cadastro.
              </p>
              <Button onClick={() => navigate('/gerar-carteirinha')}>
                Gerar carteirinha digital
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header variant="app" />
      <main className="container mx-auto px-4 py-8 max-w-xl">
        <div className="mb-4">
          <ProgressBar currentStep="card" />
        </div>
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle>Carteirinha do Estudante URE Brasil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-800">
            <p><strong>{profile.full_name}</strong></p>
            <p><strong>CPF:</strong> {profile.cpf}</p>
            <p>
              <strong>Data nasc.:</strong>{' '}
              {new Date(profile.birth_date).toLocaleDateString('pt-BR')}
            </p>
            <p><strong>{profile.institution || 'Não informado'}</strong> </p>
            <p>
              <strong>{formatEducationLevel(profile.education_level)} - {profile.period || 'Não informado'}</strong>
            </p>
            <p><strong>{profile.course || 'Não informado'}</strong></p>
            <p><strong>Matrícula:</strong> {profile.enrollment_number || 'Não informado'}</p>
            <p className="text-xs text-slate-600 pt-2 border-t border-slate-200">
              A versão visual da carteirinha será atualizada em breve. Este resumo
              contém os dados oficiais da sua carteirinha ativa.
            </p>
            <Button
              className="w-full mt-4"
              onClick={() =>
                toast({
                  title: 'Em breve',
                  description:
                    'A geração visual automática da carteirinha será habilitada em breve.',
                })
              }
            >
              Gerar Minha carteirinha
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
