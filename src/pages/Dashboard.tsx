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
  HelpCircle, ChevronRight, 
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

  // formatCPF and formatPhone imported from @/lib/validators

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

  // Determina o próximo passo
  const getNextStep = () => {
    if (!progress.profile) {
      return {
        message: "Complete seu perfil para continuar.",
        buttonText: "Completar Perfil",
        route: "/complete-profile",
        hasButton: true
      };
    }
    
    if (!progress.documents) {
      return {
        message: "Envie seus documentos para validação.",
        buttonText: "Enviar Documentos",
        route: "/upload-documentos",
        hasButton: true
      };
    }
    
    if (!progress.payment) {
      return {
        message: "Realize o pagamento para ativar sua carteirinha.",
        buttonText: "Realizar Pagamento",
        route: "/escolher-plano",
        hasButton: true
      };
    }
    
    // Pagamento OK, mas carteirinha ainda não emitida
    return {
      message: "Sua carteirinha está sendo processada. Isso pode levar até 24h.",
      buttonText: null,
      route: null,
      hasButton: false
    };
  };

  // Cards de navegação (apenas Documentos e Pagamentos)
  const navigationCards = [
    { 
      title: 'Documentos', 
      subtitle: 'Status de validação', 
      icon: FileText, 
      route: '/upload-documentos' 
    },
    { 
      title: 'Pagamentos', 
      subtitle: 'Histórico e comprovantes', 
      icon: CreditCard, 
      route: '/escolher-plano' 
    },
  ];

  // Etapas do progresso
  const steps = [
    { 
      label: 'Perfil', 
      completed: progress.profile, 
      subtitle: progress.profile ? 'Concluído' : 'Preencher dados' 
    },
    { 
      label: 'Documentos', 
      completed: progress.documents, 
      subtitle: progress.documents ? '4/4 aprovados' : `${documentsApproved}/4 aprovados` 
    },
    { 
      label: 'Pagamento', 
      completed: progress.payment, 
      subtitle: progress.payment ? 'Aprovado' : 'Pendente' 
    },
    { 
      label: 'Carteirinha', 
      completed: progress.card, 
      subtitle: progress.card ? 'Ativa' : 'Aguardando' 
    },
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
    <div className="min-h-screen bg-gradient-to-br from-[#0D7DBF] to-[#00A859] relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
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
    <div className="min-h-screen bg-gradient-to-br from-[#0D7DBF] to-[#00A859] relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
      </div>
      <Header variant="app" />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Saudação */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Olá, {profile.full_name.split(' ')[0]}! 👋
          </h1>
          <p className="text-white/80 mt-1">{getWelcomeMessage()}</p>
        </div>

        {/* Barra de Progresso */}
        <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-white/20 rounded-2xl p-6 mb-8 shadow-xl shadow-black/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Seu Progresso</h2>
            <span className="text-primary font-bold">{percentage}%</span>
          </div>
          
          {/* Barra */}
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-6">
            <div 
              className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>

          {/* Cards de Etapas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map((step, index) => (
              <div 
                key={index}
                className={`p-4 rounded-xl border transition-all ${
                  step.completed 
                    ? 'bg-primary/10 border-primary/30' 
                    : 'bg-slate-100 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {step.completed ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <Clock className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  )}
                  <span className={`font-medium ${step.completed ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                    {step.label}
                  </span>
                </div>
                <p className={`text-sm ${step.completed ? 'text-primary' : 'text-slate-500 dark:text-slate-400'}`}>
                  {step.subtitle}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* LINHA 1: Próximo Passo + Suas Informações (lado a lado) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Próximo Passo ou Carteirinha - ocupa 2/3 */}
          <div className="lg:col-span-2">
            {progress.card && card ? (
              <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-xl shadow-black/10 h-full">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div>
                    <p className="text-primary text-sm font-medium">Carteirinha Digital</p>
                    <h2 className="text-slate-900 dark:text-white text-2xl font-bold mt-1">{profile.full_name}</h2>
                    {profile.institution && (
                      <p className="text-slate-600 dark:text-slate-300 text-sm">{profile.institution}</p>
                    )}
                    {profile.course && (
                      <p className="text-slate-600 dark:text-slate-300 text-sm">{profile.course}</p>
                    )}
                    <div className="mt-4 space-y-1">
                      <p className="text-slate-700 dark:text-slate-200">Nº: {card.card_number}</p>
                      <p className="text-slate-700 dark:text-slate-200">Válida até: {formatDate(card.valid_until)}</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 mt-6">
                  <Button 
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    onClick={() => toast.info('Em breve!')}
                  >
                    <Download className="w-4 h-4 mr-2" /> Baixar PDF
                  </Button>
                  <Button 
                    variant="outline" 
                    className="border-primary text-primary hover:bg-primary/10"
                    onClick={() => toast.info('Em breve!')}
                  >
                    <QrCode className="w-4 h-4 mr-2" /> Ver QR Code
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-xl shadow-black/10 h-full">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-full">
                    {nextStep.hasButton ? (
                      <AlertCircle className="w-6 h-6 text-primary" />
                    ) : (
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-slate-900 dark:text-white font-bold text-lg">
                      {nextStep.hasButton ? 'Próximo Passo' : 'Processando...'}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-300">{nextStep.message}</p>
                  </div>
                </div>
                {nextStep.hasButton && nextStep.route && (
                  <Button 
                    className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground"
                    onClick={() => navigate(nextStep.route!)}
                  >
                    {nextStep.buttonText} <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Suas Informações - ocupa 1/3 */}
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-white/20 rounded-xl p-4 shadow-lg shadow-black/5 h-full">
            <h3 className="text-slate-900 dark:text-white font-bold mb-4">Suas Informações</h3>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-500 dark:text-slate-400">CPF</p>
                  <p className="text-slate-900 dark:text-white">{formatCPF(profile.cpf)}</p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Telefone</p>
                  <p className="text-slate-900 dark:text-white">{formatPhone(profile.phone)}</p>
                </div>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Email</p>
                <p className="text-slate-900 dark:text-white break-all">{user.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* LINHA 2: Documentos + Pagamentos + Precisa de Ajuda? (3 cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {navigationCards.map((card, index) => (
            <div 
              key={index}
              className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-white/20 rounded-xl p-4 hover:scale-[1.02] cursor-pointer transition-all group shadow-lg shadow-black/5"
              onClick={() => navigate(card.route)}
            >
              <div className="flex justify-between items-start">
                <card.icon className="w-6 h-6 text-primary" />
                <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-slate-900 dark:text-white font-bold mt-4">{card.title}</h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm">{card.subtitle}</p>
            </div>
          ))}

          {/* Card Precisa de Ajuda? */}
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-white/20 rounded-xl p-4 shadow-lg shadow-black/5">
            <div className="flex justify-between items-start">
              <HelpCircle className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-slate-900 dark:text-white font-bold mt-4">Precisa de Ajuda?</h3>
            <p className="text-slate-600 dark:text-slate-300 text-sm">Nossa equipe está pronta!</p>
            <Button 
              className="w-full mt-3 bg-primary hover:bg-primary/90 text-primary-foreground"
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