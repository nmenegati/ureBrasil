import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatCPF, formatPhone } from '@/lib/validators';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Header } from '@/components/Header';
import { 
  CheckCircle, Clock, FileText, CreditCard, 
  HelpCircle, ChevronRight, User,
  AlertCircle, Download, QrCode
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
                  p-4 rounded-xl border-2 text-left transition-all
                  ${step.enabled 
                    ? step.completed
                      ? 'bg-primary/10 border-primary/30 hover:bg-primary/20 cursor-pointer' 
                      : 'bg-white dark:bg-slate-700/50 border-primary/20 hover:border-primary/50 cursor-pointer'
                    : 'bg-slate-100 dark:bg-slate-700/30 border-slate-200 dark:border-slate-600 cursor-not-allowed opacity-50'
                  }
                `}
              >
                <div className="flex items-center gap-2 mb-2">
                  {step.completed ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : step.enabled ? (
                    <step.icon className="h-5 w-5 text-primary" />
                  ) : (
                    <Clock className="h-5 w-5 text-slate-400" />
                  )}
                </div>
                <span className={`font-semibold text-sm block ${
                  step.enabled ? 'text-slate-900 dark:text-white' : 'text-slate-400'
                }`}>
                  {step.label}
                </span>
                <span className={`text-xs ${
                  step.completed ? 'text-green-600' : step.enabled ? 'text-muted-foreground' : 'text-slate-400'
                }`}>
                  {step.status}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Próximo Passo (só se houver) */}
        {nextStep && (
          <div className="bg-white dark:bg-slate-800 border-2 border-[#ff6b35] rounded-xl p-4 shadow-lg shadow-[#ff6b35]/20">
            <div className="flex items-start gap-3">
              {nextStep.buttonText ? (
                <AlertCircle className="h-5 w-5 text-[#ff6b35] mt-0.5 flex-shrink-0" />
              ) : (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#ff6b35] mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 dark:text-white">{nextStep.title}</h3>
                <p className="text-sm text-muted-foreground mb-3">{nextStep.description}</p>
                {nextStep.buttonText && nextStep.route && (
                  <Button 
                    onClick={() => navigate(nextStep.route!)} 
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
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
              <div>
                <p className="text-primary text-sm font-medium">Carteirinha Digital</p>
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
    </div>
  );
}
