import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';
import { formatBirthDate } from '@/lib/dateUtils';
import { formatEnrollmentNumber } from '@/lib/validators';
import { Header } from '@/components/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ProgressBar';
import { CardLayoutFront } from '@/components/CardLayoutFront';
import { toast } from 'sonner';
import { useOnboardingGuard } from '@/hooks/useOnboardingGuard';
import { ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import { SupportModal } from '@/components/SupportModal';

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
  /**
   * FLUXO DO USUÁRIO:
   * 1. Após concluir o onboarding e ter carteirinha ativa, acessa /carteirinha.
   * 2. Página busca student_profiles e student_cards ativos para montar a visualização.
   * 3. Usuário pode alternar entre frente/verso, fazer swipe (mobile/desktop) e baixar
   *    a imagem da carteirinha (html2canvas + download).
   * 4. Caso não encontre carteirinha ativa, redireciona para passos anteriores ou mostra erro.
   *
   * ESTADOS DERIVADOS:
   * - side: controla se está mostrando frente ou verso.
   * - profilePhotoUrl: URL da foto do perfil usada no layout.
   * - qrCodeUrl: data URL do QRCode gerado a partir de usage_code.
   *
   * GUARDS:
   * - useOnboardingGuard('completed'): garante que apenas alunos com fluxo concluído
   *   acessem /carteirinha (baseado em current_onboarding_step).
   * - Redireciona para /login se não houver usuário autenticado.
   *
   * DEPENDÊNCIAS BACKEND:
   * - student_profiles (dados pessoais, instituição, curso, matrícula).
   * - student_cards (card_number, usage_code, status, digital_card_url).
   * - Triggers de pagamentos e documentos que mantêm o card em status 'active'.
   */
  const { isChecking } = useOnboardingGuard('completed');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [card, setCard] = useState<CardData | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);

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
    setPhotoLoaded(false);

    const loadProfilePhoto = async () => {
      try {
        if (!profile?.profile_photo_url) {
          setProfilePhotoUrl(null);
          return;
        }

        const { data: publicData } = supabase.storage
          .from('profile-photos')
          .getPublicUrl(profile.profile_photo_url);

        if (publicData?.publicUrl) {
          try {
            const res = await fetch(publicData.publicUrl, { method: 'HEAD' });
            if (res.ok) {
              setProfilePhotoUrl(publicData.publicUrl);
              return;
            }
          } catch {
            // Falhou - tentar fallback
          }
        }

        const { data, error } = await supabase.storage
          .from('documents')
          .createSignedUrl(profile.profile_photo_url, 600);

        if (!error && data?.signedUrl) {
          setProfilePhotoUrl(data.signedUrl);
        } else {
          setProfilePhotoUrl(null);
        }
      } finally {
        setPhotoLoaded(true);
      }
    };

    loadProfilePhoto();
  }, [profile?.profile_photo_url]);

  useEffect(() => {
    const generateQrCode = async () => {
      if (!card) {
        setQrCodeUrl(null);
        return;
      }
      if (!card.usage_code) {
        setQrCodeUrl(null);
        return;
      }
      const url = `https://urebrasil.com.br/verificar/${card.usage_code}`;
      try {
        const dataUrl = await QRCode.toDataURL(url, {
          margin: 0,
          scale: 4,
          errorCorrectionLevel: 'M',
        });
        setQrCodeUrl(dataUrl);
      } catch {
        setQrCodeUrl(null);
      }
    };

    generateQrCode();
  }, [card]);

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

      const html2canvas = (await import('html2canvas')).default;

      if (cardRef.current) {
        const imgs = cardRef.current.querySelectorAll('img');
        if (imgs.length > 0) {
          await Promise.all(
            Array.from(imgs).map((img) =>
              img.complete
                ? Promise.resolve()
                : new Promise<void>((resolve) => {
                    img.onload = () => resolve();
                    img.onerror = () => resolve();
                  })
            )
          );
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

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

      const cacheBuster = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('student_cards')
        .update({
          digital_card_url: cacheBuster,
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
              digital_card_url: cacheBuster,
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
    if (!qrCodeUrl) return;
    if (!photoLoaded) return;
    if (card.digital_card_url || generatingImage) return;
    if (!cardRef.current) return;

    generateAndSaveCard();
  }, [profile, card, qrCodeUrl, photoLoaded, generatingImage, generateAndSaveCard]);

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

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const scrollLeft = scrollRef.current.scrollLeft;
    const width = scrollRef.current.offsetWidth;
    if (!width) return;
    setActiveIndex(Math.round(scrollLeft / width));
  };

  const scrollToIndex = (index: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      left: index * scrollRef.current.offsetWidth,
      behavior: 'smooth',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header variant="app" />
      <main className="container mx-auto py-8 max-w-sm">
        <div className="relative group" style={{ marginLeft: '-16px', marginRight: '-16px', width: 'calc(100% + 32px)' }}>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex overflow-x-auto snap-x snap-mandatory touch-pan-y select-none scroll-smooth"
            style={{ scrollbarWidth: 'none', marginLeft: '-16px', marginRight: '-16px', width: 'calc(100% + 32px)' }}
          >
            <div className="min-w-full snap-center flex-shrink-0">
              <div className="bg-white rounded-lg overflow-hidden border border-border">
                {card.digital_card_url ? (
                  <div className="w-full flex justify-center">
                    <img
                      src={card.digital_card_url}
                      alt="Carteirinha digital - frente"
                      style={{ width: '100%', maxWidth: '384px' }}
                      className="h-auto"
                    />
                  </div>
                ) : (
                  <div className="w-full flex justify-center">
                    <div ref={cardRef} style={{ width: '100%', maxWidth: '384px' }}>
                      <CardLayoutFront
                        mode={mode}
                        templateSrc={frontImageUrl}
                        fullName={profile.full_name}
                        cpf={profile.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
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
                        usageCode={card.usage_code}
                        validUntil={new Date(card.valid_until + 'T12:00:00').toLocaleDateString('pt-BR')}
                        photoUrl={profilePhotoUrl}
                        qrImageUrl={qrCodeUrl}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="min-w-full snap-center flex-shrink-0">
              <div className="bg-white rounded-lg overflow-hidden border border-border">
                <div className="w-full flex justify-center">
                  <img
                    src={backImageUrl}
                    alt="Carteirinha digital - verso"
                    style={{ width: '100%', maxWidth: '384px' }}
                    className="h-auto"
                  />
                </div>
              </div>
            </div>
          </div>

          {activeIndex > 0 && (
            <button
              type="button"
              onClick={() => scrollToIndex(activeIndex - 1)}
              className="hidden md:flex items-center justify-center absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/40 text-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}

          {activeIndex < 1 && (
            <button
              type="button"
              onClick={() => scrollToIndex(activeIndex + 1)}
              className="hidden md:flex items-center justify-center absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/40 text-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex justify-center gap-2 py-3 px-4">
          {[0, 1].map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollToIndex(i)}
              className={`rounded-full transition-all duration-300 ${
                activeIndex === i
                  ? 'w-2.5 h-2.5 bg-primary'
                  : 'w-2 h-2 bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>
      </main>
      <div className="mt-4 flex justify-center pb-6">
        <Button
          type="button"
          variant="outline"
          className="flex items-center gap-2"
          onClick={() => setSupportOpen(true)}
        >
          <MessageCircle className="w-4 h-4" />
          Precisa de ajuda? Abra uma solicitação
        </Button>
      </div>
      <SupportModal
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
      />
    </div>
  );
}
