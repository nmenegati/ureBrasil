import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatCPF, formatPhone } from '@/lib/validators';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Header } from '@/components/Header';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { 
  CheckCircle, Clock, FileText, CreditCard, 
  HelpCircle, ChevronRight, User,
  AlertCircle, Download, QrCode, Truck
} from 'lucide-react';
interface StudentProfile {
  id: string;
  full_name: string;
  cpf: string;
  phone: string;
  institution: string | null;
  course: string | null;
  profile_completed: boolean;
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

  const fetchData = async () => {
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

      // 3. Buscar pagamento aprovado
      const { data: payment } = await supabase
        .from('payments')
        .select('status')
        .eq('student_id', profileData.id)
        .eq('status', 'approved')
        .maybeSingle();

      setPaymentApproved(!!payment);

      // 4. Buscar carteirinha
      const { data: cardData } = await supabase
        .from('student_cards')
        .select('*')
        .eq('student_id', profileData.id)
        .maybeSingle();

      setCard(cardData);
      
      // 5. Calcular progresso
      setProgress({
        profile: profileData.profile_completed,
        documents: approved >= 4,
        payment: !!payment,
        card: cardData?.status === 'active'
      });
      
    } catch (error) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoadingData(false);
    }
  };

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

  // Calcula porcentagem
  const getPercentage = () => {
    return Object.values(progress).filter(Boolean).length * 25;
  };

  // Mensagem dinâmica de boas-vindas
  const getWelcomeMessage = () => {
    const pct = getPercentage();
    if (pct === 0) return "Complete as etapas abaixo para obter sua carteirinha.";
    if (pct === 25) return "Bom começo! Continue completando as etapas.";
    if (pct === 50) return "Você está na metade do caminho!";
    if (pct === 75) return "Quase lá! Só mais um passo.";
    return "Parabéns! Sua carteirinha está pronta!";
  };

  // Determina o próximo passo - retorna null quando tudo completo
  const getNextStep = () => {
    if (!progress.profile) {
      return {
        title: 'Complete seu Perfil',
        description: 'Preencha seus dados para continuar',
        buttonText: 'Completar Perfil',
        route: '/complete-profile'
      };
    }
    
    if (!progress.documents) {
      return {
        title: 'Envie seus Documentos',
        description: 'Precisamos validar sua documentação',
        buttonText: 'Enviar Documentos',
        route: '/upload-documentos'
      };
    }
    
    if (!progress.payment) {
      return {
        title: 'Escolha seu Plano',
        description: 'Realize o pagamento para ativar sua carteirinha',
        buttonText: 'Escolher Plano',
        route: '/escolher-plano'
      };
    }
    
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

  // Cards de progresso clicáveis com estados
  const progressSteps = [
    {
      id: 'perfil',
      label: 'Perfil',
      status: progress.profile ? 'Concluído' : 'Pendente',
      icon: User,
      enabled: true, // Sempre habilitado
      route: '/perfil',
      completed: progress.profile
    },
    {
      id: 'documentos',
      label: 'Documentos',
      status: progress.documents ? '4/4 aprovados' : `${documentsApproved}/4`,
      icon: FileText,
      enabled: progress.profile, // Só habilita se perfil completo
      route: '/upload-documentos',
      completed: progress.documents
    },
    {
      id: 'pagamento',
      label: 'Pagamento',
      status: progress.payment ? 'Aprovado' : 'Pendente',
      icon: CreditCard,
      enabled: progress.documents, // Só habilita se docs aprovados
      route: '/escolher-plano',
      completed: progress.payment
    },
    {
      id: 'carteirinha',
      label: 'Carteirinha',
      status: progress.card ? 'Ativa' : 'Aguardando',
      icon: CreditCard,
      enabled: progress.payment, // Só habilita se pagou
      route: '/carteirinha',
      completed: progress.card
    }
  ];

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
      <div className="min-h-screen bg-gradient-to-br from-[#0D7DBF] to-[#00A859] relative">
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <Header variant="app" />
        <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-white/20 rounded-2xl p-8 text-center max-w-lg mx-auto shadow-xl shadow-black/10">
            <AlertCircle className="w-16 h-16 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Complete seu Perfil</h2>
            <p className="text-slate-600 dark:text-slate-300 mt-2">
              Para acessar todas as funcionalidades e obter sua carteirinha estudantil, complete seu cadastro.
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

  const nextStep = getNextStep();
  const percentage = getPercentage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0D7DBF] to-[#00A859] relative">
      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
      </div>
      <Header variant="app" />

      <main className="relative z-10 max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Saudação compacta */}
        <div className="text-white">
          <h1 className="text-xl sm:text-2xl font-bold">
            Olá, {profile.full_name.split(' ')[0]}! 👋
          </h1>
          <p className="text-white/80 text-sm">{getWelcomeMessage()}</p>
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

          {/* Cards clicáveis 2x2 */}
          <div className="grid grid-cols-2 gap-3">
            {progressSteps.map((step) => (
              <button
                key={step.id}
                onClick={() => step.enabled && navigate(step.route)}
                disabled={!step.enabled}
                className={`
                  group p-4 rounded-xl border-2 text-left transition-all duration-300 ease-out
                  ${step.enabled 
                    ? step.completed
                      ? 'bg-primary/10 border-primary/30 hover:bg-primary/20 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/20 cursor-pointer' 
                      : 'bg-white dark:bg-slate-700/50 border-primary/20 hover:border-primary hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/15 hover:-translate-y-0.5 cursor-pointer'
                    : 'bg-slate-100 dark:bg-slate-700/30 border-slate-200 dark:border-slate-600 cursor-not-allowed opacity-50'
                  }
                `}
              >
                <div className="flex items-center gap-2 mb-2">
                  {step.completed ? (
                    <CheckCircle className="h-5 w-5 text-green-500 group-hover:scale-110 transition-transform duration-300" />
                  ) : step.enabled ? (
                    <step.icon className="h-5 w-5 text-primary group-hover:scale-110 group-hover:text-primary transition-all duration-300" />
                  ) : (
                    <Clock className="h-5 w-5 text-slate-400" />
                  )}
                </div>
                <span className={`font-semibold text-sm block transition-colors duration-300 ${
                  step.enabled ? 'text-slate-900 dark:text-white group-hover:text-primary' : 'text-slate-400'
                }`}>
                  {step.label}
                </span>
                <span className={`text-xs transition-colors duration-300 ${
                  step.completed ? 'text-green-600' : step.enabled ? 'text-muted-foreground group-hover:text-primary/70' : 'text-slate-400'
                }`}>
                  {step.status}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Próximo Passo (só se houver) */}
        {nextStep && (
          <div className="bg-[#ff6b35] rounded-xl p-4 shadow-lg">
            <div className="flex items-start gap-3">
              {nextStep.buttonText ? (
                <AlertCircle className="h-5 w-5 text-white mt-0.5 flex-shrink-0" />
              ) : (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-white">{nextStep.title}</h3>
                <p className="text-sm text-white/80 mb-3">{nextStep.description}</p>
                {nextStep.buttonText && nextStep.route && (
                  <Button 
                    onClick={() => navigate(nextStep.route!)} 
                    className="w-full bg-white hover:bg-white/90 text-[#ff6b35] font-semibold"
                  >
                    {nextStep.buttonText}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Carteirinha Digital (só se ativa) */}
        {progress.card && card && (
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-white/20 rounded-2xl p-4 shadow-xl shadow-black/10">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-primary text-sm font-medium">Carteirinha Digital</p>
                  
                  {/* Badges para carteirinha física */}
                  {card.is_physical && (
                    <>
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
