import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { ProgressBar } from '@/components/ProgressBar';

interface ProfileData {
  id: string;
  full_name: string;
  cpf: string;
  birth_date: string | null;
  institution: string | null;
  course: string | null;
  period: string | null;
  enrollment_number: string | null;
  education_level: string | null;
  face_validated: boolean | null;
  terms_accepted: boolean | null;
  profile_completed: boolean | null;
}

function getPeriodLabel(educationLevel: string | null, period: string | null) {
  if (!period) return 'Período';
  const lower = period.toLowerCase();
  if (lower.includes('semestre')) return 'Semestre';
  if (lower.includes('trimestre')) return 'Trimestre';
  if (lower.includes('bimestre')) return 'Bimestre';
  if (lower.includes('ano')) return 'Ano';
  if (lower.includes('módulo') || lower.includes('modulo')) return 'Módulo';
  if (lower.includes('série') || lower.includes('serie')) return 'Série';
  return 'Período';
}

export default function GerarCarteirinha() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        navigate('/login');
        return;
      }

      try {
        const { data: profileData, error: profileError } = await supabase
          .from('student_profiles')
          .select('id, full_name, cpf, birth_date, institution, course, period, enrollment_number, education_level, face_validated, terms_accepted, profile_completed')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError || !profileData) {
          setError('Perfil não encontrado. Complete seu cadastro.');
          setLoading(false);
          setTimeout(() => navigate('/complete-profile'), 1500);
          return;
        }

        if (!profileData.profile_completed) {
          navigate('/complete-profile');
          return;
        }

        const { data: card } = await supabase
          .from('student_cards')
          .select('status, digital_card_url')
          .eq('student_id', profileData.id)
          .maybeSingle();

        if (card?.status === 'active' && card.digital_card_url) {
          navigate('/carteirinha');
          return;
        }

        const { count: docsApproved } = await supabase
          .from('documents')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', profileData.id)
          .eq('status', 'approved');

        const docsOk = (docsApproved || 0) === 4;
        const faceOk = !!profileData.face_validated;
        const termsOk = !!profileData.terms_accepted;

        if (!docsOk || !faceOk || !termsOk) {
          setError('Você ainda precisa concluir alguma etapa antes de gerar a carteirinha.');
          setLoading(false);
          setTimeout(() => navigate('/upload-documentos'), 2000);
          return;
        }

        setProfile(profileData as ProfileData);
        setLoading(false);
      } catch {
        setError('Erro ao carregar dados. Tente novamente.');
        setLoading(false);
      }
    };

    if (!authLoading) {
      load();
    }
  }, [user, authLoading, navigate]);

  const handleConfirmGenerate = async () => {
    if (!user || !profile || generating) return;
    setGenerating(true);
    setError(null);
    navigate('/carteirinha');
    setGenerating(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">{error || 'Carregando...'}</p>
          <Button size="sm" onClick={() => navigate('/upload-documentos')}>
            Voltar para documentos
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header variant="app" />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-4">
          <ProgressBar currentStep="card" />
        </div>
        <Card className="bg-card border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              Confirme os dados para emissão da sua Carteirinha do Estudante URE
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-foreground">


            <div className="space-y-2">
              <p><strong>Nome:</strong> {profile.full_name}</p>
              <p><strong>CPF:</strong> {profile.cpf}</p>
              <p>
                <strong>Data nasc.:</strong>{' '}
                {profile.birth_date
                  ? new Date(profile.birth_date).toLocaleDateString('pt-BR')
                  : 'Não informado'}
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <p><strong>Instituição:</strong> {profile.institution || 'Não informado'}</p>
              <p>
                <strong>Nível:</strong>{' '}
                {profile.education_level || 'Não informado'}
              </p>
              <p>
                <strong>{getPeriodLabel(profile.education_level, profile.period)}:</strong>{' '}
                {profile.period || 'Não informado'}
              </p>
              {!(
                (!profile.course || profile.course.trim() === '') &&
                (profile.education_level === 'fundamental' || profile.education_level === 'medio')
              ) && (
                <p><strong>Curso:</strong> {profile.course || 'Não informado'}</p>
              )}
              <p><strong>Matrícula:</strong> {profile.enrollment_number || 'Não informado'}</p>
            </div>

            <Alert className="mt-2">
              <AlertDescription className="text-xs text-muted-foreground">
                Ao confirmar, você declara que os dados estão corretos e autoriza a emissão da
                carteirinha com base nessas informações e na foto 3x4 enviada. Alterações posteriores
                podem exigir análise manual pelo suporte.
              </AlertDescription>
            </Alert>

            {error && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <Button
                className="w-full"
                disabled={generating}
                onClick={handleConfirmGenerate}
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Gerando sua carteirinha...
                  </>
                ) : (
                  'Confirmar dados e gerar carteirinha'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => navigate('/perfil')}
              >
                Ir para meu perfil
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
