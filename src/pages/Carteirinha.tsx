import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download, ArrowLeft, RotateCw } from 'lucide-react';
import QRCode from 'qrcode';

interface StudentProfile {
  id: string;
  full_name: string;
  cpf: string;
  rg: string | null;
  birth_date: string;
  institution: string | null;
  course: string | null;
  period: string | null;
  avatar_url: string | null;
}

interface CardData {
  card_number: string;
  usage_code: string | null;
  qr_code: string;
  valid_until: string;
  status: string;
  card_type: string;
}

export default function Carteirinha() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [cardData, setCardData] = useState<CardData | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [showFront, setShowFront] = useState(true);
  const [generatedFront, setGeneratedFront] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Helper para carregar imagem com Promise
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        console.log('✅ Imagem carregada:', src.substring(0, 50));
        resolve(img);
      };
      img.onerror = (e) => {
        console.error('❌ Erro ao carregar imagem:', src.substring(0, 50), e);
        reject(e);
      };
      img.src = src;
    });
  };

  // Desenhar fundo fallback quando template não existe
  const drawFallbackBackground = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#5B21B6';
    ctx.fillRect(0, 0, 1010, 128);
    ctx.fillStyle = '#E5E7EB';
    ctx.fillRect(0, 128, 1010, 420);
    ctx.fillStyle = '#0EA5E9';
    ctx.fillRect(0, 548, 1010, 96);

    ctx.fillStyle = '#374151';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('CARTEIRINHA DE ESTUDANTE', 505, 60);
    ctx.textAlign = 'left';
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      // Buscar perfil
      const { data: profileData, error: profileError } = await supabase
        .from('student_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profileData) {
        throw new Error('Perfil não encontrado');
      }

      // Buscar carteirinha ativa
      const { data: card, error: cardError } = await supabase
        .from('student_cards')
        .select('card_number, usage_code, qr_code, valid_until, status, card_type')
        .eq('student_id', profileData.id)
        .eq('status', 'active')
        .single();

      if (cardError) throw cardError;
      if (!card) throw new Error('Carteirinha não encontrada');

      console.log('✅ Dados carregados:', { profile: profileData.full_name, card: card.card_number });
      setProfile(profileData);
      setCardData(card);
      // A geração do card será feita pelo useEffect separado

    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível carregar a carteirinha.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Effect separado para gerar card quando dados e canvas estiverem prontos
  useEffect(() => {
    if (profile && cardData && canvasRef.current && !generatedFront) {
      console.log('🔄 Triggering card generation via useEffect');
      generateCard();
    }
  }, [profile, cardData, generatedFront]);

  const generateCard = async () => {
    if (!profile || !cardData) return;
    
    setGenerating(true);
    try {
      console.log('🔄 Gerando QR Code...');
      const qrData = cardData.qr_code || cardData.card_number;
      const qrUrl = await QRCode.toDataURL(qrData, {
        width: 256,
        margin: 0,
        color: { dark: '#000000', light: '#ffffff' }
      });
      console.log('✅ QR Code gerado');
      
      await generateFrontCard(profile, cardData, qrUrl);
    } catch (error) {
      console.error('❌ Erro ao gerar card:', error);
    } finally {
      setGenerating(false);
    }
  };

  const generateFrontCard = async (
    profileData: StudentProfile, 
    card: CardData, 
    qrUrl: string
  ): Promise<void> => {
    console.log('🎨 Iniciando geração do card...');
    console.log('📋 Dados:', { profile: profileData.full_name, card: card.card_number });
    
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('❌ Canvas ref não encontrado');
      console.log('💡 Tentando novamente em 100ms...');
      setTimeout(() => generateFrontCard(profileData, card, qrUrl), 100);
      return;
    }

    console.log('✅ Canvas encontrado');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('❌ Contexto 2D não disponível');
      return;
    }

    // Tamanho original do template (1010x644)
    canvas.width = 1010;
    canvas.height = 644;
    console.log('📐 Canvas configurado: 1010x644');

    // Tentar carregar template
    const templatePath = '/templates/frente-template.png';
    console.log('📸 Tentando carregar template:', templatePath);
    
    try {
      const template = await loadImage(templatePath);
      console.log('✅ Template carregado com sucesso!');
      console.log('📐 Dimensões template:', template.width, 'x', template.height);
      ctx.drawImage(template, 0, 0, 1010, 644);
      console.log('✅ Template desenhado no canvas');
    } catch (e) {
      console.error('❌ ERRO AO CARREGAR TEMPLATE:', e);
      console.error('❌ Path tentado:', templatePath);
      console.warn('⚠️ Usando fallback visual');
      drawFallbackBackground(ctx);
    }

    // Configurar texto
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Nome (bold, uppercase)
    console.log('✍️ Escrevendo nome:', profileData.full_name);
    ctx.font = 'bold 26px Arial';
    ctx.fillStyle = '#1F2937';
    ctx.fillText(profileData.full_name.toUpperCase(), 56, 224);

    // Instituição, Curso, Período
    ctx.font = '20px Arial';
    ctx.fillStyle = '#4B5563';
    ctx.fillText(profileData.institution || 'Instituição não informada', 56, 261);
    ctx.fillText(profileData.course || 'Curso não informado', 56, 289);
    ctx.fillText(profileData.period || '1º Período', 56, 317);

    // Dados pessoais
    ctx.font = '19px Arial';
    ctx.fillStyle = '#374151';
    ctx.fillText(`CPF: ${profileData.cpf}`, 56, 364);
    ctx.fillText(`RG: ${profileData.rg || 'Não informado'}`, 56, 392);
    ctx.fillText(`DATA NASC.: ${new Date(profileData.birth_date).toLocaleDateString('pt-BR')}`, 56, 420);

    // Ano de validade (grande)
    ctx.font = 'bold 52px Arial';
    ctx.fillStyle = '#000000';
    const year = new Date(card.valid_until).getFullYear();
    ctx.fillText(year.toString(), 75, 541);

    // Data validade
    ctx.font = '19px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(new Date(card.valid_until).toLocaleDateString('pt-BR'), 205, 569);

    // Código de uso
    ctx.font = '22px monospace';
    ctx.fillText(card.usage_code || 'XXXX-XXXX', 635, 569);

    console.log('✅ Textos desenhados');

    // Carregar foto (se existir)
    if (profileData.avatar_url) {
      console.log('📸 Carregando foto:', profileData.avatar_url);
      try {
        const foto = await loadImage(profileData.avatar_url);
        console.log('✅ Foto carregada');
        ctx.drawImage(foto, 710, 168, 240, 299);
        console.log('✅ Foto desenhada');
      } catch (e) {
        console.warn('⚠️ Erro ao carregar foto:', e);
        // Desenhar placeholder
        ctx.fillStyle = '#E5E7EB';
        ctx.fillRect(710, 168, 240, 299);
        ctx.fillStyle = '#9CA3AF';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('👤', 830, 300);
        ctx.textAlign = 'left';
      }
    } else {
      console.log('ℹ️ Sem foto, usando placeholder');
      ctx.fillStyle = '#E5E7EB';
      ctx.fillRect(710, 168, 240, 299);
      ctx.fillStyle = '#9CA3AF';
      ctx.font = '48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('👤', 830, 300);
      ctx.textAlign = 'left';
    }

    // Carregar QR Code
    console.log('📱 Carregando QR Code');
    try {
      const qr = await loadImage(qrUrl);
      console.log('✅ QR Code carregado');
      ctx.drawImage(qr, 859, 522, 120, 120);
      console.log('✅ QR Code desenhado');
    } catch (e) {
      console.warn('⚠️ Erro ao carregar QR Code:', e);
    }

    // Gerar Data URL diretamente do canvas principal
    const dataUrl = canvas.toDataURL('image/png');
    console.log('✅ Data URL gerado, tamanho:', dataUrl.length, 'bytes');
    setGeneratedFront(dataUrl);
    console.log('🎉 Geração concluída! Estado atualizado.');
  };

  const regenerateCard = async () => {
    console.log('🧪 REGENERAÇÃO MANUAL');
    console.log('Canvas ref:', canvasRef.current);
    console.log('Profile:', profile);
    console.log('Card:', cardData);
    setGeneratedFront('');
  };

  const downloadCard = (side: 'front' | 'back') => {
    const link = document.createElement('a');
    link.download = `carteirinha-${side === 'front' ? 'frente' : 'verso'}-${cardData?.card_number || 'ure'}.png`;

    if (side === 'front') {
      const canvas = canvasRef.current;
      if (canvas) {
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    } else {
      link.href = '/templates/verso-template.png';
      link.click();
    }

    toast({
      title: 'Download iniciado!',
      description: `Carteirinha (${side === 'front' ? 'frente' : 'verso'}) baixada com sucesso.`
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Canvas SEMPRE montado para geração */}
      <canvas 
        ref={canvasRef}
        width={1010}
        height={644}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -1
        }}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-muted-foreground">Carregando carteirinha...</p>
          </div>
        </div>
      ) : !cardData || !profile ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-4">
            <p className="text-xl text-foreground">Carteirinha não encontrada</p>
            <p className="text-sm text-muted-foreground">
              Complete seu cadastro e pagamento para gerar sua carteirinha.
            </p>
            <Button onClick={() => navigate('/dashboard')}>
              Voltar ao Dashboard
            </Button>
          </div>
        </div>
      ) : (
        <div className="py-6 px-4">
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

          {/* Preview da Carteirinha */}
          <div className="max-w-lg mx-auto">
            <div className="flex justify-center mb-6">
              {generating ? (
                <div className="flex flex-col items-center gap-4 p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p className="text-muted-foreground">Gerando carteirinha...</p>
                </div>
              ) : generatedFront || !showFront ? (
                <img
                  src={showFront ? generatedFront : '/templates/verso-template.png'}
                  alt={showFront ? 'Frente da carteirinha' : 'Verso da carteirinha'}
                  className="max-w-full h-auto rounded-lg shadow-xl"
                  style={{ maxWidth: '500px' }}
                />
              ) : (
                <div className="flex flex-col items-center gap-4 p-8 text-center">
                  <p className="text-muted-foreground">Carteirinha não gerada</p>
                  <Button onClick={regenerateCard} variant="outline" size="sm">
                    <RotateCw className="h-4 w-4 mr-2" />
                    Tentar Novamente
                  </Button>
                </div>
              )}
            </div>

            {/* Botões de Download */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => downloadCard('front')}
                className="gap-2"
                size="lg"
                disabled={!generatedFront}
              >
                <Download className="h-4 w-4" />
                Baixar Frente (Alta Resolução)
              </Button>
              <Button
                onClick={() => downloadCard('back')}
                variant="outline"
                className="gap-2"
                size="lg"
              >
                <Download className="h-4 w-4" />
                Baixar Verso
              </Button>
            </div>

            {/* Botão de debug */}
            <div className="flex justify-center mt-4">
              <Button
                onClick={regenerateCard}
                variant="ghost"
                size="sm"
                className="text-xs"
              >
                <RotateCw className="h-3 w-3 mr-1" />
                Regenerar Carteirinha
              </Button>
            </div>

            {/* Dica */}
            <p className="text-center text-xs text-muted-foreground mt-4">
              Alterne entre frente e verso usando os botões acima
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
