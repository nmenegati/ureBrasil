import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download, ArrowLeft, RotateCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface CardData {
  card_number: string;
  usage_code: string;
  qr_code: string;
  valid_until: string;
  status: string;
  card_type: string;
  student_profiles: {
    full_name: string;
    cpf: string;
    rg: string | null;
    birth_date: string;
    institution: string | null;
    course: string | null;
    period: string | null;
    avatar_url: string | null;
  };
}

export default function Carteirinha() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [cardData, setCardData] = useState<CardData | null>(null);
  const [showFront, setShowFront] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCardData();
  }, []);

  const fetchCardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      // Primeiro buscar o student_profile do usuário
      const { data: profile, error: profileError } = await supabase
        .from('student_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profile) {
        throw new Error('Perfil não encontrado');
      }

      // Depois buscar a carteirinha ativa
      const { data: card, error: cardError } = await supabase
        .from('student_cards')
        .select(`
          card_number,
          usage_code,
          qr_code,
          valid_until,
          status,
          card_type,
          student_profiles (
            full_name,
            cpf,
            rg,
            birth_date,
            institution,
            course,
            period,
            avatar_url
          )
        `)
        .eq('student_id', profile.id)
        .eq('status', 'active')
        .single();

      if (cardError) throw cardError;
      if (!card) throw new Error('Carteirinha não encontrada');

      setCardData(card as unknown as CardData);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar a carteirinha.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadCard = async (side: 'frente' | 'verso') => {
    try {
      const { default: html2canvas } = await import('html2canvas');
      
      const element = cardRef.current;
      if (!element) return;

      const canvas = await html2canvas(element, {
        scale: 3,
        backgroundColor: null,
        logging: false,
        useCORS: true
      });

      const link = document.createElement('a');
      link.download = `carteirinha-${side}-${cardData?.card_number}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast({
        title: 'Download iniciado!',
        description: `Carteirinha (${side}) baixada com sucesso.`
      });
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível baixar a carteirinha.',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!cardData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-xl text-foreground">Carteirinha não encontrada</p>
          <Button onClick={() => navigate('/dashboard')}>
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const profile = cardData.student_profiles;
  const validYear = new Date(cardData.valid_until).getFullYear();

  return (
    <div className="min-h-screen bg-background py-6 px-4">
      {/* Header */}
      <div className="max-w-lg mx-auto mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-4 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Minha Carteirinha</h1>
            <p className="text-sm text-muted-foreground">
              {cardData.card_number} • Válida até {new Date(cardData.valid_until).toLocaleDateString('pt-BR')}
            </p>
          </div>
          
          {/* Toggle Frente/Verso */}
          <div className="flex gap-2">
            <Button
              variant={showFront ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFront(true)}
            >
              Frente
            </Button>
            <Button
              variant={!showFront ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFront(false)}
            >
              Verso
            </Button>
          </div>
        </div>
      </div>

      {/* Carteirinha */}
      <div className="max-w-lg mx-auto">
        <div className="flex justify-center mb-6">
          <div ref={cardRef}>
            {showFront ? (
              <CardFront 
                profile={profile} 
                cardData={cardData} 
                validYear={validYear} 
              />
            ) : (
              <CardBack />
            )}
          </div>
        </div>

        {/* Botões de Download */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => {
              setShowFront(true);
              setTimeout(() => downloadCard('frente'), 100);
            }}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Baixar Frente
          </Button>
          <Button
            onClick={() => {
              setShowFront(false);
              setTimeout(() => downloadCard('verso'), 100);
            }}
            variant="outline"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Baixar Verso
          </Button>
        </div>

        {/* Dica */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          <RotateCw className="inline h-3 w-3 mr-1" />
          Clique em "Frente" ou "Verso" para alternar a visualização
        </p>
      </div>
    </div>
  );
}

// Componente Frente
function CardFront({ 
  profile, 
  cardData, 
  validYear 
}: { 
  profile: CardData['student_profiles']; 
  cardData: CardData; 
  validYear: number;
}) {
  // Parse QR code data
  const qrData = cardData.qr_code || JSON.stringify({
    card_number: cardData.card_number,
    usage_code: cardData.usage_code
  });

  return (
    <div 
      className="w-[340px] bg-white rounded-lg overflow-hidden shadow-xl"
      style={{ aspectRatio: '1.586' }}
    >
      {/* Topo Roxo */}
      <div className="bg-[#4338CA] px-4 py-3">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[#FACC15] font-bold text-sm tracking-wide">
              CARTEIRA DO ESTUDANTE
            </h2>
            <p className="text-white text-[10px] opacity-90">
              Documento Nacional do Estudante
            </p>
          </div>
          <div className="text-right">
            <div className="bg-white/10 rounded px-2 py-1">
              <span className="text-white font-bold text-xs">URE</span>
            </div>
            <p className="text-white text-[6px] mt-0.5 max-w-[80px] text-right leading-tight opacity-80">
              UNIÃO REPRESENTATIVA DOS ESTUDANTES E JUVENTUDE DO BRASIL
            </p>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="bg-[#E5E7EB] px-4 py-3">
        <div className="flex gap-3">
          {/* Dados */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[#1F2937] text-sm truncate leading-tight">
              {profile.full_name}
            </p>
            <p className="text-[#4B5563] text-[10px] truncate mt-1">
              {profile.institution || 'Instituição não informada'}
            </p>
            <p className="text-[#4B5563] text-[10px] truncate">
              {profile.course || 'Curso não informado'}
            </p>
            <p className="text-[#4B5563] text-[10px] truncate">
              {profile.period || 'Período não informado'}
            </p>
            
            <div className="mt-2 space-y-0.5">
              <p className="text-[#374151] text-[9px]">
                <span className="font-semibold">CPF:</span> {profile.cpf}
              </p>
              <p className="text-[#374151] text-[9px]">
                <span className="font-semibold">RG:</span> {profile.rg || 'Não informado'}
              </p>
              <p className="text-[#374151] text-[9px]">
                <span className="font-semibold">DATA NASC.:</span> {new Date(profile.birth_date).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>

          {/* Foto */}
          <div className="flex-shrink-0">
            <div className="w-[70px] h-[90px] bg-white border-2 border-[#9CA3AF] rounded overflow-hidden flex items-center justify-center">
              {profile.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt="Foto do estudante"
                  className="w-full h-full object-cover"
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="text-[#9CA3AF] text-3xl">👤</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé Azul */}
      <div className="bg-[#7DD3FC] px-3 py-2">
        <div className="flex items-center justify-between">
          {/* Ano e Validade */}
          <div className="flex items-center gap-2">
            <div className="bg-[#FDE047] border-2 border-[#3B82F6] rounded px-2 py-0.5">
              <span className="font-bold text-[#1E3A8A] text-xs">{validYear}</span>
            </div>
            <div>
              <p className="text-[#1E3A8A] text-[8px] font-semibold">VÁLIDO ATÉ:</p>
              <p className="text-[#1E3A8A] text-[10px] font-bold">
                {new Date(cardData.valid_until).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>

          {/* Código de Uso */}
          <div className="text-center">
            <p className="text-[#1E3A8A] text-[8px] font-semibold">COD. USO:</p>
            <p className="text-[#1E3A8A] text-[11px] font-bold font-mono">
              {cardData.usage_code}
            </p>
          </div>

          {/* QR Code */}
          <div className="bg-white p-1 rounded">
            <QRCodeSVG 
              value={qrData}
              size={45}
              level="M"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente Verso (Estático)
function CardBack() {
  return (
    <div 
      className="w-[340px] bg-white rounded-lg overflow-hidden shadow-xl"
      style={{ aspectRatio: '1.586' }}
    >
      {/* Topo */}
      <div className="bg-[#4338CA] px-4 py-3">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[#FACC15] font-bold text-sm tracking-wide">
              CARTEIRA DO ESTUDANTE
            </h2>
            <p className="text-white text-[10px] opacity-90">
              Documento Nacional do Estudante
            </p>
          </div>
          <div className="text-right">
            <div className="bg-white/10 rounded px-2 py-1">
              <span className="text-white font-bold text-xs">URE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="bg-[#F3F4F6] px-4 py-2 flex-1">
        {/* Apoio */}
        <div className="text-center mb-2">
          <p className="text-[#6B7280] text-[8px] font-semibold">APOIO:</p>
          <div className="bg-[#1F2937] rounded px-3 py-1 inline-block mt-1">
            <p className="text-white text-[10px] font-bold">NOSSA SERTANEJA FM</p>
          </div>
        </div>

        {/* Assinatura */}
        <div className="text-center mb-2">
          <div className="border-b border-[#9CA3AF] pb-1 mb-1 mx-8">
            <p className="text-[#374151] text-sm italic font-serif">Jorge André</p>
          </div>
          <p className="text-[#1F2937] text-[9px] font-bold">JORGE ANDRÉ PERIQUITO</p>
          <p className="text-[#6B7280] text-[8px]">FUNDADOR DA UREC</p>
        </div>

        {/* Box amarelo */}
        <div className="bg-[#FEF3C7] border border-[#F59E0B] rounded px-3 py-2 text-center">
          <p className="text-[#92400E] text-[9px] font-bold">
            ATENDIMENTO: (31) 4063-2828
          </p>
          <p className="text-[#78350F] text-[7px] mt-1">
            Documento padronizado nacionalmente
          </p>
          <p className="text-[#78350F] text-[7px]">
            conforme lei nº 12.933 de 26/12/2013
          </p>
          <p className="text-[#92400E] text-[8px] font-bold mt-1">
            JUVENTUDECIDADA.ORG.BR
          </p>
          <p className="text-[#78350F] text-[7px] mt-1">
            VALIDADE: MARÇO ANO SEGUINTE
          </p>
        </div>
      </div>

      {/* Rodapé */}
      <div className="bg-[#4338CA] px-3 py-1.5">
        <p className="text-white text-[7px] text-center">
          UNIÃO REPRESENTATIVA DOS ESTUDANTES DE CONFRESA - UREC
        </p>
      </div>
    </div>
  );
}
