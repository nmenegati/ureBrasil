// Página de visualização da carteirinha estudantil
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { Download, Share2, ArrowLeft, CreditCard, AlertCircle, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ureLogo from '@/assets/ure-brasil-logo.png';

interface StudentCard {
  id: string;
  card_number: string;
  card_type: string;
  qr_code: string;
  valid_until: string;
  status: string;
  is_physical: boolean;
  issued_at: string;
}

interface StudentProfile {
  id: string;
  full_name: string;
  cpf: string;
  rg: string | null;
  birth_date: string;
  institution: string | null;
  course: string | null;
  avatar_url: string | null;
}

export default function Carteirinha() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [card, setCard] = useState<StudentCard | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user && !authLoading) {
      fetchCardData();
    }
  }, [user, authLoading]);

  const fetchCardData = async () => {
    try {
      const { data: studentProfile, error: profileError } = await supabase
        .from('student_profiles')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!studentProfile) {
        setLoading(false);
        return;
      }

      setProfile(studentProfile);

      const { data: studentCard, error: cardError } = await supabase
        .from('student_cards')
        .select('*')
        .eq('student_id', studentProfile.id)
        .eq('status', 'active')
        .maybeSingle();

      if (cardError) throw cardError;
      setCard(studentCard);
    } catch (error) {
      console.error('Erro ao buscar carteirinha:', error);
      toast.error('Erro ao carregar carteirinha');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;

    try {
      toast.loading('Gerando imagem...');
      
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
        allowTaint: true,
      });

      const link = document.createElement('a');
      link.download = `carteirinha-${card?.card_number || 'estudante'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast.dismiss();
      toast.success('Carteirinha baixada com sucesso!');
    } catch (error) {
      console.error('Erro ao baixar:', error);
      toast.dismiss();
      toast.error('Erro ao gerar imagem');
    }
  };

  const handleShare = async () => {
    if (!navigator.share) {
      toast.error('Compartilhamento não suportado neste navegador');
      return;
    }

    try {
      await navigator.share({
        title: 'Minha Carteirinha Estudantil URE Brasil',
        text: `Carteirinha ${card?.card_number} - ${profile?.full_name}`,
        url: window.location.href,
      });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Erro ao compartilhar:', error);
      }
    }
  };

  const formatCPF = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const isDireito = card?.card_type?.includes('direito');

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0D7DBF] to-[#00A859] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="text-white/80 mt-4">Carregando carteirinha...</p>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0D7DBF] to-[#00A859]">
        <Header variant="app" />
        <main className="max-w-md mx-auto px-4 py-8">
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-2xl p-8 text-center shadow-xl">
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Nenhuma carteirinha ativa
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Complete todas as etapas para obter sua carteirinha estudantil.
            </p>
            <Button
              onClick={() => navigate('/dashboard')}
              className="bg-gradient-to-r from-[#0D7DBF] to-[#00A859] hover:opacity-90"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Dashboard
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const cardGradient = isDireito 
    ? 'from-amber-900 via-amber-800 to-amber-950' 
    : 'from-[#0D7DBF] via-[#0A6BA3] to-[#00A859]';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0D7DBF] to-[#00A859]">
      <Header variant="app" />
      
      <main className="max-w-md mx-auto px-4 py-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Minha Carteirinha</h1>
          <p className="text-white/80 text-sm">
            {card.is_physical ? 'Digital + Física' : 'Digital'}
          </p>
        </div>

        {/* Banner de carteirinha física a caminho */}
        {card.is_physical && (
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-lg mb-6 shadow-lg">
            <div className="flex items-center gap-3">
              <Truck className="w-6 h-6 flex-shrink-0" />
              <div>
                <p className="font-semibold">Versão física a caminho! 📦</p>
                <p className="text-sm opacity-90">
                  Você receberá sua carteirinha em casa em 7-10 dias úteis
                </p>
              </div>
            </div>
          </div>
        )}

        <div
          ref={cardRef}
          id="carteirinha-card"
          className={`relative overflow-hidden rounded-2xl shadow-2xl bg-gradient-to-br ${cardGradient}`}
          style={{ aspectRatio: '1.586' }}
        >
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full blur-3xl transform translate-x-10 -translate-y-10"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full blur-3xl transform -translate-x-8 translate-y-8"></div>
          </div>

          <div className="relative z-10 p-5 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <img 
                  src={ureLogo} 
                  alt="URE Brasil" 
                  className="h-8 w-auto object-contain brightness-0 invert"
                />
                <div className="text-white">
                  <p className="text-[10px] uppercase tracking-wider opacity-80">
                    {isDireito ? 'JurisEstudante' : 'Carteirinha Estudantil'}
                  </p>
                </div>
              </div>
              <CreditCard className="w-6 h-6 text-white/60" />
            </div>

            <div className="flex gap-4 flex-1">
              <div className="flex-shrink-0">
                <div className="w-20 h-24 rounded-lg overflow-hidden bg-white/20 border-2 border-white/30">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/60">
                      <span className="text-2xl font-bold">
                        {profile?.full_name?.charAt(0) || '?'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 text-white min-w-0">
                <h2 className="font-bold text-sm leading-tight mb-1 truncate">
                  {profile?.full_name}
                </h2>
                <div className="space-y-0.5 text-[10px] opacity-90">
                  <p className="truncate">
                    <span className="opacity-70">Instituição:</span>{' '}
                    {profile?.institution || 'Não informada'}
                  </p>
                  <p className="truncate">
                    <span className="opacity-70">Curso:</span>{' '}
                    {profile?.course || 'Não informado'}
                  </p>
                  <p>
                    <span className="opacity-70">CPF:</span>{' '}
                    {profile?.cpf ? formatCPF(profile.cpf) : '---'}
                  </p>
                  {profile?.rg && (
                    <p>
                      <span className="opacity-70">RG:</span> {profile.rg}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-end justify-between mt-3 pt-3 border-t border-white/20">
              <div className="text-white text-[10px] space-y-0.5">
                <p>
                  <span className="opacity-70">Nº:</span>{' '}
                  <span className="font-mono font-semibold">{card.card_number}</span>
                </p>
                <p>
                  <span className="opacity-70">Válida até:</span>{' '}
                  <span className="font-semibold">
                    {format(new Date(card.valid_until), 'dd/MM/yyyy', { locale: ptBR })}
                  </span>
                </p>
              </div>

              <div className="bg-white rounded-lg p-1.5">
                <QRCodeSVG
                  value={card.qr_code || card.card_number}
                  size={56}
                  level="H"
                  includeMargin={false}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mt-3">
          <p className="text-white/60 text-xs font-mono">{card.qr_code}</p>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            onClick={handleDownload}
            variant="secondary"
            className="flex-1 bg-white/95 hover:bg-white text-slate-900"
          >
            <Download className="w-4 h-4 mr-2" />
            Baixar
          </Button>
          <Button
            onClick={handleShare}
            variant="secondary"
            className="flex-1 bg-white/95 hover:bg-white text-slate-900"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Compartilhar
          </Button>
        </div>

        <Button
          onClick={() => navigate('/dashboard')}
          variant="ghost"
          className="w-full mt-4 text-white/80 hover:text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar ao Dashboard
        </Button>

        <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-xl p-4">
          <h3 className="text-white font-semibold text-sm mb-2">Sobre sua carteirinha</h3>
          <ul className="text-white/80 text-xs space-y-1">
            <li>• Válida em todo território nacional</li>
            <li>• Garante meia-entrada em eventos culturais e esportivos</li>
            <li>• QR Code para validação rápida</li>
            {card.is_physical && (
              <li>• Versão física será enviada para seu endereço</li>
            )}
          </ul>
        </div>
      </main>
    </div>
  );
}
