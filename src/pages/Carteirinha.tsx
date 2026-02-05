import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { formatBirthDate } from '@/lib/dateUtils';
import { formatEnrollmentNumber } from '@/lib/validators';
import { Header } from '@/components/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ProgressBar';
import { CardLayoutFront } from '@/components/CardLayoutFront';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { useOnboardingGuard } from '@/hooks/useOnboardingGuard';

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
  profile_photo_url: string | null;
}

interface CardData {
  card_number: string;
  valid_until: string;
  status: string;
  digital_card_url: string | null;
  card_type: string | null;
  usage_code: string | null;
  qr_code: string | null;
  digital_card_generated?: boolean;
}

export default function Carteirinha() {
  const { isChecking } = useOnboardingGuard('completed');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [card, setCard] = useState<CardData | null>(null);
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [generatingImage, setGeneratingImage] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const { data: profileData } = await supabase
        .from('student_profiles')
        .select('id, full_name, cpf, birth_date, institution, course, period, education_level, enrollment_number, profile_photo_url')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profileData) {
        navigate('/complete-profile');
        return;
      }

      const { data: cardData } = await supabase
        .from('student_cards')
        .select('card_number, usage_code, qr_code, valid_until, status, digital_card_url, card_type, digital_card_generated')
        .eq('student_id', profileData.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setProfile(profileData as StudentProfile);
      setCard(cardData as CardData | null);
      setLoading(false);
    };

    load();
  }, [navigate]);

  useEffect(() => {
    const loadProfilePhoto = async () => {
      if (!profile?.profile_photo_url) {
        setProfilePhotoUrl(null);
        return;
      }

      const { data: publicData } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(profile.profile_photo_url);

      if (publicData?.publicUrl) {
        setProfilePhotoUrl(publicData.publicUrl);
        return;
      }

      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(profile.profile_photo_url, 600);

      if (!error && data?.signedUrl) {
        setProfilePhotoUrl(data.signedUrl);
      } else {
        setProfilePhotoUrl(null);
      }
    };

    loadProfilePhoto();
  }, [profile?.profile_photo_url]);

  const generateAndSaveCard = useCallback(async () => {
    try {
      if (!cardRef.current) {
        throw new Error('Elemento da carteirinha não encontrado');
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Usuário não autenticado');
      }

      const { data: studentProfile, error: profileError } = await supabase
        .from('student_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profileError || !studentProfile) {
        throw new Error('Perfil de estudante não encontrado');
      }

      setGeneratingImage(true);

      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, 'image/png', 0.95)
      );

      if (!blob) {
        throw new Error('Falha ao gerar imagem da carteirinha');
      }

      const path = `${user.id}/digital-card-front.png`;

      const { error: uploadError } = await supabase.storage
        .from('student-cards')
        .upload(path, blob, {
          upsert: true,
          contentType: 'image/png',
        });

      if (uploadError) {
        console.error('Erro ao enviar imagem da carteirinha:', uploadError);
        throw uploadError;
      }

      const { data: publicData } = supabase.storage
        .from('student-cards')
        .getPublicUrl(path);

      const publicUrl = publicData?.publicUrl;
      if (!publicUrl) {
        throw new Error('Não foi possível obter a URL pública da carteirinha');
      }

      const { error: updateError } = await supabase
        .from('student_cards')
        .update({
          digital_card_url: publicUrl,
          digital_card_generated: true,
        })
        .eq('student_id', studentProfile.id)
        .eq('status', 'active');

      if (updateError) {
        console.error('Erro ao atualizar registro da carteirinha:', updateError);
        throw updateError;
      }

      setCard((current) =>
        current
          ? {
              ...current,
              digital_card_url: publicUrl,
              digital_card_generated: true,
            }
          : current
      );

      toast.success('Carteirinha digital gerada com sucesso');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro ao gerar carteirinha digital';
      console.error('Erro ao gerar imagem da carteirinha:', error);
      toast.error(message);
    } finally {
      setGeneratingImage(false);
    }
  }, []);

  useEffect(() => {
    if (!profile || !card) return;
    if (card.digital_card_url || generatingImage) return;
    if (!cardRef.current) return;

    generateAndSaveCard();
  }, [profile, card, generatingImage, generateAndSaveCard]);

  if (isChecking || loading) {
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
      pos_lato: 'Pós-graduação',
      stricto_sensu: 'Mestrado/Doutorado',
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

  const hasDigital = !!card.digital_card_url;
  const isLawCard =
    !!card.card_type && card.card_type.toLowerCase().includes('direito');
  const mode = isLawCard ? 'direito' : 'geral';
  const frontImageUrl = isLawCard
    ? '/templates/direito-frente-template-v.png'
    : '/templates/geral-frente-template-v.png';
  const backImageUrl = isLawCard
    ? '/templates/direito-verso-template-v.png'
    : '/templates/geral-verso-template-v.png';

  return (
    <div className="min-h-screen bg-background">
      <Header variant="app" />
      <main className="container mx-auto px-4 py-8 max-w-sm">
        <div className="bg-white rounded-lg overflow-hidden border border-border">
          {side === 'front' ? (
            card.digital_card_url ? (
              <img
                src={card.digital_card_url}
                alt="Carteirinha digital - frente"
                className="w-full h-auto"
              />
            ) : (
              <div ref={cardRef}>
                <CardLayoutFront
                  mode={mode}
                  templateSrc={frontImageUrl}
                  fullName={profile.full_name}
                  cpf={profile.cpf}
                  birthDate={formatBirthDate(profile.birth_date)}
                  institution={profile.institution}
                  educationLabel={formatEducationLevel(profile.education_level)}
                  period={profile.period}
                  course={profile.course}
                  enrollmentNumber={
                    profile.enrollment_number
                      ? formatEnrollmentNumber(String(profile.enrollment_number))
                      : null
                  }
                  usageCode={card.usage_code || card.card_number}
                  validUntil={new Date(card.valid_until).toLocaleDateString('pt-BR')}
                  photoUrl={profilePhotoUrl}
                  qrData={card.qr_code || card.usage_code || card.card_number}
                />
              </div>
            )
          ) : (
            <img
              src={backImageUrl}
              alt="Carteirinha digital - verso"
              className="w-full h-auto rounded-xl"
            />
          )}
        </div>

        <div className="flex gap-2 mt-4 justify-center">
          <Button
            type="button"
            variant={side === 'front' ? 'default' : 'outline'}
            className="min-w-[100px]"
            onClick={() => setSide('front')}
          >
            Frente
          </Button>
          <Button
            type="button"
            variant={side === 'back' ? 'default' : 'outline'}
            className="min-w-[100px]"
            onClick={() => setSide('back')}
          >
            Verso
          </Button>
        </div>
      </main>
    </div>
  );
}
