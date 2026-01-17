import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatCPF, formatPhone } from '@/lib/validators';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Header } from '@/components/Header';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { 
  CheckCircle, Clock, FileText, CreditCard, 
  HelpCircle, ChevronRight, User,
  AlertCircle, Download, QrCode, Truck, Lock
} from 'lucide-react';
interface StudentProfile {
  id: string;
  full_name: string;
  cpf: string;
  phone: string;
  institution: string | null;
  course: string | null;
  profile_completed: boolean;
  is_law_student?: boolean;
}

interface StudentCard {
  id: string;
  card_number: string;
  valid_until: string;
  status: 'pending_docs' | 'pending_payment' | 'processing' | 'active' | 'expired' | 'cancelled';
  qr_code: string;
  digital_card_url: string | null;
  is_physical?: boolean;
  shipping_status?: 'pending' | 'processing' | 'shipped' | 'delivered' | 'failed' | null;
  shipping_code?: string | null;
}

interface Progress {
  profile: boolean;
  documents: boolean;
  payment: boolean;
  card: boolean;
}

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [loadingData, setLoadingData] = useState(true);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [card, setCard] = useState<StudentCard | null>(null);
  const [documentsApproved, setDocumentsApproved] = useState(0);
  const [paymentApproved, setPaymentApproved] = useState(false);
  const [isLawStudent, setIsLawStudent] = useState(false);
  const [progress, setProgress] = useState<Progress>({
    profile: false,
    documents: false,
    payment: false,
    card: false
  });
  
  // Estados para modal de upsell
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [recentPaymentId, setRecentPaymentId] = useState<string | null>(null);

  // Redirecionar se não autenticado
  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true });
    }
  }, [user, loading, navigate]);

  // Buscar dados quando tiver usuário
  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  // Verificar pagamento recente para mostrar modal de upsell
  useEffect(() => {
    const checkRecentPayment = async () => {
      const paymentId = localStorage.getItem('recent_payment_id');
      if (!paymentId || !user || !profile) return;

      try {
        // Verificar se carteirinha já é física
        const { data: cardData } = await supabase
          .from('student_cards')
          .select('is_physical')
          .eq('payment_id', paymentId)
          .maybeSingle();

        if (!cardData || cardData.is_physical) {
          localStorage.removeItem('recent_payment_id');
          return;
        }

        // Verificar se já existe pagamento de upsell para este pagamento
        const { data: existingUpsell } = await supabase
          .from('payments')
          .select('id')
          .eq('student_id', profile.id)
          .contains('metadata', { original_payment_id: paymentId })
          .maybeSingle();

        if (existingUpsell) {
          localStorage.removeItem('recent_payment_id');
          return;
        }

        // Mostrar modal após 2 segundos
        setRecentPaymentId(paymentId);
        setTimeout(() => {
          setShowUpsellModal(true);
        }, 2000);

        localStorage.removeItem('recent_payment_id');
      } catch (error) {
        console.error('Error checking payment:', error);
        localStorage.removeItem('recent_payment_id');
      }
    };

    if (!loading && !loadingData && user && profile) {
      checkRecentPayment();
    }
  }, [user, loading, loadingData, profile]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    
    setLoadingData(true);
    
    try {
      // 1. Buscar perfil
      const { data: profileData, error: profileError } = await supabase
        .from('student_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        toast.error('Erro ao carregar dados');
        setLoadingData(false);
        return;
      }

      setProfile(profileData);
      setIsLawStudent(profileData?.is_law_student || false);

      if (!profileData) {
        setLoadingData(false);
        return;
      }

      // 2. Buscar documentos
      const { data: docs } = await supabase
        .from('documents')
        .select('status')
        .eq('student_id', profileData.id);

      const approved = docs?.filter(d => d.status === 'approved').length || 0;
      setDocumentsApproved(approved);

      // 3. Buscar último pagamento aprovado (pode haver múltiplos)
      console.log('🔍 Buscando pagamento para student_id:', profileData.id);
      
      const { data: paymentsApproved, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .eq('student_id', profileData.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1);

      // Pegar primeiro resultado (mais recente)
      const payment = paymentsApproved?.[0] || null;

      console.log('💳 PAGAMENTOS APROVADOS:', paymentsApproved);
      console.log('💳 ÚLTIMO PAGAMENTO:', payment);
      console.log('💳 ERRO NA QUERY:', paymentError);
      console.log('💳 paymentApproved será:', !!payment);

      setPaymentApproved(!!payment);

      // 4. Buscar carteirinha
      const { data: cardData } = await supabase
        .from('student_cards')
        .select('*')
        .eq('student_id', profileData.id)
        .maybeSingle();

      console.log('🎴 CARD COMPLETO:', JSON.stringify(cardData, null, 2));
      console.log('📦 is_physical:', cardData?.is_physical, '| tipo:', typeof cardData?.is_physical);

      setCard(cardData);
      
      // 5. Calcular progresso
      const newProgress = {
        profile: profileData.profile_completed,
        documents: approved >= 4,
        payment: !!payment,
        card: cardData?.status === 'active'
      };
      console.log('📊 PROGRESSO CALCULADO:', newProgress);
      setProgress(newProgress);
      
    } catch (error) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error('Erro ao sair');
    } else {
      toast.success('Você saiu com sucesso');
      navigate('/');
    }
  };

  // Aceitar upsell - redirecionar para checkout
  const handleAcceptUpsell = () => {
    navigate('/checkout', {
      state: {
        isUpsell: true,
        amount: 15,
        originalPaymentId: recentPaymentId,
        planType: 'physical_addon'
      }
    });
  };

  const handleDeclineUpsell = () => {
    setShowUpsellModal(false);
    toast('Tudo certo! Sua carteirinha digital está disponível.');
  };

  // Formatação de data: 31/03/2025
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const getPercentage = () => {
    if (!progress.profile) return 0;
    if (progress.profile && !progress.payment) return 33;
    if (progress.profile && progress.payment && !progress.documents) return 67;
    if (progress.profile && progress.payment && progress.documents) return 100;
    return 0;
  };

  // Mensagem dinâmica de boas-vindas
  const getWelcomeMessage = () => {
    const pct = getPercentage();
    if (pct === 0) return "Complete as etapas abaixo para obter sua carteirinha.";
    if (pct === 33) return "Bom começo! Continue completando as etapas.";
    if (pct === 67) return "Quase lá! Só mais um passo.";
    return "Parabéns! Sua carteirinha está pronta!";
  };

  // Determina o próximo passo - NOVA ORDEM: Perfil → Pagamento → Docs → Carteirinha
  const getNextStep = () => {
    // 1. PERFIL PRIMEIRO
    if (!progress.profile) {
      return {
        title: 'Complete seu Perfil',
        description: 'Preencha seus dados para emissão da carteirinha',
        buttonText: 'Completar Perfil',
        route: '/complete-profile'
      };
    }
    
    // 2. DEPOIS PAGAMENTO
    if (!progress.payment) {
      return {
        title: isLawStudent ? 'Escolha seu Plano' : 'Realize o Pagamento',
        description: isLawStudent ? 'Escolha entre Carteira Digital (Geral) ou LexPraxis' : 'Finalize com a Carteira Estudantil Digital (Geral)',
        buttonText: isLawStudent ? 'Escolher Plano' : 'Pagar Agora',
        route: isLawStudent ? '/escolher-plano' : '/pagamento'
      };
    }
    
    // 3. DEPOIS DOCUMENTOS
    if (!progress.documents) {
      return {
        title: 'Envie seus Documentos',
        description: 'Precisamos validar sua documentação',
        buttonText: 'Enviar Documentos',
        route: '/upload-documentos'
      };
    }
    
    // 4. AGUARDANDO CARTEIRINHA
    if (!progress.card) {
      return {
        title: 'Processando...',
        description: 'Sua carteirinha está sendo emitida (até 24h)',
        buttonText: null,
        route: null
      };
    }
    
    return null; // Tudo completo, não mostra
  };

  const progressCards = [
    {
      title: 'Perfil',
      icon: User,
      completed: progress.profile,
      enabled: true,
      route: progress.profile ? '/perfil' : '/complete-profile'
    },
    {
      title: 'Pagamento',
      icon: CreditCard,
      completed: progress.payment,
      enabled: progress.profile,
      route: '/escolher-plano'
    },
    {
      title: 'Documentos',
      icon: FileText,
      completed: progress.documents,
      enabled: progress.payment,
      route: '/upload-documentos'
    }
  ];
  
  // Card data alias para o card simplificado
  const cardData = card;

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-4">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Se não tem perfil, mostrar tela para completar
  if (!profile) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-ure-gradient-start to-ure-gradient-end relative">
          {/* Decorative elements */}
        <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <Header variant="app" />
        <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-white/20 rounded-2xl p-8 text-center max-w-lg mx-auto shadow-xl shadow-black/10">
            <AlertCircle className="w-16 h-16 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Ative Sua Economia Agora</h2>
            <p className="text-slate-600 dark:text-slate-300 mt-2">
              Finalize seu pedido para desbloquear todos os benefícios estudantis.
            </p>
            <Button 
              className="mt-6 bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => navigate('/complete-profile')}
            >
              Completar Perfil <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const percentage = getPercentage();

  return (
    <div className="min-h-screen bg-background">
      <Header variant="app" />

      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-4">
        {/* Saudação compacta */}
        <div className="text-foreground">
          <h1 className="text-xl sm:text-2xl font-bold">
            Olá, {profile.full_name.split(' ')[0]}! 👋
          </h1>
          <p className="text-sm text-muted-foreground">{getWelcomeMessage()}</p>
        </div>

        {/* Progresso (barra + cards clicáveis) */}
        <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-white/20 rounded-2xl p-4 shadow-xl shadow-black/10">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold text-slate-900 dark:text-white">Seu Progresso</h2>
            <span className="text-primary font-bold">{percentage}%</span>
          </div>
          
          {/* Barra */}
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-4">
            <div 
              className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {progressCards.map((card) => (
              <Card
                key={card.title}
                className={cn(
                  "cursor-pointer transition-all",
                  card.enabled
                    ? "hover:shadow-lg hover:-translate-y-1"
                    : "opacity-50 cursor-not-allowed"
                )}
                onClick={() => card.enabled && navigate(card.route)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "p-3 rounded-full",
                        card.completed
                          ? "bg-green-100 text-green-600"
                          : card.enabled
                          ? "bg-blue-100 text-blue-600"
                          : "bg-gray-100 text-gray-400"
                      )}
                    >
                      <card.icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{card.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {card.completed
                          ? "Concluído"
                          : card.enabled
                          ? "Clique para completar"
                          : "Aguardando etapa anterior"}
                      </p>
                    </div>
                    {card.completed && (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    )}
                    {!card.enabled && (
                      <Lock className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Card Carteirinha - segue padrão de estados (habilitado/desabilitado) */}
        <Card 
          className={cn(
            "transition-colors relative overflow-visible bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-white/20 shadow-xl shadow-black/10",
            cardData ? "cursor-pointer hover:border-primary" : "opacity-60 cursor-not-allowed"
          )}
          onClick={() => cardData && navigate('/carteirinha')}
        >
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {cardData ? (
                  cardData.status === 'active' ? (
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  ) : (
                    <Clock className="w-8 h-8 text-yellow-500" />
                  )
                ) : (
                  <Clock className="w-8 h-8 text-slate-400" />
                )}
                <div>
                  <h3 className="font-semibold text-lg text-slate-900 dark:text-white">Carteirinha</h3>
                  <p className={
                    !cardData
                      ? 'text-slate-500 text-sm'
                      : cardData.status === 'active'
                      ? 'text-green-500 text-sm font-medium'
                      : 'text-yellow-500 text-sm'
                  }>
                    {!cardData
                      ? 'Ainda não emitida'
                      : cardData.status === 'active'
                      ? 'Ativa'
                      : 'Aguardando emissão'}
                  </p>
                </div>
              </div>
              
              {cardData?.is_physical && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  <div className="inline-flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-full">
                    <Truck className="w-4 h-4" />
                    <span>Digital + Física</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 bg-orange-500 text-white text-xs font-bold px-3 py-2 rounded-full">
                    <span>📦</span>
                    <span>Entrega 7-10 dias</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Carteirinha Digital (só se ativa) */}
        {progress.card && card && (
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-white/20 rounded-2xl p-4 shadow-xl shadow-black/10">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-primary text-sm font-medium">Carteirinha Digital</p>
                  
                  {/* Badges para carteirinha física */}
                  {(() => {
                    console.log('🔍 Verificando is_physical no render:', card?.is_physical);
                    return null;
                  })()}
                  {card.is_physical && (
                    <>
                      {console.log('✅ Renderizando badges de carteirinha física')}
                      <span className="bg-blue-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        + Física
                      </span>
                      <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                        📦 Entrega em 7-10 dias
                      </span>
                    </>
                  )}
                </div>
                <h2 className="text-slate-900 dark:text-white text-xl font-bold mt-1">{profile.full_name}</h2>
                {profile.institution && (
                  <p className="text-slate-600 dark:text-slate-300 text-sm">{profile.institution}</p>
                )}
                {profile.course && (
                  <p className="text-slate-600 dark:text-slate-300 text-sm">{profile.course}</p>
                )}
                <div className="mt-3 space-y-1 text-sm">
                  <p className="text-slate-700 dark:text-slate-200">Nº: {card.card_number}</p>
                  <p className="text-slate-700 dark:text-slate-200">Válida até: {formatDate(card.valid_until)}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <Button 
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                size="sm"
                onClick={() => toast.info('Em breve!')}
              >
                <Download className="w-4 h-4 mr-2" /> Baixar PDF
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="flex-1 border-primary text-primary hover:bg-primary/10"
                onClick={() => toast.info('Em breve!')}
              >
                <QrCode className="w-4 h-4 mr-2" /> Ver QR Code
              </Button>
            </div>
          </div>
        )}

        {/* Grid 2 colunas: Informações + Ajuda */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Suas Informações */}
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-white/20 rounded-xl p-4 shadow-lg shadow-black/5">
            <h3 className="text-slate-900 dark:text-white font-bold mb-3">Suas Informações</h3>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">CPF</p>
                  <p className="text-slate-900 dark:text-white">{formatCPF(profile.cpf)}</p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">Telefone</p>
                  <p className="text-slate-900 dark:text-white">{formatPhone(profile.phone)}</p>
                </div>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400 text-xs">Email</p>
                <p className="text-slate-900 dark:text-white break-all text-xs">{user.email}</p>
              </div>
            </div>
          </div>
          
          {/* Precisa de Ajuda */}
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-white/20 rounded-xl p-4 shadow-lg shadow-black/5">
            <HelpCircle className="w-6 h-6 text-primary mb-2" />
            <h3 className="text-slate-900 dark:text-white font-bold">Precisa de Ajuda?</h3>
            <p className="text-slate-600 dark:text-slate-300 text-sm mb-3">Nossa equipe está pronta!</p>
            <Button 
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              size="sm"
              onClick={() => toast.info('Em breve!')}
            >
              Abrir Ticket
            </Button>
          </div>
        </div>
      </main>

      {/* Modal Upsell - Carteirinha Física */}
      <Dialog open={showUpsellModal} onOpenChange={() => {}}>
        <DialogContent 
          className="sm:max-w-md p-0 overflow-hidden border-0" 
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="p-6">
            {/* Badge */}
            <div className="flex justify-center mb-4">
              <span className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs font-bold px-4 py-1.5 rounded-full">
                🎁 OFERTA ESPECIAL
              </span>
            </div>

            {/* Header */}
            <div className="flex items-start gap-4 mb-4">
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Truck className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Quer receber também em casa?</h3>
                <p className="text-muted-foreground text-sm">Carteirinha física de PVC de alta qualidade</p>
              </div>
            </div>

            {/* Benefícios */}
            <div className="bg-muted/50 rounded-lg p-4 mb-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Material PVC de alta durabilidade</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Frete grátis para todo Brasil</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Entrega em 7-10 dias úteis</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Mesmos benefícios da digital</span>
              </div>
            </div>

            {/* Preço */}
            <div className="bg-muted/50 rounded-lg p-3 mb-5 text-center">
              <p className="text-muted-foreground text-xs mb-1">Adicione agora por apenas</p>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-muted-foreground text-sm line-through">R$ 29,90</span>
                <span className="text-3xl font-bold text-primary">R$ 15,00</span>
              </div>
              <p className="text-green-500 text-xs font-semibold mt-1">50% de desconto • Oferta única</p>
            </div>

            {/* Botões */}
            <div className="space-y-3">
              <Button 
                className="w-full py-6" 
                onClick={handleAcceptUpsell}
              >
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Sim, quero receber em casa!
                </span>
              </Button>
              <button
                onClick={handleDeclineUpsell}
                className="w-full text-muted-foreground hover:text-foreground text-sm py-2 transition-colors"
              >
                Não, obrigado. Só a digital mesmo.
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
