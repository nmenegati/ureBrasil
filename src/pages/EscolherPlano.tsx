import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { Check, CreditCard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Configuração visual dos planos digitais
const digitalPlans = [
  {
    type: 'geral_digital',
    name: 'Digital Geral',
    price: 29,
    description: 'Ensino médio, superior, cursos',
    features: [
      'Carteirinha digital',
      'QR Code de verificação',
      'Validade até 31/03/2026',
      'Emissão em até 2h',
      'Acesso ilimitado ao app',
      'Suporte prioritário'
    ],
    highlight: false,
    badge: null
  },
  {
    type: 'direito_digital',
    name: 'Digital Direito',
    price: 44,
    description: 'Para futuros advogados',
    features: [
      'Carteirinha digital',
      'QR Code de verificação',
      'Validade até 31/03/2026',
      'Emissão em até 2h',
      'Benefícios exclusivos Direito',
      'Material de estudo OAB',
      'Descontos em cursos jurídicos',
      'Rede de networking jurídico'
    ],
    highlight: true,
    badge: 'JURISESTUDANTE'
  }
];

export default function EscolherPlano() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [planIds, setPlanIds] = useState<Record<string, string>>({});
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);

  // ID do plano Geral Digital para redirecionamento automático
  const PLAN_GERAL_DIGITAL_ID = 'a20e423f-c222-47b0-814f-e532f1bbe0c4';

  // Carregar perfil e verificar elegibilidade
  useEffect(() => {
    const checkEligibilityAndLoadPlans = async () => {
      if (!user) return;

      // Buscar perfil com is_law_student
      const { data: profile } = await supabase
        .from('student_profiles')
        .select('id, is_law_student')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        // Sem perfil, redirecionar para completar
        navigate('/complete-profile');
        return;
      }

      setProfileId(profile.id);

      // Se NÃO é estudante de Direito, redirecionar direto para pagamento
      if (!profile.is_law_student) {
        localStorage.setItem('selected_plan_id', PLAN_GERAL_DIGITAL_ID);
        
        // Atualizar plan_id no banco
        await supabase
          .from('student_profiles')
          .update({ plan_id: PLAN_GERAL_DIGITAL_ID })
          .eq('id', profile.id);
        
        toast.info('Plano Geral Digital selecionado automaticamente');
        navigate('/pagamento');
        return;
      }

      // É estudante de Direito - buscar IDs dos planos digitais
      const { data: plansData } = await supabase
        .from('plans')
        .select('id, type')
        .eq('is_active', true)
        .in('type', ['geral_digital', 'direito_digital']);

      if (plansData) {
        const ids: Record<string, string> = {};
        plansData.forEach(p => {
          ids[p.type] = p.id;
        });
        setPlanIds(ids);
      }

      setLoading(false);
    };

    checkEligibilityAndLoadPlans();
  }, [user, navigate]);

  const handleSelectPlan = async (planType: string, planName: string) => {
    const planId = planIds[planType];
    if (!planId) {
      toast.error('Plano não encontrado');
      return;
    }

    setSelecting(planType);

    try {
      // Armazenar no localStorage para uso na página de pagamento
      localStorage.setItem('selected_plan_id', planId);
      
      // Se tiver profileId, atualizar no banco também
      if (profileId) {
        const { error } = await supabase
          .from('student_profiles')
          .update({ plan_id: planId })
          .eq('id', profileId);

        if (error) {
          console.warn('Erro ao atualizar plan_id no perfil (não crítico):', error);
        }
      }

      toast.success(`Plano "${planName}" selecionado!`);
      navigate('/pagamento');
    } catch (error: unknown) {
      toast.error('Erro ao selecionar plano');
      console.error(error);
    } finally {
      setSelecting(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0D7DBF] to-[#00A859] relative">
      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
      </div>
      <Header variant="app" />
      
      <main className="relative z-10 py-8 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Escolha seu Plano
            </h1>
            <p className="text-lg text-white/80">
              Todas as opções incluem validade de 1 ano
            </p>
          </div>

          {/* Grid de Planos Digitais */}
          <div className="grid md:grid-cols-2 gap-6">
            {digitalPlans.map((plan) => (
              <Card 
                key={plan.type}
                className={`relative bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all ${
                  plan.highlight 
                    ? 'border-2 border-yellow-500 shadow-yellow-500/20' 
                    : 'border-white/20'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-yellow-500 text-black text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <CardContent className="p-6 pt-8">
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    {plan.name}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    {plan.description}
                  </p>

                  <div className="mb-6">
                    <span className="text-4xl font-bold text-primary">
                      R$ {plan.price}
                    </span>
                    <span className="text-muted-foreground ml-2">/ano</span>
                  </div>

                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-600 dark:text-slate-300">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleSelectPlan(plan.type, plan.name)}
                    disabled={selecting !== null}
                    className={`w-full ${
                      plan.highlight 
                        ? 'bg-yellow-500 hover:bg-yellow-600 text-black' 
                        : 'bg-primary hover:bg-primary/90'
                    }`}
                    size="lg"
                  >
                    {selecting === plan.type && (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    )}
                    Solicitar {plan.name}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Informação sobre versão física */}
          <div className="mt-8">
            <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/50 backdrop-blur-sm">
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <CreditCard className="w-6 h-6 text-blue-500" />
                  <h4 className="text-xl font-bold text-slate-900 dark:text-white">
                    Carteirinha Física Disponível
                  </h4>
                </div>

                <p className="text-muted-foreground mb-4">
                  Após o pagamento, você poderá adicionar a versão física em PVC 
                  de alta qualidade por apenas <strong className="text-foreground">R$ 15,00</strong>
                </p>

                <div className="flex flex-wrap justify-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-slate-600 dark:text-slate-300">Material PVC durável</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-slate-600 dark:text-slate-300">Frete para todo Brasil</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-slate-600 dark:text-slate-300">Entrega em 7-10 dias</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Footer */}
          <div className="mt-10 text-center text-sm text-white/80">
            <p>🔒 Pagamento 100% seguro</p>
            <p className="mt-2">Dúvidas? contato@urebrasil.com.br</p>
          </div>
        </div>
      </main>
    </div>
  );
}
