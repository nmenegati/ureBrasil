import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download, ArrowLeft, RotateCw } from 'lucide-react';
import QRCode from 'qrcode';
import { Header } from '@/components/Header';

interface StudentProfile {
  id: string;
  full_name: string;
  cpf: string;
  rg: string | null;
  birth_date: string;
  institution: string | null;
  course: string | null;
  period: string | null;
  profile_photo_url: string | null;
  plan_id?: string | null;
}

interface CardData {
  card_number: string;
  usage_code: string | null;
  qr_code: string;
  valid_until: string;
  status: string;
  card_type: string;
   digital_card_url?: string | null;
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

  const fetchData = useCallback(async () => {
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
        .select('card_number, usage_code, qr_code, valid_until, status, card_type, digital_card_url')
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
  }, [navigate, toast]);

  // Effect e função de geração movidos para baixo, após declaração de generateFrontCard

  const generateFrontCard = useCallback(async (
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

    canvas.width = 1010;
    canvas.height = 644;
    console.log('📐 Canvas configurado: 1010x644');

    const isLawStudent = profileData.plan_id === 'lexpraxis';
    const frontTemplate = isLawStudent
      ? '/templates/direito-frente-template-v.png'
      : '/templates/geral-frente-template-v.png';
    const templatePath = frontTemplate;
    console.log('📸 Tentando carregar template:', templatePath);
    
    try {
      const template = await loadImage(templatePath);
      console.log('✅ Template carregado com sucesso!');
      console.log('📐 Dimensões template:', template.width, 'x', template.height);
      canvas.width = template.width;
      canvas.height = template.height;
      ctx.drawImage(template, 0, 0, template.width, template.height);
      console.log('✅ Template desenhado no canvas');
    } catch (e) {
      console.error('❌ ERRO AO CARREGAR TEMPLATE:', e);
      console.error('❌ Path tentado:', templatePath);
      console.warn('⚠️ Usando fallback visual');
      drawFallbackBackground(ctx);
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const designWidth = 638;
    const designHeight = 1016;
    const cardWidth = canvas.width;
    const cardHeight = canvas.height;
    const scaleX = cardWidth / designWidth;
    const scaleY = cardHeight / designHeight;
    const sx = (value: number) => value * scaleX;
    const sy = (value: number) => value * scaleY;

    const paddingX = sx(46);

    console.log('✍️ Escrevendo nome:', profileData.full_name);
    ctx.font = `bold ${24 * scaleY}px Arial`;
    ctx.fillStyle = '#000000';
    ctx.fillText(profileData.full_name.toUpperCase(), paddingX, sy(520));

    const textLineHeight = sy(26);
    let currentY = sy(550);

    ctx.font = `${18 * scaleY}px Arial`;
    ctx.fillStyle = '#374151';
    if (profileData.institution) {
      ctx.fillText(profileData.institution, paddingX, currentY);
      currentY += textLineHeight;
    }

    if (profileData.course) {
      ctx.fillText(profileData.course, paddingX, currentY);
      currentY += textLineHeight;
    }

    if (profileData.period) {
      ctx.fillText(profileData.period, paddingX, currentY);
      currentY += textLineHeight * 1.5;
    } else {
      currentY += textLineHeight * 1.5;
    }

    ctx.font = `bold ${16 * scaleY}px Arial`;
    ctx.fillStyle = '#1F2937';
    ctx.fillText('CPF:', paddingX, currentY);
    ctx.font = `${16 * scaleY}px Arial`;
    ctx.fillText(profileData.cpf, paddingX + sx(80), currentY);

    currentY += textLineHeight;
    ctx.font = `bold ${16 * scaleY}px Arial`;
    ctx.fillText('Data Nasc.:', paddingX, currentY);
    ctx.font = `${16 * scaleY}px Arial`;
    ctx.fillText(
      new Date(profileData.birth_date).toLocaleDateString('pt-BR'),
      paddingX + sx(120),
      currentY
    );

    const bottomBlockY = sy(840);

    ctx.font = `bold ${18 * scaleY}px monospace`;
    ctx.fillStyle = '#000000';
    ctx.fillText('COD. USO:', paddingX, bottomBlockY);
    ctx.font = `bold ${22 * scaleY}px monospace`;
    ctx.fillText(card.usage_code || 'XXXX-XXXX', paddingX, bottomBlockY + textLineHeight);

    ctx.font = `bold ${16 * scaleY}px Arial`;
    ctx.fillStyle = '#000000';
    ctx.fillText('VÁLIDO ATÉ:', paddingX, bottomBlockY + textLineHeight * 2.1);
    ctx.font = `bold ${20 * scaleY}px Arial`;
    ctx.fillText(
      new Date(card.valid_until).toLocaleDateString('pt-BR'),
      paddingX + sx(110),
      bottomBlockY + textLineHeight * 2.1
    );

    console.log('✅ Textos desenhados');

    const fotoW = sx(240);
    const fotoH = sy(300);
    const fotoX = sx(46);
    const fotoY = sy(190);

    if (profileData.profile_photo_url) {
      console.log('📸 Carregando foto (profile_photo_url):', profileData.profile_photo_url);
      try {
        const { data: signed } = await supabase
          .storage
          .from('documents')
          .createSignedUrl(profileData.profile_photo_url, 300);
        const photoUrl = signed?.signedUrl || profileData.profile_photo_url;
        const foto = await loadImage(photoUrl);
        console.log('✅ Foto carregada');
        ctx.drawImage(foto, fotoX, fotoY, fotoW, fotoH);
        console.log('✅ Foto desenhada');
      } catch (e) {
        console.warn('⚠️ Erro ao carregar foto:', e);
        ctx.fillStyle = '#E5E7EB';
        ctx.fillRect(fotoX, fotoY, fotoW, fotoH);
        ctx.fillStyle = '#9CA3AF';
        ctx.font = '60px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('👤', fotoX + fotoW / 2, fotoY + fotoH / 2 - 30);
        ctx.textAlign = 'left';
      }
    } else {
      console.log('ℹ️ Sem foto, usando placeholder');
      ctx.fillStyle = '#E5E7EB';
      ctx.fillRect(fotoX, fotoY, fotoW, fotoH);
      ctx.fillStyle = '#9CA3AF';
      ctx.font = '60px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('👤', fotoX + fotoW / 2, fotoY + fotoH / 2 - 30);
      ctx.textAlign = 'left';
    }

      console.log('📱 Carregando QR Code');
    try {
      const qr = await loadImage(qrUrl);
      console.log('✅ QR Code carregado');

      const qrSize = sx(150);
      const qrX = cardWidth - sx(46) - qrSize;
      const qrY = sy(190);
      ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);

      console.log('✅ Todos os elementos desenhados');
    } catch (e) {
      console.warn('⚠️ Erro ao carregar QR Code:', e);
    }

    // Gerar Data URL diretamente do canvas principal
    const dataUrl = canvas.toDataURL('image/png');
    console.log('✅ Data URL gerado, tamanho:', dataUrl.length, 'bytes');
    setGeneratedFront(dataUrl);
    console.log('🎉 Geração concluída! Estado atualizado.');
  }, []);

  const generateCard = useCallback(async () => {
    if (!profile || !cardData) return;
    if (cardData.digital_card_url) return;
    
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
  }, [profile, cardData, generateFrontCard]);

  // Effect separado para gerar card quando dados e canvas estiverem prontos
  useEffect(() => {
    if (profile && cardData && canvasRef.current && !generatedFront && !cardData.digital_card_url) {
      console.log('🔄 Triggering card generation via useEffect');
      generateCard();
    }
  }, [profile, cardData, generatedFront, generateCard]);

  const regenerateCard = async () => {
    console.log('🧪 REGENERAÇÃO MANUAL');
    console.log('Canvas ref:', canvasRef.current);
    console.log('Profile:', profile);
    console.log('Card:', cardData);
    setGeneratedFront('');
  };

  const isLawStudentView = profile?.plan_id === 'lexpraxis';
  const backTemplatePath = isLawStudentView
    ? '/templates/direito-verso-template-v.png'
    : '/templates/geral-verso-template-v.png';

  const downloadCard = (side: 'front' | 'back') => {
    const link = document.createElement('a');
    link.download = `carteirinha-${side === 'front' ? 'frente' : 'verso'}-${cardData?.card_number || 'ure'}.png`;

    if (side === 'front') {
      if (cardData?.digital_card_url) {
        link.href = cardData.digital_card_url;
        link.click();
      } else {
        const canvas = canvasRef.current;
        if (canvas) {
          link.href = canvas.toDataURL('image/png');
          link.click();
        }
      }
    } else {
      link.href = backTemplatePath;
      link.click();
    }

    toast({
      title: 'Download iniciado!',
      description: `Carteirinha (${side === 'front' ? 'frente' : 'verso'}) baixada com sucesso.`
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header variant="app" />
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
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6">
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
          <div className="w-full max-w-sm mx-auto flex flex-col items-center gap-6">
            <div className="w-full flex justify-center">
              {generating ? (
                <div className="flex flex-col items-center gap-4 p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p className="text-muted-foreground">Gerando carteirinha...</p>
                </div>
              ) : cardData.digital_card_url ? (
                <img
                  src={showFront ? cardData.digital_card_url : backTemplatePath}
                  alt={showFront ? 'Frente da carteirinha' : 'Verso da carteirinha'}
                  className="w-full h-auto rounded-xl shadow-xl"
                />
              ) : generatedFront || !showFront ? (
                <img
                  src={showFront ? generatedFront : backTemplatePath}
                  alt={showFront ? 'Frente da carteirinha' : 'Verso da carteirinha'}
                  className="w-full h-auto rounded-xl shadow-xl"
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
            <div className="inline-flex items-center justify-center gap-2">
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
            {!cardData.digital_card_url && (
              <div className="flex justify-center">
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
            )}
            <div className="space-y-1">
              <p className="text-center text-xs text-muted-foreground">
                {cardData.card_number} • Válida até {new Date(cardData.valid_until).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
