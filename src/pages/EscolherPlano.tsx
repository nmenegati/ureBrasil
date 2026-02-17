import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { ProgressBar } from '@/components/ProgressBar';
import { Check, CreditCard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { BorderTrail } from '@/components/ui/border-trail';
import { useOnboardingGuard } from '@/hooks/useOnboardingGuard';
import { formatPrice } from '@/utils/payment-helpers';
import {
  getValidityDate,
} from "@/utils/payment-helpers";

// Configuração visual dos planos digitais (descrições e features fixas)
const digitalPlansConfig = [
  {
    type: 'geral_digital' as const,
    description: 'Educação básica ao ensino superior',
    features: [
      'Carteira URE digital',
      'QR Code de verificação',
      'Validade até 31/03/2026',
      'Emissão em até 2h',
      'Acesso ilimitado ao app',
      'Suporte prioritário'
    ],
    highlight: false as const
  },
  {
    type: 'direito_digital' as const,
    description: 'Exclusiva para estudantes de Direito',
    features: [
      'Carteira digital',
      'QR Code de verificação',
      'Validade até 31/03/2026',
      'Emissão em até 2h',
      'Benefícios exclusivos Direito',
      'Material de estudo OAB',
      'Descontos em cursos jurídicos',
      'Rede de networking jurídico'
    ],
    highlight: true as const,
    badge: 'Direito' as const
  }
];

export default function EscolherPlano() {
  const { isChecking } = useOnboardingGuard('choose_plan');
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [planIds, setPlanIds] = useState<Record<string, string>>({});
  const [digitalPlans, setDigitalPlans] = useState<
    {
      type: 'geral_digital' | 'direito_digital';
      name: string;
      price: number;
      description: string;
      features: string[];
      highlight: boolean;
      badge?: string;
    }[]
  >([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [isLawStudent, setIsLawStudent] = useState(false);
  const [upsellPrice, setUpsellPrice] = useState<number | null>(null);

  // ID do plano Geral Digital para redirecionamento automático
  const PLAN_GERAL_DIGITAL_ID = 'a20e423f-c222-47b0-814f-e532f1bbe0c4';

  // Carregar perfil e verificar elegibilidade
  useEffect(() => {
    const checkEligibilityAndLoadPlans = async () => {
      if (!user) return;

      // Buscar perfil com is_law_student
      const { data: profile } = await supabase
        .from('student_profiles')
        .select('id, is_law_student, education_level, plan_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        // Sem perfil, redirecionar para completar
        navigate('/complete-profile');
        return;
      }

      setProfileId(profile.id);
      setIsLawStudent(!!profile.is_law_student);

      // Se NÃO é estudante de Direito, redirecionar direto para pagamento
      if (!profile.is_law_student) {
        // Só atualiza plan_id se ainda não tiver um definido
        if (!profile.plan_id) {
          localStorage.setItem('selected_plan_id', PLAN_GERAL_DIGITAL_ID);
          
          await supabase
            .from('student_profiles')
            .update({ plan_id: PLAN_GERAL_DIGITAL_ID })
            .eq('id', profile.id);
          
          toast.info('Plano Geral Digital selecionado automaticamente');
        }
        navigate('/pagamento');
        return;
      }

      // É estudante de Direito - buscar planos digitais a partir da tabela plans
      const { data: plansData } = await supabase
        .from('plans')
        .select('id, type, name, price')
        .eq('is_active', true)
        .in('type', ['geral_digital', 'direito_digital', 'fisica_upsell']);

      if (plansData) {
        const ids: Record<string, string> = {};
        const plansByType: Record<string, { id: string; name: string; price: number }> = {};

        plansData.forEach(p => {
          ids[p.type] = p.id;
          plansByType[p.type] = {
            id: p.id,
            name: p.name,
            price: p.price
          };
        });
        setPlanIds(ids);

        if (plansByType['fisica_upsell']) {
          setUpsellPrice(plansByType['fisica_upsell'].price);
        }

        const mergedPlans = digitalPlansConfig
          .map(config => {
            const dbPlan = plansByType[config.type];
            if (!dbPlan) return null;

            return {
              type: config.type,
              name: dbPlan.name,
              price: dbPlan.price,
              description: config.description,
              features: config.features,
              highlight: config.highlight,
              badge: config.badge
            };
          })
          .filter((p): p is {
            type: 'geral_digital' | 'direito_digital';
            name: string;
            price: number;
            description: string;
            features: string[];
            highlight: boolean;
            badge?: string;
          } => p !== null);

        setDigitalPlans(mergedPlans);
      }

      setLoading(false);
    };

    if (!isChecking) {
      checkEligibilityAndLoadPlans();
    }
  }, [user, navigate, isChecking, authLoading]);

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

  if (authLoading || isChecking || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header variant="app" />
      
      <main className="py-8 px-4">
        <div className="container mx-auto max-w-4xl">
          <ProgressBar currentStep="payment" />
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
              Escolha sua Carteira URE
            </h1>
            <p className="text-base text-muted-foreground">
                Documento válido para identificação estudantil
            </p>
          </div>

          {/* Grid de Planos Digitais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {digitalPlans.map((plan) => (
              <div key={plan.type} className="relative h-full">
                <Card
                  className={`group relative h-full bg-gray-200 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 border-2 border-transparent ${
                    plan.highlight
                      ? 'hover:border-ure-yellow hover:ring-2 hover:ring-ure-yellow/30'
                      : 'hover:border-ure-blue hover:ring-2 hover:ring-ure-blue/30'
                  }`}
                >
                  <BorderTrail
                    className={`${plan.highlight ? 'bg-ure-yellow/60' : 'bg-ure-blue/50'} blur-[2px]`}
                    size={plan.highlight ? 170 : 160}
                    initialOffset={plan.highlight ? 55 : 10}
                    transition={{ duration: 9, ease: 'linear', repeat: Infinity }}
                    delay={plan.highlight ? 0.9 : 0}
                    style={{
                      boxShadow: plan.highlight
                        ? '0 0 44px 14px hsl(var(--ure-yellow) / 0.28)'
                        : '0 0 40px 12px hsl(var(--ure-blue) / 0.25)',
                    }}
                  />
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-ure-yellow text-ure-dark border-none px-4 py-1 text-xs font-bold rounded-full">
                        {plan.badge}
                      </span>
                    </div>
                  )}
                  <CardContent className="pt-8 pb-6 flex flex-col h-full">
                    <div className="text-center mb-6">
                      <h3 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h3>
                      <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                      <div className="flex items-baseline justify-center gap-2">
                        <span className={`text-5xl font-black ${plan.highlight ? 'text-ure-yellow' : 'text-ure-blue'}`}>
                          R$ {plan.price}
                        </span>
                        <span className="text-muted-foreground">/ano</span>
                      </div>
                    </div>
                    <div className="space-y-3 mb-6 flex-grow">
                      {plan.features.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <Check className="w-5 h-5 text-ure-green mt-0.5 flex-shrink-0" />
                          <span className={`text-sm text-foreground ${plan.highlight && idx >= 4 ? 'font-bold' : ''}`}>
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="brand-primary"
                      className="w-full font-bold"
                      disabled={selecting !== null}
                      onClick={() => handleSelectPlan(plan.type, plan.name)}
                    >
                      {selecting === plan.type && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      {plan.type === 'direito_digital' ? 'Solicitar Agora' : 'Solicitar Agora'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>

          {/* Informação sobre versão física */}
          <div className="mt-8">
            <Card className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 border-blue-500/50 backdrop-blur-sm">
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <CreditCard className="w-6 h-6 text-blue-500" />
                  <h4 className="text-xl font-bold text-foreground">
                    Carteira Física
                  </h4>
                </div>
                <p className="text-muted-foreground mb-4 text-center">
                  Após concluir o pagamento da carteira digital, você poderá adquirir a versão física por <strong className="text-foreground">{upsellPrice !== null ? formatPrice(upsellPrice) : 'R$ ...'}</strong>, com frete incluso para todo o Brasil.
                </p>
                <p className="text-sm text-muted-foreground text-center">
                  Material durável — Frete incluso para todo Brasil — Disponível como adicional pós‑pagamento
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Footer */}
          <div className="mt-10 text-center text-sm text-muted-foreground">
            <p>🔒 Pagamento 100% seguro</p>
            <p className="mt-2">Dúvidas? suporte@urebrasil.com.br</p>
          </div>
        </div>
      </main>
    </div>
  );
}
