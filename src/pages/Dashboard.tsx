import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  CheckCircle, Clock, User, FileText, CreditCard, 
  HelpCircle, Settings, LogOut, ChevronRight, 
  AlertCircle, Download, QrCode
} from 'lucide-react';
import ureLogo from '@/assets/ure-brasil-logo.png';

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
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      // 1. Buscar perfil
      const { data: profileData, error: profileError } = await supabase
        .from('student_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Erro ao buscar perfil:', profileError);
        toast.error('Erro ao carregar dados');
        setLoading(false);
        return;
      }

      // Se não tem perfil, deixar o Dashboard mostrar UI apropriada
      setProfile(profileData);

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
      const prog = {
        profile: profileData.profile_completed,
        documents: approved >= 4,
        payment: !!payment,
        card: cardData?.status === 'active'
      };
      setProgress(prog);
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
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

  // Formatação de CPF: 123.456.789-00
  const formatCPF = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  // Formatação de telefone: (11) 99999-9999
  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return phone;
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

  // Cards de navegação
  const navigationCards = [
    { 
      title: 'Meu Perfil', 
      subtitle: 'Ver e editar informações', 
      icon: User, 
      route: '/perfil' 
    },
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
    { 
      title: 'Suporte', 
      subtitle: 'Precisa de ajuda?', 
      icon: HelpCircle, 
      route: '/suporte' 
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto"></div>
          <p className="text-slate-400 mt-4">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Se não tem perfil, mostrar tela para completar
  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-700/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <img src={ureLogo} alt="URE Brasil" className="h-10 w-auto" />
                <span className="text-white font-semibold hidden sm:block">Carteirinha Estudantil</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:text-red-400 hover:bg-slate-700/50"
                onClick={handleSignOut}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-8 text-center max-w-lg mx-auto">
            <AlertCircle className="w-16 h-16 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white">Complete seu Perfil</h2>
            <p className="text-slate-400 mt-2">
              Para acessar todas as funcionalidades e obter sua carteirinha estudantil, complete seu cadastro.
            </p>
            <Button 
              className="mt-6 bg-cyan-500 hover:bg-cyan-600 text-white"
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img src={ureLogo} alt="URE Brasil" className="h-10 w-auto" />
              <span className="text-white font-semibold hidden sm:block">Carteirinha Estudantil</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:text-white hover:bg-slate-700/50"
                onClick={() => toast.info('Em breve!')}
              >
                <HelpCircle className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:text-white hover:bg-slate-700/50"
                onClick={() => toast.info('Em breve!')}
              >
                <Settings className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:text-red-400 hover:bg-slate-700/50"
                onClick={handleSignOut}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Saudação */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Olá, {profile.full_name.split(' ')[0]}! 👋
          </h1>
          <p className="text-slate-400 mt-1">{getWelcomeMessage()}</p>
        </div>

        {/* Barra de Progresso */}
        <div className="bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Seu Progresso</h2>
            <span className="text-cyan-400 font-bold">{percentage}%</span>
          </div>
          
          {/* Barra */}
          <div className="h-3 bg-slate-700 rounded-full overflow-hidden mb-6">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
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
                    ? 'bg-cyan-500/10 border-cyan-500/30' 
                    : 'bg-slate-700/30 border-slate-600/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {step.completed ? (
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  ) : (
                    <Clock className="h-5 w-5 text-slate-500" />
                  )}
                  <span className={`font-medium ${step.completed ? 'text-white' : 'text-slate-400'}`}>
                    {step.label}
                  </span>
                </div>
                <p className={`text-sm ${step.completed ? 'text-cyan-400' : 'text-slate-500'}`}>
                  {step.subtitle}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Conteúdo Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Card da Carteirinha ou Próximo Passo */}
            {progress.card && card ? (
              <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-2xl p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div>
                    <p className="text-cyan-400 text-sm font-medium">Carteirinha Digital</p>
                    <h2 className="text-white text-2xl font-bold mt-1">{profile.full_name}</h2>
                    {profile.institution && (
                      <p className="text-slate-400 text-sm">{profile.institution}</p>
                    )}
                    {profile.course && (
                      <p className="text-slate-400 text-sm">{profile.course}</p>
                    )}
                    <div className="mt-4 space-y-1">
                      <p className="text-slate-300">Nº: {card.card_number}</p>
                      <p className="text-slate-300">Válida até: {formatDate(card.valid_until)}</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 mt-6">
                  <Button 
                    className="bg-cyan-500 hover:bg-cyan-600 text-white"
                    onClick={() => toast.info('Em breve!')}
                  >
                    <Download className="w-4 h-4 mr-2" /> Baixar PDF
                  </Button>
                  <Button 
                    variant="outline" 
                    className="border-cyan-500 text-cyan-400 hover:bg-cyan-500/10"
                    onClick={() => toast.info('Em breve!')}
                  >
                    <QrCode className="w-4 h-4 mr-2" /> Ver QR Code
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-cyan-500/10 rounded-full">
                    {nextStep.hasButton ? (
                      <AlertCircle className="w-6 h-6 text-cyan-400" />
                    ) : (
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg">
                      {nextStep.hasButton ? 'Próximo Passo' : 'Processando...'}
                    </h3>
                    <p className="text-slate-400">{nextStep.message}</p>
                  </div>
                </div>
                {nextStep.hasButton && nextStep.route && (
                  <Button 
                    className="mt-4 bg-cyan-500 hover:bg-cyan-600 text-white"
                    onClick={() => navigate(nextStep.route!)}
                  >
                    {nextStep.buttonText} <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            )}

            {/* Cards de Navegação */}
            <div className="grid grid-cols-2 gap-4">
              {navigationCards.map((card, index) => (
                <div 
                  key={index}
                  className="bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 rounded-xl p-4 hover:bg-slate-700/50 cursor-pointer transition-all group"
                  onClick={() => {
                    if (card.route === '/perfil' || card.route === '/suporte') {
                      toast.info('Em breve!');
                    } else {
                      navigate(card.route);
                    }
                  }}
                >
                  <div className="flex justify-between items-start">
                    <card.icon className="w-6 h-6 text-cyan-400" />
                    <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-slate-300 transition-colors" />
                  </div>
                  <h3 className="text-white font-bold mt-4">{card.title}</h3>
                  <p className="text-slate-400 text-sm">{card.subtitle}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Suas Informações */}
            <div className="bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 rounded-xl p-4">
              <h3 className="text-white font-bold mb-4">Suas Informações</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-slate-500">CPF</p>
                  <p className="text-white">{formatCPF(profile.cpf)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Telefone</p>
                  <p className="text-white">{formatPhone(profile.phone)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Email</p>
                  <p className="text-white break-all">{user.email}</p>
                </div>
              </div>
            </div>

            {/* Card de Ajuda */}
            <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-xl p-4">
              <h3 className="text-white font-bold">Precisa de Ajuda?</h3>
              <p className="text-slate-300 text-sm mt-1">Nossa equipe está pronta para te ajudar!</p>
              <Button 
                className="w-full mt-4 bg-cyan-500 hover:bg-cyan-600 text-white"
                onClick={() => toast.info('Em breve!')}
              >
                Abrir Ticket
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
